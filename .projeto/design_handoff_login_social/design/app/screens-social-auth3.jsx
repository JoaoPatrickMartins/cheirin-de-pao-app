/* ============================================================
   Login social — L7 Contas conectadas · L8 Segurança sem senha + Criar senha ·
   L9 Páginas públicas · A1 linha "Acesso" (admin)
   ============================================================ */

function SASecLabel({ children }) {
  const t = useT();
  return <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: t.textTer, textTransform: 'uppercase', margin: '0 4px 8px' }}>{children}</div>;
}
function SAHead({ label }) {
  const t = useT();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '-12px 0 -4px' }}>
      <SASecLabel>{label}</SASecLabel>
      <button aria-label={'Editar ' + label.toLowerCase()} style={{ minHeight: 44, padding: '0 4px', background: 'none', border: 'none', color: t.accent, display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Hanken Grotesk' }}><Icon name="edit" size={15} />Editar</button>
    </div>
  );
}

/* Linha de provedor em "Contas conectadas"
   state: off · on · connecting */
function ConnectedRow({ provider, email, state = 'off', last, onConnect, onDisconnect }) {
  const t = useT();
  const name = SOCIAL_NAMES[provider];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: last ? 'none' : `1px solid ${t.border2}`, minHeight: 64 }}>
      <ProviderTile provider={provider} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, color: t.text, display: 'flex', alignItems: 'center', gap: 7 }}>{name}{state === 'on' && <Icon name="check" size={15} color={t.good} stroke={2.6} />}</div>
        <div style={{ fontSize: 12.5, color: state === 'on' ? t.textSec : t.textTer, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{state === 'on' ? email : state === 'connecting' ? 'Conectando…' : 'Não conectado'}</div>
      </div>
      {state === 'on' && <button onClick={onDisconnect} style={{ minHeight: 44, padding: '0 6px', background: 'none', border: 'none', color: t.textSec, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Hanken Grotesk' }}>Desconectar</button>}
      {state === 'off' && <Btn size="sm" variant="soft" onClick={onConnect} style={{ minHeight: 44 }}>Conectar</Btn>}
      {state === 'connecting' && <div style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', color: t.accent }}><SASpinner size={18} color={t.accent} track={t.goldSoft} /></div>}
    </div>
  );
}

function SADisconnectSheet({ provider = 'google', hasPw = true, onCancel, onConfirm }) {
  const t = useT();
  const name = SOCIAL_NAMES[provider];
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(30,18,7,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 20 }}>
      <div role="dialog" aria-modal="true" aria-label={`Desconectar o ${name}?`} style={{ width: '100%', background: t.appBg, borderRadius: '26px 26px 0 0', padding: '10px 20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ width: 40, height: 5, borderRadius: 9, background: t.border, margin: '0 auto 8px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ProviderTile provider={provider} size={44} />
          <div style={{ fontFamily: SA_H, fontWeight: 700, fontSize: 21, color: t.text, letterSpacing: '-0.02em' }}>Desconectar o {name}?</div>
        </div>
        <div style={{ fontSize: 14, color: t.textSec, lineHeight: 1.5 }}>Você continua entrando com código no e-mail{hasPw ? ' ou com sua senha' : ''}. Dá pra conectar de novo quando quiser.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
          <Btn full size="lg" icon="unlink" onClick={onConfirm}>Desconectar</Btn>
          <Btn full variant="soft" size="lg" onClick={onCancel}>Manter conectado</Btn>
        </div>
      </div>
    </div>
  );
}

/* ===== L7 + L8 — Perfil › Minha conta
   conn: none · google · both · connecting · connected · taken
   pw: true (tem senha) · false (entra com o Google) · sheet: mostra confirmação */
function MyAccount({ conn = 'google', pw = true, sheet = false, go }) {
  const t = useT();
  const live = !!go;
  const [c, setC] = React.useState(conn);
  const [showSheet, setShowSheet] = React.useState(sheet);
  const [toast, setToast] = React.useState(conn === 'connected' ? 'Facebook conectado! Da próxima vez é só um toque.' : null);
  const say = m => { setToast(m); setTimeout(() => setToast(null), 2200); };
  const g = ['google', 'both', 'connecting', 'connected', 'taken'].includes(c) ? 'on' : 'off';
  const f = ['both', 'connected'].includes(c) ? 'on' : c === 'connecting' ? 'connecting' : 'off';
  const connectFb = () => { if (!live) return; setC('connecting'); setTimeout(() => { setC('both'); say('Facebook conectado! Da próxima vez é só um toque.'); }, 1100); };
  const connectG = () => { if (!live) return; setC('google'); say('Google conectado! Da próxima vez é só um toque.'); };
  const via = g === 'on' ? 'Google' : f === 'on' ? 'Facebook' : null;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0 }}>
      <SAKeyframes />
      <AppBar title="Minha conta" onBack={() => live && go('profile')} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div><SAHead label="Dados pessoais" />
          <Card pad={16} style={{ paddingTop: 8, paddingBottom: 8 }}>
            <Row label="Nome" value="Marina Ribeiro" />
            <Row label="Nascimento" value="22/07/1994" />
            <Row label="CPF" value="•••.654.987-••" />
          </Card>
        </div>
        <div><SAHead label="Contato" />
          <Card pad={16} style={{ paddingTop: 8, paddingBottom: 8 }}>
            <Row label="Celular" value="(11) 9 8765-4321" />
            <Row label="E-mail" value="marina.ribeiro@gmail.com" />
          </Card>
        </div>
        <div><SASecLabel>Contas conectadas</SASecLabel>
          <Card pad={0}>
            <ConnectedRow provider="google" email={CONNECTED_ACCOUNTS[0].email} state={g} onConnect={connectG} onDisconnect={() => setShowSheet(true)} />
            <ConnectedRow provider="facebook" email="Marina Ribeiro" state={f} last onConnect={connectFb} onDisconnect={() => live && (setC('google'), say('Facebook desconectado.'))} />
          </Card>
          {c === 'taken' && <div style={{ marginTop: 10 }}><SANotice tone="danger" title="Essa conta Facebook já está ligada a outro cadastro.">Desconecte-a do outro cadastro primeiro, ou use outra conta.</SANotice></div>}
          <div style={{ fontSize: 12, color: t.textTer, lineHeight: 1.5, margin: '8px 4px 0' }}>Entre com um toque. Desconectar não tranca sua conta: o código no e-mail sempre funciona.</div>
        </div>
        <div><SASecLabel>Segurança</SASecLabel>
          <Card pad={14} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: t.surface2, color: t.textSec, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={pw ? 'lock' : 'shield'} size={19} /></div>
            {pw ? (
              <>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14.5, color: t.text }}>Senha</div><div style={{ fontSize: 13, color: t.textSec, marginTop: 2, letterSpacing: '0.1em' }}>••••••••</div></div>
                <Btn size="sm" variant="soft" style={{ minHeight: 44 }}>Trocar</Btn>
              </>
            ) : (
              <>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 14.5, color: t.text }}>{via ? `Você entra com o ${via}` : 'Você entra com código no e-mail'}</div><div style={{ fontSize: 12.5, color: t.textSec, marginTop: 2, lineHeight: 1.4 }}>Ou com código no e-mail. Quer uma senha também?</div></div>
                <Btn size="sm" style={{ minHeight: 44 }} onClick={() => live && go('createPw')}>Criar senha</Btn>
              </>
            )}
          </Card>
        </div>
        <div><SASecLabel>Endereço</SASecLabel>
          <Card pad={16} style={{ paddingTop: 8, paddingBottom: 8 }}>
            <Row label="Condomínio" value="Parque das Flores" />
            <Row label="Endereço" value="Bloco C, ap. 11" />
          </Card>
        </div>
      </div>
      {toast && <RefToast msg={toast} />}
      {showSheet && <SADisconnectSheet provider="google" hasPw={pw} onCancel={() => setShowSheet(false)} onConfirm={() => { setShowSheet(false); if (live) { setC('none'); say('Google desconectado. O código no e-mail continua valendo.'); } }} />}
    </div>
  );
}

/* ===== L8 — "Criar senha" (variante de "Trocar senha", sem senha atual)
   st: empty · typing · mismatch · saving · done */
function CreatePassword({ st = 'empty', go }) {
  const t = useT();
  const live = !!go;
  const init = { empty: ['', ''], typing: ['pao2026', ''], mismatch: ['pao2026ok', 'pao2026k'], saving: ['pao2026ok', 'pao2026ok'] }[st] || ['', ''];
  const [a, setA] = React.useState(live ? '' : init[0]);
  const [b, setB] = React.useState(live ? '' : init[1]);
  const [show, setShow] = React.useState(false);
  const [phase, setPhase] = React.useState(st === 'done' ? 'done' : st === 'saving' ? 'saving' : 'form');
  const crit = [
    ['Pelo menos 8 caracteres', a.length >= 8],
    ['Letras e números', /[a-z]/i.test(a) && /\d/.test(a)],
    ['As duas senhas iguais', !!a && a === b],
  ];
  const ok = crit.every(c => c[1]);
  const save = () => { if (!live) return; setPhase('saving'); setTimeout(() => setPhase('done'), 800); };

  if (phase === 'done') return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '6px 24px 22px' }}>
      <div role="status" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 40 }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: t.goodSoft, color: t.good, display: 'grid', placeItems: 'center', marginBottom: 22 }}><Icon name="check" size={32} stroke={2.6} /></div>
        <SATitle>Senha criada.</SATitle>
        <SASub>Agora você entra do jeito que preferir: com o Google, com e-mail e senha ou com código no e-mail.</SASub>
      </div>
      <Btn full size="lg" onClick={() => live && go('account')}>Voltar para Minha conta</Btn>
    </div>
  );
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '6px 24px 22px', overflowY: 'auto' }}>
      <SABack onClick={() => live && go('account')} />
      <div style={{ marginTop: 24 }}>
        <SATitle>Criar senha.</SATitle>
        <SASub style={{ marginBottom: 24 }}>Opcional. Com senha, você também entra com e-mail e senha. O Google continua funcionando.</SASub>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SAField label="Nova senha" icon="lock" type={show ? 'text' : 'password'} value={a} onChange={live ? setA : undefined} placeholder="Crie uma senha" action={<SAShow on={show} onClick={() => setShow(!show)} />} focus={st === 'typing'} disabled={phase === 'saving'} />
          <SAField label="Confirme a nova senha" icon="lock" type={show ? 'text' : 'password'} value={b} onChange={live ? setB : undefined} placeholder="Repita a senha" error={st === 'mismatch' ? 'As senhas não estão iguais.' : null} disabled={phase === 'saving'} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          {crit.map(([l, v]) => <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 600, color: v ? t.good : t.textTer }}><span style={{ width: 20, height: 20, borderRadius: 99, background: v ? t.goodSoft : t.surface2, display: 'grid', placeItems: 'center' }}><Icon name={v ? 'check' : 'minus'} size={12} stroke={2.8} /></span>{l}</div>)}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 24 }} />
      {phase === 'saving'
        ? <Btn full size="lg" disabled style={{ opacity: 0.8 }}><SASpinner size={17} color="#FBF3E4" track="rgba(251,243,228,0.3)" />Criando senha…</Btn>
        : <Btn full size="lg" disabled={!ok} onClick={save}>Criar senha</Btn>}
    </div>
  );
}

/* ===== L9 — Páginas públicas (texto de exemplo; o real vem depois)
   kind: privacy · terms · delete */
const SA_LEGAL = {
  privacy: { title: 'Política de Privacidade', secs: [
    ['Quais dados guardamos', 'Texto de exemplo. Guardamos nome, CPF, data de nascimento, celular, e-mail e endereço de entrega, além do histórico de pedidos. Quando você entra com o Google ou o Facebook, recebemos só seu nome e e-mail.'],
    ['Para que usamos', 'Texto de exemplo. Para entregar seu pão na porta, emitir nota, processar pagamentos e avisar quando a entrega chegar. Não vendemos seus dados a ninguém.'],
    ['Com quem compartilhamos', 'Texto de exemplo. Com o meio de pagamento, com o entregador (só o necessário para a entrega) e com órgãos públicos quando a lei exigir.'],
    ['Seus direitos', 'Texto de exemplo. Você pode pedir para ver, corrigir ou excluir seus dados a qualquer momento, conforme a LGPD.'],
  ] },
  terms: { title: 'Termos de Uso', secs: [
    ['Sobre o Cheirin de Pão', 'Texto de exemplo. O Cheirin de Pão entrega pão fresco em condomínios parceiros, com pedidos pagos por pãezins (créditos) ou avulsos.'],
    ['Sua conta', 'Texto de exemplo. A conta é pessoal. Você pode entrar com e-mail e senha, código no e-mail, Google ou Facebook. Mantenha seus dados de contato atualizados.'],
    ['Pedidos e pãezins', 'Texto de exemplo. Pãezins comprados valem conforme as regras de cada combo. Pedidos podem ser alterados até o horário de corte informado no app.'],
    ['Cancelamento', 'Texto de exemplo. Você pode encerrar sua conta quando quiser, pelo suporte.'],
  ] },
  delete: { title: 'Exclusão de dados', secs: [] },
};
function LegalPage({ kind = 'privacy', go }) {
  const t = useT();
  const d = SA_LEGAL[kind];
  const steps = [['chat', 'Fale com o suporte pelo WhatsApp', 'Diga que quer excluir sua conta e seus dados.'], ['shield', 'Confirmamos que é você', 'Mandamos um código para o e-mail da conta.'], ['check', 'Pronto em até 15 dias', 'Avisamos por e-mail quando terminar. Dados fiscais ficam guardados pelo prazo da lei.']];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '6px 24px 0' }}><SABack onClick={() => go && go('profile')} /></div>
      <article style={{ flex: 1, overflowY: 'auto', padding: '22px 24px 32px' }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.14em', color: t.accent }}>CHEIRIN DE PÃO</div>
        <h1 style={{ fontFamily: SA_H, fontWeight: 700, fontSize: 30, letterSpacing: '-0.03em', color: t.text, lineHeight: 1.1, margin: '8px 0 0' }}>{d.title}</h1>
        <div style={{ fontSize: 12.5, color: t.textTer, marginTop: 10, fontWeight: 600 }}>Atualizado em 30/09/2026</div>
        {kind === 'delete' ? (
          <>
            <p style={{ fontSize: 15, lineHeight: 1.65, color: t.text, marginTop: 20 }}>Texto de exemplo. Você pode pedir a exclusão da sua conta e dos seus dados a qualquer momento — inclusive se entrou com o Google ou o Facebook.</p>
            <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
              {steps.map(([ic, h, p], i) => (
                <li key={h} style={{ display: 'flex', gap: 13, alignItems: 'flex-start', background: t.surface, border: `1px solid ${t.border2}`, borderRadius: 18, padding: 14, boxShadow: t.shadowSoft }}>
                  <div style={{ width: 34, height: 34, borderRadius: 11, background: t.espresso, color: t.gold, display: 'grid', placeItems: 'center', flexShrink: 0, fontFamily: SA_H, fontWeight: 800, fontSize: 15 }}>{i + 1}</div>
                  <div><div style={{ fontWeight: 800, fontSize: 14.5, color: t.text }}>{h}</div><div style={{ fontSize: 13.5, color: t.textSec, marginTop: 3, lineHeight: 1.5 }}>{p}</div></div>
                </li>
              ))}
            </ol>
            <div style={{ marginTop: 22 }}><Btn full size="lg" icon="chat">Falar com o suporte no WhatsApp</Btn></div>
          </>
        ) : d.secs.map(([h, p]) => (
          <section key={h} style={{ marginTop: 26 }}>
            <h2 style={{ fontFamily: SA_H, fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: t.text }}>{h}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.65, color: t.text, marginTop: 8, textWrap: 'pretty' }}>{p}</p>
          </section>
        ))}
        <div style={{ marginTop: 30, paddingTop: 18, borderTop: `1px solid ${t.border}`, fontSize: 13.5, color: t.textSec, lineHeight: 1.7 }}>
          Dúvidas? Fale com a gente:<br />
          <a href="mailto:suporte@cheirindepao.com.br" style={{ color: t.accent, fontWeight: 700 }}>suporte@cheirindepao.com.br</a><br />
          <a href="#whatsapp" style={{ color: t.accent, fontWeight: 700 }}>WhatsApp (11) 9 0000-0000</a>
        </div>
      </article>
    </div>
  );
}

/* Hub "Privacidade e termos" (Perfil › Ajuda) */
function LegalHub({ go }) {
  const t = useT();
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <AppBar title="Privacidade e termos" onBack={() => go && go('profile')} />
      <div style={{ padding: '0 20px' }}>
        <Card pad={0}>
          <ProfRow ic="shield" title="Política de Privacidade" onClick={() => go && go('legal-privacy')} />
          <ProfRow ic="doc" title="Termos de Uso" onClick={() => go && go('legal-terms')} />
          <ProfRow ic="trash" title="Exclusão de dados" desc="Como pedir para apagar sua conta" onClick={() => go && go('legal-delete')} last />
        </Card>
      </div>
    </div>
  );
}

/* ===== A1 — linha "Acesso" no card Cadastro (admin) */
const SA_ACCESS = { google: 'Google', facebook: 'Facebook', senha: 'E-mail e senha', codigo: 'Código no e-mail' };
function SAAccessRow({ acesso = ['google', 'senha'] }) {
  const t = useT();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 0' }}>
      <span style={{ fontSize: 13.5, color: t.textSec, fontWeight: 600, paddingTop: 3 }}>Acesso</span>
      <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
        {acesso.map(a => (
          <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 7px', borderRadius: 999, background: t.surface2, color: t.text, fontSize: 12, fontWeight: 700 }}>
            {a === 'google' || a === 'facebook' ? <ProviderLogo provider={a} size={13} /> : <Icon name={a === 'senha' ? 'lock' : 'mail'} size={13} color={t.textSec} stroke={2.2} />}
            {SA_ACCESS[a]}
          </span>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { SASecLabel, ConnectedRow, SADisconnectSheet, MyAccount, CreatePassword, SA_LEGAL, LegalPage, LegalHub, SA_ACCESS, SAAccessRow });
