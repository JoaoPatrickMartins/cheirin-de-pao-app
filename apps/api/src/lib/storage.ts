import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'node:crypto'

/**
 * Armazenamento de imagens de produto do mini market ("Além do Pãozin") no S3.
 *
 * Configuração via env (S3_REGION / S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY,
 * + S3_PUBLIC_BASE_URL opcional). TODAS opcionais no boot: sem elas a API sobe normalmente
 * e `uploadProductImage` lança um erro claro — o upload só funciona quando o bucket estiver
 * configurado. Use `isStorageConfigured()` para checar antes de expor o recurso na UI.
 */

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB — casa com o limite do @fastify/multipart

// content-type → extensão do arquivo
const ALLOWED_TYPES = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
])

export class StorageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageError'
  }
}

interface S3Config {
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
}

let cachedClient: S3Client | null = null

function getConfig(): S3Config | null {
  const region = process.env.S3_REGION
  const bucket = process.env.S3_BUCKET
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  if (!region || !bucket || !accessKeyId || !secretAccessKey) return null
  return { region, bucket, accessKeyId, secretAccessKey }
}

/** true quando as credenciais do S3 estão presentes no ambiente. */
export function isStorageConfigured(): boolean {
  return getConfig() !== null
}

function getClient(cfg: S3Config): S3Client {
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: cfg.region,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    })
  }
  return cachedClient
}

/**
 * Faz upload de uma imagem de produto e retorna a URL pública.
 * Valida tipo (JPG/PNG/WebP) e tamanho (≤ 5 MB). Lança {@link StorageError} em qualquer falha
 * de validação/configuração.
 */
export async function uploadProductImage(body: Buffer, contentType: string): Promise<string> {
  const cfg = getConfig()
  if (!cfg) throw new StorageError('Armazenamento de imagens não configurado.')

  const ext = ALLOWED_TYPES.get(contentType)
  if (!ext) throw new StorageError('Formato inválido. Envie uma imagem JPG, PNG ou WebP.')
  if (body.length > MAX_BYTES) throw new StorageError('Imagem acima do limite de 5 MB.')

  const key = `products/${randomUUID()}.${ext}`
  await getClient(cfg).send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  const base =
    process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, '') ||
    `https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com`
  return `${base}/${key}`
}
