import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'node:crypto'

/**
 * Armazenamento de imagens no S3 — fotos de produto do mini market ("Além do Pãozin") e artes
 * de banner.
 *
 * Configuração via env (S3_REGION / S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY,
 * + S3_PUBLIC_BASE_URL opcional). TODAS opcionais no boot: sem elas a API sobe normalmente
 * e `uploadImage` lança um erro claro — o upload só funciona quando o bucket estiver
 * configurado. Use `isStorageConfigured()` para checar antes de expor o recurso na UI.
 *
 * As pastas são um conjunto FECHADO (`UploadFolder`): o prefixo entra na chave do objeto, e
 * aceitar string livre aí seria deixar o chamador escrever onde quisesse no bucket.
 *
 * Fotos de ENTREGA (app do entregador, T-4) são privadas: `uploadPrivateImage` devolve só a CHAVE,
 * que é o que se grava no banco; a leitura é por URL assinada de curta duração
 * (`getSignedReadUrl`), gerada só para o dono do pedido e para o admin. A foto mostra a porta de
 * uma residência — URL pública permanente não serve. A foto da ocorrência do entregador (`reports/`)
 * segue a mesma regra. Infra (plano §8): a política do bucket não pode dar leitura pública aos
 * prefixos `deliveries/` e `reports/`, e a regra de ciclo de vida apaga os dois em 90 dias.
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

/** Pastas PÚBLICAS permitidas no bucket. Conjunto fechado de propósito (ver o cabeçalho). */
export type UploadFolder = 'products' | 'banners' | 'receipts' | 'couriers' | 'condos'

/** Pastas PRIVADAS — leitura só por URL assinada (foto da entrega; foto da ocorrência do entregador). */
export type PrivateUploadFolder = 'deliveries' | 'reports'

/** Validade padrão da URL assinada (10 min): o bastante para abrir a foto, curto para não circular. */
export const SIGNED_URL_TTL_SECONDS = 600

/** Mesma validação de tipo/tamanho para as duas visibilidades. Devolve a extensão. */
function validateImage(body: Buffer, contentType: string): string {
  const ext = ALLOWED_TYPES.get(contentType)
  if (!ext) throw new StorageError('Formato inválido. Envie uma imagem JPG, PNG ou WebP.')
  if (body.length > MAX_BYTES) throw new StorageError('Imagem acima do limite de 5 MB.')
  return ext
}

/**
 * Faz upload de uma imagem e retorna a URL pública.
 * Valida tipo (JPG/PNG/WebP) e tamanho (≤ 5 MB). Lança {@link StorageError} em qualquer falha
 * de validação/configuração.
 */
export async function uploadImage(
  body: Buffer,
  contentType: string,
  folder: UploadFolder = 'products',
): Promise<string> {
  const cfg = getConfig()
  if (!cfg) throw new StorageError('Armazenamento de imagens não configurado.')

  const ext = validateImage(body, contentType)

  const key = `${folder}/${randomUUID()}.${ext}`
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

/** Atalho histórico — a foto de produto sempre vai para `products/`. */
export function uploadProductImage(body: Buffer, contentType: string): Promise<string> {
  return uploadImage(body, contentType, 'products')
}

/**
 * Upload PRIVADO (foto de entrega). Devolve a CHAVE do objeto — grave a chave, nunca uma URL.
 * Sem `Cache-Control` público: o objeto não pode ficar em cache de CDN/navegador compartilhado.
 */
export async function uploadPrivateImage(
  body: Buffer,
  contentType: string,
  folder: PrivateUploadFolder = 'deliveries',
): Promise<string> {
  const cfg = getConfig()
  if (!cfg) throw new StorageError('Armazenamento de imagens não configurado.')
  const ext = validateImage(body, contentType)

  const key = `${folder}/${randomUUID()}.${ext}`
  await getClient(cfg).send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'private, max-age=0, no-store',
    }),
  )
  return key
}

/**
 * URL assinada de leitura para uma chave privada. Só aceita chaves das pastas privadas — gerar
 * URL assinada para qualquer chave seria um jeito de ler o bucket inteiro.
 */
export async function getSignedReadUrl(key: string, expiresInSeconds: number = SIGNED_URL_TTL_SECONDS): Promise<string> {
  const cfg = getConfig()
  if (!cfg) throw new StorageError('Armazenamento de imagens não configurado.')
  if (!/^(deliveries|reports)\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key)) throw new StorageError('Chave de imagem inválida.')
  return getSignedUrl(getClient(cfg), new GetObjectCommand({ Bucket: cfg.bucket, Key: key }), {
    expiresIn: expiresInSeconds,
  })
}
