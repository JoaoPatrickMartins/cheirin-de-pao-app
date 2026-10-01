/* ============================================================
   Cheirin de Pão — Página "Sobre" · v2 (com movimento)
   Movimento (reveal, contagem, keyframes) · SBPhone · SobreHomeMock
   · SobreTopV2 (topo fixo no site) · SobreHeroV2 (celular com o app)
   Depende de screens-sobre.jsx e screens-sobre2.jsx (v1).
   ============================================================ */

const SB2_EASE = 'cubic-bezier(.16,1,.3,1)';
const SB2_CSS = `@keyframes sb2Up{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}@keyframes sb2Rise{from{opacity:0;transform:translateY(70px) scale(.97)}to{opacity:1;transform:none}}@keyframes sb2Push{0%{opacity:0;transform:translateY(-135%) scale(.96);animation-timing-function:cubic-bezier(.2,.9,.3,1.08)}14%{opacity:1;transform:none}86%{opacity:1;transform:none;animation-timing-function:cubic-bezier(.55,0,.75,.3)}100%{opacity:0;transform:translateY(-135%) scale(.96)}}@keyframes sb2Float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}@keyframes sb2Glow{0%,100%{opacity:.7;transform:scale(1)}50%{opacity:1;transform:scale(1.06)}}@keyframes sb2Fade{from{opacity:0}to{opacity:1}}.sb2 .sb2-tile{transition:transform .35s ${SB2_EASE},box-shadow .35s ${SB2_EASE}}.sb2 .sb2-tile:hover{transform:translateY(-3px);box-shadow:${THEMES.light.shadow}}@media (prefers-reduced-motion:reduce){.sb2 *{animation:none!important;transition:none!important}}`;

const SB2Motion = React.createContext(true);
const useSB2M = () => React.useContext(SB2Motion);
const sb2ReducedMotion = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Entra uma vez quando aparece na tela */
function useInView(ref, enabled) {
  const [v, setV] = React.useState(!enabled);
  React.useEffect(() => {
    if (!enabled) { setV(true); return; }
    const el = ref.current;
    if (!el) { setV(true); return; }
    /* IntersectionObserver + verificação por posição (rolagem, roda, toque e
       um timer), para nunca deixar conteúdo escondido */
    let done = false, io = null;
    const evs = ['scroll', 'resize', 'wheel', 'pointerup'];
    const stop = () => { done = true; io && io.disconnect(); evs.forEach(e => window.removeEventListener(e, check, true)); clearTimeout(t1); clearInterval(t2); };
    const check = () => {
      if (done) return;
      const r = el.getBoundingClientRect(), vh = window.innerHeight || 800, vw = window.innerWidth || 1200;
      if (r.top < vh * 0.94 && r.bottom > 0 && r.left < vw && r.right > 0) { stop(); setV(true); }
    };
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { stop(); setV(true); } }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
      io.observe(el);
    }
    evs.forEach(e => window.addEventListener(e, check, { capture: true, passive: true }));
    const t1 = setTimeout(check, 60), t2 = setInterval(check, 500);
    return stop;
  }, [enabled]);
  return v;
}
/* estilo de reveal: sobe 18 px + fade */
const sb2rv = (m, v, d = 0, y = 18) => (m ? { opacity: v ? 1 : 0, transform: v ? 'none' : `translateY(${y}px)`, transition: `opacity .7s ${SB2_EASE} ${d}ms, transform .9s ${SB2_EASE} ${d}ms` } : {});
/* keyframe de entrada (hero, no load) */
const sb2an = (m, name, dur, delay, ease = SB2_EASE) => (m ? { animation: `${name} ${dur}ms ${ease} ${delay}ms both` } : {});

function Reveal({ children, delay = 0, y = 18, style, ...rest }) {
  const m = useSB2M(); const ref = React.useRef(null); const v = useInView(ref, m);
  return <div ref={ref} style={{ ...style, ...sb2rv(m, v, delay, y) }} {...rest}>{children}</div>;
}

function useCountUp(target, run, dur = 1200, delay = 0) {
  const m = useSB2M();
  const [n, setN] = React.useState(m ? 0 : target);
  React.useEffect(() => {
    if (!m) { setN(target); return; }
    if (!run) return;
    let raf, t0;
    const to = setTimeout(() => {
      const step = ts => { if (!t0) t0 = ts; const p = Math.min(1, (ts - t0) / dur); setN(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(to); cancelAnimationFrame(raf); };
  }, [run, target, m]);
  return n;
}

/* ---------- Moldura de celular (tela nativa 390×844, escalada) ---------- */
function SBPhone({ w = 300, children, style }) {
  const pad = Math.round(w * 0.032);
  const sw = w - pad * 2, sh = Math.round(sw * 844 / 390), k = sw / 390;
  return (
    <div style={{ width: w, height: sh + pad * 2, borderRadius: w * 0.16, background: '#160C04', padding: pad, position: 'relative', flexShrink: 0, boxShadow: '0 50px 90px -30px rgba(0,0,0,0.6), 0 20px 40px -20px rgba(0,0,0,0.4), inset 0 0 0 1.5px rgba(250,245,236,0.10)', ...style }}>
      <div style={{ width: sw, height: sh, borderRadius: w * 0.13, overflow: 'hidden', position: 'relative', background: THEMES.light.appBg }}>
        <div style={{ width: 390, height: 844, transform: `scale(${k})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>{children}</div>
        <div aria-hidden="true" style={{ position: 'absolute', top: sw * 0.03, left: '50%', transform: 'translateX(-50%)', width: sw * 0.3, height: sw * 0.085, borderRadius: 99, background: '#0B0602' }} />
      </div>
    </div>
  );
}

/* Tab bar igual à do app real (Pãezins com o BreadMark) */
function SB2Tabs({ active }) {
  const t = THEMES.light;
  const tabs = [['home', 'Início'], ['calendar', 'Agenda'], ['mark', 'Pãezins'], ['basket', 'Cestinha'], ['user', 'Perfil']];
  return (
    <div style={{ display: 'flex', borderTop: `1px solid ${t.border2}`, background: t.surface, padding: '10px 4px 26px', flexShrink: 0 }}>
      {tabs.map(([ic, l]) => {
        const on = l === active; const c = on ? t.accent : t.textSec;
        return <div key={l} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: c }}>{ic === 'mark' ? <BreadMark size={26} color={c} side={1} /> : <Icon name={ic} size={23} stroke={on ? 2.2 : 1.9} />}<span style={{ fontSize: 11, fontWeight: on ? 800 : 600 }}>{l}</span></div>;
      })}
    </div>
  );
}

/* Push "Seu pão chegou!" que desce no topo da tela */
function SB2Push({ m, delay }) {
  const t = THEMES.light;
  return (
    <div style={{ position: 'absolute', top: 54, left: 10, right: 10, zIndex: 5, ...(m ? { animation: `sb2Push 5200ms linear ${delay}ms both` } : {}) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 24, background: m ? 'rgba(250,245,236,0.92)' : t.surfaceAlt, backdropFilter: m ? 'blur(18px) saturate(1.4)' : 'none', WebkitBackdropFilter: m ? 'blur(18px) saturate(1.4)' : 'none', boxShadow: '0 18px 40px -16px rgba(30,18,7,0.45), 0 0 0 1px rgba(43,26,12,0.06)' }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: t.espresso, display: 'grid', placeItems: 'center', flexShrink: 0 }}><BreadMark size={28} color={t.gold} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', fontSize: 11.5, fontWeight: 700, color: t.textSec, letterSpacing: '0.04em' }}><span style={{ flex: 1 }}>CHEIRIN DE PÃO</span><span style={{ letterSpacing: 0 }}>agora</span></div>
          <div style={{ fontWeight: 800, fontSize: 15, color: t.text, marginTop: 2 }}>Seu pão chegou!</div>
          <div style={{ fontSize: 13.5, color: t.text, marginTop: 1 }}>Está pendurado no gancho da porta.</div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Tela inicial do app (igual à Home real) ---------- */
/* recorte de foto do print do Além do Pãozin (763×1600) */
function SB2Crop({ x, y, w, h, bw, bh, style }) {
  const k = bw / w;
  return <div style={{ width: bw, height: bh, borderRadius: 14, backgroundImage: 'url(assets/app-alem-do-paozin.jpg)', backgroundRepeat: 'no-repeat', backgroundSize: `${763 * k}px auto`, backgroundPosition: `${-x * k}px ${-y * (bh / h)}px`, flexShrink: 0, ...style }} />;
}
function SobreHomeMock({ m, run = true }) {
  const t = THEMES.light;
  const n = useCountUp(38, run, 1400, 700);
  const a = d => ({ flexShrink: 0, ...sb2an(m, 'sb2Up', 800, d) });
  const card = { background: t.surface, borderRadius: 22, boxShadow: t.shadowSoft, border: `1px solid ${t.border2}`, overflow: 'hidden' };
  const darkTop = { background: t.espresso, color: SB_DK.text, position: 'relative', overflow: 'hidden' };
  const mark = (sz, r, b) => <div aria-hidden="true" style={{ position: 'absolute', right: r, bottom: b, opacity: 0.16 }}><BreadMark size={sz} color={t.gold} /></div>;
  const atalhos = [['calendar', 'Agenda', 'Semanal'], ['bag', 'Avulso', 'Pedir hoje'], ['clock', 'Histórico', 'Pedidos']];
  const prods = [
    { crop: { x: 60, y: 569, w: 289, h: 256 }, badge: ['plus', 'NOVO'], nome: 'Pão Francês', preco: 'R$ 1,20' },
    { crop: { x: 414, y: 569, w: 289, h: 256 }, nome: 'Pão Doce de Creme', preco: 'R$ 1,90' },
    { crop: { x: 430, y: 1303, w: 211, h: 187 }, badge: ['tag', 'PROMO'], nome: 'Pão Doce de Goiaba', preco: 'R$ 1,90' },
  ];
  return (
    <ThemeCtx.Provider value={t}>
      <div style={{ width: 390, height: 844, background: t.appBg, display: 'flex', flexDirection: 'column', position: 'relative', fontFamily: SB_B, color: t.text }}>
        <StatusBar time="7:14" />
        {m && <SB2Push m={m} delay={2300} />}
        <div style={{ flex: 1, padding: '4px 18px 0', display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, ...a(450) }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, background: t.espresso, display: 'grid', placeItems: 'center', flexShrink: 0 }}><BreadMark size={28} color={t.gold} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: t.textSec }}>Bom dia, Marina</div>
              <div style={{ fontWeight: 800, fontSize: 16.5, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Reserva do Curumim · 405</div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: t.surface, boxShadow: t.shadowSoft, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="bell" size={20} /></div>
          </div>
          <div style={{ ...card, ...a(560) }}>
            <div style={{ ...darkTop, padding: '20px 20px 18px' }}>
              {mark(150, -22, -52)}
              <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.12em', color: SB_DK.textSec }}>VOCÊ TEM</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span style={{ fontFamily: SB_H, fontWeight: 800, fontSize: 52, lineHeight: 1, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: t.gold }}>pãezins</span>
              </div>
              <div style={{ fontSize: 12.5, color: SB_DK.textSec, marginTop: 10 }}>Rende ~9 dias no seu ritmo atual</div>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: 12 }}>
              <div style={{ flex: 1.6, height: 46, borderRadius: 14, background: t.gold, color: t.onGold, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 700, fontSize: 14.5 }}><Icon name="plus" size={17} stroke={2.4} />Comprar pãezins</div>
              <div style={{ flex: 1, height: 46, borderRadius: 14, background: t.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontWeight: 700, fontSize: 14.5 }}><Icon name="clock" size={17} stroke={2.2} />Extrato</div>
            </div>
          </div>
          <div style={{ ...card, ...a(660) }}>
            <div style={{ ...darkTop, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 13 }}>
              {mark(96, -10, -46)}
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(227,172,63,0.16)', color: t.gold, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="scissors" size={20} /></div>
              <div style={{ position: 'relative' }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.12em', color: t.gold }}>FIQUE DE OLHO NO CORTE</div>
                <div style={{ fontWeight: 800, fontSize: 16, marginTop: 2 }}>Garanta sua próxima fornada</div>
              </div>
            </div>
            <div style={{ padding: '11px 16px 13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: t.accent, display: 'flex' }}><Icon name="scissors" size={14} stroke={2.2} /></span>
                <span style={{ flex: 1, fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: t.accent }}>CORTE</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec }}>Manhã · Tarde</span>
              </div>
              <div style={{ fontSize: 12, color: t.textSec, marginTop: 5 }}>Peça até o horário de corte para a próxima entrega.</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, ...a(760) }}>
            {atalhos.map(([ic, h, s]) => (
              <div key={h} style={{ ...card, padding: '13px 6px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: t.surface2, color: t.accent, display: 'grid', placeItems: 'center' }}><Icon name={ic} size={19} /></div>
                <div style={{ fontWeight: 800, fontSize: 13.5, marginTop: 8 }}>{h}</div>
                <div style={{ fontSize: 11, color: t.textSec, marginTop: 1 }}>{s}</div>
              </div>
            ))}
          </div>
          <div style={{ ...a(860) }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ color: t.accent, display: 'flex', marginTop: 2 }}><Icon name="basket" size={18} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SB_H, fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em' }}>Além do Pãozin</div>
                <div style={{ fontSize: 11.5, color: t.textSec, marginTop: 1 }}>Pague com pãezins e economize até 17%</div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.accent, marginTop: 3 }}>Ver tudo</span>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12, marginRight: -18 }}>
              {prods.map(p => (
                <div key={p.nome} style={{ ...card, width: 128, flexShrink: 0, padding: 6 }}>
                  <div style={{ position: 'relative' }}>
                    <SB2Crop {...p.crop} bw={116} bh={102} />
                    {p.badge && <span style={{ position: 'absolute', top: 6, left: 6, display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 7px', borderRadius: 99, background: t.espresso, color: t.gold, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.04em' }}><Icon name={p.badge[0]} size={10} stroke={2.6} />{p.badge[1]}</span>}
                  </div>
                  <div style={{ padding: '8px 4px 4px' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</div>
                    <div style={{ fontFamily: SB_H, fontWeight: 800, fontSize: 15, marginTop: 3 }}>{p.preco}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <SB2Tabs active="Início" />
      </div>
    </ThemeCtx.Provider>
  );
}

/* ---------- S1 v2 · topo (fixo e sólido ao rolar, no site) ---------- */
function SobreTopV2() {
  const { bp, sticky } = useSB(); const m = bp === 'm'; const t = THEMES.light; const mo = useSB2M();
  const [sc, setSc] = React.useState(false);
  React.useEffect(() => {
    if (!sticky) return;
    /* sticky = true (rola a janela) ou ref de um contêiner que rola (prévia mobile) */
    const el = sticky && sticky.current ? sticky.current : null;
    const tgt = el || window;
    const on = () => setSc((el ? el.scrollTop : window.scrollY) > 24);
    on(); tgt.addEventListener('scroll', on, { passive: true });
    return () => tgt.removeEventListener('scroll', on);
  }, [sticky]);
  const h = m ? (sc ? 58 : 64) : (sc ? 68 : 84);
  return (
    <header style={{ position: sticky ? 'fixed' : 'absolute', top: 0, left: 0, right: 0, zIndex: 30, color: SB_DK.text, background: sc ? 'rgba(30,18,7,0.86)' : 'rgba(30,18,7,0)', backdropFilter: sc ? 'blur(16px) saturate(1.3)' : 'none', WebkitBackdropFilter: sc ? 'blur(16px) saturate(1.3)' : 'none', boxShadow: sc ? '0 1px 0 rgba(250,245,236,0.08), 0 12px 30px -18px rgba(0,0,0,0.6)' : 'none', transition: `background .35s, box-shadow .35s`, ...sb2an(mo, 'sb2Fade', 700, 100) }}>
      <SBWrap style={{ height: h, display: 'flex', alignItems: 'center', gap: 8, transition: `height .35s ${SB2_EASE}` }}>
        <SBA href="/sobre/" aria-label="Cheirin de Pão" style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, textDecoration: 'none' }}>
          <BreadMark size={m ? 30 : 38} color={t.gold} />
          <span style={{ fontFamily: SB_H, fontWeight: 700, fontSize: m ? 16.5 : 20, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>Cheirin de Pão</span>
        </SBA>
        <div style={{ flex: 1 }} />
        <nav aria-label="Conta" style={{ display: 'flex', alignItems: 'center', gap: m ? 2 : 10 }}>
          <SBA href="/login" route="login" className="sb-link on-dark" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: m ? '0 8px' : '0 14px', fontSize: m ? 14.5 : 15.5 }}>Entrar</SBA>
          <SBBtn href="/register" route="register" variant="gold" size="sm" style={m ? { padding: '0 14px', fontSize: 13.5 } : {}}>Criar conta</SBBtn>
        </nav>
      </SBWrap>
    </header>
  );
}

/* ---------- S2 v2 · hero com o app ---------- */
function SobreHeroV2({ turnos }) {
  const m = useSB().bp === 'm'; const d = useSBD(); const t = THEMES.light; const mo = useSB2M();
  const frase = sobreTurnoFrase(turnos);
  const pw = m ? 286 : 336;
  return (
    <section aria-labelledby="sb-h1" style={{ position: 'relative', background: t.espresso, color: SB_DK.text, overflow: 'hidden' }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 50% -10%, rgba(227,172,63,0.18), transparent 60%)' }} />
      <SBWrap style={{ position: 'relative', display: 'grid', gridTemplateColumns: m ? 'minmax(0,1fr)' : 'minmax(0,1.1fr) minmax(0,0.9fr)', gap: m ? 40 : 48, alignItems: m ? 'start' : 'center', paddingTop: m ? 64 + 28 : 84 + 40 }}>
        <div style={{ paddingBottom: m ? 0 : 120 }}>
          <div style={sb2an(mo, 'sb2Up', 900, 150)}><SBEyebrow tone="dark">Pão fresco na porta</SBEyebrow></div>
          <h1 id="sb-h1" style={{ fontFamily: SB_H, fontWeight: 800, fontSize: d.h1, lineHeight: 1.02, letterSpacing: '-0.03em', marginTop: m ? 16 : 22, textWrap: 'balance', ...sb2an(mo, 'sb2Up', 1000, 250) }}>Pão fresquinho na sua porta.</h1>
          <p style={{ fontSize: d.lead, lineHeight: 1.55, color: SB_DK.textSec, marginTop: m ? 16 : 24, maxWidth: '31em', textWrap: 'pretty', ...sb2an(mo, 'sb2Up', 1000, 380) }}>
            O Cheirin de Pão entrega pão fresco na porta do seu apartamento, em condomínios parceiros. Você monta a agenda uma vez e o pão chega sozinho — <span key={frase} data-sb-turno="" style={{ display: 'inline', ...sb2an(mo, 'sb2Fade', 600, 0) }}>{frase}</span>.
          </p>
          <div style={{ display: 'flex', flexDirection: m ? 'column' : 'row', gap: 12, marginTop: m ? 26 : 36, ...sb2an(mo, 'sb2Up', 1000, 500) }}>
            <SBBtn href="/register" route="register" variant="gold" full={m}>Criar minha conta</SBBtn>
            <SBBtn href="/login" route="login" variant="ghostDark" full={m}>Já tenho conta · Entrar</SBBtn>
          </div>
        </div>
        <div aria-hidden="true" style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignSelf: 'end', height: m ? 430 : 600, marginTop: m ? 4 : 0 }}>
          <div style={{ position: 'absolute', left: '50%', top: m ? 40 : 60, width: pw * 1.9, height: pw * 1.9, marginLeft: -pw * 0.95, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(227,172,63,0.30), rgba(227,172,63,0.08) 55%, transparent 72%)', ...(mo ? { animation: 'sb2Glow 9s ease-in-out infinite' } : {}) }} />
          <div style={{ position: 'relative', ...sb2an(mo, 'sb2Rise', 1300, 300) }}>
            <div style={mo ? { animation: 'sb2Float 7s ease-in-out 1.8s infinite' } : null}>
              <SBPhone w={pw}><SobreHomeMock m={mo} /></SBPhone>
            </div>
          </div>
        </div>
      </SBWrap>
    </section>
  );
}

Object.assign(window, { SB2Crop, SB2_EASE, SB2_CSS, SB2Motion, useSB2M, sb2ReducedMotion, useInView, sb2rv, sb2an, Reveal, useCountUp, SBPhone, SB2Tabs, SB2Push, SobreHomeMock, SobreTopV2, SobreHeroV2 });
