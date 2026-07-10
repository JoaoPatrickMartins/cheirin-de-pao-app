/* ============================================================
   Cheirin de Pão — ADMIN (parte 2)
   Entregas · Clientes · Gestão (combos/promos, fornecedores,
   entregadores, pagamentos, financeiro, compra personalizada)
   ============================================================ */

/* ---------- CONTROLE DE ENTREGAS + divisão entre entregadores ---------- */
function AdminEntregas() {
  const t = useT();
  const [aba, setAba] = React.useState('hoje');
  const [aprovado, setAprovado] = React.useState(false);
  const ativos = ENTREGADORES.filter(e => e.ativo);
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <AdminHead titulo="Entregas" sub="Controle do dia · 11 jun" />
      <div style={{ padding: '0 20px 12px' }}>
        <div style={{ display: 'flex', gap: 6, background: t.surface2, borderRadius: 13, padding: 4 }}>
          {[['hoje', 'Hoje'], ['historico', 'Histórico']].map(([k, l]) => (
            <button key={k} onClick={() => setAba(k)} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13.5, fontFamily: 'Hanken Grotesk', background: aba === k ? t.surface : 'transparent', color: aba === k ? t.text : t.textSec, boxShadow: aba === k ? t.shadowSoft : 'none' }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px' }}>
        {aba === 'hoje' ? (
          <>
            {/* divisão sugerida */}
            <Card pad={16} style={{ marginBottom: 14, border: `1.5px solid ${aprovado ? t.border2 : t.accent}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Icon name="spark" size={20} color={t.accent} />
                <div style={{ flex: 1, fontWeight: 700, fontSize: 14.5, color: t.text }}>Divisão sugerida</div>
                {aprovado && <Pill tone="good"><Icon name="check" size={13} />Aprovada</Pill>}
              </div>
              {[{ e: ativos[0], condos: ['Residencial Aurora', 'Edifício Ipê Amarelo'], paes: 210 }, { e: ativos[1], condos: ['Condomínio Vista Verde'], paes: 96 }].map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', borderTop: i > 0 ? `1px solid ${t.border2}` : 'none' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 99, background: t.surface2, color: t.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="user" size={18} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>{a.e?.nome}</div>
                    <div style={{ fontSize: 12, color: t.textTer }}>{a.condos.join(' · ')}</div>
                  </div>
                  <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 15, color: t.text }}>{a.paes}🥖</span>
                </div>
              ))}
              {!aprovado && <Btn variant="gold" full size="sm" icon="check" style={{ marginTop: 12 }} onClick={() => setAprovado(true)}>Aprovar divisão</Btn>}
            </Card>

            <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec, margin: '4px 2px 9px' }}>AGENDADAS VS REALIZADAS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[{ condo: 'Residencial Aurora', feitas: 9, total: 23 }, { condo: 'Edifício Ipê Amarelo', feitas: 11, total: 11 }, { condo: 'Condomínio Vista Verde', feitas: 4, total: 18 }, { condo: 'Village das Acácias', feitas: 0, total: 7 }].map((c, i) => {
                const ok = c.feitas === c.total;
                return (
                  <Card key={i} pad={15}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <div style={{ flex: 1, fontWeight: 700, fontSize: 14.5, color: t.text }}>{c.condo}</div>
                      {ok ? <Pill tone="good"><Icon name="check" size={13} />Completo</Pill> : <Pill tone="gold">{c.feitas}/{c.total}</Pill>}
                    </div>
                    <div style={{ height: 7, borderRadius: 99, background: t.surface2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${c.feitas / c.total * 100}%`, background: ok ? t.good : t.gold, transition: 'width .3s' }} />
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[{ d: 'Ontem · 10 jun', p: 318, ok: 312 }, { d: 'Seg · 9 jun', p: 295, ok: 295 }, { d: 'Dom · 8 jun', p: 402, ok: 398 }, { d: 'Sáb · 7 jun', p: 388, ok: 388 }].map((h, i) => (
              <Card key={i} pad={15} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: t.surface2, color: t.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="truck" size={20} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: t.text }}>{h.d}</div>
                  <div style={{ fontSize: 12, color: t.textTer }}>{h.ok} de {h.p} entregues</div>
                </div>
                <Pill tone={h.ok === h.p ? 'good' : 'neutral'}>{Math.round(h.ok / h.p * 100)}%</Pill>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- PAINEL DE CLIENTES + filtro + bloqueio ---------- */
function AdminClientes() {
  const t = useT();
  const [filtro, setFiltro] = React.useState('todos');
  const [sel, setSel] = React.useState(null);
  const [bloq, setBloq] = React.useState(() => Object.fromEntries(ADMIN_CLIENTES.map((c, i) => [i, c.bloqueado])));
  const condos = ['todos', ...new Set(ADMIN_CLIENTES.map(c => c.condo))];
  const lista = ADMIN_CLIENTES.map((c, i) => ({ ...c, i })).filter(c => filtro === 'todos' || c.condo === filtro);

  if (sel !== null) {
    const c = ADMIN_CLIENTES[sel];
    const b = bloq[sel];
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <AppBar title="Cliente" onBack={() => setSel(null)} />
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px' }}>
          <Card pad={20} style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ width: 64, height: 64, borderRadius: 99, background: t.surface2, color: t.accent, display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}><Icon name="user" size={30} /></div>
            <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 20, color: t.text, letterSpacing: '-0.02em' }}>{c.nome}</div>
            <div style={{ fontSize: 13, color: t.textSec, marginTop: 3 }}>{c.condo} · {c.apto}</div>
            {b && <div style={{ marginTop: 10 }}><Pill tone="gold"><Icon name="ban" size={13} />Bloqueado</Pill></div>}
          </Card>
          <Card pad={16} style={{ marginBottom: 14 }}>
            <Row label="Saldo de créditos" value={`${c.saldo} pães`} icon="wallet" />
            <div style={{ height: 1, background: t.border2 }} />
            <Row label="Última compra" value={c.ultima} icon="clock" />
            <div style={{ height: 1, background: t.border2 }} />
            <Row label="Agendamento" value="Semanal · 40/sem" icon="calendar" />
          </Card>
          <div style={{ fontSize: 12, color: t.textTer, lineHeight: 1.5, marginBottom: 14, padding: '0 2px' }}>O admin apenas visualiza os dados do cliente — não edita o cadastro.</div>
          <Btn variant={b ? 'gold' : 'ghost'} full icon={b ? 'check' : 'ban'} onClick={() => setBloq(p => ({ ...p, [sel]: !p[sel] }))}>{b ? 'Desbloquear cliente' : 'Bloquear cliente'}</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <AdminHead titulo="Clientes" sub={`${ADMIN_CLIENTES.length} cadastrados`} />
      <div style={{ padding: '0 20px 12px' }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {condos.map(k => (
            <button key={k} onClick={() => setFiltro(k)} style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 999, border: `1.5px solid ${filtro === k ? t.accent : t.border}`, background: filtro === k ? t.goldSoft : t.surface, color: filtro === k ? t.accent : t.textSec, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Hanken Grotesk', whiteSpace: 'nowrap' }}>{k === 'todos' ? 'Todos' : k}</button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lista.map(c => (
          <Card key={c.i} pad={14} onClick={() => setSel(c.i)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 13, opacity: bloq[c.i] ? 0.6 : 1 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: t.surface2, color: t.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="user" size={21} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: t.text, display: 'flex', alignItems: 'center', gap: 7 }}>{c.nome} {bloq[c.i] && <Icon name="ban" size={14} color={t.accent} />}</div>
              <div style={{ fontSize: 12, color: t.textTer, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.condo} · {c.apto} · últ. {c.ultima}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 17, color: c.saldo === 0 ? t.textTer : t.text }}>{c.saldo}</div>
              <div style={{ fontSize: 10.5, color: t.textTer }}>créditos</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------- HUB DE GESTÃO ---------- */
function AdminGestao({ sub, setSub, pricing, setPricing }) {
  const t = useT();
  const items = [
    { k: 'combos', ic: 'bag', l: 'Combos e promoções', d: 'Criar, editar, descontos' },
    { k: 'avulso', ic: 'coin', l: 'Compra personalizada', d: 'Limite e preço por pão' },
    { k: 'fornecedores', ic: 'factory', l: 'Fornecedores', d: 'Padarias e preço do pão' },
    { k: 'entregadores', ic: 'truck', l: 'Entregadores', d: 'Equipe e disponibilidade' },
    { k: 'condos', ic: 'building', l: 'Condomínios', d: 'Locais atendidos' },
    { k: 'pagamentos', ic: 'card', l: 'Pagamentos', d: 'Status e estornos' },
    { k: 'financeiro', ic: 'trend', l: 'Financeiro', d: 'Receita por período' },
  ];
  if (sub) {
    const map = { combos: AdminCombos, avulso: () => <AdminAvulso pricing={pricing} setPricing={setPricing} />, fornecedores: AdminFornecedores, entregadores: AdminEntregadores, condos: AdminCondos, pagamentos: AdminPagamentos, financeiro: AdminFinanceiro };
    const Comp = map[sub];
    const titulo = items.find(i => i.k === sub)?.l;
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <AppBar title={titulo} onBack={() => setSub(null)} />
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px' }}><Comp /></div>
      </div>
    );
  }
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <AdminHead titulo="Gestão" sub="Configurações da operação" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(it => (
          <Card key={it.k} pad={15} onClick={() => setSub(it.k)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: t.surface2, color: t.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={it.ic} size={21} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: t.text }}>{it.l}</div>
              <div style={{ fontSize: 12, color: t.textTer, marginTop: 1 }}>{it.d}</div>
            </div>
            <Icon name="chevR" size={18} color={t.textTer} />
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------- Combos e promoções ---------- */
function AdminCombos() {
  const t = useT();
  const [promo, setPromo] = React.useState({ c2: true });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Btn variant="gold" full icon="plus">Novo combo</Btn>
      {COMBOS.map(c => {
        const on = promo[c.id];
        const precoPromo = c.preco * 0.85;
        return (
          <Card key={c.id} pad={16}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: t.surface2, display: 'grid', placeItems: 'center', color: t.accent, flexShrink: 0 }}><Icon name="bag" size={21} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: t.text }}>{c.nome} {c.tag && <span style={{ fontSize: 11, color: t.accent }}>· {c.tag}</span>}</div>
                <div style={{ fontSize: 12.5, color: t.textTer }}>{c.qtd} pães · {on ? <><span style={{ textDecoration: 'line-through' }}>{BRL(c.preco)}</span> {BRL(precoPromo)}</> : BRL(c.preco)}</div>
              </div>
              <button style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${t.border}`, background: t.surface, display: 'grid', placeItems: 'center', color: t.textSec, cursor: 'pointer' }}><Icon name="edit" size={17} /></button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border2}` }}>
              <Icon name="percent" size={17} color={on ? t.accent : t.textTer} />
              <div style={{ flex: 1, fontSize: 13, color: t.textSec, fontWeight: 600 }}>Promoção 15% OFF</div>
              <Switch on={!!on} onChange={v => setPromo(p => ({ ...p, [c.id]: v }))} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ---------- Compra personalizada (config) ---------- */
function AdminAvulso({ pricing, setPricing }) {
  const t = useT();
  const melhorCombo = COMBOS.reduce((m, c) => (c.preco / c.qtd) < (m.preco / m.qtd) ? c : m, COMBOS[0]);
  const comboUnit = melhorCombo.preco / melhorCombo.qtd;
  const economia = Math.round((1 - comboUnit / pricing.avulsoUnit) * 100);
  const setLim = v => setPricing(p => ({ ...p, avulsoLimite: Math.max(2, Math.min(60, v)) }));
  const setUnit = v => setPricing(p => ({ ...p, avulsoUnit: Math.max(0.1, Math.round(v * 100) / 100) }));
  const ctrl = (onDown, val, onUp) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button onClick={onDown} style={{ width: 34, height: 34, borderRadius: 11, border: `1.5px solid ${t.border}`, background: t.surface, color: t.text, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="minus" size={16} stroke={2.4} /></button>
      <span style={{ minWidth: 60, textAlign: 'center', fontWeight: 800, fontSize: 19, fontFamily: 'Bricolage Grotesque, sans-serif', color: t.accent }}>{val}</span>
      <button onClick={onUp} style={{ width: 34, height: 34, borderRadius: 11, border: `1.5px solid ${t.border}`, background: t.surface, color: t.text, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="plus" size={16} stroke={2.4} /></button>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 13.5, color: t.textSec, lineHeight: 1.5 }}>O preço por pão deve ficar <b style={{ color: t.text }}>acima</b> do melhor combo ({BRL(comboUnit)}/pão) para empurrar o cliente ao combo.</div>
      <Card pad={18}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: 1, paddingRight: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: t.text }}>Limite máximo</div>
            <div style={{ fontSize: 12.5, color: t.textTer, marginTop: 2 }}>A partir daqui, só via combo</div>
          </div>
          {ctrl(() => setLim(pricing.avulsoLimite - 1), pricing.avulsoLimite, () => setLim(pricing.avulsoLimite + 1))}
        </div>
        <div style={{ height: 1, background: t.border2, margin: '16px 0' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: 1, paddingRight: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: t.text }}>Preço por pão</div>
            <div style={{ fontSize: 12.5, color: t.textTer, marginTop: 2 }}>Compra personalizada</div>
          </div>
          {ctrl(() => setUnit(pricing.avulsoUnit - 0.1), BRL(pricing.avulsoUnit), () => setUnit(pricing.avulsoUnit + 0.1))}
        </div>
      </Card>
      <Card pad={16} style={{ background: t.espresso, border: 'none' }}>
        <div style={{ fontSize: 11.5, color: '#E3AC3F', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 12 }}>PRÉVIA DO INCENTIVO</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 13.5, color: '#C7B595' }}>Avulso (até {pricing.avulsoLimite - 1} pães)</span>
          <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 16, color: '#FAF5EC', whiteSpace: 'nowrap' }}>{BRL(pricing.avulsoUnit)}/pão</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 13.5, color: '#C7B595' }}>Combo {melhorCombo.nome} ({melhorCombo.qtd})</span>
          <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 16, color: '#E3AC3F', whiteSpace: 'nowrap' }}>{BRL(comboUnit)}/pão</span>
        </div>
        <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 12, background: 'rgba(227,172,63,0.16)', textAlign: 'center', fontSize: 13.5, fontWeight: 700, color: '#E3AC3F' }}>
          {economia > 0 ? `Combo fica ${economia}% mais barato por pão` : 'Ajuste: o avulso precisa custar mais que o combo'}
        </div>
      </Card>
    </div>
  );
}

/* ---------- Fornecedores (CRUD) ---------- */
function AdminFornecedores() {
  const t = useT();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Btn variant="gold" full icon="plus">Novo fornecedor</Btn>
      {FORNECEDORES.map(f => (
        <Card key={f.id} pad={16}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: t.surface2, display: 'grid', placeItems: 'center', color: t.accent, flexShrink: 0 }}><Icon name="factory" size={21} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: t.text, display: 'flex', alignItems: 'center', gap: 7 }}>{f.nome} {f.principal && <Pill tone="gold">Principal</Pill>}</div>
              <div style={{ fontSize: 12, color: t.textTer }}>{f.cnpj}</div>
            </div>
            <button style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${t.border}`, background: t.surface, display: 'grid', placeItems: 'center', color: t.textSec, cursor: 'pointer', flexShrink: 0 }}><Icon name="edit" size={17} /></button>
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border2}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Row label="Preço do pão" value={BRL(f.preco)} icon="coin" />
            <div style={{ display: 'flex', gap: 18, fontSize: 12, color: t.textTer, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="phone" size={13} />{f.tel}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="mail" size={13} />{f.email}</span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ---------- Entregadores (CRUD + ativar/desativar) ---------- */
function AdminEntregadores() {
  const t = useT();
  const [ativo, setAtivo] = React.useState(() => Object.fromEntries(ENTREGADORES.map(e => [e.id, e.ativo])));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Btn variant="gold" full icon="plus">Cadastrar entregador</Btn>
      {ENTREGADORES.map(e => (
        <Card key={e.id} pad={16}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 44, height: 44, borderRadius: 99, background: t.surface2, display: 'grid', placeItems: 'center', color: t.accent, flexShrink: 0, opacity: ativo[e.id] ? 1 : 0.5 }}><Icon name="user" size={21} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: t.text }}>{e.nome}</div>
              <div style={{ fontSize: 12, color: t.textTer }}>{ativo[e.id] ? (e.condos.length ? e.condos.join(' · ') : 'Sem rota hoje') : 'Desativado'}</div>
            </div>
            <Switch on={ativo[e.id]} onChange={v => setAtivo(p => ({ ...p, [e.id]: v }))} />
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border2}`, display: 'flex', gap: 18, fontSize: 12, color: t.textTer, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="card" size={13} />{e.cpf}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="phone" size={13} />{e.tel}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ---------- Condomínios ---------- */
function AdminCondos() {
  const t = useT();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Btn variant="gold" full icon="plus">Adicionar condomínio</Btn>
      {ADMIN_CONDOS.map((c, i) => (
        <Card key={i} pad={16} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: t.surface2, display: 'grid', placeItems: 'center', color: t.accent, flexShrink: 0 }}><Icon name="building" size={21} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: t.text }}>{c.nome}</div>
            <div style={{ fontSize: 12.5, color: t.textTer }}>{c.tipo} · {c.clientes} clientes</div>
          </div>
          <Icon name="chevR" size={18} color={t.textTer} />
        </Card>
      ))}
    </div>
  );
}

/* ---------- Pagamentos (status + estorno) ---------- */
function AdminPagamentos() {
  const t = useT();
  const [estornado, setEstornado] = React.useState({});
  const stMap = {
    pago: { tone: 'good', l: 'Pago' }, pendente: { tone: 'gold', l: 'Pendente' }, falhou: { tone: 'neutral', l: 'Falhou' },
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {PAGAMENTOS.map(p => {
        const est = estornado[p.id];
        const st = est ? { tone: 'neutral', l: 'Estornado' } : stMap[p.status];
        return (
          <Card key={p.id} pad={15}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: t.surface2, color: t.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="card" size={19} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: t.text }}>{p.cliente}</div>
                <div style={{ fontSize: 12, color: t.textTer }}>{p.tipo} · {p.metodo} · {p.data}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 16, color: t.text, textDecoration: est ? 'line-through' : 'none' }}>{BRL(p.valor)}</div>
                <Pill tone={st.tone} style={{ marginTop: 3 }}>{st.l}</Pill>
              </div>
            </div>
            {p.status === 'pago' && !est && (
              <button onClick={() => setEstornado(s => ({ ...s, [p.id]: true }))} style={{ marginTop: 10, width: '100%', background: t.surface2, border: 'none', borderRadius: 11, padding: '9px 0', fontWeight: 700, fontSize: 13, color: t.textSec, cursor: 'pointer', fontFamily: 'Hanken Grotesk', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}><Icon name="refresh" size={15} />Estornar pagamento</button>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ---------- Financeiro (receita por período / condomínio) ---------- */
function AdminFinanceiro() {
  const t = useT();
  const [per, setPer] = React.useState('semana');
  const dados = {
    dia: { total: 479, combos: 392.4, avulso: 86.6, barras: [40, 55, 48, 60, 72, 80, 35] },
    semana: { total: 3128, combos: 2602, avulso: 526, barras: [62, 70, 58, 75, 88, 96, 44] },
    mes: { total: 12940, combos: 10870, avulso: 2070, barras: [70, 82, 76, 90] },
  };
  const d = dados[per];
  const porCondo = [
    { condo: 'Residencial Aurora', v: d.total * 0.41 }, { condo: 'Condomínio Vista Verde', v: d.total * 0.29 },
    { condo: 'Edifício Ipê Amarelo', v: d.total * 0.19 }, { condo: 'Village das Acácias', v: d.total * 0.11 },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 6, background: t.surface2, borderRadius: 13, padding: 4 }}>
        {[['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês']].map(([k, l]) => (
          <button key={k} onClick={() => setPer(k)} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13.5, fontFamily: 'Hanken Grotesk', background: per === k ? t.surface : 'transparent', color: per === k ? t.text : t.textSec, boxShadow: per === k ? t.shadowSoft : 'none' }}>{l}</button>
        ))}
      </div>
      <Card pad={18}>
        <div style={{ fontSize: 12.5, color: t.textSec, fontWeight: 600 }}>Receita · {per === 'dia' ? 'hoje' : per === 'semana' ? 'esta semana' : 'este mês'}</div>
        <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 34, color: t.text, margin: '4px 0 16px', letterSpacing: '-0.02em' }}>{BRL(d.total)}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, height: 80 }}>
          {d.barras.map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${h}%`, background: i === d.barras.length - 2 ? t.gold : t.surface2, borderRadius: 6 }} />
          ))}
        </div>
      </Card>
      <Card pad={18}>
        <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 15, color: t.text, marginBottom: 12 }}>Por tipo de compra</div>
        <div style={{ display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ width: `${d.combos / d.total * 100}%`, background: t.gold }} />
          <div style={{ width: `${d.avulso / d.total * 100}%`, background: t.accent, opacity: 0.5 }} />
        </div>
        {[{ c: t.gold, l: 'Combos', v: d.combos }, { c: t.accent, l: 'Compra personalizada', v: d.avulso, o: 0.5 }].map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0' }}>
            <span style={{ width: 11, height: 11, borderRadius: 4, background: r.c, opacity: r.o || 1 }} />
            <span style={{ flex: 1, fontSize: 13.5, color: t.textSec, fontWeight: 600 }}>{r.l}</span>
            <span style={{ fontSize: 13.5, color: t.text, fontWeight: 700 }}>{BRL(r.v)}</span>
          </div>
        ))}
      </Card>
      <Card pad={18}>
        <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 15, color: t.text, marginBottom: 12 }}>Por condomínio</div>
        {porCondo.map((c, i) => (
          <div key={i} style={{ padding: '7px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 13, color: t.textSec, fontWeight: 600 }}>{c.condo}</span>
              <span style={{ fontSize: 13, color: t.text, fontWeight: 700 }}>{BRL(c.v)}</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: t.surface2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${c.v / porCondo[0].v * 100}%`, background: t.gold }} />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

Object.assign(window, { AdminEntregas, AdminClientes, AdminGestao, AdminCombos, AdminAvulso, AdminFornecedores, AdminEntregadores, AdminCondos, AdminPagamentos, AdminFinanceiro });
