/* ============================================================
   Indique e Ganhe — ADMIN · A1 card · A2 hub · A3 Config · A4 Indicações
   ============================================================ */
const RA_STATE = {
  analise:    { l: 'Em análise',   tone: 'gold',    ic: 'search' },
  aguardando: { l: 'Aguardando',   tone: 'neutral', ic: 'clock' },
  cadastro:   { l: 'Cadastro',     tone: 'neutral', ic: 'edit' },
  ganhou:     { l: 'Recompensada', tone: 'good',    ic: 'check' },
  recusada:   { l: 'Recusada',     tone: 'neutral', ic: 'x' },
  expirou:    { l: 'Expirada',     tone: 'neutral', ic: 'clock' },
};
function RAPill({ estado }) { const s = RA_STATE[estado]; return <Pill tone={s.tone}><Icon name={s.ic} size={12} stroke={2.6} />{s.l}</Pill>; }
function RASignal({ children }) {
  const t = useT();
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, background: t.dangerSoft, color: t.danger, fontSize: 11, fontWeight: 700 }}><Icon name="alert" size={11} stroke={2.6} />{children}</span>;
}
function RAChips({ items, value, onChange }) {
  const t = useT();
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', padding: '0 20px 2px', margin: '0 -20px' }}>
      {items.map(it => {
        const on = value === it.k;
        return <button key={it.k} onClick={() => onChange && onChange(it.k)} style={{ flexShrink: 0, minHeight: 38, padding: '0 14px', borderRadius: 999, border: `1.5px solid ${on ? t.espresso : t.border}`, background: on ? t.espresso : t.surface, color: on ? '#FBF3E4' : t.text, fontWeight: 700, fontSize: 13, fontFamily: 'Hanken Grotesk', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>{it.l}{it.n != null && <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 99, background: on ? t.gold : t.goldSoft, color: t.onGold, fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{it.n}</span>}</button>;
      })}
    </div>
  );
}
function RALabel({ children, hint }) {
  const t = useT();
  return <div style={{ margin: '0 4px 8px' }}><div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: t.textTer, textTransform: 'uppercase' }}>{children}</div>{hint && <div style={{ fontSize: 12, color: t.textSec, marginTop: 3 }}>{hint}</div>}</div>;
}
function RAInline({ tone = 'danger', children }) {
  const t = useT();
  const c = tone === 'danger' ? t.danger : tone === 'good' ? t.good : t.accent;
  const bg = tone === 'danger' ? t.dangerSoft : tone === 'good' ? t.goodSoft : t.goldSoft;
  return <div role={tone === 'danger' ? 'alert' : 'status'} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 12, background: bg, color: c, fontSize: 12.5, fontWeight: 600, lineHeight: 1.4 }}><Icon name={tone === 'good' ? 'check' : 'alert'} size={15} stroke={2.3} style={{ flexShrink: 0, marginTop: 1 }} /><span style={{ flex: 1, minWidth: 0 }}>{children}</span></div>;
}

/* ===== A1 — Card no hub Gestão */
function RAGestaoCard({ n = 3, onClick }) {
  const t = useT();
  return (
    <Card pad={14} onClick={onClick} style={{ cursor: 'pointer', display: 'flex', gap: 13, alignItems: 'center' }}>
      <div style={{ width: 44, height: 44, borderRadius: 13, background: t.goldSoft, color: t.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="gift" size={21} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: t.text }}>Indique e Ganhe</div>
        <div style={{ fontSize: 12.5, color: t.textSec, marginTop: 2 }}>Recompensas, regras e indicações</div>
      </div>
      {n > 0 && <span style={{ padding: '4px 10px', borderRadius: 999, background: t.gold, color: t.onGold, fontSize: 11.5, fontWeight: 800 }}>{n} em análise</span>}
      <Icon name="chevR" size={18} color={t.textTer} />
    </Card>
  );
}
function RAGestaoHub({ onOpen }) {
  const t = useT();
  const cards = [['basket', 'Além do Pãozin', 'Produtos, estoque e separação'], ['building', 'Condomínios', 'Parceiros e pedidos de novos'], ['percent', 'Compra personalizada', 'Preço avulso e combos'], ['bell', 'Notificações', 'O que avisar à equipe']];
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '6px 20px 14px', fontFamily: RF_H, fontWeight: 800, fontSize: 28, letterSpacing: '-0.03em', color: t.text }}>Gestão</div>
      <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <RAGestaoCard onClick={onOpen} />
        {cards.map(([ic, a, b]) => (
          <Card key={a} pad={14} style={{ display: 'flex', gap: 13, alignItems: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: t.surface2, color: t.textSec, display: 'grid', placeItems: 'center' }}><Icon name={ic} size={21} /></div>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 15, color: t.text }}>{a}</div><div style={{ fontSize: 12.5, color: t.textSec, marginTop: 2 }}>{b}</div></div>
            <Icon name="chevR" size={18} color={t.textTer} />
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ===== A2 — Hub "Indique e Ganhe" */
function RAHub({ sec: sec0 = 'config', cfgSt, listSt, back = () => {}, onReport }) {
  const t = useT();
  const [sec, setSec] = React.useState(sec0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <AppBar title="Indique e Ganhe" onBack={back} right={<button onClick={onReport} aria-label="Relatório de indicações" style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: t.surface2, color: t.text, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="trend" size={19} /></button>} />
      <div style={{ padding: '0 20px 12px' }}>
        <div style={{ display: 'flex', gap: 4, background: t.surface2, borderRadius: 14, padding: 4 }}>
          {[['config', 'Configuração'], ['lista', 'Indicações']].map(([k, l]) => (
            <button key={k} onClick={() => setSec(k)} style={{ flex: 1, minHeight: 40, borderRadius: 11, border: 'none', background: sec === k ? t.surface : 'transparent', color: sec === k ? t.text : t.textSec, boxShadow: sec === k ? t.shadowSoft : 'none', fontWeight: 700, fontSize: 14, fontFamily: 'Hanken Grotesk', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {l}{k === 'lista' && <span style={{ padding: '1px 7px', borderRadius: 99, background: t.gold, color: t.onGold, fontSize: 11, fontWeight: 800 }}>3</span>}
            </button>
          ))}
        </div>
      </div>
      {sec === 'config' ? <RAConfig st={cfgSt} /> : <RAList st={listSt} />}
    </div>
  );
}

/* ===== A3 — Configuração
   st: on · off · zeroErr · noGoals · msgErr · bonusWarn · saving · saved */
function RAConfig({ st = 'on' }) {
  const t = useT();
  const [ativo, setAtivo] = React.useState(st !== 'off' && st !== 'zeroErr');
  const [rec, setRec] = React.useState(st === 'zeroErr' ? 0 : 5);
  const [bon, setBon] = React.useState(st === 'bonusWarn' ? 0 : 3);
  const [min, setMin] = React.useState(0);
  const [lim, setLim] = React.useState(10);
  const [prazo, setPrazo] = React.useState(60);
  const [camp, setCamp] = React.useState(st !== 'noGoals');
  const [mult, setMult] = React.useState(2);
  const [metas, setMetas] = React.useState(st === 'noGoals' ? [] : REFERRAL_CFG.metas.map(m => ({ ...m })));
  const [msg, setMsg] = React.useState(st === 'msgErr' ? 'Oi! Recebo pão fresquinho na porta com o Cheirin de Pão 🥖 Cadastra e ganha {bonus} pãezins no primeiro pedido!' : REFERRAL_CFG.mensagem);
  const semVar = !/\{codigo\}|\{link\}/.test(msg);
  const bonusZeroWarn = bon === 0 && /\{bonus\}/.test(msg);
  const preview = msg.replace(/\{codigo\}/g, 'JOAO7K2F').replace(/\{link\}/g, REF_LINK('JOAO7K2F')).replace(/\{nome\}/g, 'João').replace(/\{bonus\}/g, bon);
  const row = (label, desc, ctrl, last) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: last ? 'none' : `1px solid ${t.border2}` }}>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>{label}</div>{desc && <div style={{ fontSize: 12, color: t.textSec, marginTop: 2, lineHeight: 1.35 }}>{desc}</div>}</div>{ctrl}
    </div>
  );
  const money = (v, set) => <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: 104, background: t.surfaceAlt, border: `1.5px solid ${t.border}`, borderRadius: 12, padding: '9px 10px' }}><span style={{ fontSize: 13, color: t.textTer, fontWeight: 700 }}>R$</span><input value={v.toFixed(2).replace('.', ',')} onChange={() => {}} style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontWeight: 700, fontSize: 15, color: t.text, textAlign: 'right', fontFamily: 'Hanken Grotesk' }} /></div>;
  const dateBox = v => <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: t.surfaceAlt, border: `1.5px solid ${t.border}`, borderRadius: 12, padding: '10px 12px', fontSize: 14, fontWeight: 700, color: t.text }}><Icon name="calendar" size={16} color={t.textTer} />{v}</div>;
  return (
    <div style={{ padding: '4px 20px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Card pad={0} style={{ border: ativo ? `1.5px solid ${t.gold}` : `1px solid ${t.border2}` }}>
        {row('Programa ativo', ativo ? 'Clientes veem e compartilham o código.' : 'Desligado: as entradas somem do app. Quem já indicou ainda vê o histórico.', <Switch on={ativo} onChange={setAtivo} />, st !== 'zeroErr')}
        {st === 'zeroErr' && <div style={{ padding: '0 16px 14px' }}><RAInline>Para ligar o programa, defina uma recompensa maior que 0 para quem indica.</RAInline></div>}
      </Card>
      <div>
        <RALabel>Recompensas</RALabel>
        <Card pad={0}>
          {row('Quem indica ganha', rec > 0 ? `≈ ${BRL(rec * REF_UNIT)} por indicação que valer` : 'Obrigatório para ligar o programa', <Stepper value={rec} onChange={setRec} min={0} max={50} />)}
          {row('Bônus do amigo', bon > 0 ? `≈ ${BRL(bon * REF_UNIT)} · 0 = sem bônus` : 'Sem bônus — o app não fala de presente pro amigo', <Stepper value={bon} onChange={setBon} min={0} max={50} />, true)}
        </Card>
      </div>
      <div>
        <RALabel>Regras</RALabel>
        <Card pad={0}>
          {row('Compra mínima do amigo', min ? null : '0 = qualquer 1º pedido', money(min, setMin))}
          {row('Limite por indicador / mês', 'Acima disso vai para análise · 0 = sem limite', <Stepper value={lim} onChange={setLim} min={0} max={99} />)}
          {row('Prazo para o 1º pedido', `${prazo ? prazo + ' dias' : 'sem prazo'} · 0 = sem prazo`, <Stepper value={prazo} onChange={v => setPrazo(Math.max(0, v))} min={0} max={180} />, true)}
        </Card>
      </div>
      <div>
        <RALabel>Campanha</RALabel>
        <Card pad={0} style={{ border: camp ? `1.5px solid ${t.gold}` : `1px solid ${t.border2}` }}>
          {row('Campanha por período', camp ? 'Ativa — aparece com destaque no app' : 'Multiplica a recompensa de quem indica', <Switch on={camp} onChange={setCamp} />, !camp)}
          {camp && <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Rótulo" value="Semana em dobro" />
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec, marginBottom: 7 }}>Multiplicador</div>
              <div style={{ display: 'flex', gap: 6 }}>{[2, 3, 4, 5].map(m => <button key={m} onClick={() => setMult(m)} style={{ flex: 1, minHeight: 44, borderRadius: 12, border: `1.5px solid ${mult === m ? t.accent : t.border}`, background: mult === m ? t.goldSoft : t.surface, color: mult === m ? t.accent : t.text, fontFamily: RF_H, fontWeight: 800, fontSize: 16, cursor: 'pointer' }}>{m}×</button>)}</div>
              <div style={{ fontSize: 12, color: t.textSec, marginTop: 7 }}>Quem indicar no período ganha <b style={{ color: t.text }}>{rec * mult} pãezins</b> em vez de {rec}.</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>{dateBox('05/10/2026')}{dateBox('11/10/2026')}</div>
          </div>}
        </Card>
      </div>
      <div>
        <RALabel hint="Bônus extra quando o cliente chega na N-ésima indicação que valeu. Até 5.">Metas</RALabel>
        <Card pad={0}>
          {metas.length === 0 && <div style={{ padding: '18px 16px', textAlign: 'center', fontSize: 13, color: t.textSec }}>Nenhuma meta. O app não mostra a barra de progresso.</div>}
          {metas.map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 10px 12px 16px', borderBottom: `1px solid ${t.border2}` }}>
              <span style={{ fontSize: 13, color: t.textSec, fontWeight: 600 }}>Na</span>
              <span style={{ minWidth: 44, textAlign: 'center', padding: '8px 0', borderRadius: 10, background: t.surfaceAlt, border: `1.5px solid ${t.border}`, fontFamily: RF_H, fontWeight: 800, fontSize: 15 }}>{m.quantidade}ª</span>
              <span style={{ fontSize: 13, color: t.textSec, fontWeight: 600 }}>indicação,</span>
              <span style={{ minWidth: 52, textAlign: 'center', padding: '8px 0', borderRadius: 10, background: t.goldSoft, color: t.accent, fontFamily: RF_H, fontWeight: 800, fontSize: 15 }}>+{m.bonus}</span>
              <div style={{ flex: 1 }} />
              <button onClick={() => setMetas(metas.filter((_, j) => j !== i))} aria-label="Remover meta" style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: 'none', color: t.textTer, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><Icon name="trash" size={18} /></button>
            </div>
          ))}
          <button disabled={metas.length >= 5} onClick={() => setMetas([...metas, { quantidade: (metas[metas.length - 1]?.quantidade || 0) + 5, bonus: 10 }])} style={{ width: '100%', minHeight: 50, border: 'none', background: 'none', color: t.accent, fontWeight: 700, fontSize: 14, fontFamily: 'Hanken Grotesk', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}><Icon name="plus" size={17} stroke={2.4} />Adicionar meta</button>
        </Card>
      </div>
      <div>
        <RALabel>Mensagem de compartilhamento</RALabel>
        <Card pad={14} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={5} style={{ width: '100%', resize: 'none', borderRadius: 14, border: `1.5px solid ${semVar ? t.danger : t.border}`, background: t.surfaceAlt, padding: '12px 14px', fontSize: 14, lineHeight: 1.5, color: t.text, fontFamily: 'Hanken Grotesk', outline: 'none' }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['{codigo}', '{link}', '{nome}', '{bonus}'].map(v => <button key={v} onClick={() => setMsg(msg + ' ' + v)} style={{ minHeight: 34, padding: '0 11px', borderRadius: 999, border: `1.5px dashed ${t.accent}`, background: t.surface, color: t.accent, fontWeight: 700, fontSize: 12.5, fontFamily: 'Hanken Grotesk', cursor: 'pointer' }}>+ {v}</button>)}
          </div>
          {semVar && <RAInline>A mensagem precisa de {'{codigo}'} ou {'{link}'} — sem eles o amigo não tem como usar a indicação.</RAInline>}
          {bonusZeroWarn && <RAInline tone="gold">O bônus do amigo está em 0, mas a mensagem usa {'{bonus}'}. Vai aparecer "ganha 0 pãezins".</RAInline>}
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.1em', color: t.textTer, marginBottom: 8 }}>PRÉVIA</div>
            <div style={{ background: t.surface2, borderRadius: 16, padding: 12 }}>
              <div style={{ maxWidth: '88%', marginLeft: 'auto', background: t.goodSoft, borderRadius: '16px 16px 4px 16px', padding: '10px 12px', fontSize: 13.5, lineHeight: 1.45, color: t.text, wordBreak: 'break-word' }}>{preview}<div style={{ fontSize: 10.5, color: t.textTer, textAlign: 'right', marginTop: 4 }}>09:41 ✓✓</div></div>
            </div>
          </div>
        </Card>
      </div>
      {st === 'saved' && <RAInline tone="good">Alterações salvas. Valem para novas indicações — as antigas mantêm os valores de quando foram feitas.</RAInline>}
      <Btn full size="lg" disabled={semVar || st === 'saving' || (ativo && rec === 0)} icon={st === 'saving' ? null : 'check'}>
        {st === 'saving' ? <><span style={{ width: 16, height: 16, borderRadius: 99, border: '2.5px solid rgba(251,243,228,0.3)', borderTopColor: '#FBF3E4', animation: 'rfSpin .8s linear infinite' }} />Salvando…</> : 'Salvar'}
      </Btn>
    </div>
  );
}

/* ===== A4 — Indicações (lista). st: default · loading · empty */
function RAList({ st = 'default', onOpen }) {
  const t = useT();
  const [f, setF] = React.useState(st === 'empty' ? 'recusada' : 'analise');
  const count = k => ADMIN_REFERRALS.filter(r => r.estado === k).length;
  const chips = [{ k: 'analise', l: 'Em análise', n: count('analise') }, { k: 'aguardando', l: 'Aguardando' }, { k: 'ganhou', l: 'Recompensadas' }, { k: 'recusada', l: 'Recusadas' }, { k: 'expirou', l: 'Expiradas' }, { k: 'todas', l: 'Todas' }];
  let list = f === 'todas' ? ADMIN_REFERRALS : ADMIN_REFERRALS.filter(r => r.estado === f || (f === 'aguardando' && r.estado === 'cadastro'));
  if (st === 'empty') list = [];
  return (
    <div style={{ padding: '4px 20px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <RAChips items={chips} value={f} onChange={setF} />
      <Field icon="search" value="" placeholder="Buscar por nome" />
      {st === 'loading' ? [0, 1, 2].map(i => <RefSkel key={i} h={92} r={20} />) : list.length === 0 ? (
        <Card pad={24} style={{ textAlign: 'center', boxShadow: 'none', background: t.surfaceAlt, border: `1.5px dashed ${t.border}` }}>
          <Icon name="list" size={26} color={t.textTer} />
          <div style={{ fontWeight: 800, fontSize: 15, color: t.text, marginTop: 8 }}>Nada por aqui</div>
          <div style={{ fontSize: 13, color: t.textSec, marginTop: 4 }}>Nenhuma indicação {{ analise: 'em análise', aguardando: 'aguardando', ganhou: 'recompensada', recusada: 'recusada', expirou: 'expirada', todas: '' }[f]} no momento.</div>
        </Card>
      ) : list.map(r => (
        <Card key={r.id} pad={14} onClick={() => onOpen && onOpen(r)} style={{ cursor: 'pointer', border: r.estado === 'analise' ? `1.5px solid ${t.gold}` : `1px solid ${t.border2}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14.5, color: t.text, lineHeight: 1.3 }}>{r.de} <span style={{ color: t.accent }}>→</span> {r.para}</div>
            <Icon name="chevR" size={17} color={t.textTer} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <RAPill estado={r.estado} /><span style={{ fontSize: 12, color: t.textTer, fontWeight: 600 }}>{r.data} · {r.cond}</span>
          </div>
          {r.sinais.length > 0 && <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>{r.sinais.map(s => <RASignal key={s}>{s}</RASignal>)}</div>}
        </Card>
      ))}
    </div>
  );
}

/* ===== A4 — Detalhe (sheet). st: view · approve · reject · done */
function RADetail({ r = ADMIN_REFERRALS[0], st = 'view' }) {
  const t = useT();
  const steps = [['cadastro', 'Cadastro'], ['login', '1º login'], ['pagamento', '1º pagamento'], ['entrega', '1ª entrega'], ['recompensa', r.estado === 'analise' ? 'Em análise' : 'Recompensa']];
  const person = (tag, nome) => (
    <button style={{ flex: 1, minWidth: 0, minHeight: 64, padding: '10px 12px', borderRadius: 16, border: `1px solid ${t.border}`, background: t.surfaceAlt, textAlign: 'left', cursor: 'pointer', fontFamily: 'Hanken Grotesk' }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: t.textTer }}>{tag}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}><span style={{ flex: 1, fontWeight: 800, fontSize: 14, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nome}</span><Icon name="chevR" size={15} color={t.textTer} /></div>
    </button>
  );
  return (
    <div style={{ position: 'relative', minHeight: 800, background: 'rgba(30,18,7,0.5)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div style={{ background: t.appBg, borderRadius: '26px 26px 0 0', padding: '10px 20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ width: 40, height: 5, borderRadius: 9, background: t.border, margin: '0 auto 4px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, fontFamily: RF_H, fontWeight: 700, fontSize: 20, color: t.text, letterSpacing: '-0.02em' }}>Indicação</div>
          <RAPill estado={st === 'done' ? 'ganhou' : r.estado} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>{person('INDICOU', r.de)}{person('INDICADO', r.para)}</div>
        {r.sinais.length > 0 && st !== 'done' && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{r.sinais.map(s => <RASignal key={s}>{s}</RASignal>)}</div>}
        <Card pad={0} style={{ display: 'flex' }}>
          {[['Quem indicou', `+${r.x}`], ['Amigo', `+${r.y}`], ['Campanha', r.campanha || '—']].map(([a, b], i) => (
            <div key={a} style={{ flex: 1, padding: '12px 10px', textAlign: 'center', borderLeft: i ? `1px solid ${t.border2}` : 'none' }}>
              <div style={{ fontSize: 11, color: t.textTer, fontWeight: 700 }}>{a}</div>
              <div style={{ fontFamily: RF_H, fontWeight: 800, fontSize: i < 2 ? 20 : 13, color: t.text, marginTop: 4, lineHeight: 1.2 }}>{b}</div>
            </div>
          ))}
        </Card>
        <div style={{ fontSize: 11.5, color: t.textTer, marginTop: -6, textAlign: 'center' }}>Valores congelados no momento do cadastro</div>
        <Card pad={16}>
          {steps.map(([k, l], i) => {
            const at = r.tl[k] || (k === 'recompensa' && st === 'done' ? 'agora' : null);
            const ok = !!at || (k === 'recompensa' && r.estado === 'analise');
            const warn = k === 'recompensa' && r.estado === 'analise' && st !== 'done';
            return (
              <div key={k} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: i < steps.length - 1 ? 14 : 0 }}>
                {i < steps.length - 1 && <div style={{ position: 'absolute', left: 10, top: 22, bottom: 0, width: 2, background: r.tl[steps[i + 1][0]] ? t.good : t.border }} />}
                <div style={{ width: 22, height: 22, borderRadius: 99, background: warn ? t.gold : ok ? t.good : t.surface2, color: warn ? t.onGold : '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{ok && <Icon name={warn ? 'search' : 'check'} size={12} stroke={3} />}</div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: ok ? t.text : t.textTer }}>{k === 'recompensa' && st === 'done' ? 'Recompensa creditada' : l}</span>
                  <span style={{ fontSize: 12, color: t.textSec, fontWeight: 600 }}>{warn ? 'aguardando você' : at || '—'}</span>
                </div>
              </div>
            );
          })}
        </Card>
        {st === 'view' && r.estado === 'analise' && <div style={{ display: 'flex', gap: 10 }}><Btn full variant="ghost" icon="x">Recusar</Btn><Btn full icon="check">Aprovar</Btn></div>}
        {st === 'approve' && (
          <Card pad={16} style={{ border: `1.5px solid ${t.good}` }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: t.text }}>Aprovar esta indicação?</div>
            <div style={{ fontSize: 13, color: t.textSec, marginTop: 4, lineHeight: 1.45 }}>{r.de.split(' ')[0]} ganha +{r.x} e {r.para.split(' ')[0]} ganha +{r.y} agora. Os dois recebem uma notificação.</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}><Btn full variant="soft">Voltar</Btn><Btn full icon="check">Aprovar</Btn></div>
          </Card>
        )}
        {st === 'reject' && (
          <Card pad={16} style={{ border: `1.5px solid ${t.danger}` }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: t.text }}>Recusar indicação</div>
            <div style={{ fontSize: 12.5, color: t.textSec, marginTop: 4, lineHeight: 1.45 }}>O motivo fica só aqui. O cliente vê apenas "Não valeu".</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {['Mesma residência', 'Mesmo aparelho', 'Conta duplicada', 'Outro'].map((m, i) => <span key={m} style={{ minHeight: 34, display: 'inline-flex', alignItems: 'center', padding: '0 12px', borderRadius: 999, border: `1.5px solid ${i === 0 ? t.danger : t.border}`, background: i === 0 ? t.dangerSoft : t.surface, color: i === 0 ? t.danger : t.text, fontWeight: 700, fontSize: 12.5 }}>{m}</span>)}
            </div>
            <textarea rows={2} placeholder="Detalhe (obrigatório)" defaultValue="Mesmo apartamento do indicador (Bl. B 42)." style={{ width: '100%', marginTop: 10, resize: 'none', borderRadius: 12, border: `1.5px solid ${t.border}`, background: t.surfaceAlt, padding: '10px 12px', fontSize: 13.5, fontFamily: 'Hanken Grotesk', color: t.text, outline: 'none' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}><Btn full variant="soft">Voltar</Btn><Btn full style={{ background: t.danger, color: '#fff' }}>Recusar</Btn></div>
          </Card>
        )}
        {st === 'done' && <RAInline tone="good">Aprovada. +{r.x} pãezins para {r.de.split(' ')[0]} e +{r.y} para {r.para.split(' ')[0]}.</RAInline>}
      </div>
    </div>
  );
}

Object.assign(window, { RA_STATE, RAPill, RASignal, RAChips, RALabel, RAInline, RAGestaoCard, RAGestaoHub, RAHub, RAConfig, RAList, RADetail });
