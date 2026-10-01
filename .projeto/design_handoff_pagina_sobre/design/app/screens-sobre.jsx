/* ============================================================
   Cheirin de Pão — Página pública "Sobre" (/sobre/)
   Base + S1 Topo · S2 Hero · S3 Como funciona · S4 Pãezins, combos
   e agenda · S5 Gancho · S6 Além do Pãozin.
   S7–S10, SobrePage e kit: screens-sobre2.jsx
   ============================================================ */

/* Dados dinâmicos (mock). No HTML estático vai o texto NEUTRO;
   o JS troca a frase do turno e o item 8 do FAQ por cima. */
const SOBRE_CFG = {
  turnos: { manha: true, tarde: true },      // da API · null = neutro
  indique: { ativo: true, recompensa: 5, bonusAmigo: 2 },
  email: 'cheirindepao.contato@gmail.com',
  whatsapp: '5511900000000',                  // placeholder · vem da config
};

const SB_H = 'Bricolage Grotesque, sans-serif';
const SB_B = 'Hanken Grotesk, sans-serif';
const SB_DK = THEMES.dark; // texto sobre o espresso: text #FAF5EC · textSec #C7B595
const SB_DIMS = {
  m: { px: 20, secY: 64, h1: 38, h2: 27, h3: 18, body: 15.5, lead: 16.5 },
  d: { px: 40, secY: 104, h1: 62, h2: 40, h3: 21, body: 17, lead: 19.5 },
};
const SobreCtx = React.createContext({ bp: 'm', go: null });
const useSB = () => React.useContext(SobreCtx);
const useSBD = () => SB_DIMS[useSB().bp];
const sbPz = n => (n === 1 ? '1 pãozin' : `${n} pãezins`);

function sobreTurnoFrase(turnos) {
  if (!turnos || (!turnos.manha && !turnos.tarde)) return 'nos dias que você escolher';
  if (turnos.manha && turnos.tarde) return 'de manhã ou à tarde, no turno que você escolher';
  return turnos.manha ? 'pela manhã' : 'à tarde';
}

const SB_CSS = `.sb h1,.sb h2,.sb h3,.sb p,.sb ul,.sb ol,.sb li{margin:0;padding:0}.sb ul,.sb ol{list-style:none}.sb a{color:inherit}.sb a:focus-visible,.sb button:focus-visible{outline:3px solid ${THEMES.light.gold};outline-offset:3px;border-radius:12px}.sb .sb-link{text-decoration:none;font-weight:700}.sb .sb-u{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:4px;text-decoration-color:${THEMES.light.accent}}.sb .sb-link:hover{color:${THEMES.light.accent}}.sb .sb-link.on-dark .sb-u{text-decoration-color:${THEMES.light.gold}}.sb .sb-link.on-dark:hover{color:${THEMES.light.gold}}`;

/* ---------- Primitivas da página ---------- */
function SBA({ href, route, children, className, style, ...rest }) {
  const { go } = useSB();
  return <a href={href} className={className} onClick={e => { if (go) { e.preventDefault(); if (route) go(route); } }} style={style} {...rest}>{children}</a>;
}

/* Link de texto (≥ 44 px de alvo) */
function SBLink({ href, route, dark, icon, children, style }) {
  return (
    <SBA href={href} route={route} className={'sb-link' + (dark ? ' on-dark' : '')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 44, fontSize: 15, ...style }}>
      {icon && <Icon name={icon} size={17} stroke={2.1} />}<span className="sb-u">{children}</span>
    </SBA>
  );
}

/* Btn como <a> (mesma geometria do Btn de brand.jsx) */
function SBBtn({ href, route, variant = 'primary', size = 'lg', icon, full, children, style }) {
  const t = THEMES.light;
  const [h, setH] = React.useState(false);
  const hs = { sm: 44, md: 48, lg: 54 }, fs = { sm: 14, md: 15, lg: 16 }, px = { sm: 16, md: 18, lg: 24 };
  const v = {
    primary: [t.primaryBtn, t.primaryBtnText, 'none'],
    gold: [t.gold, t.onGold, 'none'],
    ghost: ['transparent', t.text, `1.5px solid ${t.border}`],
    ghostDark: ['transparent', SB_DK.text, '1.5px solid rgba(250,245,236,0.28)'],
  }[variant];
  return (
    <SBA href={href} route={route} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display: full ? 'flex' : 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: hs[size], padding: `0 ${px[size]}px`, fontSize: fs[size], fontWeight: 700, fontFamily: SB_B, background: v[0], color: v[1], border: v[2], borderRadius: 16, textDecoration: 'none', whiteSpace: 'nowrap', letterSpacing: '-0.01em', boxSizing: 'border-box', transform: h ? 'translateY(-1px)' : 'none', filter: h ? 'brightness(1.05)' : 'none', transition: 'transform .15s, filter .15s', ...style }}>
      {icon && <Icon name={icon} size={fs[size] + 3} stroke={2.2} />}{children}
    </SBA>
  );
}

function SBWrap({ children, style, ...rest }) {
  const { bp } = useSB(); const d = SB_DIMS[bp];
  return <div style={{ width: '100%', maxWidth: bp === 'd' ? 1080 + d.px * 2 : 'none', margin: '0 auto', paddingLeft: d.px, paddingRight: d.px, boxSizing: 'border-box', ...style }} {...rest}>{children}</div>;
}

/* tone: light (fundo claro) · dark (espresso) · gold (bloco goldSoft) */
function SBEyebrow({ children, tone = 'light' }) {
  const t = THEMES.light;
  const c = tone === 'dark' ? t.gold : tone === 'gold' ? t.text : t.textSec;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, fontWeight: 800, letterSpacing: '0.16em', color: c, textTransform: 'uppercase' }}>
      <span aria-hidden="true" style={{ width: 18, height: 3, borderRadius: 2, background: tone === 'dark' ? t.gold : t.accent, flexShrink: 0 }} />{children}
    </div>
  );
}

function SBHead({ id, eyebrow, title, text, tone = 'light', max = 640 }) {
  const d = useSBD(); const t = THEMES.light;
  return (
    <div style={{ maxWidth: max }}>
      {eyebrow && <SBEyebrow tone={tone}>{eyebrow}</SBEyebrow>}
      <h2 id={id} style={{ fontFamily: SB_H, fontWeight: 800, fontSize: d.h2, lineHeight: 1.08, letterSpacing: '-0.03em', color: tone === 'dark' ? SB_DK.text : t.text, marginTop: eyebrow ? 14 : 0, textWrap: 'balance' }}>{title}</h2>
      {text && <p style={{ fontSize: d.body, lineHeight: 1.6, color: tone === 'gold' ? t.text : tone === 'dark' ? SB_DK.textSec : t.textSec, marginTop: 14, maxWidth: '60ch', textWrap: 'pretty' }}>{text}</p>}
    </div>
  );
}

function SBH3({ children, style }) {
  const d = useSBD(); const t = THEMES.light;
  return <h3 style={{ fontFamily: SB_H, fontWeight: 700, fontSize: d.h3, lineHeight: 1.2, letterSpacing: '-0.02em', color: t.text, ...style }}>{children}</h3>;
}
function SBP({ children, style, size }) {
  const d = useSBD(); const t = THEMES.light;
  return <p style={{ fontSize: size || d.body, lineHeight: 1.55, color: t.textSec, textWrap: 'pretty', ...style }}>{children}</p>;
}

/* Selo "Pãezins não expiram" */
function SobreBadge() {
  const t = THEMES.light; const m = useSB().bp === 'm';
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: m ? '10px 18px 10px 10px' : '12px 22px 12px 12px', borderRadius: 999, background: t.gold, color: t.onGold, boxShadow: t.shadowSoft }}>
      <span aria-hidden="true" style={{ width: m ? 30 : 34, height: m ? 30 : 34, borderRadius: 99, background: t.espresso, color: t.gold, display: 'grid', placeItems: 'center' }}><Icon name="check" size={m ? 16 : 18} stroke={2.8} /></span>
      <span style={{ fontFamily: SB_H, fontWeight: 800, fontSize: m ? 17 : 20, letterSpacing: '-0.02em' }}>Pãezins não expiram</span>
    </div>
  );
}

/* ---------- S1 · Topo ---------- */
function SobreTop() {
  const m = useSB().bp === 'm'; const t = THEMES.light;
  return (
    <header style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3, color: SB_DK.text }}>
      <SBWrap style={{ height: m ? 64 : 84, display: 'flex', alignItems: 'center', gap: 8 }}>
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

/* ---------- S2 · Hero ---------- */
function SobreHeroArt() {
  const m = useSB().bp === 'm'; const t = THEMES.light;
  const dias = [['Seg', 2], ['Ter', 2], ['Qua', 2], ['Qui', 2], ['Sex', 3], ['Sáb', 4], ['Dom', 0]];
  return (
    <div role="img" aria-label="Exemplo do app: a agenda da semana com quantos pães em cada dia, o saldo de pãezins e o aviso de que o pão chegou no gancho." style={{ position: 'relative', paddingLeft: m ? 0 : 24 }}>
      <div aria-hidden="true" style={{ position: 'absolute', right: m ? -70 : -60, top: m ? -70 : -96, opacity: 0.07, pointerEvents: 'none' }}><BreadMark size={m ? 280 : 420} color={t.gold} /></div>
      <div aria-hidden="true" style={{ position: 'relative' }}>
        <div style={{ background: t.surface, color: t.text, borderRadius: 22, padding: m ? '18px 18px 22px' : '24px 24px 30px', boxShadow: '0 30px 60px -20px rgba(0,0,0,0.6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: t.goldSoft, color: t.accent, display: 'grid', placeItems: 'center' }}><Icon name="calendar" size={20} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SB_H, fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em' }}>Sua agenda</div>
              <div style={{ fontSize: 12.5, color: t.textSec, marginTop: 1 }}>Repete toda semana</div>
            </div>
            <Pill tone="good"><Icon name="check" size={12} stroke={2.8} />Ativa</Pill>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: m ? 5 : 7, marginTop: 16 }}>
            {dias.map(([d, n], i) => (
              <div key={d} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: t.textSec, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{d}</div>
                <div style={{ marginTop: 6, height: m ? 46 : 56, borderRadius: 12, display: 'grid', placeItems: 'center', background: n ? t.surface2 : t.surfaceAlt, border: i === 0 ? `2px solid ${t.gold}` : `1px solid ${n ? 'transparent' : t.border2}`, fontFamily: SB_H, fontWeight: 800, fontSize: m ? 19 : 22, color: n ? t.text : t.textTer }}>{n || '–'}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${t.border2}` }}>
            <span style={{ width: 28, height: 28, borderRadius: 99, background: t.goldSoft, color: t.accent, display: 'grid', placeItems: 'center' }}><Icon name="coin" size={16} stroke={2.1} /></span>
            <span style={{ fontSize: 14, color: t.textSec }}><b style={{ fontFamily: SB_H, fontSize: 16, color: t.text }}>38</b> pãezins no saldo</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec }}>Seg · amanhã</span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -14, marginRight: m ? 12 : -20, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: t.surface, color: t.text, borderRadius: 18, padding: '12px 18px 12px 12px', boxShadow: '0 18px 40px -14px rgba(0,0,0,0.55)' }}>
            <span style={{ width: 38, height: 38, borderRadius: 12, background: t.goodSoft, color: t.good, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="check" size={20} stroke={2.6} /></span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14.5 }}>Seu pão chegou!</div>
              <div style={{ fontSize: 12.5, color: t.textSec, marginTop: 1 }}>Está pendurado no gancho da porta.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SobreHero({ turnos }) {
  const m = useSB().bp === 'm'; const d = useSBD(); const t = THEMES.light;
  return (
    <section aria-labelledby="sb-h1" style={{ position: 'relative', background: t.espresso, color: SB_DK.text, overflow: 'hidden' }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 50% -10%, rgba(227,172,63,0.18), transparent 60%)' }} />
      <SBWrap style={{ position: 'relative', display: 'grid', gridTemplateColumns: m ? 'minmax(0,1fr)' : 'minmax(0,1.05fr) minmax(0,0.95fr)', gap: m ? 44 : 64, alignItems: 'center', paddingTop: m ? 64 + 28 : 84 + 56, paddingBottom: m ? 56 : 112 }}>
        <div>
          <SBEyebrow tone="dark">Pão fresco na porta</SBEyebrow>
          <h1 id="sb-h1" style={{ fontFamily: SB_H, fontWeight: 800, fontSize: d.h1, lineHeight: 1.02, letterSpacing: '-0.03em', marginTop: m ? 16 : 22, textWrap: 'balance' }}>Pão fresquinho na sua porta.</h1>
          <p style={{ fontSize: d.lead, lineHeight: 1.55, color: SB_DK.textSec, marginTop: m ? 16 : 24, maxWidth: '31em', textWrap: 'pretty' }}>
            O Cheirin de Pão entrega pão fresco na porta do seu apartamento, em condomínios parceiros. Você monta a agenda uma vez e o pão chega sozinho — <span data-sb-turno="">{sobreTurnoFrase(turnos)}</span>.
          </p>
          <div style={{ display: 'flex', flexDirection: m ? 'column' : 'row', gap: 12, marginTop: m ? 26 : 36 }}>
            <SBBtn href="/register" route="register" variant="gold" full={m}>Criar minha conta</SBBtn>
            <SBBtn href="/login" route="login" variant="ghostDark" full={m}>Já tenho conta · Entrar</SBBtn>
          </div>
        </div>
        <SobreHeroArt />
      </SBWrap>
    </section>
  );
}

/* ---------- S3 · Como funciona ---------- */
const SB_STEPS = [
  ['wallet', 'Compre pãezins', 'Escolha um combo e pague por Pix ou cartão. Cada pãozin vale um pão.'],
  ['calendar', 'Monte sua agenda', 'Diga quantos pães quer em cada dia da semana. É uma vez só.'],
  ['hook', 'Abra a porta e pegue', 'O pão chega pendurado no seu gancho, sem tocar a campainha.'],
];
function SobreSteps() {
  const m = useSB().bp === 'm'; const d = useSBD(); const t = THEMES.light;
  return (
    <section aria-labelledby="sb-como" style={{ paddingTop: d.secY, paddingBottom: d.secY }}>
      <SBWrap>
        <SBHead id="sb-como" eyebrow="Como funciona" title="Três passos, e o pão chega sozinho." />
        <ol style={{ position: 'relative', display: 'grid', gridTemplateColumns: m ? 'minmax(0,1fr)' : 'repeat(3, minmax(0,1fr))', gap: m ? 0 : 32, marginTop: m ? 32 : 56 }}>
          {!m && <div aria-hidden="true" style={{ position: 'absolute', top: 31, left: 32, width: 'calc((100% - 64px) * 2 / 3 + 64px)', borderTop: `2px dashed ${t.accent}`, opacity: 0.45 }} />}
          {SB_STEPS.map(([ic, h, p], i) => {
            const last = i === SB_STEPS.length - 1;
            const circle = (
              <div aria-hidden="true" style={{ width: m ? 52 : 64, height: m ? 52 : 64, borderRadius: 99, background: t.espresso, color: t.gold, display: 'grid', placeItems: 'center', flexShrink: 0, position: 'relative', boxShadow: `0 0 0 6px ${t.appBg}` }}>
                <Icon name={ic} size={m ? 24 : 28} stroke={2} />
              </div>
            );
            const body = (
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', color: t.textSec, textTransform: 'uppercase' }}>Passo {i + 1}</div>
                <SBH3 style={{ marginTop: 6 }}>{h}</SBH3>
                <SBP style={{ marginTop: 8, maxWidth: '30ch' }}>{p}</SBP>
              </div>
            );
            return m ? (
              <li key={h} style={{ display: 'grid', gridTemplateColumns: '52px minmax(0,1fr)', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {circle}
                  {!last && <div aria-hidden="true" style={{ flex: 1, borderLeft: `2px dashed ${t.accent}`, opacity: 0.45, margin: '6px 0' }} />}
                </div>
                <div style={{ paddingTop: 4, paddingBottom: last ? 0 : 28 }}>{body}</div>
              </li>
            ) : (
              <li key={h} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>{circle}{body}</li>
            );
          })}
        </ol>
      </SBWrap>
    </section>
  );
}

/* ---------- S4 · Pãezins, combos e agenda ---------- */
const SB_CORE = [
  ['wallet', 'Combos', 'Pacotes de pãezins, por Pix ou cartão. Cada pão sai mais barato do que na compra avulsa.'],
  ['coin', 'Saldo de pãezins', 'Comprou, caiu na hora. Cada pãozin vale um pão — e também paga o Além do Pãozin.'],
  ['calendar', 'Agenda semanal', 'Gera as entregas sozinha, toda semana, usando os pãezins do saldo.'],
  ['bag', 'Entrega', 'Mudou a rotina? Ajuste até o horário de corte de cada turno, que aparece no app.'],
];
function SobreCoreNode({ ic, h, p, i, m, arrow }) {
  const t = THEMES.light;
  return (
    <li style={{ position: 'relative', background: t.surface, borderRadius: 20, border: `1px solid ${t.border2}`, boxShadow: t.shadowSoft, padding: m ? 18 : 22, display: 'flex', flexDirection: m ? 'row' : 'column', gap: m ? 14 : 16, alignItems: 'flex-start' }}>
      <div aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 14, background: t.goldSoft, color: t.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={ic} size={22} stroke={2} /></div>
      <div>
        <SBH3>{h}</SBH3>
        <SBP size={15} style={{ marginTop: 6 }}>{p}</SBP>
      </div>
      {arrow && (
        <span aria-hidden="true" style={{ position: 'absolute', zIndex: 1, width: 28, height: 28, borderRadius: 99, background: t.espresso, color: t.gold, display: 'grid', placeItems: 'center', ...(m ? { left: 26, bottom: -21 } : { right: -28, top: 30 }) }}>
          <Icon name={m ? 'chevD' : 'chevR'} size={16} stroke={2.6} />
        </span>
      )}
    </li>
  );
}
function SobreLoopCard({ m }) {
  const t = THEMES.light;
  return (
    <div style={{ position: 'relative', background: t.surface, borderRadius: 20, padding: m ? 18 : '18px 22px', display: 'flex', gap: 14, alignItems: 'flex-start', maxWidth: m ? 'none' : 560, border: m ? `2px dashed ${t.accent}` : `1px solid ${t.border2}`, boxShadow: m ? 'none' : t.shadow }}>
      <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 14, background: t.espresso, color: t.gold, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="repeat" size={21} stroke={2.1} /></span>
      <div>
        <SBH3>Compra automática</SBH3>
        <SBP size={15} style={{ marginTop: 6 }}>Com um cartão cadastrado, quando o saldo não cobrir uma entrega agendada, o app recarrega sozinho o combo que você escolheu — sem digitar o CVV. Sem ela, você recebe um aviso de que os pãezins estão acabando.</SBP>
      </div>
    </div>
  );
}
function SobreCore() {
  const m = useSB().bp === 'm'; const d = useSBD(); const t = THEMES.light;
  const colW = '((100% - 84px) / 4)';
  return (
    <section aria-labelledby="sb-core" style={{ background: t.surface2, paddingTop: d.secY, paddingBottom: d.secY }}>
      <SBWrap>
        <div style={{ display: 'flex', flexDirection: m ? 'column' : 'row', alignItems: m ? 'flex-start' : 'flex-end', gap: m ? 22 : 40 }}>
          <div style={{ flex: 1 }}>
            <SBHead id="sb-core" eyebrow="Pãezins, combos e agenda" title="Um saldo de pães que trabalha por você." text="Pãezins são a moeda do Cheirin. Os combos enchem o saldo, a agenda usa sozinha e a compra automática recarrega quando precisa." />
          </div>
          <SobreBadge />
        </div>
        <ol style={{ display: 'grid', gridTemplateColumns: m ? 'minmax(0,1fr)' : 'repeat(4, minmax(0,1fr))', gap: 28, marginTop: m ? 32 : 52 }}>
          {SB_CORE.map(([ic, h, p], i) => <SobreCoreNode key={h} ic={ic} h={h} p={p} i={i} m={m} arrow={i < SB_CORE.length - 1} />)}
        </ol>
        {m ? (
          <div style={{ marginTop: 16 }}><SobreLoopCard m /></div>
        ) : (
          <div style={{ position: 'relative', paddingTop: 30 }}>
            <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: `calc(${colW} / 2)`, width: `calc(${colW} * 2 + 56px)`, height: 82, border: `2px dashed ${t.accent}`, borderTop: 'none', borderRadius: '0 0 26px 26px' }} />
            <div aria-hidden="true" style={{ position: 'absolute', top: -2, left: `calc(${colW} / 2 - 6px)`, width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderBottom: `10px solid ${t.accent}` }} />
            <div style={{ position: 'relative', marginLeft: `calc(${colW} / 2)`, width: `calc(${colW} * 2 + 56px)`, display: 'flex', justifyContent: 'center' }}><SobreLoopCard /></div>
          </div>
        )}
      </SBWrap>
    </section>
  );
}

/* ---------- S5 · Gancho na porta ---------- */
const SB_GANCHO = [
  ['hook', 'Sem furar', 'Encaixa na porta, sem ferramentas.'],
  ['bellOff', 'Sem campainha', 'O entregador pendura a sacola e segue.'],
  ['gift', 'De graça com o combo', 'Vem junto com a compra de um combo.'],
];
function SobreGancho() {
  const m = useSB().bp === 'm'; const d = useSBD(); const t = THEMES.light;
  return (
    <section aria-labelledby="sb-gancho" style={{ paddingTop: d.secY, paddingBottom: d.secY }}>
      <SBWrap style={{ display: 'grid', gridTemplateColumns: m ? 'minmax(0,1fr)' : 'minmax(0,1fr) minmax(0,1fr)', gap: m ? 28 : 72, alignItems: 'center' }}>
        <div style={{ height: m ? 280 : 460, borderRadius: 22, overflow: 'hidden', background: t.surface2 }}>
          <image-slot id="sobre-gancho" shape="rounded" radius="22" placeholder="Foto: gancho de acrílico transparente encaixado na porta, com a sacola de pães pendurada"></image-slot>
        </div>
        <div>
          <SBHead id="sb-gancho" eyebrow="Gancho na porta" title="O pão te espera pendurado na porta." text="Um gancho de acrílico transparente que se encaixa na porta. O entregador pendura a sacola de pães nele — e você pega quando abrir a porta." />
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: m ? 24 : 32 }}>
            {SB_GANCHO.map(([ic, h, p]) => (
              <li key={h} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 14, background: t.surface, border: `1px solid ${t.border2}`, boxShadow: t.shadowSoft, color: t.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={ic} size={22} stroke={2} /></span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: m ? 16 : 17, color: t.text }}>{h}</div>
                  <SBP size={m ? 14.5 : 15.5} style={{ marginTop: 1 }}>{p}</SBP>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </SBWrap>
    </section>
  );
}

/* ---------- S6 · Além do Pãozin ---------- */
const SB_CAT_IC = { g: 'jar', b: 'cake', s: 'puff', d: 'cup', f: 'cheese', e: 'gift' };
function SobreAlem() {
  const m = useSB().bp === 'm'; const d = useSBD(); const t = THEMES.light;
  return (
    <section aria-labelledby="sb-alem" style={{ paddingBottom: d.secY }}>
      <SBWrap>
        <div style={{ background: t.goldSoft, borderRadius: m ? 24 : 32, padding: m ? '32px 20px 20px' : 56 }}>
          <div style={{ display: 'grid', gridTemplateColumns: m ? 'minmax(0,1fr)' : 'minmax(0,1.1fr) minmax(0,1fr)', gap: m ? 0 : 56, alignItems: 'end' }}>
            <SBHead id="sb-alem" tone="gold" eyebrow="Além do Pãozin" title="Monte sua Cestinha — ela chega junto com o seu pão." />
            <p style={{ fontSize: d.body, lineHeight: 1.6, color: t.text, marginTop: m ? 14 : 0, maxWidth: '44ch', textWrap: 'pretty' }}>Itens para o café da manhã, entregues na mesma sacola. Pague com pãezins, Pix ou cartão — e dá para combinar.</p>
          </div>
          <ul style={{ display: 'grid', gridTemplateColumns: m ? 'repeat(2, minmax(0,1fr))' : 'repeat(6, minmax(0,1fr))', gap: m ? 10 : 14, marginTop: m ? 26 : 44 }}>
            {MARKET_CATS.map(c => (
              <li key={c.k} style={{ background: t.surface, borderRadius: 18, padding: m ? '14px 12px' : '22px 12px 20px', display: 'flex', flexDirection: m ? 'row' : 'column', alignItems: 'center', gap: m ? 10 : 12, textAlign: m ? 'left' : 'center', minHeight: m ? 72 : 0 }}>
                <span aria-hidden="true" style={{ width: m ? 42 : 56, height: m ? 42 : 56, borderRadius: 99, background: t.surface2, color: t.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={SB_CAT_IC[c.k]} size={m ? 21 : 26} stroke={1.9} /></span>
                <span style={{ fontSize: m ? 13.5 : 14.5, fontWeight: 700, color: t.text, lineHeight: 1.25 }}>{c.nome}</span>
              </li>
            ))}
          </ul>
        </div>
      </SBWrap>
    </section>
  );
}

Object.assign(window, { SOBRE_CFG, SB_H, SB_B, SB_DK, SB_DIMS, SB_CSS, SobreCtx, useSB, useSBD, sbPz, sobreTurnoFrase, SBA, SBLink, SBBtn, SBWrap, SBEyebrow, SBHead, SBH3, SBP, SobreBadge, SobreTop, SobreHeroArt, SobreHero, SobreSteps, SobreCore, SobreGancho, SobreAlem });
