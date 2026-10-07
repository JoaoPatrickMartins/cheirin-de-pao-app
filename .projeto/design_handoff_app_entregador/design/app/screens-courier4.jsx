/* ============================================================
   App do Entregador — Perfil e extras
   E12 Operação · E13 Ganhos · E14 Perfil · E15 Crachá · E16 Recados · E17 Números · E18 Escala
   ============================================================ */
function CRRow({ ic, title, desc, right, last, tone, onClick, chev = true }) {
  const t = useT();
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '0 16px', minHeight: 60, borderBottom: last ? 'none' : `1px solid ${t.border2}`, cursor: onClick ? 'pointer' : 'default' }}>
      {ic && <div style={{ width: 38, height: 38, borderRadius: 12, background: tone === 'danger' ? t.dangerSoft : tone === 'gold' ? t.goldSoft : t.surface2, color: tone === 'danger' ? t.danger : t.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={ic} size={19} stroke={2} /></div>}
      <div style={{ flex: 1, minWidth: 0, padding: '11px 0' }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: tone === 'danger' ? t.danger : t.text }}>{title}</div>
        {desc && <div style={{ fontSize: 12.5, color: t.textSec, marginTop: 1 }}>{desc}</div>}
      </div>
      {right}
      {chev && !right && <Icon name="chevR" size={17} color={t.textTer} />}
    </div>
  );
}
function CRPage({ title, children, onBack = () => {}, right, pad = '0 16px 24px' }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
      <AppBar title={title} onBack={onBack} right={right} />
      <div className="cr-col" style={{ flex: 1, overflowY: 'auto', padding: pad, display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  );
}

/* ===== E12 — Falar com a operação. st: form · sending · sent · offline */
function CROpsScreen({ st = 'form' }) {
  const t = useT();
  const tipos = [['clock', 'Atraso'], ['moto', 'Problema no veículo'], ['alert', 'Acidente'], ['box', 'Pedido faltando'], ['edit', 'Outro']];
  return (
    <CRPage title="Falar com a operação">
      <Card pad={0}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 15, background: t.goodSoft, color: t.good, display: 'grid', placeItems: 'center' }}><Icon name="chat" size={24} /></div>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 16, color: t.text }}>Chamar no WhatsApp</div><div style={{ fontSize: 13, color: t.textSec }}>Operação · (11) 3322-1100 · 04:30–20:00</div></div>
          <Icon name="external" size={18} color={t.textTer} />
        </div>
      </Card>
      <CRLabel style={{ marginTop: 8 }}>Registrar ocorrência</CRLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {tipos.map(([ic, l], i) => { const on = i === 1; return <button key={l} style={{ height: 48, display: 'flex', alignItems: 'center', gap: 7, padding: '0 14px', borderRadius: 14, border: `2px solid ${on ? t.text : t.border}`, background: on ? t.text : t.surface, color: on ? t.appBg : t.text, fontWeight: 800, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}><Icon name={ic} size={16} stroke={2.3} />{l}</button>; })}
      </div>
      <CRTextarea value="Pneu furou na Rua das Acácias. Vou atrasar uns 20 min no Edifício Aurora." />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <CRPhotoPh w={72} h={72} r={14} />
        <button style={{ width: 72, height: 72, borderRadius: 14, border: `2px dashed ${t.border}`, background: 'transparent', color: t.accent, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="camera" size={24} /></button>
        <span style={{ fontSize: 13, color: t.textSec, fontWeight: 600 }}>Foto opcional</span>
      </div>
      {st === 'sent' && <CRNote ic="check" tone="good">Ocorrência enviada às 05:52. A operação já recebeu.</CRNote>}
      {st === 'offline' && <CRNote ic="cloudOff" tone="gold">Sem sinal agora. Guardamos a ocorrência e enviamos sozinhos.</CRNote>}
      <div style={{ flex: 1 }} />
      <CRBig icon={st === 'sending' ? null : 'send'} right={st === 'sending' ? <CRSpin color={t.gold} /> : null} disabled={st === 'sent'}>{st === 'sending' ? 'Enviando…' : st === 'sent' ? 'Enviada' : 'Enviar'}</CRBig>
    </CRPage>
  );
}

/* ===== E13 — Meus ganhos. st: week · nomod · nofuel · rota · semanal */
function CREarnings({ st = 'week' }) {
  const t = useT();
  const mod = st === 'rota' ? 'por_rota' : st === 'semanal' ? 'semanal_fixo' : 'por_entrega';
  const val = { por_entrega: 1.5, por_rota: 25, semanal_fixo: 400 }[mod];
  const w = GANHOS.semanaAtual;
  const base = { por_entrega: `${w.entregas} entregas × ${crR(1.5)}`, por_rota: `8 rotas × ${crR(25)}`, semanal_fixo: 'semanal fixo' }[mod];
  const rem = { por_entrega: w.remuneracao, por_rota: 200, semanal_fixo: 400 }[mod];
  const fuel = st === 'nofuel' ? 0 : w.combustivel;
  if (st === 'nomod') return (
    <CRPage title="Meus ganhos">
      <Card pad={22} style={{ textAlign: 'center' }}>
        <div style={{ width: 60, height: 60, borderRadius: 20, background: t.goldSoft, color: t.accent, display: 'grid', placeItems: 'center', margin: '0 auto' }}><Icon name="wallet" size={28} /></div>
        <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 21, color: t.text, marginTop: 14 }}>Forma de pagamento não definida</div>
        <div style={{ fontSize: 14, color: t.textSec, marginTop: 6, lineHeight: 1.5 }}>A operação ainda não cadastrou como você recebe. Fale com ela para acertar.</div>
        <div style={{ marginTop: 16 }}><CRBig icon="chat" variant="ghost">Falar com a operação</CRBig></div>
      </Card>
      <CRNote ic="fuel">Mesmo assim, o combustível estimado das suas rotas entra na proposta da semana: ~{crN(w.km)} km · ≈ {crR(w.combustivel)}.</CRNote>
    </CRPage>
  );
  return (
    <CRPage title="Meus ganhos">
      <div style={{ background: t.espresso, color: '#FAF5EC', borderRadius: 24, padding: 20, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -30, bottom: -50, opacity: 0.1 }}><BreadMark size={170} color="#E3AC3F" /></div>
        <div style={{ position: 'relative' }}>
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', padding: '5px 11px', borderRadius: 99, background: 'rgba(227,172,63,0.16)', color: '#E3AC3F', fontSize: 13, fontWeight: 800 }}><Icon name="coin" size={14} stroke={2.3} />Você recebe {MODALIDADES[mod].l} · {crR(val)}</span>
          <div style={{ fontSize: 13, color: '#C7B595', fontWeight: 700, marginTop: 16 }}>Semana {w.de}–{w.ate} · em andamento</div>
          <div style={{ fontSize: 12, color: '#C7B595', fontWeight: 800, letterSpacing: '0.08em', marginTop: 10 }}>A RECEBER (ESTIMADO)</div>
          <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 44, letterSpacing: '-0.03em', color: '#E3AC3F', lineHeight: 1.05 }}>~{crR(rem + fuel)}</div>
          <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            <div style={{ display: 'flex', padding: '10px 0 4px', fontSize: 14 }}><span style={{ flex: 1, color: '#C7B595', fontWeight: 600 }}>Remuneração<br /><span style={{ fontSize: 12.5 }}>{base}</span></span><b style={{ fontWeight: 800 }}>{crR(rem)}</b></div>
            {st !== 'nofuel' && <div style={{ display: 'flex', padding: '8px 0 0', fontSize: 14 }}><span style={{ flex: 1, color: '#C7B595', fontWeight: 600 }}>Combustível estimado<br /><span style={{ fontSize: 12.5 }}>~{crN(w.km)} km ÷ 38 km/l × R$ 6,09</span></span><b style={{ fontWeight: 800 }}>≈ {crR(fuel)}</b></div>}
          </div>
        </div>
      </div>
      <CRNote ic="alert">O valor final é o que a operação aprovar no fechamento da semana.</CRNote>
      {st === 'nofuel' && <CRNote ic="fuel">Sem consumo do veículo cadastrado, o combustível não entra no cálculo.</CRNote>}
      <CRLabel style={{ marginTop: 6 }}>Extrato</CRLabel>
      <Card pad={0}>
        {GANHOS.extrato.map((e, i) => {
          const pago = e.status === 'pago', mudou = e.final !== e.estimado;
          return (
            <div key={e.periodo} style={{ padding: '14px 16px', borderTop: i ? `1px solid ${t.border2}` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, fontWeight: 800, fontSize: 15, color: t.text }}>{e.periodo}</span>
                {pago ? <CRTag ic="check" tone="good" size="sm">pago {e.pagoEm}</CRTag> : <CRTag ic="clock" tone="gold" size="sm">a pagar · {e.vence}</CRTag>}
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 12.5, color: t.textSec, fontWeight: 600 }}>
                <span>Remuneração {crR(e.remuneracao)}</span>{st !== 'nofuel' && <span>Combustível {crR(e.combustivel)}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                {mudou && <span style={{ fontSize: 13, color: t.textSec, fontWeight: 600 }}>estimado {crR(e.estimado)} →</span>}
                <span style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 19, color: t.text }}>{pago ? 'pago' : 'final'} {crR(e.final)}</span>
              </div>
            </div>
          );
        })}
      </Card>
    </CRPage>
  );
}

/* ===== E14 — Perfil. st: normal · foto · noveh · logout · logoutPend */
function CRProfile({ st = 'normal', noveh: nv }) {
  const t = useT();
  const v = COURIER.veiculo;
  const noveh = st === 'noveh' || nv;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
      <AppBar title="Perfil" onBack={() => {}} />
      <div className="cr-col" style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card pad={18}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <CRAvatar size={72} radius={24} foto={st === 'foto'} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 21, color: t.text, letterSpacing: '-0.02em' }}>{COURIER.nome}</div>
              <div style={{ fontSize: 13.5, color: t.textSec, fontWeight: 600, marginTop: 2 }}>{COURIER.tel}</div>
              <div style={{ fontSize: 12.5, color: t.textTer, fontWeight: 600, marginTop: 2 }}>Entregador desde {COURIER.desde}</div>
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CRNote ic="user">Sua foto e seu primeiro nome aparecem para o cliente quando o pão sai para entrega.</CRNote>
            <div style={{ fontSize: 12.5, color: t.textSec, fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center', padding: '0 2px' }}><Icon name="lock" size={13} />Quer mudar algum dado? Fale com a operação.</div>
          </div>
        </Card>
        <div><CRLabel>Meu trabalho</CRLabel><Card pad={0}>
          <CRRow ic="badge" title="Crachá digital" desc="Mostre na portaria" tone="gold" />
          <CRRow ic="wallet" title="Meus ganhos" desc="Semana atual ~R$ 220,80 (estimado)" />
          <CRRow ic="trend" title="Meus números" desc="312 entregas em 30 dias" />
          <CRRow ic="calendar" title="Minha escala" desc="Seg a sáb · próxima folga 12/10" last />
        </Card></div>
        <div><CRLabel>Meu veículo</CRLabel><Card pad={0}>
          {noveh ? <CRRow ic="moto" title="Não cadastrado" desc="A operação cadastra seu veículo e o consumo" chev={false} last /> : <>
            <CRRow ic="moto" title="Moto · Honda CG 160" desc={`Placa ${v.placa}`} chev={false} />
            <CRRow ic="fuel" title="Gasolina · 38 km/l" desc="Usado no combustível estimado" chev={false} last />
          </>}
        </Card></div>
        <div><CRLabel>Preferências</CRLabel><Card pad={0}>
          <CRRow ic="navigate" title="App de mapas" right={<span style={{ fontSize: 14, fontWeight: 700, color: t.textSec }}>Google Maps</span>} />
          <CRRow ic="bell" title="Notificações" desc="Entregas novas e avisos da operação" right={<Switch on onChange={() => {}} />} chev={false} last />
        </Card></div>
        <div><CRLabel>Conta e ajuda</CRLabel><Card pad={0}>
          <CRRow ic="lock" title="Trocar senha" />
          <CRRow ic="chat" title="Falar com a operação" desc="WhatsApp ou registrar ocorrência" />
          <CRRow ic="logout" title="Sair" tone="danger" chev={false} last />
        </Card></div>
      </div>
      {(st === 'logout' || st === 'logoutPend') && (
        <CRSheet title="Sair do app?" sub={st === 'logout' ? 'As entregas guardadas sem sinal são enviadas antes.' : null}>
          {st === 'logoutPend' && <CRNote ic="cloudOff" tone="danger" style={{ marginBottom: 14 }}><b>2 entregas ainda não subiram.</b> Se sair sem sinal, elas se perdem. Espere o sinal voltar ou fale com a operação.</CRNote>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <CRBig variant={st === 'logoutPend' ? 'danger' : 'dangerFill'} icon="logout">{st === 'logoutPend' ? 'Sair mesmo assim' : 'Sair'}</CRBig>
            <CRBig variant="ghost">{st === 'logoutPend' ? 'Esperar o envio' : 'Cancelar'}</CRBig>
          </div>
        </CRSheet>
      )}
    </div>
  );
}

/* ===== E15 — Crachá digital. st: ativo · off · nofoto */
function crNow() {
  const [d, setD] = React.useState(() => new Date(2026, 8, 30, 5, 41, 27));
  React.useEffect(() => { const id = setInterval(() => setD(x => new Date(x.getTime() + 1000)), 1000); return () => clearInterval(id); }, []);
  const p = n => String(n).padStart(2, '0');
  return { data: `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`, hora: `${p(d.getHours())}:${p(d.getMinutes())}`, seg: p(d.getSeconds()) };
}
/* Selo giratório com texto em volta (prova de que não é print) */
function CRSeal({ size = 88, spin = true }) {
  const id = 'crseal' + React.useId().replace(/[^a-z0-9]/gi, '');
  return (
    <div style={{ width: size, height: size, position: 'relative', filter: 'drop-shadow(0 8px 16px rgba(20,12,4,.45))' }}>
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ position: 'absolute', inset: 0, animation: spin ? 'crSpin 16s linear infinite' : 'none' }}>
        <defs>
          <path id={id} d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0" />
          <linearGradient id={id + 'g'} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F3DDA6" /><stop offset=".5" stopColor="#E3AC3F" /><stop offset="1" stopColor="#B0702A" /></linearGradient>
        </defs>
        <circle cx="50" cy="50" r="49" fill={`url(#${id}g)`} />
        <circle cx="50" cy="50" r="46.5" fill="#1E1207" />
        <circle cx="50" cy="50" r="28" fill="none" stroke="#E3AC3F" strokeWidth=".7" strokeDasharray="1.2 2.2" />
        <text fontFamily="Hanken Grotesk, sans-serif" fontSize="7.3" fontWeight="800" letterSpacing="1.35" fill="#E3AC3F"><textPath href={'#' + id}>CHEIRIN DE PÃO · ENTREGADOR VERIFICADO ·</textPath></text>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}><BreadMark size={size * 0.4} color="#E3AC3F" /></div>
    </div>
  );
}
function CRSecRing({ sec, size = 46 }) {
  const r = 19, c = 2 * Math.PI * r, p = sec / 60;
  return (
    <svg width={size} height={size} viewBox="0 0 46 46" aria-hidden="true">
      <circle cx="23" cy="23" r={r} fill="none" stroke="rgba(227,172,63,.18)" strokeWidth="3" />
      <circle cx="23" cy="23" r={r} fill="none" stroke="#E3AC3F" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} transform="rotate(-90 23 23)" style={{ transition: 'stroke-dasharray .3s' }} />
      <text x="23" y="27" textAnchor="middle" fontFamily="Bricolage Grotesque, sans-serif" fontWeight="800" fontSize="12" fill="#FAF5EC">{String(sec).padStart(2, '0')}</text>
    </svg>
  );
}

/* ===== E15 — Crachá digital (credencial premium)
   st: ativo · nofoto · off */
function CRBadgeScreen({ st = 'ativo' }) {
  const t = useT();
  const now = crNow();
  const off = st === 'off', nofoto = st === 'nofoto';
  const guil = 'repeating-radial-gradient(circle at 100% 0%, rgba(227,172,63,.13) 0 1px, transparent 1.2px 7px), repeating-radial-gradient(circle at 0% 100%, rgba(227,172,63,.09) 0 1px, transparent 1.2px 7px)';
  const Datum = ({ k, v, mono }) => <div style={{ minWidth: 0 }}><div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.18em', color: '#A89A82' }}>{k}</div><div style={{ fontSize: 14, fontWeight: 800, color: '#241608', marginTop: 3, fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit', letterSpacing: mono ? '0.02em' : '-0.01em', whiteSpace: 'nowrap' }}>{v}</div></div>;
  return (
    <div className="cr-live" style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'radial-gradient(130% 70% at 50% 0%, #3B2715 0%, #1E1207 48%, #0C0703 100%)', display: 'flex', flexDirection: 'column', padding: '2px 16px 16px' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'repeating-radial-gradient(circle at 50% 42%, rgba(227,172,63,.06) 0 1px, transparent 1.4px 10px)', WebkitMaskImage: 'radial-gradient(circle at 50% 42%, #000 0%, transparent 70%)', maskImage: 'radial-gradient(circle at 50% 42%, #000 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, height: 52 }}>
        <CRIconBtn icon="x" tone="dark" label="Fechar" />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#FAF5EC' }}>{off ? 'Crachá digital' : 'Mostre na portaria'}</div>
          {!off && <div style={{ fontSize: 11.5, fontWeight: 700, color: '#E3AC3F', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 1 }}><Icon name="spark" size={12} stroke={2.4} />brilho no máximo</div>}
        </div>
        <span style={{ width: 44 }} />
      </div>

      <div style={{ position: 'relative', flex: 1, marginTop: 8, borderRadius: 30, overflow: 'hidden', background: off ? '#E7E1D6' : 'linear-gradient(168deg, #FFFDF9 0%, #FBF4E6 52%, #F2E3C4 100%)', boxShadow: '0 34px 70px -24px rgba(0,0,0,.85), 0 0 0 1px rgba(227,172,63,.45), inset 0 1px 0 rgba(255,255,255,.9)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 118, flexShrink: 0, filter: off ? 'grayscale(1)' : 'none', background: `${guil}, linear-gradient(135deg, #2A1B0E 0%, #1E1207 60%, #140C05 100%)`, padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 10, position: 'relative' }}>
          <BreadMark size={38} color="#E3AC3F" />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 19, color: '#FAF5EC', letterSpacing: '-0.02em', lineHeight: 1.1 }}>Cheirin de Pão</div>
            <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.24em', color: '#E3AC3F', marginTop: 5 }}>CREDENCIAL DE ENTREGADOR</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', color: '#A89A82' }}>Nº</div>
            <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 700, fontSize: 14, color: '#FAF5EC', letterSpacing: '0.08em' }}>0427</div>
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: 'linear-gradient(90deg, #B0702A, #F3DDA6 25%, #E3AC3F 50%, #F3DDA6 75%, #B0702A)' }} />
        </div>

        <div style={{ alignSelf: 'center', marginTop: -62, position: 'relative', filter: off ? 'grayscale(1)' : 'none' }}>
          <div style={{ width: 150, height: 176, borderRadius: 30, padding: 4, background: 'linear-gradient(145deg, #F3DDA6, #E3AC3F 40%, #B0702A 70%, #F3DDA6)', boxShadow: '0 14px 30px -12px rgba(30,18,7,.55)' }}>
            {nofoto ? <div style={{ width: '100%', height: '100%', borderRadius: 26, background: `${guil}, #1E1207`, display: 'grid', placeItems: 'center', fontFamily: CR_H, fontWeight: 800, fontSize: 58, color: '#E3AC3F', letterSpacing: '-0.03em' }}>{crIni(COURIER.nome)}</div>
              : <div aria-label="Foto do entregador" style={{ width: '100%', height: '100%', borderRadius: 26, background: 'radial-gradient(circle at 50% 36%, #C9A57A 0 21%, transparent 22%), radial-gradient(ellipse at 50% 100%, #8A5A2E 0 44%, transparent 45%), linear-gradient(160deg, #EADBC0, #D8C3A0)' }} />}
          </div>
          <div style={{ position: 'absolute', right: -52, bottom: -16 }}><CRSeal size={82} spin={!off} /></div>
        </div>

        <div style={{ textAlign: 'center', padding: '14px 18px 0' }}>
          <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 30, color: '#1E1207', letterSpacing: '-0.035em', lineHeight: 1.02 }}>{COURIER.nome}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 7, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.3em', color: '#B0702A' }}><span style={{ width: 5, height: 5, transform: 'rotate(45deg)', background: '#E3AC3F' }} />ENTREGADOR<span style={{ width: 5, height: 5, transform: 'rotate(45deg)', background: '#E3AC3F' }} /></div>
        </div>

        {nofoto && <div style={{ margin: '10px 18px 0', display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', borderRadius: 12, background: 'rgba(227,172,63,.16)', color: '#6E4712', fontSize: 12.5, fontWeight: 700 }}><Icon name="camera" size={15} color="#B0702A" />Sem foto no crachá — peça sua foto à operação.</div>}

        <div style={{ margin: '14px 18px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 12, columnGap: 14, padding: '14px 0', borderTop: '1px solid rgba(43,26,12,.1)', borderBottom: '1px solid rgba(43,26,12,.1)' }}>
          <Datum k="CPF" v={COURIER.cpfMascarado} mono />
          <Datum k="DESDE" v="mar/2026" />
          <Datum k="VEÍCULO" v={`Moto · ${COURIER.veiculo.placa}`} />
          <Datum k="VÁLIDO ATÉ" v="31/12/2026" />
        </div>

        <div style={{ margin: '12px 18px 0', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 16, background: off ? '#F6E0DC' : '#E3EFE5', border: `1px solid ${off ? 'rgba(178,58,46,.3)' : 'rgba(62,124,83,.28)'}` }}>
          <span style={{ width: 12, height: 12, borderRadius: 99, background: off ? '#B23A2E' : '#3E7C53', animation: off ? 'none' : 'crHalo 1.8s ease-out infinite', flexShrink: 0 }} />
          <span style={{ flex: 1, fontFamily: CR_H, fontWeight: 800, fontSize: 22, letterSpacing: '0.14em', color: off ? '#B23A2E' : '#2F6442' }}>{off ? 'INATIVO' : 'ATIVO'}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: off ? '#B23A2E' : '#3E7C53', display: 'flex', alignItems: 'center', gap: 4 }}><Icon name={off ? 'ban' : 'shield'} size={14} stroke={2.3} />{off ? 'desativado' : 'verificado agora'}</span>
        </div>

        <div style={{ flex: 1 }} />
        {!off && <div style={{ margin: '12px 18px 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: '#7C6A50' }}><Icon name="route" size={15} color="#B0702A" /><span style={{ flex: 1 }}>Hoje · ☀️ Manhã · Residencial Jardins e mais 3</span></div>}
        <div style={{ margin: '12px 12px 12px', borderRadius: 22, background: `${guil}, #1E1207`, padding: '12px 14px 12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', color: '#C7B595' }}><span style={{ width: 7, height: 7, borderRadius: 99, background: off ? '#8B7A60' : '#E07A6E', animation: off ? 'none' : 'crBeat 1s ease-in-out infinite' }} />{off ? 'SEM VALIDADE' : `AO VIVO · ${now.data}`}</div>
            <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 38, color: '#FAF5EC', letterSpacing: '-0.02em', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>{off ? '— : —' : <>{now.hora}<span style={{ color: '#E3AC3F' }}>:{now.seg}</span></>}</div>
          </div>
          {!off && <CRSecRing sec={+now.seg} />}
        </div>

        {!off && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(112deg, transparent 38%, rgba(255,255,255,.55) 47%, rgba(243,221,166,.4) 51%, transparent 60%)', backgroundSize: '320% 100%', animation: 'crSheen 5s ease-in-out infinite', mixBlendMode: 'overlay' }} />}
        {off && <div style={{ position: 'absolute', left: '50%', top: '44%', transform: 'translate(-50%,-50%) rotate(-12deg)', border: '4px solid #B23A2E', color: '#B23A2E', borderRadius: 14, padding: '6px 18px', fontFamily: CR_H, fontWeight: 800, fontSize: 40, letterSpacing: '0.12em', background: 'rgba(255,255,255,.55)' }}>INATIVO</div>}
      </div>

      {off ? (
        <div style={{ position: 'relative', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 14, color: '#C7B595', textAlign: 'center', lineHeight: 1.45 }}>Seu cadastro está desativado. O crachá volta quando a operação reativar.</div>
          <CRBig variant="gold" icon="chat">Falar com a operação</CRBig>
        </div>
      ) : (
        <div style={{ position: 'relative', paddingTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: 'rgba(250,245,236,.62)' }}><Icon name="shield" size={14} />Selo e relógio se movem — não é print de tela.</div>
      )}
    </div>
  );
}

/* ===== E16 — Recados ao cliente. st: pick · sending · sent · optout · offline */
function CRRecadoSheet({ st = 'pick' }) {
  const t = useT();
  const off = st === 'optout';
  return (
    <CRSheet title="Mandar recado" sub="Maria S. · Apto 101 · Bloco 1">
      {off && <CRNote ic="bell" tone="gold" style={{ marginBottom: 12 }}>Maria desligou os recados do entregador. Se precisar, fale com a operação.</CRNote>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{RECADOS.map((r, i) => <CRChoice key={r} ic="chat" on={!off && i === 0} disabled={off}>{r}</CRChoice>)}</div>
      {st === 'sent' && <CRNote ic="check" tone="good" style={{ marginTop: 12 }}>Recado enviado às 05:41</CRNote>}
      {st === 'offline' && <CRNote ic="cloudOff" tone="gold" style={{ marginTop: 12 }}>Sem sinal agora. O recado sai assim que o sinal voltar.</CRNote>}
      <div style={{ fontSize: 12.5, color: t.textSec, fontWeight: 600, margin: '12px 2px 14px', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="lock" size={13} />O cliente recebe como notificação. Seu telefone não aparece.</div>
      <CRBig icon={st === 'sending' ? null : 'send'} disabled={off || st === 'sent'} right={st === 'sending' ? <CRSpin color={t.gold} /> : null}>{st === 'sending' ? 'Enviando…' : st === 'sent' ? 'Enviado' : 'Enviar recado'}</CRBig>
    </CRSheet>
  );
}

/* ===== E17 — Meus números. st: data · empty */
function CRNumbers({ st = 'data' }) {
  const t = useT();
  const n = NUMEROS_30D;
  if (st === 'empty') return (
    <CRPage title="Meus números">
      <div style={{ background: t.espresso, color: '#FAF5EC', borderRadius: 24, padding: '24px 20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -30, bottom: -46, opacity: 0.12 }}><BreadMark size={170} color="#E3AC3F" /></div>
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.1em', color: '#E3AC3F' }}>BEM-VINDO, ANTÔNIO</div>
          <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em', marginTop: 6, lineHeight: 1.1 }}>Seus números começam na primeira rota</div>
          <div style={{ fontSize: 14, color: '#C7B595', marginTop: 8 }}>Quarta, 01/10 · ☀️ Manhã · 06:30 · 12 paradas</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[['check', 'Entregas'], ['basket', 'Pães entregues'], ['clock', 'Tempo médio por rota'], ['route', 'Km estimado']].map(([ic, l]) => <div key={l} style={{ background: t.surface, borderRadius: 16, padding: '12px 14px', border: `1.5px dashed ${t.border}` }}><Icon name={ic} size={17} color={t.textTer} stroke={2.3} /><div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 22, color: t.textTer, marginTop: 4 }}>—</div><div style={{ fontSize: 12, color: t.textSec, fontWeight: 700 }}>{l}</div></div>)}
      </div>
      <CRNote ic="spark">Cada rota encerrada entra aqui. Sem ranking: são só os seus números.</CRNote>
    </CRPage>
  );
  const max = Math.max(...n.porDia);
  const kpis = [['Entregas', n.entregas, 'check'], ['Pães entregues', n.paes.toLocaleString('pt-BR'), 'basket'], ['Tempo médio por rota', n.tempoMedioRota, 'clock'], ['Km estimado', '~' + n.km, 'route'], ['Combustível estimado', '≈ ' + crR(n.combustivel), 'fuel']];
  return (
    <CRPage title="Meus números">
      <div style={{ display: 'flex', gap: 4, background: t.surface2, borderRadius: 14, padding: 4 }}>{['7 dias', '30 dias'].map((l, i) => <button key={l} style={{ flex: 1, height: 42, borderRadius: 11, border: 'none', background: i ? t.surface : 'transparent', boxShadow: i ? t.shadowSoft : 'none', fontWeight: 800, fontSize: 14, color: i ? t.text : t.textSec, fontFamily: 'inherit' }}>{l}</button>)}</div>
      <div style={{ background: t.espresso, color: '#FAF5EC', borderRadius: 22, padding: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 48, color: '#E3AC3F', letterSpacing: '-0.03em' }}>97%</div>
        <div><div style={{ fontWeight: 800, fontSize: 16 }}>de entregas com sucesso</div><div style={{ fontSize: 13.5, color: '#C7B595', marginTop: 2 }}>Mandou bem! Quase todo mundo acordou com pão na porta.</div></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {kpis.map(([l, v, ic], i) => <div key={l} style={{ gridColumn: i === 0 ? 'span 2' : 'auto', background: t.surface, borderRadius: 16, padding: '12px 14px', border: `1px solid ${t.border2}` }}><Icon name={ic} size={17} color={t.accent} stroke={2.3} /><div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 22, color: t.text, marginTop: 4 }}>{v}</div><div style={{ fontSize: 12, color: t.textSec, fontWeight: 700 }}>{l}</div></div>)}
      </div>
      <Card pad={16}>
        <CRLabel>Entregas por dia</CRLabel>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90 }}>{n.porDia.map((v, i) => <div key={i} style={{ flex: 1, height: v ? `${(v / max) * 100}%` : 3, borderRadius: 3, background: v ? (i === n.porDia.length - 1 ? t.gold : t.accent) : t.surface2, opacity: v ? 1 : 1 }} />)}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: t.textTer, fontWeight: 700, marginTop: 6 }}><span>01/09</span><span>folgas em cinza</span><span>30/09</span></div>
      </Card>
      <Card pad={0}>
        {[['Hoje · 30/09', '☀️ 🌇', 11, 1], ['Seg · 29/09', '☀️', 12, 0], ['Sáb · 27/09', '☀️', 13, 0], ['Sex · 26/09', '☀️ 🌇', 11, 1]].map(([d, tu, e, f], i) => (
          <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', minHeight: 54, borderTop: i ? `1px solid ${t.border2}` : 'none' }}>
            <span style={{ flex: 1, fontWeight: 700, fontSize: 14.5, color: t.text }}>{d}</span><span style={{ fontSize: 14 }}>{tu}</span>
            <CRTag ic="check" tone="good" size="sm">{e}</CRTag>{f > 0 && <CRTag ic="x" tone="danger" size="sm">{f}</CRTag>}
          </div>
        ))}
      </Card>
    </CRPage>
  );
}

/* ===== E18 — Minha escala (só leitura). st: normal · nofolga · hoje */
function CRSchedule({ st = 'normal' }) {
  const t = useT();
  const dias = [['Seg', '29', true], ['Ter', '30', true], ['Qua', '01', true], ['Qui', '02', true], ['Sex', '03', true], ['Sáb', '04', true], ['Dom', '05', false]];
  const hoje = st === 'hoje';
  return (
    <CRPage title="Minha escala">
      {hoje && <CRNote ic="dayoff" tone="good"><b>Hoje é sua folga 🌿</b> Sua próxima rota é amanhã, ☀️ Manhã · 06:30.</CRNote>}
      <Card pad={16}>
        <CRLabel>Esta semana · 29/09–05/10</CRLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>
          {dias.map(([d, n, w], i) => {
            const today = i === 1, off = !w || (hoje && today);
            return (
              <div key={d} style={{ borderRadius: 14, padding: '9px 0', textAlign: 'center', background: today ? t.espresso : off ? t.surface2 : t.surfaceAlt, color: today ? '#FAF5EC' : t.text, border: today ? 'none' : `1px solid ${t.border2}` }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: today ? '#E3AC3F' : t.textSec }}>{d}</div>
                <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 18 }}>{n}</div>
                <div style={{ fontSize: 12, marginTop: 3, minHeight: 32, lineHeight: 1.3 }}>{off ? <span style={{ fontSize: 11, fontWeight: 800, color: today ? '#C7B595' : t.textTer }}>folga</span> : <>☀️<br />{i % 2 === 1 ? '🌇' : ''}</>}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 12.5, color: t.textSec, fontWeight: 700 }}><span>☀️ Manhã · 06:30</span><span>🌇 Tarde · 16:00</span></div>
      </Card>
      <CRLabel style={{ marginTop: 4 }}>Próximas folgas</CRLabel>
      {st === 'nofolga' ? <Card pad={16}><div style={{ fontSize: 14, color: t.textSec }}>Nenhuma folga marcada fora dos domingos.</div></Card> : (
        <Card pad={0}>
          {COURIER.escala.folgas.map((f, i) => (
            <div key={f.de} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', minHeight: 60, borderTop: i ? `1px solid ${t.border2}` : 'none' }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: t.goodSoft, color: t.good, display: 'grid', placeItems: 'center' }}><Icon name="dayoff" size={19} /></div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 15, color: t.text }}>{f.de === f.ate ? f.de : `${f.de} a ${f.ate}`}</div><div style={{ fontSize: 12.5, color: t.textSec }}>{f.motivo}</div></div>
            </div>
          ))}
        </Card>
      )}
      <CRNote ic="lock">A escala é definida pela operação. Algo errado? <b style={{ textDecoration: 'underline' }}>Fale com a operação</b></CRNote>
    </CRPage>
  );
}

Object.assign(window, { CRSeal, CRSecRing, CRRow, CRPage, CROpsScreen, CREarnings, CRProfile, crNow, CRBadgeScreen, CRRecadoSheet, CRNumbers, CRSchedule });
