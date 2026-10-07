import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// S3 e presigner simulados: guardamos o que seria enviado ao bucket.
const sent = vi.hoisted(() => [] as Array<{ kind: string; input: Record<string, unknown> }>)
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(function () {
    return { send: vi.fn(async (cmd: { kind: string; input: Record<string, unknown> }) => { sent.push(cmd); return {} }) }
  }),
  PutObjectCommand: vi.fn().mockImplementation(function (input: Record<string, unknown>) {
    return { kind: 'put', input }
  }),
  GetObjectCommand: vi.fn().mockImplementation(function (input: Record<string, unknown>) {
    return { kind: 'get', input }
  }),
}))
const getSignedUrl = vi.hoisted(() => vi.fn(async () => 'https://bucket.s3/signed?X-Amz-Signature=abc'))
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl }))

import { uploadPrivateImage, getSignedReadUrl, uploadImage, StorageError, SIGNED_URL_TTL_SECONDS } from '../storage.js'

const ENV = { S3_REGION: 'sa-east-1', S3_BUCKET: 'cheirin', S3_ACCESS_KEY_ID: 'k', S3_SECRET_ACCESS_KEY: 's' }
const jpg = Buffer.from([0xff, 0xd8, 0xff])

describe('storage — fotos de entrega privadas', () => {
  beforeEach(() => {
    Object.assign(process.env, ENV)
    sent.length = 0
    getSignedUrl.mockClear()
  })
  afterEach(() => {
    for (const k of Object.keys(ENV)) delete process.env[k]
  })

  it('upload privado devolve a CHAVE em deliveries/ e não usa cache público', async () => {
    const key = await uploadPrivateImage(jpg, 'image/jpeg')
    expect(key).toMatch(/^deliveries\/[0-9a-f-]{36}\.jpg$/)
    expect(sent[0].input).toMatchObject({ Bucket: 'cheirin', Key: key, ContentType: 'image/jpeg', CacheControl: 'private, max-age=0, no-store' })
  })

  it('upload público continua devolvendo URL (fotos de entregador/condomínio)', async () => {
    const url = await uploadImage(jpg, 'image/jpeg', 'couriers')
    expect(url).toMatch(/^https:\/\/cheirin\.s3\.sa-east-1\.amazonaws\.com\/couriers\/.+\.jpg$/)
  })

  it('tipo inválido → StorageError', async () => {
    await expect(uploadPrivateImage(jpg, 'image/gif')).rejects.toBeInstanceOf(StorageError)
  })

  it('URL assinada só para chave de pasta privada, com validade de 10 min', async () => {
    const key = 'deliveries/0b9d8a2e-1c3f-4d5e-9a7b-123456789abc.jpg'
    const url = await getSignedReadUrl(key)
    expect(url).toContain('X-Amz-Signature')
    expect(getSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ input: { Bucket: 'cheirin', Key: key } }), { expiresIn: SIGNED_URL_TTL_SECONDS })
    expect(SIGNED_URL_TTL_SECONDS).toBe(600)
  })

  it('recusa assinar chave fora de deliveries/ (não vira leitor do bucket inteiro)', async () => {
    await expect(getSignedReadUrl('products/x.jpg')).rejects.toBeInstanceOf(StorageError)
    await expect(getSignedReadUrl('deliveries/../products/x.jpg')).rejects.toBeInstanceOf(StorageError)
    expect(getSignedUrl).not.toHaveBeenCalled()
  })

  it('sem S3 configurado → StorageError', async () => {
    for (const k of Object.keys(ENV)) delete process.env[k]
    await expect(uploadPrivateImage(jpg, 'image/jpeg')).rejects.toThrow('não configurado')
  })
})
