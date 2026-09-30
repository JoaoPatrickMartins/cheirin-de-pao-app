/* ============================================================
   Cheirin de Pão — Além do Pãozin (ADMIN)
   Hub: Produtos · Categorias · Estoque · Config · Separação
   ============================================================ */

const STOCK_LOW = 4;

function statusProd(p) {
  if (!p.ativo && p.ativo !== undefined) return { tone: 'neutral', l: 'Inativo' };
  if (p.esgotado || p.estoque === 0) return { tone: 'neutral', l: 'Esgotado' };
  if (p.estoque <= STOCK_LOW) return { tone: 'gold', l: 'Baixo' };
  return { tone: 'good', l: 'Ativo' };
}

function MarketAdmin({ pricing, back }) {
  const t = useT();
  const [sec, setSec] = React.useState('produtos');
  const [editing, setEditing] = React.useState(undefined); // undefined=hub · null=novo · obj=editar
  const [prods, setProds] = React.useState(() => MARKET_PRODS.map(p => ({ ...p, ativo: p.ativo === undefined ? true : p.ativo })));

  if (editing !== undefined) {
    return <MarketProductForm p={editing} pricing={pricing} cats={MARKET_CATS} onBack={() => setEditing(undefined)} />;
  }

  const secs = [
    { k: 'produtos', l: 'Produtos' },
    { k: 'categorias', l: 'Categorias' },
    { k: 'estoque', l: 'Estoque' },
    { k: 'separacao', l: 'Separação' },
    { k: 'config', l: 'Config' },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <AppBar title="Além do Pãozin" onBack={back} right={sec === 'produtos' ? (
        <button onClick={() => setEditing(null)} style={{ width: 38, height: 38, borderRadius: 12, background: t.gold, color: t.onGold, border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}><Icon name="plus" size={20} stroke={2.4} /></button>
      ) : null} />
      <div style={{ padding: '0 20px 12px' }}>
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4 }}>
          {secs.map(s => {
            const on = sec === s.k;
            return <button key={s.k} onClick={() => setSec(s.k)} style={{ flexShrink: 0, padding: '8px 15px', borderRadius: 999, border: `1.5px solid ${on ? t.accent : t.border}`, background: on ? t.goldSoft : t.surface, color: on ? t.accent : t.textSec, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Hanken Grotesk', whiteSpace: 'nowrap' }}>{s.l}</button>;
          })}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px' }}>
        {sec === 'produtos' && <MA_Produtos prods={prods} onEdit={setEditing} />}
        {sec === 'categorias' && <MA_Categorias prods={prods} />}
        {sec === 'estoque' && <MA_Estoque prods={prods} setProds={setProds} />}
        {sec === 'separacao' && <MA_Separacao />}
        {sec === 'config' && <MA_Config pricing={pricing} />}
      </div>
    </div>
  );
}

/* ---- A1: Lista de produtos ---- */
function MA_Produtos({ prods, onEdit }) {
  const t = useT();
  const [filtro, setFiltro] = React.useState('tudo');
  const baixos = prods.filter(p => p.ativo && !p.esgotado && p.estoque > 0 && p.estoque <= STOCK_LOW);
  const lista = prods.filter(p => filtro === 'tudo' || p.cat === filtro);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {baixos.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 15px', background: t.goldSoft, border: `1.5px solid ${t.gold}`, borderRadius: 16 }}>
          <Icon name="alert" size={19} color={t.accent} />
          <div style={{ flex: 1, fontSize: 13, color: t.text, fontWeight: 600, lineHeight: 1.4 }}><b>{baixos.length} {baixos.length === 1 ? 'produto' : 'produtos'}</b> com estoque baixo: {baixos.map(b => b.nome).slice(0, 2).join(', ')}{baixos.length > 2 ? '…' : ''}</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {[{ k: 'tudo', nome: 'Tudo' }, ...MARKET_CATS].map(c => {
          const on = filtro === c.k;
          return <button key={c.k} onClick={() => setFiltro(c.k)} style={{ flexShrink: 0, padding: '6px 13px', borderRadius: 999, border: `1.5px solid ${on ? t.accent : t.border}`, background: on ? t.goldSoft : t.surface, color: on ? t.accent : t.textSec, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Hanken Grotesk', whiteSpace: 'nowrap' }}>{c.emoji ? c.emoji + ' ' : ''}{c.nome}</button>;
        })}
      </div>
      {lista.map(p => {
        const st = statusProd(p);
        const cat = catOf(p.cat);
        return (
          <Card key={p.id} pad={12} onClick={() => onEdit(p)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 54, height: 54, flexShrink: 0 }}><ProdPhoto p={p} radius={12} dim={p.esgotado || !p.ativo} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: t.text, lineHeight: 1.2 }}>{p.nome}</div>
              <div style={{ fontSize: 11.5, color: t.textTer, marginTop: 2 }}>{cat.emoji} {cat.nome}</div>
              <div style={{ fontSize: 11.5, color: t.textSec, marginTop: 3, fontWeight: 600 }}>{BRL(p.preco)} · {p.estoque} un <span style={{ color: t.textTer, fontWeight: 500 }}>({p.estoqueTipo === 'diario' ? 'diário' : 'fixo'})</span></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
              <Pill tone={st.tone}>{st.l}</Pill>
              <Icon name="chevR" size={16} color={t.textTer} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ---- A2: Criar / editar produto ---- */
function MarketProductForm({ p, pricing, cats, onBack }) {
  const t = useT();
  const editing = !!p;
  const [nome, setNome] = React.useState(p ? p.nome : '');
  const [desc, setDesc] = React.useState(p ? p.desc : '');
  const [cat, setCat] = React.useState(p ? p.cat : cats[0].k);
  const [novaCat, setNovaCat] = React.useState(false);
  const [preco, setPreco] = React.useState(p ? p.preco : 12);
  const [tipo, setTipo] = React.useState(p ? p.estoqueTipo : 'diario');
  const [qtd, setQtd] = React.useState(p ? p.estoque : 12);
  const [dispoMode, setDispoMode] = React.useState(p && Array.isArray(p.dispo) ? 'dias' : 'sempre');
  const [dias, setDias] = React.useState(p && Array.isArray(p.dispo) ? p.dispo : ['seg', 'qua', 'sex']);
  const [ativo, setAtivo] = React.useState(p ? p.ativo !== false : true);

  const unit = pricing.avulsoUnit;
  const paes = paezinhosDe(preco, unit);
  const best = COMBOS.reduce((m, c) => (c.preco / c.qtd) < (m.preco / m.qtd) ? c : m, COMBOS[0]);
  const worst = COMBOS.reduce((m, c) => (c.preco / c.qtd) > (m.preco / m.qtd) ? c : m, COMBOS[0]);
  const custoBest = paes * (best.preco / best.qtd);
  const custoWorst = paes * (worst.preco / worst.qtd);
  const fakePhoto = { id: p ? p.id : 'novo', cat };

  const toggleDia = d => setDias(ds => ds.includes(d) ? ds.filter(x => x !== d) : [...ds, d]);
  const money = v => 'R$ ' + Math.max(0, v).toFixed(2).replace('.', ',');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <AppBar title={editing ? 'Editar produto' : 'Novo produto'} onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Foto */}
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec, marginBottom: 8 }}>Foto do produto</div>
          <div style={{ height: 150, borderRadius: 16, overflow: 'hidden' }}><image-slot id={`mkt-admin-${p ? p.id : 'novo'}`} shape="rounded" radius="16" placeholder="Arraste uma foto ou clique"></image-slot></div>
          <div style={{ fontSize: 11.5, color: t.textTer, marginTop: 7, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="box" size={14} />JPG ou PNG até 5 MB · sem foto, usamos o ícone da categoria.</div>
        </div>

        <Field label="Nome" value={nome} onChange={setNome} placeholder="Ex.: Geleia de Morango" />
        <Field label="Descrição" value={desc} onChange={setDesc} placeholder="Uma frase que dá água na boca" />

        {/* Categoria */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec }}>Categoria</span>
            <button onClick={() => setNovaCat(v => !v)} style={{ background: 'none', border: 'none', color: t.accent, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Hanken Grotesk', display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="plus" size={14} />Criar nova</button>
          </div>
          {novaCat && <div style={{ marginBottom: 10 }}><Field placeholder="Nome da nova categoria" value="" onChange={() => {}} icon="tag" /></div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {cats.map(c => {
              const on = cat === c.k;
              return <button key={c.k} onClick={() => setCat(c.k)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 13px', borderRadius: 12, border: `1.5px solid ${on ? t.accent : t.border}`, background: on ? t.goldSoft : t.surface, color: on ? t.accent : t.textSec, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Hanken Grotesk' }}>{c.emoji} {c.nome}</button>;
            })}
          </div>
        </div>

        {/* Preço + helper de precificação ao vivo */}
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec, marginBottom: 8 }}>Preço (R$)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={() => setPreco(v => Math.max(0.5, Math.round((v - 0.5) * 100) / 100))} style={{ width: 42, height: 42, borderRadius: 13, border: `1.5px solid ${t.border}`, background: t.surface, color: t.text, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="minus" size={18} stroke={2.4} /></button>
            <div style={{ flex: 1, textAlign: 'center', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 30, color: t.accent, letterSpacing: '-0.02em' }}>{BRL(preco)}</div>
            <button onClick={() => setPreco(v => Math.round((v + 0.5) * 100) / 100)} style={{ width: 42, height: 42, borderRadius: 13, border: `1.5px solid ${t.border}`, background: t.surface, color: t.text, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="plus" size={18} stroke={2.4} /></button>
          </div>
          <Card pad={14} style={{ marginTop: 12, background: t.espresso, border: 'none' }}>
            <div style={{ fontSize: 11, color: '#E3AC3F', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 8 }}>PRECIFICAÇÃO AO VIVO</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 22, color: '#FAF5EC' }}>= {paes} 🥖</span>
              <span style={{ fontSize: 12, color: '#C7B595' }}>pãezinhos ({BRL(unit)}/pão)</span>
            </div>
            <div style={{ fontSize: 12.5, color: '#C7B595', lineHeight: 1.5 }}>Com saldo, o cliente gasta o equivalente a <b style={{ color: '#FAF5EC' }}>{money(custoBest)}</b> (combo {best.nome}) a <b style={{ color: '#FAF5EC' }}>{money(custoWorst)}</b> (combo {worst.nome}).</div>
          </Card>
        </div>

        {/* Tipo de estoque */}
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec, marginBottom: 8 }}>Tipo de estoque</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            {[{ k: 'diario', l: 'Diário', d: 'Reseta a cada dia' }, { k: 'fixo', l: 'Fixo', d: 'Inventário total' }].map(o => {
              const on = tipo === o.k;
              return (
                <div key={o.k} onClick={() => setTipo(o.k)} style={{ flex: 1, cursor: 'pointer', padding: '12px 14px', borderRadius: 14, border: `1.5px solid ${on ? t.accent : t.border}`, background: on ? t.goldSoft : t.surface }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: on ? t.accent : t.text }}>{o.l}</div>
                  <div style={{ fontSize: 11.5, color: t.textTer, marginTop: 2 }}>{o.d}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: t.surface, borderRadius: 14, border: `1px solid ${t.border2}`, padding: '12px 16px' }}>
            <span style={{ flex: 1, fontSize: 13.5, color: t.text, fontWeight: 600 }}>{tipo === 'diario' ? 'Capacidade diária' : 'Quantidade em estoque'}</span>
            <Stepper value={qtd} onChange={v => setQtd(Math.max(0, v))} max={999} />
          </div>
        </div>

        {/* Disponibilidade */}
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec, marginBottom: 8 }}>Disponibilidade</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: dispoMode === 'dias' ? 12 : 0 }}>
            {[{ k: 'sempre', l: 'Sempre' }, { k: 'dias', l: 'Dias da semana' }].map(o => {
              const on = dispoMode === o.k;
              return <button key={o.k} onClick={() => setDispoMode(o.k)} style={{ flex: 1, padding: '11px 0', borderRadius: 13, border: `1.5px solid ${on ? t.accent : t.border}`, background: on ? t.goldSoft : t.surface, color: on ? t.accent : t.text, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'Hanken Grotesk' }}>{o.l}</button>;
            })}
          </div>
          {dispoMode === 'dias' && (
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {DIAS.map(d => {
                const on = dias.includes(d.k);
                return <button key={d.k} onClick={() => toggleDia(d.k)} style={{ padding: '9px 13px', borderRadius: 11, border: `1.5px solid ${on ? t.accent : t.border}`, background: on ? t.goldSoft : t.surface, color: on ? t.accent : t.textSec, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Hanken Grotesk' }}>{d.curt}</button>;
              })}
            </div>
          )}
        </div>

        {/* Ativo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, background: t.surface, borderRadius: 16, border: `1px solid ${t.border2}`, padding: '14px 16px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: t.text }}>Produto ativo</div>
            <div style={{ fontSize: 12, color: t.textTer, marginTop: 1 }}>Aparece no catálogo do cliente</div>
          </div>
          <Switch on={ativo} onChange={setAtivo} />
        </div>
      </div>
      <div style={{ padding: '14px 20px', borderTop: `1px solid ${t.border2}`, background: t.appBg }}>
        <Btn full size="lg" icon="check" onClick={onBack}>{editing ? 'Salvar alterações' : 'Criar produto'}</Btn>
      </div>
    </div>
  );
}

/* ---- A3: Gestão de categorias ---- */
function MA_Categorias({ prods }) {
  const t = useT();
  const count = k => prods.filter(p => p.cat === k).length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Btn variant="gold" full icon="plus">Nova categoria</Btn>
      {MARKET_CATS.map((c, i) => {
        const n = count(c.k);
        return (
          <Card key={c.k} pad={14} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: t.surface2, display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 22 }}>{c.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: t.text }}>{c.nome}</div>
              <div style={{ fontSize: 12, color: t.textTer, marginTop: 1 }}>{n} {n === 1 ? 'produto' : 'produtos'} · ordem {i + 1}</div>
            </div>
            <button style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${t.border}`, background: t.surface, display: 'grid', placeItems: 'center', color: t.textSec, cursor: 'pointer', flexShrink: 0 }}><Icon name="edit" size={16} /></button>
            <button title={n > 0 ? 'Categoria com produtos' : 'Excluir'} style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${t.border}`, background: t.surface, display: 'grid', placeItems: 'center', color: n > 0 ? t.textTer : t.warn, cursor: 'pointer', flexShrink: 0, opacity: n > 0 ? 0.5 : 1 }}><Icon name="trash" size={16} /></button>
          </Card>
        );
      })}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: t.surface2, borderRadius: 14, fontSize: 12.5, color: t.textSec, lineHeight: 1.45 }}>
        <Icon name="alert" size={17} color={t.textTer} style={{ flexShrink: 0, marginTop: 1 }} />
        Só dá pra excluir categorias sem produtos. Mova ou apague os produtos antes.
      </div>
    </div>
  );
}

/* ---- A4: Ajuste de estoque ---- */
function MA_Estoque({ prods, setProds }) {
  const t = useT();
  const set = (id, v) => setProds(ps => ps.map(p => p.id === id ? { ...p, estoque: Math.max(0, v), esgotado: v <= 0 } : p));
  const ord = [...prods].sort((a, b) => (a.estoque - b.estoque));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, color: t.textSec, lineHeight: 1.5, marginBottom: 2 }}>Reponha inventário (fixo) ou ajuste a capacidade do dia (diário). Os mais baixos aparecem no topo.</div>
      {ord.map(p => {
        const baixo = p.estoque > 0 && p.estoque <= STOCK_LOW;
        const zero = p.estoque === 0;
        return (
          <Card key={p.id} pad={13} style={{ display: 'flex', alignItems: 'center', gap: 12, border: `1px solid ${zero ? t.warn : baixo ? t.gold : t.border2}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: t.text, display: 'flex', alignItems: 'center', gap: 7 }}>{p.nome}</div>
              <div style={{ fontSize: 11.5, color: t.textTer, marginTop: 2, display: 'flex', alignItems: 'center', gap: 7 }}>
                {p.estoqueTipo === 'diario' ? 'capacidade diária' : 'inventário fixo'}
                {zero && <Pill tone="neutral">Esgotado</Pill>}
                {baixo && <Pill tone="gold">Baixo</Pill>}
              </div>
            </div>
            <Stepper value={p.estoque} onChange={v => set(p.id, v)} max={999} />
          </Card>
        );
      })}
    </div>
  );
}

/* ---- A5: Configurações ---- */
function MA_Config({ pricing }) {
  const t = useT();
  const [minimo, setMinimo] = React.useState(MARKET_CFG.minimo);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card pad={18}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: t.text }}>Mínimo da Cestinha</div>
            <div style={{ fontSize: 12.5, color: t.textTer, marginTop: 2 }}>Valor mínimo em R$ para fechar o pedido</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setMinimo(v => Math.max(0, Math.round((v - 1) * 100) / 100))} style={{ width: 34, height: 34, borderRadius: 11, border: `1.5px solid ${t.border}`, background: t.surface, color: t.text, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="minus" size={16} stroke={2.4} /></button>
            <span style={{ minWidth: 72, textAlign: 'center', fontWeight: 800, fontSize: 18, fontFamily: 'Bricolage Grotesque, sans-serif', color: t.accent }}>{BRL(minimo)}</span>
            <button onClick={() => setMinimo(v => Math.round((v + 1) * 100) / 100)} style={{ width: 34, height: 34, borderRadius: 11, border: `1.5px solid ${t.border}`, background: t.surface, color: t.text, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="plus" size={16} stroke={2.4} /></button>
          </div>
        </div>
      </Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '14px 16px', background: t.goldSoft, borderRadius: 16 }}>
        <Icon name="coin" size={19} color={t.accent} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1, fontSize: 13, color: t.text, fontWeight: 600, lineHeight: 1.5 }}>O resgate de crédito segue o <b>preço avulso</b> ({BRL(pricing.avulsoUnit)}/pão). Cada pãezinho aplicado no mercadinho vale esse valor — ajuste em Gestão › Compra personalizada.</div>
      </div>
    </div>
  );
}

/* ---- A6: Separação do dia (market junto dos pães) ---- */
function MA_Separacao() {
  const t = useT();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 13, color: t.textSec, lineHeight: 1.5 }}>Itens do mercadinho entram na separação junto com os pães, por condomínio e slot.</div>
      {MKT_SEPARACAO.map((c, i) => (
        <Card key={i} pad={0} style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: t.surface }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: t.surface2, color: t.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="building" size={19} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: t.text }}>{c.condo}</div>
              <div style={{ fontSize: 12, color: t.textTer }}>{c.slot} · {c.paradas} entregas</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 16, color: t.text }}>{c.paes} 🥖</div>
              <div style={{ fontSize: 11, color: t.textTer }}>+ {c.itens.reduce((a, x) => a + x.qtd, 0)} itens</div>
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${t.border2}`, padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {c.itens.map((x, j) => (
              <span key={j} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, background: t.surface2, fontSize: 12.5, color: t.text, fontWeight: 600 }}>
                <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, color: t.accent }}>{x.qtd}×</span>{x.nome}
              </span>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

Object.assign(window, { MarketAdmin, MarketProductForm, MA_Produtos, MA_Categorias, MA_Estoque, MA_Config, MA_Separacao, statusProd });
