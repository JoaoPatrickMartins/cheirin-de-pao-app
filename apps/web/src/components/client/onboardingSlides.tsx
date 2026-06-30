// Conteúdo e visuais dos slides de primeiro acesso (Fase A).
//
// Os visuais (`StepVisual`) são SLOTS: compostos agora com CSS + Icon + BreadMark,
// mas estruturados para serem trocados por ilustração/Lottie/<img> finais sem
// mudar o layout externo (borderRadius 28, altura clamp(150px, 30vh, 248px)).

import type { ReactNode } from 'react'
import { Icon } from '../brand/Icon'
import { BreadMark } from '../brand/BreadMark'

export type SlideKind = 'compra' | 'gancho' | 'pao'

export interface Slide {
  kind: SlideKind
  title: string
  body: string
}

export const SLIDES: Slide[] = [
  {
    kind: 'compra',
    title: 'Peça do seu jeito',
    body: 'Compre seus pães e escolha: um pedido único ou uma agenda semanal que se repete sozinha.',
  },
  {
    kind: 'gancho',
    title: 'Seu gancho do Cheirin',
    body: 'Você recebe um gancho para a porta (de acrílico transparente, super discreto). Toda manhã o entregador pendura a sacola de pães fresquinhos nele.',
  },
  {
    kind: 'pao',
    title: 'Pão fresquinho na porta',
    body: 'É só abrir a porta de manhã e pegar seu pão fresquinho. Todo dia, sem precisar fazer nada.',
  },
]

const tileBase: React.CSSProperties = {
  borderRadius: 28,
  height: 'clamp(150px, 30vh, 248px)',
  width: '100%',
  background: 'linear-gradient(180deg, var(--color-gold-soft), var(--color-surface-alt))',
  border: '1px solid var(--color-border-2)',
  display: 'grid',
  placeItems: 'center',
  position: 'relative',
  overflow: 'hidden',
}

/** Cartãozinho usado no visual de "compra" (Avulso / Agenda).
 *  `dark` = cartão destacado (espresso + dourado), como o "Agenda" no protótipo. */
function MiniCard({ icon, label, sub, dark = false }: { icon: 'bag' | 'calendar'; label: string; sub: string; dark?: boolean }) {
  return (
    <div
      style={{
        background: dark ? 'var(--color-espresso)' : 'var(--color-surface)',
        borderRadius: 20,
        boxShadow: 'var(--shadow-soft)',
        padding: '16px 14px',
        width: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 13,
          background: dark ? 'rgba(227,172,63,0.16)' : 'var(--color-surface-2)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Icon name={icon} size={22} color={dark ? 'var(--color-gold)' : 'var(--color-accent)'} stroke={2} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13.5, color: dark ? 'var(--color-gold)' : 'var(--color-text)' }}>{label}</div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 10.5, color: dark ? '#9A876B' : 'var(--color-text-ter)', marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  )
}

/** Cena porta sólida + gancho em "J" (espresso) no topo. `withBag` pendura a sacola (slide "pao"). */
function DoorScene({ withBag }: { withBag: boolean }) {
  return (
    <div style={{ position: 'relative', height: '80%', aspectRatio: '0.8', display: 'grid', placeItems: 'center' }}>
      {/* Porta sólida (ocre, leve gradiente para profundidade) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, #C0832F, #8E541A)',
          borderRadius: 14,
          // sombra de profundidade + brilho de moldura no topo
          boxShadow: 'var(--shadow-strong), inset 0 1px 0 rgba(255,255,255,0.18)',
        }}
      >
        {/* Painel recuado (recessed) — moldura da porta */}
        <div
          style={{
            position: 'absolute',
            inset: '16px 16px 34px',
            borderRadius: 9,
            background: 'rgba(0,0,0,0.05)',
            border: '1px solid rgba(0,0,0,0.10)',
            // recuo: sombra interna no topo + leve brilho embaixo
            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.26), inset 0 -1px 0 rgba(255,255,255,0.10)',
          }}
        />
        {/* Maçaneta */}
        <div
          style={{
            position: 'absolute',
            right: 14,
            top: '60%',
            width: 10,
            height: 10,
            borderRadius: 99,
            background: 'var(--color-gold)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
          }}
        />
      </div>

      {/* Gancho em "J" (espresso) pendurado no topo da porta */}
      <svg
        viewBox="0 0 60 104"
        width={38}
        height={66}
        fill="none"
        stroke="var(--color-espresso)"
        strokeWidth={8.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', zIndex: 2 }}
      >
        <path d="M42 6 V66 a18 18 0 0 1 -34 6" />
      </svg>

      {/* Sacola de pães (branca, com alça) pendurada e centralizada no gancho (slide "pao") */}
      {withBag && (
        <div
          style={{
            position: 'absolute',
            top: 34,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Alça da sacola (arco mais longo que envolve o gancho) */}
          <svg width={42} height={46} viewBox="0 0 60 66" fill="none" aria-hidden="true" style={{ marginBottom: -10 }}>
            <path d="M15 64 C15 6 45 6 45 64" stroke="var(--color-espresso)" strokeWidth={4} strokeLinecap="round" />
          </svg>
          {/* Corpo da sacola (branca) */}
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: '10px 10px 14px 14px',
              padding: '13px 17px 15px',
              boxShadow: 'var(--shadow-strong)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <BreadMark size={42} color="var(--color-gold)" />
          </div>
        </div>
      )}
    </div>
  )
}

export function StepVisual({ kind }: { kind: SlideKind }): ReactNode {
  return (
    <div style={tileBase} aria-hidden="true">
      {/* Marcas d'água suaves ao fundo (topo-esquerdo + base-direita) */}
      <div style={{ position: 'absolute', top: -28, left: -26, opacity: 0.06, pointerEvents: 'none' }}>
        <BreadMark size={120} color="var(--color-accent)" />
      </div>
      <div style={{ position: 'absolute', bottom: -36, right: -24, opacity: 0.08, pointerEvents: 'none' }}>
        <BreadMark size={170} color="var(--color-accent)" />
      </div>

      {kind === 'compra' && (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
          <MiniCard icon="bag" label="Avulso" sub="Pedido único" />
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 99,
              background: 'var(--color-espresso)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            <Icon name="plus" size={16} color="#FAF5EC" stroke={2.6} />
          </div>
          <MiniCard icon="calendar" label="Agenda" sub="Semanal" dark />
        </div>
      )}

      {kind === 'gancho' && <DoorScene withBag={false} />}
      {kind === 'pao' && <DoorScene withBag />}
    </div>
  )
}
