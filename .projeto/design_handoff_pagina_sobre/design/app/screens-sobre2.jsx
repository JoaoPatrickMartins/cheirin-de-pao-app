/* ============================================================
   Cheirin de Pão — Página "Sobre" (parte 2)
   S7 FAQ · S8 Entrar com o Google · S9 Contato · S10 Rodapé
   · SobrePage (montagem) · SobreKit · SobreDemoBar
   ============================================================ */

/* ---------- S7 · Perguntas frequentes ---------- */
function sobreFaqItems(indique) {
  const items = [
    ['O que são pãezins?', 'Pãezins são a moeda do app: cada pãozin vale um pão fresquinho. Você usa pãezins para agendar seu pão e também para pagar os itens do Além do Pãozin. E eles não expiram.'],
    ['Como funcionam os combos?', 'Combos são pacotes de pãezins. Comprou, os pãezins caem na hora no seu saldo — e cada pão sai mais barato do que na compra avulsa. Pague por Pix ou cartão.'],
    ['Como funciona a agenda semanal?', 'Você escolhe quantos pães quer em cada dia da semana e pronto: a agenda gera as entregas sozinha, toda semana, usando os pãezins do seu saldo. Mudou a rotina? Ajuste quando quiser. Prefere só um dia? Faça um pedido único.'],
    ['E se meus pãezins acabarem?', 'Ative a compra automática: quando o saldo não cobrir uma entrega agendada, a gente recarrega sozinho o combo que você escolheu, no seu cartão cadastrado — sem digitar o CVV. Sem ela, você recebe um aviso para comprar antes.'],
    ['Até quando posso pedir ou mudar?', 'Até o horário de corte de cada turno, que aparece no app. Depois do corte, aquela entrega já está fechada com a padaria.'],
    ['Posso pausar quando viajar?', 'Pode. Pause a agenda num toque: nada é entregue enquanto ela estiver pausada, sua configuração fica guardada e seus pãezins continuam no saldo. Voltou? É só retomar.'],
    ['Meu condomínio não é atendido. E agora?', 'Por enquanto entregamos só em condomínios parceiros. No cadastro, toque em “Meu condomínio não está aqui” e deixe seu contato: quando vários vizinhos pedem, o Cheirin chega mais rápido — e a gente te avisa.'],
  ];
  if (indique && indique.ativo) {
    const y = indique.bonusAmigo > 0 ? `, e ele ganha ${sbPz(indique.bonusAmigo)} no primeiro pedido` : '';
    items.push(['Como funciona o Indique e Ganhe?', `Indique um vizinho com o seu link: você ganha ${sbPz(indique.recompensa)} quando o pão chegar na porta dele${y}.`]);
  }
  return items;
}

function SobreFaqItem({ q, a, open, onToggle, first, uid }) {
  const m = useSB().bp === 'm'; const d = useSBD(); const t = THEMES.light;
  const [h, setH] = React.useState(false);
  return (
    <div style={{ borderTop: first ? 'none' : `1px solid ${t.border2}` }}>
      <h3 style={{ fontSize: 'inherit' }}>
        <button id={`${uid}-q`} aria-expanded={open} aria-controls={`${uid}-a`} onClick={onToggle} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
          style={{ width: '100%', minHeight: m ? 64 : 72, display: 'flex', alignItems: 'center', gap: 16, textAlign: 'left', padding: m ? '14px 16px 14px 18px' : '16px 22px 16px 26px', background: h && !open ? t.surfaceAlt : 'transparent', border: 'none', cursor: 'pointer', fontFamily: SB_B, fontSize: m ? 16 : 17.5, fontWeight: 700, lineHeight: 1.35, color: t.text, transition: 'background .15s' }}>
          <span style={{ flex: 1 }}>{q}</span>
          <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 99, background: open ? t.espresso : t.surface2, color: open ? t.gold : t.text, display: 'grid', placeItems: 'center', flexShrink: 0, transition: 'background .15s' }}><Icon name={open ? 'minus' : 'plus'} size={16} stroke={2.5} /></span>
        </button>
      </h3>
      <div id={`${uid}-a`} role="region" aria-labelledby={`${uid}-q`} hidden={!open} style={{ padding: m ? '0 18px 20px' : '0 80px 24px 26px' }}>
        <p style={{ fontSize: d.body, lineHeight: 1.6, color: t.textSec, maxWidth: '64ch', textWrap: 'pretty' }}>{a}</p>
      </div>
    </div>
  );
}

function SobreFaq({ indique, open: initOpen = [0] }) {
  const m = useSB().bp === 'm'; const d = useSBD(); const t = THEMES.light;
  const uid = React.useId().replace(/:/g, '');
  const items = sobreFaqItems(indique);
  const [open, setOpen] = React.useState(initOpen);
  React.useEffect(() => setOpen(initOpen), [initOpen.join(',')]);
  const toggle = i => setOpen(o => (o.includes(i) ? o.filter(x => x !== i) : [...o, i]));
  return (
    <section aria-labelledby={`${uid}-h`} style={{ paddingBottom: d.secY }}>
      <SBWrap style={{ display: 'grid', gridTemplateColumns: m ? 'minmax(0,1fr)' : 'minmax(0,0.75fr) minmax(0,1.6fr)', gap: m ? 26 : 64, alignItems: 'start' }}>
        <SBHead id={`${uid}-h`} eyebrow="Tira-dúvidas" title="Perguntas frequentes" text="Não achou sua resposta? Fale com a gente — o contato está logo abaixo." />
        <div style={{ background: t.surface, borderRadius: 22, border: `1px solid ${t.border2}`, boxShadow: t.shadowSoft, overflow: 'hidden' }}>
          {items.map(([q, a], i) => <SobreFaqItem key={q} uid={`${uid}-${i}`} q={q} a={a} first={i === 0} open={open.includes(i)} onToggle={() => toggle(i)} />)}
        </div>
      </SBWrap>
    </section>
  );
}

/* ---------- S8 · Entrar com o Google ---------- */
function SobreGoogle() {
  const m = useSB().bp === 'm'; const t = THEMES.light;
  const li = (ok, txt) => (
    <li key={txt} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 600, color: t.text, minHeight: 30 }}>
      <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 99, background: ok ? t.goodSoft : t.surface2, color: ok ? t.good : t.textSec, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={ok ? 'check' : 'x'} size={13} stroke={2.8} /></span>{txt}
    </li>
  );
  const box = { background: t.surfaceAlt, border: `1px solid ${t.border2}`, borderRadius: 16, padding: m ? 16 : 18 };
  const h3 = { fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.textSec, marginBottom: 10 };
  return (
    <section aria-labelledby="sb-google" style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 22, padding: m ? 22 : 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ width: 44, height: 44, borderRadius: 12, background: '#FFFFFF', border: `1px solid ${t.border}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}><GoogleG size={22} /></span>
        <h2 id="sb-google" style={{ fontFamily: SB_H, fontWeight: 700, fontSize: m ? 22 : 26, letterSpacing: '-0.02em', color: t.text }}>Entrar com o Google</h2>
      </div>
      <SBP style={{ marginTop: 14 }}>Dá para entrar no Cheirin de três jeitos: com e-mail e senha, com um código no e-mail ou com a sua conta Google.</SBP>
      <div style={{ display: 'grid', gridTemplateColumns: m ? 'minmax(0,1fr)' : 'minmax(0,1.15fr) minmax(0,1fr)', gap: 12, marginTop: 18 }}>
        <div style={box}>
          <h3 style={h3}>O Cheirin de Pão recebe</h3>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{li(true, 'O identificador da sua conta')}{li(true, 'Seu nome')}{li(true, 'Seu e-mail')}</ul>
          <p style={{ fontSize: 13.5, color: t.textSec, marginTop: 10, lineHeight: 1.45 }}>Só para criar e acessar a sua conta.</p>
        </div>
        <div style={box}>
          <h3 style={h3}>E não recebe</h3>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{li(false, 'A senha do Google')}{li(false, 'Outros dados da sua conta')}</ul>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 24, marginTop: 10 }}>
        <SBLink href="/privacidade" route="legal-privacy" icon="lock">Política de Privacidade</SBLink>
        <SBLink href="/termos" route="legal-terms" icon="doc">Termos de Uso</SBLink>
      </div>
    </section>
  );
}

/* ---------- S9 · Contato ---------- */
function SobreContato() {
  const m = useSB().bp === 'm'; const t = THEMES.light; const cfg = SOBRE_CFG;
  return (
    <section aria-labelledby="sb-contato" style={{ background: t.surface2, borderRadius: 22, padding: m ? 22 : 32, display: 'flex', flexDirection: 'column' }}>
      <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 12, background: t.espresso, color: t.gold, display: 'grid', placeItems: 'center' }}><Icon name="chat" size={22} stroke={2} /></span>
      <h2 id="sb-contato" style={{ fontFamily: SB_H, fontWeight: 700, fontSize: m ? 22 : 26, letterSpacing: '-0.02em', color: t.text, marginTop: 16 }}>Fale com a gente</h2>
      <SBP style={{ marginTop: 8 }}>Dúvida, sugestão ou algum problema com a entrega? É só chamar.</SBP>
      <div style={{ flex: 1, minHeight: 20 }} />
      <SBBtn href={`https://wa.me/${cfg.whatsapp}`} route="whatsapp" variant="primary" icon="chat" full>Falar no WhatsApp</SBBtn>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
        <SBLink href={`mailto:${cfg.email}`} route="mailto" icon="mail" style={{ fontSize: m ? 14.5 : 15 }}>{cfg.email}</SBLink>
      </div>
    </section>
  );
}

function SobreTrust() {
  const m = useSB().bp === 'm'; const d = useSBD();
  return (
    <div style={{ paddingBottom: d.secY }}>
      <SBWrap style={{ display: 'grid', gridTemplateColumns: m ? 'minmax(0,1fr)' : 'minmax(0,1.55fr) minmax(0,1fr)', gap: m ? 16 : 24, alignItems: 'stretch' }}>
        <SobreGoogle />
        <SobreContato />
      </SBWrap>
    </div>
  );
}

/* ---------- S10 · Rodapé ---------- */
function SobreFooter() {
  const m = useSB().bp === 'm'; const t = THEMES.light; const cfg = SOBRE_CFG;
  return (
    <footer style={{ background: t.espresso, color: SB_DK.text }}>
      <SBWrap style={{ paddingTop: m ? 32 : 48, paddingBottom: m ? 28 : 36 }}>
        <div style={{ display: 'flex', flexDirection: m ? 'column' : 'row', alignItems: m ? 'flex-start' : 'center', gap: m ? 14 : 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BreadMark size={34} color={t.gold} />
            <span style={{ fontFamily: SB_H, fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>Cheirin de Pão</span>
          </div>
          <div style={{ flex: 1 }} />
          <nav aria-label="Rodapé">
            <ul style={{ display: 'flex', flexDirection: m ? 'column' : 'row', columnGap: 28 }}>
              <li><SBLink dark href="/privacidade" route="legal-privacy">Política de Privacidade</SBLink></li>
              <li><SBLink dark href="/termos" route="legal-terms">Termos de Uso</SBLink></li>
              <li><SBLink dark href={`mailto:${cfg.email}`} route="mailto" icon="mail">{cfg.email}</SBLink></li>
            </ul>
          </nav>
        </div>
        <div style={{ borderTop: '1px solid rgba(250,245,236,0.12)', marginTop: m ? 16 : 28, paddingTop: 18, fontSize: 13.5, color: SB_DK.textSec }}>© 2026 Cheirin de Pão</div>
      </SBWrap>
    </footer>
  );
}

/* ---------- Montagem ----------
   bp: 'm' (390) | 'd' (1280) · turnos: { manha, tarde } | null (neutro)
   indique: { ativo, recompensa, bonusAmigo } · faqOpen: índices abertos
   only: ['hero'] | ['faq'] para recortes do quadro · go: navegação do protótipo */
function SobrePage({ bp = 'm', go = null, turnos = SOBRE_CFG.turnos, indique = SOBRE_CFG.indique, faqOpen = [0], only }) {
  const t = THEMES.light;
  const has = k => !only || only.includes(k);
  return (
    <ThemeCtx.Provider value={t}>
      <SobreCtx.Provider value={{ bp, go }}>
        <div className="sb" style={{ position: 'relative', width: '100%', background: t.appBg, color: t.text, fontFamily: SB_B, WebkitFontSmoothing: 'antialiased' }}>
          <style>{SB_CSS}</style>
          {has('hero') && <SobreTop />}
          <main style={only && !has('hero') ? { paddingTop: SB_DIMS[bp].secY * 0.6 } : null}>
            {has('hero') && <SobreHero turnos={turnos} />}
            {has('steps') && <SobreSteps />}
            {has('core') && <SobreCore />}
            {has('gancho') && <SobreGancho />}
            {has('alem') && <SobreAlem />}
            {has('faq') && <SobreFaq indique={indique} open={faqOpen} />}
            {has('trust') && <SobreTrust />}
          </main>
          {has('footer') && <SobreFooter />}
        </div>
      </SobreCtx.Provider>
    </ThemeCtx.Provider>
  );
}

/* ---------- Kit (quadro) ---------- */
function SobreKit() {
  const t = THEMES.light;
  const L = ({ children }) => <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.1em', color: t.textSec, marginTop: 8 }}>{children}</div>;
  const icons = ['arrowR', 'bellOff', 'jar', 'cake', 'puff', 'cup', 'cheese', 'hook'];
  return (
    <ThemeCtx.Provider value={t}>
      <SobreCtx.Provider value={{ bp: 'm', go: () => {} }}>
        <div className="sb" style={{ width: 390, padding: 20, background: t.appBg, display: 'flex', flexDirection: 'column', gap: 10, fontFamily: SB_B, color: t.text }}>
          <style>{SB_CSS}</style>
          <L>BOTÃO-LINK · SBBtn (Btn como &lt;a&gt;)</L>
          <SBBtn variant="primary" icon="chat" full href="#">Falar no WhatsApp</SBBtn>
          <div style={{ background: t.espresso, color: SB_DK.text, borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SBBtn variant="gold" full href="#">Criar minha conta</SBBtn>
            <SBBtn variant="ghostDark" full href="#">Já tenho conta · Entrar</SBBtn>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <SBLink dark href="#" style={{ padding: '0 8px' }}>Entrar</SBLink>
              <SBBtn variant="gold" size="sm" href="#">Criar conta</SBBtn>
              <div style={{ flex: 1 }} />
              <SBEyebrow tone="dark">Hero</SBEyebrow>
            </div>
          </div>
          <L>LINK DE TEXTO · SBLink (alvo 44 px)</L>
          <div style={{ display: 'flex', gap: 20 }}><SBLink href="#" icon="lock">Política de Privacidade</SBLink><SBLink href="#">Termos de Uso</SBLink></div>
          <L>EYEBROW · SELO</L>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}><SBEyebrow>Como funciona</SBEyebrow><SobreBadge /></div>
          <L>FAQ · FECHADO E ABERTO</L>
          <div style={{ background: t.surface, borderRadius: 22, border: `1px solid ${t.border2}`, boxShadow: t.shadowSoft, overflow: 'hidden' }}>
            <SobreFaqItem uid="kit-a" first q="O que são pãezins?" a="" open={false} onToggle={() => {}} />
            <SobreFaqItem uid="kit-b" q="Posso pausar quando viajar?" a="Pode. Pause a agenda num toque: nada é entregue enquanto ela estiver pausada, sua configuração fica guardada e seus pãezins continuam no saldo. Voltou? É só retomar." open onToggle={() => {}} />
          </div>
          <L>ÍCONES NOVOS EM brand.jsx (+ hook, reutilizado)</L>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {icons.map(n => <div key={n} style={{ background: t.surface, borderRadius: 14, padding: '14px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, color: t.text }}><Icon name={n} size={26} /><span style={{ fontSize: 11.5, fontWeight: 700, color: t.textSec }}>{n}</span></div>)}
          </div>
        </div>
      </SobreCtx.Provider>
    </ThemeCtx.Provider>
  );
}

/* ---------- Seletor de demonstração (fora da página) ---------- */
const SOBRE_DEMO = {
  turnos: { ambos: { manha: true, tarde: true }, manha: { manha: true, tarde: false }, tarde: { manha: false, tarde: true }, neutro: null },
  indique: { bonus: { ativo: true, recompensa: 5, bonusAmigo: 2 }, sem: { ativo: true, recompensa: 5, bonusAmigo: 0 }, off: { ativo: false, recompensa: 5, bonusAmigo: 0 } },
};
function SobreDemoBar({ turno, setTurno, ind, setInd, style }) {
  const t = THEMES.light;
  const seg = (opts, v, set) => (
    <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 3 }}>
      {opts.map(([k, l]) => <button key={k} onClick={() => set(k)} style={{ border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 8, fontWeight: 700, fontSize: 12.5, fontFamily: SB_B, background: v === k ? '#33230F' : 'transparent', color: v === k ? SB_DK.text : 'rgba(250,245,236,0.55)', whiteSpace: 'nowrap' }}>{l}</button>)}
    </div>
  );
  const row = (l, el) => <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ width: 56, fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: 'rgba(250,245,236,0.6)' }}>{l}</span>{el}</div>;
  return (
    <div style={{ position: 'fixed', zIndex: 1000, background: t.espresso, color: SB_DK.text, borderRadius: 14, padding: '10px 12px 12px', boxShadow: '0 16px 40px -12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 8, fontFamily: SB_B, ...style }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', color: t.gold }}>DEMONSTRAÇÃO · NÃO FAZ PARTE DA PÁGINA</div>
      {row('TURNOS', seg([['ambos', 'Manhã + tarde'], ['manha', 'Só manhã'], ['tarde', 'Só tarde'], ['neutro', 'Neutro']], turno, setTurno))}
      {row('INDIQUE', seg([['bonus', 'Com bônus'], ['sem', 'Sem bônus'], ['off', 'Desligado']], ind, setInd))}
    </div>
  );
}

Object.assign(window, { sobreFaqItems, SobreFaqItem, SobreFaq, SobreGoogle, SobreContato, SobreTrust, SobreFooter, SobrePage, SobreKit, SOBRE_DEMO, SobreDemoBar });
