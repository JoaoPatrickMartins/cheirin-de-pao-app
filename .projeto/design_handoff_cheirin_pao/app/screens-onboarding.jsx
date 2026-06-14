/* ============================================================
   Cheirin de Pão — Telas do Cliente
   ============================================================ */

/* ---------- Splash / Instalar PWA ---------- */
function InstallScreen({ go }) {
  const t = useT();
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: t.espresso, color: '#FAF5EC', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 50% -10%, rgba(227,172,63,0.18), transparent 60%)' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, position: 'relative', padding: 32 }}>
        <div style={{ width: 132, height: 132, borderRadius: '30%', background: '#160C04', display: 'grid', placeItems: 'center', boxShadow: '0 30px 60px -20px rgba(0,0,0,0.6)' }}>
          <BreadMark size={86} color="#E3AC3F" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 32, letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>Cheirin de Pão</div>
          <div style={{ fontSize: 12, letterSpacing: '0.26em', color: '#E3AC3F', marginTop: 8, fontWeight: 600 }}>PÃO FRESCO NA PORTA</div>
        </div>
      </div>
      <div style={{ position: 'relative', padding: '0 24px 16px' }}>
        <div style={{ background: 'rgba(250,245,236,0.06)', border: '1px solid rgba(250,245,236,0.12)', borderRadius: 22, padding: 18, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: '#160C04', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <BreadMark size={30} color="#E3AC3F" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Instalar o Cheirin</div>
              <div style={{ fontSize: 12.5, color: '#C7B595', marginTop: 2 }}>Adicione à tela inicial — abre rápido, funciona offline.</div>
            </div>
          </div>
        </div>
        <Btn variant="gold" full size="lg" onClick={() => go('onboarding')} style={{ whiteSpace: 'nowrap' }}>Instalar e criar conta</Btn>
        <button onClick={() => go('login')} style={{ width: '100%', marginTop: 12, background: 'none', border: 'none', color: '#C7B595', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'Hanken Grotesk' }}>Já tenho conta — entrar</button>
      </div>
    </div>
  );
}

/* ---------- Login por código ---------- */
function LoginScreen({ go }) {
  const t = useT();
  const [step, setStep] = React.useState('phone');
  const [phone, setPhone] = React.useState('');
  const [code, setCode] = React.useState(['', '', '', '']);
  const refs = [0, 1, 2, 3].map(() => React.useRef(null));
  const setDigit = (i, v) => {
    if (!/^\d?$/.test(v)) return;
    const nc = [...code]; nc[i] = v; setCode(nc);
    if (v && i < 3) refs[i + 1].current?.focus();
  };
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 24px 24px' }}>
      <button onClick={() => step === 'code' ? setStep('phone') : go('install')} style={{ background: t.surface2, border: 'none', width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', cursor: 'pointer', color: t.text }}>
        <Icon name="arrowL" size={20} />
      </button>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {step === 'phone' ? (
          <div>
            <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 28, letterSpacing: '-0.03em', color: t.text, lineHeight: 1.1 }}>Bom dia.<br />Vamos te identificar.</div>
            <div style={{ fontSize: 14.5, color: t.textSec, marginTop: 12, marginBottom: 28, lineHeight: 1.5 }}>Enviamos um código por SMS para confirmar seu número. Sem senha pra decorar.</div>
            <Field label="Celular" icon="phone" value={phone} onChange={setPhone} placeholder="(11) 9 0000-0000" type="tel" />
            <div style={{ height: 18 }} />
            <Btn full size="lg" onClick={() => setStep('code')}>Enviar código</Btn>
            <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: t.textTer }}>ou entre com <span style={{ color: t.accent, fontWeight: 700 }}>e-mail</span></div>
          </div>
        ) : (
          <div>
            <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 28, letterSpacing: '-0.03em', color: t.text, lineHeight: 1.1 }}>Digite o código</div>
            <div style={{ fontSize: 14.5, color: t.textSec, marginTop: 12, marginBottom: 28, lineHeight: 1.5 }}>Mandamos 4 dígitos para <b style={{ color: t.text }}>{phone || '(11) 9 0000-0000'}</b>.</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
              {code.map((d, i) => (
                <input key={i} ref={refs[i]} value={d} onChange={e => setDigit(i, e.target.value)} maxLength={1} inputMode="numeric"
                  style={{ width: 64, height: 72, textAlign: 'center', fontSize: 30, fontWeight: 800, fontFamily: 'Bricolage Grotesque, sans-serif', color: t.text, background: t.surfaceAlt, border: `1.5px solid ${d ? t.accent : t.border}`, borderRadius: 18, outline: 'none' }} />
              ))}
            </div>
            <div style={{ height: 24 }} />
            <Btn full size="lg" onClick={() => go('onboarding')}>Confirmar</Btn>
            <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: t.textTer }}>Não chegou? <span style={{ color: t.accent, fontWeight: 700 }}>Reenviar em 0:28</span></div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Onboarding / Cadastro completo (sec. 3.3 / 4.1) ---------- */
function OnboardingScreen({ go }) {
  const t = useT();
  const NSTEPS = 5;
  const [step, setStep] = React.useState(0);
  const [nome, setNome] = React.useState('');
  const [cpf, setCpf] = React.useState('');
  const [nasc, setNasc] = React.useState('');
  const [tel, setTel] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [canal, setCanal] = React.useState('sms'); // sms | email
  const [condo, setCondo] = React.useState(null);
  const [bloco, setBloco] = React.useState(null);
  const [apto, setApto] = React.useState('');
  const [q, setQ] = React.useState('');
  const [code, setCode] = React.useState(['', '', '', '']);
  const refs = [0, 1, 2, 3].map(() => React.useRef(null));
  const setDigit = (i, v) => { if (!/^\d?$/.test(v)) return; const nc = [...code]; nc[i] = v; setCode(nc); if (v && i < 3) refs[i + 1].current?.focus(); };
  const condoSel = CONDOS.find(c => c.id === condo);
  const filtered = CONDOS.filter(c => c.nome.toLowerCase().includes(q.toLowerCase()));
  const temContato = tel.length > 0 || email.length > 0;

  const Dots = () => (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '4px 0 16px' }}>
      {Array.from({ length: NSTEPS }).map((_, i) => <div key={i} style={{ width: i === step ? 22 : 7, height: 7, borderRadius: 99, background: i === step ? t.accent : t.border, transition: 'all .25s' }} />)}
    </div>
  );
  const Title = ({ children }) => <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 26, letterSpacing: '-0.03em', color: t.text, lineHeight: 1.15 }}>{children}</div>;
  const Sub = ({ children }) => <div style={{ fontSize: 14, color: t.textSec, marginTop: 10, marginBottom: 22, lineHeight: 1.5 }}>{children}</div>;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '6px 24px 22px', overflow: 'hidden' }}>
      <button onClick={() => step === 0 ? go('install') : setStep(step - 1)} style={{ background: t.surface2, border: 'none', width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', cursor: 'pointer', color: t.text, flexShrink: 0 }}>
        <Icon name="arrowL" size={20} />
      </button>
      <div style={{ marginTop: 16, marginBottom: 6 }}><Dots /></div>

      {step === 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Title>Seus dados</Title>
          <Sub>Precisamos disso uma única vez, pra deixar sua conta pronta.</Sub>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Nome completo" icon="user" value={nome} onChange={setNome} placeholder="Ex.: Marina Ribeiro" />
            <Field label="CPF" icon="card" value={cpf} onChange={setCpf} placeholder="000.000.000-00" type="tel" />
            <Field label="Data de nascimento" icon="calendar" value={nasc} onChange={setNasc} placeholder="DD / MM / AAAA" type="tel" />
          </div>
          <div style={{ flex: 1 }} />
          <Btn full size="lg" disabled={!nome || !cpf || !nasc} onClick={() => setStep(1)}>Continuar</Btn>
        </div>
      )}

      {step === 1 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Title>Como falamos com você?</Title>
          <Sub>Informe telefone <b style={{ color: t.text }}>ou</b> e-mail (pelo menos um). É por aí que enviamos o código e os avisos de entrega.</Sub>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Celular" icon="phone" value={tel} onChange={setTel} placeholder="(11) 9 0000-0000" type="tel" />
            <Field label="E-mail" icon="mail" value={email} onChange={setEmail} placeholder="voce@email.com" />
          </div>
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec, marginBottom: 9 }}>Receber o código por</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[{ k: 'sms', l: 'SMS', ic: 'phone', dis: !tel }, { k: 'email', l: 'E-mail', ic: 'mail', dis: !email }].map(o => (
                <button key={o.k} disabled={o.dis} onClick={() => setCanal(o.k)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 0', borderRadius: 14, border: `1.5px solid ${canal === o.k && !o.dis ? t.accent : t.border}`, background: canal === o.k && !o.dis ? t.goldSoft : t.surface, color: o.dis ? t.textTer : (canal === o.k ? t.accent : t.text), fontWeight: 700, fontSize: 14, cursor: o.dis ? 'default' : 'pointer', opacity: o.dis ? 0.5 : 1, fontFamily: 'Hanken Grotesk' }}>
                  <Icon name={o.ic} size={17} />{o.l}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <Btn full size="lg" disabled={!temContato} onClick={() => setStep(2)}>Continuar</Btn>
        </div>
      )}

      {step === 2 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Title>Onde você mora?</Title>
          <div style={{ fontSize: 14, color: t.textSec, marginTop: 10, marginBottom: 16, lineHeight: 1.5 }}>Entregamos só nos condomínios parceiros já cadastrados.</div>
          <Field icon="building" value={q} onChange={setQ} placeholder="Buscar condomínio" />
          <div style={{ flex: 1, overflowY: 'auto', marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(c => (
              <Card key={c.id} pad={14} onClick={() => setCondo(c.id)} style={{ cursor: 'pointer', border: `1.5px solid ${condo === c.id ? t.accent : t.border2}`, display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: t.surface2, display: 'grid', placeItems: 'center', color: t.accent, flexShrink: 0 }}><Icon name="building" size={20} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: t.text }}>{c.nome}</div>
                  <div style={{ fontSize: 12.5, color: t.textTer, marginTop: 1 }}>{c.bairro} · {c.tipo === 'blocos' ? 'blocos/torres' : 'entrada única'}</div>
                </div>
                {condo === c.id && <Icon name="check" size={20} color={t.accent} />}
              </Card>
            ))}
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 16px', color: t.textTer }}>
                <Icon name="building" size={28} color={t.textTer} />
                <div style={{ fontSize: 13.5, marginTop: 10, lineHeight: 1.5 }}>Seu condomínio ainda não é parceiro.<br />Avise a gente que levamos o cheirin até aí!</div>
              </div>
            )}
          </div>
          <div style={{ paddingTop: 14 }}><Btn full size="lg" disabled={!condo} onClick={() => setStep(3)}>Continuar</Btn></div>
        </div>
      )}

      {step === 3 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Title>Seu endereço</Title>
          <Sub>{condoSel?.nome} · {condoSel?.bairro}</Sub>
          {condoSel?.tipo === 'blocos' && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec, marginBottom: 9 }}>Bloco / Torre</div>
              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                {condoSel.blocos.map(b => (
                  <button key={b} onClick={() => setBloco(b)} style={{ padding: '10px 16px', borderRadius: 13, border: `1.5px solid ${bloco === b ? t.accent : t.border}`, background: bloco === b ? t.goldSoft : t.surface, color: bloco === b ? t.accent : t.text, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'Hanken Grotesk' }}>{b}</button>
                ))}
              </div>
            </div>
          )}
          <Field label="Apartamento" icon="pin" value={apto} onChange={setApto} placeholder="Ex.: 102" type="tel" />
          <div style={{ flex: 1 }} />
          <Btn full size="lg" disabled={!apto || (condoSel?.tipo === 'blocos' && !bloco)} onClick={() => setStep(4)} style={{ whiteSpace: 'nowrap' }}>Enviar código de confirmação</Btn>
        </div>
      )}

      {step === 4 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Title>Confirme seu cadastro</Title>
          <Sub>Enviamos 4 dígitos por <b style={{ color: t.text }}>{canal === 'sms' ? 'SMS' : 'e-mail'}</b> para <b style={{ color: t.text }}>{canal === 'sms' ? (tel || '(11) 9 0000-0000') : (email || 'voce@email.com')}</b>.</Sub>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
            {code.map((d, i) => (
              <input key={i} ref={refs[i]} value={d} onChange={e => setDigit(i, e.target.value)} maxLength={1} inputMode="numeric"
                style={{ width: 64, height: 72, textAlign: 'center', fontSize: 30, fontWeight: 800, fontFamily: 'Bricolage Grotesque, sans-serif', color: t.text, background: t.surfaceAlt, border: `1.5px solid ${d ? t.accent : t.border}`, borderRadius: 18, outline: 'none' }} />
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: t.textTer }}>Não chegou? <span style={{ color: t.accent, fontWeight: 700 }}>Reenviar em 0:28</span></div>
          <div style={{ flex: 1 }} />
          <Btn full size="lg" onClick={() => go('home')}>Criar conta e ver meu pão</Btn>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { InstallScreen, LoginScreen, OnboardingScreen });
