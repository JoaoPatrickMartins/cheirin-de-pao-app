/* ============================================================
   App do Entregador — ADMIN (2/2)
   Hub Gestão (card A5) · A6 Acesso do condomínio · A7 Gancho na rota ·
   A8 Pagamentos · A9 Combustível & rotas · A10 Notificações + Entregas & falhas
   ============================================================ */

/* ---------- Hub Gestão com o card novo "Rotas e comprovante" ---------- */
function CAGestaoHub() {
  const t = useT();
  const cards = [['users', 'Entregadores', 'Cadastro, regras, escala e pagamentos', '3'], ['route', 'Rotas e comprovante', 'Base, tempo por porta, combustível, foto', 'novo'], ['building', 'Condomínios', 'Parceiros e acesso para o entregador', '1'], ['hook', 'Solicitação de Gancho', 'Fila de ganchos a entregar', '4'], ['wallet', 'Financeiro', 'Despesas e pagamentos'], ['doc', 'Relatórios', 'Operação & financeiro']];
  return (
    <CAScreen tab="gestao" head={<CAHead titulo="Gestão" sub="Cheirin de Pão" />}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {cards.map(([ic, h, d, b]) => (
          <Card key={h} pad={14} style={{ position: 'relative', border: b === 'novo' ? `2px solid ${t.gold}` : undefined }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: b === 'novo' ? t.gold : t.surface2, color: b === 'novo' ? t.onGold : t.accent, display: 'grid', placeItems: 'center' }}><Icon name={ic} size={20} /></div>
            <div style={{ fontWeight: 800, fontSize: 14.5, color: t.text, marginTop: 10 }}>{h}</div>
            <div style={{ fontSize: 12, color: t.textSec, marginTop: 2, lineHeight: 1.35 }}>{d}</div>
            {b && <span style={{ position: 'absolute', top: 12, right: 12 }}>{b === 'novo' ? <CRTag tone="gold" size="sm">novo</CRTag> : <span style={{ minWidth: 20, height: 20, borderRadius: 99, background: t.danger, color: '#fff', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center', padding: '0 6px' }}>{b}</span>}</span>}
          </Card>
        ))}
      </div>
    </CAScreen>
  );
}

/* ===== A6 — Condomínio › Acesso para o entregador. st: empty · filled · sug */
function CACondoAccess({ st = 'filled' }) {
  const t = useT();
  const a = st === 'empty' ? {} : CR_ENTREGAS[0].acesso;
  return (
    <CAScreen head={<CAHead back titulo="Residencial Jardins" sub="Condomínio" />} pad="0 16px 110px" overlay={
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 16px 20px', background: t.surface, borderTop: `1px solid ${t.border2}` }}><Btn full size="lg" icon="check">Salvar</Btn></div>
    }>
      <CASeg value="acesso" items={[['dados', 'Dados'], ['blocos', 'Blocos'], ['acesso', 'Acesso']]} />
      {st === 'sug' && (
        <CASec title="Sugestões dos entregadores" right={<span style={{ minWidth: 20, height: 20, borderRadius: 99, background: t.danger, color: '#fff', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center', padding: '0 6px' }}>2</span>}>
          <Card pad={0}>
            {[['Antônio R.', '29/09', 'Portão', 'O interfone agora é 9, não 0.'], ['Joana P.', '27/09', 'Onde parar', 'A vaga de visitante mudou para o lado esquerdo.']].map(([n, d, c, x], i) => (
              <div key={n} style={{ padding: '12px 16px', borderTop: i ? `1px solid ${t.border2}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CRAvatar nome={n} size={28} /><span style={{ flex: 1, fontSize: 13.5, fontWeight: 800, color: t.text }}>{n} · {d}</span><CRTag size="sm">{c}</CRTag></div>
                <div style={{ fontSize: 14, color: t.text, margin: '6px 0 10px 36px' }}>“{x}”</div>
                <div style={{ display: 'flex', gap: 8, marginLeft: 36 }}><Btn size="sm" variant="gold" icon="check">Aplicar</Btn><Btn size="sm" variant="ghost">Descartar</Btn></div>
              </div>
            ))}
          </Card>
        </CASec>
      )}
      <CASec title="Acesso para o entregador">
        <Card pad={16} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}><Field label="Portaria · horário" value={a.portaria ? '24 h' : ''} placeholder="Ex.: 05:00–22:00" icon="clock" /></div>
            <div style={{ width: 120 }}><div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec, marginBottom: 7 }}>Tem porteiro?</div><CASeg small value={a.portaria ? 'sim' : null} items={[['sim', 'Sim'], ['nao', 'Não']]} /></div>
          </div>
          <Field label="Portão / código de acesso" value={a.portao || ''} placeholder="Ex.: interfone, tag, código" icon="lock" />
          <Field label="Onde parar o veículo" value={a.parar || ''} placeholder="Ex.: vaga de visitante" icon="moto" />
          <Field label="Observações" value={a.obs || ''} placeholder="Qualquer dica que ajude às 5 h" icon="doc" />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec, marginBottom: 7 }}>Foto da entrada</div>
            {a.foto ? <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><CRPhotoPh w={110} h={80} r={14} label="entrada" /><Btn size="sm" variant="ghost" icon="camera">Trocar</Btn></div>
              : <div style={{ height: 80, borderRadius: 14, border: `2px dashed ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: t.accent, fontWeight: 800, fontSize: 14 }}><Icon name="camera" size={20} />Adicionar foto</div>}
          </div>
          {st === 'empty' && <div style={{ fontSize: 12.5, color: t.textSec }}>Sem dicas, o entregador vê “Nenhuma dica ainda · Sugerir”.</div>}
        </Card>
      </CASec>
    </CAScreen>
  );
}

/* ===== A7 — Solicitação de Gancho · "Enviar na rota"
   st: list · sheet */
function CAHooks({ st = 'list' }) {
  const t = useT();
  const L = [
    { n: 'Ana Lima', c: 'Residencial Jardins · B2 · Lado A · 12', s: 'rota', x: 'Na rota de 30/09 · Manhã · Antônio' },
    { n: 'Hugo Martins', c: 'Vila Verde · A · 3', s: 'fila', x: 'Pedido em 27/09' },
    { n: 'Juliana Rocha', c: 'Condomínio Bela Vista · 32', s: 'entregue', x: 'Entregue por Antônio R. · 29/09 05:44' },
    { n: 'Otávio Reis', c: 'Edifício Aurora · 42', s: 'volta', x: 'Ficou para outro dia (29/09) · voltou para a fila' },
  ];
  const tag = { fila: <CRTag ic="clock">na fila</CRTag>, rota: <CRTag ic="route" tone="gold">na rota</CRTag>, entregue: <CRTag ic="check" tone="good">entregue</CRTag>, volta: <CRTag ic="refresh" tone="warn">não entregue na rota</CRTag> };
  return (
    <CAScreen tab="gestao" head={<CAHead back titulo="Solicitação de Gancho" />} overlay={st === 'sheet' && (
      <CRSheet title="Enviar na rota" sub="Hugo Martins · Vila Verde · A · 3" onClose={() => {}}>
        <CRLabel>Data</CRLabel>
        <div style={{ display: 'flex', gap: 6 }}>{['Qua 01/10', 'Qui 02/10', 'Sex 03/10'].map((d, i) => <span key={d} style={{ flex: 1, height: 48, borderRadius: 14, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14, background: i === 0 ? t.text : t.surface, color: i === 0 ? t.appBg : t.text, border: `1.5px solid ${i === 0 ? t.text : t.border}` }}>{d}</span>)}</div>
        <CRLabel style={{ marginTop: 14 }}>Turno</CRLabel>
        <CASeg value="m" items={[['m', '☀️ Manhã'], ['t', '🌇 Tarde']]} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, padding: '12px 14px', borderRadius: 14, background: t.surface2 }}><CRAvatar nome="Antônio Ribeiro" size={34} /><div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 14.5 }}>Antônio R.</div><div style={{ fontSize: 12.5, color: t.textSec }}>Entregador da rota do cliente</div></div></div>
        <CRNote ic="hook" style={{ marginTop: 12 }}>O gancho entra na parada do Hugo. O entregador confirma se deixou.</CRNote>
        <div style={{ height: 14 }} />
        <Btn full size="lg" icon="route">Enviar na rota de 01/10</Btn>
      </CRSheet>
    )}>
      <CASeg value="fila" items={[['fila', 'A entregar · 4'], ['feito', 'Entregues']]} />
      <Card pad={0}>
        {L.map((g, i) => (
          <div key={g.n} style={{ padding: '12px 16px', borderTop: i ? `1px solid ${t.border2}` : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 18 }}>🪝</span><span style={{ flex: 1, fontWeight: 800, fontSize: 15, color: t.text }}>{g.n}</span>{tag[g.s]}</div>
            <div style={{ fontSize: 12.5, color: t.textSec, margin: '2px 0 0 30px' }}>{g.c}</div>
            <div style={{ fontSize: 12.5, color: g.s === 'rota' ? t.accent : t.textTer, fontWeight: 700, margin: '4px 0 0 30px' }}>{g.x}</div>
            {g.s !== 'entregue' && (
              <div style={{ display: 'flex', gap: 8, margin: '10px 0 0 30px' }}>
                {g.s === 'rota' ? <Btn size="sm" variant="ghost" icon="x">Tirar da rota</Btn> : <Btn size="sm" variant="gold" icon="route">Enviar na rota</Btn>}
                <Btn size="sm" variant="soft" icon="check">Registrar entrega</Btn>
              </div>
            )}
          </div>
        ))}
      </Card>
    </CAScreen>
  );
}

/* ===== A8 — Pagamentos dos entregadores
   st: list · edit · approve · history */
function CAPayCard({ p }) {
  const t = useT();
  const nomod = !p.modalidade, nofuel = p.combustivel == null;
  const ed = p.status === 'editada';
  return (
    <Card pad={14}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <CRAvatar nome={p.nome} size={38} />
        <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 15, color: t.text }}>{p.nome}</div><div style={{ fontSize: 12.5, color: t.textSec }}>{nomod ? 'sem modalidade' : MODALIDADES[p.modalidade].l}</div></div>
        {ed ? <CRTag ic="edit" tone="gold" size="sm">editada</CRTag> : <CRTag ic="clock" size="sm">pendente</CRTag>}
      </div>
      {nomod && <CRNote ic="alert" tone="gold" style={{ marginTop: 10 }}>Modalidade não definida — proposta só com o combustível.</CRNote>}
      <div style={{ marginTop: 10, borderTop: `1px solid ${t.border2}` }}>
        {!nomod && <div style={{ display: 'flex', padding: '8px 0', fontSize: 13.5 }}><span style={{ flex: 1, color: t.textSec }}>🛵 Remuneração · {p.base}</span><b style={{ whiteSpace: 'nowrap', paddingLeft: 8 }}>{crR(p.remuneracao)}</b></div>}
        {nofuel ? <div style={{ fontSize: 12.5, color: t.textTer, padding: '4px 0 8px' }}>Sem consumo cadastrado — sem combustível.</div>
          : <div style={{ display: 'flex', padding: '8px 0', fontSize: 13.5, borderTop: nomod ? 'none' : `1px solid ${t.border2}` }}><span style={{ flex: 1, color: t.textSec }}>⛽ Combustível estimado<br /><span style={{ fontSize: 12 }}>{crN(p.km)} km ÷ {p.kmL} km/l × R$ 6,09</span></span><b style={{ whiteSpace: 'nowrap', paddingLeft: 8 }}>≈ {crR(p.combustivel)}</b></div>}
        <div style={{ display: 'flex', alignItems: 'baseline', padding: '8px 0 0', borderTop: `1px solid ${t.border2}` }}>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: t.textTer }}>{ed ? 'ESTIMADO → FINAL' : 'TOTAL ESTIMADO'}</span>
          {ed && <span style={{ fontSize: 13.5, color: t.textSec, fontWeight: 600, marginRight: 6, textDecoration: 'line-through' }}>{crR(p.estimado)}</span>}
          <span style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 21, color: t.text }}>{crR(ed ? p.final : p.estimado)}</span>
        </div>
        {ed && <div style={{ fontSize: 12, color: t.textSec, textAlign: 'right' }}>Ajuste: {p.ajuste}</div>}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        <Btn size="sm" variant="gold" icon="check" style={{ flex: 1.2 }}>Aprovar</Btn>
        <Btn size="sm" variant="ghost" icon="edit" style={{ flex: 1 }}>Editar</Btn>
        <Btn size="sm" variant="ghost" style={{ flex: 1, color: t.danger }}>Descartar</Btn>
      </div>
    </Card>
  );
}
function CAPayouts({ st = 'list' }) {
  const t = useT();
  const p0 = ADMIN_PAYOUTS[0];
  const overlay = st === 'edit' ? (
    <CRSheet title="Editar proposta" sub="Antônio R. · 29/09–05/10" onClose={() => {}}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Remuneração final" value="213,00" icon="coin" suffix="estimado R$ 213,00" />
        <Field label="Combustível final" value="10,00" icon="fuel" suffix="estimado R$ 7,80" />
        <Field label="Motivo do ajuste (opcional)" value="Desvio por obra na Av. Brasil" />
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', borderRadius: 14, background: t.surface2 }}><span style={{ flex: 1, fontSize: 13.5, color: t.textSec, fontWeight: 700 }}>estimado {crR(220.8)} →</span><span style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 20 }}>{crR(223)}</span></div>
        <Btn full size="lg" icon="check">Salvar edição</Btn>
      </div>
    </CRSheet>
  ) : st === 'approve' ? (
    <CRSheet title="Aprovar pagamento" sub={`Antônio R. · ${crR(p0.estimado)}`} onClose={() => {}}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <CRChoice ic="check" on note="Registra a data e a forma">Pago agora</CRChoice>
        <CRChoice ic="clock" note="Define o vencimento">A pagar</CRChoice>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}><div style={{ flex: 1, minWidth: 0 }}><Field label="Data" value="30/09/2026" icon="calendar" /></div><div style={{ flex: 1, minWidth: 0 }}><Field label="Forma" value="Pix" icon="wallet" /></div></div>
      <div style={{ marginTop: 14, borderRadius: 16, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: t.textTer, background: t.surfaceAlt }}>VIRA DESPESA NO FINANCEIRO</div>
        <div style={{ display: 'flex', padding: '10px 14px', fontSize: 14 }}><span style={{ flex: 1 }}>🛵 Entregador</span><b>{crR(213)}</b></div>
        <div style={{ display: 'flex', padding: '10px 14px', fontSize: 14, borderTop: `1px solid ${t.border2}` }}><span style={{ flex: 1 }}>⛽ Combustível</span><b>{crR(7.8)}</b></div>
        <div style={{ padding: '8px 14px 12px', fontSize: 12.5, color: t.textSec }}>Favorecido: Antônio Ribeiro · status pago</div>
      </div>
      <div style={{ height: 14 }} />
      <Btn full size="lg" variant="gold" icon="check">Aprovar e lançar</Btn>
    </CRSheet>
  ) : null;
  return (
    <CAScreen head={<CAHead back titulo="Pagamentos" sub="Entregadores" />} overlay={overlay}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button style={{ width: 40, height: 40, borderRadius: 12, border: `1.5px solid ${t.border}`, background: t.surface, display: 'grid', placeItems: 'center' }}><Icon name="chevL" size={18} /></button>
        <div style={{ flex: 1, textAlign: 'center' }}><div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 17, color: t.text }}>Semana 29/09–05/10</div><div style={{ fontSize: 12, color: t.textSec, fontWeight: 600 }}>4 propostas · total estimado {crR(880.9)}</div></div>
        <button style={{ width: 40, height: 40, borderRadius: 12, border: `1.5px solid ${t.border}`, background: t.surface, display: 'grid', placeItems: 'center' }}><Icon name="chevR" size={18} /></button>
      </div>
      <CASeg value={st === 'history' ? 'h' : 'p'} items={[['p', 'Propostas · 4'], ['h', 'Histórico']]} />
      {st !== 'history' ? ADMIN_PAYOUTS.map(p => <CAPayCard key={p.nome} p={p} />) : (
        <Card pad={0}>
          {[['Antônio R.', '22/09–28/09', 323.4, 320, 'pago', 'Pago 29/09 · Pix'], ['Joana P.', '22/09–28/09', 408.2, 408.2, 'a_pagar', 'Vence 02/10'], ['Rui M.', '22/09–28/09', 2.1, null, 'descartada', 'Descartada: rotas cobertas por outro'], ['Antônio R.', '15/09–21/09', 309.4, 309.4, 'pago', 'Pago 22/09 · Pix']].map(([n, per, e, f, s, x], i) => (
            <div key={i} style={{ padding: '12px 16px', borderTop: i ? `1px solid ${t.border2}` : 'none', opacity: s === 'descartada' ? 0.6 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ flex: 1, fontWeight: 800, fontSize: 14.5, color: t.text }}>{n} · <span style={{ fontWeight: 600, color: t.textSec }}>{per}</span></span>{s === 'pago' ? <CRTag ic="check" tone="good" size="sm">pago</CRTag> : s === 'a_pagar' ? <CRTag ic="clock" tone="gold" size="sm">a pagar</CRTag> : <CRTag ic="x" size="sm">descartada</CRTag>}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}><span style={{ fontSize: 13, color: t.textSec }}>estimado {crR(e)}{f != null && f !== e ? ' →' : ''}</span>{f != null && <b style={{ fontFamily: CR_H, fontSize: 16, color: t.text }}>{f !== e ? crR(f) : ''}</b>}<span style={{ flex: 1 }} />{s !== 'descartada' && <span style={{ fontSize: 12.5, color: t.accent, fontWeight: 800, display: 'flex', gap: 4, alignItems: 'center' }}>ver despesa<Icon name="external" size={12} /></span>}</div>
              <div style={{ fontSize: 12, color: t.textTer, marginTop: 2 }}>{x}</div>
            </div>
          ))}
        </Card>
      )}
    </CAScreen>
  );
}

/* ===== A9 — Relatório "Combustível & rotas". st: data · loading · empty */
function CAFuelReport({ st = 'data' }) {
  const t = useT();
  const r = ADMIN_FUEL_REPORT;
  const kpi = [['Km estimado', `~${r.km}`], ['Litros', `~${crN(r.litros)}`], ['Gasto', `≈ ${crR(r.gasto)}`], ['Por entrega', crR(r.porEntrega)], ['Por pão', crR(r.porPao)]];
  return (
    <CAScreen head={<CAHead back titulo="Combustível & rotas" sub="Relatórios · Operação & financeiro" />}>
      <CASeg value="30" items={[['7', '7 dias'], ['30', '30 dias'], ['m', 'Mês'], ['c', 'Período']]} small />
      {st === 'loading' ? <><CRSkel h={140} r={20} /><CRSkel h={200} r={20} /></> : st === 'empty' ? (
        <Card pad={24} style={{ textAlign: 'center' }}><Icon name="fuel" size={32} color={t.textTer} /><div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 19, color: t.text, marginTop: 10 }}>Sem rotas no período</div><div style={{ fontSize: 13.5, color: t.textSec, marginTop: 4 }}>Os números aparecem quando houver rotas encerradas.</div></Card>
      ) : <>
        <CRNote ic="alert">Tudo estimado pela rota planejada e pelo consumo cadastrado de cada veículo.</CRNote>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {kpi.map(([l, v], i) => <div key={l} style={{ gridColumn: i < 2 ? 'span 1' : 'auto', background: i === 2 ? t.espresso : t.surface, color: i === 2 ? '#FAF5EC' : t.text, borderRadius: 16, padding: '12px', border: `1px solid ${t.border2}` }}><div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 19, color: i === 2 ? '#E3AC3F' : t.text }}>{v}</div><div style={{ fontSize: 12, fontWeight: 700, color: i === 2 ? '#C7B595' : t.textSec }}>{l}</div></div>)}
          <div style={{ background: t.goodSoft, borderRadius: 16, padding: 12 }}><div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 19, color: t.good }}>−{r.economiaRotasKm} km</div><div style={{ fontSize: 12, fontWeight: 700, color: t.good }}>rotas sugeridas</div></div>
        </div>
        <Card pad={14} style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Icon name="spark" size={20} color={t.accent} /><div style={{ flex: 1, fontSize: 14, color: t.text, fontWeight: 600 }}>Rotas aceitas economizaram <b>~42 km</b> no mês (≈ R$ 6,70).</div></Card>
        <Card pad={0}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', padding: '10px 14px', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: t.textTer, borderBottom: `1px solid ${t.border2}` }}><span>ENTREGADOR</span><span style={{ textAlign: 'right' }}>KM</span><span style={{ textAlign: 'right' }}>R$</span><span style={{ textAlign: 'right' }}>R$/ENTR.</span></div>
          {r.porEntregador.map(e => <div key={e.nome} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', padding: '12px 14px', fontSize: 13.5, borderTop: `1px solid ${t.border2}`, color: t.text }}><b>{e.nome}</b><span style={{ textAlign: 'right' }}>~{e.km}</span><span style={{ textAlign: 'right' }}>{crN(e.gasto.toFixed(2))}</span><span style={{ textAlign: 'right', fontWeight: 800 }}>{crN((e.gasto / e.entregas).toFixed(2))}</span></div>)}
        </Card>
        <Btn full variant="ghost" icon="wallet">Ir para pagamentos</Btn>
      </>}
    </CAScreen>
  );
}

/* ===== A10 — Notificações do admin (tipos novos) + preferências */
const CA_NOTIF_TYPES = [
  { k: 'problema', ic: 'alert', tone: 'danger', t: 'Problema reportado', x: 'Antônio R.: “Confirmei por engano” · Apto 204, Jardins', cta: 'Ver pedido', h: '05:40' },
  { k: 'ocorrencia', ic: 'moto', tone: 'gold', t: 'Ocorrência do entregador', x: 'Joana P. · Problema no veículo: pneu furado, ~20 min de atraso', cta: 'Ver', h: '05:52' },
  { k: 'acesso', ic: 'gate', tone: 'neutral', t: 'Sugestão de acesso', x: 'Residencial Jardins · “O interfone agora é 9”', cta: 'Revisar', h: 'Ontem' },
  { k: 'rota', ic: 'route', tone: 'gold', t: 'Nova sugestão de rota', x: 'Antônio R. · Manhã · −1,1 km com Parque das Águas', cta: 'Ver rota', h: 'Ontem' },
  { k: 'pagamento', ic: 'wallet', tone: 'good', t: 'Pagamento a aprovar', x: '4 propostas da semana 29/09–05/10 · ≈ R$ 880,90', cta: 'Aprovar', h: 'Dom' },
];
function CANotifIcon({ ic, tone }) {
  const t = useT();
  const m = { danger: [t.dangerSoft, t.danger], gold: [t.goldSoft, t.accent], good: [t.goodSoft, t.good], neutral: [t.surface2, t.textSec] }[tone];
  return <div style={{ width: 40, height: 40, borderRadius: 12, background: m[0], color: m[1], display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={ic} size={19} /></div>;
}
function CAAdminNotifs({ st = 'list' }) {
  const t = useT();
  return (
    <CAScreen head={<CAHead back titulo={st === 'prefs' ? 'Preferências de aviso' : 'Notificações'} />}>
      {st === 'prefs' ? (
        <Card pad={0}>
          {CA_NOTIF_TYPES.map((n, i) => <div key={n.k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: i ? `1px solid ${t.border2}` : 'none' }}><CANotifIcon ic={n.ic} tone={n.tone} /><span style={{ flex: 1, fontWeight: 700, fontSize: 14.5, color: t.text }}>{n.t}</span><Switch on={n.k !== 'acesso'} onChange={() => {}} /></div>)}
        </Card>
      ) : (
        <Card pad={0}>
          {CA_NOTIF_TYPES.map((n, i) => (
            <div key={n.k} style={{ display: 'flex', gap: 12, padding: '14px 16px', borderTop: i ? `1px solid ${t.border2}` : 'none', background: i < 2 ? t.surfaceAlt : 'transparent' }}>
              <CANotifIcon ic={n.ic} tone={n.tone} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8 }}><span style={{ flex: 1, fontWeight: 800, fontSize: 14.5, color: t.text }}>{n.t}</span><span style={{ fontSize: 12, color: t.textTer, fontWeight: 600 }}>{n.h}</span></div>
                <div style={{ fontSize: 13, color: t.textSec, marginTop: 2, lineHeight: 1.4 }}>{n.x}</div>
                <button style={{ marginTop: 8, height: 32, padding: '0 12px', borderRadius: 10, border: 'none', background: t.surface2, color: t.text, fontWeight: 800, fontSize: 12.5, fontFamily: 'inherit' }}>{n.cta}</button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </CAScreen>
  );
}

/* ===== A10 — Relatório "Entregas & falhas" com motivos padronizados */
function CAFailReport() {
  const t = useT();
  const M = [['Cliente ausente', 14], ['Portaria não liberou', 9], ['Endereço/apto não encontrado', 4], ['Sem lugar para deixar', 3], ['Pedido danificado', 1], ['Outro', 2]];
  const max = 14, tot = M.reduce((a, m) => a + m[1], 0);
  return (
    <CAScreen head={<CAHead back titulo="Entregas & falhas" sub="Relatórios · Operação & financeiro" />}>
      <CASeg value="30" items={[['7', '7 dias'], ['30', '30 dias'], ['m', 'Mês']]} small />
      <div style={{ display: 'flex', gap: 8 }}>
        {[['1.024', 'entregues', t.good], [tot, 'não entregues', t.danger], ['96,9%', 'sucesso', t.text]].map(([v, l, c]) => <div key={l} style={{ flex: 1, background: t.surface, borderRadius: 16, padding: 12, border: `1px solid ${t.border2}` }}><div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 21, color: c }}>{v}</div><div style={{ fontSize: 12, fontWeight: 700, color: t.textSec }}>{l}</div></div>)}
      </div>
      <Card pad={16}>
        <CRLabel>Motivos de não entrega</CRLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {M.map(([l, n]) => (
            <div key={l}>
              <div style={{ display: 'flex', fontSize: 13.5, marginBottom: 4 }}><span style={{ flex: 1, fontWeight: 700, color: t.text }}>{l}</span><b style={{ color: t.text }}>{n}</b><span style={{ width: 44, textAlign: 'right', color: t.textSec, fontWeight: 600 }}>{Math.round(n / tot * 100)}%</span></div>
              <div style={{ height: 8, borderRadius: 99, background: t.surface2 }}><div style={{ height: '100%', width: `${n / max * 100}%`, borderRadius: 99, background: l === 'Cliente ausente' ? t.danger : t.accent }} /></div>
            </div>
          ))}
        </div>
      </Card>
      <Card pad={14} style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Icon name="ban" size={19} color={t.danger} /><div style={{ flex: 1, fontSize: 13.5, color: t.text }}><b>6 entregas sem foto</b> no período · 4 “local sem luz”</div><Icon name="chevR" size={16} color={t.textTer} /></Card>
    </CAScreen>
  );
}

Object.assign(window, { CAGestaoHub, CACondoAccess, CAHooks, CAPayCard, CAPayouts, CAFuelReport, CA_NOTIF_TYPES, CANotifIcon, CAAdminNotifs, CAFailReport });
