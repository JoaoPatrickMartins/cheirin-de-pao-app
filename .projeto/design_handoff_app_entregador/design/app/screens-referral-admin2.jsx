/* ============================================================
   Indique e Ganhe — ADMIN · A5 Detalhe do cliente · A6 Relatório ·
   A7 Lista de espera de condomínios · A8 Preferências
   ============================================================ */

/* ===== A5 — Detalhe do cliente (aba Geral, trechos novos)
   st: default · link · linkInvalid · linkSelf · linkHas · linkDone */
function RAClientGeral({ st = 'default', acesso }) {
  const t = useT();
  const mine = ADMIN_REFERRALS.filter(r => r.de === 'João Silva');
  const valeram = mine.filter(r => r.estado === 'ganhou').length;
  const has = st === 'linkHas' || st === 'default';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <AppBar title="Maria Souza" onBack={() => {}} />
      <div style={{ display: 'flex', gap: 4, padding: '0 20px 14px' }}>
        {['Geral', 'Pedidos', 'Financeiro', 'Atividade'].map((a, i) => <span key={a} style={{ flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 11, fontSize: 13, fontWeight: 700, background: i === 0 ? t.espresso : 'transparent', color: i === 0 ? '#FBF3E4' : t.textSec }}>{a}</span>)}
      </div>
      <div style={{ padding: '0 20px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card pad={16}>
          <div style={{ fontWeight: 800, fontSize: 15, color: t.text, marginBottom: 4 }}>Cadastro</div>
          <Row label="Condomínio" value="Parque das Flores" />
          <Row label="Endereço" value="Bloco C, ap. 11" />
          <Row label="Membro desde" value="12/09/2026" />
          {acesso && <SAAccessRow acesso={acesso} />}
          {has ? (
            <button style={{ width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0', background: 'none', border: 'none', borderTop: `1px solid ${t.border2}`, cursor: 'pointer', fontFamily: 'Hanken Grotesk' }}>
              <span style={{ fontSize: 13.5, color: t.textSec, fontWeight: 600 }}>Indicado por</span><div style={{ flex: 1 }} />
              <span style={{ fontSize: 13.5, color: t.accent, fontWeight: 700 }}>João Silva</span><Icon name="chevR" size={16} color={t.accent} />
            </button>
          ) : (
            <button style={{ width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', background: 'none', border: 'none', borderTop: `1px solid ${t.border2}`, color: t.accent, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'Hanken Grotesk' }}><Icon name="link" size={16} />Vincular indicação</button>
          )}
        </Card>
        <Card pad={16}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: t.goldSoft, color: t.accent, display: 'grid', placeItems: 'center' }}><Icon name="gift" size={18} /></div>
            <div style={{ flex: 1, fontWeight: 800, fontSize: 15, color: t.text }}>Indicações</div>
            <span style={{ fontSize: 12, color: t.textTer, fontWeight: 600 }}>código JOAO7K2F</span>
          </div>
          <div style={{ display: 'flex', margin: '14px 0 6px', background: t.surfaceAlt, borderRadius: 14 }}>
            {[[mine.length, 'fez'], [valeram, 'valeram'], [5, 'pãezins ganhos']].map(([n, l], i) => (
              <div key={l} style={{ flex: 1, padding: '10px 6px', textAlign: 'center', borderLeft: i ? `1px solid ${t.border2}` : 'none' }}>
                <div style={{ fontFamily: RF_H, fontWeight: 800, fontSize: 22, color: i === 2 ? t.good : t.text }}>{n}</div>
                <div style={{ fontSize: 11.5, color: t.textSec, fontWeight: 600 }}>{l}</div>
              </div>
            ))}
          </div>
          {mine.map((r, i) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < mine.length - 1 ? `1px solid ${t.border2}` : 'none' }}>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: t.text }}>{r.para}</span>
              <span style={{ fontSize: 11.5, color: t.textTer, fontWeight: 600 }}>{r.data}</span>
              <RAPill estado={r.estado} />
            </div>
          ))}
        </Card>
      </div>
      {st.startsWith('link') && st !== 'linkHas' && <RALinkSheet st={st} />}
    </div>
  );
}
function RALinkSheet({ st }) {
  const t = useT();
  const val = { link: 'JOAO7K2F', linkInvalid: 'JOAO7K2X', linkSelf: 'MARI4P9Q', linkDone: 'JOAO7K2F' }[st];
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(30,18,7,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 20 }}>
      <div style={{ width: '100%', background: t.appBg, borderRadius: '26px 26px 0 0', padding: '10px 20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ width: 40, height: 5, borderRadius: 9, background: t.border, margin: '0 auto 4px' }} />
        <div style={{ fontFamily: RF_H, fontWeight: 700, fontSize: 20, color: t.text, letterSpacing: '-0.02em' }}>Vincular indicação</div>
        <div style={{ fontSize: 13, color: t.textSec, marginTop: -8, lineHeight: 1.45 }}>Para quem esqueceu de usar o código no cadastro. Só dá para vincular uma vez.</div>
        <Field label="Código de quem indicou" icon="ticket" value={val} />
        {st === 'link' && <RAInline tone="gold">Código de <b>João Silva</b> (Parque das Flores). Ao confirmar, a indicação entra como "Aguardando 1º pedido" — ou é recompensada na hora, se a Maria já recebeu a 1ª entrega.</RAInline>}
        {st === 'linkInvalid' && <RAInline>Código não encontrado. Confira as letras com o cliente.</RAInline>}
        {st === 'linkSelf' && <RAInline>Esse é o código da própria Maria. Ninguém pode indicar a si mesmo.</RAInline>}
        {st === 'linkDone' && <RAInline tone="good">Vinculado! Maria agora aparece como indicada por João Silva.</RAInline>}
        <div style={{ display: 'flex', gap: 10 }}><Btn full variant="soft">{st === 'linkDone' ? 'Fechar' : 'Cancelar'}</Btn>{st !== 'linkDone' && <Btn full icon="check" disabled={st !== 'link'}>Confirmar</Btn>}</div>
      </div>
    </div>
  );
}

/* ===== A6 — Relatório "Indicações". st: default · loading · empty */
function RAReport({ st = 'default', back = () => {} }) {
  const t = useT();
  const R = REFERRAL_REPORT;
  const empty = st === 'empty';
  const kpis = [['Cadastros por indicação', R.cadastros], ['Recompensadas', R.recompensados], ['Conversão', Math.round(R.recompensados / R.cadastros * 100) + '%'], ['Pãezins concedidos', R.paesIndicador + R.paesAmigo], ['Custo estimado', BRL(R.custo)]];
  const funnel = [['Visitas pelo link', R.visitas], ['Cadastros', R.cadastros], ['Confirmados', R.confirmados], ['Recompensados', R.recompensados]];
  const dist = Object.entries(R.porEstado);
  const tot = dist.reduce((a, [, v]) => a + v, 0);
  const distC = { cadastro: t.textTer, aguardando: t.goldSoft, analise: t.gold, ganhou: t.good, recusada: t.accent, expirou: t.surface2 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <AppBar title="Indicações" onBack={back} />
      <div style={{ padding: '0 20px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 12, color: t.textTer, fontWeight: 700, marginTop: -8 }}>Relatórios › Aquisição & clientes</div>
        <RAChips items={[{ k: '7', l: '7 dias' }, { k: '30', l: '30 dias' }, { k: '90', l: '90 dias' }, { k: 'custom', l: 'Personalizado' }]} value="30" />
        {st === 'loading' ? <><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{[0, 1, 2, 3].map(i => <RefSkel key={i} h={78} r={18} />)}</div><RefSkel h={190} r={22} /><RefSkel h={140} r={22} /></> : empty ? (
          <Card pad={26} style={{ textAlign: 'center', marginTop: 10 }}>
            <Icon name="trend" size={28} color={t.textTer} />
            <div style={{ fontFamily: RF_H, fontWeight: 700, fontSize: 18, color: t.text, marginTop: 10 }}>Sem indicações no período</div>
            <div style={{ fontSize: 13, color: t.textSec, marginTop: 5, lineHeight: 1.5 }}>Tente um período maior ou crie uma campanha para movimentar.</div>
          </Card>
        ) : <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
            {kpis.map(([l, v], i) => (
              <Card key={l} pad={14} style={i === 4 ? { gridColumn: '1 / -1', background: t.espresso, border: 'none' } : null}>
                <div style={{ fontSize: 12, color: i === 4 ? 'rgba(250,245,236,0.7)' : t.textSec, fontWeight: 600, lineHeight: 1.3 }}>{l}</div>
                <div style={{ fontFamily: RF_H, fontWeight: 800, fontSize: 26, letterSpacing: '-0.03em', color: i === 4 ? t.gold : t.text, marginTop: 6 }}>{v}</div>
                {i === 4 && <div style={{ fontSize: 12, color: 'rgba(250,245,236,0.7)', marginTop: 2 }}>{R.paesIndicador} para quem indicou · {R.paesAmigo} para amigos</div>}
              </Card>
            ))}
          </div>
          <Card pad={16}>
            <div style={{ fontWeight: 800, fontSize: 15, color: t.text, marginBottom: 12 }}>Funil</div>
            {funnel.map(([l, v], i) => (
              <div key={l} style={{ marginBottom: i < 3 ? 10 : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: t.textSec, marginBottom: 5 }}><span>{l}</span><span style={{ color: t.text, fontWeight: 800 }}>{v}{i > 0 && <span style={{ color: t.textTer, fontWeight: 600 }}> · {Math.round(v / funnel[i - 1][1] * 100)}%</span>}</span></div>
                <div style={{ height: 12, borderRadius: 99, background: t.surface2 }}><div style={{ height: '100%', width: `${Math.max(4, v / R.visitas * 100)}%`, borderRadius: 99, background: i === 3 ? t.good : t.gold }} /></div>
              </div>
            ))}
          </Card>
          <Card pad={16}>
            <div style={{ fontWeight: 800, fontSize: 15, color: t.text }}>Custo × receita dos indicados</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'flex-end', height: 110 }}>
              {[['Custo', R.custo, t.accent], ['Receita', R.receitaIndicados, t.good]].map(([l, v, c]) => (
                <div key={l} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: t.text }}>{BRL(v)}</span>
                  <div style={{ width: '100%', height: `${Math.max(8, v / R.receitaIndicados * 70)}%`, borderRadius: 10, background: c }} />
                  <span style={{ fontSize: 12, color: t.textSec, fontWeight: 600 }}>{l}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: t.textSec }}>Cada R$ 1 em bônus trouxe <b style={{ color: t.good }}>{BRL(R.receitaIndicados / R.custo)}</b> em pedidos.</div>
          </Card>
          <Card pad={16}>
            <div style={{ fontWeight: 800, fontSize: 15, color: t.text, marginBottom: 6 }}>Top 5 indicadores</div>
            {R.top.map((p, i) => (
              <div key={p.nome} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < 4 ? `1px solid ${t.border2}` : 'none' }}>
                <span style={{ width: 24, fontFamily: RF_H, fontWeight: 800, fontSize: 15, color: i === 0 ? t.accent : t.textTer }}>{i + 1}</span>
                <span style={{ flex: 1, fontWeight: 700, fontSize: 13.5, color: t.text }}>{p.nome}</span>
                <span style={{ fontSize: 12.5, color: t.textSec, fontWeight: 600 }}>{p.ind} indic.</span>
                <span style={{ width: 44, textAlign: 'right', fontFamily: RF_H, fontWeight: 800, fontSize: 14, color: t.good }}>+{p.ganhos}</span>
              </div>
            ))}
          </Card>
          <Card pad={16}>
            <div style={{ fontWeight: 800, fontSize: 15, color: t.text, marginBottom: 12 }}>Por estado</div>
            <div style={{ display: 'flex', height: 14, borderRadius: 99, overflow: 'hidden', gap: 2 }}>{dist.map(([k, v]) => <div key={k} style={{ flex: v, background: distC[k] }} />)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '8px 12px', marginTop: 12 }}>
              {dist.map(([k, v]) => <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: t.textSec, fontWeight: 600 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: distC[k], border: `1px solid ${t.border}` }} /><span style={{ flex: 1 }}>{RA_STATE[k].l}</span><b style={{ color: t.text }}>{v}</b><span style={{ color: t.textTer }}>{Math.round(v / tot * 100)}%</span></div>)}
            </div>
          </Card>
        </>}
      </div>
    </div>
  );
}

/* ===== A7 — Pedidos de novos condomínios (Gestão › Condomínios) */
function RACondoInterests({ embedded }) {
  const t = useT();
  const [open, setOpen] = React.useState(0);
  const [done, setDone] = React.useState(CONDO_INTERESTS.map(c => !!c.tratado));
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {!embedded && <AppBar title="Condomínios" onBack={() => {}} />}
      <div style={{ padding: embedded ? '20px 0 0' : '0 20px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <RALabel hint="Clientes que não acharam o condomínio no cadastro.">Pedidos de novos condomínios</RALabel>
        {CONDO_INTERESTS.map((c, i) => (
          <Card key={c.nome} pad={0} style={{ opacity: done[i] ? 0.6 : 1 }}>
            <button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i} style={{ width: '100%', minHeight: 64, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'Hanken Grotesk' }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: t.surface2, color: t.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="building" size={20} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: t.text }}>{c.nome}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 5, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: t.textSec, fontWeight: 600 }}>{c.cidade} · {c.pedidos} {c.pedidos === 1 ? 'pedido' : 'pedidos'}</span>
                  {c.indicacao > 0 && <Pill tone="gold"><Icon name="gift" size={11} stroke={2.4} />{c.indicacao} por indicação</Pill>}
                  {done[i] && <Pill tone="good"><Icon name="check" size={11} stroke={2.6} />Tratado</Pill>}
                </div>
              </div>
              <Icon name="chevD" size={18} color={t.textTer} style={{ transform: open === i ? 'rotate(180deg)' : 'none' }} />
            </button>
            {open === i && <div style={{ padding: '0 14px 14px' }}>
              {c.contatos.map((p, j) => (
                <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: `1px solid ${t.border2}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 13.5, color: t.text }}>{p.nome}{p.ind && <span style={{ color: t.accent, fontWeight: 600, fontSize: 12 }}> · indicado</span>}</div><div style={{ fontSize: 12.5, color: t.textSec }}>{p.contato}</div></div>
                  <span style={{ fontSize: 11.5, color: t.textTer, fontWeight: 600 }}>{p.data}</span>
                </div>
              ))}
              <div style={{ marginTop: 10 }}><Btn full variant={done[i] ? 'soft' : 'ghost'} icon="check" onClick={() => setDone(done.map((d, k) => k === i ? !d : d))}>{done[i] ? 'Reabrir' : 'Marcar como tratado'}</Btn></div>
            </div>}
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ===== A8 — Preferências de notificação do admin */
function RANotifPrefs() {
  const t = useT();
  const [v, setV] = React.useState({ a: true, b: false, c: true, x: true, y: true });
  const items = [['x', 'Pedido com problema', 'Pagamento recusado ou entrega não feita'], ['y', 'Estoque baixo', 'Além do Pãozin'], ['a', 'Indicação para analisar', 'Quando uma indicação cai em análise', true], ['b', 'Indicação recompensada', 'A cada recompensa creditada', true], ['c', 'Pedido de novo condomínio', 'Quando alguém entra na lista de espera', true]];
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <AppBar title="Notificações" onBack={() => {}} />
      <div style={{ padding: '0 20px 28px' }}>
        <Card pad={0}>
          {items.map(([k, l, d, novo], i) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: i < items.length - 1 ? `1px solid ${t.border2}` : 'none' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ fontWeight: 700, fontSize: 14, color: t.text }}>{l}</span>{novo && <Pill tone="gold" style={{ padding: '2px 8px', fontSize: 10.5 }}>novo</Pill>}</div>
                <div style={{ fontSize: 12, color: t.textSec, marginTop: 2 }}>{d}</div>
              </div>
              <Switch on={v[k]} onChange={x => setV({ ...v, [k]: x })} />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, { RAClientGeral, RALinkSheet, RAReport, RACondoInterests, RANotifPrefs });
