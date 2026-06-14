/* ============================================================
   Cheirin de Pão — Combos, Agendamento, Pedido único
   ============================================================ */

/* ---------- Comprar créditos: Combos OU Compra personalizada ---------- */
function CombosScreen({ go, onBuy, pricing }) {
  const t = useT();
  const [mode, setMode] = React.useState('combo');
  const [sel, setSel] = React.useState('c2');
  // melhor preço/pão entre os combos, p/ comparar com o avulso
  const melhorCombo = COMBOS.reduce((m, c) => (c.preco / c.qtd) < (m.preco / m.qtd) ? c : m, COMBOS[0]);
  const comboUnit = melhorCombo.preco / melhorCombo.qtd;
  const economia = Math.round((1 - comboUnit / pricing.avulsoUnit) * 100);

  /* ---- modo: COMPRA PERSONALIZADA ---- */
  const [qtd, setQtd] = React.useState(5);
  const maxAvulso = pricing.avulsoLimite - 1;
  const totalAvulso = qtd * pricing.avulsoUnit;
  const noLimite = qtd >= maxAvulso;

  const combo = COMBOS.find(c => c.id === sel);
  const unit = combo ? combo.preco / combo.qtd : 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <AppBar title="Comprar créditos" onBack={() => go('home')} />
      <div style={{ padding: '0 20px 14px' }}>
        <div style={{ display: 'flex', gap: 6, background: t.surface2, borderRadius: 14, padding: 4 }}>
          {[['combo', 'Combos'], ['avulso', 'Compra personalizada']].map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13.5, fontFamily: 'Hanken Grotesk', background: mode === k ? t.surface : 'transparent', color: mode === k ? t.text : t.textSec, boxShadow: mode === k ? t.shadowSoft : 'none' }}>{l}</button>
          ))}
        </div>
      </div>

      {mode === 'combo' ? (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px' }}>
            <div style={{ fontSize: 14, color: t.textSec, lineHeight: 1.5, marginBottom: 18 }}>
              Cada crédito vale <b style={{ color: t.text }}>um pão fresquinho</b>. Quanto maior o combo, menor o preço por pão.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {COMBOS.map(c => {
                const on = sel === c.id;
                const u = c.preco / c.qtd;
                return (
                  <div key={c.id} onClick={() => setSel(c.id)} style={{ cursor: 'pointer', position: 'relative', background: t.surface, borderRadius: 22, border: `2px solid ${on ? t.accent : t.border2}`, padding: 18, boxShadow: on ? t.shadow : t.shadowSoft, transition: 'border-color .15s, box-shadow .15s' }}>
                    {c.tag && <div style={{ position: 'absolute', top: -10, left: 18, background: t.gold, color: t.onGold, fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 99, letterSpacing: '0.02em' }}>{c.tag}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 99, border: `2px solid ${on ? t.accent : t.border}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        {on && <div style={{ width: 13, height: 13, borderRadius: 99, background: t.accent }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 18, color: t.text, letterSpacing: '-0.02em' }}>{c.nome}</div>
                        <div style={{ fontSize: 13, color: t.textTer, marginTop: 1 }}>{c.qtd} pães · {c.desc}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {c.antes && <div style={{ fontSize: 12, color: t.textTer, textDecoration: 'line-through' }}>{BRL(c.antes)}</div>}
                        <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 22, color: on ? t.accent : t.text, letterSpacing: '-0.02em' }}>{BRL(c.preco)}</div>
                        <div style={{ fontSize: 11, color: t.textTer }}>{BRL(u)}/pão</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: t.goodSoft, borderRadius: 16 }}>
              <Icon name="gift" size={20} color={t.good} />
              <div style={{ fontSize: 13, color: t.good, fontWeight: 600, lineHeight: 1.4 }}>Créditos não expiram. Pause quando viajar.</div>
            </div>
            <div onClick={() => go('autobuy')} style={{ cursor: 'pointer', marginTop: 10, display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px', background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 16 }}>
              <Icon name="repeat" size={19} color={t.accent} />
              <div style={{ flex: 1, fontSize: 13, color: t.textSec, fontWeight: 600, lineHeight: 1.4 }}>Quer no automático? <b style={{ color: t.text }}>Ative a reposição</b> semanal ou quando acabar.</div>
              <Icon name="chevR" size={18} color={t.textTer} />
            </div>
          </div>
          <div style={{ padding: '14px 20px', borderTop: `1px solid ${t.border2}`, background: t.appBg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12.5, color: t.textSec, fontWeight: 600 }}>{combo.qtd} créditos · {BRL(unit)}/pão</div>
                <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 24, color: t.text, letterSpacing: '-0.02em' }}>{BRL(combo.preco)}</div>
              </div>
              <Pill tone="gold"><Icon name="card" size={13} />Pix ou cartão</Pill>
            </div>
            <Btn full size="lg" icon="check" onClick={() => { onBuy(combo.qtd); go('purchased'); }}>Comprar {combo.nome}</Btn>
          </div>
        </>
      ) : (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px' }}>
            <div style={{ fontSize: 14, color: t.textSec, lineHeight: 1.5, marginBottom: 18 }}>
              Precisa de pouco? Escolha a quantidade exata. Vale até <b style={{ color: t.text }}>{maxAvulso} pães</b> — acima disso, o combo compensa muito mais.
            </div>

            <Card pad={22} style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec, marginBottom: 16 }}>QUANTOS PÃES?</div>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24 }}>
                <button onClick={() => setQtd(q => Math.max(1, q - 1))} style={{ width: 48, height: 48, borderRadius: 16, border: `1.5px solid ${t.border}`, background: t.surface, color: t.text, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="minus" size={22} stroke={2.4} /></button>
                <div style={{ minWidth: 80 }}>
                  <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 56, color: t.accent, lineHeight: 1, letterSpacing: '-0.03em' }}>{qtd}</div>
                </div>
                <button onClick={() => setQtd(q => Math.min(maxAvulso, q + 1))} disabled={qtd >= maxAvulso} style={{ width: 48, height: 48, borderRadius: 16, border: `1.5px solid ${t.border}`, background: t.surface, color: qtd >= maxAvulso ? t.textTer : t.text, opacity: qtd >= maxAvulso ? 0.5 : 1, display: 'grid', placeItems: 'center', cursor: qtd >= maxAvulso ? 'default' : 'pointer' }}><Icon name="plus" size={22} stroke={2.4} /></button>
              </div>
              <div style={{ marginTop: 14, fontSize: 13, color: t.textSec, fontWeight: 600 }}>{BRL(pricing.avulsoUnit)} por pão</div>
            </Card>

            {/* Comparativo avulso vs combo */}
            <div style={{ borderRadius: 18, border: `1px solid ${t.border2}`, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: t.surface }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: t.surface2, display: 'grid', placeItems: 'center', color: t.textSec }}><Icon name="coin" size={18} /></div>
                  <div style={{ fontSize: 13.5, color: t.text, fontWeight: 700 }}>Compra personalizada</div>
                </div>
                <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 16, color: t.text }}>{BRL(pricing.avulsoUnit)}<span style={{ fontSize: 11, color: t.textTer, fontWeight: 600 }}>/pão</span></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: t.goldSoft, borderTop: `1px solid ${t.border2}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: t.gold, display: 'grid', placeItems: 'center', color: t.onGold }}><Icon name="bag" size={18} /></div>
                  <div>
                    <div style={{ fontSize: 13.5, color: t.text, fontWeight: 700 }}>Combo {melhorCombo.nome}</div>
                    <div style={{ fontSize: 11.5, color: t.accent, fontWeight: 700 }}>{economia}% mais barato por pão</div>
                  </div>
                </div>
                <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 16, color: t.accent }}>{BRL(comboUnit)}<span style={{ fontSize: 11, color: t.accent, fontWeight: 600, opacity: 0.7 }}>/pão</span></div>
              </div>
            </div>

            {noLimite && (
              <div onClick={() => setMode('combo')} style={{ cursor: 'pointer', marginTop: 14, display: 'flex', alignItems: 'center', gap: 11, padding: '13px 16px', background: t.surface, border: `1.5px solid ${t.accent}`, borderRadius: 16 }}>
                <Icon name="spark" size={20} color={t.accent} />
                <div style={{ flex: 1, fontSize: 13, color: t.text, fontWeight: 600, lineHeight: 1.4 }}>A partir de <b>{pricing.avulsoLimite} pães</b> só dá pra comprar via combo — e sai bem mais em conta.</div>
                <Icon name="chevR" size={18} color={t.accent} />
              </div>
            )}
          </div>
          <div style={{ padding: '14px 20px', borderTop: `1px solid ${t.border2}`, background: t.appBg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12.5, color: t.textSec, fontWeight: 600 }}>{qtd} créditos · {BRL(pricing.avulsoUnit)}/pão</div>
                <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 24, color: t.text, letterSpacing: '-0.02em' }}>{BRL(totalAvulso)}</div>
              </div>
              <Pill tone="gold"><Icon name="card" size={13} />Pix ou cartão</Pill>
            </div>
            <Btn full size="lg" icon="check" onClick={() => { onBuy(qtd); go('purchased'); }}>Comprar {qtd} pães</Btn>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Confirmação de compra ---------- */
function PurchasedScreen({ go, lastBuy }) {
  const t = useT();
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
      <div style={{ width: 96, height: 96, borderRadius: '30%', background: t.goodSoft, display: 'grid', placeItems: 'center', marginBottom: 24 }}>
        <Icon name="check" size={48} color={t.good} stroke={2.4} />
      </div>
      <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 26, letterSpacing: '-0.03em', color: t.text }}>Créditos na conta!</div>
      <div style={{ fontSize: 15, color: t.textSec, marginTop: 10, lineHeight: 1.5, maxWidth: 280 }}>
        <b style={{ color: t.text }}>+{lastBuy} pães</b> adicionados. Agora é só deixar a agenda no jeito.
      </div>
      <div style={{ height: 32 }} />
      <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 11 }}>
        <Btn full size="lg" icon="calendar" onClick={() => go('schedule')}>Montar minha agenda</Btn>
        <Btn variant="ghost" full onClick={() => go('home')}>Voltar ao início</Btn>
      </div>
    </div>
  );
}

/* ---------- Agendamento semanal recorrente (sec. 3.2 / 3.3) ---------- */
function ScheduleScreen({ go, saldo = 38 }) {
  const t = useT();
  const [plan, setPlan] = React.useState({ seg: 4, ter: 4, qua: 4, qui: 4, sex: 4, sab: 6, dom: 0 });
  const [hora, setHora] = React.useState('07:00');
  const [reconfig, setReconfig] = React.useState(true);
  const semana = Object.values(plan).reduce((a, b) => a + b, 0);
  const cobre = Math.floor(saldo / (semana || 1));
  const falta = semana > saldo;
  const setDay = (k, v) => setPlan(p => ({ ...p, [k]: Math.max(0, v) }));
  const horas = ['06:30', '07:00', '07:30', '08:00'];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <AppBar title="Agenda semanal" onBack={() => go('home')} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px' }}>
        <div style={{ fontSize: 14, color: t.textSec, lineHeight: 1.5, marginBottom: 16 }}>
          Quantos pães em cada dia. A gente entrega sozinho, todo dia, no horário escolhido.
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec, marginBottom: 9 }}>Horário de entrega</div>
          <div style={{ display: 'flex', gap: 9 }}>
            {horas.map(h => (
              <button key={h} onClick={() => setHora(h)} style={{ flex: 1, padding: '11px 0', borderRadius: 13, border: `1.5px solid ${hora === h ? t.accent : t.border}`, background: hora === h ? t.goldSoft : t.surface, color: hora === h ? t.accent : t.text, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'Hanken Grotesk' }}>{h}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DIAS.map(d => {
            const v = plan[d.k];
            const folga = v === 0;
            return (
              <div key={d.k} style={{ display: 'flex', alignItems: 'center', gap: 14, background: t.surface, borderRadius: 18, border: `1px solid ${t.border2}`, padding: '12px 16px', opacity: folga ? 0.66 : 1 }}>
                <div style={{ width: 44, flexShrink: 0 }}>
                  <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 15, color: t.text }}>{d.curt}</div>
                  <div style={{ fontSize: 11, color: t.textTer }}>{folga ? 'folga' : `${v} pães`}</div>
                </div>
                <div style={{ flex: 1 }} />
                <Stepper value={v} onChange={nv => setDay(d.k, nv)} max={12} />
              </div>
            );
          })}
        </div>

        {/* Reconfiguração semanal (sec. 3.3) */}
        <Card pad={16} style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: t.surface2, display: 'grid', placeItems: 'center', color: t.accent, flexShrink: 0 }}><Icon name="repeat" size={20} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: t.text }}>Lembrar de reconfigurar</div>
              <div style={{ fontSize: 12, color: t.textTer, marginTop: 2 }}>Aviso no domingo à noite p/ ajustar a semana</div>
            </div>
            <Switch on={reconfig} onChange={setReconfig} />
          </div>
        </Card>

        {/* Alerta de cobertura de créditos (sec. 4) */}
        {falta ? (
          <div onClick={() => go('combos')} style={{ cursor: 'pointer', marginTop: 14, display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px', background: t.goldSoft, border: `1.5px solid ${t.gold}`, borderRadius: 16 }}>
            <Icon name="alert" size={20} color={t.accent} />
            <div style={{ flex: 1, fontSize: 13, color: t.text, fontWeight: 600, lineHeight: 1.45 }}>Seu saldo ({saldo}) não cobre a semana ({semana}). <b>Compre um combo</b> ou ative a reposição automática.</div>
            <Icon name="chevR" size={18} color={t.accent} />
          </div>
        ) : (
          <div onClick={() => go('autobuy')} style={{ cursor: 'pointer', marginTop: 14, display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px', background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 16 }}>
            <Icon name="repeat" size={19} color={t.accent} />
            <div style={{ flex: 1, fontSize: 13, color: t.textSec, fontWeight: 600, lineHeight: 1.45 }}>Saldo cobre <b style={{ color: t.text }}>~{cobre} semanas</b>. Ative a compra automática pra nunca faltar.</div>
            <Icon name="chevR" size={18} color={t.textTer} />
          </div>
        )}
      </div>
      <div style={{ padding: '14px 20px', borderTop: `1px solid ${t.border2}`, background: t.appBg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13.5, color: t.textSec, fontWeight: 600 }}>Consumo semanal</span>
          <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 18, color: t.text }}>{semana} pães · {hora}</span>
        </div>
        <Btn full size="lg" icon="check" onClick={() => go('home')}>Salvar agenda</Btn>
      </div>
    </div>
  );
}

/* ---------- Pedido único (avulso): usa créditos para agendar uma data ---------- */
function SingleScreen({ go, saldo }) {
  const t = useT();
  const [qtd, setQtd] = React.useState(6);
  const [quando, setQuando] = React.useState('amanha');
  const semCredito = qtd > saldo;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <AppBar title="Pedido único" onBack={() => go('home')} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px' }}>
        <div style={{ fontSize: 14, color: t.textSec, lineHeight: 1.5, marginBottom: 18 }}>
          Agende uma entrega avulsa para uma data. Os créditos são reservados na hora.
        </div>

        <Card pad={22} style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec, marginBottom: 16 }}>QUANTOS PÃES?</div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24 }}>
            <button onClick={() => setQtd(q => Math.max(1, q - 1))} style={{ width: 48, height: 48, borderRadius: 16, border: `1.5px solid ${t.border}`, background: t.surface, color: t.text, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="minus" size={22} stroke={2.4} /></button>
            <div style={{ minWidth: 72 }}>
              <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 56, color: semCredito ? t.warn : t.accent, lineHeight: 1, letterSpacing: '-0.03em' }}>{qtd}</div>
            </div>
            <button onClick={() => setQtd(q => Math.min(20, q + 1))} style={{ width: 48, height: 48, borderRadius: 16, border: `1.5px solid ${t.border}`, background: t.surface, color: t.text, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="plus" size={22} stroke={2.4} /></button>
          </div>
        </Card>

        <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec, marginBottom: 9 }}>Para quando?</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {[{ k: 'amanha', l: 'Amanhã cedo', s: 'Qui, 7:00' }, { k: 'sabado', l: 'Sábado', s: '14 jun, 8:00' }].map(o => (
            <div key={o.k} onClick={() => setQuando(o.k)} style={{ flex: 1, cursor: 'pointer', padding: '13px 14px', borderRadius: 16, border: `1.5px solid ${quando === o.k ? t.accent : t.border}`, background: quando === o.k ? t.goldSoft : t.surface }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: quando === o.k ? t.accent : t.text }}>{o.l}</div>
              <div style={{ fontSize: 12, color: t.textTer, marginTop: 2 }}>{o.s}</div>
            </div>
          ))}
        </div>

        {semCredito ? (
          <div style={{ padding: 16, background: t.goldSoft, border: `1.5px solid ${t.gold}`, borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
              <Icon name="spark" size={20} color={t.accent} />
              <div style={{ flex: 1, fontSize: 13.5, color: t.text, fontWeight: 700, lineHeight: 1.4 }}>Créditos insuficientes</div>
            </div>
            <div style={{ fontSize: 13, color: t.textSec, lineHeight: 1.5, marginBottom: 14 }}>
              Você tem <b style={{ color: t.text }}>{saldo} créditos</b> e precisa de <b style={{ color: t.text }}>{qtd}</b>. Compre mais ou ajuste a quantidade.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="gold" full icon="plus" size="sm" onClick={() => go('combos')}>Comprar créditos</Btn>
              <Btn variant="ghost" size="sm" onClick={() => setQtd(saldo)} style={{ flexShrink: 0 }}>Usar {saldo}</Btn>
            </div>
          </div>
        ) : (
          <Card pad={16}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <Icon name="wallet" size={20} color={t.accent} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>Usar créditos</div>
                  <div style={{ fontSize: 12, color: t.textTer }}>Sobram {saldo - qtd} de {saldo} créditos</div>
                </div>
              </div>
              <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 18, color: t.text }}>{qtd} 🥖</div>
            </div>
          </Card>
        )}
      </div>
      <div style={{ padding: '14px 20px', borderTop: `1px solid ${t.border2}`, background: t.appBg }}>
        <Btn full size="lg" icon="check" disabled={semCredito} onClick={() => go('home')}>Reservar e confirmar</Btn>
      </div>
    </div>
  );
}

Object.assign(window, { CombosScreen, PurchasedScreen, ScheduleScreen, SingleScreen });
