/* ============================================================
   Cheirin de Pão — ADMIN (core)
   Navegação inferior + Painel · Pedido ao fornecedor · Entregas · Clientes
   ============================================================ */

function AdminScreen({ pricing, setPricing }) {
  const t = useT();
  const [tab, setTab] = React.useState('painel');
  const [sub, setSub] = React.useState(null); // sub-tela da aba Gestão

  const nav = [
    { k: 'painel', ic: 'trend', l: 'Painel' },
    { k: 'pedido', ic: 'factory', l: 'Pedido' },
    { k: 'entregas', ic: 'truck', l: 'Entregas' },
    { k: 'clientes', ic: 'users', l: 'Clientes' },
    { k: 'gestao', ic: 'settings', l: 'Gestão' },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {tab === 'painel' && <AdminPainel go={setTab} />}
        {tab === 'pedido' && <AdminPedido />}
        {tab === 'entregas' && <AdminEntregas />}
        {tab === 'clientes' && <AdminClientes />}
        {tab === 'gestao' && <AdminGestao sub={sub} setSub={setSub} pricing={pricing} setPricing={setPricing} />}
      </div>
      <div style={{ flexShrink: 0, display: 'flex', borderTop: `1px solid ${t.border2}`, background: t.surface, padding: '8px 6px calc(8px + env(safe-area-inset-bottom, 0px))' }}>
        {nav.map(n => {
          const on = tab === n.k;
          return (
            <button key={n.k} onClick={() => { setTab(n.k); if (n.k === 'gestao') setSub(null); }} style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '5px 0', color: on ? t.accent : t.textTer }}>
              <Icon name={n.ic} size={22} stroke={on ? 2.3 : 2} />
              <span style={{ fontSize: 10, fontWeight: on ? 700 : 600 }}>{n.l}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* Cabeçalho de seção admin */
function AdminHead({ titulo, sub }) {
  const t = useT();
  return (
    <div style={{ padding: '4px 20px 14px', display: 'flex', alignItems: 'center', gap: 11 }}>
      <div style={{ width: 42, height: 42, borderRadius: 13, background: t.espresso, display: 'grid', placeItems: 'center', flexShrink: 0 }}><BreadMark size={27} color="#E3AC3F" /></div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, color: t.textTer, fontWeight: 600 }}>{sub}</div>
        <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 20, color: t.text, letterSpacing: '-0.02em' }}>{titulo}</div>
      </div>
    </div>
  );
}

/* ---------- PAINEL (dashboard + financeiro resumido) ---------- */
function AdminPainel({ go }) {
  const t = useT();
  const recCombos = 392.4, recAvulso = 86.6;
  const recTotal = recCombos + recAvulso;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <AdminHead titulo="Painel" sub="Cheirin de Pão · Dona Tereza" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { l: 'Pães hoje', v: '218', ic: 'bag', tr: '+12%' },
            { l: 'Receita do dia', v: BRL(recTotal), ic: 'trend', tr: '+8%' },
            { l: 'Clientes', v: '59', ic: 'users', tr: '+3' },
            { l: 'Condomínios', v: '4', ic: 'building', tr: null },
          ].map((m, i) => (
            <Card key={i} pad={16}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Icon name={m.ic} size={20} color={t.accent} />
                {m.tr && <Pill tone="good">{m.tr}</Pill>}
              </div>
              <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 26, color: t.text, marginTop: 12, letterSpacing: '-0.02em' }}>{m.v}</div>
              <div style={{ fontSize: 12.5, color: t.textSec, fontWeight: 600 }}>{m.l}</div>
            </Card>
          ))}
        </div>

        {/* atalho gerar pedido */}
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <div onClick={() => go('pedido')} style={{ cursor: 'pointer', background: t.espresso, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 13, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', bottom: -40, right: -16, opacity: 0.12 }}><BreadMark size={120} color="#E3AC3F" /></div>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(227,172,63,0.16)', display: 'grid', placeItems: 'center', color: '#E3AC3F', flexShrink: 0 }}><Icon name="factory" size={22} /></div>
            <div style={{ flex: 1, position: 'relative' }}>
              <div style={{ fontSize: 11.5, color: '#E3AC3F', fontWeight: 700, letterSpacing: '0.05em' }}>CORTE 20:00 · ABERTO</div>
              <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 16, color: '#FAF5EC', marginTop: 2 }}>Pedido de amanhã · 340 pães</div>
            </div>
            <Icon name="chevR" size={20} color="#C7B595" />
          </div>
        </Card>

        <Card pad={18}>
          <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 15, color: t.text, marginBottom: 14 }}>Fornadas por dia</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 96 }}>
            {[54, 68, 61, 74, 81, 90, 40].map((h, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: '100%', height: h, background: i === 5 ? t.gold : t.surface2, borderRadius: 7, transition: 'height .3s' }} />
                <span style={{ fontSize: 10.5, color: t.textTer, fontWeight: 600 }}>{DIAS[i].curt}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* receita por tipo */}
        <Card pad={18}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 15, color: t.text }}>Receita por tipo · hoje</span>
            <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 15, color: t.text }}>{BRL(recTotal)}</span>
          </div>
          <div style={{ display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ width: `${recCombos / recTotal * 100}%`, background: t.gold }} />
            <div style={{ width: `${recAvulso / recTotal * 100}%`, background: t.accent, opacity: 0.5 }} />
          </div>
          {[{ c: t.gold, l: 'Combos', v: recCombos }, { c: t.accent, l: 'Compra personalizada', v: recAvulso, o: 0.5 }].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0' }}>
              <span style={{ width: 11, height: 11, borderRadius: 4, background: r.c, opacity: r.o || 1 }} />
              <span style={{ flex: 1, fontSize: 13.5, color: t.textSec, fontWeight: 600 }}>{r.l}</span>
              <span style={{ fontSize: 13.5, color: t.text, fontWeight: 700 }}>{BRL(r.v)}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

/* ---------- PEDIDO AO FORNECEDOR (sec. 6) ---------- */
function AdminPedido() {
  const t = useT();
  const [step, setStep] = React.useState(0); // 0 lista/corte · 1 ajustar · 2 dividir · 3 pronto
  const [qts, setQts] = React.useState(PEDIDO_DIA.porCondo.map(c => c.paes));
  const total = qts.reduce((a, b) => a + b, 0);
  const [split, setSplit] = React.useState(null); // {f1, f2} qty principal/reserva
  const principal = FORNECEDORES.find(f => f.principal);
  const reserva = FORNECEDORES.find(f => !f.principal);

  React.useEffect(() => { if (step === 2 && !split) setSplit({ p: Math.round(total * 0.75), r: total - Math.round(total * 0.75) }); }, [step]);

  const Steps = () => (
    <div style={{ display: 'flex', gap: 6, padding: '0 20px 14px' }}>
      {['Conferir', 'Ajustar', 'Dividir', 'Pronto'].map((l, i) => (
        <div key={i} style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ height: 4, borderRadius: 99, background: i <= step ? t.gold : t.border, marginBottom: 6 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: i <= step ? t.accent : t.textTer }}>{l}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <AdminHead titulo="Pedido ao fornecedor" sub="Para amanhã · 12 jun" />
      <Steps />

      {step === 0 && (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px' }}>
            <Card pad={16} style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 13 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: t.goldSoft, color: t.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="scissors" size={21} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: t.text }}>Horário de corte · {PEDIDO_DIA.horaCorte}</div>
                <div style={{ fontSize: 12.5, color: t.textTer, marginTop: 1 }}>Após o corte, pedidos do dia são bloqueados</div>
              </div>
              <Pill tone="good">Aberto</Pill>
            </Card>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec, margin: '4px 2px 9px' }}>CONSOLIDADO POR CONDOMÍNIO</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PEDIDO_DIA.porCondo.map((c, i) => (
                <Card key={i} pad={15} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: t.surface2, color: t.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="building" size={20} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5, color: t.text }}>{c.condo}</div>
                    <div style={{ fontSize: 12, color: t.textTer }}>{c.paradas} entregas</div>
                  </div>
                  <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 18, color: t.text }}>{c.paes} <span style={{ fontSize: 12, color: t.textTer, fontWeight: 600 }}>pães</span></div>
                </Card>
              ))}
            </div>
          </div>
          <div style={{ padding: '14px 20px', borderTop: `1px solid ${t.border2}`, background: t.appBg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13.5, color: t.textSec, fontWeight: 600 }}>Total necessário</span>
              <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 22, color: t.text }}>{total} pães</span>
            </div>
            <Btn full size="lg" icon="scissors" onClick={() => setStep(1)}>Encerrar corte e gerar pedido</Btn>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px' }}>
            <div style={{ fontSize: 13.5, color: t.textSec, lineHeight: 1.5, marginBottom: 16 }}>Ajuste as quantidades antes de fechar — margem de segurança, arredondamento, etc.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PEDIDO_DIA.porCondo.map((c, i) => (
                <Card key={i} pad={14} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>{c.condo}</div>
                    <div style={{ fontSize: 11.5, color: t.textTer }}>base {c.paes} pães</div>
                  </div>
                  <Stepper value={qts[i]} onChange={v => setQts(q => q.map((x, j) => j === i ? Math.max(0, v) : x))} max={400} />
                </Card>
              ))}
            </div>
          </div>
          <div style={{ padding: '14px 20px', borderTop: `1px solid ${t.border2}`, background: t.appBg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13.5, color: t.textSec, fontWeight: 600 }}>Total ajustado</span>
              <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 22, color: t.text }}>{total} pães</span>
            </div>
            <Btn full size="lg" onClick={() => setStep(2)}>Escolher fornecedores</Btn>
          </div>
        </>
      )}

      {step === 2 && split && (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px' }}>
            <div style={{ fontSize: 13.5, color: t.textSec, lineHeight: 1.5, marginBottom: 16 }}>Comece pelo fornecedor principal e divida o restante se quiser.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[{ f: principal, key: 'p', tag: 'Principal' }, { f: reserva, key: 'r', tag: 'Reserva' }].map(({ f, key, tag }) => (
                <Card key={key} pad={16}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, background: t.surface2, color: t.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="factory" size={19} /></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14.5, color: t.text }}>{f.nome}</div>
                      <div style={{ fontSize: 12, color: t.textTer }}>{BRL(f.preco)}/pão</div>
                    </div>
                    <Pill tone={key === 'p' ? 'gold' : 'neutral'}>{tag}</Pill>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Stepper value={split[key]} onChange={v => { const nv = Math.max(0, Math.min(total, v)); setSplit(key === 'p' ? { p: nv, r: total - nv } : { r: nv, p: total - nv }); }} max={total} />
                    <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 16, color: t.text }}>{BRL(split[key] * f.preco)}</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
          <div style={{ padding: '14px 20px', borderTop: `1px solid ${t.border2}`, background: t.appBg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13.5, color: t.textSec, fontWeight: 600 }}>{split.p + split.r} pães</span>
              <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 22, color: t.text }}>{BRL(split.p * principal.preco + split.r * reserva.preco)}</span>
            </div>
            <Btn full size="lg" icon="check" onClick={() => setStep(3)}>Finalizar pedido</Btn>
          </div>
        </>
      )}

      {step === 3 && split && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px' }}>
          <div style={{ textAlign: 'center', padding: '8px 0 18px' }}>
            <div style={{ width: 72, height: 72, borderRadius: '28%', background: t.goodSoft, display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}><Icon name="check" size={36} color={t.good} stroke={2.6} /></div>
            <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 22, color: t.text, letterSpacing: '-0.02em' }}>Pedido gerado</div>
            <div style={{ fontSize: 13.5, color: t.textSec, marginTop: 6 }}>Salvo no histórico · 12 jun</div>
          </div>
          <Card pad={18} style={{ marginBottom: 14 }}>
            {[{ f: principal, q: split.p }, { f: reserva, q: split.r }].map(({ f, q }, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', borderBottom: i === 0 ? `1px solid ${t.border2}` : 'none' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>{f.nome}</div>
                  <div style={{ fontSize: 12, color: t.textTer }}>{q} pães × {BRL(f.preco)}</div>
                </div>
                <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 16, color: t.text }}>{BRL(q * f.preco)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 4 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: t.textSec }}>Total do pedido</span>
              <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 20, color: t.accent }}>{BRL(split.p * principal.preco + split.r * reserva.preco)}</span>
            </div>
          </Card>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <Btn variant="soft" full icon="download">PDF</Btn>
            <Btn variant="soft" full icon="download">Excel</Btn>
          </div>
          <Btn variant="ghost" full onClick={() => setStep(0)}>Voltar ao início</Btn>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { AdminScreen, AdminHead, AdminPainel, AdminPedido });
