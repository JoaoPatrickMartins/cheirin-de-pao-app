/* ============================================================
   App do Entregador — kit reutilizável + E1 (tela principal) + E7 (parada / prédio)
   Substitui CourierScreen/CourierRoute de screens-roles.jsx.
   Todo componente aceita `st` para forçar um estado no quadro.
   ============================================================ */
const CR_H = 'Bricolage Grotesque, sans-serif';
const crR = n => 'R$ ' + n.toFixed(2).replace('.', ',');
const crN = n => String(n).replace('.', ',');
const crApto = p => (p.compl ? p.compl + ' — ' : '') + 'Apto ' + p.ap;
const crLoc = p => [p.bloco && 'Bloco ' + p.bloco, p.compl].filter(Boolean).join(' · ');
const crIni = n => n.split(' ').filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();

/* ---------- Primitivas do entregador ---------- */
function CRLabel({ children, right, style }) {
  const t = useT();
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 2px 8px', ...style }}><div style={{ flex: 1, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.1em', color: t.textTer, textTransform: 'uppercase' }}>{children}</div>{right}</div>;
}
/* Botão grande (≥56 px) para ações principais na área do polegar */
function CRBig({ children, icon, variant = 'primary', onClick, disabled, h = 58, style, right }) {
  const t = useT();
  const v = {
    primary: { bg: t.primaryBtn, c: t.primaryBtnText, ic: t.gold, b: 'none' },
    gold: { bg: t.gold, c: t.onGold, ic: t.onGold, b: 'none' },
    good: { bg: t.good, c: '#fff', ic: '#fff', b: 'none' },
    danger: { bg: 'transparent', c: t.danger, ic: t.danger, b: `2px solid ${t.danger}` },
    dangerFill: { bg: t.danger, c: '#fff', ic: '#fff', b: 'none' },
    ghost: { bg: t.surface, c: t.text, ic: t.text, b: `1.5px solid ${t.border}` },
    soft: { bg: t.surface2, c: t.text, ic: t.accent, b: 'none' },
    light: { bg: 'rgba(255,255,255,0.14)', c: '#fff', ic: '#fff', b: '1.5px solid rgba(255,255,255,0.22)' },
  }[variant];
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{ height: h, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: v.bg, color: v.c, border: v.b, borderRadius: 18, fontFamily: 'Hanken Grotesk, sans-serif', fontWeight: 800, fontSize: 16.5, letterSpacing: '-0.01em', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1, padding: '0 18px', transition: 'transform .12s', flexShrink: 0, ...style }}>
      {icon && <Icon name={icon} size={22} color={v.ic} stroke={2.3} />}
      <span style={{ whiteSpace: 'nowrap' }}>{children}</span>
      {right}
    </button>
  );
}
function CRIconBtn({ icon, onClick, size = 44, tone = 'ghost', label, badge }) {
  const t = useT();
  const s = { ghost: [t.surface, t.text, `1.5px solid ${t.border}`], soft: [t.surface2, t.accent, 'none'], dark: ['rgba(255,255,255,0.14)', '#fff', 'none'], gold: [t.goldSoft, t.accent, 'none'] }[tone];
  return (
    <button onClick={onClick} aria-label={label} style={{ position: 'relative', width: size, height: size, borderRadius: size > 50 ? 18 : 14, background: s[0], color: s[1], border: s[2], display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
      <Icon name={icon} size={size > 50 ? 24 : 20} stroke={2.1} />
      {badge && <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 99, background: t.danger, color: '#fff', fontSize: 10.5, fontWeight: 800, display: 'grid', placeItems: 'center', padding: '0 5px' }}>{badge}</span>}
    </button>
  );
}
function CRSpin({ size = 18, color }) {
  const t = useT();
  return <span style={{ width: size, height: size, borderRadius: 99, border: `2.5px solid ${color || t.accent}`, borderTopColor: 'transparent', display: 'inline-block', animation: 'crSpin .8s linear infinite', flexShrink: 0 }} />;
}
function CRSkel({ h = 16, w = '100%', r = 12, style }) {
  const t = useT();
  return <div style={{ height: h, width: w, borderRadius: r, background: `linear-gradient(90deg, ${t.surface2} 0%, ${t.surfaceAlt} 50%, ${t.surface2} 100%)`, backgroundSize: '200% 100%', animation: 'crShimmer 1.4s linear infinite', ...style }} />;
}
/* Selo de estado — sempre ícone + texto */
function CRTag({ ic, children, tone = 'neutral', size = 'md', emoji }) {
  const t = useT();
  const m = { neutral: [t.surface2, t.textSec], gold: [t.goldSoft, '#8A5616'], good: [t.goodSoft, t.good], danger: [t.dangerSoft, t.danger], dark: [t.espresso, t.gold], warn: ['#FBE7C2', '#8A5616'] }[tone];
  const sm = size === 'sm';
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: sm ? '2px 7px' : '3px 9px', borderRadius: 999, background: m[0], color: m[1], fontSize: sm ? 11 : 12, fontWeight: 800, whiteSpace: 'nowrap', lineHeight: 1.35 }}>{emoji ? <span>{emoji}</span> : ic && <Icon name={ic} size={sm ? 11 : 12.5} stroke={2.6} />}{children}</span>;
}
/* Status do comprovante */
function CRProof({ s, size = 'sm' }) {
  if (!s) return null;
  const m = { ok: ['camera', 'foto ok', 'good'], enviando: ['cloudUp', 'enviando', 'neutral'], pendente: ['cloudOff', 'pendente de envio', 'warn'], falhou: ['refresh', 'tentando de novo', 'warn'], sem: ['ban', 'sem foto', 'danger'], pulada: ['ban', 'sem foto · pulada', 'neutral'] }[s];
  return <CRTag ic={m[0]} tone={m[2]} size={size}>{m[1]}</CRTag>;
}
function CRCesta({ cesta }) {
  const t = useT();
  if (!cesta || !cesta.length) return null;
  return cesta.map((x, i) => <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: t.goldSoft, color: '#8A5616', fontSize: 11.5, fontWeight: 700 }}><Icon name="basket" size={11} stroke={2.4} />{x.q}× {x.n}</span>);
}
/* Placeholder de foto (comprovante / entrada). No app real: <img>. */
function CRPhotoPh({ w = 64, h = 64, r = 12, label, dark, onClick }) {
  const t = useT();
  const a = dark ? '#2A1B0E' : '#E9DCC4', b = dark ? '#33230F' : '#E2D2B6';
  return (
    <div onClick={onClick} style={{ width: w, height: h, borderRadius: r, flexShrink: 0, background: `repeating-linear-gradient(135deg, ${a} 0 8px, ${b} 8px 16px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: dark ? '#A89A82' : t.textSec, cursor: onClick ? 'pointer' : 'default', overflow: 'hidden' }}>
      <Icon name="image" size={typeof w === 'number' ? Math.min(26, w / 3) : 34} stroke={1.8} />
      {label && <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10.5, textAlign: 'center', padding: '0 6px' }}>{label}</span>}
    </div>
  );
}
function CRAvatar({ nome = COURIER.nome, foto, size = 44, radius }) {
  const t = useT();
  const r = radius != null ? radius : size;
  if (foto) return <div style={{ width: size, height: size, borderRadius: r, overflow: 'hidden', flexShrink: 0, background: `radial-gradient(circle at 50% 38%, #C9A57A 0 22%, transparent 23%), radial-gradient(ellipse at 50% 100%, #8A5A2E 0 42%, transparent 43%), linear-gradient(160deg, #EADBC0, #D8C3A0)`, border: `2px solid ${t.gold}` }} aria-label={'Foto de ' + nome} />;
  return <div style={{ width: size, height: size, borderRadius: r, background: t.espresso, color: t.gold, display: 'grid', placeItems: 'center', fontFamily: CR_H, fontWeight: 800, fontSize: size * 0.38, flexShrink: 0, letterSpacing: '-0.02em' }}>{crIni(nome)}</div>;
}
/* Sheet de baixo */
function CRSheet({ children, title, sub, onClose, pad = 20, dark, inline }) {
  const t = useT();
  return (
    <div style={inline ? { position: 'relative' } : { position: 'absolute', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      {!inline && <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(20,12,4,0.55)' }} />}
      <div style={{ position: 'relative', background: dark ? '#1E1207' : t.surface, color: dark ? '#FAF5EC' : t.text, borderRadius: inline ? 28 : '28px 28px 0 0', padding: `10px ${pad}px 26px`, boxShadow: inline ? t.shadowSoft : '0 -10px 40px -10px rgba(0,0,0,0.35)', maxHeight: inline ? 'none' : '92%', overflowY: 'auto', animation: inline ? 'none' : 'crUp .22s ease-out' }}>
        <div style={{ width: 44, height: 5, borderRadius: 99, background: dark ? 'rgba(255,255,255,0.2)' : t.border, margin: '0 auto 16px' }} />
        {(title || onClose) && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              {title && <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 23, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{title}</div>}
              {sub && <div style={{ fontSize: 14, color: dark ? '#C7B595' : t.textSec, marginTop: 5, lineHeight: 1.4 }}>{sub}</div>}
            </div>
            {onClose && <CRIconBtn icon="x" onClick={onClose} tone={dark ? 'dark' : 'soft'} label="Fechar" />}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
function CRToast({ children, ic = 'check', tone = 'good', top }) {
  const t = useT();
  return <div style={{ position: 'absolute', left: 16, right: 16, [top ? 'top' : 'bottom']: top ? 60 : 110, zIndex: 60, display: 'flex', alignItems: 'center', gap: 10, background: '#241608', color: '#FAF5EC', borderRadius: 16, padding: '14px 16px', boxShadow: t.shadow, fontWeight: 700, fontSize: 14.5, animation: 'crUp .2s ease-out' }}><span style={{ width: 28, height: 28, borderRadius: 99, background: tone === 'good' ? t.good : t.gold, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={ic} size={16} color={tone === 'good' ? '#fff' : '#1E1207'} stroke={2.8} /></span>{children}</div>;
}
/* Aviso inline (ícone + texto) */
function CRNote({ ic = 'alert', tone = 'neutral', children, style }) {
  const t = useT();
  const m = { neutral: [t.surface2, t.textSec, t.accent], gold: ['#FBEFD3', '#6E4712', t.accent], danger: [t.dangerSoft, t.danger, t.danger], good: [t.goodSoft, t.good, t.good] }[tone];
  return <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: m[0], color: m[1], borderRadius: 14, padding: '11px 13px', fontSize: 13, lineHeight: 1.45, fontWeight: 600, ...style }}><Icon name={ic} size={17} color={m[2]} stroke={2.2} style={{ flexShrink: 0, marginTop: 1 }} /><div style={{ flex: 1 }}>{children}</div></div>;
}

/* ---------- Faixa de sincronização / entregas novas ---------- */
function CRSync({ kind = 'offline', n = FILA_OFFLINE.pendentes }) {
  const t = useT();
  if (kind === 'novas') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: t.espresso, color: '#FAF5EC', borderRadius: 16, padding: '8px 8px 8px 14px' }}>
      <Icon name="bell" size={18} color={t.gold} />
      <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>3 entregas novas na sua rota</span>
      <button style={{ height: 44, padding: '0 14px', borderRadius: 12, border: 'none', background: t.gold, color: t.onGold, fontWeight: 800, fontSize: 14, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><Icon name="refresh" size={16} stroke={2.4} />Atualizar</button>
    </div>
  );
  const off = kind === 'offline';
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 11, background: off ? '#FBE7C2' : t.surface2, color: off ? '#5E3B0C' : t.textSec, borderRadius: 16, padding: '11px 14px', border: off ? '1px solid #EBC98A' : 'none' }}>
      {off ? <Icon name="cloudOff" size={20} color="#8A5616" stroke={2.2} /> : <CRSpin size={17} />}
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, lineHeight: 1.35 }}>{off ? <><b>Sem sinal</b> — {n} entregas guardadas, sobem quando o sinal voltar</> : `Enviando ${n}…`}</span>
      {!off && <Icon name="cloudUp" size={18} color={t.accent} />}
    </div>
  );
}

/* ---------- Cabeçalho do entregador ---------- */
function CRHeader({ onProfile, onBadge, foto }) {
  const t = useT();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 20px 12px' }}>
      <button onClick={onProfile} aria-label="Abrir perfil" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 11, flex: 1, textAlign: 'left', fontFamily: 'inherit' }}>
        <CRAvatar size={46} radius={15} foto={foto} />
        <div>
          <div style={{ fontSize: 12.5, color: t.textTer, fontWeight: 600 }}>Bom dia,</div>
          <div style={{ fontFamily: CR_H, fontWeight: 700, fontSize: 18, color: t.text, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 4 }}>{COURIER.primeiroNome}<Icon name="chevR" size={15} color={t.textTer} stroke={2.4} /></div>
        </div>
      </button>
      <button onClick={onBadge} style={{ height: 44, padding: '0 13px', borderRadius: 14, border: `1.5px solid ${t.border}`, background: t.surface, color: t.text, display: 'flex', alignItems: 'center', gap: 7, fontWeight: 800, fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer' }}><Icon name="badge" size={19} color={t.accent} stroke={2.1} />Crachá</button>
    </div>
  );
}

/* ---------- Card "Rota de hoje" com estado por turno ---------- */
function CRTurnoChip({ r, dark }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: dark ? 'rgba(227,172,63,0.16)' : '#F3DDA6', color: dark ? '#E3AC3F' : '#8A5616', fontSize: 12.5, fontWeight: 800, whiteSpace: 'nowrap' }}>{r.emoji} {r.nome} · {r.hora}</span>;
}
function CRRouteLine({ r, onStart, last }) {
  const t = useT();
  const st = r.estado;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: last ? 'none' : `1px solid ${t.border2}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <CRTurnoChip r={r} />
          {r.ordemAlteradaHoje && <CRTag ic="repeat" tone="neutral" size="sm">ordem alterada hoje</CRTag>}
        </div>
        <div style={{ marginTop: 7, fontSize: 14, fontWeight: 700, color: t.text, display: 'flex', alignItems: 'center', gap: 7 }}>
          {st === 'pronta' && <><Icon name="clock" size={16} color={t.textSec} /><span>Pronta · {r.paradas} paradas · ~{crN(r.km)} km</span></>}
          {st === 'em_rota' && <><span style={{ width: 9, height: 9, borderRadius: 99, background: t.good, boxShadow: `0 0 0 4px ${t.goodSoft}` }} /><span>Em rota desde {r.inicio} · {r.feitas}/{r.paradas}</span></>}
          {st === 'encerrada' && <><Icon name="check" size={16} color={t.good} stroke={2.8} /><span>Encerrada às {r.fim || '06:40'}</span></>}
        </div>
      </div>
      {st === 'pronta' && onStart !== false && <button onClick={onStart} style={{ height: 44, padding: '0 14px', borderRadius: 14, border: 'none', background: t.primaryBtn, color: t.primaryBtnText, fontWeight: 800, fontSize: 14, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}><Icon name="play" size={15} color={t.gold} stroke={2.4} />Iniciar</button>}
    </div>
  );
}
function CRRouteCard({ rotas = ROTAS_HOJE, cesta = true, onStart }) {
  const t = useT();
  return (
    <Card pad={16} style={{ paddingBottom: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: t.textTer }}>ROTA DE HOJE</div>
      <div style={{ fontFamily: CR_H, fontWeight: 700, fontSize: 19, color: t.text, letterSpacing: '-0.02em', marginTop: 3 }}>Terça-feira, 30 de setembro</div>
      {cesta && <div style={{ fontSize: 13, color: t.textSec, marginTop: 5, fontWeight: 600 }}>🧺 48 🥖 + 6 itens do Além do Pãozin</div>}
      <div style={{ marginTop: 4 }}>{rotas.map((r, i) => <CRRouteLine key={r.turno} r={r} onStart={onStart} last={i === rotas.length - 1} />)}</div>
    </Card>
  );
}

/* ---------- Segmentado · progresso ---------- */
function CRSeg({ value, onChange = () => {}, counts = {} }) {
  const t = useT();
  return (
    <div style={{ display: 'flex', gap: 4, background: t.surface2, borderRadius: 15, padding: 4 }}>
      {[['lista', 'Lista', 'list'], ['rota', 'Rota', 'route'], ['realizadas', 'Realizadas', 'check']].map(([k, l, ic]) => (
        <button key={k} onClick={() => onChange(k)} style={{ flex: 1, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 14, fontFamily: 'inherit', background: value === k ? t.surface : 'transparent', color: value === k ? t.text : t.textSec, boxShadow: value === k ? t.shadowSoft : 'none' }}><Icon name={ic} size={17} stroke={2.2} />{l}{counts[k] != null && <span style={{ fontSize: 11.5, color: t.textTer }}>{counts[k]}</span>}</button>
      ))}
    </div>
  );
}
function CRProgress({ feitas = 7, total = 12, paes = 38, paesTotal = 64 }) {
  const t = useT();
  return (
    <div style={{ borderRadius: 20, overflow: 'hidden', background: t.espresso, position: 'relative' }}>
      <div style={{ position: 'absolute', bottom: -44, right: -14, opacity: 0.12 }}><BreadMark size={130} color="#E3AC3F" /></div>
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-end', position: 'relative' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#E3AC3F', fontWeight: 800, letterSpacing: '0.08em' }}>PROGRESSO</div>
          <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 26, color: '#FAF5EC', letterSpacing: '-0.02em' }}>{feitas}/{total} <span style={{ fontSize: 16, fontWeight: 700, color: '#C7B595' }}>paradas</span></div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11.5, color: '#C7B595', fontWeight: 600 }}>Total de pães</div>
          <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 22, color: '#E3AC3F' }}>{paes}/{paesTotal}</div>
        </div>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.1)' }}><div style={{ height: '100%', width: `${(feitas / total) * 100}%`, background: '#E3AC3F' }} /></div>
    </div>
  );
}

/* ---------- Dock fixo no rodapé (proposta para E1) ----------
   mode: scan (em rota) · start (rota pronta) · end (tudo resolvido) · none */
function CRDock({ mode = 'scan', count = '7/12', turno = ROTAS_HOJE[1], onScan, onCode, onStart, onEnd }) {
  const t = useT();
  if (mode === 'none') return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, padding: '12px 16px 22px', background: `linear-gradient(to top, ${t.appBg} 70%, rgba(250,245,236,0))` }}>
      {mode === 'scan' && (
        <div style={{ display: 'flex', gap: 10 }}>
          <CRBig icon="camera" h={62} onClick={onScan} style={{ flex: 1, boxShadow: '0 10px 24px -10px rgba(30,18,7,0.6)' }} right={<span style={{ marginLeft: 4, padding: '3px 9px', borderRadius: 99, background: 'rgba(227,172,63,0.18)', color: t.gold, fontSize: 13, fontWeight: 800 }}>{count}</span>}>Escanear cupom</CRBig>
          <button onClick={onCode} aria-label="Digitar código" style={{ width: 62, height: 62, borderRadius: 18, border: `1.5px solid ${t.border}`, background: t.surface, color: t.text, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0, boxShadow: t.shadowSoft }}><Icon name="keyboard" size={24} stroke={2} /></button>
        </div>
      )}
      {mode === 'start' && <CRBig icon="play" h={62} onClick={onStart} style={{ boxShadow: '0 10px 24px -10px rgba(30,18,7,0.6)' }}>Iniciar rota · {turno.emoji} {turno.nome}</CRBig>}
      {mode === 'end' && <CRBig icon="flag" variant="gold" h={62} onClick={onEnd}>Encerrar rota da manhã</CRBig>}
    </div>
  );
}

/* ---------- E7 · Linha da parada ---------- */
function CRCheck({ status }) {
  const t = useT();
  const s = { entregue: [t.good, t.good, 'check'], nao_entregue: [t.danger, t.danger, 'x'], pendente: ['transparent', t.border, null] }[status] || ['transparent', t.border, null];
  return <div style={{ width: 30, height: 30, borderRadius: 10, border: `2.5px solid ${s[1]}`, background: s[0], display: 'grid', placeItems: 'center', flexShrink: 0 }}>{s[2] && <Icon name={s[2]} size={17} color="#fff" stroke={3.2} />}</div>;
}
function CRStopRow({ p, n, recados = COURIER.regras.podeRecados, onClick, onRecado, showBlock, last }) {
  const t = useT();
  const done = p.status !== 'pendente';
  const soCesta = !p.qtd && p.cesta;
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '12px 16px', minHeight: 64, cursor: 'pointer', borderBottom: last ? 'none' : `1px solid ${t.border2}`, background: done ? t.surfaceAlt : 'transparent' }}>
      <span style={{ width: 20, fontSize: 12, fontWeight: 800, color: t.textTer, fontFamily: CR_H, paddingTop: 6, textAlign: 'center', flexShrink: 0 }}>{n}</span>
      <CRCheck status={p.status} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 15.5, color: t.text, letterSpacing: '-0.01em', lineHeight: 1.25 }}>{showBlock && p.bloco ? `Bloco ${p.bloco} · ` : ''}{crApto(p)}</div>
        <div style={{ fontSize: 13, color: t.textSec, marginTop: 1 }}>{p.cliente}</div>
        {(p.gancho || p.primeira || p.ganchoNaRota || p.cesta || p.nova || done) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
            {p.status === 'entregue' && <CRTag ic="check" tone="good" size="sm">entregue {p.hora}</CRTag>}
            {p.status === 'nao_entregue' && <CRTag ic="x" tone="danger" size="sm">não entregue {p.hora}</CRTag>}
            {done && <CRProof s={p.foto} />}
            {p.nova && <CRTag ic="plus" tone="dark" size="sm">nova</CRTag>}
            {p.primeira && <CRTag emoji="✨" tone="gold" size="sm">1ª entrega</CRTag>}
            {p.gancho && <CRTag emoji="🪝" tone="neutral" size="sm">tem gancho</CRTag>}
            {p.ganchoNaRota && <CRTag emoji="🪝" tone="dark" size="sm">+ entregar gancho</CRTag>}
            <CRCesta cesta={p.cesta} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 18, color: done ? t.textTer : t.accent, paddingTop: 3 }}>{soCesta ? '🧺' : `${p.qtd} 🥖`}</div>
        {recados && !done && <button onClick={e => { e.stopPropagation(); onRecado && onRecado(p); }} aria-label="Mandar recado" style={{ width: 44, height: 44, borderRadius: 13, border: `1.5px solid ${t.border}`, background: t.surface, color: t.accent, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="chat" size={19} stroke={2} /></button>}
      </div>
    </div>
  );
}

/* ---------- E7 · Bloco "Acesso" do prédio ---------- */
function CRAccess({ a, st }) {
  const t = useT();
  const none = st === 'none' || !a;
  const Line = ({ ic, k, v }) => v ? <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '5px 0' }}><Icon name={ic} size={17} color={t.accent} stroke={2.1} style={{ flexShrink: 0, marginTop: 1 }} /><div style={{ fontSize: 13.5, lineHeight: 1.4, color: t.text }}><span style={{ color: t.textSec, fontWeight: 600 }}>{k} </span><b style={{ fontWeight: 700 }}>{v}</b></div></div> : null;
  return (
    <div style={{ margin: '4px 14px 10px', background: t.surfaceAlt, border: `1px solid ${t.border2}`, borderRadius: 16, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: none ? 4 : 6 }}>
        <Icon name="gate" size={16} color={t.textSec} stroke={2.1} />
        <span style={{ flex: 1, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.1em', color: t.textSec }}>ACESSO</span>
        <button style={{ background: 'none', border: 'none', color: t.accent, fontWeight: 800, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', padding: '6px 0' }}>{none ? 'Sugerir' : 'Sugerir correção'}</button>
      </div>
      {none ? <div style={{ fontSize: 13.5, color: t.textSec }}>Nenhuma dica ainda. Conhece a entrada? Sugira para a operação.</div> : (
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Line ic="building" k="Portaria:" v={a.portaria} />
            <Line ic="lock" k="Portão:" v={a.portao} />
            <Line ic="moto" k="Parar:" v={a.parar} />
            <Line ic="doc" k="Obs.:" v={a.obs} />
          </div>
          {a.foto && <div style={{ position: 'relative' }}><CRPhotoPh w={78} h={96} r={12} label="entrada" /><span style={{ position: 'absolute', right: 5, bottom: 5, width: 24, height: 24, borderRadius: 8, background: 'rgba(30,18,7,0.7)', display: 'grid', placeItems: 'center' }}><Icon name="search" size={13} color="#fff" stroke={2.4} /></span></div>}
        </div>
      )}
      <button style={{ marginTop: 10, width: '100%', height: 46, borderRadius: 14, border: 'none', background: t.espresso, color: '#FAF5EC', fontWeight: 800, fontSize: 14.5, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}><Icon name="navigate" size={17} color={t.gold} stroke={2.2} />Navegar até aqui</button>
    </div>
  );
}

/* ---------- E7 · Cabeçalho do prédio (acordeão) ---------- */
function CRBuilding({ c, idx, open, onToggle, access = true, accessSt, recados, onStop, onRecado }) {
  const t = useT();
  const done = c.paradas.filter(p => p.status !== 'pendente').length;
  const all = done === c.paradas.length;
  const blocos = [...new Set(c.paradas.map(p => p.bloco))];
  return (
    <Card pad={0} style={{ overflow: 'hidden' }}>
      <div onClick={onToggle} style={{ cursor: 'pointer', padding: '14px 16px', minHeight: 64, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 11, background: all ? t.goodSoft : t.gold, color: all ? t.good : t.onGold, display: 'grid', placeItems: 'center', flexShrink: 0, fontFamily: CR_H, fontWeight: 800, fontSize: 16 }}>{all ? <Icon name="check" size={18} stroke={3} /> : idx + 1}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: CR_H, fontWeight: 700, fontSize: 18, color: t.text, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{c.condo}</div>
          <div style={{ fontSize: 12.5, color: t.textTer, marginTop: 2, fontWeight: 600 }}>{c.paradas.length} paradas · previsto {c.eta}</div>
        </div>
        {all ? <CRTag ic="check" tone="good">Ok</CRTag> : <CRTag tone="gold">{done}/{c.paradas.length}</CRTag>}
        <Icon name="chevD" size={19} color={t.textTer} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </div>
      {open && (
        <div style={{ borderTop: `1px solid ${t.border2}` }}>
          {access && <div style={{ paddingTop: 10 }}><CRAccess a={c.acesso} st={accessSt} /></div>}
          {blocos.map(b => (
            <div key={b || 'u'}>
              {b && <div style={{ padding: '10px 16px 4px', fontSize: 11.5, color: t.textTer, fontWeight: 800, letterSpacing: '0.1em' }}>BLOCO {b}</div>}
              {c.paradas.filter(p => p.bloco === b).map((p, i, arr) => <CRStopRow key={p.id} p={p} n={c.paradas.indexOf(p) + 1} recados={recados} onClick={() => onStop && onStop(p, c)} onRecado={onRecado} last={i === arr.length - 1} />)}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ---------- Dados derivados para os estados ---------- */
const crAllDone = list => list.map(c => ({ ...c, paradas: c.paradas.map(p => p.status === 'pendente' ? { ...p, status: 'entregue', hora: '06:3' + (p.ap.length % 9), foto: 'ok' } : p) }));
const CR_TARDE = [
  { condo: 'Parque das Águas', bairro: 'Jardim Europa', eta: '16:12', ll: [-23.5474, -46.6466], acesso: null, paradas: [
    { id: 't1', bloco: null, compl: null, ap: '21', cliente: 'Renata Faria', qtd: 4, status: 'pendente' },
    { id: 't2', bloco: null, compl: null, ap: '44', cliente: 'Marcos Tavares', qtd: 6, primeira: true, status: 'pendente' },
    { id: 't3', bloco: null, compl: null, ap: '72', cliente: 'Denise Moura', qtd: 4, status: 'pendente' }] },
  { condo: 'Residencial Jardins', bairro: 'Centro', eta: '16:30', ll: [-23.5646, -46.6531], acesso: CR_ENTREGAS[0].acesso, paradas: [
    { id: 't4', bloco: '1', compl: null, ap: '302', cliente: 'Fábio Costa', qtd: 4, status: 'pendente' },
    { id: 't5', bloco: '2', compl: 'Lado A', ap: '41', cliente: 'Íris Campos', qtd: 4, status: 'pendente' }] },
];

function CRTurnoSection({ r, list, openKey, setOpen, k, onStop }) {
  const t = useT();
  const tot = list.reduce((a, c) => a + c.paradas.length, 0);
  const done = list.reduce((a, c) => a + c.paradas.filter(p => p.status !== 'pendente').length, 0);
  const pT = list.reduce((a, c) => a + c.paradas.reduce((x, p) => x + p.qtd, 0), 0);
  const pD = list.reduce((a, c) => a + c.paradas.filter(p => p.status === 'entregue').reduce((x, p) => x + p.qtd, 0), 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ padding: '4px 2px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CRTurnoChip r={r} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: t.textSec, textAlign: 'right' }}>{done}/{tot} paradas · {pD}/{pT} 🥖</span>
        </div>
        <div style={{ height: 5, borderRadius: 99, background: t.surface2, marginTop: 8, overflow: 'hidden' }}><div style={{ height: '100%', width: `${(done / tot) * 100}%`, background: done === tot ? t.good : t.gold }} /></div>
      </div>
      {list.map((c, i) => <CRBuilding key={k + i} c={c} idx={i} open={openKey === k + i} onToggle={() => setOpen(openKey === k + i ? null : k + i)} onStop={onStop} />)}
    </div>
  );
}

function CRWeekMini() {
  const t = useT();
  const d = [['Seg', '29', 1], ['Ter', '30', 0], ['Qua', '01', 1], ['Qui', '02', 1], ['Sex', '03', 1], ['Sáb', '04', 1], ['Dom', '05', 0]];
  return (
    <Card pad={14}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: t.textTer, marginBottom: 10 }}>ESTA SEMANA</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {d.map(([l, n, w], i) => { const today = i === 1; return <div key={l} style={{ borderRadius: 12, padding: '7px 0', textAlign: 'center', background: today ? t.good : w ? t.surfaceAlt : t.surface2, color: today ? '#fff' : t.text, border: today ? 'none' : `1px solid ${t.border2}` }}><div style={{ fontSize: 10.5, fontWeight: 800, opacity: 0.8 }}>{l}</div><div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 16 }}>{n}</div><div style={{ fontSize: 10, fontWeight: 800, marginTop: 2, color: today ? '#fff' : w ? t.accent : t.textTer }}>{today ? 'folga' : w ? '☀️' : 'folga'}</div></div>; })}
      </div>
    </Card>
  );
}

/* ===== E1 — Tela principal
   st: loading · empty · folga · pronta · emrota · encerrada · dois · offline · sending · novas · notifOff
   tab: lista · rota · realizadas · overlay: nó sobreposto (sheets/pop-ups) */
function CourierHome({ st = 'emrota', tab: tab0 = 'lista', open: open0 = 'm0', overlay, go = () => {}, foto, routeSt, doneSt, pushOff }) {
  const t = useT();
  const [tab, setTab] = React.useState(tab0);
  const [open, setOpen] = React.useState(open0);
  React.useEffect(() => setTab(tab0), [tab0]);
  const manhaRota = { ...ROTAS_HOJE[0], ...(st === 'pronta' ? { estado: 'pronta', feitas: 0 } : st === 'encerrada' || st === 'dois' ? { estado: 'encerrada', fim: '06:40', feitas: 12 } : {}) };
  const rotas = st === 'dois' ? [manhaRota, ROTAS_HOJE[1]] : [manhaRota];
  const manhaList0 = st === 'pronta' ? CR_ENTREGAS.map(c => ({ ...c, paradas: c.paradas.map(p => ({ ...p, status: 'pendente', foto: null })) })) : st === 'encerrada' || st === 'dois' ? crAllDone(CR_ENTREGAS) : CR_ENTREGAS;
  let manhaList = st === 'offline' ? manhaList0.map(c => ({ ...c, paradas: c.paradas.map(p => p.foto === 'enviando' ? { ...p, foto: 'pendente' } : p) })) : manhaList0;
  if (st === 'novas') manhaList = [...manhaList, { ...CR_TARDE[0], eta: '06:28', paradas: CR_TARDE[0].paradas.map(p => ({ ...p, nova: true })) }];
  const dock = st === 'pronta' ? 'start' : st === 'dois' ? 'start' : st === 'encerrada' ? 'none' : ['loading', 'empty', 'folga'].includes(st) ? 'none' : 'scan';
  const tot = manhaList.reduce((a, c) => a + c.paradas.length, 0);
  const feitas = manhaList.reduce((a, c) => a + c.paradas.filter(p => p.status !== 'pendente').length, 0);

  let body;
  if (st === 'loading') body = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <CRSkel h={150} r={22} /><CRSkel h={52} r={15} /><CRSkel h={80} r={20} /><CRSkel h={64} r={22} /><CRSkel h={64} r={22} /><CRSkel h={64} r={22} />
    </div>
  );
  else if (st === 'empty' || st === 'folga') body = (
    <>
      <Card pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '26px 22px', textAlign: 'center', background: st === 'folga' ? t.goodSoft : t.surface }}>
          <div style={{ fontSize: 40, lineHeight: 1 }}>{st === 'folga' ? '🌿' : <BreadMark size={64} color={t.gold} />}</div>
          <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 24, color: t.text, letterSpacing: '-0.02em', marginTop: 10 }}>{st === 'folga' ? 'Hoje é sua folga' : 'Nenhuma entrega hoje'}</div>
          <div style={{ fontSize: 14, color: t.textSec, marginTop: 6, lineHeight: 1.45 }}>{st === 'folga' ? 'Descanse. Sua próxima rota é amanhã.' : 'Quando a operação atribuir entregas para você, elas aparecem aqui.'}</div>
        </div>
        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, borderTop: `1px solid ${t.border2}` }}>
          <Icon name="calendar" size={20} color={t.accent} />
          <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: t.textTer, fontWeight: 700 }}>PRÓXIMO TURNO</div><div style={{ fontSize: 14.5, fontWeight: 700, color: t.text }}>Quarta, 01/10 · ☀️ Manhã · 06:30</div></div>
        </div>
      </Card>
      {st === 'folga' && <CRWeekMini />}
      <CRBig variant="ghost" icon="dayoff" h={56} onClick={() => go('escala')}>Ver minha escala</CRBig>
    </>
  );
  else body = (
    <>
      {st === 'offline' && <CRSync kind="offline" />}
      {st === 'sending' && <CRSync kind="sending" />}
      {st === 'novas' && <CRSync kind="novas" />}
      {(st === 'notifOff' || pushOff) && (
        <Card pad={14} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: t.goldSoft, color: t.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="bell" size={20} /></div>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 14.5, color: t.text }}>Ativar notificações</div><div style={{ fontSize: 12.5, color: t.textSec }}>Receba entregas novas e avisos da operação.</div></div>
          <Switch on={false} onChange={() => {}} />
        </Card>
      )}
      <CRRouteCard rotas={rotas} onStart={() => go('start')} />
      <CRSeg value={tab} onChange={setTab} />
      {tab === 'lista' && (st === 'dois' ? (
        <>
          <CRTurnoSection r={manhaRota} list={manhaList} k="m" openKey={open} setOpen={setOpen} />
          <CRTurnoSection r={ROTAS_HOJE[1]} list={CR_TARDE} k="t" openKey={open} setOpen={setOpen} />
        </>
      ) : (
        <>
          <CRProgress feitas={feitas} total={tot} paes={st === 'pronta' ? 0 : st === 'encerrada' ? 64 : 38} />
          {manhaList.map((c, i) => <CRBuilding key={i} c={c} idx={i} open={open === 'm' + i} onToggle={() => setOpen(open === 'm' + i ? null : 'm' + i)} onStop={(p, c) => go('stop', { p, c })} />)}
          <div style={{ textAlign: 'center', fontSize: 12, color: t.textTer, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Icon name="refresh" size={13} />Puxe para atualizar</div>
        </>
      ))}
      {tab === 'rota' && <CRRouteTab st={routeSt || (st === 'pronta' ? 'pronta' : st === 'dois' ? 'dois' : 'emrota')} embedded />}
      {tab === 'realizadas' && <CRDoneList st={doneSt} embedded />}
      {st === 'encerrada' && tab === 'lista' && <CRNote ic="check" tone="good">Rota da manhã encerrada às 06:40. Bom trabalho!</CRNote>}
    </>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0 }}>
      <CRHeader onProfile={() => go('perfil')} onBadge={() => go('cracha')} foto={foto} />
      <div className="cr-col" style={{ flex: 1, overflowY: 'auto', padding: `0 16px ${dock === 'none' ? 24 : 110}px`, display: 'flex', flexDirection: 'column', gap: 12 }}>{body}</div>
      <CRDock mode={dock} count={`${feitas}/${tot}`} turno={st === 'dois' ? ROTAS_HOJE[1] : ROTAS_HOJE[0]} onScan={() => go('scan')} onCode={() => go('code')} onStart={() => go('start')} />
      {overlay}
    </div>
  );
}

Object.assign(window, { CR_H, crR, crN, crApto, crLoc, crIni, CRLabel, CRBig, CRIconBtn, CRSpin, CRSkel, CRTag, CRProof, CRCesta, CRPhotoPh, CRAvatar, CRSheet, CRToast, CRNote, CRSync, CRHeader, CRTurnoChip, CRRouteLine, CRRouteCard, CRSeg, CRProgress, CRDock, CRCheck, CRStopRow, CRAccess, CRBuilding, CRTurnoSection, CR_TARDE, crAllDone, CourierHome, CRWeekMini });
