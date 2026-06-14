/* ============================================================
   Cheirin de Pão — Cliente: extras
   Compra automática · Acompanhamento · Notificações
   ============================================================ */

/* ---------- Compra recorrente automática (sec. 2.4) ---------- */
function AutoBuyScreen({ go }) {
  const t = useT();
  const [on, setOn] = React.useState(true);
  const [modo, setModo] = React.useState('acabar'); // semanal | acabar
  const [comboId, setComboId] = React.useState('c2');
  const [dia, setDia] = React.useState('dom');
  const combo = COMBOS.find(c => c.id === comboId);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <AppBar title="Compra automática" onBack={() => go('home')} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px' }}>
        <Card pad={18} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: t.goldSoft, display: 'grid', placeItems: 'center', color: t.accent, flexShrink: 0 }}><Icon name="repeat" size={23} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15.5, color: t.text }}>Reposição automática</div>
              <div style={{ fontSize: 12.5, color: t.textTer, marginTop: 2 }}>Nunca fique sem pão pro agendamento</div>
            </div>
            <Switch on={on} onChange={setOn} />
          </div>
        </Card>

        {on && (
          <>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec, margin: '6px 2px 9px' }}>QUANDO COMPRAR</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              {[
                { k: 'acabar', ic: 'alert', l: 'Quando estiver acabando', d: 'Compra sozinho quando o saldo não cobre o próximo agendamento' },
                { k: 'semanal', ic: 'calendar', l: 'Toda semana', d: 'Compra um combo no dia escolhido, sem falta' },
              ].map(o => {
                const sel = modo === o.k;
                return (
                  <div key={o.k} onClick={() => setModo(o.k)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 13, padding: 16, borderRadius: 18, background: t.surface, border: `2px solid ${sel ? t.accent : t.border2}` }}>
                    <div style={{ width: 26, height: 26, borderRadius: 99, border: `2px solid ${sel ? t.accent : t.border}`, display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1 }}>
                      {sel && <div style={{ width: 13, height: 13, borderRadius: 99, background: t.accent }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon name={o.ic} size={17} color={sel ? t.accent : t.textSec} />
                        <span style={{ fontWeight: 700, fontSize: 14.5, color: t.text }}>{o.l}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: t.textTer, marginTop: 4, lineHeight: 1.45 }}>{o.d}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {modo === 'semanal' && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec, margin: '0 2px 9px' }}>DIA DA COMPRA</div>
                <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4 }}>
                  {DIAS.map(d => (
                    <button key={d.k} onClick={() => setDia(d.k)} style={{ flexShrink: 0, padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${dia === d.k ? t.accent : t.border}`, background: dia === d.k ? t.goldSoft : t.surface, color: dia === d.k ? t.accent : t.text, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'Hanken Grotesk' }}>{d.curt}</button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec, margin: '0 2px 9px' }}>COMBO A REPOR</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {COMBOS.map(c => {
                const sel = comboId === c.id;
                return (
                  <div key={c.id} onClick={() => setComboId(c.id)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderRadius: 16, background: t.surface, border: `1.5px solid ${sel ? t.accent : t.border2}` }}>
                    <div style={{ width: 22, height: 22, borderRadius: 99, border: `2px solid ${sel ? t.accent : t.border}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{sel && <div style={{ width: 11, height: 11, borderRadius: 99, background: t.accent }} />}</div>
                    <div style={{ flex: 1, fontWeight: 700, fontSize: 14.5, color: t.text }}>{c.nome} <span style={{ color: t.textTer, fontWeight: 600 }}>· {c.qtd} pães</span></div>
                    <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 16, color: t.text }}>{BRL(c.preco)}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', background: t.surface2, borderRadius: 14 }}>
              <Icon name="card" size={18} color={t.textSec} />
              <div style={{ fontSize: 12.5, color: t.textSec, lineHeight: 1.45 }}>Cobramos no <b style={{ color: t.text }}>Pix salvo</b>. Você recebe um aviso a cada compra automática.</div>
            </div>
          </>
        )}
      </div>
      <div style={{ padding: '14px 20px', borderTop: `1px solid ${t.border2}`, background: t.appBg }}>
        <Btn full size="lg" icon="check" onClick={() => go('home')}>{on ? `Ativar — ${combo.nome} (${BRL(combo.preco)})` : 'Salvar'}</Btn>
      </div>
    </div>
  );
}

/* ---------- Acompanhamento da entrega: 3 estados (sec. 4.1) ---------- */
function TrackScreen({ go }) {
  const t = useT();
  const atual = 1; // 0 agendado · 1 saiu · 2 entregue
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <AppBar title="Sua entrega" onBack={() => go('home')} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px' }}>
        <Card pad={0} style={{ overflow: 'hidden', marginBottom: 18 }}>
          <div style={{ background: t.espresso, padding: '20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -36, right: -20, opacity: 0.13 }}><BreadMark size={150} color="#E3AC3F" /></div>
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 11.5, color: '#E3AC3F', fontWeight: 700, letterSpacing: '0.06em' }}>QUARTA · 11 JUN</div>
              <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 30, color: '#FAF5EC', marginTop: 4, letterSpacing: '-0.02em' }}>4 pãezinhos</div>
              <div style={{ fontSize: 13, color: '#C7B595', marginTop: 4 }}>Residencial Aurora · Bloco A · 102</div>
            </div>
          </div>
        </Card>

        <div style={{ position: 'relative', paddingLeft: 6 }}>
          {TRACK_STEPS.map((s, i) => {
            const done = i < atual, cur = i === atual;
            const c = done || cur ? t.accent : t.border;
            return (
              <div key={s.k} style={{ display: 'flex', gap: 16, position: 'relative' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 99, background: done || cur ? t.accent : t.surface, border: `2px solid ${c}`, display: 'grid', placeItems: 'center', flexShrink: 0, zIndex: 1 }}>
                    {done ? <Icon name="check" size={18} color={t.onGold} stroke={2.6} /> : <div style={{ width: 11, height: 11, borderRadius: 99, background: cur ? t.onGold : 'transparent' }} />}
                  </div>
                  {i < TRACK_STEPS.length - 1 && <div style={{ width: 2.5, flex: 1, minHeight: 38, background: done ? t.accent : t.border, margin: '2px 0' }} />}
                </div>
                <div style={{ paddingBottom: 26, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 16.5, color: done || cur ? t.text : t.textTer, letterSpacing: '-0.01em' }}>{s.label}</span>
                    {cur && <Pill tone="good"><span style={{ width: 6, height: 6, borderRadius: 99, background: t.good }} />agora</Pill>}
                  </div>
                  <div style={{ fontSize: 13, color: t.textSec, marginTop: 4, lineHeight: 1.45 }}>{s.desc}</div>
                  {s.hora !== '—' && <div style={{ fontSize: 11.5, color: t.textTer, marginTop: 4, fontWeight: 600 }}>{s.hora}</div>}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: t.surface, borderRadius: 16, border: `1px solid ${t.border2}` }}>
          <div style={{ width: 44, height: 44, borderRadius: 99, background: t.surface2, display: 'grid', placeItems: 'center', color: t.accent, flexShrink: 0 }}><Icon name="user" size={22} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: t.textTer, fontWeight: 600 }}>Seu entregador</div>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: t.text }}>Antônio Souza</div>
          </div>
          <button style={{ width: 40, height: 40, borderRadius: 12, background: t.goldSoft, border: 'none', display: 'grid', placeItems: 'center', color: t.accent, cursor: 'pointer' }}><Icon name="phone" size={19} /></button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Central de notificações / alertas (sec. 4) ---------- */
function NotifsScreen({ go }) {
  const t = useT();
  const notifs = [
    { ic: 'alert', tone: 'gold', titulo: 'Créditos insuficientes', txt: 'Seu sábado (6 pães) não está coberto. Você tem 4 créditos.', hora: 'Agora', cta: 'Comprar', to: 'combos', novo: true },
    { ic: 'truck', tone: 'good', titulo: 'Saiu para entrega', txt: 'Antônio está a caminho com seus 4 pãezinhos.', hora: '06:48', cta: 'Acompanhar', to: 'track', novo: true },
    { ic: 'bell', tone: 'neutral', titulo: 'Entrega amanhã', txt: 'Lembrete: 4 pães agendados para quinta, 07:00.', hora: 'Ontem, 19:00', cta: null },
    { ic: 'repeat', tone: 'neutral', titulo: 'Reconfigurar a semana', txt: 'Quer ajustar as quantidades da próxima semana?', hora: 'Dom, 20:00', cta: 'Ajustar agenda', to: 'schedule' },
    { ic: 'check', tone: 'neutral', titulo: 'Entrega realizada', txt: 'Seus 6 pães foram entregues. Bom apetite!', hora: 'Seg, 07:04', cta: null },
  ];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <AppBar title="Notificações" onBack={() => go('home')} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {notifs.map((n, i) => {
          const toneC = { gold: t.accent, good: t.good, neutral: t.textSec }[n.tone];
          const toneBg = { gold: t.goldSoft, good: t.goodSoft, neutral: t.surface2 }[n.tone];
          return (
            <Card key={i} pad={15} style={{ display: 'flex', gap: 13, position: 'relative', border: n.novo ? `1.5px solid ${t.accent}` : `1px solid ${t.border2}` }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: toneBg, display: 'grid', placeItems: 'center', color: toneC, flexShrink: 0 }}><Icon name={n.ic} size={21} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14.5, color: t.text, lineHeight: 1.25, flex: 1 }}>{n.titulo}</span>
                  <span style={{ fontSize: 11, color: t.textTer, fontWeight: 600, flexShrink: 0, marginTop: 2 }}>{n.hora}</span>
                </div>
                <div style={{ fontSize: 13, color: t.textSec, marginTop: 3, lineHeight: 1.45 }}>{n.txt}</div>
                {n.cta && <button onClick={() => go(n.to)} style={{ marginTop: 10, background: n.tone === 'gold' ? t.gold : t.surface2, color: n.tone === 'gold' ? t.onGold : t.text, border: 'none', borderRadius: 11, padding: '8px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Hanken Grotesk' }}>{n.cta}</button>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { AutoBuyScreen, TrackScreen, NotifsScreen });
