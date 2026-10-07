/* Base compartilhada dos crachás v3/v4: tokens, relógio, QR de validação, moldura e quadro */
const CKT = THEMES.light;
const CK_HF = "'Bricolage Grotesque', system-ui, sans-serif";
const CK_MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const CK_P = { nome: ['Antônio', 'Ribeiro'], ini: 'AR', cpf: '***.456.789-**', desde: 'mar/2026', veiculo: 'Moto · ABC1D23', mat: '0427' };
const CK_DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'], CK_MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const ckPad = n => String(n).padStart(2, '0');

function ckClock(start = 36) {
  const [d, setD] = React.useState(() => new Date(2026, 8, 30, 5, 41, start));
  React.useEffect(() => { const id = setInterval(() => setD(x => new Date(x.getTime() + 1000)), 1000); return () => clearInterval(id); }, []);
  const tot = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  return { left: 30 - (tot % 30), win: Math.floor(tot / 30), dia: `${CK_DIAS[d.getDay()]}, ${d.getDate()} ${CK_MESES[d.getMonth()]}`, hm: `${ckPad(d.getHours())}:${ckPad(d.getMinutes())}`, s: ckPad(d.getSeconds()) };
}
const ckCode = win => ['7H2K', 'Q4MX', 'B9TR', 'K3WD', 'P6ZN', 'R2FJ', 'M8CV', 'T5LA'][win % 8];
const ckSeed = win => win * 7919 + 41;

/* QR visual. No app real: payload assinado = id do entregador + janela de 30 s */
function ckMods(seed) {
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  const N = 29, out = [];
  const res = (x, y) => (x < 8 && y < 8) || (x > 20 && y < 8) || (x < 8 && y > 20) || (x >= 20 && x <= 24 && y >= 20 && y <= 24) || (x >= 11 && x <= 17 && y >= 11 && y <= 17);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (res(x, y)) continue;
    if (y === 6 || x === 6) { if ((x + y) % 2 === 0) out.push([x, y]); continue; }
    if (rnd() > 0.5) out.push([x, y]);
  }
  return out;
}
function CKQR({ seed, size, ink = CKT.espresso, gap = '#fff' }) {
  const mods = React.useMemo(() => ckMods(seed), [seed]);
  const F = ({ x, y }) => <g><rect x={x + 0.5} y={y + 0.5} width="6" height="6" rx="1.8" fill="none" stroke={ink} strokeWidth="1" /><rect x={x + 2} y={y + 2} width="3" height="3" rx="1" fill={ink} /></g>;
  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <svg key={seed} viewBox="0 0 29 29" width={size} height={size} style={{ display: 'block', animation: 'ckQR .32s cubic-bezier(.2,.7,.2,1) both' }} role="img" aria-label="QR de validação do crachá">
        {mods.map(([x, y]) => <rect key={x + '.' + y} x={x + 0.1} y={y + 0.1} width="0.8" height="0.8" rx="0.28" fill={ink} />)}
        <F x={0} y={0} /><F x={22} y={0} /><F x={0} y={22} />
        <rect x="20.5" y="20.5" width="4" height="4" rx="1.2" fill="none" stroke={ink} strokeWidth="1" /><rect x="22" y="22" width="1" height="1" rx=".3" fill={ink} />
      </svg>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: size * 0.2, height: size * 0.2, borderRadius: size * 0.06, background: ink, display: 'grid', placeItems: 'center', boxShadow: `0 0 0 ${size * 0.02}px ${gap}` }}><BreadMark size={size * 0.12} color={CKT.gold} /></div>
    </div>
  );
}
function ckRing(w, r, i) {
  const x = i, y = i, W = w - 2 * i, cx = w / 2;
  return `M${cx},${y} H${x + W - r} A${r},${r} 0 0 1 ${x + W},${y + r} V${y + W - r} A${r},${r} 0 0 1 ${x + W - r},${y + W} H${x + r} A${r},${r} 0 0 1 ${x},${y + W - r} V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`;
}
/* Pequeno relógio circular de contagem */
function CKDial({ left, size = 18, color = CKT.gold, track = CKT.surface2 }) {
  const r = size / 2 - 2, c = 2 * Math.PI * r;
  return <svg width={size} height={size} aria-hidden="true" style={{ flexShrink: 0 }}><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth="2.5" /><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${(left / 30) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: left === 30 ? 'none' : 'stroke-dasharray 1s linear' }} /></svg>;
}
function CKCheck({ size = 64, bg = CKT.good, fg = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 76 76" aria-hidden="true" style={{ animation: 'ckPop .45s cubic-bezier(.2,.7,.2,1) both', flexShrink: 0 }}>
      <circle cx="38" cy="38" r="34" fill={bg} />
      <path d="M24 39.5l9.5 9.5L53 29.5" fill="none" stroke={fg} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" style={{ '--len': 46, strokeDasharray: 46, animation: 'ckDraw .45s .2s ease-out both' }} />
    </svg>
  );
}
function CKPhone({ children }) {
  return (
    <ThemeCtx.Provider value={CKT}>
      <div style={{ width: 390, height: 844, borderRadius: 44, overflow: 'hidden', background: CKT.appBg, display: 'flex', flexDirection: 'column', boxShadow: '0 0 0 10px #1E1207, 0 30px 60px -20px rgba(30,18,7,.5)' }}>
        <StatusBar time="5:41" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>{children}</div>
      </div>
    </ThemeCtx.Provider>
  );
}
const CK_FRAMES = [
  ['ativo', 'Ativo', 'Toque no QR para ampliar'],
  ['qr', 'QR ampliado', 'Para a câmera da portaria ler de longe'],
  ['validado', 'Validado pela portaria', 'Futuro perfil Portaria'],
  ['nofoto', 'Sem foto', 'Iniciais + aviso'],
  ['off', 'Desativado pelo admin', 'Sem QR, com saída para a operação'],
];
function CKBoard({ eyebrow, title, desc, render }) {
  return (
    <>
      <div style={{ position: 'absolute', left: 80, top: 50, width: 900 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.16em', color: CKT.accent }}>{eyebrow}</div>
        <div style={{ fontFamily: CK_HF, fontWeight: 800, fontSize: 40, letterSpacing: '-0.03em', color: CKT.text, marginTop: 6 }}>{title}</div>
        <div style={{ fontSize: 16, color: CKT.textSec, marginTop: 6, lineHeight: 1.5, maxWidth: 780 }}>{desc}</div>
      </div>
      {CK_FRAMES.map(([st, l, sub], i) => (
        <div key={st} style={{ position: 'absolute', left: 80 + i * 470, top: 220 }}>
          <div style={{ marginBottom: 22 }}><div style={{ fontSize: 15, fontWeight: 800, color: CKT.text }}>{l}</div><div style={{ fontSize: 13, color: CKT.textSec, fontWeight: 600, marginTop: 2 }}>{sub}</div></div>
          <CKPhone>{render(st, i)}</CKPhone>
        </div>
      ))}
    </>
  );
}
Object.assign(window, { CKT, CK_HF, CK_MONO, CK_P, ckClock, ckCode, ckSeed, CKQR, ckRing, CKDial, CKCheck, CKPhone, CKBoard });
