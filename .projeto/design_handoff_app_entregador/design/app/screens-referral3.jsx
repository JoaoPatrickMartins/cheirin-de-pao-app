/* ============================================================
   Indique e Ganhe — CLIENTE · C5 Comemoração · C6 Notificações ·
   C7 Extrato · C8 Lista de espera
   ============================================================ */

/* ===== C5 — Comemoração (modal na abertura)
   variant: referrer · friend · goal · multi */
function RefCelebration({ variant = 'referrer', onClose = () => {}, go = () => {} }) {
  const t = useT();
  const V = {
    referrer: { n: 5, eyebrow: 'INDICAÇÃO QUE VALEU', title: 'Você ganhou 5 pãezins!', body: 'A Maria recebeu o primeiro pedido. Obrigado por espalhar o cheirinho de pão.', cta: 'Indicar mais', to: 'referral' },
    friend:   { n: 3, eyebrow: 'PRESENTE DE BOAS-VINDAS', title: 'Chegou presente pra você', body: '3 pãezins por ter vindo pela indicação do João. Já estão no seu saldo.', cta: 'Ver meu saldo', to: 'statement' },
    goal:     { n: 10, eyebrow: 'META ATINGIDA', title: '+10 pãezins pela 5ª indicação', body: 'Cinco vizinhos com pão fresquinho na porta. Próxima meta: 10ª indicação, +25.', cta: 'Indicar mais', to: 'referral' },
    multi:    { n: 15, eyebrow: 'ENQUANTO VOCÊ ESTAVA FORA', title: 'Você ganhou 15 pãezins com 3 indicações', body: 'Maria, Pedro e Lúcia receberam o primeiro pedido.', cta: 'Indicar mais', to: 'referral', names: ['M', 'P', 'L'] },
  }[variant];
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="rf-cel-title" style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(30,18,7,0.62)', display: 'flex', alignItems: 'flex-end', padding: 14 }}>
      <div style={{ position: 'relative', width: '100%', background: t.surface, borderRadius: 28, padding: '28px 22px 20px', textAlign: 'center', boxShadow: t.shadow, overflow: 'hidden' }}>
        <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 170, background: `radial-gradient(120% 90% at 50% 0%, ${t.goldSoft} 0%, rgba(243,221,166,0) 70%)` }} />
        <button onClick={onClose} aria-label="Fechar" style={{ position: 'absolute', top: 8, right: 8, width: 44, height: 44, borderRadius: 14, background: 'none', border: 'none', color: t.textSec, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="x" size={19} stroke={2.2} /></button>
        <div style={{ position: 'relative', width: 96, height: 96, margin: '0 auto', borderRadius: 999, background: t.espresso, display: 'grid', placeItems: 'center', boxShadow: `0 0 0 8px ${t.goldSoft}` }}>
          <BreadMark size={66} color={t.gold} side={0.8} />
          {V.names && <div style={{ position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)', display: 'flex' }}>{V.names.map((n, i) => <span key={n} style={{ width: 26, height: 26, borderRadius: 99, background: t.gold, color: t.onGold, border: `2px solid ${t.surface}`, marginLeft: i ? -7 : 0, display: 'grid', placeItems: 'center', fontFamily: RF_H, fontWeight: 800, fontSize: 11.5 }}>{n}</span>)}</div>}
        </div>
        <div style={{ position: 'relative', fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', color: t.accent, marginTop: 22 }}>{V.eyebrow}</div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8, marginTop: 6 }}>
          <span style={{ fontFamily: RF_H, fontWeight: 800, fontSize: 56, letterSpacing: '-0.04em', color: t.text, lineHeight: 1 }}>+{V.n}</span>
          <span style={{ fontFamily: RF_H, fontWeight: 700, fontSize: 18, color: t.accent }}>pãezins</span>
        </div>
        <div id="rf-cel-title" style={{ fontFamily: RF_H, fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em', color: t.text, marginTop: 10, lineHeight: 1.2 }}>{V.title}</div>
        <div style={{ fontSize: 14, color: t.textSec, marginTop: 8, lineHeight: 1.5, textWrap: 'pretty' }}>{V.body}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
          <Btn full size="lg" icon={V.to === 'referral' ? 'gift' : 'wallet'} onClick={() => { onClose(); go(V.to); }}>{V.cta}</Btn>
          <button onClick={onClose} style={{ minHeight: 44, background: 'none', border: 'none', color: t.textSec, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'Hanken Grotesk' }}>Agora não</button>
        </div>
      </div>
    </div>
  );
}

/* Fundo de Home esmaecido para apresentar o modal */
function RefFauxHome() {
  const t = useT();
  return (
    <div style={{ padding: '6px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontFamily: RF_H, fontWeight: 800, fontSize: 26, color: t.text, letterSpacing: '-0.03em' }}>Bom dia, João</div>
      <div style={{ height: 150, borderRadius: 22, background: t.espresso }} />
      <div style={{ height: 120, borderRadius: 22, background: t.surface }} />
      <div style={{ display: 'flex', gap: 10 }}>{[0, 1, 2].map(i => <div key={i} style={{ flex: 1, height: 84, borderRadius: 18, background: t.surface }} />)}</div>
      <div style={{ height: 180, borderRadius: 22, background: t.surface }} />
    </div>
  );
}

/* ===== C6 — Central de notificações (4 tipos novos) */
const REF_NOTIFS = [
  { ic: 'gift', tone: 'gold', titulo: 'Você ganhou 5 pãezins!', txt: 'Maria recebeu o 1º pedido. Obrigado por espalhar o cheirinho de pão 🥖', hora: 'Agora', cta: 'Ver saldo', to: 'statement', novo: true },
  { ic: 'users', tone: 'good', titulo: 'Sua indicação chegou! 🎉', txt: 'Carlos se cadastrou com o seu código. Quando ele receber o 1º pedido, você ganha 5 pãezins.', hora: '08:12', cta: 'Ver indicações', to: 'referral', novo: true },
  { ic: 'gift', tone: 'gold', titulo: 'Presente de boas-vindas 🎁', txt: 'Você ganhou 3 pãezins por ter vindo pela indicação do João.', hora: 'Ontem, 06:34', cta: 'Ver saldo', to: 'statement', amigo: true },
  { ic: 'spark', tone: 'neutral', titulo: 'Gostou do pãozin?', txt: 'Indique um vizinho: quando ele receber o 1º pedido, você ganha 5 pãezins.', hora: 'Seg, 09:00', cta: 'Indicar agora', to: 'referral' },
  { ic: 'check', tone: 'neutral', titulo: 'Entrega realizada', txt: 'Seus 6 pães foram entregues. Bom apetite!', hora: 'Seg, 07:04', cta: null },
];
function RefNotifs({ go = () => {} }) {
  const t = useT();
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <AppBar title="Notificações" onBack={() => go('home')} />
      <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {REF_NOTIFS.map((n, i) => {
          const c = { gold: t.accent, good: t.good, neutral: t.textSec }[n.tone];
          const bg = { gold: t.goldSoft, good: t.goodSoft, neutral: t.surface2 }[n.tone];
          return (
            <Card key={i} pad={15} style={{ display: 'flex', gap: 13, border: n.novo ? `1.5px solid ${t.gold}` : `1px solid ${t.border2}` }}>
              <div style={{ width: 42, height: 42, borderRadius: 999, background: bg, color: c, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={n.ic} size={20} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14.5, color: t.text, lineHeight: 1.25, flex: 1 }}>{n.titulo}</span>
                  <span style={{ fontSize: 11, color: t.textTer, fontWeight: 600, flexShrink: 0, marginTop: 2 }}>{n.hora}</span>
                </div>
                <div style={{ fontSize: 13, color: t.textSec, marginTop: 3, lineHeight: 1.45 }}>{n.txt}</div>
                {n.amigo && <div style={{ fontSize: 11, color: t.textTer, marginTop: 4, fontWeight: 600 }}>(visão do amigo indicado)</div>}
                {n.cta && <button onClick={() => go(n.to)} style={{ marginTop: 10, minHeight: 36, background: n.tone === 'gold' ? t.gold : t.surface2, color: n.tone === 'gold' ? t.onGold : t.text, border: 'none', borderRadius: 11, padding: '0 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Hanken Grotesk' }}>{n.cta}</button>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ===== C7 — Extrato de pãezins */
const REF_STATEMENT = [
  { dia: 'Hoje', itens: [
    { ic: 'gift', tipo: 'bonus', titulo: 'Indique e ganhe', sub: 'Maria S. recebeu o 1º pedido', v: +5 },
    { ic: 'truck', tipo: 'uso', titulo: 'Entrega de hoje', sub: '4 pães · 06:31', v: -4 },
  ] },
  { dia: 'Sáb, 27/09', itens: [
    { ic: 'star', tipo: 'bonus', titulo: 'Meta de 5 indicações', sub: 'Bônus pela 5ª indicação que valeu', v: +10 },
    { ic: 'coin', tipo: 'compra', titulo: 'Compra de pãezins', sub: 'Combo 30 · Pix · R$ 30,00', v: +30 },
    { ic: 'basket', tipo: 'uso', titulo: 'Cestinha', sub: 'Geleia de frutas vermelhas', v: -7.5 },
  ] },
  { dia: 'Dom, 14/09 · na conta da Maria', itens: [
    { ic: 'gift', tipo: 'bonus', titulo: 'Boas-vindas por indicação', sub: 'Você veio pela indicação do João M.', v: +3 },
  ] },
];
function RefStatement({ go = () => {} }) {
  const t = useT();
  const fmt = v => (v > 0 ? '+' : '−') + String(Math.abs(v)).replace('.', ',');
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <AppBar title="Extrato" onBack={() => go('home')} />
      <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: t.espresso, borderRadius: 22, padding: '16px 18px', color: '#FAF5EC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: t.gold }}>SALDO</div>
            <div style={{ fontFamily: RF_H, fontWeight: 800, fontSize: 32, letterSpacing: '-0.03em', marginTop: 4 }}>12,5 <span style={{ fontSize: 16, fontWeight: 700, color: 'rgba(250,245,236,0.7)' }}>pãezins</span></div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: 'rgba(250,245,236,0.7)', lineHeight: 1.4 }}>Bônus de indicação<br /><b style={{ color: t.gold, fontSize: 15 }}>+15 este mês</b></div>
        </div>
        {REF_STATEMENT.map(g => (
          <div key={g.dia}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: t.textTer, textTransform: 'uppercase', margin: '0 4px 8px' }}>{g.dia}</div>
            <Card pad={0} style={{ padding: '2px 14px' }}>
              {g.itens.map((it, i) => {
                const bonus = it.tipo === 'bonus';
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < g.itens.length - 1 ? `1px solid ${t.border2}` : 'none' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 999, background: bonus ? t.goldSoft : t.surface2, color: bonus ? t.accent : t.textSec, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={it.ic} size={19} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: t.text }}>{it.titulo}</span>
                        {bonus && <Pill tone="gold" style={{ padding: '2px 8px', fontSize: 10.5 }}>Bônus</Pill>}
                      </div>
                      <div style={{ fontSize: 12.5, color: t.textSec, marginTop: 2 }}>{it.sub}</div>
                    </div>
                    <span style={{ fontFamily: RF_H, fontWeight: 800, fontSize: 17, color: it.v > 0 ? (bonus ? t.accent : t.good) : t.textSec }}>{fmt(it.v)}</span>
                  </div>
                );
              })}
            </Card>
          </div>
        ))}
        <div style={{ fontSize: 12, color: t.textTer, textAlign: 'center', lineHeight: 1.5 }}>Pãezins de bônus não viram dinheiro e não expiram.</div>
      </div>
    </div>
  );
}

/* ===== C8 — Lista de espera (passo 3 do cadastro)
   st: empty · form · sending · success · error */
function RefWaitlist({ st = 'empty', onBack, onSubmit, onDone }) {
  const t = useT();
  const Head = ({ title, sub }) => (
    <>
      <div style={{ fontFamily: RF_H, fontWeight: 700, fontSize: 26, letterSpacing: '-0.03em', color: t.text, lineHeight: 1.15 }}>{title}</div>
      <div style={{ fontSize: 14, color: t.textSec, marginTop: 10, marginBottom: 18, lineHeight: 1.5 }}>{sub}</div>
    </>
  );
  const Back = () => <button onClick={onBack} aria-label="Voltar" style={{ cursor: 'pointer', background: t.surface2, border: 'none', width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', color: t.text }}><Icon name="arrowL" size={20} /></button>;
  if (st === 'empty') return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '6px 24px 24px' }}>
      <Back /><div style={{ marginTop: 16, marginBottom: 6 }}><RefDots current={2} /></div>
      <Head title="Onde você mora?" sub="Entregamos só nos condomínios parceiros já cadastrados." />
      <Field icon="building" value="Solar das Palmeiras" />
      <Card pad={22} style={{ marginTop: 16, textAlign: 'center', background: t.surfaceAlt, border: `1.5px dashed ${t.border}`, boxShadow: 'none' }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: t.surface2, color: t.textSec, display: 'grid', placeItems: 'center', margin: '0 auto' }}><Icon name="building" size={24} /></div>
        <div style={{ fontFamily: RF_H, fontWeight: 700, fontSize: 18, color: t.text, marginTop: 12, letterSpacing: '-0.02em' }}>Seu condomínio ainda não é parceiro</div>
        <div style={{ fontSize: 13.5, color: t.textSec, marginTop: 6, lineHeight: 1.5 }}>Conta pra gente onde você mora. Quando vários vizinhos pedem, o Cheirin chega mais rápido.</div>
        <div style={{ marginTop: 16 }}><Btn variant="gold" icon="bell">Meu condomínio não está aqui</Btn></div>
      </Card>
    </div>
  );
  if (st === 'success') return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '6px 24px 24px', minHeight: 700 }}>
      <Back />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ width: 88, height: 88, borderRadius: 999, background: t.goodSoft, color: t.good, display: 'grid', placeItems: 'center' }}><Icon name="check" size={40} stroke={2.4} /></div>
        <div style={{ fontFamily: RF_H, fontWeight: 800, fontSize: 26, color: t.text, marginTop: 20, letterSpacing: '-0.03em' }}>Anotado!</div>
        <div style={{ fontSize: 14.5, color: t.textSec, marginTop: 8, lineHeight: 1.5, maxWidth: 280 }}>Avisamos quando o Cheirin chegar no Solar das Palmeiras. Se veio por indicação, o código fica guardado.</div>
      </div>
      <Btn full size="lg" variant="ghost" onClick={onDone}>Voltar ao início</Btn>
    </div>
  );
  const sending = st === 'sending';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '6px 24px 24px' }}>
      <Back />
      <div style={{ marginTop: 18 }} />
      <Head title="Avise-me quando chegar" sub="Leva 30 segundos. Só usamos seu contato pra isso." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13, opacity: sending ? 0.6 : 1 }}>
        <Field label="Nome do condomínio" icon="building" value="Solar das Palmeiras" />
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.3fr)', gap: 10 }}>
          <Field label="CEP (opcional)" value="13085-000" />
          <Field label="Cidade" value="Campinas" />
        </div>
        <Field label="Seu nome" icon="user" value="Luciana Prado" />
        <Field label="E-mail ou celular" icon="mail" value="luciana@email.com" hint="Um dos dois basta." />
      </div>
      {st === 'error' && <div role="alert" style={{ marginTop: 14, display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 14, background: t.dangerSoft, color: t.danger, fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}><Icon name="alert" size={17} stroke={2.2} style={{ flexShrink: 0 }} />Não conseguimos enviar agora. Seus dados continuam aqui — tente de novo.</div>}
      <div style={{ marginTop: 20 }}>
        <Btn full size="lg" onClick={onSubmit} disabled={sending} icon={sending ? null : (st === 'error' ? 'refresh' : 'bell')}>
          {sending ? <><span style={{ width: 16, height: 16, borderRadius: 99, border: '2.5px solid rgba(251,243,228,0.3)', borderTopColor: '#FBF3E4', animation: 'rfSpin .8s linear infinite' }} />Enviando…</> : st === 'error' ? 'Tentar de novo' : 'Avisar quando chegar'}
        </Btn>
      </div>
    </div>
  );
}

Object.assign(window, { RefCelebration, RefFauxHome, REF_NOTIFS, RefNotifs, RefStatement, RefWaitlist });
