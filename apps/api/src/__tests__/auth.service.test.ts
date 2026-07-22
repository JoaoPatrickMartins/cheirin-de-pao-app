// Auth service unit tests — Requirements: AUTH-05 (OTP generation), AUTH-06 (session management)
import { vi } from 'vitest'
import { AuthService } from '../modules/auth/auth.service.js'
import type { FastifyInstance } from 'fastify'

function createMockFastify(overrides: Record<string, unknown> = {}): FastifyInstance {
  return {
    prisma: {
      otpCode: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'otp1', ...data }),
        ),
        update: vi.fn().mockResolvedValue({}),
      },
      session: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'session1', ...data }),
        ),
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({}),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'user1', ...data }),
        ),
        update: vi.fn().mockResolvedValue({}),
      },
      ...overrides,
    },
    jwt: {
      sign: vi.fn().mockReturnValue('signed.jwt.token'),
      verify: vi.fn(),
    },
  } as unknown as FastifyInstance
}

describe('AuthService [AUTH-05, AUTH-06]', () => {
  it('generateOtpCode returns 4-digit string between 1000 and 9999', () => {
    const service = new AuthService(createMockFastify())
    for (let i = 0; i < 100; i++) {
      const code = service.generateOtpCode()
      expect(code).toHaveLength(4)
      const n = parseInt(code, 10)
      expect(n).toBeGreaterThanOrEqual(1000)
      expect(n).toBeLessThanOrEqual(9999)
    }
  })

  it('dev mode OTP_DEV_CODE=1234 stores hash of dev code without calling external services', async () => {
    const originalEnv = process.env.NODE_ENV
    const originalCode = process.env.OTP_DEV_CODE
    process.env.NODE_ENV = 'development'
    process.env.OTP_DEV_CODE = '1234'

    const fastify = createMockFastify()
    const service = new AuthService(fastify)

    await service.sendOtp('user1', 'cliente@example.com')

    const createCall = (
      fastify.prisma.otpCode.create as ReturnType<typeof vi.fn>
    ).mock.calls[0]?.[0] as { data: { code: string } }
    expect(createCall?.data?.code).toBe(service.hashValue('1234'))

    process.env.NODE_ENV = originalEnv
    if (originalCode === undefined) {
      delete process.env.OTP_DEV_CODE
    } else {
      process.env.OTP_DEV_CODE = originalCode
    }
  })

  it('session expiresAt < now returns 401', async () => {
    const fastify = createMockFastify()
    ;(fastify.prisma.otpCode.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'otp1',
      code: 'irrelevant',
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    })

    const service = new AuthService(fastify)
    const result = await service.verifyOtpAndCreateSession('user1', '1234', 'device1')

    expect(result).toHaveProperty('error')
    expect((result as { status: number }).status).toBe(401)
  })

  it('device mismatch revokes sessions from other devices', async () => {
    const fastify = createMockFastify()
    const service = new AuthService(fastify)

    const hashedCode = service.hashValue('5678')
    ;(fastify.prisma.otpCode.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'otp2',
      code: hashedCode,
      expiresAt: new Date(Date.now() + 600_000),
      usedAt: null,
    })
    // Usuário resolvido para os claims do JWT
    ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'user1',
      role: 'CLIENT',
      name: 'Cliente Teste',
      passwordHash: null,
    })
    // Existing session from a different device
    ;(fastify.prisma.session.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'old-session', userId: 'user1', deviceId: 'device-old', isRevoked: false },
    ])

    const result = await service.verifyOtpAndCreateSession('user1', '5678', 'device-new')

    expect(result).toHaveProperty('accessToken')
    expect(result).toHaveProperty('refreshToken')
    expect((result as { hasPassword: boolean }).hasPassword).toBe(false)
    expect(fastify.prisma.session.update as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'old-session' }, data: { isRevoked: true } }),
    )
  })

  it('ADMIN login does NOT revoke sessions from other devices (multi-device allowed)', async () => {
    const fastify = createMockFastify()
    const service = new AuthService(fastify)

    const hashedCode = service.hashValue('5678')
    ;(fastify.prisma.otpCode.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'otp-admin',
      code: hashedCode,
      expiresAt: new Date(Date.now() + 600_000),
      usedAt: null,
    })
    ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'admin1',
      role: 'ADMIN',
      name: 'Admin Teste',
      passwordHash: null,
    })
    // Sessão ativa de outro dispositivo — NÃO deve ser revogada para ADMIN
    ;(fastify.prisma.session.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'admin-session-old', userId: 'admin1', deviceId: 'device-old', isRevoked: false },
    ])

    const result = await service.verifyOtpAndCreateSession('admin1', '5678', 'device-new')

    expect(result).toHaveProperty('accessToken')
    expect(result).toHaveProperty('refreshToken')
    // Nenhuma sessão de outro device pode ter sido revogada
    expect(fastify.prisma.session.update as ReturnType<typeof vi.fn>).not.toHaveBeenCalled()
  })

  it('refreshSession rotates tokens and revokes the old refresh', async () => {
    const fastify = createMockFastify()
    const service = new AuthService(fastify)

    const refreshRaw = 'refresh-raw-token'
    ;(fastify.prisma.session.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sess-old',
      userId: 'user1',
      deviceId: 'device-1',
      token: service.hashValue(refreshRaw),
      isRevoked: false,
      expiresAt: new Date(Date.now() + 600_000),
    })
    ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'user1',
      role: 'CLIENT',
      name: 'Cliente Teste',
      passwordHash: 'hash',
    })

    const result = await service.refreshSession(refreshRaw, 'device-1')

    expect(result).toHaveProperty('accessToken')
    expect((result as { hasPassword: boolean }).hasPassword).toBe(true)
    // rotação: revoga a sessão antiga
    expect(fastify.prisma.session.update as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sess-old' }, data: { isRevoked: true } }),
    )
  })

  it('refreshSession rejects a refresh token from another device', async () => {
    const fastify = createMockFastify()
    const service = new AuthService(fastify)

    const refreshRaw = 'refresh-raw-token'
    ;(fastify.prisma.session.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sess-old',
      userId: 'user1',
      deviceId: 'device-1',
      token: service.hashValue(refreshRaw),
      isRevoked: false,
      expiresAt: new Date(Date.now() + 600_000),
    })

    const result = await service.refreshSession(refreshRaw, 'device-OTHER')

    expect(result).toHaveProperty('error')
    expect((result as { status: number }).status).toBe(401)
  })

  it('loginWithPassword returns tokens for correct credentials', async () => {
    const fastify = createMockFastify()
    const service = new AuthService(fastify)
    const hash = await service.hashPassword('senha-correta-123')
    ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'user1',
      role: 'CLIENT',
      name: 'Cliente',
      email: 'cliente@example.com',
      passwordHash: hash,
      isBlocked: false,
    })

    const result = await service.loginWithPassword('cliente@example.com', 'senha-correta-123', 'dev1')

    expect(result).toHaveProperty('accessToken')
    expect(result).toHaveProperty('refreshToken')
    expect((result as { hasPassword: boolean }).hasPassword).toBe(true)
  })

  it('loginWithPassword returns generic 401 for wrong password', async () => {
    const fastify = createMockFastify()
    const service = new AuthService(fastify)
    const hash = await service.hashPassword('senha-correta-123')
    ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'user1',
      role: 'CLIENT',
      name: 'Cliente',
      passwordHash: hash,
      isBlocked: false,
    })

    const result = await service.loginWithPassword('cliente@example.com', 'senha-errada', 'dev1')

    expect(result).toHaveProperty('error')
    expect((result as { status: number }).status).toBe(401)
    expect((result as { error: string }).error).toBe('E-mail ou senha inválidos')
  })

  it('loginWithPassword returns generic 401 when account has no password yet', async () => {
    const fastify = createMockFastify()
    const service = new AuthService(fastify)
    ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'user1',
      role: 'CLIENT',
      name: 'Cliente',
      passwordHash: null,
      isBlocked: false,
    })

    const result = await service.loginWithPassword('cliente@example.com', 'qualquer-senha', 'dev1')

    expect(result).toHaveProperty('error')
    expect((result as { status: number }).status).toBe(401)
  })

  it('loginWithPassword returns generic 401 when email does not exist', async () => {
    const fastify = createMockFastify()
    const service = new AuthService(fastify)
    // user.findUnique default mock returns null

    const result = await service.loginWithPassword('naoexiste@example.com', 'qualquer', 'dev1')

    expect(result).toHaveProperty('error')
    expect((result as { status: number }).status).toBe(401)
    expect((result as { error: string }).error).toBe('E-mail ou senha inválidos')
  })

  it('setPassword sets hash when account has no password', async () => {
    const fastify = createMockFastify()
    const service = new AuthService(fastify)
    ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'user1',
      role: 'CLIENT',
      name: 'Cliente',
      passwordHash: null,
    })

    const result = await service.setPassword('user1', 'NovaSenha123')

    expect(result).toEqual({ ok: true })
    const updateCall = (fastify.prisma.user.update as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      data: { passwordHash: string; passwordSetAt: Date }
    }
    expect(updateCall.data.passwordHash).toBeTruthy()
    expect(updateCall.data.passwordSetAt).toBeInstanceOf(Date)
  })

  it('setPassword rejects (409) when account already has a password', async () => {
    const fastify = createMockFastify()
    const service = new AuthService(fastify)
    ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'user1',
      role: 'CLIENT',
      name: 'Cliente',
      passwordHash: 'existing-hash',
    })

    const result = await service.setPassword('user1', 'NovaSenha123')

    expect((result as { status: number }).status).toBe(409)
    expect(fastify.prisma.user.update as ReturnType<typeof vi.fn>).not.toHaveBeenCalled()
  })

  it('changePassword rejects wrong current password with 401', async () => {
    const fastify = createMockFastify()
    const service = new AuthService(fastify)
    const hash = await service.hashPassword('SenhaAtual123')
    ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'user1',
      role: 'CLIENT',
      name: 'Cliente',
      passwordHash: hash,
    })

    const result = await service.changePassword('user1', 'SenhaErrada999', 'NovaSenha123')

    expect((result as { status: number }).status).toBe(401)
    expect(fastify.prisma.user.update as ReturnType<typeof vi.fn>).not.toHaveBeenCalled()
  })

  it('changePassword updates hash when current password is correct', async () => {
    const fastify = createMockFastify()
    const service = new AuthService(fastify)
    const hash = await service.hashPassword('SenhaAtual123')
    ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'user1',
      role: 'CLIENT',
      name: 'Cliente',
      passwordHash: hash,
    })

    const result = await service.changePassword('user1', 'SenhaAtual123', 'NovaSenha456')

    expect(result).toEqual({ ok: true })
    expect(fastify.prisma.user.update as ReturnType<typeof vi.fn>).toHaveBeenCalled()
  })

  it('resetPasswordWithOtp sets new password and issues tokens on valid OTP', async () => {
    const fastify = createMockFastify()
    const service = new AuthService(fastify)
    const hashedCode = service.hashValue('4321')
    ;(fastify.prisma.otpCode.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'otp9',
      code: hashedCode,
      expiresAt: new Date(Date.now() + 600_000),
      usedAt: null,
    })
    ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'user1',
      role: 'CLIENT',
      name: 'Cliente',
      passwordHash: null,
    })

    const result = await service.resetPasswordWithOtp('user1', '4321', 'dev1', 'SenhaNova789')

    expect(result).toHaveProperty('accessToken')
    expect((result as { hasPassword: boolean }).hasPassword).toBe(true)
    expect(fastify.prisma.user.update as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user1' },
        data: expect.objectContaining({ passwordHash: expect.any(String) }),
      }),
    )
    // OTP consumido
    expect(fastify.prisma.otpCode.update as ReturnType<typeof vi.fn>).toHaveBeenCalled()
  })
})
