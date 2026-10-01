/* ============================================================
   Login social — L4 Cadastro "Quase lá" · L5 Confirmar e-mail (Facebook) · L6 Encontramos sua conta
   ============================================================ */

function SADots({ total = 3, current = 0 }) {
  const t = useT();
  return <div aria-label={`Passo ${current + 1} de ${total}`} style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '4px 0 16px' }}>{Array.from({ length: total }).map((_, i) => <div key={i} style={{ width: i === current ? 22 : 7, height: 7, borderRadius: 99, background: i === current ? t.accent : t.border, transition: 'all .25s' }} />)}</div>;
}

/* ===== L4 — Passo 1 do cadastro social: "Quase lá, Marina!"
   st: fill · filled · ref · cpfInvalid · telInvalid · cpfTaken · telTaken · sending · expired
   Passos 2 e 3 = "Onde você mora?" / "Seu endereço" do OnboardingScreen (prop social). */
function SocialStep1({ st = 'fill', prefill = SOCIAL_PREFILL, onNext, onBack, embedded }) {
  const t = useT();
  const live = !!onNext;
  const first = prefill.name.split(' ')[0];
  const demo = st === 'fill'
    ? { cpf: '', nasc: '', tel: '' }
    : { cpf: st === 'cpfInvalid' ? '123.456.789-0' : '321.654.987-11', nasc: '22 / 07 / 1994', tel: st === 'telInvalid' ? '(11) 9 1234-56' : '(11) 9 8765-4321' };
  const [nome, setNome] = React.useState(prefill.name);
  const [cpf, setCpf] = React.useState(live ? '' : demo.cpf);
  const [nasc, setNasc] = React.useState(live ? '' : demo.nasc);
  const [tel, setTel] = React.useState(live ? '' : demo.tel);
  const [sending, setSending] = React.useState(st === 'sending');
  const ready = nome && cpf && nasc && tel;
  const next = () => { if (!live) return; setSending(true); setTimeout(() => { setSending(false); onNext(); }, 700); };
  const pname = SOCIAL_NAMES[prefill.provider];
  const Wrap = embedded ? React.Fragment : 'div';
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: embedded ? 0 : '6px 24px 22px', overflowY: embedded ? 'visible' : 'auto' }}>
      <SAKeyframes />
      {!embedded && <><SABack onClick={onBack} /><div style={{ marginTop: 16, marginBottom: 6 }}><SADots current={0} /></div></>}
      {st === 'expired' && (
        <div style={{ marginBottom: 16 }}>
          <SANotice title={`Sua conexão com o ${pname} expirou.`}>Seus dados digitados ficam aqui. Toque para continuar com o {pname} de novo.
            <div style={{ marginTop: 10 }}><SocialBtn provider={prefill.provider} /></div>
          </SANotice>
        </div>
      )}
      <SATitle size={26}>Quase lá, {first}!</SATitle>
      <SASub style={{ marginBottom: 18 }}>Faltam só uns dados. O CPF vai na nota e no pagamento; o celular, pros avisos de entrega.</SASub>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SAProviderPill provider={prefill.provider} email={prefill.email} />
        <SAField label="Nome completo" icon="user" value={nome} onChange={setNome} hint={`Veio do ${pname}. Pode ajustar.`} />
        <div>
          <SAField label="CPF" icon="card" type="tel" value={cpf} onChange={setCpf} placeholder="000.000.000-00" error={st === 'cpfInvalid' ? 'Esse CPF não parece completo. Confira os 11 números.' : null} />
          {st === 'cpfTaken' && (
            <div style={{ marginTop: 10 }}>
              <SANotice title="Esse CPF já tem uma conta.">Entre nela e conecte o {pname} depois, em Perfil › Minha conta.
                <div style={{ marginTop: 10 }}><Btn size="sm" icon="user">Entrar na minha conta</Btn></div>
              </SANotice>
            </div>
          )}
        </div>
        <SAField label="Data de nascimento" icon="calendar" type="tel" value={nasc} onChange={setNasc} placeholder="DD / MM / AAAA" />
        <SAField label="Celular" icon="phone" type="tel" value={tel} onChange={setTel} placeholder="(11) 9 0000-0000"
          error={st === 'telInvalid' ? 'Faltam números. O celular tem DDD + 9 dígitos.' : st === 'telTaken' ? 'Esse celular já está em outro cadastro. Use outro número ou fale com o suporte.' : null}
          hint="Só pra avisos de entrega. Nada de spam." />
      </div>
      {REFERRAL_CFG.ativo && (st === 'ref'
        ? <div style={{ marginTop: 16 }}><RefBadge bonus={REFERRAL_CFG.bonusAmigo} onChange={false} /></div>
        : <div style={{ marginTop: 6 }}><SALink icon="ticket">Tenho um código de indicação</SALink></div>)}
      <div style={{ flex: 1, minHeight: 20 }} />
      {sending
        ? <Btn full size="lg" disabled style={{ opacity: 0.8 }}><SASpinner size={17} color="#FBF3E4" track="rgba(251,243,228,0.3)" />Salvando…</Btn>
        : <Btn full size="lg" disabled={live ? !ready : (st === 'fill' || st === 'cpfInvalid' || st === 'telInvalid' || st === 'cpfTaken' || st === 'telTaken')} onClick={next}>Continuar</Btn>}
    </div>
  );
}

/* ===== L5 — Confirmar e-mail (primeiro acesso pelo Facebook)
   st: prefilled · empty · sending · code · codeWrong · codeExpired · tooMany */
function SAEmailConfirm({ st = 'prefilled', onDone, onBack }) {
  const t = useT();
  const live = !!onDone;
  const [step, setStep] = React.useState(['code', 'codeWrong', 'codeExpired', 'tooMany'].includes(st) ? 'code' : 'email');
  const [email, setEmail] = React.useState(st === 'empty' ? '' : SOCIAL_PREFILL_FB.email);
  const [sending, setSending] = React.useState(st === 'sending');
  const [code, setCode] = React.useState(st === 'codeWrong' ? ['4', '8', '1', '9'] : st === 'code' && !live ? ['2', '7', '', ''] : ['', '', '', '']);
  const send = () => { if (!live) return; setSending(true); setTimeout(() => { setSending(false); setStep('code'); }, 700); };
  const fromFb = st !== 'empty';

  if (step === 'email') return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '6px 24px 22px' }}>
      <SABack onClick={onBack} />
      <div style={{ marginTop: 26 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px 6px 8px', borderRadius: 999, background: t.surface, border: `1px solid ${t.border2}`, fontSize: 12.5, fontWeight: 700, color: t.textSec, marginBottom: 16 }}><FacebookF size={18} />Conectado com o Facebook</div>
        <SATitle>{fromFb ? 'Confirme seu e-mail.' : 'Qual é o seu e-mail?'}</SATitle>
        <SASub style={{ marginBottom: 24 }}>{fromFb
          ? <>Veio do Facebook: <b style={{ color: t.text }}>{SOCIAL_PREFILL_FB.email}</b>. Se preferir outro, é só trocar. Mandamos um código pra confirmar.</>
          : 'O Facebook não compartilhou seu e-mail. Precisamos dele pros avisos e pra você poder entrar de outros jeitos.'}</SASub>
        <SAField label="E-mail" icon="mail" value={email} onChange={setEmail} placeholder="voce@email.com" focus={!fromFb} disabled={sending} />
      </div>
      <div style={{ flex: 1, minHeight: 24 }} />
      {sending
        ? <Btn full size="lg" disabled style={{ opacity: 0.8 }}><SASpinner size={17} color="#FBF3E4" track="rgba(251,243,228,0.3)" />Enviando código…</Btn>
        : <Btn full size="lg" disabled={!email} onClick={send}>Enviar código</Btn>}
    </div>
  );

  const wrong = st === 'codeWrong', expired = st === 'codeExpired', many = st === 'tooMany';
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '6px 24px 22px' }}>
      <SAKeyframes />
      <SABack onClick={() => live ? setStep('email') : null} />
      <div style={{ marginTop: 26 }}>
        <SATitle>Digite o código.</SATitle>
        <SASub style={{ marginBottom: 24 }}>Enviamos 4 dígitos por e-mail para <b style={{ color: t.text }}>{email || SOCIAL_PREFILL_FB.email}</b>.</SASub>
        <SACodeBoxes value={code} onChange={live ? setCode : undefined} error={wrong} disabled={many || expired} />
        <div style={{ marginTop: 16 }}>
          {wrong && <SANotice tone="danger" title="Código não confere.">Confira os números no e-mail. Você ainda tem 2 tentativas.</SANotice>}
          {expired && <SANotice title="Esse código expirou.">Códigos valem por 10 minutos. Mandamos um novo num toque.</SANotice>}
          {many && <SANotice tone="danger" title="Muitas tentativas por agora.">Por segurança, comece de novo daqui a pouco.</SANotice>}
          {!wrong && !expired && !many && <div style={{ textAlign: 'center', fontSize: 13, color: t.textTer }}>Não chegou? <span style={{ color: t.accent, fontWeight: 700 }}>Reenviar em 0:28</span></div>}
        </div>
        {!many && <div style={{ textAlign: 'center' }}><SALink onClick={() => live && setStep('email')}>Trocar e-mail</SALink></div>}
      </div>
      <div style={{ flex: 1, minHeight: 24 }} />
      {expired ? <Btn full size="lg" icon="refresh">Enviar um novo código</Btn>
        : many ? <Btn full size="lg" onClick={onBack}>Começar de novo</Btn>
        : <Btn full size="lg" disabled={!live && code.some(d => !d) && !wrong} onClick={() => live && onDone()}>Confirmar</Btn>}
    </div>
  );
}

/* ===== L6 — "Encontramos sua conta" (vincular a uma conta que já existe)
   st: both · codeOnly · wrongPw · code · done */
function SAFoundAccount({ st = 'both', provider = 'google', onDone, onBack, go }) {
  const t = useT();
  const live = !!onDone;
  const [mode, setMode] = React.useState(st === 'code' ? 'code' : 'pick');
  const [pw, setPw] = React.useState(st === 'wrongPw' ? 'pao1234' : '');
  const [show, setShow] = React.useState(false);
  const [code, setCode] = React.useState(st === 'code' && !live ? ['5', '0', '3', ''] : ['', '', '', '']);
  const canPw = st === 'codeOnly' ? false : SOCIAL_LINK.canUsePassword;
  const pname = SOCIAL_NAMES[provider];

  if (st === 'done') return (
    <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <RefFauxHome />
      <RefToast msg={`${pname} conectado! Da próxima vez é só um toque.`} />
    </div>
  );

  const Head = ({ sub }) => (
    <>
      <div style={{ position: 'relative', width: 64, height: 64, marginBottom: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: t.goldSoft, color: t.accent, display: 'grid', placeItems: 'center' }}><Icon name="shield" size={30} stroke={2} /></div>
        <div style={{ position: 'absolute', right: -8, bottom: -6, width: 30, height: 30, borderRadius: 10, background: '#FFFFFF', border: `1px solid ${t.border}`, display: 'grid', placeItems: 'center' }}><ProviderLogo provider={provider} size={16} /></div>
      </div>
      <SATitle>{mode === 'code' ? 'Digite o código.' : 'Encontramos sua conta.'}</SATitle>
      <SASub style={{ marginBottom: 22 }}>{sub}</SASub>
    </>
  );

  if (mode === 'code') return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '6px 24px 22px' }}>
      <SABack onClick={() => live ? setMode('pick') : null} />
      <div style={{ marginTop: 24 }}>
        <Head sub={<>Enviamos 4 dígitos para <b style={{ color: t.text }}>{SOCIAL_LINK.maskedEmail}</b>, o e-mail da sua conta. É só pra confirmar que é você.</>} />
        <SACodeBoxes value={code} onChange={live ? setCode : undefined} />
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: t.textTer }}>Não chegou? <span style={{ color: t.accent, fontWeight: 700 }}>Reenviar em 0:28</span></div>
      </div>
      <div style={{ flex: 1, minHeight: 24 }} />
      <Btn full size="lg" onClick={() => live && onDone()}>Confirmar e conectar</Btn>
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '6px 24px 22px', overflowY: 'auto' }}>
      <SAKeyframes />
      <SABack onClick={onBack} />
      <div style={{ marginTop: 24 }}>
        <Head sub={<>Já existe uma conta com <b style={{ color: t.text }}>{SOCIAL_LINK.maskedEmail}</b>. Confirme que é você para conectar o {pname}. Seus pãezins e pedidos continuam lá.</>} />
        {canPw ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SAField label="Confirmar com minha senha" icon="lock" type={show ? 'text' : 'password'} value={pw} onChange={live ? setPw : undefined} placeholder="Senha da sua conta"
              action={<SAShow on={show} onClick={() => setShow(!show)} />}
              error={st === 'wrongPw' ? 'Senha não confere. Tente de novo — ou receba um código no e-mail.' : null} />
            <Btn full size="lg" disabled={!live && !pw} onClick={() => live && onDone()}>Confirmar e conectar</Btn>
            <div style={{ textAlign: 'center', marginTop: -4 }}><SALink>Esqueci minha senha</SALink></div>
            <SADivider label="ou" />
            <Btn variant="ghost" full size="lg" icon="mail" onClick={() => setMode('code')}>Receber código no e-mail</Btn>
          </div>
        ) : (
          <Btn full size="lg" icon="mail" onClick={() => setMode('code')}>Receber código no e-mail</Btn>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 20 }} />
      <div style={{ fontSize: 12, color: t.textTer, textAlign: 'center', lineHeight: 1.5, marginTop: 16 }}>Não é você? <span style={{ color: t.accent, fontWeight: 700 }}>Fale com o suporte</span></div>
    </div>
  );
}

Object.assign(window, { SADots, SocialStep1, SAEmailConfirm, SAFoundAccount });
