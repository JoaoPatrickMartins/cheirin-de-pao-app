/* ============================================================
   Indique e Ganhe — CLIENTE · C2 Perfil · C3 Home · C4 Cadastro
   ============================================================ */

/* Linha do hub do Perfil (ícone em quadrado suave, título, descrição, chevron) */
function ProfRow({ ic, title, desc, right, onClick, last, tone }) {
  const t = useT();
  const gold = tone === 'gold';
  return (
    <button onClick={onClick} style={{ width: '100%', minHeight: 60, display: 'flex', alignItems: 'center', gap: 13, padding: '11px 14px', background: 'none', border: 'none', borderBottom: last ? 'none' : `1px solid ${t.border2}`, cursor: 'pointer', textAlign: 'left', fontFamily: 'Hanken Grotesk', color: t.text }}>
      <div style={{ width: 38, height: 38, borderRadius: 12, background: gold ? t.goldSoft : t.surface2, color: gold ? t.accent : t.textSec, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={ic} size={19} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>{title}</div>
        {desc && <div style={{ fontSize: 12.5, color: t.textSec, marginTop: 2 }}>{desc}</div>}
      </div>
      {right}
      <Icon name="chevR" size={18} color={t.textTer} />
    </button>
  );
}
function ProfLabel({ children }) {
  const t = useT();
  return <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: t.textTer, textTransform: 'uppercase', margin: '0 4px 8px' }}>{children}</div>;
}

/* ===== C2 — Perfil (hub) com a nova seção. st: normal · campaign · off */
function ProfileHub({ go = () => {}, st = 'normal' }) {
  const t = useT();
  const [notif, setNotif] = React.useState(true);
  const X = st === 'campaign' ? REFERRAL_CFG.recompensa * 2 : REFERRAL_CFG.recompensa;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '6px 20px 14px', fontFamily: RF_H, fontWeight: 800, fontSize: 28, letterSpacing: '-0.03em', color: t.text }}>Perfil</div>
      <div style={{ padding: '0 20px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Card pad={16} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 999, background: t.espresso, color: t.gold, display: 'grid', placeItems: 'center', fontFamily: RF_H, fontWeight: 800, fontSize: 20 }}>J</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: RF_H, fontWeight: 700, fontSize: 18, color: t.text, letterSpacing: '-0.02em' }}>João Silva</div>
            <div style={{ fontSize: 12.5, color: t.textSec, marginTop: 2 }}>Parque das Flores · Bloco B, ap. 42</div>
          </div>
        </Card>
        <div><ProfLabel>Pedidos</ProfLabel><Card pad={0}><ProfRow ic="clock" title="Meus pedidos" desc="Entregas e compras da Cestinha" onClick={() => go('history')} last /></Card></div>
        {st !== 'off' && (
          <div><ProfLabel>Indique e ganhe</ProfLabel>
            <Card pad={0}>
              <ProfRow ic="gift" tone="gold" title="Indique e ganhe" desc={`Ganhe ${X} pãezins por amigo`} onClick={() => go('referral')} last
                right={st === 'campaign' ? <Pill tone="gold"><Icon name="spark" size={11} stroke={2.6} />Semana em dobro</Pill> : <Pill tone="gold">novo</Pill>} />
            </Card>
          </div>
        )}
        <div><ProfLabel>Conta</ProfLabel>
          <Card pad={0}>
            <ProfRow ic="user" title="Minha conta" desc="Dados pessoais e endereço" />
            <ProfRow ic="card" title="Meus cartões" desc="Cartão •••• 4821" />
            <ProfRow ic="repeat" title="Compra automática" desc="Ligada · combo 30" />
            <ProfRow ic="pin" title="Meu gancho" desc="Instalado na porta" last />
          </Card>
        </div>
        <div><ProfLabel>Notificações</ProfLabel>
          <Card pad={0} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 14px' }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: t.surface2, color: t.textSec, display: 'grid', placeItems: 'center' }}><Icon name="bell" size={19} /></div>
            <div style={{ flex: 1, fontWeight: 700, fontSize: 14.5, color: t.text }}>Avisos no celular</div>
            <Switch on={notif} onChange={setNotif} />
          </Card>
        </div>
        <div><ProfLabel>Ajuda</ProfLabel>
          <Card pad={0}>
            <ProfRow ic="phone" title="Falar com o suporte" />
            <ProfRow ic="refresh" title="Rever tutorial" last />
          </Card>
        </div>
        <Btn variant="ghost" full icon="logout">Sair</Btn>
      </div>
    </div>
  );
}

/* ===== C3 — Card na Home. st: normal · campaign */
function RefHomeCard({ go = () => {}, st = 'normal', onClose }) {
  const t = useT();
  const camp = st === 'campaign';
  const X = camp ? REFERRAL_CFG.recompensa * 2 : REFERRAL_CFG.recompensa;
  return (
    <Card pad={14} style={{ position: 'relative', display: 'flex', gap: 13, alignItems: 'center', background: camp ? t.goldSoft : t.surface, border: `1px solid ${camp ? 'rgba(176,112,42,0.25)' : t.border2}` }}>
      <div style={{ width: 46, height: 46, borderRadius: 14, background: camp ? t.gold : t.goldSoft, color: camp ? t.onGold : t.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="gift" size={22} /></div>
      <div style={{ flex: 1, minWidth: 0, paddingRight: 22 }}>
        {camp && <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: t.accent, marginBottom: 3 }}>SEMANA EM DOBRO · ATÉ 11/10</div>}
        <div style={{ fontWeight: 800, fontSize: 14.5, color: t.text, lineHeight: 1.3 }}>Indique um vizinho, ganhe {X} pãezins</div>
        <div style={{ fontSize: 12.5, color: t.textSec, marginTop: 2, lineHeight: 1.4 }}>Quando o pão chegar na porta dele.</div>
        <button onClick={() => go('referral')} style={{ marginTop: 9, minHeight: 36, padding: '0 14px', borderRadius: 11, border: 'none', background: t.primaryBtn, color: t.primaryBtnText, fontWeight: 700, fontSize: 13, fontFamily: 'Hanken Grotesk', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>Indicar agora<Icon name="chevR" size={14} stroke={2.4} /></button>
      </div>
      <button onClick={onClose} aria-label="Fechar por 30 dias" style={{ position: 'absolute', top: 4, right: 4, width: 44, height: 44, background: 'none', border: 'none', cursor: 'pointer', color: t.textTer, display: 'grid', placeItems: 'center' }}><Icon name="x" size={17} stroke={2.2} /></button>
    </Card>
  );
}

/* Contexto na Home: ações rápidas → card → Além do Pãozin */
function RefHomeContext({ st = 'normal' }) {
  const t = useT();
  const [closed, setClosed] = React.useState(false);
  return (
    <div style={{ padding: '4px 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
        {[['plus', 'Comprar pãezins'], ['calendar', 'Pedido único'], ['repeat', 'Minha agenda']].map(([ic, l]) => (
          <Card key={l} pad={12} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, textAlign: 'center' }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: t.surface2, color: t.accent, display: 'grid', placeItems: 'center' }}><Icon name={ic} size={19} /></div>
            <span style={{ fontSize: 12, fontWeight: 700, color: t.text, lineHeight: 1.2 }}>{l}</span>
          </Card>
        ))}
      </div>
      {!closed ? <RefHomeCard st={st} onClose={() => setClosed(true)} /> : (
        <div style={{ fontSize: 12.5, color: t.textTer, textAlign: 'center', padding: 8 }}>Card fechado — volta em 30 dias.</div>
      )}
      <div style={{ opacity: 0.45 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontFamily: RF_H, fontWeight: 700, fontSize: 18, color: t.text, letterSpacing: '-0.02em' }}>Além do Pãozin</span>
          <span style={{ fontSize: 13, color: t.accent, fontWeight: 700 }}>Ver tudo</span>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>{[0, 1, 2].map(i => <div key={i} style={{ flex: 1, height: 110, borderRadius: 18, background: t.surface2 }} />)}</div>
      </div>
    </div>
  );
}

/* ===== C4 — Cadastro com indicação (passo 1 · "Seus dados")
   st: link · typing · validating · valid · invalid · nobonus · off */
function RefDots({ total = 5, current = 0 }) {
  const t = useT();
  return <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '4px 0 16px' }}>{Array.from({ length: total }).map((_, i) => <div key={i} style={{ width: i === current ? 22 : 7, height: 7, borderRadius: 99, background: i === current ? t.accent : t.border }} />)}</div>;
}
function RefBadge({ nome = 'João M.', bonus, onChange }) {
  const t = useT();
  return (
    <div role="status" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 12px 12px 14px', borderRadius: 18, background: t.goldSoft, border: '1px solid rgba(176,112,42,0.22)' }}>
      <div style={{ width: 40, height: 40, borderRadius: 999, background: t.gold, color: t.onGold, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="gift" size={19} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: t.text }}>Indicado por {nome}</div>
        {bonus > 0 && <div style={{ fontSize: 12.5, color: t.accent, fontWeight: 600, marginTop: 2, lineHeight: 1.35 }}>Você ganha {paez(bonus)} quando o 1º pedido chegar</div>}
      </div>
      {onChange !== false && <button onClick={onChange} style={{ minHeight: 44, padding: '0 6px', background: 'none', border: 'none', color: t.accent, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'Hanken Grotesk', textDecoration: 'underline', textUnderlineOffset: 3 }}>Trocar</button>}
    </div>
  );
}
function RefCodeField({ st }) {
  const t = useT();
  const val = { typing: 'JOAO7', validating: 'JOAO7K2F', valid: 'JOAO7K2F', nobonus: 'JOAO7K2F', invalid: 'JOAO7K2X' }[st] || '';
  const border = st === 'valid' || st === 'nobonus' ? t.good : st === 'invalid' ? t.accent : st === 'typing' ? t.accent : t.border;
  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec, marginBottom: 7 }}>Código de indicação <span style={{ fontWeight: 600, color: t.textTer }}>(opcional)</span></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: t.surfaceAlt, border: `1.5px solid ${border}`, borderRadius: 14, padding: '12px 14px' }}>
        <Icon name="ticket" size={18} color={t.textTer} stroke={2} />
        <span style={{ flex: 1, fontFamily: RF_H, fontWeight: 700, fontSize: 17, letterSpacing: '0.1em', color: t.text }}>{val}{st === 'typing' && <span style={{ display: 'inline-block', width: 2, height: 18, background: t.accent, marginLeft: 2, verticalAlign: -3, animation: 'rfBlink 1s steps(1) infinite' }} />}</span>
        {st === 'validating' && <span aria-label="Validando" style={{ width: 18, height: 18, borderRadius: 99, border: `2.5px solid ${t.goldSoft}`, borderTopColor: t.accent, animation: 'rfSpin .8s linear infinite' }} />}
        {(st === 'valid' || st === 'nobonus') && <Icon name="check" size={19} color={t.good} stroke={2.6} />}
      </div>
      {st === 'typing' && <div style={{ fontSize: 11.5, color: t.textTer, marginTop: 6 }}>Letras e números, como está na mensagem do seu amigo.</div>}
      {st === 'validating' && <div style={{ fontSize: 11.5, color: t.textTer, marginTop: 6 }}>Conferindo o código…</div>}
      {st === 'invalid' && <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12.5, color: t.accent, marginTop: 7, lineHeight: 1.4, fontWeight: 600 }}><Icon name="alert" size={15} stroke={2.2} style={{ flexShrink: 0, marginTop: 1 }} />Não achamos esse código. Confira as letras — ou siga sem ele, sem problema.</div>}
      {(st === 'valid' || st === 'nobonus') && <div style={{ marginTop: 10 }}><RefBadge bonus={st === 'nobonus' ? 0 : REFERRAL_CFG.bonusAmigo} onChange={false} /></div>}
    </div>
  );
}
function RegisterReferral({ st = 'link' }) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const showField = ['typing', 'validating', 'valid', 'invalid', 'nobonus'].includes(st) || (st === 'closed' && open);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '6px 24px 24px', minHeight: 760 }}>
      <button style={{ background: t.surface2, border: 'none', width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', color: t.text }}><Icon name="arrowL" size={20} /></button>
      <div style={{ marginTop: 16, marginBottom: 6 }}><RefDots current={0} /></div>
      {st === 'link' && <div style={{ marginBottom: 18 }}><RefBadge bonus={REFERRAL_CFG.bonusAmigo} /></div>}
      <div style={{ fontFamily: RF_H, fontWeight: 700, fontSize: 26, letterSpacing: '-0.03em', color: t.text, lineHeight: 1.15 }}>Seus dados</div>
      <div style={{ fontSize: 14, color: t.textSec, marginTop: 10, marginBottom: 22, lineHeight: 1.5 }}>Precisamos disso uma única vez, pra deixar sua conta pronta.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Nome completo" icon="user" value="Maria Souza" />
        <Field label="CPF" icon="card" value="123.456.789-00" />
        <Field label="Data de nascimento" icon="calendar" value="14 / 03 / 1991" />
      </div>
      {st !== 'off' && st !== 'link' && (
        <div style={{ marginTop: 18 }}>
          {showField ? <RefCodeField st={st === 'closed' ? 'typing' : st} /> : (
            <button onClick={() => setOpen(true)} style={{ minHeight: 44, padding: 0, background: 'none', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, color: t.accent, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'Hanken Grotesk' }}><Icon name="ticket" size={17} />Tenho um código de indicação</button>
          )}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 24 }} />
      <Btn full size="lg" disabled={st === 'validating'}>Continuar</Btn>
    </div>
  );
}

Object.assign(window, { ProfRow, ProfLabel, ProfileHub, RefHomeCard, RefHomeContext, RefDots, RefBadge, RefCodeField, RegisterReferral });
