/* ============================================================
   Cheirin de Pão — Home do Cliente (3 variações) + Histórico
   ============================================================ */

function AromaHeader({ saldo }) {
  const t = useT();
  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -30, right: -20, opacity: 0.07 }}><BreadMark size={180} color={t.gold} /></div>
    </div>
  );
}

/* Cabeçalho de saudação compartilhado */
function Greet({ saldo, go }) {
  const t = useT();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 20px 14px' }}>
      <div style={{ width: 42, height: 42, borderRadius: 13, background: t.espresso, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <BreadMark size={28} color="#E3AC3F" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: t.textTer, fontWeight: 600 }}>Bom dia, Marina</div>
        <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 17, color: t.text, letterSpacing: '-0.02em' }}>Residencial Aurora · A 102</div>
      </div>
      <button onClick={() => go && go('notifs')} style={{ width: 40, height: 40, borderRadius: 12, background: t.surface, border: `1px solid ${t.border2}`, display: 'grid', placeItems: 'center', color: t.text, cursor: 'pointer', position: 'relative' }}>
        <Icon name="bell" size={20} />
        <span style={{ position: 'absolute', top: 9, right: 9, width: 7, height: 7, borderRadius: 99, background: t.gold }} />
      </button>
    </div>
  );
}

/* Turnos de corte & entrega. Remova um item p/ exibir só manhã ou só tarde. */
const CUT_SLOTS = [
  { period: 'Manhã', corte: '22h', entrega: '6:30' },
  { period: 'Tarde', corte: '10h', entrega: '15:30' },
];

/* Card "entrega de hoje" com ticker: alterna linha de entrega ⇄ linha de corte */
function TodayDelivery({ compact, go, interval = 4800 }) {
  const t = useT();
  const [face, setFace] = React.useState(0); // 0 = entrega · 1 = corte
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    if (paused) return;
    const id = setTimeout(() => setFace(f => (f + 1) % 2), interval);
    return () => clearTimeout(id);
  }, [face, paused, interval]);

  const entregaFace = (
    <React.Fragment>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="clock" size={17} color={t.accent} />
          <span style={{ fontSize: 13.5, color: t.textSec, fontWeight: 600 }}>Chega até <b style={{ color: t.text }}>7:15</b></span>
        </div>
        <Pill tone="good"><span style={{ width: 6, height: 6, borderRadius: 99, background: t.good }} />A caminho</Pill>
      </div>
      <div style={{ fontSize: 11, color: t.textTer, fontWeight: 500, marginTop: 4 }}>Sai quentinho do forno, direto pra sua porta.</div>
    </React.Fragment>
  );

  const corteFace = (
    <React.Fragment>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <Icon name="scissors" size={15} color={t.accent} stroke={2} />
          <span style={{ fontSize: 10.5, color: t.textTer, fontWeight: 700, letterSpacing: '0.06em' }}>CORTE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1, justifyContent: 'flex-end' }}>
          {CUT_SLOTS.map((s, i) => (
            <React.Fragment key={s.period}>
              {i > 0 && <span style={{ width: 3, height: 3, borderRadius: 99, background: t.border, flexShrink: 0 }} />}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 12, color: t.textSec, fontWeight: 600 }}>{s.period}</span>
                <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 13.5, color: t.text }}>{s.corte}</span>
                <Icon name="chevR" size={11} color={t.textTer} stroke={2.6} />
                <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 13.5, color: t.accent }}>{s.entrega}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 11, color: t.textTer, fontWeight: 500, marginTop: 4 }}>Peça até o horário de corte para a próxima entrega.</div>
    </React.Fragment>
  );

  const faces = [entregaFace, corteFace];

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <Card pad={0} onClick={() => go && go('track')} style={{ overflow: 'hidden', cursor: go ? 'pointer' : 'default' }}>
        <div style={{ background: t.espresso, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 13, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -20, opacity: 0.13 }}><BreadMark size={140} color="#E3AC3F" /></div>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(227,172,63,0.16)', display: 'grid', placeItems: 'center', flexShrink: 0, position: 'relative' }}>
            <Icon name="truck" size={24} color="#E3AC3F" />
          </div>
          <div style={{ flex: 1, position: 'relative' }}>
            <div style={{ fontSize: 11.5, color: '#E3AC3F', fontWeight: 700, letterSpacing: '0.06em' }}>SAINDO DO FORNO</div>
            <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 18, color: '#FAF5EC', marginTop: 2 }}>Entrega de hoje · 4 pães</div>
          </div>
        </div>
        <div style={{ padding: '11px 18px 13px' }}>
          <div style={{ position: 'relative', height: 44 }}>
            {faces.map((node, idx) => {
              const active = idx === face;
              return (
                <div key={idx} aria-hidden={!active}
                  style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center',
                    opacity: active ? 1 : 0,
                    transform: active ? 'translateY(0)' : 'translateY(6px)',
                    pointerEvents: active ? 'auto' : 'none',
                    transition: 'opacity .55s cubic-bezier(.22,1,.36,1), transform .55s cubic-bezier(.22,1,.36,1)',
                  }}>
                  {node}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 }}>
        {faces.map((_, idx) => {
          const active = idx === face;
          return (
            <button key={idx} onClick={() => setFace(idx)} aria-label={idx === 0 ? 'Entrega' : 'Corte'}
              style={{
                height: 5, width: active ? 16 : 5, borderRadius: 99, border: 'none', padding: 0, cursor: 'pointer',
                background: active ? t.gold : t.border,
                transition: 'width .45s cubic-bezier(.22,1,.36,1), background .3s',
              }} />
          );
        })}
      </div>
    </div>
  );
}

/* ===== Variação A — "Carteira": saldo grande em destaque ===== */
function HomeA({ go, saldo, mkt }) {
  const t = useT();
  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 90 }}>
      <Greet saldo={saldo} go={go} />
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <div style={{ background: `linear-gradient(135deg, ${t.espresso}, #2E1D0D)`, padding: '22px 22px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', bottom: -50, right: -30, opacity: 0.1 }}><BreadMark size={200} color="#E3AC3F" /></div>
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 12.5, color: '#C7B595', fontWeight: 600, letterSpacing: '0.04em' }}>SEUS CRÉDITOS</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 52, color: '#FAF5EC', lineHeight: 1, letterSpacing: '-0.03em' }}>{saldo}</span>
                <span style={{ fontSize: 16, color: '#E3AC3F', fontWeight: 700 }}>pães</span>
              </div>
              <div style={{ fontSize: 12.5, color: '#9A876B', marginTop: 8 }}>Rende ~{Math.floor(saldo / 4)} dias no seu ritmo atual</div>
            </div>
          </div>
          <div style={{ display: 'flex', padding: 12, gap: 10 }}>
            <Btn variant="gold" full icon="plus" onClick={() => go('combos')}>Comprar créditos</Btn>
            <Btn variant="soft" icon="clock" onClick={() => go('history')} style={{ flexShrink: 0 }}>Extrato</Btn>
          </div>
        </Card>
        <TodayDelivery go={go} />
        <QuickActions go={go} />
        {REFERRAL_CFG.ativo && <HomeRefSlot go={go} />}
        {mkt && <MarketHomeBlock mkt={mkt} />}
        <NextDays />
      </div>
    </div>
  );
}

/* C3 — card "Indique e ganhe": só para quem já recebeu ≥ 1 entrega; fechado some por 30 dias */
function HomeRefSlot({ go }) {
  const [closed, setClosed] = React.useState(() => { try { return Date.now() < (JSON.parse(localStorage.getItem('cheirin_ref_home')) || 0); } catch { return false; } });
  if (closed) return null;
  const close = () => { try { localStorage.setItem('cheirin_ref_home', JSON.stringify(Date.now() + 30 * 864e5)); } catch {} setClosed(true); };
  return <RefHomeCard go={go} st={REFERRAL_CFG.campanha ? 'campaign' : 'normal'} onClose={close} />;
}

/* ===== Variação B — "Hoje primeiro": entrega no topo, saldo em barra ===== */
function HomeB({ go, saldo, mkt }) {
  const t = useT();
  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 90 }}>
      <Greet saldo={saldo} go={go} />
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <TodayDelivery go={go} />
        <div onClick={() => go('combos')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, background: t.surface, borderRadius: 18, border: `1px solid ${t.border2}`, padding: '14px 16px', boxShadow: t.shadowSoft }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: t.goldSoft, display: 'grid', placeItems: 'center', color: t.accent, flexShrink: 0 }}><Icon name="wallet" size={22} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, color: t.textTer, fontWeight: 600 }}>Créditos</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 24, color: t.text, letterSpacing: '-0.02em' }}>{saldo}</span>
              <span style={{ fontSize: 13, color: t.textSec, fontWeight: 600 }}>pães · ~{Math.floor(saldo / 4)} dias</span>
            </div>
          </div>
          <Btn variant="gold" size="sm" icon="plus">Recarregar</Btn>
        </div>
        <QuickActions go={go} />
        {mkt && <MarketHomeBlock mkt={mkt} />}
        <NextDays />
      </div>
    </div>
  );
}

/* ===== Variação C — "Padaria": editorial, foco no ritual ===== */
function HomeC({ go, saldo, mkt }) {
  const t = useT();
  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 90 }}>
      <div style={{ padding: '6px 22px 18px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -16, opacity: 0.06 }}><BreadMark size={150} color={t.accent} /></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 13, color: t.textTer, fontWeight: 600 }}>Quarta-feira, 11 de junho</div>
            <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 30, letterSpacing: '-0.03em', color: t.text, lineHeight: 1.05, marginTop: 6 }}>Bom dia,<br />Marina ☕</div>
          </div>
          <button onClick={() => go('notifs')} style={{ width: 40, height: 40, borderRadius: 12, background: t.surface, border: `1px solid ${t.border2}`, display: 'grid', placeItems: 'center', color: t.text, cursor: 'pointer' }}><Icon name="bell" size={20} /></button>
        </div>
      </div>
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <TodayDelivery go={go} />
        <div style={{ display: 'flex', gap: 12 }}>
          <Card style={{ flex: 1 }} pad={16}>
            <Icon name="wallet" size={22} color={t.accent} />
            <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 30, color: t.text, marginTop: 10, letterSpacing: '-0.02em' }}>{saldo}</div>
            <div style={{ fontSize: 12.5, color: t.textSec, fontWeight: 600 }}>créditos</div>
          </Card>
          <Card style={{ flex: 1 }} pad={16}>
            <Icon name="calendar" size={22} color={t.accent} />
            <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 30, color: t.text, marginTop: 10, letterSpacing: '-0.02em' }}>5×</div>
            <div style={{ fontSize: 12.5, color: t.textSec, fontWeight: 600 }}>por semana</div>
          </Card>
        </div>
        <Btn variant="gold" full size="lg" icon="plus" onClick={() => go('combos')}>Comprar mais créditos</Btn>
        <QuickActions go={go} />
        {mkt && <MarketHomeBlock mkt={mkt} />}
        <NextDays />
      </div>
    </div>
  );
}

function QuickActions({ go }) {
  const t = useT();
  const items = [
    { ic: 'calendar', label: 'Agenda', sub: 'Semanal', to: 'schedule' },
    { ic: 'bag', label: 'Avulso', sub: 'Pedir hoje', to: 'single' },
    { ic: 'clock', label: 'Histórico', sub: 'Pedidos', to: 'history' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
      {items.map(it => (
        <Card key={it.to} pad={13} onClick={() => go(it.to)} style={{ cursor: 'pointer', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: t.surface2, display: 'grid', placeItems: 'center', color: t.accent }}><Icon name={it.ic} size={20} /></div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: t.text }}>{it.label}</div>
            <div style={{ fontSize: 10.5, color: t.textTer }}>{it.sub}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function NextDays() {
  const t = useT();
  const plan = [
    { d: 'Qui', n: 12, ativo: true, qtd: 4 },
    { d: 'Sex', n: 13, ativo: true, qtd: 4 },
    { d: 'Sáb', n: 14, ativo: true, qtd: 6 },
    { d: 'Dom', n: 15, ativo: false, qtd: 0 },
    { d: 'Seg', n: 16, ativo: true, qtd: 4 },
  ];
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '4px 2px 10px' }}>
        <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 16, color: t.text, letterSpacing: '-0.02em' }}>Próximas entregas</div>
        <span style={{ fontSize: 13, color: t.accent, fontWeight: 700 }}>Editar agenda</span>
      </div>
      <div style={{ display: 'flex', gap: 9, overflowX: 'auto', paddingBottom: 4 }}>
        {plan.map((p, i) => (
          <div key={i} style={{ flexShrink: 0, width: 62, textAlign: 'center', padding: '12px 0', borderRadius: 16, background: p.ativo ? t.surface : 'transparent', border: `1.5px solid ${p.ativo ? t.border2 : t.border}`, opacity: p.ativo ? 1 : 0.5 }}>
            <div style={{ fontSize: 11.5, color: t.textTer, fontWeight: 600 }}>{p.d}</div>
            <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 20, color: t.text, margin: '2px 0' }}>{p.n}</div>
            {p.ativo ? <Pill tone="gold" style={{ padding: '2px 7px', fontSize: 10 }}>{p.qtd}🥖</Pill> : <span style={{ fontSize: 10.5, color: t.textTer }}>folga</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Histórico ---------- */
function HistoryScreen({ go }) {
  const t = useT();
  const [mkCancel, setMkCancel] = React.useState(false);
  const mo = MARKET_ORDER;
  const stMap = {
    a_caminho: { tone: 'good', label: 'A caminho' },
    entregue: { tone: 'neutral', label: 'Entregue' },
  };
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <AppBar title="Histórico" onBack={() => go('home')} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <Card style={{ flex: 1 }} pad={14}>
            <div style={{ fontSize: 12, color: t.textSec, fontWeight: 600 }}>Este mês</div>
            <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 26, color: t.text, marginTop: 3 }}>26 pães</div>
          </Card>
          <Card style={{ flex: 1 }} pad={14}>
            <div style={{ fontSize: 12, color: t.textSec, fontWeight: 600 }}>Economia c/ combo</div>
            <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 26, color: t.good, marginTop: 3 }}>{BRL(14)}</div>
          </Card>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Card pad={14} style={{ border: `1px solid ${mkCancel ? t.border2 : t.gold}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: t.goldSoft, display: 'grid', placeItems: 'center', color: t.accent, flexShrink: 0 }}>
                <Icon name="basket" size={21} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: t.text }}>Cestinha do mercadinho</div>
                <div style={{ fontSize: 12.5, color: t.textTer, marginTop: 1 }}>{mo.data} · chega junto com o pão · {mo.hora}</div>
              </div>
              <Pill tone={mkCancel ? 'neutral' : 'gold'}>{mkCancel ? 'Cancelado' : 'Agendado'}</Pill>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border2}`, opacity: mkCancel ? 0.5 : 1 }}>
              {mo.itens.map((it, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: t.surface2, fontSize: 12, color: t.text, fontWeight: 600 }}><span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, color: t.accent }}>{it.qtd}×</span>{it.nome}</span>
              ))}
            </div>
            {mkCancel ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 12, padding: '10px 13px', background: t.goodSoft, borderRadius: 12 }}>
                <Icon name="refresh" size={16} color={t.good} />
                <span style={{ fontSize: 12.5, color: t.good, fontWeight: 700 }}>Cancelado · estornado em 12 pãezinhos</span>
              </div>
            ) : mo.cancelavel && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                <button onClick={() => setMkCancel(true)} style={{ flex: 1, background: t.surface2, border: 'none', borderRadius: 11, padding: '9px 0', fontWeight: 700, fontSize: 13, color: t.textSec, cursor: 'pointer', fontFamily: 'Hanken Grotesk', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}><Icon name="x" size={15} />Cancelar</button>
                <button onClick={() => go('track')} style={{ flex: 1, background: t.gold, border: 'none', borderRadius: 11, padding: '9px 0', fontWeight: 700, fontSize: 13, color: t.onGold, cursor: 'pointer', fontFamily: 'Hanken Grotesk', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}><Icon name="truck" size={15} />Acompanhar</button>
              </div>
            )}
            {!mkCancel && <div style={{ fontSize: 11, color: t.textTer, marginTop: 8, textAlign: 'center' }}>Cancelamento disponível só antes do corte</div>}
          </Card>
          {ORDERS.map(o => {
            const st = stMap[o.status];
            return (
              <Card key={o.id} pad={14} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: t.surface2, display: 'grid', placeItems: 'center', color: t.accent, flexShrink: 0 }}>
                  <Icon name={o.tipo === 'Agendamento' ? 'calendar' : 'bag'} size={21} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: t.text }}>{o.data}</div>
                  <div style={{ fontSize: 12.5, color: t.textTer, marginTop: 1 }}>{o.tipo} · {o.hora} · {o.qtd} pães</div>
                </div>
                <Pill tone={st.tone}>{o.status === 'a_caminho' && <span style={{ width: 6, height: 6, borderRadius: 99, background: t.good }} />}{st.label}</Pill>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { HomeA, HomeB, HomeC, HistoryScreen, Greet, TodayDelivery, QuickActions, NextDays });
