import { useEffect, useState } from 'react'
import { FUEL_LABELS, LEGAL_DOCS, needsLegalAcceptance, PAY_MODES, VEHICLE_TYPES, WEEKDAYS, consumptionUnit, fuelsFor, vehicleUsesFuel, type PayMode, type VehicleType } from '@cheirin-de-pao/shared'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { SwitchToggle } from '../../../components/admin/SwitchToggle'
import { CourierPhotoPicker } from '../../../components/admin/CourierPhotoPicker'
import { CRNote, CRTag } from '../../../components/courier/kit'
import type { SlotOption } from '../../../lib/slots'

// ------------------------------------------------------------------ tipos
/** Cadastro completo do entregador (GET /admin/couriers). */
export interface CourierAdminView {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  cpf?: string | null
  isBlocked?: boolean
  createdAt?: string
  photoUrl?: string | null
  vehicle?: { tipo: VehicleType; modelo?: string | null; placa?: string | null; combustivel?: string | null; kmPorLitro?: number | null } | null
  rules?: { fotoEntrega: boolean; fotoNaoEntrega: boolean; podeReordenar: boolean; podeRecados: boolean }
  pay?: { modalidade: PayMode | null; valor: number | null; pagaCombustivel: boolean } | null
  availability?: { dias: string[]; turnos: string[] } | null
  badgeNumber?: number | null
  badgeValidUntil?: string | null
  offToday?: 'FOLGA' | 'FORA_DA_ESCALA' | null
  routeSuggestion?: boolean
  /** Termo do Entregador Parceiro (plano-termos-legais §6 · T-T11): última versão aceita e quando. */
  terms?: { acceptedVersion: string | null; acceptedAt: string | null }
}

/** O entregador ainda não aceitou a versão vigente do termo. */
export function termsPendingFor(e: Pick<CourierAdminView, 'terms'>): boolean {
  return needsLegalAcceptance('COURIER_TERMS', e.terms?.acceptedVersion ?? null)
}

interface EntregadorFormProps {
  /** Se presente, o formulário entra em modo edição (PATCH). Ausente = cadastro (POST). */
  entregador?: CourierAdminView
  onBack: () => void
  onSaved: () => void
  /** "Rota" (seção 6): abre a rota do entregador no turno (A4). */
  onOpenRoute?: (slotId: string) => void
}

interface TimeOff {
  id: string
  startDate: string
  endDate: string
  reason: string | null
}

const VEHICLES: Array<[VehicleType, string, string]> = [
  ['MOTO', 'Moto', 'moto'],
  ['CARRO', 'Carro', 'car'],
  ['BIKE', 'Bike', 'bike'],
  ['A_PE', 'A pé', 'walk'],
]
const PAYS: Record<PayMode, { label: string; field: string; suffix: string }> = {
  PER_DELIVERY: { label: 'Por entrega', field: 'Valor por entrega', suffix: 'por entrega' },
  PER_ROUTE: { label: 'Por rota', field: 'Valor por rota', suffix: 'por turno' },
  WEEKLY_FIXED: { label: 'Semanal fixo', field: 'Valor semanal', suffix: 'por semana' },
}
const DAY_LETTER: Record<string, string> = { seg: 'S', ter: 'T', qua: 'Q', qui: 'Q', sex: 'S', sab: 'S', dom: 'D' }
const DAY_NAME: Record<string, string> = { seg: 'Segunda', ter: 'Terça', qua: 'Quarta', qui: 'Quinta', sex: 'Sexta', sab: 'Sábado', dom: 'Domingo' }
const DEFAULT_RULES = { fotoEntrega: true, fotoNaoEntrega: true, podeReordenar: false, podeRecados: false }

const ddmm = (d: string) => d.split('-').reverse().slice(0, 2).join('/')
const ddmmyyyy = (d: string) => d.split('-').reverse().join('/')
const moneyText = (v: number | null | undefined) => (v === null || v === undefined ? '' : v.toFixed(2).replace('.', ','))
function parseMoney(t: string): number | null {
  const n = Number(t.trim().replace(/\./g, '').replace(',', '.'))
  return t.trim() === '' || !Number.isFinite(n) || n < 0 ? null : Math.round(n * 100) / 100
}
const sinceLabel = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '').replace(' de ', '/') : null)

// ------------------------------------------------------------------ máscaras + validação
function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/** Formata CPF para 000.000.000-00 conforme o usuário digita. */
function maskCPF(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

/** Formata telefone para (00) 0000-0000 ou (00) 00000-0000. */
function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length <= 2) return d.replace(/^(\d{0,2})/, '($1')
  if (d.length <= 6) return d.replace(/^(\d{2})(\d{0,4})/, '($1) $2')
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
}

/** Validação completa de CPF (11 dígitos + dígitos verificadores). */
function isValidCPF(value: string): boolean {
  const d = onlyDigits(value)
  if (d.length !== 11) return false
  if (/^(\d)\1{10}$/.test(d)) return false // rejeita sequências repetidas

  const calcDigit = (length: number): number => {
    let sum = 0
    for (let i = 0; i < length; i++) {
      sum += Number(d[i]) * (length + 1 - i)
    }
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }

  return calcDigit(9) === Number(d[9]) && calcDigit(10) === Number(d[10])
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

// ------------------------------------------------------------------ componente
/** A3 · Cadastro do entregador (ampliado): dados + crachá, veículo, regras, pagamento, escala, rota. */
export function EntregadorForm({ entregador, onBack, onSaved, onOpenRoute }: EntregadorFormProps) {
  const isEdit = !!entregador
  const [nome, setNome] = useState(entregador?.name ?? '')
  const [cpf, setCpf] = useState(entregador?.cpf ? maskCPF(entregador.cpf) : '')
  const [telefone, setTelefone] = useState(entregador?.phone ? maskPhone(entregador.phone) : '')
  const [email, setEmail] = useState(entregador?.email ?? '')
  const [photoUrl, setPhotoUrl] = useState<string | null>(entregador?.photoUrl ?? null)
  const [validade, setValidade] = useState(entregador ? entregador.badgeValidUntil ?? '' : `${new Date().getFullYear()}-12-31`)
  const [veiculo, setVeiculo] = useState<VehicleType | null>(entregador?.vehicle?.tipo ?? null)
  const [modelo, setModelo] = useState(entregador?.vehicle?.modelo ?? '')
  const [placa, setPlaca] = useState(entregador?.vehicle?.placa ?? '')
  const [combustivel, setCombustivel] = useState(entregador?.vehicle?.combustivel ?? 'GASOLINA')
  const [consumo, setConsumo] = useState(entregador?.vehicle?.kmPorLitro ? String(entregador.vehicle.kmPorLitro).replace('.', ',') : '')
  const [regras, setRegras] = useState(entregador?.rules ?? DEFAULT_RULES)
  const [modalidade, setModalidade] = useState<PayMode | null>(entregador?.pay?.modalidade ?? null)
  const [valor, setValor] = useState(moneyText(entregador?.pay?.valor))
  const [pagaCombustivel, setPagaCombustivel] = useState(entregador?.pay?.pagaCombustivel ?? true)
  const [slots, setSlots] = useState<SlotOption[]>([])
  const [dias, setDias] = useState<string[]>(entregador ? entregador.availability?.dias ?? [...WEEKDAYS] : WEEKDAYS.filter((d) => d !== 'dom'))
  const [turnos, setTurnos] = useState<string[] | null>(entregador?.availability?.turnos ?? null)
  const [folgas, setFolgas] = useState<TimeOff[]>([])
  const [novaFolga, setNovaFolga] = useState<{ de: string; ate: string; motivo: string } | null>(null)
  const [overlapMsg, setOverlapMsg] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch('/admin/settings/slots')
        if (res.ok) setSlots(((await res.json()) as { slots: SlotOption[] }).slots ?? [])
      } catch {
        // sem turnos: a escala fica só por dia
      }
    })()
    if (!entregador) return
    void (async () => {
      try {
        const res = await apiFetch(`/admin/couriers/${entregador.id}/time-offs`)
        if (res.ok) setFolgas((await res.json()) as TimeOff[])
      } catch {
        // segue sem a lista
      }
    })()
  }, [entregador])

  // Sem turnos escolhidos ainda (cadastro antigo): todos os turnos.
  const turnosOn = turnos ?? slots.map((s) => s.slotId)
  const usaCombustivel = vehicleUsesFuel(veiculo)
  // GNV só no carro (Onda 11 · T-36): na moto, o GNV marcado volta para Gasolina.
  const fuels = fuelsFor(veiculo)
  const combustivelOk = (fuels as string[]).includes(combustivel) ? combustivel : 'GASOLINA'
  const unidade = consumptionUnit(combustivelOk)

  const handleSalvar = async () => {
    setError(null)
    const km = consumo.trim() ? Number(consumo.replace(',', '.')) : null
    if (usaCombustivel && km !== null && (!Number.isFinite(km) || km < 1 || km > 100)) {
      setError(`Consumo entre 1 e 100 ${unidade}.`)
      return
    }
    const v = parseMoney(valor)
    if (modalidade && v === null) {
      setError('Informe o valor da modalidade de pagamento.')
      return
    }
    setIsSaving(true)
    try {
      // Em edição o CPF é imutável — não é enviado no PATCH.
      const body = {
        name: nome.trim(),
        ...(isEdit ? {} : { cpf: onlyDigits(cpf) }),
        ...(telefone.trim() ? { phone: onlyDigits(telefone) } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
        photoUrl,
        badgeValidUntil: validade || null,
        vehicle: veiculo
          ? { tipo: veiculo, modelo: modelo.trim() || null, placa: placa.trim() || null, ...(usaCombustivel ? { combustivel: combustivelOk, kmPorLitro: km } : {}) }
          : null,
        rules: regras,
        // Sempre o objeto: `null` fica só para o cadastro antigo (sem nada definido = paga combustível).
        pay: { modalidade, valor: modalidade ? v : null, pagaCombustivel },
        availability: { dias, turnos: turnosOn },
      }
      const res = await apiFetch(isEdit ? `/admin/couriers/${entregador.id}` : '/admin/couriers', {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      })
      if (res.ok) {
        onSaved()
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        setError(err?.error ?? (isEdit ? 'Não foi possível salvar. Tente novamente.' : 'Não foi possível cadastrar. Tente novamente.'))
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  const addFolga = async () => {
    if (!entregador || !novaFolga?.de) return
    setOverlapMsg(null)
    const ate = novaFolga.ate || novaFolga.de
    try {
      const res = await apiFetch(`/admin/couriers/${entregador.id}/time-offs`, {
        method: 'POST',
        body: JSON.stringify({ startDate: novaFolga.de, endDate: ate, ...(novaFolga.motivo.trim() ? { reason: novaFolga.motivo.trim() } : {}) }),
      })
      const body = (await res.json().catch(() => null)) as { timeOff?: TimeOff; overlaps?: Array<{ date: string; slotLabel: string; stops: number }>; error?: string } | null
      if (!res.ok || !body?.timeOff) {
        setError(body?.error ?? 'Não foi possível salvar a folga.')
        return
      }
      setFolgas((f) => [...f, body.timeOff!].sort((a, b) => a.startDate.localeCompare(b.startDate)))
      setNovaFolga(null)
      const o = body.overlaps ?? []
      if (o.length > 0) {
        setOverlapMsg(
          `A folga de ${o.map((x) => ddmm(x.date)).filter((d, i, all) => all.indexOf(d) === i).join(', ')} cai numa rota já aprovada (${o.map((x) => `${x.slotLabel} · ${x.stops} ${x.stops === 1 ? 'parada' : 'paradas'}`).join('; ')}). Refaça a divisão de entregas desse dia.`,
        )
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    }
  }

  const removeFolga = async (id: string) => {
    if (!entregador) return
    try {
      const res = await apiFetch(`/admin/couriers/${entregador.id}/time-offs/${id}`, { method: 'DELETE' })
      if (res.ok) setFolgas((f) => f.filter((x) => x.id !== id))
    } catch {
      // mantém a lista
    }
  }

  const isValid = nome.trim() !== '' && (isEdit || isValidCPF(cpf)) && (email.trim() === '' || isValidEmail(email.trim()))
  const since = sinceLabel(entregador?.createdAt)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* AppBar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px 14px' }}>
        <button
          type="button"
          aria-label="Voltar"
          onClick={onBack}
          style={{ background: 'var(--color-surface-2)', border: 'none', width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}
        >
          <Icon name="arrowL" size={18} color="var(--color-text)" />
        </button>
        <div style={{ minWidth: 0 }}>
          {isEdit && since && <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-ter)', fontWeight: 600 }}>Entregador desde {since}</div>}
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>
            {isEdit ? entregador.name : 'Novo entregador'}
          </h2>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Section n={1} title="Dados">
          <div style={cardPad}>
            <CourierPhotoPicker name={nome} value={photoUrl} onChange={setPhotoUrl} onError={setPhotoError} />
            {photoError && <CRNote icon="alert" tone="danger">{photoError}</CRNote>}
            <FormField label="Nome completo" icon="user" value={nome} onChange={setNome} placeholder="Nome e sobrenome" />
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <FormField
                  label="CPF"
                  icon="doc"
                  value={cpf}
                  onChange={(v) => setCpf(maskCPF(v))}
                  placeholder="000.000.000-00"
                  disabled={isEdit}
                  error={!isEdit && cpf.length > 0 && onlyDigits(cpf).length === 11 && !isValidCPF(cpf) ? 'CPF inválido' : undefined}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <FormField label="Telefone" icon="phone" value={telefone} onChange={(v) => setTelefone(maskPhone(v))} placeholder="(00) 00000-0000" type="tel" />
              </div>
            </div>
            <FormField
              label="E-mail"
              icon="mail"
              value={email}
              onChange={setEmail}
              placeholder="email@exemplo.com"
              type="email"
              error={email.trim() && !isValidEmail(email.trim()) ? 'E-mail inválido' : undefined}
            />
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <FormField label="Crachá válido até" icon="badge" value={validade} onChange={setValidade} type="date" />
              </div>
              {isEdit && entregador.badgeNumber ? (
                <div style={{ fontFamily: 'var(--font-body)', paddingBottom: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-ter)', fontWeight: 700 }}>Nº do crachá</div>
                  <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 800, fontSize: 16, color: 'var(--color-text)' }}>{String(entregador.badgeNumber).padStart(4, '0')}</div>
                </div>
              ) : null}
            </div>
            <div style={hint}>Vencido, o crachá aparece como inativo no app do entregador.{!isEdit ? ' O nº é gerado no cadastro.' : ''}</div>
            {isEdit && (
              <div data-testid="courier-terms" style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700 }}>
                {termsPendingFor(entregador) ? (
                  <CRTag icon="doc" tone="warn" size="sm">
                    {entregador.terms?.acceptedVersion ? `termo v${entregador.terms.acceptedVersion} — falta aceitar a v${LEGAL_DOCS.COURIER_TERMS.version}` : 'termo pendente'}
                  </CRTag>
                ) : (
                  <CRTag icon="check" tone="good" size="sm">
                    termo v{entregador.terms?.acceptedVersion} aceito em {new Date(entregador.terms!.acceptedAt!).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  </CRTag>
                )}
                <a href={LEGAL_DOCS.COURIER_TERMS.path} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', fontSize: 12.5 }}>
                  ver o termo
                </a>
              </div>
            )}
          </div>
        </Section>

        <Section n={2} title="Veículo" right={<span style={optional}>opcional</span>}>
          <div style={cardPad}>
            <Seg
              label="Veículo"
              items={VEHICLES.map(([k, l, ic]) => ({ key: k, label: l, icon: ic }))}
              value={veiculo}
              onChange={(k) => setVeiculo(veiculo === k ? null : (k as VehicleType))}
            />
            {!veiculo && <div style={hint}>Sem veículo cadastrado: a rota não calcula combustível.</div>}
            {veiculo && (
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1.4, minWidth: 0 }}>
                  <FormField label="Modelo" icon={VEHICLES.find(([k]) => k === veiculo)?.[2] ?? 'moto'} value={modelo} onChange={setModelo} placeholder={usaCombustivel ? 'Honda CG 160' : 'Caloi'} />
                </div>
                {usaCombustivel && (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <FormField label="Placa" icon="doc" value={placa} onChange={(v) => setPlaca(v.toUpperCase().slice(0, 8))} placeholder="ABC1D23" />
                  </div>
                )}
              </div>
            )}
            {usaCombustivel && (
              <>
                <div>
                  <div style={fieldLabel}>Combustível</div>
                  <Seg label="Combustível" small items={fuels.map((k) => ({ key: k, label: FUEL_LABELS[k] }))} value={combustivelOk} onChange={setCombustivel} />
                </div>
                <FormField label={`Consumo (${unidade})`} icon="fuel" value={consumo} onChange={(v) => setConsumo(v.replace(/[^\d,.]/g, ''))} placeholder={combustivelOk === 'GNV' ? '12' : '38'} />
                <div style={hint}>Usado para estimar o combustível da rota. Sem consumo, não há cálculo.</div>
              </>
            )}
            {veiculo && !usaCombustivel && <div style={hint}>{veiculo === 'BIKE' ? 'Bicicleta' : 'A pé'} não usa combustível — consumo e combustível ficam escondidos.</div>}
          </div>
        </Section>

        <Section n={3} title="Permissões e regras">
          <div style={cardFlat}>
            {(
              [
                ['fotoEntrega', 'Exigir foto na entrega', 'Sem “Pular”. Exceção vira “sem foto”.'],
                ['fotoNaoEntrega', 'Exigir foto na não entrega', null],
                ['podeReordenar', 'Pode reordenar a rota', 'Vale só no dia. Você vê a mudança.'],
                ['podeRecados', 'Pode enviar recados ao cliente', 'Modelos prontos, por notificação.'],
              ] as const
            ).map(([k, t, d], i) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: i ? '1px solid var(--color-border-2)' : 'none' }}>
                <div style={{ flex: 1 }}>
                  <div style={rowTitle}>{t}</div>
                  {d && <div style={hint}>{d}</div>}
                </div>
                <SwitchToggle on={regras[k]} onChange={() => setRegras({ ...regras, [k]: !regras[k] })} aria-label={t} />
              </div>
            ))}
          </div>
        </Section>

        <Section n={4} title="Pagamento">
          <div style={cardPad}>
            {!modalidade && (
              <CRNote icon="alert" tone="gold">
                Modalidade não definida. A proposta semanal sai só com o combustível.
              </CRNote>
            )}
            <Seg label="Modalidade" items={PAY_MODES.map((k) => ({ key: k, label: PAYS[k].label }))} value={modalidade} onChange={(k) => setModalidade(modalidade === k ? null : (k as PayMode))} />
            {modalidade && (
              <label style={{ display: 'block' }}>
                <div style={fieldLabel}>{PAYS[modalidade].field}</div>
                <div style={inputBox}>
                  <Icon name="coin" size={18} color="var(--color-text-ter)" aria-hidden="true" />
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--color-text-sec)' }}>R$</span>
                  <input aria-label={PAYS[modalidade].field} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value.replace(/[^\d,.]/g, ''))} placeholder="0,00" style={bareInput} />
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-ter)', fontWeight: 700 }}>{PAYS[modalidade].suffix}</span>
                </div>
              </label>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={rowTitle}>Pagar combustível estimado</div>
                <div style={hint}>Entra na proposta; você define o valor final.</div>
              </div>
              <SwitchToggle on={pagaCombustivel} onChange={() => setPagaCombustivel(!pagaCombustivel)} aria-label="Pagar combustível estimado" />
            </div>
          </div>
        </Section>

        <Section n={5} title="Disponibilidade">
          <div style={cardPad}>
            <div role="group" aria-label="Dias da semana" style={{ display: 'flex', gap: 5 }}>
              {WEEKDAYS.map((d) => {
                const on = dias.includes(d)
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    aria-label={DAY_NAME[d]}
                    onClick={() => setDias(on ? dias.filter((x) => x !== d) : WEEKDAYS.filter((x) => x === d || dias.includes(x)))}
                    style={{ flex: 1, height: 40, borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 14, fontFamily: 'var(--font-body)', background: on ? 'var(--color-text)' : 'var(--color-surface-2)', color: on ? 'var(--color-app-bg)' : 'var(--color-text-sec)', cursor: 'pointer' }}
                  >
                    {DAY_LETTER[d]}
                  </button>
                )
              })}
            </div>
            {slots.length > 0 && (
              <div role="group" aria-label="Turnos" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {slots.map((s) => {
                  const on = turnosOn.includes(s.slotId)
                  return (
                    <button
                      key={s.slotId}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setTurnos(on ? turnosOn.filter((x) => x !== s.slotId) : [...turnosOn, s.slotId])}
                      style={{ height: 36, padding: '0 12px', borderRadius: 99, border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, background: on ? 'var(--color-gold-soft)' : 'var(--color-surface-2)', color: 'var(--color-amber-ink)', fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
                    >
                      {on && <Icon name="check" size={13} stroke={2.8} aria-hidden="true" />}
                      {s.emoji ? `${s.emoji} ` : ''}
                      {s.label}
                    </button>
                  )
                })}
              </div>
            )}
            <div style={fieldLabel}>Folgas</div>
            {overlapMsg && (
              <CRNote icon="alert" tone="danger">
                {overlapMsg}
              </CRNote>
            )}
            {!isEdit && <div style={hint}>Salve o cadastro para marcar folgas.</div>}
            {folgas.map((f) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 12, background: 'var(--color-surface-alt, #FBF6EC)', border: '1px solid var(--color-border-2)', fontFamily: 'var(--font-body)' }}>
                <Icon name="dayoff" size={17} color="var(--color-good)" aria-hidden="true" />
                <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                  {f.startDate === f.endDate ? ddmm(f.startDate) : `${ddmm(f.startDate)} a ${ddmm(f.endDate)}`}
                  {f.reason && <span style={{ color: 'var(--color-text-sec)', fontWeight: 600 }}> · {f.reason}</span>}
                </span>
                <button type="button" aria-label={`Remover folga de ${ddmmyyyy(f.startDate)}`} onClick={() => void removeFolga(f.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4 }}>
                  <Icon name="trash" size={16} color="var(--color-text-ter)" aria-hidden="true" />
                </button>
              </div>
            ))}
            {isEdit && novaFolga && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 14, border: '1.5px dashed var(--color-border)' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <FormField label="De" icon="calendar" type="date" value={novaFolga.de} onChange={(v) => setNovaFolga({ ...novaFolga, de: v })} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <FormField label="Até" icon="calendar" type="date" value={novaFolga.ate} onChange={(v) => setNovaFolga({ ...novaFolga, ate: v })} />
                  </div>
                </div>
                <FormField label="Motivo (opcional)" icon="edit" value={novaFolga.motivo} onChange={(v) => setNovaFolga({ ...novaFolga, motivo: v.slice(0, 80) })} placeholder="Folga, consulta, feriado…" />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setNovaFolga(null)} style={{ ...ghostBtn, flex: 1 }}>
                    Cancelar
                  </button>
                  <button type="button" disabled={!novaFolga.de} onClick={() => void addFolga()} style={{ ...ghostBtn, flex: 1, background: 'var(--color-espresso)', color: '#fff', border: 'none' }}>
                    Salvar folga
                  </button>
                </div>
              </div>
            )}
            {isEdit && !novaFolga && (
              <button type="button" onClick={() => setNovaFolga({ de: '', ate: '', motivo: '' })} style={ghostBtn}>
                <Icon name="plus" size={15} aria-hidden="true" />
                Adicionar folga
              </button>
            )}
          </div>
        </Section>

        {isEdit && slots.length > 0 && (
          <Section n={6} title="Rota" right={entregador.routeSuggestion ? <CRTag icon="spark" tone="gold" size="sm">sugestão nova</CRTag> : null}>
            <div style={cardFlat}>
              {slots.map((s, i) => (
                <button
                  key={s.slotId}
                  type="button"
                  onClick={() => onOpenRoute?.(s.slotId)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '0 16px', minHeight: 56, border: 'none', borderTop: i ? '1px solid var(--color-border-2)' : 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)' }}
                >
                  <span style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--color-surface-2)', color: 'var(--color-accent)', display: 'grid', placeItems: 'center' }}>
                    <Icon name="route" size={19} aria-hidden="true" />
                  </span>
                  <span style={{ flex: 1, fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>
                    {s.emoji ? `${s.emoji} ` : ''}
                    {s.label} · rota
                  </span>
                  <Icon name="chevR" size={17} color="var(--color-text-ter)" aria-hidden="true" />
                </button>
              ))}
            </div>
          </Section>
        )}

        {error && (
          <CRNote icon="alert" tone="danger">
            {error}
          </CRNote>
        )}
      </div>

      <div style={{ position: 'sticky', bottom: 0, padding: '12px 16px calc(20px + env(safe-area-inset-bottom, 0px))', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border-2)' }}>
        <button
          type="button"
          onClick={() => void handleSalvar()}
          disabled={!isValid || isSaving}
          style={{ width: '100%', minHeight: 52, borderRadius: 999, border: 'none', background: 'var(--color-espresso)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 15.5, opacity: !isValid || isSaving ? 0.5 : 1, cursor: !isValid || isSaving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Icon name="check" size={18} color="#fff" stroke={2.4} aria-hidden="true" />
          {isSaving ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Cadastrar entregador'}
        </button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ peças
const cardPad: React.CSSProperties = { background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }
const cardFlat: React.CSSProperties = { background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 16, overflow: 'hidden' }
const hint: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-sec)', lineHeight: 1.4, marginTop: 2 }
const optional: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', fontWeight: 600 }
const rowTitle: React.CSSProperties = { fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14.5, color: 'var(--color-text)' }
const fieldLabel: React.CSSProperties = { fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-sec)', marginBottom: 7 }
const inputBox: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--color-surface-alt, #FBF6EC)', border: '1.5px solid var(--color-border)', borderRadius: 14, padding: '12px 14px' }
const bareInput: React.CSSProperties = { flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, color: 'var(--color-text)', minWidth: 0 }
const ghostBtn: React.CSSProperties = { minHeight: 40, padding: '0 14px', borderRadius: 999, border: '1.5px solid var(--color-border)', background: 'var(--color-surface)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 13.5, color: 'var(--color-text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }

function Section({ n, title, right, children }: { n: number; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 4px 8px' }}>
        <span style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--color-espresso)', color: 'var(--color-gold)', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12, display: 'grid', placeItems: 'center' }}>{n}</span>
        <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--color-text-ter)', textTransform: 'uppercase' }}>{title}</span>
        {right}
      </div>
      {children}
    </div>
  )
}

/** Segmentado; tocar no escolhido de novo limpa (veículo e modalidade são opcionais). */
function Seg({ label, items, value, onChange, small }: { label: string; items: Array<{ key: string; label: string; icon?: string }>; value: string | null; onChange: (k: string) => void; small?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex', gap: 4, background: 'var(--color-surface-2)', borderRadius: 13, padding: 4 }}>
      {items.map((it) => {
        const on = value === it.key
        return (
          <button
            key={it.key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(it.key)}
            style={{ flex: 1, height: small ? 34 : 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, border: 'none', fontWeight: 800, fontSize: 13, fontFamily: 'var(--font-body)', background: on ? 'var(--color-surface)' : 'transparent', color: on ? 'var(--color-text)' : 'var(--color-text-sec)', boxShadow: on ? 'var(--shadow-soft)' : 'none', cursor: 'pointer' }}
          >
            {it.icon && <Icon name={it.icon as Parameters<typeof Icon>[0]['name']} size={16} stroke={2.2} aria-hidden="true" />}
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

// ------------------------------------------------------------------ FormField
interface FormFieldProps {
  label: string
  icon: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  error?: string
  disabled?: boolean
}

function FormField({ label, icon, value, onChange, placeholder, type = 'text', error, disabled }: FormFieldProps) {
  const [focused, setFocused] = useState(false)

  return (
    <label style={{ display: 'block' }}>
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12.5,
          fontWeight: 700,
          color: 'var(--color-text-sec)',
          letterSpacing: '0.01em',
          marginBottom: 7,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--color-surface-alt, #FBF6EC)',
          border: `1.5px solid ${error || focused ? 'var(--color-accent)' : 'var(--color-border)'}`,
          borderRadius: 14,
          padding: '12px 14px',
          transition: 'border-color 0.15s ease',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={18} color="var(--color-text-ter)" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 500,
            color: 'var(--color-text)',
            minWidth: 0,
            cursor: disabled ? 'not-allowed' : 'text',
          }}
        />
      </div>
      {error && (
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11.5,
            fontWeight: 600,
            color: 'var(--color-accent)',
            marginTop: 5,
          }}
        >
          {error}
        </div>
      )}
    </label>
  )
}
