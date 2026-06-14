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
      },
      ...overrides,
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

    await service.sendOtp('user1', 'sms', '+5511999999999')

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
    // Existing session from a different device
    ;(fastify.prisma.session.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'old-session', userId: 'user1', deviceId: 'device-old', isRevoked: false },
    ])

    const result = await service.verifyOtpAndCreateSession('user1', '5678', 'device-new')

    expect(result).toHaveProperty('rawToken')
    expect(fastify.prisma.session.update as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'old-session' }, data: { isRevoked: true } }),
    )
  })
})
