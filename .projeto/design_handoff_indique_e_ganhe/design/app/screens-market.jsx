/* ============================================================
   Cheirin de Pão — Além do Pãozin (mini market · Cliente)
   Catálogo · Detalhe · Cestinha · Checkout · Sucesso
   ============================================================ */

const slotId = p => `mkt-photo-${p.id}`;
const catOf = k => MARKET_CATS.find(c => c.k === k);
const dispoTxt = p => Array.isArray(p.dispo)
  ? 'Disponível ' + p.dispo.map(d => (DIAS.find(x => x.k === d) || {}).curt || d).join(' · ')
  : null;

/* Tons de demonstração por categoria (foto padrão) */
const CAT_TINT = {
  g: ['#F6E3B0', '#E3AC3F'],
  b: ['#F2DDC4', '#D9975A'],
  s: ['#EFE6CB', '#CBB472'],
  d: ['#DCE7D6', '#96B98C'],
  f: ['#EBE4D4', '#C4B491'],
  e: ['#ECDBC1', '#B0702A'],
};

/* Foto do produto — imagem padrão de demonstração (gradiente + emoji da categoria) */
function ProdPhoto({ p, radius = 16, height, style, dim }) {
  const t = useT();
  const cat = catOf(p.cat);
  const tint = CAT_TINT[p.cat] || ['#EFE6CB', '#C9BBA2'];
  return (
    <div style={{ position: 'relative', width: '100%', height: height || '100%', borderRadius: radius, overflow: 'hidden', background: `linear-gradient(150deg, ${tint[0]}, ${tint[1]})`, display: 'grid', placeItems: 'center', ...style }}>
      <div style={{ position: 'absolute', bottom: -18, right: -14, opacity: 0.14 }}><BreadMark size={90} color="#1E1207" /></div>
      <span style={{ position: 'relative', fontSize: 40, filter: 'drop-shadow(0 2px 6px rgba(30,18,7,0.18))' }}>{cat ? cat.emoji : '🥐'}</span>
      {dim && <div style={{ position: 'absolute', inset: 0, background: 'rgba(250,245,236,0.55)', pointerEvents: 'none' }} />}
    </div>
  );
}

/* Selo de economia ao pagar com pãezinhos */
function EconBadge({ eco, full }) {
  const t = useT();
  if (!eco) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: full ? '6px 11px' : '3px 8px', borderRadius: 999, background: t.goldSoft, color: t.accent, fontSize: full ? 12.5 : 11, fontWeight: 700, lineHeight: 1 }}>
      <span style={{ fontSize: full ? 13 : 11 }}>🥖</span>
      {full ? `Pague com pãezinhos: até ${eco}% de economia` : `até ${eco}%`}
    </span>
  );
}

/* Cabeçalho da aba (título + ícone da Cestinha com contador) */
function MarketBar({ mkt }) {
  const t = useT();
  return (
    <div style={{ padding: '4px 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 42, height: 42, borderRadius: 13, background: t.espresso, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <Icon name="basket" size={22} color="#E3AC3F" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: t.textTer, fontWeight: 600 }}>Além do Pãozin</div>
        <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 19, color: t.text, letterSpacing: '-0.02em', lineHeight: 1.05 }}>Complete seu café</div>
      </div>
      <button onClick={() => mkt.go('cestinha')} style={{ position: 'relative', width: 42, height: 42, borderRadius: 12, background: t.surface, border: `1px solid ${t.border2}`, display: 'grid', placeItems: 'center', color: t.text, cursor: 'pointer', flexShrink: 0 }}>
        <Icon name="basket" size={21} />
        {mkt.count > 0 && <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 19, height: 19, padding: '0 5px', borderRadius: 99, background: t.gold, color: t.onGold, fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center', fontFamily: 'Bricolage Grotesque, sans-serif' }}>{mkt.count}</span>}
      </button>
    </div>
  );
}

/* ===== C2 — Catálogo ===== */
function MarketCatalog({ mkt }) {
  const t = useT();
  const [cat, setCat] = React.useState('tudo');
  const [q, setQ] = React.useState('');
  const eco = economiaCredito(mkt.pricing, COMBOS);
  const ativos = MARKET_PRODS;
  const lista = ativos.filter(p => (cat === 'tudo' || p.cat === cat) && (!q || p.nome.toLowerCase().includes(q.toLowerCase())));
  const vazio = ativos.length === 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <MarketBar mkt={mkt} />
      <div style={{ padding: '0 20px 10px' }}>
        <Field icon="search" placeholder="Buscar no mercadinho" value={q} onChange={setQ} />
      </div>
      <div style={{ padding: '0 20px 12px' }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {[{ k: 'tudo', nome: 'Tudo', emoji: '✨' }, ...MARKET_CATS].map(c => {
            const on = cat === c.k;
            return (
              <button key={c.k} onClick={() => setCat(c.k)} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, border: `1.5px solid ${on ? t.accent : t.border}`, background: on ? t.goldSoft : t.surface, color: on ? t.accent : t.textSec, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Hanken Grotesk', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 13 }}>{c.emoji}</span>{c.nome}
              </button>
            );
          })}
        </div>
      </div>

      {vazio ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '28%', background: t.surface2, display: 'grid', placeItems: 'center', marginBottom: 16, color: t.textTer }}><Icon name="basket" size={34} /></div>
          <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 18, color: t.text }}>Mercadinho fechado por ora</div>
          <div style={{ fontSize: 13.5, color: t.textSec, marginTop: 6, maxWidth: 250, lineHeight: 1.5 }}>Ainda não há produtos ativos. Volte logo — tem novidade saindo do forno.</div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 100px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 15px', borderRadius: 18, background: `linear-gradient(135deg, ${t.espresso}, #2E1D0D)`, position: 'relative', overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ position: 'absolute', bottom: -34, right: -18, opacity: 0.13 }}><BreadMark size={120} color="#E3AC3F" /></div>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(227,172,63,0.18)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="coin" size={22} color="#E3AC3F" /></div>
            <div style={{ position: 'relative', flex: 1 }}>
              <div style={{ fontSize: 10.5, color: '#E3AC3F', fontWeight: 700, letterSpacing: '0.07em' }}>DUAS FORMAS DE PAGAR</div>
              <div style={{ fontSize: 13, color: '#FAF5EC', fontWeight: 600, lineHeight: 1.4, marginTop: 3 }}>Em dinheiro ou com seus pãezinhos. Pagando com <b style={{ color: '#E3AC3F' }}>🥖 você economiza até {eco}%</b>.</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
            {lista.map(p => <ProdCard key={p.id} p={p} eco={eco} mkt={mkt} />)}
          </div>
          {lista.length === 0 && <div style={{ textAlign: 'center', color: t.textTer, fontSize: 13.5, padding: '30px 0' }}>Nada encontrado por aqui.</div>}
        </div>
      )}
    </div>
  );
}

function ProdCard({ p, eco, mkt }) {
  const t = useT();
  const cat = catOf(p.cat);
  const paes = paezinhosDe(p.preco, mkt.pricing.avulsoUnit);
  const inCart = mkt.qtyOf(p.id);
  return (
    <div style={{ background: t.surface, borderRadius: 22, border: `1px solid ${t.border2}`, boxShadow: t.shadow, overflow: 'hidden', display: 'flex', flexDirection: 'column', opacity: p.esgotado ? 0.78 : 1 }}>
      <div onClick={() => !p.esgotado && mkt.open(p.id)} style={{ position: 'relative', cursor: p.esgotado ? 'default' : 'pointer' }}>
        <ProdPhoto p={p} radius={0} height={124} dim={p.esgotado} />
        {!p.esgotado && eco > 0 && (
          <span style={{ position: 'absolute', top: 9, left: 9, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 99, background: t.gold, color: t.onGold, fontSize: 11, fontWeight: 800, boxShadow: '0 3px 10px -2px rgba(30,18,7,0.35)' }}><span style={{ fontSize: 11 }}>🥖</span>−{eco}%</span>
        )}
        {p.esgotado && <span style={{ position: 'absolute', top: 9, left: 9, padding: '4px 10px', borderRadius: 99, background: t.espresso, color: '#FAF5EC', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.02em' }}>Esgotado</span>}
        {!p.esgotado && p.limitado && <span style={{ position: 'absolute', top: 9, right: 9, padding: '4px 9px', borderRadius: 99, background: t.surface, color: t.accent, fontSize: 10, fontWeight: 800, boxShadow: t.shadowSoft }}>Últimas</span>}
      </div>
      <div style={{ padding: '11px 13px 13px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.08em', color: t.textTer, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat ? cat.nome : ''}</div>
        <div onClick={() => !p.esgotado && mkt.open(p.id)} style={{ cursor: p.esgotado ? 'default' : 'pointer', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 14.5, color: t.text, lineHeight: 1.2, letterSpacing: '-0.01em', minHeight: 35 }}>{p.nome}</div>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 19, color: t.text, letterSpacing: '-0.02em' }}>{BRL(p.preco)}</span>
            <span style={{ fontSize: 10.5, color: t.textTer, fontWeight: 600 }}>à vista</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '6px 8px 6px 9px', borderRadius: 11, background: t.goldSoft }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: t.accent, minWidth: 0, whiteSpace: 'nowrap' }}><span style={{ fontSize: 12 }}>🥖</span><b style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800 }}>{paes}</b> pães</span>
            {eco > 0 && <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 12, color: t.accent, flexShrink: 0 }}>−{eco}%</span>}
          </div>
          {p.esgotado ? (
            <button disabled style={{ width: '100%', height: 38, borderRadius: 12, background: t.surface2, color: t.textTer, border: 'none', fontWeight: 700, fontSize: 13, fontFamily: 'Hanken Grotesk', cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Icon name="ban" size={15} />Esgotado</button>
          ) : inCart ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 38, background: t.primaryBtn, borderRadius: 12, padding: '0 4px' }}>
              <button onClick={() => mkt.setQty(p.id, inCart - 1)} style={{ width: 32, height: 32, borderRadius: 9, border: 'none', background: 'rgba(255,255,255,0.12)', color: t.primaryBtnText, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="minus" size={15} stroke={2.6} /></button>
              <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 15, color: t.primaryBtnText }}>{inCart}</span>
              <button onClick={() => mkt.add(p.id, 1)} style={{ width: 32, height: 32, borderRadius: 9, border: 'none', background: 'rgba(255,255,255,0.12)', color: t.primaryBtnText, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="plus" size={15} stroke={2.6} /></button>
            </div>
          ) : (
            <button onClick={() => mkt.add(p.id, 1)} style={{ width: '100%', height: 38, borderRadius: 12, background: t.primaryBtn, color: t.primaryBtnText, border: 'none', fontWeight: 700, fontSize: 13.5, fontFamily: 'Hanken Grotesk', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}><Icon name="plus" size={17} stroke={2.4} />Adicionar</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== C3 — Detalhe do produto ===== */
function ProductDetail({ mkt }) {
  const t = useT();
  const p = MARKET_PRODS.find(x => x.id === mkt.sel) || MARKET_PRODS[0];
  const cat = catOf(p.cat);
  const eco = economiaCredito(mkt.pricing, COMBOS);
  const paes = paezinhosDe(p.preco, mkt.pricing.avulsoUnit);
  const [qtd, setQtd] = React.useState(1);
  const disp = dispoTxt(p);
  const baixo = !p.esgotado && p.estoque > 0 && p.estoque <= 4;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <AppBar title="" onBack={() => mkt.go('market')} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px' }}>
        <div style={{ position: 'relative' }}>
          <ProdPhoto p={p} radius={22} height={230} dim={p.esgotado} />
          {p.esgotado && <span style={{ position: 'absolute', top: 12, left: 12, padding: '5px 12px', borderRadius: 99, background: t.espresso, color: '#FAF5EC', fontSize: 12, fontWeight: 800 }}>Esgotado</span>}
          {!p.esgotado && p.limitado && <span style={{ position: 'absolute', top: 12, left: 12, padding: '5px 12px', borderRadius: 99, background: t.gold, color: t.onGold, fontSize: 12, fontWeight: 800 }}>Últimas unidades</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <Pill tone="neutral">{cat.emoji} {cat.nome}</Pill>
          {p.estoqueTipo === 'diario' && <Pill tone="neutral">Fornada do dia</Pill>}
        </div>
        <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 24, color: t.text, letterSpacing: '-0.02em', marginTop: 10, lineHeight: 1.15 }}>{p.nome}</div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <div style={{ flex: 1, padding: '13px 15px', borderRadius: 16, border: `1.5px solid ${t.border2}`, background: t.surface }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: t.textSec }}><Icon name="card" size={15} /><span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.02em' }}>À vista</span></div>
            <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 24, color: t.text, letterSpacing: '-0.02em', marginTop: 6 }}>{BRL(p.preco)}</div>
            <div style={{ fontSize: 11.5, color: t.textTer, fontWeight: 600, marginTop: 1 }}>em dinheiro</div>
          </div>
          <div style={{ flex: 1, padding: '13px 15px', borderRadius: 16, border: `1.5px solid ${t.gold}`, background: t.goldSoft, position: 'relative' }}>
            {eco > 0 && <span style={{ position: 'absolute', top: -9, right: 12, padding: '3px 9px', borderRadius: 99, background: t.gold, color: t.onGold, fontSize: 11, fontWeight: 800 }}>−{eco}%</span>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: t.accent }}><span style={{ fontSize: 14 }}>🥖</span><span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.02em' }}>Com pãezinhos</span></div>
            <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 24, color: t.accent, letterSpacing: '-0.02em', marginTop: 6 }}>{paes} <span style={{ fontSize: 14 }}>pães</span></div>
            <div style={{ fontSize: 11.5, color: t.accent, fontWeight: 600, marginTop: 1, opacity: 0.85 }}>economize até {eco}%</div>
          </div>
        </div>

        <div style={{ fontSize: 14, color: t.textSec, lineHeight: 1.55, marginTop: 16 }}>{p.desc}</div>

        {disp && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, padding: '12px 14px', background: t.surface2, borderRadius: 14 }}>
            <Icon name="calendar" size={18} color={t.accent} />
            <span style={{ fontSize: 13, color: t.text, fontWeight: 600 }}>{disp}</span>
          </div>
        )}
        {baixo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '12px 14px', background: t.goldSoft, borderRadius: 14 }}>
            <Icon name="alert" size={18} color={t.accent} />
            <span style={{ fontSize: 13, color: t.text, fontWeight: 600 }}>Estoque baixo — só {p.estoque} {p.estoque === 1 ? 'unidade' : 'unidades'}.</span>
          </div>
        )}
      </div>

      <div style={{ padding: '14px 20px', borderTop: `1px solid ${t.border2}`, background: t.appBg }}>
        {p.esgotado ? (
          <Btn full size="lg" disabled>Esgotado</Btn>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Stepper value={qtd} onChange={v => setQtd(Math.max(1, Math.min(p.estoque, v)))} min={1} max={p.estoque} />
            <Btn full size="lg" icon="basket" onClick={() => { mkt.add(p.id, qtd); mkt.go('cestinha'); }}>Adicionar · {BRL(p.preco * qtd)}</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== C4 — Cestinha (carrinho) ===== */
function Cestinha({ mkt }) {
  const t = useT();
  const items = mkt.items();
  const subtotal = mkt.subtotal();
  const minimo = MARKET_CFG.minimo;
  const falta = minimo - subtotal;
  const abaixo = items.length > 0 && falta > 0;

  if (items.length === 0 && !mkt.paes) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <AppBar title="Sua Cestinha" onBack={() => mkt.go('market')} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
          <div style={{ width: 84, height: 84, borderRadius: '30%', background: t.surface2, display: 'grid', placeItems: 'center', marginBottom: 18, color: t.textTer }}><Icon name="basket" size={40} /></div>
          <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 20, color: t.text }}>Cestinha vazia</div>
          <div style={{ fontSize: 14, color: t.textSec, marginTop: 8, maxWidth: 260, lineHeight: 1.5 }}>Adicione geleias, bolos, café e mais pra completar o café da manhã.</div>
          <div style={{ height: 24 }} />
          <Btn size="lg" icon="basket" onClick={() => mkt.go('market')}>Ver o mercadinho</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <AppBar title="Sua Cestinha" onBack={() => mkt.go('market')} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px' }}>
        {mkt.paes > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, background: t.surface, borderRadius: 16, border: `1px dashed ${t.gold}`, padding: '13px 15px', marginBottom: 12 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: t.goldSoft, color: t.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><span style={{ fontSize: 22 }}>🥖</span></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>Seu pedido de pão</div>
              <div style={{ fontSize: 12, color: t.textTer, marginTop: 1 }}>{mkt.paes} pães · pago com créditos</div>
            </div>
            <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 16, color: t.accent }}>{mkt.paes} 🥖</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(({ p, qtd }) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: t.surface, borderRadius: 16, border: `1px solid ${t.border2}`, padding: 10 }}>
              <div style={{ width: 60, height: 60, flexShrink: 0 }}><ProdPhoto p={p} radius={12} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: t.text, lineHeight: 1.25 }}>{p.nome}</div>
                <div style={{ fontSize: 12, color: t.textTer, marginTop: 2 }}>{BRL(p.preco)} · un</div>
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: t.surface2, borderRadius: 9, padding: '2px 3px' }}>
                    <button onClick={() => mkt.setQty(p.id, qtd - 1)} style={{ width: 24, height: 24, borderRadius: 7, border: 'none', background: 'transparent', color: t.text, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="minus" size={14} stroke={2.6} /></button>
                    <span style={{ minWidth: 16, textAlign: 'center', fontWeight: 800, fontSize: 13.5, fontFamily: 'Bricolage Grotesque, sans-serif', color: t.text }}>{qtd}</span>
                    <button onClick={() => mkt.add(p.id, 1)} style={{ width: 24, height: 24, borderRadius: 7, border: 'none', background: 'transparent', color: t.text, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="plus" size={14} stroke={2.6} /></button>
                  </div>
                  <button onClick={() => mkt.remove(p.id)} style={{ background: 'none', border: 'none', color: t.textTer, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 4 }}><Icon name="trash" size={17} /></button>
                </div>
              </div>
              <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 15.5, color: t.text, flexShrink: 0 }}>{BRL(p.preco * qtd)}</span>
            </div>
          ))}
        </div>

        <button onClick={() => mkt.go('market')} style={{ marginTop: 14, width: '100%', background: 'none', border: `1.5px dashed ${t.border}`, borderRadius: 14, padding: '12px 0', color: t.accent, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'Hanken Grotesk', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Icon name="plus" size={17} />Continuar comprando</button>

        {abaixo && (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 11, padding: '13px 16px', background: t.goldSoft, border: `1.5px solid ${t.gold}`, borderRadius: 16 }}>
            <Icon name="alert" size={19} color={t.accent} />
            <div style={{ flex: 1, fontSize: 13, color: t.text, fontWeight: 600, lineHeight: 1.4 }}>Faltam <b>{BRL(falta)}</b> para o mínimo da Cestinha ({BRL(minimo)}).</div>
          </div>
        )}
      </div>

      <div style={{ padding: '14px 20px', borderTop: `1px solid ${t.border2}`, background: t.appBg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13.5, color: t.textSec, fontWeight: 600 }}>Subtotal do mercadinho</span>
          <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 22, color: t.text }}>{BRL(subtotal)}</span>
        </div>
        <Btn full size="lg" icon="chevR" disabled={abaixo || items.length === 0} onClick={() => mkt.go('checkout')}>Ir para pagamento</Btn>
      </div>
    </div>
  );
}

/* Card compacto reutilizável (home + add-on do pedido único) */
function MarketMiniCard({ p, mkt, onAdd }) {
  const t = useT();
  const eco = economiaCredito(mkt.pricing, COMBOS);
  const paes = paezinhosDe(p.preco, mkt.pricing.avulsoUnit);
  const inCart = onAdd ? mkt.qtyOf(p.id) : 0;
  return (
    <div onClick={() => mkt.open(p.id)} style={{ flexShrink: 0, width: 138, cursor: 'pointer', background: t.surface, borderRadius: 18, border: `1px solid ${t.border2}`, boxShadow: t.shadowSoft, overflow: 'hidden' }}>
      <div style={{ position: 'relative' }}>
        <ProdPhoto p={p} radius={0} height={96} />
        {eco > 0 && <span style={{ position: 'absolute', top: 7, left: 7, display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 7px', borderRadius: 99, background: t.gold, color: t.onGold, fontSize: 10, fontWeight: 800, boxShadow: '0 2px 7px -1px rgba(30,18,7,0.3)' }}><span style={{ fontSize: 10 }}>🥖</span>−{eco}%</span>}
        {p.limitado && <span style={{ position: 'absolute', top: 7, right: 7, padding: '3px 7px', borderRadius: 99, background: t.surface, color: t.accent, fontSize: 9.5, fontWeight: 800, boxShadow: t.shadowSoft }}>Últimas</span>}
        {onAdd && (
          <button onClick={e => { e.stopPropagation(); onAdd(p.id); }} style={{ position: 'absolute', right: 8, bottom: 8, minWidth: 32, height: 32, padding: '0 9px', borderRadius: 10, background: t.primaryBtn, color: t.primaryBtnText, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', boxShadow: '0 5px 14px -3px rgba(30,18,7,0.45)' }}>
            {inCart > 0 && <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 13 }}>{inCart}</span>}
            <Icon name="plus" size={16} stroke={2.6} />
          </button>
        )}
      </div>
      <div style={{ padding: '9px 11px 11px' }}>
        <div style={{ fontWeight: 700, fontSize: 12.5, color: t.text, lineHeight: 1.2, height: 30, overflow: 'hidden' }}>{p.nome}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 6 }}>
          <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 15, color: t.text, letterSpacing: '-0.01em' }}>{BRL(p.preco)}</span>
          <span style={{ fontSize: 9.5, color: t.textTer, fontWeight: 600 }}>à vista</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginTop: 6, padding: '4px 7px', borderRadius: 8, background: t.goldSoft }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, fontWeight: 700, color: t.accent, whiteSpace: 'nowrap' }}><span style={{ fontSize: 10 }}>🥖</span><b style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800 }}>{paes}</b> pães</span>
          {eco > 0 && <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 10.5, color: t.accent }}>−{eco}%</span>}
        </div>
      </div>
    </div>
  );
}

/* ===== C1 — Bloco "Além do Pãozin" na Home ===== */
function MarketHomeBlock({ mkt, loading }) {
  const t = useT();
  const destaques = MARKET_PRODS.filter(p => !p.esgotado && p.ativo !== false).slice(0, 6);
  if (loading) {
    return (
      <div>
        <div style={{ height: 18, width: 150, borderRadius: 8, background: t.surface2, marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 12 }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 130, height: 150, borderRadius: 18, background: t.surface2, flexShrink: 0 }} />)}</div>
      </div>
    );
  }
  if (destaques.length === 0) return null; // sem produtos ativos → esconde o bloco
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', margin: '4px 2px 12px', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 16 }}>🧺</span>
            <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 17, color: t.text, letterSpacing: '-0.02em' }}>Além do Pãozin</span>
          </div>
          <div style={{ fontSize: 12.5, color: t.textTer, fontWeight: 600, marginTop: 2 }}>Complete seu café da manhã</div>
        </div>
        <button onClick={() => mkt.go('market')} style={{ background: 'none', border: 'none', color: t.accent, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Hanken Grotesk', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3 }}>Ver tudo<Icon name="chevR" size={15} stroke={2.4} /></button>
      </div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4, margin: '0 -20px', padding: '0 20px 4px' }}>
        {destaques.map(p => <MarketMiniCard key={p.id} p={p} mkt={mkt} />)}
      </div>
    </div>
  );
}

Object.assign(window, { ProdPhoto, EconBadge, MarketBar, MarketCatalog, ProdCard, ProductDetail, Cestinha, MarketHomeBlock, MarketMiniCard, slotId, catOf, dispoTxt });
