import { useState } from 'react'
import { FUEL_LABELS, VEHICLE_LABELS, consumptionUnit, vehicleUsesFuel, type FuelType, type VehicleType } from '@cheirin-de-pao/shared'
import { Icon, type Ic } from '../../components/brand/Icon'
import { CRAvatar, CRLabel, CRNote, CR_DISPLAY } from '../../components/courier/kit'
import { CourierPage, CRCard, CRRow } from '../../components/courier/CourierPage'
import { NavAppSheet } from '../../components/courier/NavAppSheet'
import { PushNotificationToggle } from '../../components/PushNotificationToggle'
import { getPreferredNavApp, NAV_APP_LABELS, type NavApp } from '../../lib/navLinks'
import { ddmm, type CourierMe } from '../../lib/courierApi'

const VEHICLE_ICON: Record<string, keyof typeof Ic> = { MOTO: 'moto', CARRO: 'car', BIKE: 'bike', A_PE: 'walk' }

/** "(11) 99888-7766" */
function phoneLabel(p: string | null): string | null {
  const d = (p ?? '').replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return p
}
const sinceLabel = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo' }).replace('.', '').replace(' de ', '/')

/**
 * E14 · Perfil do entregador — SÓ LEITURA (F-1): foto, veículo e consumo são do cadastro feito pelo
 * admin. O entregador escolhe o app de mapas e as notificações, troca a senha e sai (com
 * confirmação).
 */
export function CourierProfile({
  me,
  fallbackName,
  onClose,
  onOpenBadge,
  onOpenEarnings,
  onOpenOps,
  onOpenTerms,
  onOpenNumbers,
  onOpenSchedule,
  onLogout,
}: {
  me: CourierMe | null
  fallbackName: string
  onClose: () => void
  onOpenBadge: () => void
  onOpenEarnings: () => void
  /** Termo do Entregador Parceiro (plano-termos-legais §6). */
  onOpenTerms?: () => void
  /** E12: Falar com a operação (WhatsApp + ocorrência). */
  onOpenOps: () => void
  onOpenNumbers: () => void
  onOpenSchedule: () => void
  onLogout: () => void
}) {
  const [navApp, setNavApp] = useState<NavApp | null>(() => getPreferredNavApp())
  const [choosing, setChoosing] = useState(false)
  const name = me?.name ?? fallbackName
  const v = me?.vehicle ?? null
  const vehicleTitle = v ? [VEHICLE_LABELS[v.tipo as VehicleType] ?? v.tipo, v.modelo].filter(Boolean).join(' · ') : 'Não cadastrado'

  return (
    <CourierPage title="Perfil" onBack={onClose}>
      <CRCard pad={18}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <CRAvatar name={name} photoUrl={me?.photoUrl} size={72} radius={24} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 21, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>{name}</div>
            {me?.phone && <div style={{ fontSize: 13.5, color: 'var(--color-text-sec)', fontWeight: 600, marginTop: 2 }}>{phoneLabel(me.phone)}</div>}
            {me && <div style={{ fontSize: 12.5, color: 'var(--color-text-ter)', fontWeight: 600, marginTop: 2 }}>Entregador desde {sinceLabel(me.since)}</div>}
          </div>
        </div>
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CRNote icon="user">Sua foto e seu primeiro nome aparecem para o cliente quando o pão sai para entrega.</CRNote>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-sec)', fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center', padding: '0 2px' }}>
            <Icon name="lock" size={13} aria-hidden="true" />
            Quer mudar algum dado? Fale com a operação.
          </div>
        </div>
      </CRCard>

      <div>
        <CRLabel>Meu trabalho</CRLabel>
        <CRCard>
          <CRRow icon="badge" tone="gold" title="Crachá digital" desc="Mostre na portaria" onClick={onOpenBadge} />
          <CRRow icon="wallet" title="Meus ganhos" desc="Semana em andamento e extrato" onClick={onOpenEarnings} />
          <CRRow icon="trend" title="Meus números" desc={me ? `${me.deliveries30} ${me.deliveries30 === 1 ? 'entrega' : 'entregas'} em 30 dias` : undefined} onClick={onOpenNumbers} />
          <CRRow
            icon="calendar"
            title="Minha escala"
            desc={me ? `${me.scheduleLabel}${me.nextTimeOff ? ` · próxima folga ${ddmm(me.nextTimeOff.startDate)}` : ''}` : undefined}
            onClick={onOpenSchedule}
            last
          />
        </CRCard>
      </div>

      <div>
        <CRLabel>Meu veículo</CRLabel>
        <CRCard>
          {!v ? (
            <CRRow icon="moto" title="Não cadastrado" desc="A operação cadastra seu veículo e o consumo" chev={false} last />
          ) : (
            <>
              <CRRow icon={VEHICLE_ICON[v.tipo] ?? 'moto'} title={vehicleTitle} desc={v.placa ? `Placa ${v.placa}` : undefined} chev={false} last={!vehicleUsesFuel(v.tipo)} />
              {vehicleUsesFuel(v.tipo) && (
                <CRRow
                  icon="fuel"
                  title={[v.combustivel ? FUEL_LABELS[v.combustivel as FuelType] : null, v.kmPorLitro ? `${String(v.kmPorLitro).replace('.', ',')} ${consumptionUnit(v.combustivel)}` : 'consumo não cadastrado'].filter(Boolean).join(' · ')}
                  desc={me?.showFuel === true ? 'Usado no combustível estimado' : undefined}
                  chev={false}
                  last
                />
              )}
            </>
          )}
        </CRCard>
      </div>

      <div>
        <CRLabel>Preferências</CRLabel>
        <CRCard>
          <CRRow
            icon="navigate"
            title="App de mapas"
            right={<span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-sec)' }}>{navApp ? NAV_APP_LABELS[navApp] : 'Perguntar'}</span>}
            onClick={() => setChoosing(true)}
            last
          />
        </CRCard>
        <div style={{ marginTop: 8 }}>
          <PushNotificationToggle description="Entregas novas e avisos da operação." />
        </div>
      </div>

      <div>
        <CRLabel>Conta e ajuda</CRLabel>
        <CRCard>
          <CRRow icon="lock" title="Trocar senha" href="/change-password" />
          <CRRow icon="chat" title="Falar com a operação" desc="WhatsApp e ocorrências" onClick={onOpenOps} />
          {onOpenTerms && (
            <CRRow
              icon="doc"
              title="Termo do entregador"
              desc={me?.terms?.acceptedVersion ? `Versão ${me.terms.acceptedVersion} aceita` : 'Leia o termo da parceria'}
              onClick={onOpenTerms}
            />
          )}
          <CRRow icon="logout" tone="danger" title="Sair" chev={false} onClick={onLogout} last />
        </CRCard>
      </div>

      {choosing && (
        <NavAppSheet
          actionLabel="Usar este app"
          onClose={() => setChoosing(false)}
          onOpen={(app) => {
            setNavApp(app)
            setChoosing(false)
          }}
        />
      )}
    </CourierPage>
  )
}
