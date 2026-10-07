/* ============================================================
   App do Entregador — ADMIN (1/2)
   A1 Comprovante no detalhe do pedido · A2 Entregas (rotas + mapa ao vivo) ·
   A3 Cadastro do entregador · A4 Rota do entregador · A5 Rotas e comprovante
   ============================================================ */
const CA_TABS = [['painel', 'trend', 'Painel'], ['pedidos', 'bag', 'Pedidos'], ['separacao', 'box', 'Separação'], ['entregas', 'truck', 'Entregas'], ['clientes', 'users', 'Clientes'], ['gestao', 'settings', 'Gestão']];
function CATabs({ active = 'entregas' }) {
  const t = useT();
  return <div style={{ flexShrink: 0, display: 'flex', borderTop: `1px solid ${t.border2}`, background: t.surface, padding: '8px 2px 14px' }}>{CA_TABS.map(([k, ic, l]) => <div key={k} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '5px 0', color: active === k ? t.accent : t.textTer }}><Icon name={ic} size={21} stroke={active === k ? 2.3 : 2} /><span style={{ fontSize: 9.5, fontWeight: active === k ? 800 : 600 }}>{l}</span></div>)}</div>;
}
function CAHead({ titulo, sub, back, right }) {
  const t = useT();
  return (
    <div style={{ padding: '4px 20px 14px', display: 'flex', alignItems: 'center', gap: 11 }}>
      {back ? <button style={{ background: t.surface2, border: 'none', width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', color: t.text, flexShrink: 0 }}><Icon name="arrowL" size={20} /></button>
        : <div style={{ width: 42, height: 42, borderRadius: 13, background: t.espresso, display: 'grid', placeItems: 'center', flexShrink: 0 }}><BreadMark size={27} color="#E3AC3F" /></div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        {sub && <div style={{ fontSize: 12.5, color: t.textTer, fontWeight: 600 }}>{sub}</div>}
        <div style={{ fontFamily: CR_H, fontWeight: 700, fontSize: 20, color: t.text, letterSpacing: '-0.02em' }}>{titulo}</div>
      </div>
      {right}
    </div>
  );
}
function CAScreen({ tab, children, head, pad = '0 16px 24px', overlay }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
      {head}
      <div className="cr-col" style={{ flex: 1, overflowY: 'auto', padding: pad, display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
      {tab && <CATabs active={tab} />}
      {overlay}
    </div>
  );
}
function CASwitchRow({ title, desc, on = true, last }) {
  const t = useT();
  return <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: last ? 'none' : `1px solid ${t.border2}` }}><div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14.5, color: t.text }}>{title}</div>{desc && <div style={{ fontSize: 12.5, color: t.textSec, marginTop: 2, lineHeight: 1.4 }}>{desc}</div>}</div><Switch on={on} onChange={() => {}} /></div>;
}
function CASeg({ items, value, small }) {
  const t = useT();
  return <div style={{ display: 'flex', gap: 4, background: t.surface2, borderRadius: 13, padding: 4 }}>{items.map(([k, l, ic]) => <div key={k} style={{ flex: 1, height: small ? 34 : 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, fontWeight: 800, fontSize: 13, background: value === k ? t.surface : 'transparent', color: value === k ? t.text : t.textSec, boxShadow: value === k ? t.shadowSoft : 'none' }}>{ic && <Icon name={ic} size={16} stroke={2.2} />}{l}</div>)}</div>;
}
const CAOnlyCtx = React.createContext(null);
function CASec({ n, title, children, right }) {
  const t = useT();
  const only = React.useContext(CAOnlyCtx);
  if (only && n && !only.includes(n)) return null;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 4px 8px' }}>
        {n && <span style={{ width: 22, height: 22, borderRadius: 7, background: t.espresso, color: t.gold, fontFamily: CR_H, fontWeight: 800, fontSize: 12, display: 'grid', placeItems: 'center' }}>{n}</span>}
        <span style={{ flex: 1, fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: t.textTer, textTransform: 'uppercase' }}>{title}</span>{right}
      </div>
      {children}
    </div>
  );
}

/* ---------- Visualizador de foto (A1 · C2) ---------- */
function CRPhotoViewer({ meta = 'Entregue às 05:31 · Antônio R.', title = 'Apto 101 · Bloco 1', footer }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#070402', color: '#fff', display: 'flex', flexDirection: 'column', zIndex: 50 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '52px 16px 12px' }}>
        <CRIconBtn icon="x" tone="dark" label="Fechar" />
        <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div><div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{meta}</div></div>
        <CRIconBtn icon="download" tone="dark" label="Baixar" />
      </div>
      <div style={{ flex: 1, padding: '10px 0' }}><CRPhotoPh w="100%" h="100%" r={0} dark label="foto da entrega" /></div>
      <div style={{ padding: '14px 20px 30px' }}>{footer}</div>
    </div>
  );
}

/* ===== A1 — Detalhe do pedido · seção "Comprovante"
   st: foto · sem · pulada · subindo · naoFoto · reportado · viewer */
function CAOrderProof({ st = 'foto', part }) {
  const t = useT();
  if (st === 'viewer') return <CRPhotoViewer footer={<div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>Guardada por 90 dias · até 29/12</div>} />;
  const nao = st === 'naoFoto';
  const body = {
    foto: <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><CRPhotoPh w={96} h={96} r={14} /><div style={{ flex: 1 }}><CRTag ic="check" tone="good">Entregue 05:31</CRTag><div style={{ fontSize: 13.5, color: t.textSec, fontWeight: 600, marginTop: 6 }}>por Antônio R. · pelo scan</div><button style={{ marginTop: 8, height: 36, padding: '0 12px', borderRadius: 11, border: `1.5px solid ${t.border}`, background: t.surface, fontWeight: 800, fontSize: 13, fontFamily: 'inherit', color: t.text, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="search" size={14} />Ver em tela cheia</button></div></div>,
    sem: <div><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><CRTag ic="check" tone="good">Entregue 05:50</CRTag><CRTag ic="ban" tone="danger">sem foto</CRTag></div><div style={{ fontSize: 13.5, color: t.text, marginTop: 8 }}><span style={{ color: t.textSec }}>Motivo da exceção:</span> <b>Local sem luz</b></div><div style={{ fontSize: 12.5, color: t.textTer, marginTop: 2 }}>Antônio R. tem foto obrigatória na entrega.</div></div>,
    pulada: <div><div style={{ display: 'flex', gap: 6 }}><CRTag ic="check" tone="good">Entregue 05:50</CRTag><CRTag ic="ban">foto pulada</CRTag></div><div style={{ fontSize: 13, color: t.textSec, marginTop: 8 }}>Joana P. não tem foto obrigatória. Ela escolheu pular.</div></div>,
    subindo: <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><div style={{ width: 96, height: 96, borderRadius: 14, background: t.surface2, display: 'grid', placeItems: 'center', color: t.accent }}><Icon name="cloudUp" size={30} /></div><div style={{ flex: 1 }}><CRTag ic="check" tone="good">Entregue 05:33</CRTag><div style={{ fontSize: 13.5, color: t.textSec, marginTop: 8, lineHeight: 1.4 }}>A foto ainda está subindo do celular do entregador. Aparece aqui sozinha.</div></div></div>,
    naoFoto: <div style={{ display: 'flex', gap: 12 }}><CRPhotoPh w={96} h={96} r={14} /><div style={{ flex: 1 }}><CRTag ic="x" tone="danger">Não entregue 05:47</CRTag><div style={{ fontSize: 14, fontWeight: 800, color: t.text, marginTop: 8 }}>Portaria não liberou</div><div style={{ fontSize: 13, color: t.textSec, marginTop: 2, lineHeight: 1.4 }}>“Porteiro não atendeu o interfone.”</div></div></div>,
    reportado: <div><div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><CRPhotoPh w={72} h={72} r={12} /><div style={{ flex: 1 }}><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><CRTag ic="check" tone="good">Entregue 05:33</CRTag><CRTag ic="alert" tone="gold">problema reportado</CRTag></div></div></div><div style={{ marginTop: 10, background: '#FBEFD3', borderRadius: 14, padding: '10px 12px' }}><div style={{ fontSize: 13.5, fontWeight: 800, color: '#6E4712' }}>Confirmei por engano · 05:40</div><div style={{ fontSize: 13, color: '#6E4712', marginTop: 2 }}>“Escaneei o cupom do 204 mas o saquinho ainda está comigo.” — Antônio R.</div></div><div style={{ display: 'flex', gap: 8, marginTop: 10 }}><Btn size="sm" variant="primary" style={{ flex: 1 }}>Marcar não entregue</Btn><Btn size="sm" variant="ghost" style={{ flex: 1 }}>Manter entregue</Btn></div></div>,
  }[st];
  if (part === 'card') return <Card pad={14}>{body}</Card>;
  return (
    <CAScreen tab="pedidos" head={<CAHead titulo="Pedidos" sub="Hoje · 30/09" />} overlay={
      <CRSheet title="Pedido #4821" sub={`${nao ? 'Rafael Dias · Condomínio Bela Vista · Apto 51' : st === 'reportado' || st === 'subindo' ? 'Pedro Alves · Residencial Jardins · Bloco 1 · Apto 204' : 'Maria Souza · Residencial Jardins · Bloco 1 · Apto 101'}`} onClose={() => {}}>
        <Card pad={0} style={{ boxShadow: 'none', background: t.surfaceAlt }}>
          <div style={{ padding: '0 16px' }}>
            <Row label="Pães" value={nao ? '4 🥖' : '4 🥖'} icon="bag" />
            <Row label="Cestinha" value="1× Café 250 g" icon="basket" />
            <Row label="Turno" value="☀️ Manhã · 06:30" icon="clock" />
            <Row label="Entregador" value="Antônio R." icon="truck" />
          </div>
        </Card>
        <div style={{ marginTop: 16 }}>
          <CRLabel right={<span style={{ fontSize: 12, color: t.textTer, fontWeight: 600 }}>{ROUTE_CFG.clienteVeFoto ? 'cliente vê' : 'só admin'}</span>}>Comprovante</CRLabel>
          <Card pad={14}>{body}</Card>
        </div>
      </CRSheet>
    }>
      {[1, 2, 3].map(i => <CRSkel key={i} h={70} r={18} />)}
    </CAScreen>
  );
}

/* ===== A2 — Entregas: rotas, mapa ao vivo, sem foto
   st: live · none · stale · done · filter */
function CAEntregas({ st = 'live' }) {
  const t = useT();
  const couriers = st === 'none' || st === 'done' ? [] : [{ ll: CR_ME, ini: 'AR' }, { ll: [-23.5520, -46.6395], ini: 'JP', stale: st === 'stale' }];
  const rows = [
    { nome: 'Antônio R.', turno: ROTAS_HOJE[0], estado: st === 'none' ? 'pronta' : st === 'done' ? 'encerrada' : 'em_rota', feitas: st === 'done' ? 12 : 7, total: 12, semFoto: 1, alterada: true, fim: '06:38' },
    { nome: 'Joana P.', turno: ROTAS_HOJE[0], estado: st === 'none' ? 'pronta' : st === 'done' ? 'encerrada' : 'em_rota', feitas: st === 'done' ? 9 : 4, total: 9, semFoto: 0, stale: st === 'stale', fim: '06:50' },
  ];
  const filt = st === 'filter';
  return (
    <CAScreen tab="entregas" head={<CAHead titulo="Entregas" sub="Terça · 30/09" />}>
      {!filt && (
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px' }}>
            <span style={{ width: 9, height: 9, borderRadius: 99, background: st === 'none' || st === 'done' ? t.textTer : t.good }} />
            <span style={{ flex: 1, fontWeight: 800, fontSize: 15, color: t.text }}>Mapa ao vivo</span>
            <span style={{ fontSize: 12.5, color: t.textSec, fontWeight: 700 }}>{st === 'none' ? 'nenhuma rota iniciada' : st === 'done' ? 'todas encerradas' : '2 em rota'}</span>
          </div>
          <CRMap h={230} radius={0} stops={crStopsFrom(CR_ENTREGAS, 0)} couriers={couriers} path="none" />
          {st === 'stale' && <CRNote ic="cloudOff" tone="gold" style={{ margin: 12 }}><b>Joana P. sem posição há 14 min.</b> App fechado ou sem sinal. A última posição aparece esmaecida.</CRNote>}
          {st === 'none' && <div style={{ padding: 14, fontSize: 13.5, color: t.textSec }}>As posições aparecem quando o entregador toca em <b>Iniciar rota</b>.</div>}
        </Card>
      )}
      {!filt && <CRLabel style={{ marginTop: 4 }}>Rotas de hoje</CRLabel>}
      {!filt && rows.map(r => (
        <Card key={r.nome} pad={14}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <CRAvatar nome={r.nome} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: t.text }}>{r.nome} <span style={{ fontWeight: 600, color: t.textSec, fontSize: 13 }}>· {r.turno.emoji} {r.turno.nome}</span></div>
              <div style={{ fontSize: 13, fontWeight: 700, color: r.estado === 'em_rota' ? t.good : t.textSec, marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                {r.estado === 'pronta' && <><Icon name="clock" size={13} />Não iniciada</>}
                {r.estado === 'em_rota' && <><span style={{ width: 7, height: 7, borderRadius: 99, background: t.good }} />Em rota desde 05:12 · término ~{r.fim}</>}
                {r.estado === 'encerrada' && <><Icon name="check" size={13} stroke={2.8} />Encerrada 06:40</>}
              </div>
            </div>
            <CRTag tone={r.feitas === r.total ? 'good' : 'gold'}>{r.feitas}/{r.total}</CRTag>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: t.surface2, marginTop: 10, overflow: 'hidden' }}><div style={{ height: '100%', width: `${r.feitas / r.total * 100}%`, background: r.feitas === r.total ? t.good : t.gold }} /></div>
          {(r.alterada || r.semFoto > 0 || r.stale) && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {r.alterada && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><CRTag ic="repeat">ordem alterada hoje</CRTag><b style={{ fontSize: 12.5, color: t.accent }}>ver</b></span>}
              {r.semFoto > 0 && <CRTag ic="ban" tone="danger">{r.semFoto} sem foto</CRTag>}
              {r.stale && <CRTag ic="cloudOff" tone="warn">última posição há 14 min</CRTag>}
              {!r.stale && r.estado === 'em_rota' && <CRTag ic="pin" tone="neutral">posição há 2 min</CRTag>}
            </div>
          )}
        </Card>
      ))}
      {!filt && <Card pad={14}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}><Icon name="spark" size={19} color={t.accent} /><span style={{ flex: 1, fontWeight: 800, fontSize: 14.5, color: t.text }}>Divisão de amanhã</span><Pill tone="gold">sugestão</Pill></div>
        {[['Antônio R.', 'Jardins · Aurora · Bela Vista · Vila Verde', '64 🥖'], ['Joana P.', 'Parque das Águas · Ipê Amarelo', '41 🥖']].map(([n, c, p]) => <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: `1px solid ${t.border2}` }}><CRAvatar nome={n} size={32} /><div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>{n}</div><div style={{ fontSize: 12, color: t.textTer }}>{c}</div></div><b style={{ fontFamily: CR_H, fontSize: 15, color: t.text }}>{p}</b></div>)}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: `1px solid ${t.border2}`, opacity: 0.7 }}><CRAvatar nome="Rui M." size={32} /><div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>Rui M.</div><div style={{ fontSize: 12, color: t.textTer }}>fora da sugestão</div></div><CRTag ic="dayoff" tone="good" size="sm">de folga amanhã</CRTag></div>
        <Btn variant="gold" full size="sm" icon="check" style={{ marginTop: 8 }}>Aprovar divisão</Btn>
      </Card>}
      <CRLabel style={{ marginTop: 4 }}>Paradas</CRLabel>
      <div style={{ display: 'flex', gap: 6 }}>{[['Todas', 12], ['Pendentes', 5], ['Sem foto', 1]].map(([l, n]) => { const on = filt ? l === 'Sem foto' : l === 'Todas'; return <span key={l} style={{ height: 36, padding: '0 12px', borderRadius: 99, display: 'inline-flex', alignItems: 'center', gap: 6, background: on ? t.text : t.surface, color: on ? t.appBg : t.text, border: `1.5px solid ${on ? t.text : t.border}`, fontSize: 13, fontWeight: 800 }}>{l === 'Sem foto' && <Icon name="ban" size={13} stroke={2.4} />}{l} <span style={{ opacity: 0.6 }}>{n}</span></span>; })}</div>
      <Card pad={0}>
        {(filt ? [CR_ENTREGAS[1].paradas[2]] : [CR_ENTREGAS[0].paradas[0], CR_ENTREGAS[1].paradas[1], CR_ENTREGAS[1].paradas[2], CR_ENTREGAS[2].paradas[2]]).map((p, i) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: i ? `1px solid ${t.border2}` : 'none' }}>
            <CRCheck status={p.status} />
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>{p.cliente} · Apto {p.ap}</div><div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>{p.status === 'nao_entregue' && <CRTag ic="x" tone="danger" size="sm">{p.motivo}</CRTag>}{p.status !== 'pendente' && <CRProof s={p.foto} />}{p.semFotoMotivo && <span style={{ fontSize: 12, color: t.textSec }}>{p.semFotoMotivo}</span>}</div></div>
            <span style={{ fontSize: 13, color: t.textSec, fontWeight: 700 }}>{p.hora || '—'}</span>
          </div>
        ))}
      </Card>
    </CAScreen>
  );
}

/* ===== A3 — Gestão › Entregadores (lista) */
function CACourierList() {
  const t = useT();
  const L = [['Antônio Ribeiro', 'Moto · por entrega', true, null, true], ['Joana Pires', 'Moto · semanal fixo', true, null, false], ['Rui Martins', 'Bicicleta · sem modalidade', true, 'folga', false], ['Dona Tereza', 'Carro · por rota', false, null, false]];
  return (
    <CAScreen tab="gestao" head={<CAHead back titulo="Entregadores" right={<Btn size="sm" icon="plus">Novo</Btn>} />}>
      <div style={{ display: 'flex', gap: 8 }}><Card pad={12} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}><Icon name="wallet" size={19} color={t.accent} /><div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 14, color: t.text }}>Pagamentos</div><div style={{ fontSize: 12, color: t.textSec }}>3 propostas a aprovar</div></div><Icon name="chevR" size={16} color={t.textTer} /></Card></div>
      <Card pad={0}>
        {L.map(([n, d, a, f, sug], i) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: i ? `1px solid ${t.border2}` : 'none', opacity: a ? 1 : 0.55 }}>
            <CRAvatar nome={n} size={42} foto={i === 0} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: t.text }}>{n}</div>
              <div style={{ fontSize: 12.5, color: t.textSec }}>{a ? d : 'Desativado'}</div>
              {(f || sug) && <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>{f && <CRTag ic="dayoff" tone="good" size="sm">de folga hoje</CRTag>}{sug && <CRTag ic="route" tone="gold" size="sm">sugestão de rota nova</CRTag>}</div>}
            </div>
            <Switch on={a} onChange={() => {}} />
          </div>
        ))}
      </Card>
    </CAScreen>
  );
}

/* ===== A3 — Cadastro do entregador (ampliado)
   st: edit · new · noveh · nomod · overlap · bike */
function CACourierForm({ st = 'edit', only }) {
  const t = useT();
  const isNew = st === 'new';
  const veh = st === 'bike' ? 'bike' : st === 'noveh' || isNew ? null : 'moto';
  const mod = st === 'nomod' || isNew ? null : 'por_entrega';
  const v = (x) => isNew ? '' : x;
  return (
    <CAOnlyCtx.Provider value={only || null}>
    <CAScreen head={only ? null : <CAHead back titulo={isNew ? 'Novo entregador' : 'Antônio Ribeiro'} sub={isNew ? null : 'Entregador desde mar/2026'} />} pad={only ? '14px 16px 16px' : '0 16px 110px'} overlay={only ? null :
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 16px 20px', background: t.surface, borderTop: `1px solid ${t.border2}` }}><Btn full size="lg" icon="check">{isNew ? 'Cadastrar entregador' : 'Salvar alterações'}</Btn></div>
    }>
      <CASec n="1" title="Dados">
        <Card pad={16} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {isNew ? <div style={{ width: 72, height: 72, borderRadius: 99, border: `2px dashed ${t.border}`, display: 'grid', placeItems: 'center', color: t.accent }}><Icon name="camera" size={24} /></div> : <CRAvatar size={72} foto />}
            <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 14.5, color: t.text }}>Foto do crachá</div><div style={{ fontSize: 12.5, color: t.textSec, marginTop: 2 }}>Aparece para o cliente e no crachá. Recorte redondo.</div><div style={{ display: 'flex', gap: 6, marginTop: 8 }}><Btn size="sm" variant="soft" icon="camera">Câmera</Btn><Btn size="sm" variant="soft" icon="image">Galeria</Btn></div></div>
          </div>
          <Field label="Nome completo" value={v('Antônio Ribeiro')} placeholder="Nome e sobrenome" />
          <div style={{ display: 'flex', gap: 10 }}><div style={{ flex: 1, minWidth: 0 }}><Field label="CPF" value={v('123.456.789-00')} placeholder="000.000.000-00" /></div><div style={{ flex: 1, minWidth: 0 }}><Field label="Telefone" value={v('(11) 99888-7766')} placeholder="(00) 00000-0000" /></div></div>
          <Field label="E-mail" value={v('antonio@cheirin.com')} placeholder="email@exemplo.com" />
        </Card>
      </CASec>
      <CASec n="2" title="Veículo" right={<span style={{ fontSize: 12, color: t.textTer, fontWeight: 600 }}>opcional</span>}>
        <Card pad={16} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CASeg value={veh} items={[['moto', 'Moto', 'moto'], ['car', 'Carro', 'car'], ['bike', 'Bike', 'bike'], ['walk', 'A pé', 'walk']]} />
          {!veh && <div style={{ fontSize: 13, color: t.textSec }}>Sem veículo cadastrado: a rota não calcula combustível.</div>}
          {veh === 'moto' && <>
            <div style={{ display: 'flex', gap: 10 }}><div style={{ flex: 1.4, minWidth: 0 }}><Field label="Modelo" value="Honda CG 160" /></div><div style={{ flex: 1, minWidth: 0 }}><Field label="Placa" value="ABC1D23" /></div></div>
            <div><div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec, marginBottom: 7 }}>Combustível</div><CASeg small value="gas" items={[['gas', 'Gasolina'], ['eta', 'Etanol'], ['flex', 'Flex']]} /></div>
            <Field label="Consumo" value="38" suffix="km/l" hint="Usado para estimar o combustível da rota. Sem consumo, não há cálculo." />
          </>}
          {veh === 'bike' && <div style={{ fontSize: 13, color: t.textSec }}>Bicicleta não usa combustível — consumo e combustível ficam escondidos.</div>}
        </Card>
      </CASec>
      <CASec n="3" title="Permissões e regras">
        <Card pad={0}>
          <CASwitchRow title="Exigir foto na entrega" desc="Sem “Pular”. Exceção vira “sem foto”." on={!isNew} />
          <CASwitchRow title="Exigir foto na não entrega" on={!isNew} />
          <CASwitchRow title="Pode reordenar a rota" desc="Vale só no dia. Você vê a mudança." on={!isNew} />
          <CASwitchRow title="Pode enviar recados ao cliente" desc="Modelos prontos, por notificação." on={!isNew} last />
        </Card>
      </CASec>
      <CASec n="4" title="Pagamento">
        <Card pad={16} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!mod && <CRNote ic="alert" tone="gold">Modalidade não definida. A proposta semanal sai só com o combustível.</CRNote>}
          <CASeg value={mod} items={[['por_entrega', 'Por entrega'], ['por_rota', 'Por rota'], ['semanal_fixo', 'Semanal fixo']]} />
          <Field label={mod ? 'Valor por entrega' : 'Valor'} value={mod ? '1,50' : ''} placeholder="0,00" icon="coin" suffix={mod ? 'por entrega' : ''} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14.5, color: t.text }}>Pagar combustível estimado</div><div style={{ fontSize: 12.5, color: t.textSec }}>Entra na proposta; você define o valor final.</div></div><Switch on onChange={() => {}} /></div>
        </Card>
      </CASec>
      <CASec n="5" title="Disponibilidade">
        <Card pad={16} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 5 }}>{['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => <span key={i} style={{ flex: 1, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14, background: i < 6 && !isNew ? t.text : t.surface2, color: i < 6 && !isNew ? t.appBg : t.textSec }}>{d}</span>)}</div>
          <div style={{ display: 'flex', gap: 6 }}>{['☀️ Manhã', '🌇 Tarde'].map((l, i) => <span key={l} style={{ height: 36, padding: '0 12px', borderRadius: 99, display: 'inline-flex', alignItems: 'center', gap: 6, background: !isNew ? t.goldSoft : t.surface2, color: '#8A5616', fontSize: 13, fontWeight: 800 }}>{!isNew && <Icon name="check" size={13} stroke={2.8} />}{l}</span>)}</div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec }}>Folgas</div>
          {st === 'overlap' && <CRNote ic="alert" tone="danger">A folga de 01/10 cai numa rota já aprovada (☀️ Manhã · 12 paradas). Refaça a divisão de entregas desse dia.</CRNote>}
          {!isNew && [...(st === 'overlap' ? [{ de: '01/10', ate: '01/10', motivo: 'Consulta médica' }] : []), ...COURIER.escala.folgas].map(f => <div key={f.de} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 12, background: t.surfaceAlt, border: `1px solid ${t.border2}` }}><Icon name="dayoff" size={17} color={t.good} /><span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: t.text }}>{f.de === f.ate ? f.de : `${f.de} a ${f.ate}`} <span style={{ color: t.textSec, fontWeight: 600 }}>· {f.motivo}</span></span><Icon name="trash" size={16} color={t.textTer} /></div>)}
          <Btn variant="ghost" size="sm" icon="plus">Adicionar folga</Btn>
        </Card>
      </CASec>
      {!isNew && <CASec n="6" title="Rota">
        <Card pad={0}>
          <CRRow ic="route" title="☀️ Manhã · rota salva" desc="4 prédios · ~9,2 km · ~1h10" right={<CRTag ic="spark" tone="gold" size="sm">sugestão nova</CRTag>} />
          <CRRow ic="route" title="🌇 Tarde · rota salva" desc="2 prédios · ~6,1 km" last />
        </Card>
      </CASec>}
    </CAScreen>
    </CAOnlyCtx.Provider>
  );
}

/* ===== A4 — Rota do entregador
   st: first · saved · pending · adjust · savedOk · changes */
function CARoute({ st = 'pending' }) {
  const t = useT();
  const s = ADMIN_ROUTE_SUGGESTION;
  const sug = st === 'pending' || st === 'first';
  const ordem = st === 'adjust' ? s.sugestao.ordem : sug ? s.sugestao.ordem : s.atual.ordem;
  const byName = n => CR_ENTREGAS.find(c => c.condo === n) || CR_TARDE[0];
  const moved = ['Edifício Aurora', 'Condomínio Bela Vista'];
  return (
    <CAScreen head={<CAHead back titulo="Rota · ☀️ Manhã" sub="Antônio R." />}>
      {st === 'savedOk' && <CRNote ic="check" tone="good">Rota salva. Vale a partir de amanhã para Antônio · Manhã.</CRNote>}
      {st !== 'first' && (
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <CRMap h={170} radius={0} stops={(st === 'savedOk' ? s.sugestao.ordem : s.atual.ordem).map((n, i) => ({ ll: byName(n).ll, n: i + 1 }))} />
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.1em', color: t.textTer }}>ROTA SALVA</div><div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 18, color: t.text }}>~{crN(st === 'savedOk' ? s.sugestao.km : s.atual.km)} km · ~{st === 'savedOk' ? s.sugestao.tempo : s.atual.tempo}</div></div>
            <span style={{ fontSize: 12.5, color: t.textSec, fontWeight: 700 }}>desde 15/09</span>
          </div>
        </Card>
      )}
      {sug && (
        <Card pad={16} style={{ border: `2px solid ${t.gold}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="spark" size={19} color={t.accent} /><span style={{ flex: 1, fontWeight: 800, fontSize: 15.5, color: t.text }}>{st === 'first' ? 'Primeira sugestão' : 'Sugestão nova'}</span>{st === 'pending' && <CRTag tone="good" size="sm">−1,1 km</CRTag>}</div>
          <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 22, color: t.text, marginTop: 6 }}>~8,1 km · ~1h04</div>
          {st === 'pending' && <div style={{ fontSize: 13, color: t.textSec, marginTop: 2 }}>Motivo: <b>Parque das Águas</b> entrou na rota em 28/09.</div>}
          {st === 'pending' && <CRNote ic="alert" style={{ marginTop: 10 }}>Até você decidir, o dia usa a rota salva com o prédio novo na posição sugerida.</CRNote>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
            {s.sugestao.ordem.map((n, i) => {
              const isNew = s.sugestao.novo.includes(n), mv = st === 'pending' && moved.includes(n);
              return <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, background: isNew ? t.goldSoft : mv ? t.surface2 : 'transparent' }}><span style={{ width: 26, height: 26, borderRadius: 8, background: t.espresso, color: t.gold, display: 'grid', placeItems: 'center', fontFamily: CR_H, fontWeight: 800, fontSize: 13 }}>{i + 1}</span><span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: t.text }}>{n}</span>{isNew && <CRTag ic="plus" tone="dark" size="sm">novo</CRTag>}{mv && <CRTag ic="repeat" size="sm">{i === 1 ? 'subiu 1' : 'desceu 1'}</CRTag>}</div>;
            })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            <Btn full variant="gold" icon="check">Usar sugestão</Btn>
            <div style={{ display: 'flex', gap: 8 }}>{st !== 'first' && <Btn variant="ghost" style={{ flex: 1 }}>Manter a atual</Btn>}<Btn variant="ghost" icon="grip" style={{ flex: 1 }}>Ajustar</Btn></div>
          </div>
        </Card>
      )}
      {(st === 'saved' || st === 'savedOk' || st === 'changes') && (
        <>
          <CRLabel right={<Btn size="sm" variant="ghost" icon="grip">Ajustar</Btn>}>Ordem salva</CRLabel>
          <CRStopOrder list={(st === 'savedOk' ? s.sugestao.ordem : s.atual.ordem).map(byName).map(c => ({ ...c, paradas: c.paradas.map(p => ({ ...p, status: 'pendente' })) }))} />
          {st === 'saved' && <div style={{ fontSize: 13, color: t.textSec, textAlign: 'center' }}>Nenhuma sugestão nova. A rota está em dia.</div>}
        </>
      )}
      {st === 'adjust' && (
        <>
          <CRNote ic="grip" tone="gold">Arraste para mudar a ordem. O km e a hora prevista recalculam na hora.</CRNote>
          <CRStopOrder reorder list={ordem.map(byName).map(c => ({ ...c, paradas: c.paradas.map(p => ({ ...p, status: 'pendente' })) }))} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, background: t.surface2 }}><Icon name="route" size={18} color={t.accent} /><span style={{ flex: 1, fontWeight: 800, fontSize: 14.5 }}>~8,6 km · ~1h07</span><span style={{ fontSize: 12.5, color: t.textSec, fontWeight: 700 }}>+0,5 km vs sugestão</span></div>
          <Btn full size="lg" icon="check">Salvar rota</Btn>
        </>
      )}
      {(st === 'changes' || st === 'pending') && (
        <>
          <CRLabel style={{ marginTop: 4 }}>Alterações do entregador</CRLabel>
          <Card pad={0}>
            {[['Hoje · 30/09', 'Trocou Bela Vista ↔ Aurora', '~9,8 km'], ['Sex · 26/09', 'Mesma troca', '~9,8 km']].map(([d, x, k], i) => (
              <div key={d} style={{ padding: '12px 16px', borderTop: i ? `1px solid ${t.border2}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="repeat" size={16} color={t.accent} /><span style={{ flex: 1, fontWeight: 800, fontSize: 14.5, color: t.text }}>{d}</span><span style={{ fontSize: 12.5, color: t.textSec, fontWeight: 700 }}>{k}</span></div>
                <div style={{ fontSize: 13, color: t.textSec, margin: '3px 0 8px 24px' }}>{x}</div>
                <div style={{ display: 'flex', gap: 8, marginLeft: 24 }}><Btn size="sm" variant="ghost">Ver ordem</Btn><Btn size="sm" variant="soft">Adotar como rota padrão</Btn></div>
              </div>
            ))}
          </Card>
        </>
      )}
    </CAScreen>
  );
}

/* ===== A5 — Gestão › Rotas e comprovante. st: ok · nobase · saved */
function CARouteCfg({ st = 'ok' }) {
  const t = useT();
  const nob = st === 'nobase';
  return (
    <CAScreen head={<CAHead back titulo="Rotas e comprovante" />} pad="0 16px 110px" overlay={
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 16px 20px', background: t.surface, borderTop: `1px solid ${t.border2}` }}>{st === 'saved' ? <Btn full size="lg" variant="soft" icon="check" style={{ color: t.good }}>Salvo às 14:02</Btn> : <Btn full size="lg" icon="check">Salvar</Btn>}</div>
    }>
      <CASec title="Base de saída">
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <div style={{ padding: 14 }}><Field value={nob ? '' : 'Rua das Flores, 120 · Centro'} placeholder="Buscar endereço da base" icon="search" /></div>
          {nob ? <div style={{ padding: '0 14px 14px' }}><CRNote ic="alert" tone="gold">Base não definida: a rota começa no primeiro prédio e não conta a ida.</CRNote></div> : <>
            <CRMap h={170} radius={0} stops={[]} path="none" pinBase />
            <div style={{ padding: '10px 14px', fontSize: 12.5, color: t.textSec, fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="pin" size={14} />Arraste o pino para ajustar a posição exata.</div>
          </>}
        </Card>
      </CASec>
      <CASec title="Cálculo da rota">
        <Card pad={0}>
          <CASwitchRow title="Contar a volta à base no km" desc="Entra no km e no combustível estimados." />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14.5, color: t.text }}>Tempo médio por porta</div><div style={{ fontSize: 12.5, color: t.textSec }}>Usado na hora prevista de cada prédio</div></div>
            <Stepper value={1} onChange={() => {}} min={0} /><span style={{ fontSize: 13, color: t.textSec, fontWeight: 700 }}>min</span>
          </div>
        </Card>
      </CASec>
      <CASec title="Preço do litro" right={<span style={{ fontSize: 12, color: t.textTer, fontWeight: 600 }}>atualizado em {ROUTE_CFG.precoAtualizado}</span>}>
        <Card pad={16} style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}><Field label="Gasolina" value="6,09" icon="fuel" suffix="R$/l" /></div>
          <div style={{ flex: 1, minWidth: 0 }}><Field label="Etanol" value="4,19" icon="fuel" suffix="R$/l" /></div>
        </Card>
      </CASec>
      <CASec title="Comprovante">
        <Card pad={0}>
          <CASwitchRow title="Cliente vê a foto da entrega" desc="Aparece no Acompanhamento e no Histórico por 90 dias. A obrigatoriedade é por entregador." last />
        </Card>
      </CASec>
    </CAScreen>
  );
}

Object.assign(window, { CAOnlyCtx, CA_TABS, CATabs, CAHead, CAScreen, CASwitchRow, CASeg, CASec, CRPhotoViewer, CAOrderProof, CAEntregas, CACourierList, CACourierForm, CARoute, CARouteCfg });
