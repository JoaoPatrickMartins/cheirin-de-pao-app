/* ============================================================
   Cheirin de Pão — Sistema de marca + primitivas de UI
   ============================================================ */

const THEMES = {
  light: {
    name: 'light',
    bg: '#F3E9D6',
    appBg: '#FAF5EC',
    surface: '#FFFFFF',
    surfaceAlt: '#FBF6EC',
    surface2: '#F4EBDA',
    text: '#241608',
    textSec: '#7C6A50',
    textTer: '#A89A82',
    border: 'rgba(43,26,12,0.10)',
    border2: 'rgba(43,26,12,0.06)',
    accent: '#B0702A',
    gold: '#E3AC3F',
    goldSoft: '#F3DDA6',
    espresso: '#1E1207',
    primaryBtn: '#1E1207',
    primaryBtnText: '#FBF3E4',
    onGold: '#1E1207',
    good: '#3E7C53',
    goodSoft: '#DCEBDF',
    warn: '#B0702A',
    shadow: '0 1px 2px rgba(43,26,12,0.05), 0 10px 30px -12px rgba(43,26,12,0.22)',
    shadowSoft: '0 1px 2px rgba(43,26,12,0.05), 0 4px 14px -8px rgba(43,26,12,0.18)',
    statusBar: '#241608',
  },
  dark: {
    name: 'dark',
    bg: '#150D04',
    appBg: '#1E1207',
    surface: '#2A1B0E',
    surfaceAlt: '#241608',
    surface2: '#33230F',
    text: '#FAF5EC',
    textSec: '#C7B595',
    textTer: '#8B7A60',
    border: 'rgba(250,245,236,0.13)',
    border2: 'rgba(250,245,236,0.07)',
    accent: '#E3AC3F',
    gold: '#E3AC3F',
    goldSoft: '#5A4218',
    espresso: '#1E1207',
    primaryBtn: '#E3AC3F',
    primaryBtnText: '#1E1207',
    onGold: '#1E1207',
    good: '#7FC893',
    goodSoft: '#23381F',
    warn: '#E3AC3F',
    shadow: '0 1px 2px rgba(0,0,0,0.5), 0 12px 34px -12px rgba(0,0,0,0.6)',
    shadowSoft: '0 1px 2px rgba(0,0,0,0.45), 0 6px 18px -10px rgba(0,0,0,0.55)',
    statusBar: '#FAF5EC',
  },
};

const ThemeCtx = React.createContext(THEMES.light);
const useT = () => React.useContext(ThemeCtx);

/* ---------- O símbolo: arco do pão + três ondas de aroma ---------- */
function BreadMark({ size = 100, color = '#E3AC3F', reduced = false, side = 0.5, strong = 1 }) {
  const s = size;
  if (reduced) {
    return (
      <svg width={s} height={s} viewBox="0 0 100 100" role="img" aria-label="Cheirin de Pão">
        <path d="M20 80 C20 56 33 46 50 46 C67 46 80 56 80 80" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" />
        <path d="M50 46 C44 36 56 31 50 20" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={s} height={s} viewBox="0 0 100 100" role="img" aria-label="Cheirin de Pão">
      <path d="M22 80 C22 58 34 48 50 48 C66 48 78 58 78 80" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" opacity={strong} />
      <path d="M50 48 C45 39 55 34 50 24" fill="none" stroke={color} strokeWidth="5.5" strokeLinecap="round" opacity={strong} />
      <path d="M36 52 C32 45 39 41 36 34" fill="none" stroke={color} strokeWidth="4.5" strokeLinecap="round" opacity={side} />
      <path d="M64 52 C60 45 67 41 64 34" fill="none" stroke={color} strokeWidth="4.5" strokeLinecap="round" opacity={side} />
    </svg>
  );
}

function Lockup({ size = 22, color, sub, align = 'left' }) {
  const t = useT();
  const c = color || t.text;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: align === 'center' ? 'center' : 'flex-start' }}>
      <BreadMark size={size * 1.7} color={t.gold} />
      <div>
        <div style={{ fontFamily: 'Bricolage Grotesque, serif', fontWeight: 700, fontSize: size, color: c, lineHeight: 1, letterSpacing: '-0.02em' }}>Cheirin de Pão</div>
        {sub && <div style={{ fontSize: size * 0.42, letterSpacing: '0.22em', color: t.accent, marginTop: 4, fontWeight: 600 }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ---------- Ícones (traço, 24x24, currentColor) ---------- */
const Ic = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5',
  bag: 'M6 8h12l-1 12H7L6 8Zm3 0a3 3 0 0 1 6 0',
  calendar: 'M4 6.5h16v14H4zM4 10h16M8 3v4M16 3v4',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20c0-3.5 3-6 7-6s7 2.5 7 6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 12.5 10 17.5 19.5 7',
  chevR: 'M9 6l6 6-6 6',
  chevL: 'M15 6l-6 6 6 6',
  chevD: 'M6 9l6 6 6-6',
  arrowL: 'M19 12H5M11 6l-6 6 6 6',
  arrowU: 'M12 19V5M6 11l6-6 6 6',
  bell: 'M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 20a2 2 0 0 0 4 0',
  pin: 'M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  building: 'M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M15 21V9h3a1 1 0 0 1 1 1v11M3 21h18M8 8h1M11 8h1M8 12h1M11 12h1M8 16h1M11 16h1',
  truck: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  x: 'M6 6l12 12M18 6 6 18',
  edit: 'M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4',
  card: 'M3 7h18v10H3zM3 11h18M7 15h3',
  coin: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v10M9.5 9.2c0-1.1 1.1-1.7 2.5-1.7s2.5.6 2.5 1.6c0 2.4-5 1.2-5 3.6 0 1 1.1 1.7 2.5 1.7s2.5-.6 2.5-1.6',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  phone: 'M5 4h4l1.5 5-2 1.5a12 12 0 0 0 5 5l1.5-2 5 1.5v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  gift: 'M4 11h16v9H4zM4 11V8h16v3M12 8V20M12 8C12 8 10 4 7.5 5S9 8 12 8ZM12 8s2-4 4.5-3-1.5 3-4.5 3Z',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.6 1-5.8L3.5 9.7l5.9-.9L12 3.5Z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13a7.8 7.8 0 0 0 0-2l2-1.5-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1l-.4-2.6h-3.8l-.4 2.6a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4L4.6 11a7.8 7.8 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1l.4 2.6h3.8l.4-2.6a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4L19.4 13Z',
  wallet: 'M3 7h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 0V6a1 1 0 0 1 1-1h12M16 13h2',
  trend: 'M3 17l5-5 4 3 6-7M21 8h-4M21 8v4',
  logout: 'M15 12H4M11 8l-4 4 4 4M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5',
  repeat: 'M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  doc: 'M7 3h7l5 5v13H7zM14 3v5h5M9.5 13h5M9.5 16.5h5',
  percent: 'M19 5 5 19M8.5 6.5a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM19.5 17.5a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  ban: 'M5.6 5.6l12.8 12.8M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8 17h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  factory: 'M3 21V10l6 4V10l6 4V8l6-2v15zM3 21h18M8 17h1M13 17h1M18 17h1',
  scissors: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.1 8.1 20 18M14 9.5 20 6M8.1 15.9 12 13',
  refresh: 'M21 12a9 9 0 1 1-3-6.7M21 4v4h-4',
  users: 'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 20c0-3.3 3-5.5 7-5.5s7 2.2 7 5.5M16 4.5a4 4 0 0 1 0 7.5M18 14.5c2.5.6 4 2.2 4 4.5',
  power: 'M12 3v9M6.3 7.3a8 8 0 1 0 11.4 0',
};
function Icon({ name, size = 22, stroke = 1.9, color = 'currentColor', style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d={Ic[name]} />
    </svg>
  );
}

/* ---------- Status bar (sem moldura) ---------- */
function StatusBar({ time = '7:14' }) {
  const t = useT();
  const c = t.statusBar;
  return (
    <div style={{ height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', color: c, fontWeight: 700, fontSize: 15 }}>
      <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif' }}>{time}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="18" height="12" viewBox="0 0 18 12" fill={c}><rect x="0" y="7" width="3" height="5" rx="1" /><rect x="5" y="4.5" width="3" height="7.5" rx="1" /><rect x="10" y="2" width="3" height="10" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
        <svg width="17" height="12" viewBox="0 0 17 12" fill="none" stroke={c} strokeWidth="1.4"><path d="M1 6.5C3 3 6 1.5 8.5 1.5S14 3 16 6.5" /><path d="M3.5 8.5C5 6.5 7 5.5 8.5 5.5S12 6.5 13.5 8.5" opacity="0.9" /><circle cx="8.5" cy="10.6" r="0.9" fill={c} stroke="none" /></svg>
        <svg width="26" height="13" viewBox="0 0 26 13" fill="none"><rect x="0.6" y="0.6" width="22" height="11.8" rx="3" stroke={c} strokeOpacity="0.5" /><rect x="2.2" y="2.2" width="17" height="8.6" rx="1.6" fill={c} /><rect x="23.5" y="4" width="2" height="5" rx="1" fill={c} fillOpacity="0.5" /></svg>
      </div>
    </div>
  );
}

/* ---------- Botões ---------- */
function Btn({ children, onClick, variant = 'primary', full, size = 'md', icon, disabled, style }) {
  const t = useT();
  const [h, setH] = React.useState(false);
  const pads = { sm: '9px 14px', md: '13px 18px', lg: '16px 22px' };
  const fs = { sm: 13, md: 15, lg: 16 };
  let bg, color, border = 'none';
  if (variant === 'primary') { bg = t.primaryBtn; color = t.primaryBtnText; }
  else if (variant === 'gold') { bg = t.gold; color = t.onGold; }
  else if (variant === 'ghost') { bg = 'transparent'; color = t.text; border = `1.5px solid ${t.border}`; }
  else if (variant === 'soft') { bg = t.surface2; color = t.text; }
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        width: full ? '100%' : 'auto', padding: pads[size], fontSize: fs[size], fontWeight: 700,
        fontFamily: 'Hanken Grotesk, sans-serif', background: bg, color, border, borderRadius: 16,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1, whiteSpace: 'nowrap',
        transform: h && !disabled ? 'translateY(-1px)' : 'none', transition: 'transform .15s, filter .15s',
        filter: h && !disabled ? 'brightness(1.05)' : 'none', letterSpacing: '-0.01em', ...style,
      }}>
      {icon && <Icon name={icon} size={fs[size] + 3} stroke={2.2} />}
      {children}
    </button>
  );
}

function Card({ children, style, onClick, pad = 16 }) {
  const t = useT();
  return (
    <div onClick={onClick} style={{ background: t.surface, borderRadius: 22, border: `1px solid ${t.border2}`, boxShadow: t.shadowSoft, padding: pad, ...style }}>
      {children}
    </div>
  );
}

function Pill({ children, tone = 'neutral', style }) {
  const t = useT();
  const map = {
    neutral: { bg: t.surface2, c: t.textSec },
    gold: { bg: t.goldSoft, c: t.accent },
    good: { bg: t.goodSoft, c: t.good },
  };
  const m = map[tone];
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: m.bg, color: m.c, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.01em', ...style }}>{children}</span>;
}

/* ---------- Campo de formulário ---------- */
function Field({ label, value, onChange, placeholder, type = 'text', icon, hint, suffix }) {
  const t = useT();
  const [f, setF] = React.useState(false);
  return (
    <label style={{ display: 'block' }}>
      {label && <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec, marginBottom: 7, letterSpacing: '0.01em' }}>{label}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: t.surfaceAlt, border: `1.5px solid ${f ? t.accent : t.border}`, borderRadius: 14, padding: '12px 14px', transition: 'border-color .15s' }}>
        {icon && <Icon name={icon} size={18} color={t.textTer} stroke={2} />}
        <input value={value} onChange={e => onChange && onChange(e.target.value)} placeholder={placeholder} type={type}
          onFocus={() => setF(true)} onBlur={() => setF(false)}
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: t.text, fontFamily: 'Hanken Grotesk, sans-serif', fontWeight: 500, minWidth: 0 }} />
        {suffix && <span style={{ fontSize: 13, color: t.textTer, fontWeight: 600 }}>{suffix}</span>}
      </div>
      {hint && <div style={{ fontSize: 11.5, color: t.textTer, marginTop: 6 }}>{hint}</div>}
    </label>
  );
}

/* ---------- App bar interna ---------- */
function AppBar({ title, onBack, right }) {
  const t = useT();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 20px 14px' }}>
      {onBack && (
        <button onClick={onBack} style={{ background: t.surface2, border: 'none', width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', cursor: 'pointer', color: t.text, flexShrink: 0 }}>
          <Icon name="arrowL" size={20} />
        </button>
      )}
      <div style={{ flex: 1, fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 21, letterSpacing: '-0.02em', color: t.text }}>{title}</div>
      {right}
    </div>
  );
}

/* ---------- Stepper de quantidade ---------- */
function Stepper({ value, onChange, min = 0, max = 99, accent }) {
  const t = useT();
  const a = accent || t.accent;
  const btn = (dir, name, en) => (
    <button onClick={() => en && onChange(value + dir)} disabled={!en}
      style={{ width: 34, height: 34, borderRadius: 11, border: `1.5px solid ${t.border}`, background: t.surface, color: en ? t.text : t.textTer, display: 'grid', placeItems: 'center', cursor: en ? 'pointer' : 'default', opacity: en ? 1 : 0.5 }}>
      <Icon name={name} size={16} stroke={2.4} />
    </button>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {btn(-1, 'minus', value > min)}
      <span style={{ minWidth: 26, textAlign: 'center', fontWeight: 800, fontSize: 18, fontFamily: 'Bricolage Grotesque, sans-serif', color: value > 0 ? a : t.textTer }}>{value}</span>
      {btn(1, 'plus', value < max)}
    </div>
  );
}

/* ---------- Switch (toggle) ---------- */
function Switch({ on, onChange }) {
  const t = useT();
  return (
    <button onClick={() => onChange(!on)} style={{ width: 48, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer', background: on ? t.gold : t.border, padding: 3, display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'background .2s', flexShrink: 0 }}>
      <span style={{ width: 22, height: 22, borderRadius: 999, background: on ? t.onGold : t.surface, boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'all .2s' }} />
    </button>
  );
}

/* ---------- Linha de propriedade (label + valor) ---------- */
function Row({ label, value, icon }) {
  const t = useT();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0' }}>
      {icon && <Icon name={icon} size={18} color={t.textTer} />}
      <span style={{ fontSize: 13.5, color: t.textSec, fontWeight: 600 }}>{label}</span>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 13.5, color: t.text, fontWeight: 700, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

Object.assign(window, { THEMES, ThemeCtx, useT, BreadMark, Lockup, Icon, Ic, StatusBar, Btn, Card, Pill, Field, AppBar, Stepper, Switch, Row });
