/* ============================================================
   App do Entregador — CLIENTE (C1–C3) + CourierApp (protótipo navegável)
   ============================================================ */

/* ===== C1/C2 — Acompanhamento
   st: agendado · caminho · entregue · nao · nofoto · expired */
function CCTrack({ st = 'caminho', go = () => {} }) {
  const t = useT();
  const atual = { agendado: 0, caminho: 1, entregue: 2, nao: 2, nofoto: 2, expired: 2 }[st];
  const nao = st === 'nao';
  const steps = [
    { k: 'agendado', label: 'Agendado', desc: 'Pedido confirmado e créditos reservados', hora: 'Ontem, 20:14' },
    { k: 'saiu', label: 'Saiu para entrega', desc: atual >= 1 ? 'Antônio está a caminho do seu condomínio' : 'Acende quando o entregador sair com o seu pão', hora: atual >= 1 ? 'a caminho desde 05:40' : null },
    { k: 'entregue', label: nao ? 'Não entregue' : 'Entregue', desc: nao ? 'Tentamos entregar às 05:52 — não conseguimos acesso pela portaria.' : atual === 2 ? 'Seu pãozin chegou às 06:12 🥖 Bom dia!' : 'Pãezinhos na sua porta', hora: atual === 2 ? (nao ? 'Hoje, 05:52' : 'Hoje, 06:12') : null },
  ];
  const showFoto = ['entregue', 'nao'].includes(st);
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <AppBar title="Sua entrega" onBack={() => go('home')} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px' }}>
        <Card pad={0} style={{ overflow: 'hidden', marginBottom: 18 }}>
          <div style={{ background: t.espresso, padding: 20, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -36, right: -20, opacity: 0.13 }}><BreadMark size={150} color="#E3AC3F" /></div>
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 11.5, color: '#E3AC3F', fontWeight: 700, letterSpacing: '0.06em' }}>TERÇA · 30 SET · ☀️ MANHÃ</div>
              <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 30, color: '#FAF5EC', marginTop: 4, letterSpacing: '-0.02em' }}>4 pãezinhos</div>
              <div style={{ fontSize: 13, color: '#C7B595', marginTop: 4 }}>Residencial Jardins · Bloco 1 · Apto 101</div>
            </div>
          </div>
        </Card>
        <div style={{ paddingLeft: 6 }}>
          {steps.map((s, i) => {
            const done = i < atual || (i === 2 && atual === 2), cur = i === atual && atual < 2;
            const bad = nao && i === 2;
            const c = bad ? t.danger : done || cur ? t.accent : t.border;
            return (
              <div key={s.k} style={{ display: 'flex', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 99, background: done || cur ? c : t.surface, border: `2px solid ${c}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    {done ? <Icon name={bad ? 'x' : 'check'} size={18} color={bad ? '#fff' : t.onGold} stroke={2.6} /> : <div style={{ width: 11, height: 11, borderRadius: 99, background: cur ? t.onGold : 'transparent' }} />}
                  </div>
                  {i < 2 && <div style={{ width: 2.5, flex: 1, minHeight: 38, background: i < atual ? t.accent : t.border, margin: '2px 0' }} />}
                </div>
                <div style={{ paddingBottom: 24, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontFamily: CR_H, fontWeight: 700, fontSize: 16.5, color: bad ? t.danger : done || cur ? t.text : t.textTer }}>{s.label}</span>
                    {cur && <Pill tone="good"><span style={{ width: 6, height: 6, borderRadius: 99, background: t.good }} />agora</Pill>}
                  </div>
                  <div style={{ fontSize: 13, color: t.textSec, marginTop: 4, lineHeight: 1.45 }}>{s.desc}</div>
                  {s.hora && <div style={{ fontSize: 11.5, color: t.textTer, marginTop: 4, fontWeight: 600 }}>{s.hora}</div>}
                </div>
              </div>
            );
          })}
        </div>
        {showFoto && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: t.textTer, margin: '0 4px 8px' }}>COMPROVANTE</div>
            <Card pad={12} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ position: 'relative' }}><CRPhotoPh w={76} h={76} r={14} /><span style={{ position: 'absolute', right: 5, bottom: 5, width: 24, height: 24, borderRadius: 8, background: 'rgba(30,18,7,0.7)', display: 'grid', placeItems: 'center' }}><Icon name="search" size={13} color="#fff" stroke={2.4} /></span></div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 15, color: t.text }}>{nao ? 'Tentamos entregar às 05:52' : 'Entregue às 06:12'}</div><div style={{ fontSize: 12.5, color: t.textSec, marginTop: 2 }}>{nao ? 'Foto da portaria · toque para ver' : 'Foto da porta · toque para ver'}</div></div>
              <Icon name="chevR" size={17} color={t.textTer} />
            </Card>
          </div>
        )}
        {st === 'expired' && <div style={{ marginBottom: 14 }}><CRNote ic="camera">O comprovante fica disponível por 90 dias.</CRNote></div>}
        {atual >= 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: t.surface, borderRadius: 16, border: `1px solid ${t.border2}` }}>
            <CRAvatar nome="Antônio Ribeiro" size={48} foto />
            <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: t.textTer, fontWeight: 600 }}>Seu entregador</div><div style={{ fontWeight: 800, fontSize: 16, color: t.text }}>Antônio</div></div>
            {atual === 1 && <CRTag ic="truck" tone="good">a caminho</CRTag>}
          </div>
        )}
        {st === 'agendado' && <div style={{ fontSize: 13, color: t.textTer, textAlign: 'center', padding: '4px 20px', lineHeight: 1.45 }}>Quando o entregador sair com o seu pão, você vê aqui quem vai entregar.</div>}
      </div>
    </div>
  );
}

/* C2 — visualizador do cliente */
function CCPhotoViewer({ nao }) {
  const t = useT();
  return <CRPhotoViewer title={nao ? 'Tentamos entregar' : 'Seu pãozin chegou'} meta={nao ? 'Hoje, 05:52 · não conseguimos acesso pela portaria' : 'Hoje, 06:12 · Residencial Jardins · Apto 101'} footer={<div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Algo errado? <b style={{ color: '#E3AC3F', textDecoration: 'underline' }}>Fale com o suporte</b></div>} />;
}

/* C2 — Histórico com ícone de câmera */
function CCHistory() {
  const t = useT();
  const L = [['Hoje, 30 set', '4 pães · 1 Cestinha', 'entregue', '06:12', true], ['Seg, 29 set', '4 pães', 'entregue', '06:08', true], ['Sáb, 27 set', '6 pães', 'nao', '05:52', true], ['Sex, 26 set', '4 pães', 'entregue', '06:15', false], ['Qui, 25 set', '4 pães · 2 Cestinha', 'entregue', '06:10', true], ['Qui, 26 jun', '4 pães', 'entregue', '06:11', 'exp']];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <AppBar title="Histórico" onBack={() => {}} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px' }}>
        <div style={{ fontSize: 12.5, color: t.textSec, margin: '0 2px 10px', fontWeight: 600 }}>Pão + Cestinha · últimos 30 dias</div>
        <Card pad={0}>
          {L.map(([d, x, s, h, f], i) => (
            <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', minHeight: 64, borderTop: i ? `1px solid ${t.border2}` : 'none' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: s === 'nao' ? t.dangerSoft : t.goodSoft, color: s === 'nao' ? t.danger : t.good, display: 'grid', placeItems: 'center' }}><Icon name={s === 'nao' ? 'x' : 'check'} size={19} stroke={2.6} /></div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14.5, color: t.text }}>{d}</div><div style={{ fontSize: 12.5, color: t.textSec }}>{x} · {s === 'nao' ? 'não entregue' : 'entregue'} {h}</div></div>
              {f === 'exp' ? <CRTag ic="camera" size="sm">foto expirada</CRTag> : f && <button aria-label="Ver foto" style={{ width: 44, height: 44, borderRadius: 13, border: `1.5px solid ${t.border}`, background: t.surface, color: t.accent, display: 'grid', placeItems: 'center' }}><Icon name="camera" size={19} /></button>}
            </div>
          ))}
        </Card>
        <div style={{ marginTop: 12 }}><CRNote ic="camera">O comprovante fica disponível por 90 dias.</CRNote></div>
      </div>
    </div>
  );
}

/* ===== C3 — Notificações do cliente + Perfil › Notificações */
function CCNotifs() {
  const t = useT();
  const N = [
    { ic: 'chat', tone: 'gold', t: 'Antônio: Estou na portaria 🥖', x: 'Recado do seu entregador', h: '05:58', novo: true },
    { ic: 'check', tone: 'good', t: 'Seu pãozin chegou!', x: 'Entregue às 06:12 no Apto 101. Bom dia!', h: '06:12', cta: 'Ver foto', novo: true },
    { ic: 'truck', tone: 'good', t: 'Saiu para entrega', x: 'Antônio está a caminho com seus 4 pãezinhos.', h: '05:40', cta: 'Acompanhar' },
    { ic: 'bell', tone: 'neutral', t: 'Entrega amanhã', x: 'Lembrete: 4 pães agendados para quarta, 06:30.', h: 'Ontem, 19:00' },
  ];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <AppBar title="Notificações" onBack={() => {}} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {N.map(n => (
          <Card key={n.t} pad={14} style={{ display: 'flex', gap: 12, border: n.novo ? `1.5px solid ${t.goldSoft}` : undefined }}>
            <CANotifIcon ic={n.ic} tone={n.tone} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8 }}><span style={{ flex: 1, fontWeight: 800, fontSize: 14.5, color: t.text }}>{n.t}</span><span style={{ fontSize: 12, color: t.textTer, fontWeight: 600 }}>{n.h}</span></div>
              <div style={{ fontSize: 13, color: t.textSec, marginTop: 2 }}>{n.x}</div>
              {n.cta && <Btn size="sm" variant={n.cta === 'Ver foto' ? 'primary' : 'soft'} icon={n.cta === 'Ver foto' ? 'camera' : null} style={{ marginTop: 10 }}>{n.cta}</Btn>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
function CCNotifPrefs() {
  const t = useT();
  const L = [['truck', 'Saiu para entrega e entregue', 'Com a foto, quando houver'], ['chat', 'Recados do entregador', '“Estou na portaria”, “Deixei com o porteiro”…', true], ['alert', 'Créditos e pagamentos', null], ['bell', 'Lembretes da agenda', null], ['gift', 'Novidades e Indique e Ganhe', null]];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <AppBar title="Notificações" onBack={() => {}} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px' }}>
        <Card pad={0}>
          {L.map(([ic, h, d, nw], i) => (
            <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: i ? `1px solid ${t.border2}` : 'none', background: nw ? t.surfaceAlt : 'transparent' }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: t.surface2, color: t.accent, display: 'grid', placeItems: 'center' }}><Icon name={ic} size={19} /></div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14.5, color: t.text, display: 'flex', gap: 6, alignItems: 'center' }}>{h}{nw && <CRTag tone="gold" size="sm">novo</CRTag>}</div>{d && <div style={{ fontSize: 12.5, color: t.textSec, marginTop: 1 }}>{d}</div>}</div>
              <Switch on onChange={() => {}} />
            </div>
          ))}
        </Card>
        <div style={{ fontSize: 12.5, color: t.textSec, margin: '12px 4px', lineHeight: 1.45 }}>O entregador não vê o seu telefone. Os recados chegam só como notificação.</div>
      </div>
    </div>
  );
}

/* ============================================================
   CourierApp — versão navegável do app do entregador (app.jsx › Entregador)
   Escanear: lê sozinho → confirmado → foto → volta à lista.
   ============================================================ */
function CourierApp() {
  const [r, setR] = React.useState('home');
  const [ov, setOv] = React.useState(null);
  const [step, setStep] = React.useState(0);
  const timer = React.useRef();
  React.useEffect(() => {
    clearTimeout(timer.current);
    if (r !== 'scan') return;
    const d = [1400, 500, 3000, null, null, 1600][step];
    if (d) timer.current = setTimeout(() => step === 5 ? (setR('home'), setStep(0)) : setStep(step + 1), d);
    return () => clearTimeout(timer.current);
  }, [r, step]);
  const go = (to, x) => {
    if (to === 'scan') { setStep(0); setR('scan'); return; }
    if (to === 'stop') { setOv(<div onClick={() => setOv(null)}><CRConfirmSheet p={x.p} c={x.c} /></div>); return; }
    if (to === 'start') { setOv(<div onClick={() => setOv(null)}><CRStartSheet /></div>); return; }
    if (to === 'code') { setOv(<div onClick={() => setOv(null)}><CRCodeSheet st="typing" /></div>); return; }
    setR(to);
  };
  const back = <button onClick={() => setR('home')} aria-label="Voltar" style={{ position: 'absolute', top: 6, left: 20, width: 40, height: 40, zIndex: 70, background: 'transparent', border: 'none', cursor: 'pointer' }} />;
  const wrap = (el, noBack) => <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0 }}>{el}{!noBack && back}</div>;
  if (r === 'scan') {
    const adv = () => setStep(s => Math.min(s + 1, 5));
    let el;
    if (step <= 1) el = <ScanScreen st={step ? 'read' : 'reading'} onClose={() => setR('home')} />;
    else if (step === 2) el = <ScanScreen st="read" overlay={<CRResult kind="ok" onNext={adv} />} />;
    else if (step === 3) el = <PhotoScreen st="camera" p={CR_P.maria} />;
    else if (step === 4) el = <PhotoScreen st="preview" p={CR_P.maria} />;
    else el = <PhotoScreen st="saved" />;
    return <div onClick={step >= 3 && step < 5 ? adv : undefined} style={{ position: 'absolute', inset: 0, zIndex: 80 }}>{el}</div>;
  }
  if (r === 'perfil') return wrap(<CRProfile />);
  if (r === 'cracha') return <div onClick={() => setR('home')} style={{ position: 'absolute', inset: 0, zIndex: 80, display: 'flex', flexDirection: 'column', paddingTop: 44, background: '#1E1207' }}><CRBadgeScreen /></div>;
  if (r === 'escala') return wrap(<CRSchedule />);
  return <CourierHome st="emrota" go={go} overlay={ov} />;
}

Object.assign(window, { CCTrack, CCPhotoViewer, CCHistory, CCNotifs, CCNotifPrefs, CourierApp });
