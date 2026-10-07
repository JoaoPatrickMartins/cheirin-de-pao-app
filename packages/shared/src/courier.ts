/**
 * App do entregador — listas e contas que a API e o front precisam dizer IGUAL
 * (plano-app-entregador §3.3).
 *
 * Os motivos são o caso que mais importa: o entregador escolhe "Portaria não liberou" (FailSheet),
 * o admin conta por esse código (Entregas & falhas) e o cliente lê "não conseguimos acesso pela
 * portaria" (acompanhamento). Com três cópias, o relatório contaria uma coisa e o cliente leria
 * outra.
 */
import { WEEKDAYS } from './schemas/market'

// ── Motivos de não entrega (M-4) ────────────────────────────────────────────

export const FAILURE_CODES = [
  'CLIENTE_AUSENTE',
  'PORTARIA_NAO_LIBEROU',
  'ENDERECO_NAO_ENCONTRADO',
  'SEM_LUGAR',
  'PEDIDO_DANIFICADO',
  'OUTRO',
] as const
export type FailureCode = (typeof FAILURE_CODES)[number]

/** Correção entregue → não entregue feita pelo admin (H-2). Não aparece para o entregador. */
export const CORRECTED_BY_ADMIN_CODE = 'CORRIGIDO_ADMIN'

export const FAILURE_LABELS: Record<FailureCode, string> = {
  CLIENTE_AUSENTE: 'Cliente ausente',
  PORTARIA_NAO_LIBEROU: 'Portaria não liberou',
  ENDERECO_NAO_ENCONTRADO: 'Endereço/apto não encontrado',
  SEM_LUGAR: 'Sem lugar para deixar',
  PEDIDO_DANIFICADO: 'Pedido danificado',
  OUTRO: 'Outro',
}

/** O mesmo motivo na linguagem do cliente — completa "Tentamos entregar, mas ___". */
const FAILURE_CLIENT_TEXT: Record<FailureCode | typeof CORRECTED_BY_ADMIN_CODE, string> = {
  CLIENTE_AUSENTE: 'não encontramos ninguém para receber',
  PORTARIA_NAO_LIBEROU: 'não conseguimos acesso pela portaria',
  ENDERECO_NAO_ENCONTRADO: 'não encontramos o seu apartamento',
  SEM_LUGAR: 'não havia um lugar seguro para deixar',
  PEDIDO_DANIFICADO: 'o pedido foi danificado no caminho',
  // "Outro" é texto livre do entregador — não vai para o cliente.
  OUTRO: 'tivemos um imprevisto na entrega',
  CORRIGIDO_ADMIN: 'tivemos um imprevisto na entrega',
}

export function isFailureCode(value: unknown): value is FailureCode {
  return typeof value === 'string' && (FAILURE_CODES as readonly string[]).includes(value)
}

/** Texto do motivo para o cliente; null quando não há código (pedido antigo, só texto livre). */
export function failureClientText(code: string | null | undefined): string | null {
  if (!code) return null
  return (FAILURE_CLIENT_TEXT as Record<string, string>)[code] ?? null
}

// ── Comprovante (foto) ──────────────────────────────────────────────────────

/** Exceção da foto obrigatória ("Não consigo tirar a foto"). */
export const NO_PHOTO_REASONS = ['CAMERA_DEFEITO', 'SEM_LUZ', 'OUTRO'] as const
export type NoPhotoReason = (typeof NO_PHOTO_REASONS)[number]
export const NO_PHOTO_LABELS: Record<NoPhotoReason, string> = {
  CAMERA_DEFEITO: 'Câmera com defeito',
  SEM_LUZ: 'Local sem luz',
  OUTRO: 'Outro',
}

/** PENDING = confirmada, foto ainda não chegou · OK · NONE = exceção (com motivo) · SKIPPED = opcional, pulou. */
export const PROOF_STATUSES = ['PENDING', 'OK', 'NONE', 'SKIPPED'] as const
export type ProofStatus = (typeof PROOF_STATUSES)[number]

/** Por quanto tempo a foto da entrega fica disponível (D-4b · LGPD). */
export const PROOF_RETENTION_DAYS = 90

/** A foto expira 90 dias depois do desfecho, mesmo que o objeto ainda exista no bucket (T-5). */
export function isProofExpired(at: Date | string, now: Date = new Date()): boolean {
  const t = typeof at === 'string' ? new Date(at).getTime() : at.getTime()
  return now.getTime() - t > PROOF_RETENTION_DAYS * 24 * 60 * 60 * 1000
}

// ── Problemas, ocorrências e acesso ─────────────────────────────────────────

/** "Reportar problema" numa entrega realizada (E11). */
export const STOP_ISSUE_TYPES = ['CONFIRMEI_POR_ENGANO', 'APTO_ERRADO', 'OUTRO'] as const
export type StopIssueType = (typeof STOP_ISSUE_TYPES)[number]
export const STOP_ISSUE_LABELS: Record<StopIssueType, string> = {
  CONFIRMEI_POR_ENGANO: 'Confirmei por engano',
  APTO_ERRADO: 'Deixei no apartamento errado',
  OUTRO: 'Outro',
}

/** "Registrar ocorrência" (E12). */
export const INCIDENT_TYPES = ['ATRASO', 'VEICULO', 'ACIDENTE', 'PEDIDO_FALTANDO', 'OUTRO'] as const
export type IncidentType = (typeof INCIDENT_TYPES)[number]
export const INCIDENT_LABELS: Record<IncidentType, string> = {
  ATRASO: 'Atraso',
  VEICULO: 'Problema no veículo',
  ACIDENTE: 'Acidente',
  PEDIDO_FALTANDO: 'Pedido faltando',
  OUTRO: 'Outro',
}

/** Campo do acesso do condomínio que o entregador sugere corrigir (E7). */
export const ACCESS_FIELDS = ['PORTARIA', 'PORTAO', 'PARAR', 'OUTRO'] as const
export type AccessField = (typeof ACCESS_FIELDS)[number]
export const ACCESS_FIELD_LABELS: Record<AccessField, string> = {
  PORTARIA: 'Portaria',
  PORTAO: 'Portão',
  PARAR: 'Onde parar',
  OUTRO: 'Outro',
}

/** Acesso do condomínio para o entregador (A6/E7). Campos vazios ficam null. */
export interface CondoAccess {
  portaria: string | null
  temPorteiro: boolean | null
  portao: string | null
  parar: string | null
  obs: string | null
  fotoUrl: string | null
}

/** Lê o `courierAccess` gravado. Sem nenhuma dica preenchida → null ("Nenhuma dica ainda"). */
export function readCondoAccess(json: unknown): CondoAccess | null {
  if (!json || typeof json !== 'object') return null
  const a = json as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const out: CondoAccess = {
    portaria: str(a.portaria),
    temPorteiro: typeof a.temPorteiro === 'boolean' ? a.temPorteiro : null,
    portao: str(a.portao),
    parar: str(a.parar),
    obs: str(a.obs),
    fotoUrl: str(a.fotoUrl),
  }
  return Object.values(out).some((v) => v !== null) ? out : null
}

/** Campo do acesso que cada tipo de sugestão corrige ("Aplicar" no A6). */
export const ACCESS_FIELD_KEY: Record<AccessField, 'portaria' | 'portao' | 'parar' | 'obs'> = {
  PORTARIA: 'portaria',
  PORTAO: 'portao',
  PARAR: 'parar',
  OUTRO: 'obs',
}

// ── Recados ao cliente (T-16) ───────────────────────────────────────────────

/** Modelos fixos — sem texto livre (é de madrugada e o telefone do cliente nunca aparece). */
export const RECADO_TEMPLATES = [
  { key: 'NA_PORTARIA', text: 'Estou na portaria' },
  { key: 'COM_PORTEIRO', text: 'Deixei com o porteiro' },
  { key: 'PORTARIA_NAO_LIBEROU', text: 'A portaria não liberou, pode avisar lá?' },
  { key: 'CHEGANDO', text: 'Seu pedido chega em alguns minutos' },
] as const
export type RecadoKey = (typeof RECADO_TEMPLATES)[number]['key']

export function recadoText(key: string): string | null {
  return RECADO_TEMPLATES.find((r) => r.key === key)?.text ?? null
}

// ── Confirmação ─────────────────────────────────────────────────────────────

/** Como a entrega foi confirmada (T-17). */
export const CONFIRM_VIA = ['SCAN', 'CODE', 'LIST'] as const
export type ConfirmVia = (typeof CONFIRM_VIA)[number]

// ── Código curto do cupom (T-1) ─────────────────────────────────────────────

/** O cupom imprime os 6 últimos hex do id (`#A7K2QX` no design; no app são só 0-9 e A-F). */
export const STOP_CODE_LENGTH = 6
/** Cupom impresso antes da virada para 6 — continua aceito na busca. */
export const LEGACY_STOP_CODE_LENGTH = 4

/** Código impresso no cupom: os últimos `len` caracteres do id, em maiúsculas. */
export function stopShortCode(id: string, len: number = STOP_CODE_LENGTH): string {
  return id.slice(-len).toUpperCase()
}

/** Normaliza o que o entregador digitou: maiúsculas, sem `#`, espaços e hífens. */
export function normalizeStopCode(raw: string | null | undefined): string {
  return (raw ?? '').toUpperCase().replace(/[\s#-]+/g, '')
}

/**
 * O código digitado casa com este id? Aceita 4 (cupom antigo) ou 6 caracteres hexadecimais.
 * A busca é sempre restrita às paradas de HOJE do próprio entregador — é isso que torna o
 * sufixo curto seguro.
 */
export function matchesStopCode(code: string, id: string): boolean {
  const c = normalizeStopCode(code)
  if (c.length !== STOP_CODE_LENGTH && c.length !== LEGACY_STOP_CODE_LENGTH) return false
  if (!/^[0-9A-F]+$/.test(c)) return false
  return id.toUpperCase().endsWith(c)
}

// ── Veículo e combustível (E-4 · T-14) ──────────────────────────────────────

export const VEHICLE_TYPES = ['MOTO', 'CARRO', 'BIKE', 'A_PE'] as const
export type VehicleType = (typeof VEHICLE_TYPES)[number]
export const VEHICLE_LABELS: Record<VehicleType, string> = {
  MOTO: 'Moto',
  CARRO: 'Carro',
  BIKE: 'Bicicleta',
  A_PE: 'A pé',
}

export const FUEL_TYPES = ['GASOLINA', 'ETANOL', 'FLEX', 'GNV'] as const
export type FuelType = (typeof FUEL_TYPES)[number]
export const FUEL_LABELS: Record<FuelType, string> = {
  GASOLINA: 'Gasolina',
  ETANOL: 'Etanol',
  FLEX: 'Flex',
  GNV: 'GNV',
}

/**
 * GNV (Onda 11 · H-12/T-33/T-34): vendido em m³, consumo em km/m³, só para carro. Os campos
 * continuam se chamando `kmPorLitro`/`litros`/`kmPerLiter`; no GNV eles valem km/m³ e m³ — a tela
 * escolhe a unidade pelo combustível.
 */
export function fuelUnit(combustivel: string | null | undefined): 'l' | 'm³' {
  return combustivel === 'GNV' ? 'm³' : 'l'
}
export function consumptionUnit(combustivel: string | null | undefined): 'km/l' | 'km/m³' {
  return combustivel === 'GNV' ? 'km/m³' : 'km/l'
}
/** Combustíveis que o veículo aceita: GNV só no carro. */
export function fuelsFor(tipo: string | null | undefined): FuelType[] {
  return tipo === 'CARRO' ? [...FUEL_TYPES] : FUEL_TYPES.filter((f) => f !== 'GNV')
}

/** Preços do combustível (R$ por litro; o GNV, por m³). null = não informado. */
export interface FuelPrices {
  gasolina: number | null
  etanol: number | null
  gnv?: number | null
}

/** Bicicleta e a pé não gastam combustível: consumo e combustível ficam escondidos. */
export function vehicleUsesFuel(tipo: string | null | undefined): boolean {
  return tipo === 'MOTO' || tipo === 'CARRO'
}

/** Preço (litro; GNV, m³) para o combustível do veículo. Flex usa a gasolina (T-14, conservador). */
export function fuelPriceFor(combustivel: string | null | undefined, prices: FuelPrices): number | null {
  if (combustivel === 'ETANOL') return prices.etanol
  if (combustivel === 'GASOLINA' || combustivel === 'FLEX') return prices.gasolina
  if (combustivel === 'GNV') return prices.gnv ?? null
  return null
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Combustível estimado de um percurso. null quando falta consumo ou preço (a tela diz "sem
 * consumo cadastrado" em vez de mostrar R$ 0,00 como se fosse de graça).
 */
export function estimateFuel(
  km: number,
  kmPorLitro: number | null | undefined,
  preco: number | null | undefined,
): { litros: number; custo: number } | null {
  if (!kmPorLitro || kmPorLitro <= 0 || !preco || preco <= 0 || !(km >= 0)) return null
  const litros = km / kmPorLitro
  return { litros: round2(litros), custo: round2(litros * preco) }
}

// ── Pagamento do entregador (F-7 · T-12/T-13) ───────────────────────────────

export const PAY_MODES = ['PER_DELIVERY', 'PER_ROUTE', 'WEEKLY_FIXED'] as const
export type PayMode = (typeof PAY_MODES)[number]
export const PAY_MODE_LABELS: Record<PayMode, { label: string; unit: string }> = {
  PER_DELIVERY: { label: 'por entrega', unit: 'por entrega' },
  PER_ROUTE: { label: 'por rota', unit: 'por turno encerrado' },
  WEEKLY_FIXED: { label: 'semanal fixo', unit: 'por semana' },
}

/**
 * Remuneração da semana pela modalidade (T-13). "Por entrega" conta PARADAS entregues (pão +
 * Cestinha do mesmo cliente/turno = 1); "por rota" conta turnos encerrados; "semanal fixo" é o
 * valor. Sem modalidade → 0 (a proposta sai só com o combustível).
 */
export function payoutRemuneration(
  mode: string | null | undefined,
  valor: number | null | undefined,
  counts: { entregas: number; rotas: number },
): { units: number; amount: number } {
  const v = valor && valor > 0 ? valor : 0
  if (mode === 'PER_DELIVERY') return { units: counts.entregas, amount: round2(counts.entregas * v) }
  if (mode === 'PER_ROUTE') return { units: counts.rotas, amount: round2(counts.rotas * v) }
  if (mode === 'WEEKLY_FIXED') return { units: 1, amount: round2(v) }
  return { units: 0, amount: 0 }
}

/** Semana de pagamento (segunda a domingo) de uma data "YYYY-MM-DD" (T-12). */
export function payWeekOf(dateStr: string): { weekStart: string; weekEnd: string } {
  const [y, m, d] = dateStr.split('-').map(Number)
  const base = Date.UTC(y, m - 1, d)
  const dow = new Date(base).getUTCDay() // 0 = domingo
  const toMonday = dow === 0 ? -6 : 1 - dow
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
  const day = 24 * 60 * 60 * 1000
  return { weekStart: iso(base + toMonday * day), weekEnd: iso(base + (toMonday + 6) * day) }
}

/** Por que o combustível ficou fora da proposta (a tela explica em vez de mostrar R$ 0,00). */
export type PayoutFuelReason = 'NAO_PAGA' | 'NAO_USA' | 'SEM_KM' | 'SEM_CONSUMO' | 'SEM_PRECO'

/** Base do combustível da proposta: "412 km ÷ 38 km/l × R$ 6,09". */
export interface PayoutFuelBasis {
  kmPorLitro: number | null
  preco: number | null
  combustivel: string | null
  reason: PayoutFuelReason | null
}

/**
 * Proposta da semana (T-13/T-14): remuneração pela modalidade + combustível estimado = Σ km das
 * rotas encerradas ÷ km/l × preço do litro (flex = gasolina). Sem consumo, sem preço ou sem km, o
 * combustível é 0 com o motivo. Cadastro sem pagamento definido (`pay` nulo) = sem modalidade e
 * combustível pago (o padrão do A3).
 */
export function payoutProposal(input: {
  pay: { modalidade?: string | null; valor?: number | null; pagaCombustivel?: boolean | null } | null | undefined
  vehicle: { tipo?: string | null; combustivel?: string | null; kmPorLitro?: number | null } | null | undefined
  prices: FuelPrices
  entregas: number
  rotas: number
  km: number
}): {
  payMode: PayMode | null
  payAmount: number | null
  units: number
  remunerationEst: number
  kmEst: number
  fuelEst: number
  fuelBasis: PayoutFuelBasis
} {
  const mode = (PAY_MODES as readonly string[]).includes(input.pay?.modalidade ?? '') ? (input.pay!.modalidade as PayMode) : null
  const valor = mode ? input.pay?.valor ?? null : null
  const rem = payoutRemuneration(mode, valor, { entregas: input.entregas, rotas: input.rotas })
  const km = round2(Math.max(0, input.km))
  const v = input.vehicle ?? null
  const usa = vehicleUsesFuel(v?.tipo)
  const kmPorLitro = usa && v?.kmPorLitro && v.kmPorLitro > 0 ? v.kmPorLitro : null
  const preco = usa ? fuelPriceFor(v?.combustivel, input.prices) : null
  const est = estimateFuel(km, kmPorLitro, preco)
  const reason: PayoutFuelReason | null =
    input.pay?.pagaCombustivel === false
      ? 'NAO_PAGA'
      : !usa
        ? 'NAO_USA'
        : km <= 0
          ? 'SEM_KM'
          : !kmPorLitro
            ? 'SEM_CONSUMO'
            : !preco || !est
              ? 'SEM_PRECO'
              : null
  return {
    payMode: mode,
    payAmount: valor,
    units: rem.units,
    remunerationEst: rem.amount,
    kmEst: km,
    fuelEst: reason === null && est ? est.custo : 0,
    fuelBasis: { kmPorLitro, preco: preco ?? null, combustivel: usa ? v?.combustivel ?? null : null, reason },
  }
}

export const PAYOUT_STATUSES = ['PENDING', 'EDITED', 'APPROVED', 'DISCARDED'] as const
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number]

/** Estimado e final da proposta (o final é o editado; sem edição, o estimado). */
export function payoutTotals(p: { remunerationEst: number; fuelEst: number; remunerationFinal?: number | null; fuelFinal?: number | null }): {
  remuneration: number
  fuel: number
  estimated: number
  final: number
} {
  const remuneration = p.remunerationFinal ?? p.remunerationEst
  const fuel = p.fuelFinal ?? p.fuelEst
  return { remuneration, fuel, estimated: round2(p.remunerationEst + p.fuelEst), final: round2(remuneration + fuel) }
}

/** Competência das despesas do pagamento: o mês do último dia da semana (T-15), "YYYY-MM". */
export const payoutCompetenceMonth = (weekEnd: string) => weekEnd.slice(0, 7)

// ── Disponibilidade (F-8) ───────────────────────────────────────────────────

export type WeekdayKey = (typeof WEEKDAYS)[number]

/**
 * O entregador trabalha neste dia/turno? Sem disponibilidade cadastrada = trabalha sempre
 * (comportamento de antes da feature).
 */
export function isAvailableOn(
  availability: { dias?: string[] | null; turnos?: string[] | null } | null | undefined,
  day: WeekdayKey,
  slotId: string,
): boolean {
  if (!availability) return true
  const dias = availability.dias
  const turnos = availability.turnos
  if (Array.isArray(dias) && !dias.includes(day)) return false
  if (Array.isArray(turnos) && !turnos.includes(slotId)) return false
  return true
}

/** A data "YYYY-MM-DD" cai dentro de alguma folga [startDate, endDate]? */
export function isOnTimeOff(dateStr: string, timeOffs: Array<{ startDate: string; endDate: string }>): boolean {
  return timeOffs.some((t) => t.startDate <= dateStr && dateStr <= t.endDate)
}

/** Dia da semana ('seg' … 'dom') de uma data "YYYY-MM-DD". */
export function weekdayOf(dateStr: string): WeekdayKey {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = domingo
  return WEEKDAYS[(dow + 6) % 7]
}

/** Motivo de o entregador estar fora num dia/turno (F-8): folga cadastrada ou fora da escala. */
export type OffReason = 'FOLGA' | 'FORA_DA_ESCALA'

export function offReasonFor(
  availability: { dias?: string[] | null; turnos?: string[] | null } | null | undefined,
  timeOffs: Array<{ startDate: string; endDate: string }>,
  dateStr: string,
  slotId?: string,
): OffReason | null {
  if (isOnTimeOff(dateStr, timeOffs)) return 'FOLGA'
  if (!availability) return null
  const dias = availability.dias
  if (Array.isArray(dias) && !dias.includes(weekdayOf(dateStr))) return 'FORA_DA_ESCALA'
  if (slotId && Array.isArray(availability.turnos) && !availability.turnos.includes(slotId)) return 'FORA_DA_ESCALA'
  return null
}

// ── Crachá (H-3) ─────────────────────────────────────────────────────────────

/** "123.456.789-00" → "***.456.789-**" (o crachá mostra só o miolo). */
export function maskCpf(cpf: string | null | undefined): string | null {
  const d = (cpf ?? '').replace(/\D/g, '')
  if (d.length !== 11) return null
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`
}

/** Nº do crachá com 4 dígitos ("0427"). */
export function badgeNumberLabel(n: number | null | undefined): string | null {
  return typeof n === 'number' && n > 0 ? String(n).padStart(4, '0') : null
}

/**
 * Crachá ativo? Inativo quando o entregador está desativado ou quando passou da validade
 * (`validUntil` é o último dia válido, "YYYY-MM-DD"). Sem validade = não vence.
 */
export function badgeStatus(
  input: { isBlocked: boolean; validUntil: string | null | undefined },
  today: string,
): { active: boolean; reason: 'ATIVO' | 'DESATIVADO' | 'VENCIDO' } {
  if (input.isBlocked) return { active: false, reason: 'DESATIVADO' }
  if (input.validUntil && input.validUntil < today) return { active: false, reason: 'VENCIDO' }
  return { active: true, reason: 'ATIVO' }
}

// ── Aceitar ou recusar o turno (plano-termos-legais §5) ─────────────────────

export const SHIFT_OFFER_STATUSES = ['OFFERED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN'] as const
export type ShiftOfferStatus = (typeof SHIFT_OFFER_STATUSES)[number]

/** Motivo da recusa — OPCIONAL: recusar não exige justificativa nem tem penalidade. */
export const SHIFT_DECLINE_REASONS = [
  { key: 'IMPREVISTO', label: 'Imprevisto' },
  { key: 'VEICULO', label: 'Problema no veículo' },
  { key: 'SAUDE', label: 'Saúde' },
  { key: 'OUTRO', label: 'Outro motivo' },
] as const
export type ShiftDeclineReason = (typeof SHIFT_DECLINE_REASONS)[number]['key']

export function shiftDeclineLabel(key: string | null | undefined): string | null {
  return SHIFT_DECLINE_REASONS.find((r) => r.key === key)?.label ?? null
}

