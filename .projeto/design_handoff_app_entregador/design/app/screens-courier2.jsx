/* ============================================================
   App do Entregador — Câmera contínua
   E2 Scanner · E3 Digitar código · E4 Resultado do scan · E5 Foto · E6 Confirmar / Não entrega
   Fluxo: Escanear → Confirmado (~3 s) → [Gancho?] → Foto → Escanear próximo
   ============================================================ */
const CR_P = { maria: CR_ENTREGAS[0].paradas[0], pedro: CR_ENTREGAS[0].paradas[1], ana: CR_ENTREGAS[0].paradas[2], carlos: CR_ENTREGAS[0].paradas[3] };
const CR_C0 = CR_ENTREGAS[0];

/* Fundo de "vídeo" da câmera (corredor com pouca luz) */
function CRFeed({ bright, frozen, children }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#070402' }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 55% at 50% 48%, ${bright ? '#9C7A50' : '#33251A'} 0%, ${bright ? '#3E2C1A' : '#140C06'} 62%, #050302 100%)` }} />
      <div style={{ position: 'absolute', left: '26%', right: '26%', top: '14%', bottom: '8%', borderRadius: 6, background: bright ? 'rgba(160,125,85,0.35)' : 'rgba(90,66,40,0.35)', filter: 'blur(14px)' }} />
      <div style={{ position: 'absolute', left: '66%', top: '52%', width: 14, height: 14, borderRadius: 99, background: bright ? '#B48A55' : '#5A4228', filter: 'blur(3px)' }} />
      {frozen && <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.08)' }} />}
      {children}
    </div>
  );
}
function CRCoupon({ rot = -4, scale = 1 }) {
  return (
    <div style={{ width: 150 * scale, padding: 10 * scale, background: '#F7F2EA', borderRadius: 6, transform: `rotate(${rot}deg)`, boxShadow: '0 8px 20px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 * scale, filter: 'brightness(0.92)' }}>
      <img src="assets/qr-code.svg" alt="" style={{ width: 110 * scale, height: 110 * scale, display: 'block' }} />
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 * scale, fontWeight: 700, color: '#1E1207', letterSpacing: '0.08em' }}>#A7K2QX</span>
    </div>
  );
}
function CRFrame({ size = 240, color = '#fff', children }) {
  const c = (pos) => {
    const s = { position: 'absolute', width: 38, height: 38, borderColor: color, borderStyle: 'solid', borderWidth: 0 };
    if (pos.includes('t')) { s.top = 0; s.borderTopWidth = 5; } else { s.bottom = 0; s.borderBottomWidth = 5; }
    if (pos.includes('l')) { s.left = 0; s.borderLeftWidth = 5; } else { s.right = 0; s.borderRightWidth = 5; }
    s.borderRadius = { tl: '18px 0 0 0', tr: '0 18px 0 0', bl: '0 0 0 18px', br: '0 0 18px 0' }[pos];
    return <span key={pos} style={s} />;
  };
  return <div style={{ position: 'relative', width: size, height: size, display: 'grid', placeItems: 'center' }}>{['tl', 'tr', 'bl', 'br'].map(c)}{children}</div>;
}
function CRCamTop({ title = 'Escanear cupom', count = '7/12', onClose, sub }) {
  return (
    <div style={{ position: 'absolute', top: 44, left: 0, right: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px' }}>
      <CRIconBtn icon="x" tone="dark" onClick={onClose} label="Fechar" />
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 18, color: '#fff', letterSpacing: '-0.02em' }}>{title}</div>
        {sub && <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{sub}</div>}
      </div>
      {count ? <span style={{ minWidth: 44, height: 44, padding: '0 10px', borderRadius: 14, background: 'rgba(255,255,255,0.14)', color: '#fff', display: 'grid', placeItems: 'center', fontFamily: CR_H, fontWeight: 800, fontSize: 15 }}>{count}</span> : <span style={{ width: 44 }} />}
    </div>
  );
}
function CRCamBottom({ torch = true, torchOn, onCode }) {
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 5, padding: '0 20px 30px', display: 'flex', alignItems: 'center', gap: 12 }}>
      {torch && <button aria-label="Lanterna" style={{ width: 62, height: 62, borderRadius: 99, border: 'none', background: torchOn ? '#E3AC3F' : 'rgba(255,255,255,0.16)', color: torchOn ? '#1E1207' : '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}><Icon name="flash" size={26} stroke={2.1} /></button>}
      <CRBig variant="light" icon="keyboard" h={62} onClick={onCode} style={{ flex: 1 }}>Digitar código</CRBig>
    </div>
  );
}
/* Wrapper escuro da câmera (tela cheia) */
function CRCam({ children }) {
  return <div style={{ position: 'absolute', inset: 0, background: '#070402', color: '#fff', overflow: 'hidden' }}>{children}</div>;
}

/* ===== E2 — Scanner
   st: perm · denied · reading · torch · read · unavailable */
function ScanScreen({ st = 'reading', overlay, onClose, onCode }) {
  const t = useT();
  if (st === 'perm' || st === 'denied' || st === 'unavailable') {
    const d = {
      perm: { ic: 'camera', h: 'Permitir a câmera', b: 'O app usa a câmera para ler o QR do cupom e tirar a foto da entrega. Nada é gravado além dessa foto.', cta: 'Permitir câmera', sec: 'Agora não, digitar código' },
      denied: { ic: 'lock', h: 'A câmera está bloqueada', b: 'Para escanear, libere a câmera para o app:', steps: ['Abra os Ajustes do celular', 'Toque em Cheirin de Pão (ou no navegador)', 'Ligue a Câmera e volte aqui'], cta: 'Abrir ajustes', sec: 'Digitar código' },
      unavailable: { ic: 'alert', h: 'Câmera indisponível', b: 'Não conseguimos abrir a câmera agora. Digite o código que fica embaixo do QR do cupom.', cta: 'Digitar código', sec: 'Tentar de novo' },
    }[st];
    return (
      <CRCam>
        <CRCamTop onClose={onClose} />
        <div style={{ position: 'absolute', inset: '110px 22px 30px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: 24, background: 'rgba(227,172,63,0.16)', color: '#E3AC3F', display: 'grid', placeItems: 'center' }}><Icon name={d.ic} size={34} stroke={2} /></div>
            <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 28, letterSpacing: '-0.02em', marginTop: 20, lineHeight: 1.1 }}>{d.h}</div>
            <div style={{ fontSize: 15.5, color: '#C7B595', marginTop: 10, lineHeight: 1.5 }}>{d.b}</div>
            {d.steps && <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>{d.steps.map((s, i) => <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 15, fontWeight: 600 }}><span style={{ width: 30, height: 30, borderRadius: 99, background: '#E3AC3F', color: '#1E1207', display: 'grid', placeItems: 'center', fontFamily: CR_H, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>{s}</div>)}</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <CRBig variant="gold" icon={st === 'unavailable' ? 'keyboard' : st === 'denied' ? 'settings' : 'camera'}>{d.cta}</CRBig>
            <CRBig variant="light" icon={st === 'unavailable' ? 'refresh' : st === 'denied' ? 'keyboard' : null}>{d.sec}</CRBig>
          </div>
        </div>
      </CRCam>
    );
  }
  const read = st === 'read';
  return (
    <CRCam>
      <CRFeed bright={st === 'torch'} frozen={read}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, paddingBottom: 40 }}>
          <CRFrame color={read ? '#7FC893' : '#fff'}>
            <CRCoupon rot={read ? -2 : -7} scale={read ? 1.05 : 0.95} />
            {!read && <div style={{ position: 'absolute', left: 14, right: 14, height: 3, borderRadius: 3, background: '#E3AC3F', boxShadow: '0 0 12px #E3AC3F', animation: 'crScanLine 1.8s ease-in-out infinite alternate' }} />}
            {read && <div style={{ position: 'absolute', inset: 0, borderRadius: 18, background: 'rgba(62,124,83,0.28)', display: 'grid', placeItems: 'center' }}><span style={{ width: 72, height: 72, borderRadius: 99, background: t.good, display: 'grid', placeItems: 'center', boxShadow: '0 0 0 10px rgba(62,124,83,0.35)' }}><Icon name="check" size={40} color="#fff" stroke={3.2} /></span></div>}
          </CRFrame>
          <div style={{ padding: '9px 16px', borderRadius: 99, background: 'rgba(0,0,0,0.5)', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>{read ? <><Icon name="check" size={17} color="#7FC893" stroke={2.8} />Lido · bip!</> : 'Aponte para o QR do cupom'}</div>
        </div>
      </CRFeed>
      <CRCamTop onClose={onClose} />
      {st === 'torch' && <div style={{ position: 'absolute', top: 104, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 5 }}><span style={{ padding: '8px 14px', borderRadius: 99, background: '#E3AC3F', color: '#1E1207', fontWeight: 800, fontSize: 13.5, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="flash" size={15} stroke={2.4} />Lanterna ligada</span></div>}
      {!read && <CRCamBottom torchOn={st === 'torch'} onCode={onCode} />}
      {overlay}
    </CRCam>
  );
}

/* Teclado alfanumérico simulado */
function CRKeyboard() {
  const rows = ['1234567890', 'QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  return (
    <div style={{ background: '#D6D0C6', padding: '8px 4px 18px', display: 'flex', flexDirection: 'column', gap: 9, margin: '0 -20px -26px' }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 5, justifyContent: 'center', padding: i === 2 ? '0 16px' : 0 }}>
          {i === 3 && <span style={{ width: 44, height: 42, borderRadius: 6, background: '#B3ACA0' }} />}
          {r.split('').map(k => <span key={k} style={{ flex: 1, maxWidth: 36, height: 42, borderRadius: 6, background: '#fff', display: 'grid', placeItems: 'center', fontSize: 18, color: '#1E1207', boxShadow: '0 1px 0 rgba(0,0,0,0.25)' }}>{k}</span>)}
          {i === 3 && <span style={{ width: 44, height: 42, borderRadius: 6, background: '#B3ACA0', display: 'grid', placeItems: 'center' }}><Icon name="arrowL" size={18} color="#1E1207" /></span>}
        </div>
      ))}
    </div>
  );
}

/* ===== E3 — Digitar código (sheet)
   st: empty · typing · validating · notfound · already · ok */
function CRCodeSheet({ st = 'empty', onClose }) {
  const t = useT();
  const val = { empty: '', typing: 'A7K', validating: 'A7K2QX', notfound: 'A7K2QZ', already: 'B3M9TD', ok: 'A7K2QX' }[st];
  const err = st === 'notfound' || st === 'already';
  const bc = err ? (st === 'already' ? t.accent : t.danger) : st === 'ok' ? t.good : t.text;
  return (
    <CRSheet title="Digitar código" sub="O código fica embaixo do QR do cupom." onClose={onClose}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 32, color: t.textTer }}>#</span>
        {Array.from({ length: 6 }).map((_, i) => {
          const ch = val[i];
          const cur = !err && st !== 'ok' && i === val.length;
          return <div key={i} style={{ width: 44, height: 58, borderRadius: 14, border: `2.5px solid ${ch ? bc : cur ? t.accent : t.border}`, background: t.surfaceAlt, display: 'grid', placeItems: 'center', fontFamily: CR_H, fontWeight: 800, fontSize: 28, color: t.text, position: 'relative' }}>{ch || (cur && <span style={{ width: 2.5, height: 28, background: t.accent, animation: 'crBlink 1s steps(1) infinite' }} />)}{!ch && !cur && st === 'empty' && <span style={{ color: t.border }}>{'A7K2QX'[i]}</span>}</div>;
        })}
      </div>
      <div style={{ minHeight: 64, paddingTop: 12 }}>
        {st === 'notfound' && <CRNote ic="alert" tone="danger">Não achamos esse código na sua rota. Confira as letras no cupom.</CRNote>}
        {st === 'already' && <CRNote ic="clock" tone="gold"><b>Essa entrega já foi confirmada às 06:42.</b><br />Apto 204 · Bloco 1 · Pedro Alves</CRNote>}
        {st === 'ok' && <CRNote ic="check" tone="good">Código encontrado · Apto 12 · Bloco 2</CRNote>}
      </div>
      <CRBig variant={st === 'ok' ? 'good' : 'primary'} icon={st === 'validating' ? null : 'check'} disabled={val.length < 6 || err} right={st === 'validating' ? <CRSpin color={t.gold} /> : null}>{st === 'validating' ? 'Conferindo…' : st === 'ok' ? 'Confirmada' : 'Confirmar entrega'}</CRBig>
      <div style={{ height: 14 }} />
      <CRKeyboard />
    </CRSheet>
  );
}

/* ===== E4 — Pop-up de resultado
   kind: ok · first · gancho · offline · already · other · notfound
   dark: sobre a câmera (true) ou sobre a lista (false) */
function CRResult({ kind = 'ok', p, c = CR_C0, dark = true, onNext, onClose }) {
  const t = useT();
  const stop = p || (kind === 'first' ? CR_P.pedro : kind === 'gancho' ? CR_P.ana : CR_P.maria);
  const bad = ['already', 'other', 'notfound'].includes(kind);
  const warn = kind === 'offline' || kind === 'already';
  const head = {
    ok: [t.good, 'check', 'Entrega confirmada'], first: [t.good, 'check', 'Entrega confirmada'], gancho: [t.good, 'check', 'Entrega confirmada'],
    offline: ['#B07A1E', 'cloudOff', 'Confirmada · sem sinal'], already: ['#B07A1E', 'clock', 'Já confirmada'], other: [t.danger, 'ban', 'Não é da sua rota'], notfound: [t.danger, 'search', 'Não achamos esse cupom'],
  }[kind];
  const showStop = !['other', 'notfound'].includes(kind);
  const loc = crLoc(stop);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 45, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: dark ? 'rgba(5,3,1,0.55)' : 'rgba(20,12,4,0.5)' }}>
      <div role="alertdialog" onClick={!bad && kind !== 'gancho' ? onNext : undefined} style={{ width: '100%', background: t.surface, color: t.text, borderRadius: 28, overflow: 'hidden', boxShadow: '0 24px 60px -12px rgba(0,0,0,0.6)', animation: 'crPop .18s ease-out' }}>
        <div style={{ background: head[0], color: '#fff', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 46, height: 46, borderRadius: 99, background: 'rgba(255,255,255,0.22)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={head[1]} size={26} color="#fff" stroke={3} /></span>
          <span style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{head[2]}</span>
        </div>
        <div style={{ padding: '18px 22px 20px' }}>
          {kind === 'already' && <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 12 }}>Essa entrega já foi confirmada às 06:42.</div>}
          {kind === 'offline' && <div style={{ fontSize: 14.5, fontWeight: 600, color: '#6E4712', background: '#FBEFD3', borderRadius: 12, padding: '10px 12px', marginBottom: 14, lineHeight: 1.4 }}>Sem sinal agora. Guardamos a entrega e enviamos sozinhos.</div>}
          {kind === 'other' && <div style={{ fontSize: 16, lineHeight: 1.5, fontWeight: 600 }}>Esse cupom é de outra rota. Separe o saquinho e avise a operação.</div>}
          {kind === 'notfound' && <div style={{ fontSize: 16, lineHeight: 1.5, fontWeight: 600 }}>O QR não corresponde a nenhum pedido de hoje. Tente de novo ou digite o código do cupom.</div>}
          {showStop && (
            <div style={{ opacity: kind === 'already' ? 0.8 : 1 }}>
              <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: kind === 'already' ? 40 : 56, letterSpacing: '-0.035em', lineHeight: 0.95 }}>Apto {stop.ap}</div>
              {loc && <div style={{ fontFamily: CR_H, fontWeight: 700, fontSize: 22, color: t.accent, marginTop: 6, letterSpacing: '-0.01em' }}>{loc}</div>}
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 10 }}>{stop.cliente}</div>
              <div style={{ fontSize: 14, color: t.textSec, fontWeight: 600 }}>{c.condo}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, alignItems: 'center' }}>
                {stop.qtd > 0 && <span style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 18, color: t.text, marginRight: 4 }}>{stop.qtd} pães 🥖</span>}
                <CRCesta cesta={stop.cesta} />
              </div>
              {(stop.primeira || stop.gancho || stop.ganchoNaRota) && kind !== 'already' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {stop.primeira && <CRTag emoji="✨" tone="gold">1ª entrega</CRTag>}
                  {stop.gancho && <CRTag emoji="🪝" tone="neutral">tem gancho</CRTag>}
                  {stop.ganchoNaRota && <CRTag emoji="🪝" tone="dark">+ gancho para entregar</CRTag>}
                </div>
              )}
            </div>
          )}
          {kind === 'gancho' && (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${t.border2}` }}>
              <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', marginBottom: 12 }}>🪝 Deixou o gancho também?</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <CRBig variant="primary" icon="check" style={{ flex: 1 }}>Sim</CRBig>
                <CRBig variant="ghost" style={{ flex: 1.3, fontSize: 15 }}>Ficou para outro dia</CRBig>
              </div>
            </div>
          )}
          {bad && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
              {kind === 'notfound' && <CRBig variant="ghost" icon="keyboard">Digitar código</CRBig>}
              <CRBig variant="primary" onClick={onClose}>Entendi</CRBig>
            </div>
          )}
        </div>
        {!bad && kind !== 'gancho' && (
          <div style={{ padding: '0 22px 18px' }}>
            <div style={{ height: 8, borderRadius: 99, background: t.surface2, overflow: 'hidden' }}><div style={{ height: '100%', background: warn ? t.gold : t.good, width: '100%', transformOrigin: 'left', animation: 'crCount 3s linear infinite' }} /></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9, fontSize: 13.5, color: t.textSec, fontWeight: 700 }}><Icon name="camera" size={15} color={t.accent} />Foto da entrega em 3 s<span style={{ flex: 1 }} />Toque para seguir</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== E5 — Foto da entrega
   variant: req (obrigatória) · opt (opcional)
   st: camera · preview · saved · except · exceptOther */
function PhotoScreen({ variant = 'req', st = 'camera', p = CR_P.ana, nao = false }) {
  const t = useT();
  const loc = crLoc(p);
  const cap = `${nao ? 'Foto da não entrega' : 'Foto da entrega'} · Apto ${p.ap}${p.bloco ? ' · Bloco ' + p.bloco : ''}`;
  if (st === 'saved') return <ScanScreen st="reading" overlay={<CRToast top ic="check">Foto salva · escaneie o próximo</CRToast>} />;
  const prev = st === 'preview';
  return (
    <CRCam>
      {prev ? <div style={{ position: 'absolute', inset: 0 }}><CRPhotoPh w="100%" h="100%" r={0} dark label="prévia da foto" /></div> : <CRFeed />}
      <CRCamTop title={prev ? 'Ficou boa?' : 'Foto'} count={null} />
      <div style={{ position: 'absolute', top: 106, left: 16, right: 16, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ padding: '10px 16px', borderRadius: 14, background: 'rgba(0,0,0,0.6)', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="camera" size={18} color="#E3AC3F" />{cap}</div>
        {!prev && <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{nao ? 'Mostre a porta ou a portaria' : 'Mostre o saquinho na porta ou no gancho'}</div>}
      </div>
      {!prev && <div style={{ position: 'absolute', inset: '170px 36px 210px', border: '2px dashed rgba(255,255,255,0.28)', borderRadius: 22 }} />}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 5, padding: '0 20px 28px' }}>
        {prev ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <CRBig variant="light" icon="refresh" style={{ flex: 1 }}>Tirar outra</CRBig>
            <CRBig variant="gold" icon="check" style={{ flex: 1.3 }}>Usar foto</CRBig>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', height: 92 }}>
              <button aria-label="Tirar foto" style={{ width: 88, height: 88, borderRadius: 99, border: '5px solid #fff', background: 'transparent', padding: 5, cursor: 'pointer' }}><span style={{ display: 'block', width: '100%', height: '100%', borderRadius: 99, background: '#fff' }} /></button>
              {variant === 'opt' && <button style={{ position: 'absolute', right: 0, height: 56, padding: '0 20px', borderRadius: 18, border: '1.5px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.14)', color: '#fff', fontWeight: 800, fontSize: 16, fontFamily: 'inherit', cursor: 'pointer' }}>Pular</button>}
              <button aria-label="Lanterna" style={{ position: 'absolute', left: 0, width: 56, height: 56, borderRadius: 99, border: 'none', background: 'rgba(255,255,255,0.16)', color: '#fff', display: 'grid', placeItems: 'center' }}><Icon name="flash" size={24} /></button>
            </div>
            {variant === 'req' && <button style={{ display: 'block', margin: '14px auto 0', height: 44, background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)', fontSize: 14.5, fontWeight: 700, fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}>Não consigo tirar a foto</button>}
            {variant === 'opt' && <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>A foto é opcional para você</div>}
          </>
        )}
      </div>
      {(st === 'except' || st === 'exceptOther') && <CRNoPhotoSheet st={st} />}
    </CRCam>
  );
}
function CRNoPhotoSheet({ st }) {
  const t = useT();
  const sel = st === 'exceptOther' ? 'Outro' : 'Local sem luz';
  return (
    <CRSheet title="Seguir sem foto" sub="A parada fica marcada como “sem foto” para a operação.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[['camera', 'Câmera com defeito'], ['flash', 'Local sem luz'], ['edit', 'Outro']].map(([ic, l]) => <CRChoice key={l} ic={ic} on={sel === l}>{l}</CRChoice>)}
      </div>
      {st === 'exceptOther' && <CRTextarea value="Celular travou na câmera" style={{ marginTop: 10 }} />}
      <div style={{ height: 16 }} />
      <CRBig icon="ban">Seguir sem foto</CRBig>
    </CRSheet>
  );
}
function CRChoice({ ic, children, on, onClick, disabled, note }) {
  const t = useT();
  return (
    <button onClick={onClick} disabled={disabled} style={{ minHeight: 54, width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', borderRadius: 16, border: `2px solid ${on ? t.text : t.border}`, background: on ? t.surface2 : t.surface, color: t.text, fontFamily: 'inherit', fontSize: 15.5, fontWeight: 700, textAlign: 'left', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1 }}>
      {ic && <Icon name={ic} size={19} color={on ? t.text : t.accent} stroke={2.1} />}
      <span style={{ flex: 1, padding: '10px 0' }}>{children}{note && <span style={{ display: 'block', fontSize: 12.5, color: t.textSec, fontWeight: 600 }}>{note}</span>}</span>
      <span style={{ width: 24, height: 24, borderRadius: 99, border: `2.5px solid ${on ? t.text : t.border}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{on && <span style={{ width: 11, height: 11, borderRadius: 99, background: t.text }} />}</span>
    </button>
  );
}
function CRTextarea({ value, placeholder = 'Conte o que aconteceu', err, style }) {
  const t = useT();
  return (
    <div style={style}>
      <div style={{ minHeight: 84, borderRadius: 14, border: `1.5px solid ${err ? t.danger : t.border}`, background: t.surfaceAlt, padding: '12px 14px', fontSize: 15, color: value ? t.text : t.textTer, lineHeight: 1.45 }}>{value || placeholder}</div>
      {err && <div style={{ fontSize: 12.5, color: t.danger, fontWeight: 700, marginTop: 6, display: 'flex', gap: 5, alignItems: 'center' }}><Icon name="alert" size={13} stroke={2.4} />{err}</div>}
    </div>
  );
}

/* ===== E6 — Confirmar pela lista (sheet de baixo) */
function CRConfirmSheet({ p = CR_P.ana, c = CR_C0 }) {
  const t = useT();
  const loc = crLoc(p);
  return (
    <CRSheet>
      <div style={{ fontSize: 13, color: t.textSec, fontWeight: 700 }}>{c.condo}</div>
      <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 50, letterSpacing: '-0.035em', lineHeight: 1, marginTop: 4 }}>Apto {p.ap}</div>
      {loc && <div style={{ fontFamily: CR_H, fontWeight: 700, fontSize: 21, color: t.accent, marginTop: 4 }}>{loc}</div>}
      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8 }}>{p.cliente}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, alignItems: 'center' }}>
        {p.qtd > 0 && <span style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 18, marginRight: 4 }}>{p.qtd} pães 🥖</span>}
        <CRCesta cesta={p.cesta} />
        {p.ganchoNaRota && <CRTag emoji="🪝" tone="dark">+ entregar gancho</CRTag>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
        <CRBig icon="check" h={62}>Confirmar entrega</CRBig>
        <CRBig variant="danger" icon="x">Não consegui entregar</CRBig>
        <button style={{ height: 48, background: 'none', border: 'none', fontSize: 15, fontWeight: 700, color: t.textSec, fontFamily: 'inherit', cursor: 'pointer' }}>Cancelar</button>
      </div>
    </CRSheet>
  );
}

/* ===== E6 — Não consegui entregar
   st: none · ready · other · otherEmpty · sending · offline  · recados: mostra "Avisar o cliente" */
function CRFailSheet({ st = 'none', p = CR_P.ana, recados = true, fotoReq = COURIER.regras.fotoNaoEntrega }) {
  const t = useT();
  const sel = { none: null, ready: 'Portaria não liberou', other: 'Outro', otherEmpty: 'Outro', sending: 'Portaria não liberou', offline: 'Portaria não liberou' }[st];
  const ics = ['user', 'gate', 'search', 'box', 'alert', 'edit'];
  const disabled = !sel || st === 'otherEmpty';
  return (
    <CRSheet title="Não consegui entregar" sub={`Apto ${p.ap}${p.bloco ? ' · Bloco ' + p.bloco : ''} · ${p.cliente}`}>
      <CRLabel>Motivo</CRLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {MOTIVOS_NAO_ENTREGA.map((m, i) => (
          <button key={m} style={{ minHeight: 58, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 16, border: `2px solid ${sel === m ? t.danger : t.border}`, background: sel === m ? t.dangerSoft : t.surface, color: sel === m ? t.danger : t.text, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, textAlign: 'left', lineHeight: 1.2, cursor: 'pointer' }}>
            <Icon name={sel === m ? 'check' : ics[i]} size={17} stroke={2.3} style={{ flexShrink: 0 }} />{m}
          </button>
        ))}
      </div>
      {(st === 'other' || st === 'otherEmpty') && <CRTextarea value={st === 'other' ? 'Portão da garagem quebrado, não deu para entrar' : ''} err={st === 'otherEmpty' ? 'Escreva o motivo para seguir' : null} style={{ marginTop: 10 }} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, padding: '12px 14px', borderRadius: 14, background: t.surface2 }}>
        <Icon name="camera" size={19} color={t.accent} />
        <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>Em seguida: foto da porta ou portaria</span>
        <CRTag tone={fotoReq ? 'dark' : 'neutral'} size="sm">{fotoReq ? 'obrigatória' : 'opcional'}</CRTag>
      </div>
      {recados && (
        <button style={{ marginTop: 8, width: '100%', minHeight: 52, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', borderRadius: 14, border: `1.5px solid ${t.border}`, background: t.surface, fontFamily: 'inherit', fontSize: 14.5, fontWeight: 700, color: t.text, cursor: 'pointer' }}>
          <Icon name="chat" size={19} color={t.accent} /><span style={{ flex: 1, textAlign: 'left' }}>Avisar o cliente</span><Icon name="chevR" size={17} color={t.textTer} />
        </button>
      )}
      {st === 'offline' && <CRNote ic="cloudOff" tone="gold" style={{ marginTop: 12 }}>Sem sinal agora. Guardamos a não entrega e enviamos sozinhos.</CRNote>}
      <div style={{ height: 16 }} />
      <CRBig variant="dangerFill" icon={st === 'sending' ? null : 'x'} disabled={disabled} right={st === 'sending' ? <CRSpin color="#fff" /> : null}>{st === 'sending' ? 'Enviando…' : st === 'offline' ? 'Guardado · seguir para a foto' : 'Confirmar não entrega'}</CRBig>
      {disabled && st === 'none' && <div style={{ textAlign: 'center', fontSize: 13, color: t.textTer, fontWeight: 600, marginTop: 8 }}>Escolha um motivo</div>}
    </CRSheet>
  );
}

Object.assign(window, { CR_P, CR_C0, CRFeed, CRCoupon, CRFrame, CRCamTop, CRCamBottom, CRCam, ScanScreen, CRKeyboard, CRCodeSheet, CRResult, PhotoScreen, CRNoPhotoSheet, CRChoice, CRTextarea, CRConfirmSheet, CRFailSheet });
