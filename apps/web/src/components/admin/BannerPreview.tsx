/**
 * BannerPreview — "como o cliente vê", dentro de uma moldura de celular.
 *
 * Renderiza os COMPONENTES REAIS do cliente (BannerPopup, AvisoStrip, MarketBanner) com os dados
 * do formulário. Uma maquete pintada à mão divergiria do app no primeiro ajuste de estilo, e o
 * preview passaria a mentir — que é pior do que não existir.
 *
 * É só desenho: os gestos são no-op e nada é registrado como impressão.
 */
import { useEffect, useState } from 'react'
import { BannerPopup } from '../client/BannerPopup'
import { AvisoStrip } from '../client/AvisoStrip'
import { MarketBanner } from '../client/MarketBanner'
import type { ClientBanner } from '../../lib/banners'
import type { BannerPlacement } from '@cheirin-de-pao/shared'

const noop = () => {}

export function BannerPreview({
  placement,
  banner,
}: {
  placement: BannerPlacement
  banner: ClientBanner
}) {
  // No app, arte que não carrega faz a peça sumir em silêncio — o certo lá. Aqui sumir em
  // silêncio deixaria o admin com uma caixa vazia sem nenhuma pista, que foi exatamente o que
  // aconteceu quando o bucket não servia a pasta `banners/`.
  const [arteQuebrada, setArteQuebrada] = useState(false)
  useEffect(() => setArteQuebrada(false), [banner.imageUrl])

  const vazio =
    placement === 'STRIP' ? !banner.title?.trim() : !banner.imageUrl

  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12.5,
          fontWeight: 700,
          color: 'var(--color-text-sec)',
          marginBottom: 7,
        }}
      >
        Como o cliente vê
      </div>

      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 18,
          border: '1.5px solid var(--color-border)',
          background: 'var(--color-app-bg)',
          padding: 14,
          // Alto o bastante para o pop-up inteiro caber: arte 4:5 de 260px (325) + o X e as
          // margens. Menos que isso e a moldura cortaria justamente o botão de fechar.
          minHeight: placement === 'POPUP' ? 440 : 0,
        }}
      >
        {vazio ? (
          <Aviso>
            {placement === 'STRIP' ? 'Escreva o título para ver a faixa.' : 'Envie a arte para ver a peça.'}
          </Aviso>
        ) : arteQuebrada ? (
          <Aviso tom="alerta">
            A arte <strong>não carregou</strong>. O arquivo subiu, mas o endereço dele não está
            acessível publicamente — o cliente veria a peça sumir. Confira a liberação da pasta{' '}
            <code>banners/</code> no bucket de imagens.
          </Aviso>
        ) : placement === 'POPUP' ? (
          <BannerPopup banner={banner} onClick={noop} onClose={noop} onImageError={() => setArteQuebrada(true)} inline />
        ) : placement === 'STRIP' ? (
          <AvisoStrip banner={banner} onClick={noop} onDismiss={noop} />
        ) : (
          <MarketBanner banner={banner} onClick={noop} onImageError={() => setArteQuebrada(true)} />
        )}
      </div>
    </div>
  )
}

function Aviso({ children, tom = 'neutro' }: { children: React.ReactNode; tom?: 'neutro' | 'alerta' }) {
  return (
    <p
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 12.5,
        lineHeight: 1.5,
        color: tom === 'alerta' ? 'var(--color-accent)' : 'var(--color-text-ter)',
        textAlign: 'center',
        margin: 0,
        padding: '28px 10px',
      }}
    >
      {children}
    </p>
  )
}
