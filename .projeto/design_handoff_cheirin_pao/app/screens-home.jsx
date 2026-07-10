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

/* Card "entrega de hoje" compartilhado */
function TodayDelivery({ compact, go }) {
  const t = useT();
  return (
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
      <div style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="clock" size={17} color={t.accent} />
          <span style={{ fontSize: 13.5, color: t.textSec, fontWeight: 600 }}>Chega até <b style={{ color: t.text }}>7:15</b></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Pill tone="good"><span style={{ width: 6, height: 6, borderRadius: 99, background: t.good }} />A caminho</Pill>
          {go && <Icon name="chevR" size={17} color={t.textTer} />}
        </div>
      </div>
    </Card>
  );
}

/* ===== Variação A — "Carteira": saldo grande em destaque ===== */
function HomeA({ go, saldo }) {
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
        <NextDays />
      </div>
    </div>
  );
}

/* ===== Variação B — "Hoje primeiro": entrega no topo, saldo em barra ===== */
function HomeB({ go, saldo }) {
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
        <NextDays />
      </div>
    </div>
  );
}

/* ===== Variação C — "Padaria": editorial, foco no ritual ===== */
function HomeC({ go, saldo }) {
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
