/* ============================================================
   Cheirin de Pão — Além do Pãozin (Checkout + Sucesso)
   ============================================================ */

const AGENDA_SEMANA = 22; // pães que a agenda desta semana ainda precisa
const MKT_SLOTS = [
  { k: 'amanha', l: 'Amanhã cedo', s: 'Qui · 06:30', chega: 'amanhã às 06:30' },
  { k: 'sabado', l: 'Sábado', s: '14 jun · 08:00', chega: 'sábado às 08:00' },
];
const PAY_METHODS = [
  { k: 'salvo', ic: 'card', l: 'Cartão •••• 4821', d: 'Visa · salvo' },
  { k: 'pix', ic: 'coin', l: 'Pix', d: 'Aprovação na hora' },
  { k: 'novo', ic: 'plus', l: 'Novo cartão', d: 'Adicionar' },
];

/* ===== C5 — Checkout da Cestinha ===== */
function MarketCheckout({ mkt }) {
  const t = useT();
  const unit = mkt.pricing.avulsoUnit;
  const bestCombo = COMBOS.reduce((m, c) => (c.preco / c.qtd) < (m.preco / m.qtd) ? c : m, COMBOS[0]);
  const comboUnit = bestCombo.preco / bestCombo.qtd;
  const eco = economiaCredito(mkt.pricing, COMBOS);
  const items = mkt.items();
  const subtotal = mkt.subtotal();
  const maxAplic = Math.min(mkt.saldo, Math.floor(subtotal / unit));
  const [aplic, setAplic] = React.useState(maxAplic); // pãezinhos aplicados (padrão = máximo)
  const [slot, setSlot] = React.useState('amanha');
  const [pay, setPay] = React.useState('salvo');

  const creditValue = Math.min(aplic * unit, subtotal);
  const cash = Math.max(0, subtotal - creditValue);
  const economiaVal = aplic * Math.max(0, unit - comboUnit);
  const soCredito = cash <= 0.001;
  const restaSaldo = mkt.saldo - aplic;
  const alertaAgenda = restaSaldo < AGENDA_SEMANA;
  const slotObj = MKT_SLOTS.find(s => s.k === slot);
  const pct = maxAplic > 0 ? (aplic / maxAplic) * 100 : 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <AppBar title="Pagamento" onBack={() => mkt.go('cestinha')} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px' }}>

        {/* Resumo do pedido */}
        <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec, margin: '2px 2px 9px' }}>SEU PEDIDO</div>
        <Card pad={16} style={{ marginBottom: 14 }}>
          {mkt.paes > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${t.border2}` }}>
              <span style={{ fontSize: 17 }}>🥖</span>
              <span style={{ flex: 1, fontSize: 13.5, color: t.text, fontWeight: 600 }}>{mkt.paes} pães <span style={{ color: t.textTer, fontWeight: 500 }}>· com créditos</span></span>
              <span style={{ fontSize: 13, color: t.textTer, fontWeight: 700 }}>{mkt.paes} 🥖</span>
            </div>
          )}
          {items.map(({ p, qtd }) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
              <span style={{ minWidth: 22, fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 13.5, color: t.accent }}>{qtd}×</span>
              <span style={{ flex: 1, fontSize: 13.5, color: t.text, fontWeight: 600 }}>{p.nome}</span>
              <span style={{ fontSize: 13.5, color: t.text, fontWeight: 700 }}>{BRL(p.preco * qtd)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 11, marginTop: 3, borderTop: `1px solid ${t.border2}` }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: t.textSec }}>Total do mercadinho</span>
            <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 18, color: t.text }}>{BRL(subtotal)}</span>
          </div>
        </Card>

        {/* Entrega */}
        <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec, margin: '2px 2px 9px' }}>QUANDO CHEGA</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {MKT_SLOTS.map(o => {
            const on = slot === o.k;
            return (
              <div key={o.k} onClick={() => setSlot(o.k)} style={{ flex: 1, cursor: 'pointer', padding: '12px 14px', borderRadius: 16, border: `1.5px solid ${on ? t.accent : t.border}`, background: on ? t.goldSoft : t.surface }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: on ? t.accent : t.text }}>{o.l}</div>
                <div style={{ fontSize: 12, color: t.textTer, marginTop: 2 }}>{o.s}</div>
              </div>
            );
          })}
        </div>

        {/* Split — usar pãezinhos */}
        <Card pad={0} style={{ overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ background: t.espresso, padding: '15px 18px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -34, right: -18, opacity: 0.12 }}><BreadMark size={120} color="#E3AC3F" /></div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(227,172,63,0.16)', display: 'grid', placeItems: 'center', color: '#E3AC3F', flexShrink: 0 }}><Icon name="wallet" size={20} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#FAF5EC' }}>Usar meus pãezinhos</div>
                <div style={{ fontSize: 12, color: '#C7B595', marginTop: 1 }}>Saldo disponível: {mkt.saldo} pães</div>
              </div>
              {eco > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 99, background: 'rgba(227,172,63,0.18)', color: '#E3AC3F', fontSize: 11.5, fontWeight: 800, flexShrink: 0 }}>−{eco}%</span>}
            </div>
          </div>
          <div style={{ padding: '16px 18px' }}>
            {maxAplic === 0 ? (
              <div style={{ fontSize: 13, color: t.textSec, lineHeight: 1.5 }}>Você não tem pãezinhos para aplicar agora. O total vai no dinheiro.</div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 30, color: t.accent, letterSpacing: '-0.02em' }}>{aplic}</span>
                      <span style={{ fontSize: 13, color: t.textSec, fontWeight: 700 }}>pãezinhos · −{BRL(creditValue)}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: t.textTer, fontWeight: 600, marginTop: 1 }}>a {BRL(unit)} cada (preço avulso)</div>
                  </div>
                  <Stepper value={aplic} onChange={v => setAplic(Math.max(0, Math.min(maxAplic, v)))} min={0} max={maxAplic} />
                </div>
                <div style={{ height: 8, borderRadius: 99, background: t.surface2, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: t.gold, borderRadius: 99, transition: 'width .2s' }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setAplic(0)} style={{ flex: 1, padding: '7px 0', borderRadius: 10, border: `1.5px solid ${aplic === 0 ? t.accent : t.border}`, background: aplic === 0 ? t.goldSoft : t.surface, color: aplic === 0 ? t.accent : t.textSec, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Hanken Grotesk' }}>Só dinheiro</button>
                  <button onClick={() => setAplic(maxAplic)} style={{ flex: 1, padding: '7px 0', borderRadius: 10, border: `1.5px solid ${aplic === maxAplic ? t.accent : t.border}`, background: aplic === maxAplic ? t.goldSoft : t.surface, color: aplic === maxAplic ? t.accent : t.textSec, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Hanken Grotesk' }}>Usar o máximo</button>
                </div>
                {aplic > 0 && economiaVal >= 0.01 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '9px 12px', background: t.goodSoft, borderRadius: 11 }}>
                    <Icon name="spark" size={16} color={t.good} />
                    <span style={{ fontSize: 12.5, color: t.good, fontWeight: 700 }}>Economia de {BRL(economiaVal)} pagando com pãezinhos</span>
                  </div>
                )}
              </>
            )}
          </div>
          {/* balanço vivo: pãezinhos vs dinheiro */}
          <div style={{ display: 'flex', borderTop: `1px solid ${t.border2}` }}>
            <div style={{ flex: 1, padding: '13px 14px', borderRight: `1px solid ${t.border2}`, background: aplic > 0 ? t.goldSoft : 'transparent', transition: 'background .2s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13 }}>🥖</span>
                <span style={{ fontSize: 11, color: t.textSec, fontWeight: 700, letterSpacing: '0.03em' }}>Com pãezinhos</span>
              </div>
              <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 19, color: t.accent, marginTop: 3 }}>−{BRL(creditValue)}</div>
              <div style={{ fontSize: 10.5, color: t.textTer, fontWeight: 600 }}>{aplic} de {mkt.saldo} pães</div>
            </div>
            <div style={{ flex: 1, padding: '13px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="card" size={14} color={t.textSec} />
                <span style={{ fontSize: 11, color: t.textSec, fontWeight: 700, letterSpacing: '0.03em' }}>Em dinheiro</span>
              </div>
              <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 19, color: t.text, marginTop: 3 }}>{BRL(cash)}</div>
              <div style={{ fontSize: 10.5, color: t.textTer, fontWeight: 600 }}>{soCredito ? 'nada a pagar' : 'no cartão ou Pix'}</div>
            </div>
          </div>
        </Card>

        {/* Aviso suave de agenda (não bloqueante) */}
        {aplic > 0 && alertaAgenda && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '13px 16px', background: t.goldSoft, border: `1.5px solid ${t.gold}`, borderRadius: 16, marginBottom: 14 }}>
            <Icon name="alert" size={19} color={t.accent} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, fontSize: 13, color: t.text, fontWeight: 600, lineHeight: 1.45 }}>Isso deixa seu saldo em <b>{restaSaldo} pães</b> — abaixo do que sua agenda desta semana precisa ({AGENDA_SEMANA}). Tudo bem continuar?</div>
          </div>
        )}

        {/* Forma de pagamento (parte em dinheiro) */}
        {!soCredito && (
          <>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec, margin: '2px 2px 9px' }}>PAGAR {BRL(cash)} COM</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PAY_METHODS.map(m => {
                const on = pay === m.k;
                return (
                  <div key={m.k} onClick={() => setPay(m.k)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 13, padding: '13px 15px', borderRadius: 16, background: t.surface, border: `1.5px solid ${on ? t.accent : t.border2}` }}>
                    <div style={{ width: 22, height: 22, borderRadius: 99, border: `2px solid ${on ? t.accent : t.border}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{on && <div style={{ width: 11, height: 11, borderRadius: 99, background: t.accent }} />}</div>
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: t.surface2, color: t.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={m.ic} size={19} /></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>{m.l}</div>
                      <div style={{ fontSize: 12, color: t.textTer }}>{m.d}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {soCredito && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px', background: t.goodSoft, borderRadius: 16 }}>
            <Icon name="check" size={19} color={t.good} stroke={2.4} />
            <div style={{ fontSize: 13, color: t.good, fontWeight: 700, lineHeight: 1.4 }}>Pago 100% com pãezinhos — sem cobrança em dinheiro.</div>
          </div>
        )}
      </div>

      <div style={{ padding: '14px 20px', borderTop: `1px solid ${t.border2}`, background: t.appBg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: t.textTer, fontWeight: 600 }}>{aplic > 0 ? `${aplic} 🥖 + ` : ''}dinheiro</div>
            <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 24, color: t.text, letterSpacing: '-0.02em' }}>{BRL(cash)}</div>
          </div>
          <Pill tone="gold"><Icon name="clock" size={13} />{slotObj.l}</Pill>
        </div>
        <Btn full size="lg" icon="check" onClick={() => mkt.confirm({ items, subtotal, aplic, creditValue, cash, slot: slotObj, pay: PAY_METHODS.find(m => m.k === pay), soCredito })}>Confirmar pedido</Btn>
      </div>
    </div>
  );
}

/* ===== C6 — Confirmação / sucesso ===== */
function MarketDone({ mkt }) {
  const t = useT();
  const o = mkt.last || { items: [], subtotal: 0, aplic: 0, cash: 0, slot: MKT_SLOTS[0], soCredito: false };
  const nItens = o.items.reduce((a, i) => a + i.qtd, 0);
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ width: 96, height: 96, borderRadius: '30%', background: t.goodSoft, display: 'grid', placeItems: 'center', marginBottom: 22 }}>
          <Icon name="check" size={48} color={t.good} stroke={2.4} />
        </div>
        <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 26, letterSpacing: '-0.03em', color: t.text }}>Pedido confirmado</div>
        <div style={{ fontSize: 15, color: t.textSec, marginTop: 10, lineHeight: 1.5, maxWidth: 300 }}>
          {nItens} {nItens === 1 ? 'item do mercadinho chega' : 'itens do mercadinho chegam'} junto com seu pão, <b style={{ color: t.text }}>{o.slot.chega}</b>.
        </div>

        <Card pad={16} style={{ width: '100%', maxWidth: 340, marginTop: 24, textAlign: 'left' }}>
          {o.items.map(({ p, qtd }) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
              <span style={{ minWidth: 22, fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 13, color: t.accent }}>{qtd}×</span>
              <span style={{ flex: 1, fontSize: 13.5, color: t.text, fontWeight: 600 }}>{p.nome}</span>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${t.border2}`, marginTop: 8, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {o.aplic > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: t.textSec, fontWeight: 600 }}>Pãezinhos usados</span>
                <span style={{ fontSize: 13.5, color: t.accent, fontWeight: 700 }}>{o.aplic} 🥖 · −{BRL(o.creditValue)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: t.textSec, fontWeight: 600 }}>{o.soCredito ? 'Pago em dinheiro' : `Cobrado no ${o.pay ? o.pay.l : 'cartão'}`}</span>
              <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 15, color: t.text, fontWeight: 800 }}>{BRL(o.cash)}</span>
            </div>
          </div>
        </Card>
      </div>
      <div style={{ padding: '14px 20px', borderTop: `1px solid ${t.border2}`, background: t.appBg, display: 'flex', flexDirection: 'column', gap: 11 }}>
        <Btn full size="lg" icon="truck" onClick={() => mkt.go('track')}>Acompanhar entrega</Btn>
        <Btn variant="ghost" full onClick={() => mkt.go('home')}>Voltar ao início</Btn>
      </div>
    </div>
  );
}

Object.assign(window, { MarketCheckout, MarketDone, MKT_SLOTS, AGENDA_SEMANA });
