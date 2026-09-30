/* ============================================================
   Login social — kit reutilizável + L1 Login · L2 Entrada do cadastro · L3 Retorno
   ============================================================ */
const SA_H = 'Bricolage Grotesque, sans-serif';

/* Keyframes da feature (injetadas uma vez) */
function SAKeyframes() {
  return <style>{'@keyframes saSpin{to{transform:rotate(360deg)}}@keyframes saBreath{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.06);opacity:.82}}@keyframes saRise{0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:none}}'}</style>;
}

/* ---------- Logos oficiais (não alterar cores nem proporção) ---------- */
function GoogleG({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
/* Facebook "f" em círculo. color = cor do círculo (o "f" é vazado). */
function FacebookF({ size = 20, color = '#1877F2' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fill={color} d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07" />
    </svg>
  );
}
function ProviderLogo({ provider, size = 20, onBlue }) {
  return provider === 'google' ? <GoogleG size={size} /> : <FacebookF size={size} color={onBlue ? '#FFFFFF' : '#1877F2'} />;
}
/* Tile quadrado com o logo (listas e cards) */
function ProviderTile({ provider, size = 40 }) {
  const t = useT();
  return <div style={{ width: size, height: size, borderRadius: 12, background: '#FFFFFF', border: `1px solid ${t.border}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}><ProviderLogo provider={provider} size={size * 0.5} /></div>;
}

function SASpinner({ size = 18, color = 'currentColor', track = 'rgba(0,0,0,0.12)' }) {
  return <span aria-hidden="true" style={{ width: size, height: size, borderRadius: 99, border: `2.5px solid ${track}`, borderTopColor: color, animation: 'saSpin .8s linear infinite', flexShrink: 0, display: 'inline-block' }} />;
}

/* ---------- Botão do provedor ----------
   Google: branco, borda #747775, texto #1F1F1F, Roboto Medium (diretriz do Google).
   Facebook: #1877F2, texto branco. Mesma geometria do Btn lg (raio 16, 54 px). */
function SocialBtn({ provider, state = 'idle', onClick }) {
  const g = provider === 'google';
  const loading = state === 'loading';
  const disabled = state === 'disabled';
  const name = SOCIAL_NAMES[provider];
  return (
    <button onClick={loading || disabled ? undefined : onClick} disabled={disabled} aria-busy={loading || undefined}
      style={{ width: '100%', minHeight: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '0 18px', borderRadius: 16, cursor: loading || disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1, transition: 'opacity .15s',
        background: g ? '#FFFFFF' : '#1877F2', color: g ? '#1F1F1F' : '#FFFFFF', border: g ? '1px solid #747775' : '1px solid #1877F2',
        fontFamily: g ? 'Roboto, Hanken Grotesk, sans-serif' : 'Hanken Grotesk, sans-serif', fontWeight: g ? 500 : 700, fontSize: 15.5, letterSpacing: g ? '0.01em' : '-0.01em' }}>
      {loading ? <SASpinner size={19} color={g ? '#4285F4' : '#FFFFFF'} track={g ? '#E3E3E3' : 'rgba(255,255,255,0.35)'} /> : <ProviderLogo provider={provider} size={20} onBlue={!g} />}
      <span>{loading ? `Abrindo o ${name}…` : `Continuar com o ${name}`}</span>
    </button>
  );
}

/* Aviso no lugar do botão do Google, dentro do navegador do Instagram/Facebook */
function SAInAppNotice({ copied }) {
  const t = useT();
  return (
    <div role="note" style={{ borderRadius: 16, border: `1.5px dashed ${t.border}`, background: t.surface, padding: '13px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ width: 36, height: 36, borderRadius: 11, background: '#FFFFFF', border: `1px solid ${t.border}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}><GoogleG size={18} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: t.text }}>Para entrar com o Google, abra no navegador</div>
        <div style={{ fontSize: 12.5, color: t.textSec, marginTop: 3, lineHeight: 1.45 }}>O Google não deixa entrar por aqui. Toque em <b style={{ color: t.text }}>•••</b> e em “Abrir no navegador” — ou copie o link.</div>
        <button style={{ marginTop: 8, minHeight: 44, padding: '0 14px', borderRadius: 12, border: 'none', background: t.surface2, color: t.text, fontWeight: 700, fontSize: 13, fontFamily: 'Hanken Grotesk', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <Icon name={copied ? 'check' : 'copy'} size={16} color={copied ? t.good : 'currentColor'} stroke={2.2} />{copied ? 'Link copiado' : 'Copiar link'}
        </button>
      </div>
    </div>
  );
}

function SADivider({ label = 'ou com e-mail' }) {
  const t = useT();
  return (
    <div role="separator" style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
      <div style={{ flex: 1, height: 1, background: t.border }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: t.textTer, letterSpacing: '0.02em' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: t.border }} />
    </div>
  );
}

function SAConsent({ style }) {
  const t = useT();
  const a = { color: t.accent, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 };
  return <div style={{ fontSize: 12, color: t.textTer, lineHeight: 1.5, textAlign: 'center', textWrap: 'pretty', ...style }}>Ao continuar, você concorda com os <a href="#termos" style={a}>Termos de Uso</a> e a <a href="#privacidade" style={a}>Política de Privacidade</a>.</div>;
}

/* Pill/card do provedor com o e-mail travado */
function SAProviderPill({ provider = 'google', email }) {
  const t = useT();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 18, padding: '11px 14px', boxShadow: t.shadowSoft }}>
      <ProviderTile provider={provider} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
        <div style={{ fontSize: 12, color: t.textSec, marginTop: 1 }}>via {SOCIAL_NAMES[provider]} · e-mail confirmado</div>
      </div>
      <Icon name="lock" size={17} color={t.textTer} />
    </div>
  );
}

/* Banner de aviso (nunca culpa o cliente) */
function SANotice({ title, children, tone = 'warn', action }) {
  const t = useT();
  const c = tone === 'danger' ? t.danger : tone === 'good' ? t.good : t.accent;
  const bg = tone === 'danger' ? t.dangerSoft : tone === 'good' ? t.goodSoft : t.goldSoft;
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 16, background: bg, animation: 'saRise .25s ease' }}>
      <Icon name={tone === 'good' ? 'check' : 'alert'} size={18} color={c} stroke={2.2} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ fontWeight: 800, fontSize: 13.5, color: t.text }}>{title}</div>}
        {children && <div style={{ fontSize: 12.5, color: t.textSec, marginTop: title ? 2 : 0, lineHeight: 1.45 }}>{children}</div>}
        {action}
      </div>
    </div>
  );
}

function SABack({ onClick }) {
  const t = useT();
  return <button onClick={onClick} aria-label="Voltar" style={{ background: t.surface2, border: 'none', width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', cursor: 'pointer', color: t.text, flexShrink: 0 }}><Icon name="arrowL" size={20} /></button>;
}
function SATitle({ children, size = 28 }) {
  const t = useT();
  return <div style={{ fontFamily: SA_H, fontWeight: 700, fontSize: size, letterSpacing: '-0.03em', color: t.text, lineHeight: 1.12, textWrap: 'pretty' }}>{children}</div>;
}
function SASub({ children, style }) {
  const t = useT();
  return <div style={{ fontSize: 14.5, color: t.textSec, marginTop: 10, lineHeight: 1.5, textWrap: 'pretty', ...style }}>{children}</div>;
}
function SALink({ children, onClick, icon, center }) {
  const t = useT();
  return <button onClick={onClick} style={{ minHeight: 44, padding: '0 4px', background: 'none', border: 'none', color: t.accent, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'Hanken Grotesk', display: 'inline-flex', alignItems: 'center', gap: 7, alignSelf: center ? 'center' : 'auto' }}>{icon && <Icon name={icon} size={16} />}{children}</button>;
}

/* Campo com estado de erro/sucesso e ação à direita (ex.: Mostrar) */
function SAField({ label, value, placeholder, icon, type = 'text', error, hint, action, locked, onChange, focus, disabled }) {
  const t = useT();
  const [f, setF] = React.useState(false);
  const bc = error ? t.danger : (f || focus) ? t.accent : t.border;
  return (
    <label style={{ display: 'block', opacity: disabled ? 0.55 : 1 }}>
      {label && <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec, marginBottom: 7 }}>{label}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: locked ? t.surface2 : t.surfaceAlt, border: `1.5px solid ${bc}`, borderRadius: 14, padding: '0 14px', minHeight: 50 }}>
        {icon && <Icon name={icon} size={18} color={t.textTer} stroke={2} />}
        <input value={value ?? ''} onChange={e => onChange && onChange(e.target.value)} readOnly={!onChange} placeholder={placeholder} type={type} aria-invalid={!!error || undefined}
          onFocus={() => setF(true)} onBlur={() => setF(false)}
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: t.text, fontFamily: 'Hanken Grotesk', fontWeight: 500, minWidth: 0, padding: '13px 0' }} />
        {action}
        {locked && <Icon name="lock" size={16} color={t.textTer} />}
      </div>
      {error && <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12.5, color: t.danger, marginTop: 7, lineHeight: 1.4, fontWeight: 600 }}><Icon name="alert" size={14} stroke={2.2} style={{ flexShrink: 0, marginTop: 1 }} />{error}</div>}
      {!error && hint && <div style={{ fontSize: 11.5, color: t.textTer, marginTop: 6, lineHeight: 1.4 }}>{hint}</div>}
    </label>
  );
}
function SAShow({ on, onClick }) {
  const t = useT();
  return <button type="button" onClick={onClick} style={{ minHeight: 44, padding: '0 2px', background: 'none', border: 'none', color: t.accent, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Hanken Grotesk' }}>{on ? 'Ocultar' : 'Mostrar'}</button>;
}

/* Caixas do código de 4 dígitos (mesma geometria do cadastro) */
function SACodeBoxes({ value = ['', '', '', ''], error, disabled, onChange }) {
  const t = useT();
  const refs = [0, 1, 2, 3].map(() => React.useRef(null));
  const set = (i, v) => { if (!onChange || !/^\d?$/.test(v)) return; const n = [...value]; n[i] = v; onChange(n); if (v && i < 3) refs[i + 1].current?.focus(); };
  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', opacity: disabled ? 0.45 : 1 }}>
      {value.map((d, i) => (
        <input key={i} ref={refs[i]} value={d} onChange={e => set(i, e.target.value)} readOnly={!onChange || disabled} maxLength={1} inputMode="numeric" aria-label={`Dígito ${i + 1}`}
          style={{ width: 64, height: 72, textAlign: 'center', fontSize: 30, fontWeight: 800, fontFamily: SA_H, color: error ? t.danger : t.text, background: t.surfaceAlt, border: `1.5px solid ${error ? t.danger : d ? t.accent : t.border}`, borderRadius: 18, outline: 'none' }} />
      ))}
    </div>
  );
}

/* Bloco de botões sociais conforme provedores ligados e contexto */
function SASocialStack({ providers = SOCIAL_PROVIDERS, loading, inApp, onPick }) {
  const st = p => loading ? (loading === p ? 'loading' : 'disabled') : 'idle';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {providers.google && (inApp ? <SAInAppNotice /> : <SocialBtn provider="google" state={st('google')} onClick={() => onPick && onPick('google')} />)}
      {providers.facebook && <SocialBtn provider="facebook" state={st('facebook')} onClick={() => onPick && onPick('facebook')} />}
    </div>
  );
}

/* ===== L1 — Login com botões sociais
   st: both · google · none · loading · inapp · errCancel · errFail
   Interativo quando recebe go (modos: senha · e-mail do código · código) */
function LoginSocial({ st = 'both', go, onSocial }) {
  const t = useT();
  const live = !!go;
  const [mode, setMode] = React.useState('pw');
  const [show, setShow] = React.useState(false);
  const [email, setEmail] = React.useState(live ? '' : '');
  const [pw, setPw] = React.useState('');
  const [code, setCode] = React.useState(['', '', '', '']);
  const [loading, setLoading] = React.useState(st === 'loading' ? 'google' : null);
  const providers = st === 'google' ? { google: true, facebook: false } : st === 'none' ? { google: false, facebook: false } : live ? SOCIAL_PROVIDERS : { google: true, facebook: true };
  const anySocial = providers.google || providers.facebook;
  const err = { errCancel: 'Você cancelou o login com o Google.', errFail: 'Não foi possível falar com o Google. Tente de novo.' }[st];
  const pick = p => { setLoading(p); if (live) setTimeout(() => { setLoading(null); onSocial && onSocial(p); }, 700); };
  const dis = !!loading;

  if (mode !== 'pw') return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 24px 24px', overflowY: 'auto' }}>
      <SABack onClick={() => setMode(mode === 'code' ? 'codeEmail' : 'pw')} />
      <div style={{ marginTop: 28 }}>
        {mode === 'codeEmail' ? (
          <>
            <SATitle>Entrar com código.</SATitle>
            <SASub style={{ marginBottom: 26 }}>Mandamos 4 dígitos pro seu e-mail. Sem senha pra lembrar.</SASub>
            <SAField label="E-mail" icon="mail" value={email} onChange={setEmail} placeholder="voce@email.com" />
            <div style={{ height: 18 }} />
            <Btn full size="lg" onClick={() => setMode('code')}>Enviar código</Btn>
          </>
        ) : (
          <>
            <SATitle>Digite o código.</SATitle>
            <SASub style={{ marginBottom: 26 }}>Enviamos 4 dígitos por e-mail para <b style={{ color: t.text }}>{email || 'voce@email.com'}</b>.</SASub>
            <SACodeBoxes value={code} onChange={setCode} />
            <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: t.textTer }}>Não chegou? <span style={{ color: t.accent, fontWeight: 700 }}>Reenviar em 0:28</span></div>
            <div style={{ height: 22 }} />
            <Btn full size="lg" onClick={() => go('home')}>Entrar</Btn>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 24px 22px', overflowY: 'auto' }}>
      <SAKeyframes />
      <SABack onClick={() => live && go('install')} />
      <div style={{ marginTop: 22 }}>
        <SATitle>Bom dia.<br />Bora entrar.</SATitle>
        <SASub>{anySocial ? 'O jeito mais rápido é com um toque. Se preferir, use seu e-mail — com senha ou com um código.' : 'Entre com seu e-mail e senha. Prefere não decorar senha? Dá pra entrar com um código no e-mail.'}</SASub>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 22 }}>
        {err && <SANotice title="Não deu certo desta vez.">{err}</SANotice>}
        {anySocial && <SASocialStack providers={providers} loading={loading} inApp={st === 'inapp'} onPick={pick} />}
        {anySocial && <SADivider />}
        <SAField label="E-mail" icon="mail" value={live ? email : ''} onChange={live ? setEmail : undefined} placeholder="voce@email.com" disabled={dis} />
        <SAField label="Senha" icon="lock" type={show ? 'text' : 'password'} value={live ? pw : ''} onChange={live ? setPw : undefined} placeholder="Sua senha" disabled={dis} action={<SAShow on={show} onClick={() => setShow(!show)} />} />
        <Btn full size="lg" disabled={dis} onClick={() => live && go('home')}>Entrar</Btn>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: -6, opacity: dis ? 0.45 : 1 }}>
          <SALink>Esqueci minha senha</SALink>
          <SALink onClick={() => setMode('codeEmail')}>Entrar com código no e-mail</SALink>
        </div>
        {anySocial && <SAConsent />}
      </div>
    </div>
  );
}

/* ===== L2 — Entrada do cadastro: "Como você quer criar sua conta?"
   st: ref · noref · google · inapp · loading
   Regra: sem provedor ligado, a tela não aparece (vai direto ao passo 1). */
function RegisterChoice({ st = 'ref', go, onSocial }) {
  const t = useT();
  const live = !!go;
  const [loading, setLoading] = React.useState(st === 'loading' ? 'facebook' : null);
  const providers = st === 'google' ? { google: true, facebook: false } : live ? SOCIAL_PROVIDERS : { google: true, facebook: true };
  const ref = st === 'ref' || st === 'loading' || (live && REFERRAL_CFG.ativo);
  const pick = p => { setLoading(p); if (live) setTimeout(() => { setLoading(null); onSocial && onSocial(p); }, 700); };
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 24px 22px', overflowY: 'auto' }}>
      <SAKeyframes />
      <SABack onClick={() => live && go('install')} />
      {ref && <div style={{ marginTop: 18 }}><RefBadge bonus={REFERRAL_CFG.bonusAmigo} onChange={false} /></div>}
      <div style={{ marginTop: ref ? 22 : 28 }}>
        <SATitle>Como você quer criar sua conta?</SATitle>
        <SASub>Crie em 1 minuto: a gente já puxa seu nome e e-mail, e você só completa o endereço.</SASub>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24 }}>
        <SASocialStack providers={providers} loading={loading} inApp={st === 'inapp'} onPick={pick} />
        <SADivider label="ou" />
        <Btn variant="ghost" full size="lg" icon="mail" disabled={!!loading} onClick={() => live && go('onboarding')}>Criar com e-mail</Btn>
        <SAConsent />
      </div>
      <div style={{ flex: 1, minHeight: 24 }} />
      <div style={{ textAlign: 'center', fontSize: 13.5, color: t.textSec }}>Já tem conta? <button onClick={() => live && go('login')} style={{ minHeight: 44, background: 'none', border: 'none', color: t.accent, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'Hanken Grotesk' }}>Entrar</button></div>
    </div>
  );
}

/* ===== L3a — Conectando (no app, enquanto espera o retorno) */
function SAConnecting({ provider = 'google', onCancel }) {
  const t = useT();
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 24px 24px' }}>
      <SAKeyframes />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 22 }}>
        <div style={{ position: 'relative', width: 112, height: 112 }}>
          <div style={{ width: 112, height: 112, borderRadius: '30%', background: t.espresso, display: 'grid', placeItems: 'center', animation: 'saBreath 2.2s ease-in-out infinite', boxShadow: t.shadow }}><BreadMark size={70} color={t.gold} /></div>
          <div style={{ position: 'absolute', right: -8, bottom: -8, width: 42, height: 42, borderRadius: 14, background: '#FFFFFF', border: `1px solid ${t.border}`, display: 'grid', placeItems: 'center', boxShadow: t.shadowSoft }}><ProviderLogo provider={provider} size={22} /></div>
        </div>
        <div role="status" aria-live="polite">
          <SATitle size={24}>Conectando com o {SOCIAL_NAMES[provider]}…</SATitle>
          <SASub>Termine na janela que abriu. A gente te espera aqui e entra sozinho.</SASub>
        </div>
      </div>
      <Btn variant="soft" full onClick={onCancel}>Cancelar</Btn>
    </div>
  );
}

/* ===== L3b — "Pode voltar ao app" (janela do Safari no iPhone — não é o app) */
function SASafariDone() {
  const t = useT();
  const ios = { font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif' };
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 64px', alignItems: 'center', padding: '6px 12px 10px', borderBottom: '1px solid rgba(0,0,0,0.1)', background: '#F6F6F6', fontFamily: ios.font }}>
        <span style={{ color: '#007AFF', fontSize: 17, fontWeight: 600 }}>OK</span>
        <div style={{ textAlign: 'center', fontSize: 13, color: '#1C1C1E', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><Icon name="lock" size={11} stroke={2.4} />cheirindepao.com.br</div>
        <span style={{ textAlign: 'right', color: '#007AFF', fontSize: 15 }}>aA</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center', background: t.appBg }}>
        <BreadMark size={40} color={t.gold} />
        <div style={{ width: 84, height: 84, borderRadius: 999, background: t.goodSoft, color: t.good, display: 'grid', placeItems: 'center', marginTop: 26 }}><Icon name="check" size={40} stroke={2.6} /></div>
        <div style={{ marginTop: 22 }}><SATitle size={30}>Pronto!</SATitle></div>
        <SASub style={{ maxWidth: 290 }}>Pode voltar ao app Cheirin de Pão — ele já está te esperando.</SASub>
        <div style={{ marginTop: 26, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 999, background: t.surface2, fontSize: 12.5, color: t.textSec, fontWeight: 600 }}><Icon name="arrowU" size={14} stroke={2.4} />Toque em <b style={{ color: t.text }}>OK</b> no canto da tela</div>
      </div>
    </div>
  );
}

/* ===== L3c — Erros de retorno
   kind: cancel · blocked · role · expired · provider · taken */
const SA_ERRORS = {
  cancel: { ic: 'x', tone: 'neutral', title: 'Tudo bem.', text: 'Você pode entrar de outro jeito: com o Facebook, com e-mail e senha ou com um código no e-mail.', cta: 'Voltar ao login' },
  blocked: { ic: 'ban', tone: 'danger', title: 'Conta bloqueada.', text: 'Fale com o suporte que a gente vê com você o que aconteceu.', cta: 'Falar com o suporte', ctaIc: 'chat', sec: 'Voltar ao login' },
  role: { ic: 'truck', tone: 'neutral', title: 'Essa conta entra com e-mail e senha.', text: 'Contas de entregador e da equipe não usam o Google. Entre com o e-mail e a senha de sempre.', cta: 'Entrar com e-mail' },
  expired: { ic: 'clock', tone: 'gold', title: 'Demorou um pouquinho.', text: 'A conexão com o Google expirou. Tente de novo — é só um toque.', cta: 'Tentar de novo', ctaIc: 'refresh', sec: 'Voltar ao login' },
  provider: { ic: 'alert', tone: 'gold', title: 'Não deu certo desta vez.', text: 'Não foi possível falar com o Google agora. Tente de novo em instantes, ou entre com seu e-mail.', cta: 'Tentar de novo', ctaIc: 'refresh', sec: 'Voltar ao login' },
  taken: { ic: 'link', tone: 'gold', title: 'Essa conta Google já está ligada a outro cadastro.', text: 'Para usar esta conta Google aqui, desconecte-a do outro cadastro primeiro — ou conecte outra conta Google.', cta: 'Voltar para Minha conta' },
};
function SAError({ kind = 'cancel', onPrimary, onSecondary }) {
  const t = useT();
  const e = SA_ERRORS[kind];
  const tone = { neutral: [t.surface2, t.textSec], danger: [t.dangerSoft, t.danger], gold: [t.goldSoft, t.accent] }[e.tone];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 24px 24px' }}>
      <SABack onClick={onSecondary} />
      <div role="alert" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 40 }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: tone[0], color: tone[1], display: 'grid', placeItems: 'center', marginBottom: 22 }}><Icon name={e.ic} size={30} stroke={2.1} /></div>
        <SATitle>{e.title}</SATitle>
        <SASub>{e.text}</SASub>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Btn full size="lg" icon={e.ctaIc} onClick={onPrimary}>{e.cta}</Btn>
        {e.sec && <SALink center onClick={onSecondary}>{e.sec}</SALink>}
      </div>
    </div>
  );
}

Object.assign(window, { SA_H, SAKeyframes, GoogleG, FacebookF, ProviderLogo, ProviderTile, SASpinner, SocialBtn, SAInAppNotice, SADivider, SAConsent, SAProviderPill, SANotice, SABack, SATitle, SASub, SALink, SAField, SAShow, SACodeBoxes, SASocialStack, LoginSocial, RegisterChoice, SAConnecting, SASafariDone, SA_ERRORS, SAError });
