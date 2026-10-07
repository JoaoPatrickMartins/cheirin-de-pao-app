/* ============================================================
   Indique e Ganhe — CLIENTE · kit reutilizável + C1
   ============================================================ */
const RF_H = 'Bricolage Grotesque, sans-serif';

/* Estados da indicação (visão de quem indicou) — sempre com ícone + texto */
const REF_STATE = {
  cadastro:   { l: 'Cadastro em andamento', tone: 'neutral', ic: 'edit' },
  aguardando: { l: 'Aguardando 1º pedido',  tone: 'gold',    ic: 'clock' },
  analise:    { l: 'Em análise',            tone: 'neutral', ic: 'search' },
  ganhou:     { l: 'Ganhou',                tone: 'good',    ic: 'check' },
  recusada:   { l: 'Não valeu',             tone: 'neutral', ic: 'x' },
  expirou:    { l: 'Prazo encerrado',       tone: 'neutral', ic: 'clock' },
};
const refEmAndamento = e => ['cadastro', 'aguardando', 'analise'].includes(e);

/* Recompensa efetiva de quem indica (considera campanha) */
const refX = cfg => cfg.recompensa * (cfg.campanha ? cfg.campanha.multiplicador : 1);

function RefStatePill({ estado, ganho }) {
  const s = REF_STATE[estado];
  const muted = estado === 'recusada' || estado === 'expirou';
  return (
    <Pill tone={s.tone} style={muted ? { opacity: 0.8 } : null}>
      <Icon name={s.ic} size={12} stroke={2.6} />
      {estado === 'ganhou' ? `Ganhou +${ganho}` : s.l}
    </Pill>
  );
}

/* Código grande, em 2 grupos pra ler/ditar (JOAO · 7K2F) */
function RefCode({ code, size = 34, color }) {
  const t = useT();
  const a = code.slice(0, -4), b = code.slice(-4);
  return (
    <span aria-label={`Código ${code.split('').join(' ')}`} style={{ fontFamily: RF_H, fontWeight: 800, fontSize: size, letterSpacing: '0.06em', color: color || t.text, display: 'inline-flex', gap: size * 0.3, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
      <span>{a}</span><span style={{ color: t.gold }}>{b}</span>
    </span>
  );
}

/* Cartão do código (tíquete pontilhado) com copiar */
function RefCodeCard({ code = MY_CODE, onDark }) {
  const t = useT();
  const [copied, setCopied] = React.useState(false);
  const copy = () => { setCopied(true); setTimeout(() => setCopied(false), 1800); };
  return (
    <div style={{ borderRadius: 18, border: `1.5px dashed ${onDark ? 'rgba(227,172,63,0.55)' : t.gold}`, background: onDark ? 'rgba(250,245,236,0.06)' : t.surface, padding: '14px 14px 14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: onDark ? 'rgba(250,245,236,0.6)' : t.textTer, marginBottom: 8 }}>SEU CÓDIGO</div>
        <RefCode code={code} size={30} color={onDark ? '#FAF5EC' : t.text} />
      </div>
      <button onClick={copy} aria-live="polite" style={{ minWidth: 96, height: 46, borderRadius: 14, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontWeight: 800, fontSize: 13.5, fontFamily: 'Hanken Grotesk', background: copied ? t.good : t.gold, color: copied ? '#fff' : t.onGold, transition: 'background .2s' }}>
        <Icon name={copied ? 'check' : 'copy'} size={17} stroke={2.3} />{copied ? 'Copiado!' : 'Copiar'}
      </button>
    </div>
  );
}

/* Botões de compartilhar */
function RefShareButtons({ onToast }) {
  const t = useT();
  const [linkOk, setLinkOk] = React.useState(false);
  const sec = { flex: 1, height: 48, borderRadius: 16, border: `1.5px solid ${t.border}`, background: t.surface, color: t.text, fontWeight: 700, fontSize: 14, fontFamily: 'Hanken Grotesk', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Btn full size="lg" icon="chat" onClick={() => onToast && onToast('Abrindo o WhatsApp com a mensagem pronta…')}>Enviar no WhatsApp</Btn>
      <div style={{ display: 'flex', gap: 10 }}>
        <button style={sec} onClick={() => onToast && onToast('Abrindo opções do celular…')}><Icon name="share" size={18} stroke={2.1} />Mais opções</button>
        <button style={{ ...sec, color: linkOk ? t.good : t.text }} onClick={() => { setLinkOk(true); setTimeout(() => setLinkOk(false), 1800); }}><Icon name={linkOk ? 'check' : 'link'} size={18} stroke={2.1} />{linkOk ? 'Link copiado' : 'Copiar link'}</button>
      </div>
    </div>
  );
}

/* Item da lista de indicados */
function RefItem({ r, last }) {
  const t = useT();
  const off = r.estado === 'recusada' || r.estado === 'expirou';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: last ? 'none' : `1px solid ${t.border2}` }}>
      <div style={{ width: 40, height: 40, borderRadius: 999, background: r.estado === 'ganhou' ? t.goldSoft : t.surface2, color: r.estado === 'ganhou' ? t.accent : t.textSec, display: 'grid', placeItems: 'center', fontFamily: RF_H, fontWeight: 800, fontSize: 15, flexShrink: 0, opacity: off ? 0.7 : 1 }}>{r.nome[0]}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, color: off ? t.textSec : t.text }}>{r.nome}</div>
        <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <RefStatePill estado={r.estado} ganho={r.ganho} />
          <span style={{ fontSize: 11.5, color: t.textTer, fontWeight: 600 }}>{r.data}</span>
        </div>
      </div>
      {r.estado === 'ganhou' && <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: RF_H, fontWeight: 800, fontSize: 19, color: t.good, letterSpacing: '-0.02em' }}>+{r.ganho}</div>
        {r.campanha && <div style={{ fontSize: 10.5, color: t.accent, fontWeight: 700 }}>em dobro</div>}
      </div>}
    </div>
  );
}

/* Hero espresso com proposta + código */
function RefHero({ cfg, paused }) {
  const t = useT();
  const X = refX(cfg);
  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: t.espresso, borderRadius: 24, padding: '20px 18px 18px', color: '#FAF5EC', boxShadow: t.shadow }}>
      <div style={{ position: 'absolute', right: -48, bottom: -56, opacity: 0.1 }}><BreadMark size={190} color={t.gold} /></div>
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', color: t.gold }}>INDIQUE E GANHE</span>
          {cfg.campanha && !paused && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: t.gold, color: t.onGold, fontSize: 11.5, fontWeight: 800 }}><Icon name="spark" size={12} stroke={2.6} />{cfg.campanha.rotulo} · até {cfg.campanha.fim}</span>}
        </div>
        {paused ? (
          <>
            <div style={{ fontFamily: RF_H, fontWeight: 800, fontSize: 26, letterSpacing: '-0.03em', lineHeight: 1.1, marginTop: 12 }}>O programa está pausado</div>
            <div style={{ fontSize: 13.5, color: 'rgba(250,245,236,0.72)', marginTop: 8, lineHeight: 1.45 }}>Por enquanto não dá pra fazer novas indicações. O que você já indicou continua valendo.</div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: RF_H, fontWeight: 800, fontSize: 27, letterSpacing: '-0.03em', lineHeight: 1.08, marginTop: 12, maxWidth: 290 }}>
              Indique um vizinho e ganhe <span style={{ color: t.gold }}>{paez(X)}</span>
            </div>
            {cfg.campanha && <div style={{ fontSize: 12.5, color: 'rgba(250,245,236,0.6)', marginTop: 6 }}>Em vez de {cfg.recompensa}, para quem indicar até {cfg.campanha.fim}.</div>}
            <div style={{ fontSize: 13.5, color: 'rgba(250,245,236,0.78)', marginTop: 8, lineHeight: 1.45 }}>
              {cfg.bonusAmigo > 0 ? <>Seu amigo ganha <b style={{ color: '#FAF5EC' }}>{paez(cfg.bonusAmigo)}</b> no primeiro pedido. </> : null}
              Vale quando o pão chegar na porta dele.
            </div>
            <div style={{ marginTop: 16 }}><RefCodeCard onDark /></div>
          </>
        )}
      </div>
    </div>
  );
}

function RefSection({ title, right, children }) {
  const t = useT();
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 4px 9px' }}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: t.textTer, textTransform: 'uppercase' }}>{title}</span>{right}
      </div>
      {children}
    </div>
  );
}

function RefHowItWorks({ cfg }) {
  const t = useT();
  const steps = [
    ['Compartilhe seu código', 'Pelo WhatsApp, pelo link ou ditando mesmo.'],
    ['Seu amigo se cadastra e faz o 1º pedido', `Ele tem ${cfg.prazoDias ? cfg.prazoDias + ' dias' : 'o tempo que quiser'} pra isso${cfg.compraMinima ? `, a partir de ${BRL(cfg.compraMinima)}` : ''}.`],
    [cfg.bonusAmigo > 0 ? 'O pão chegou? Vocês dois ganham' : 'O pão chegou? Você ganha', cfg.bonusAmigo > 0 ? `+${refX(cfg)} pra você, +${cfg.bonusAmigo} pra ele, na mesma hora.` : `+${refX(cfg)} pãezins caem no seu saldo na hora.`],
  ];
  return (
    <Card pad={16}>
      {steps.map(([a, b], i) => (
        <div key={i} style={{ display: 'flex', gap: 13, position: 'relative', paddingBottom: i < 2 ? 16 : 0 }}>
          {i < 2 && <div style={{ position: 'absolute', left: 15, top: 34, bottom: 2, width: 2, background: t.goldSoft, borderRadius: 2 }} />}
          <div style={{ width: 32, height: 32, borderRadius: 999, background: i === 2 ? t.gold : t.goldSoft, color: i === 2 ? t.onGold : t.accent, display: 'grid', placeItems: 'center', fontFamily: RF_H, fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{i === 2 ? <Icon name="gift" size={16} stroke={2.3} /> : i + 1}</div>
          <div style={{ paddingTop: 5 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: t.text, lineHeight: 1.3 }}>{a}</div>
            <div style={{ fontSize: 13, color: t.textSec, marginTop: 3, lineHeight: 1.45 }}>{b}</div>
          </div>
        </div>
      ))}
    </Card>
  );
}

function RefSummary({ list }) {
  const t = useT();
  const ganhos = list.filter(r => r.estado === 'ganhou').reduce((a, r) => a + r.ganho, 0);
  const valeram = list.filter(r => r.estado === 'ganhou').length;
  const andamento = list.filter(r => refEmAndamento(r.estado)).length;
  const cell = (n, l, c) => (
    <div style={{ flex: 1, padding: '4px 6px', textAlign: 'center' }}>
      <div style={{ fontFamily: RF_H, fontWeight: 800, fontSize: 26, letterSpacing: '-0.03em', color: c || t.text, lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: 11.5, color: t.textSec, fontWeight: 600, marginTop: 6, lineHeight: 1.3 }}>{l}</div>
    </div>
  );
  return (
    <Card pad={14} style={{ display: 'flex', alignItems: 'stretch' }}>
      {cell(ganhos, 'pãezins ganhos', t.good)}
      <div style={{ width: 1, background: t.border2 }} />
      {cell(valeram, valeram === 1 ? 'indicação valeu' : 'indicações valeram')}
      <div style={{ width: 1, background: t.border2 }} />
      {cell(andamento, 'em andamento')}
    </Card>
  );
}

/* Metas com progresso */
function RefGoals({ cfg, count }) {
  const t = useT();
  if (!cfg.metas || !cfg.metas.length) return null;
  const max = cfg.metas[cfg.metas.length - 1].quantidade;
  const next = cfg.metas.find(m => m.quantidade > count);
  const justHit = cfg.metas.find(m => m.quantidade === count);
  return (
    <Card pad={16}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: justHit ? t.goodSoft : t.goldSoft, color: justHit ? t.good : t.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={justHit ? 'star' : 'target'} size={19} /></div>
        <div style={{ flex: 1, fontSize: 14, color: t.text, fontWeight: 700, lineHeight: 1.35 }}>
          {justHit ? <>Meta atingida! <span style={{ color: t.good }}>+{justHit.bonus} pãezins</span> pela {justHit.quantidade}ª indicação</>
            : next ? <>Faltam {next.quantidade - count} {next.quantidade - count === 1 ? 'indicação' : 'indicações'} para ganhar <span style={{ color: t.accent }}>+{next.bonus} pãezins</span></>
            : <>Você bateu todas as metas. Que vizinhança!</>}
        </div>
      </div>
      {justHit && next && <div style={{ fontSize: 12.5, color: t.textSec, marginTop: 8, marginLeft: 48 }}>Próxima: +{next.bonus} na {next.quantidade}ª indicação.</div>}
      <div style={{ position: 'relative', height: 10, borderRadius: 99, background: t.surface2, marginTop: 16 }}>
        <div style={{ position: 'absolute', inset: 0, width: `${Math.min(100, (count / max) * 100)}%`, borderRadius: 99, background: t.gold }} />
      </div>
      <div style={{ position: 'relative', height: 30, marginTop: 6 }}>
        {cfg.metas.map(m => {
          const hit = count >= m.quantidade;
          return (
            <div key={m.quantidade} style={{ position: 'absolute', left: `${(m.quantidade / max) * 100}%`, transform: m.quantidade === max ? 'translateX(-100%)' : 'translateX(-50%)', textAlign: m.quantidade === max ? 'right' : 'center', whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: hit ? t.good : t.text }}>{hit && '✓ '}{m.quantidade}ª</div>
              <div style={{ fontSize: 11, color: t.textSec, fontWeight: 600 }}>+{m.bonus}</div>
            </div>
          );
        })}
        <div style={{ position: 'absolute', left: 0, fontSize: 11, color: t.textTer, fontWeight: 600 }}>{count} {count === 1 ? 'valeu' : 'valeram'}</div>
      </div>
    </Card>
  );
}

function RefRules({ cfg, open: open0 = false }) {
  const t = useT();
  const [open, setOpen] = React.useState(open0);
  const rules = [
    cfg.prazoDias ? `Seu amigo tem ${cfg.prazoDias} dias, a partir do cadastro, para fazer e receber o 1º pedido.` : 'Não há prazo para o 1º pedido do seu amigo.',
    cfg.compraMinima ? `O 1º pedido do amigo precisa ser de pelo menos ${BRL(cfg.compraMinima)}.` : 'Vale qualquer 1º pedido: pão ou Cestinha.',
    'Vale para quem ainda não tem conta no Cheirin — e só uma indicação por pessoa.',
    'Os pãezins do bônus não viram dinheiro e não expiram.',
    'Algumas indicações podem passar por uma análise rápida antes de valer.',
    'O programa pode ser encerrado. O que já foi indicado continua valendo.',
  ];
  return (
    <Card pad={0}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} style={{ width: '100%', minHeight: 52, padding: '0 16px', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', color: t.text, fontFamily: 'Hanken Grotesk' }}>
        <Icon name="doc" size={19} color={t.textSec} />
        <span style={{ flex: 1, textAlign: 'left', fontWeight: 700, fontSize: 14.5 }}>Regras</span>
        <Icon name="chevD" size={18} color={t.textTer} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>
      {open && <ul style={{ margin: 0, padding: '0 16px 16px 44px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rules.map((r, i) => <li key={i} style={{ fontSize: 13, color: t.textSec, lineHeight: 1.5 }}>{r}</li>)}
      </ul>}
    </Card>
  );
}

function RefSkel({ h = 16, w = '100%', r = 10, style }) {
  const t = useT();
  return <div style={{ height: h, width: w, borderRadius: r, background: `linear-gradient(90deg, ${t.surface2} 0%, ${t.surfaceAlt} 50%, ${t.surface2} 100%)`, backgroundSize: '200% 100%', animation: 'rfShimmer 1.3s linear infinite', ...style }} />;
}

function RefToast({ msg }) {
  const t = useT();
  if (!msg) return null;
  return <div role="status" style={{ position: 'absolute', left: 20, right: 20, bottom: 20, zIndex: 30, background: t.espresso, color: '#FAF5EC', borderRadius: 14, padding: '13px 16px', fontSize: 13.5, fontWeight: 600, display: 'flex', gap: 10, alignItems: 'center', boxShadow: t.shadow }}><Icon name="check" size={17} color={t.gold} stroke={2.4} />{msg}</div>;
}

/* ===== C1 — Tela "Indique e ganhe" =====
   st: full · loading · empty · campaign · goal · nobonus · paused · error */
function ReferralScreen({ go = () => {}, st = 'campaign' }) {
  const t = useT();
  const [toast, setToast] = React.useState(null);
  const onToast = m => { setToast(m); setTimeout(() => setToast(null), 2000); };
  const cfg = {
    ...REFERRAL_CFG,
    campanha: st === 'campaign' || st === 'goal' ? REFERRAL_CFG.campanha : null,
    bonusAmigo: st === 'nobonus' ? 0 : REFERRAL_CFG.bonusAmigo,
  };
  let list = MY_REFERRALS;
  if (st === 'empty') list = [];
  if (st === 'goal') list = [...MY_REFERRALS.slice(0, 2), { nome: 'Lúcia B.', estado: 'ganhou', data: '27/09', ganho: 10, campanha: true }, { nome: 'Tomás N.', estado: 'ganhou', data: '25/09', ganho: 10, campanha: true }, { nome: 'Cida P.', estado: 'ganhou', data: '22/09', ganho: 5 }, ...MY_REFERRALS.slice(2)];
  if (st === 'paused') list = MY_REFERRALS.filter(r => r.estado !== 'cadastro');
  const valeram = list.filter(r => r.estado === 'ganhou').length;

  let body;
  if (st === 'loading') body = (
    <>
      <div style={{ background: t.surface2, borderRadius: 24, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <RefSkel h={12} w={120} /><RefSkel h={28} w="85%" /><RefSkel h={28} w="60%" /><RefSkel h={14} w="75%" /><RefSkel h={74} r={18} style={{ marginTop: 6 }} />
      </div>
      <RefSkel h={56} r={16} /><div style={{ display: 'flex', gap: 10 }}><RefSkel h={48} r={16} /><RefSkel h={48} r={16} /></div>
      <RefSkel h={80} r={22} /><RefSkel h={180} r={22} />
    </>
  );
  else if (st === 'error') body = (
    <Card pad={24} style={{ textAlign: 'center', marginTop: 40 }}>
      <div style={{ width: 56, height: 56, borderRadius: 18, background: t.surface2, color: t.textSec, display: 'grid', placeItems: 'center', margin: '0 auto' }}><Icon name="refresh" size={26} /></div>
      <div style={{ fontFamily: RF_H, fontWeight: 700, fontSize: 19, color: t.text, marginTop: 14, letterSpacing: '-0.02em' }}>Não conseguimos carregar</div>
      <div style={{ fontSize: 13.5, color: t.textSec, marginTop: 6, lineHeight: 1.5 }}>Suas indicações estão guardadas. Confira a conexão e tente de novo.</div>
      <div style={{ marginTop: 18 }}><Btn icon="refresh" onClick={() => {}}>Tentar de novo</Btn></div>
    </Card>
  );
  else body = (
    <>
      <RefHero cfg={cfg} paused={st === 'paused'} />
      {st !== 'paused' && <RefShareButtons onToast={onToast} />}
      {st !== 'paused' && list.length === 0 && (
        <RefSection title="Como funciona"><RefHowItWorks cfg={cfg} /></RefSection>
      )}
      {list.length > 0 && <RefSection title="Seu resumo"><RefSummary list={list} /></RefSection>}
      {st !== 'paused' && list.length > 0 && <RefGoals cfg={cfg} count={valeram} />}
      <RefSection title="Seus indicados" right={list.length > 0 && <span style={{ fontSize: 12, color: t.textTer, fontWeight: 600 }}>Só você vê</span>}>
        {list.length === 0 ? (
          <Card pad={20} style={{ textAlign: 'center', background: t.surfaceAlt, border: `1.5px dashed ${t.border}`, boxShadow: 'none' }}>
            <div style={{ display: 'grid', placeItems: 'center' }}><BreadMark size={54} color={t.gold} /></div>
            <div style={{ fontFamily: RF_H, fontWeight: 700, fontSize: 17, color: t.text, marginTop: 4, letterSpacing: '-0.02em' }}>Sua lista começa aqui</div>
            <div style={{ fontSize: 13, color: t.textSec, marginTop: 5, lineHeight: 1.5 }}>Quem se cadastrar com o seu código aparece nesta lista — você acompanha cada passo até o pão chegar.</div>
          </Card>
        ) : (
          <Card pad={0} style={{ padding: '2px 16px' }}>
            {list.map((r, i) => <RefItem key={r.nome} r={r} last={i === list.length - 1} />)}
          </Card>
        )}
      </RefSection>
      {st !== 'paused' && list.length > 0 && <RefSection title="Como funciona"><RefHowItWorks cfg={cfg} /></RefSection>}
      <RefRules cfg={cfg} />
    </>
  );

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <AppBar title="Indique e ganhe" onBack={() => go('profile')} />
      <div style={{ padding: '0 20px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>{body}</div>
      <RefToast msg={toast} />
    </div>
  );
}

Object.assign(window, { RF_H, REF_STATE, refX, refEmAndamento, RefStatePill, RefCode, RefCodeCard, RefShareButtons, RefItem, RefHero, RefSection, RefHowItWorks, RefSummary, RefGoals, RefRules, RefSkel, RefToast, ReferralScreen });
