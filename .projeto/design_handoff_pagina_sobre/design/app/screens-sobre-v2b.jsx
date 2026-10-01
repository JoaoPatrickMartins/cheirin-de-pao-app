/* ============================================================
   Cheirin de Pão — Página "Sobre" · v2 (parte 2)
   SobreAgendaCard (a agenda do hero v1, agora animada no S4)
   · S3 · S4 · S5 · S6 (celular com o Além do Pãozin) · S7 (acordeão
   animado) · SobrePageV2
   ============================================================ */

/* ---------- Card da agenda (animado ao entrar na tela) ---------- */
function SobreAgendaCard() {
  const m = useSB().bp === 'm'; const t = THEMES.light; const mo = useSB2M();
  const ref = React.useRef(null); const v = useInView(ref, mo);
  const saldo = useCountUp(38, v, 1200, 500);
  const dias = [['Seg', 2], ['Ter', 2], ['Qua', 2], ['Qui', 2], ['Sex', 3], ['Sáb', 4], ['Dom', 0]];
  const pop = d => (mo ? { opacity: v ? 1 : 0, transform: v ? 'none' : 'scale(.82)', transition: `opacity .5s ${SB2_EASE} ${d}ms, transform .7s cubic-bezier(.3,1.4,.5,1) ${d}ms` } : {});
  return (
    <div ref={ref} role="img" aria-label="Exemplo da agenda semanal no app: quantos pães em cada dia, o saldo de pãezins e a compra automática ligada." style={{ position: 'relative', ...sb2rv(mo, v, 0, 26) }}>
      <div aria-hidden="true" style={{ position: 'relative' }}>
        <div style={{ background: t.surface, color: t.text, borderRadius: 22, padding: m ? '18px 18px 22px' : '24px 24px 30px', boxShadow: t.shadow, border: `1px solid ${t.border2}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: t.goldSoft, color: t.accent, display: 'grid', placeItems: 'center' }}><Icon name="calendar" size={20} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SB_H, fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em' }}>Sua agenda</div>
              <div style={{ fontSize: 12.5, color: t.textSec, marginTop: 1 }}>Repete toda semana</div>
            </div>
            <span style={pop(820)}><Pill tone="good"><Icon name="check" size={12} stroke={2.8} />Ativa</Pill></span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: m ? 5 : 7, marginTop: 16 }}>
            {dias.map(([d, n], i) => (
              <div key={d} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: t.textSec, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{d}</div>
                <div style={{ marginTop: 6, height: m ? 46 : 56, borderRadius: 12, display: 'grid', placeItems: 'center', background: n ? t.surface2 : t.surfaceAlt, border: i === 0 ? `2px solid ${t.gold}` : `1px solid ${n ? 'transparent' : t.border2}`, fontFamily: SB_H, fontWeight: 800, fontSize: m ? 19 : 22, color: n ? t.text : t.textTer, ...pop(180 + i * 70) }}>{n || '–'}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${t.border2}` }}>
            <span style={{ width: 28, height: 28, borderRadius: 99, background: t.goldSoft, color: t.accent, display: 'grid', placeItems: 'center' }}><Icon name="coin" size={16} stroke={2.1} /></span>
            <span style={{ fontSize: 14, color: t.textSec }}><b style={{ fontFamily: SB_H, fontSize: 16, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{saldo}</b> pãezins no saldo</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: t.textSec }}>Seg · amanhã</span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -14, marginRight: m ? 12 : -20, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: t.surface, color: t.text, borderRadius: 18, padding: '12px 18px 12px 12px', boxShadow: t.shadow, border: `1px solid ${t.border2}`, ...(mo ? { opacity: v ? 1 : 0, transform: v ? 'none' : 'translate(24px, 6px)', transition: `opacity .7s ${SB2_EASE} 1100ms, transform .9s ${SB2_EASE} 1100ms` } : {}) }}>
            <span style={{ width: 38, height: 38, borderRadius: 12, background: t.espresso, color: t.gold, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="repeat" size={19} stroke={2.2} /></span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14.5 }}>Compra automática ligada</div>
              <div style={{ fontSize: 12.5, color: t.textSec, marginTop: 1 }}>Recarrega seu combo quando precisar.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- S3 v2 · como funciona (linha que se desenha) ---------- */
function SobreStepsV2() {
  const m = useSB().bp === 'm'; const d = useSBD(); const t = THEMES.light; const mo = useSB2M();
  const ref = React.useRef(null); const v = useInView(ref, mo);
  const draw = (axis, delay) => (mo ? { transform: v ? 'none' : `scale${axis}(0)`, transformOrigin: axis === 'X' ? 'left center' : 'center top', transition: `transform 1.1s ${SB2_EASE} ${delay}ms` } : {});
  const pop = delay => (mo ? { opacity: v ? 1 : 0, transform: v ? 'none' : 'scale(.6)', transition: `opacity .5s ${SB2_EASE} ${delay}ms, transform .8s cubic-bezier(.3,1.35,.5,1) ${delay}ms` } : {});
  return (
    <section aria-labelledby="sb-como" style={{ paddingTop: d.secY, paddingBottom: d.secY }}>
      <SBWrap>
        <Reveal><SBHead id="sb-como" eyebrow="Como funciona" title="Três passos, e o pão chega sozinho." /></Reveal>
        <ol ref={ref} style={{ position: 'relative', display: 'grid', gridTemplateColumns: m ? 'minmax(0,1fr)' : 'repeat(3, minmax(0,1fr))', gap: m ? 0 : 32, marginTop: m ? 32 : 56 }}>
          {!m && <div aria-hidden="true" style={{ position: 'absolute', top: 31, left: 32, width: 'calc((100% - 64px) * 2 / 3 + 64px)', borderTop: `2px dashed ${t.accent}`, opacity: 0.45, ...draw('X', 250) }} />}
          {SB_STEPS.map(([ic, h, p], i) => {
            const last = i === SB_STEPS.length - 1;
            const circle = (
              <div aria-hidden="true" style={{ width: m ? 52 : 64, height: m ? 52 : 64, borderRadius: 99, background: t.espresso, color: t.gold, display: 'grid', placeItems: 'center', flexShrink: 0, position: 'relative', boxShadow: `0 0 0 6px ${t.appBg}`, ...pop(150 + i * 260) }}>
                <Icon name={ic} size={m ? 24 : 28} stroke={2} />
              </div>
            );
            const body = (
              <div style={sb2rv(mo, v, 250 + i * 260, 14)}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', color: t.textSec, textTransform: 'uppercase' }}>Passo {i + 1}</div>
                <SBH3 style={{ marginTop: 6 }}>{h}</SBH3>
                <SBP style={{ marginTop: 8, maxWidth: '30ch' }}>{p}</SBP>
              </div>
            );
            return m ? (
              <li key={h} style={{ display: 'grid', gridTemplateColumns: '52px minmax(0,1fr)', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {circle}
                  {!last && <div aria-hidden="true" style={{ flex: 1, borderLeft: `2px dashed ${t.accent}`, opacity: 0.45, margin: '6px 0', ...draw('Y', 300 + i * 260) }} />}
                </div>
                <div style={{ paddingTop: 4, paddingBottom: last ? 0 : 28 }}>{body}</div>
              </li>
            ) : (
              <li key={h} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>{circle}{body}</li>
            );
          })}
        </ol>
      </SBWrap>
    </section>
  );
}

/* ---------- S4 v2 · pãezins, combos e agenda (+ card da agenda) ---------- */
function SobreCoreV2() {
  const m = useSB().bp === 'm'; const d = useSBD(); const t = THEMES.light; const mo = useSB2M();
  const ref = React.useRef(null); const v = useInView(ref, mo);
  const colW = '((100% - 84px) / 4)';
  return (
    <section aria-labelledby="sb-core" style={{ background: t.surface2, paddingTop: d.secY, paddingBottom: d.secY }}>
      <SBWrap>
        <div style={{ display: 'grid', gridTemplateColumns: m ? 'minmax(0,1fr)' : 'minmax(0,1fr) minmax(0,1fr)', gap: m ? 28 : 72, alignItems: 'center' }}>
          <Reveal>
            <SBHead id="sb-core" eyebrow="Pãezins, combos e agenda" title="Um saldo de pães que trabalha por você." text="Pãezins são a moeda do Cheirin. Os combos enchem o saldo, a agenda usa sozinha e a compra automática recarrega quando precisa." />
            <div style={{ marginTop: m ? 22 : 28 }}><SobreBadge /></div>
          </Reveal>
          <div style={{ paddingRight: m ? 0 : 20 }}><SobreAgendaCard /></div>
        </div>
        <ol ref={ref} style={{ display: 'grid', gridTemplateColumns: m ? 'minmax(0,1fr)' : 'repeat(4, minmax(0,1fr))', gap: 28, marginTop: m ? 40 : 72 }}>
          {SB_CORE.map(([ic, h, p], i) => <SB2CoreNode key={h} ic={ic} h={h} p={p} m={m} arrow={i < SB_CORE.length - 1} st={sb2rv(mo, v, i * 120, 20)} arrowSt={mo ? { opacity: v ? 1 : 0, transition: `opacity .5s ${SB2_EASE} ${i * 120 + 380}ms` } : {}} />)}
        </ol>
        {m ? (
          <div style={{ marginTop: 16, ...sb2rv(mo, v, 600, 20) }}><SobreLoopCard m /></div>
        ) : (
          <div style={{ position: 'relative', paddingTop: 30 }}>
            <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: `calc(${colW} / 2)`, width: `calc(${colW} * 2 + 56px)`, height: 82, border: `2px dashed ${t.accent}`, borderTop: 'none', borderRadius: '0 0 26px 26px', ...(mo ? { clipPath: v ? 'inset(0 0 0 0)' : 'inset(0 0 0 100%)', transition: `clip-path 1.2s ${SB2_EASE} 650ms` } : {}) }} />
            <div aria-hidden="true" style={{ position: 'absolute', top: -2, left: `calc(${colW} / 2 - 6px)`, width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderBottom: `10px solid ${t.accent}`, ...(mo ? { opacity: v ? 1 : 0, transition: `opacity .4s ease 1650ms` } : {}) }} />
            <div style={{ position: 'relative', marginLeft: `calc(${colW} / 2)`, width: `calc(${colW} * 2 + 56px)`, display: 'flex', justifyContent: 'center', ...sb2rv(mo, v, 900, 20) }}><SobreLoopCard /></div>
          </div>
        )}
      </SBWrap>
    </section>
  );
}
function SB2CoreNode({ ic, h, p, m, arrow, st, arrowSt }) {
  const t = THEMES.light;
  return (
    <li style={{ position: 'relative', background: t.surface, borderRadius: 20, border: `1px solid ${t.border2}`, boxShadow: t.shadowSoft, padding: m ? 18 : 22, display: 'flex', flexDirection: m ? 'row' : 'column', gap: m ? 14 : 16, alignItems: 'flex-start', ...st }}>
      <div aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 14, background: t.goldSoft, color: t.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={ic} size={22} stroke={2} /></div>
      <div><SBH3>{h}</SBH3><SBP size={15} style={{ marginTop: 6 }}>{p}</SBP></div>
      {arrow && <span aria-hidden="true" style={{ position: 'absolute', zIndex: 1, width: 28, height: 28, borderRadius: 99, background: t.espresso, color: t.gold, display: 'grid', placeItems: 'center', ...(m ? { left: 26, bottom: -21 } : { right: -28, top: 30 }), ...arrowSt }}><Icon name={m ? 'chevD' : 'chevR'} size={16} stroke={2.6} /></span>}
    </li>
  );
}

/* ---------- S5 v2 · gancho ---------- */
function SobreGanchoV2() {
  const m = useSB().bp === 'm'; const d = useSBD(); const t = THEMES.light; const mo = useSB2M();
  const ref = React.useRef(null); const v = useInView(ref, mo);
  return (
    <section aria-labelledby="sb-gancho" style={{ paddingTop: d.secY, paddingBottom: d.secY }}>
      <SBWrap style={{ display: 'grid', gridTemplateColumns: m ? 'minmax(0,1fr)' : 'minmax(0,1fr) minmax(0,1fr)', gap: m ? 28 : 72, alignItems: 'center' }}>
        <Reveal y={30} style={{ height: m ? 280 : 460, borderRadius: 22, overflow: 'hidden', background: t.surface2 }}>
          <image-slot id="sobre-gancho" shape="rounded" radius="22" placeholder="Foto: gancho de acrílico transparente encaixado na porta, com a sacola de pães pendurada"></image-slot>
        </Reveal>
        <div ref={ref}>
          <div style={sb2rv(mo, v, 0)}><SBHead id="sb-gancho" eyebrow="Gancho na porta" title="O pão te espera pendurado na porta." text="Um gancho de acrílico transparente que se encaixa na porta. O entregador pendura a sacola de pães nele — e você pega quando abrir a porta." /></div>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: m ? 24 : 32 }}>
            {SB_GANCHO.map(([ic, h, p], i) => (
              <li key={h} style={{ display: 'flex', alignItems: 'center', gap: 14, ...sb2rv(mo, v, 200 + i * 110, 14) }}>
                <span aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 14, background: t.surface, border: `1px solid ${t.border2}`, boxShadow: t.shadowSoft, color: t.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={ic} size={22} stroke={2} /></span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: m ? 16 : 17, color: t.text }}>{h}</div>
                  <SBP size={m ? 14.5 : 15.5} style={{ marginTop: 1 }}>{p}</SBP>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </SBWrap>
    </section>
  );
}

/* ---------- S6 v2 · Além do Pãozin com o app ---------- */
function SB2AlemScreen() {
  const t = THEMES.light;
  return (
    <ThemeCtx.Provider value={t}>
      <div style={{ width: 390, height: 844, background: '#F9F4EC', overflow: 'hidden' }}>
        <StatusBar time="7:14" />
        <img src="assets/app-alem-do-paozin.jpg" alt="" style={{ display: 'block', width: 390, height: 'auto' }} />
      </div>
    </ThemeCtx.Provider>
  );
}
function SobreAlemV2() {
  const m = useSB().bp === 'm'; const d = useSBD(); const t = THEMES.light; const mo = useSB2M();
  const ref = React.useRef(null); const v = useInView(ref, mo);
  const pw = m ? 262 : 300;
  return (
    <section aria-labelledby="sb-alem" style={{ paddingBottom: d.secY }}>
      <SBWrap>
        <div ref={ref} style={{ background: t.goldSoft, borderRadius: m ? 24 : 32, overflow: 'hidden', display: 'grid', gridTemplateColumns: m ? 'minmax(0,1fr)' : 'minmax(0,1.25fr) minmax(0,0.75fr)', gap: m ? 32 : 40, ...sb2rv(mo, v, 0, 30) }}>
          <div style={{ padding: m ? '32px 20px 0' : '56px 0 56px 56px' }}>
            <div style={sb2rv(mo, v, 150)}><SBHead id="sb-alem" tone="gold" eyebrow="Além do Pãozin" title="Monte sua Cestinha — ela chega junto com o seu pão." /></div>
            <p style={{ fontSize: d.body, lineHeight: 1.6, color: t.text, marginTop: 14, maxWidth: '44ch', textWrap: 'pretty', ...sb2rv(mo, v, 250) }}>Itens para o café da manhã, entregues na mesma sacola. Pague com pãezins, Pix ou cartão — e dá para combinar.</p>
            <ul style={{ display: 'grid', gridTemplateColumns: m ? 'repeat(2, minmax(0,1fr))' : 'repeat(3, minmax(0,1fr))', gap: m ? 10 : 12, marginTop: m ? 24 : 36 }}>
              {MARKET_CATS.map((c, i) => (
                <li key={c.k} style={sb2rv(mo, v, 350 + i * 70, 14)}>
                  <div className="sb2-tile" style={{ background: t.surface, borderRadius: 18, padding: m ? '14px 12px' : '16px 14px', display: 'flex', alignItems: 'center', gap: m ? 10 : 12, minHeight: m ? 72 : 76, boxShadow: '0 1px 2px rgba(43,26,12,0.04)' }}>
                    <span aria-hidden="true" style={{ width: m ? 42 : 44, height: m ? 42 : 44, borderRadius: 99, background: t.surface2, color: t.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={SB_CAT_IC[c.k]} size={21} stroke={1.9} /></span>
                    <span style={{ fontSize: m ? 13.5 : 14, fontWeight: 700, color: t.text, lineHeight: 1.25 }}>{c.nome}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div role="img" aria-label="Tela do Além do Pãozin no app: produtos com preço em reais e em pãezins." style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', height: m ? 400 : 'auto', minHeight: m ? 0 : 560, paddingTop: m ? 0 : 56 }}>
            <div aria-hidden="true" style={{ position: 'absolute', left: '50%', top: m ? 30 : 90, width: pw * 1.6, height: pw * 1.6, marginLeft: -pw * 0.8, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(255,255,255,0.65), transparent 70%)' }} />
            <div style={{ position: m ? 'relative' : 'absolute', top: m ? 0 : 56, ...(mo ? { opacity: v ? 1 : 0, transform: v ? 'none' : 'translateY(80px)', transition: `opacity .9s ${SB2_EASE} 250ms, transform 1.3s ${SB2_EASE} 250ms` } : {}) }}>
              <SBPhone w={pw} style={{ boxShadow: '0 40px 80px -30px rgba(43,26,12,0.45), 0 16px 30px -18px rgba(43,26,12,0.35), inset 0 0 0 1.5px rgba(250,245,236,0.10)' }}><SB2AlemScreen /></SBPhone>
            </div>
          </div>
        </div>
      </SBWrap>
    </section>
  );
}

/* ---------- S7 v2 · FAQ com abertura suave ---------- */
function SobreFaqItemV2({ q, a, open, onToggle, first, uid }) {
  const m = useSB().bp === 'm'; const d = useSBD(); const t = THEMES.light;
  const [h, setH] = React.useState(false);
  return (
    <div style={{ borderTop: first ? 'none' : `1px solid ${t.border2}` }}>
      <h3 style={{ fontSize: 'inherit' }}>
        <button id={`${uid}-q`} aria-expanded={open} aria-controls={`${uid}-a`} onClick={onToggle} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
          style={{ width: '100%', minHeight: m ? 64 : 72, display: 'flex', alignItems: 'center', gap: 16, textAlign: 'left', padding: m ? '14px 16px 14px 18px' : '16px 22px 16px 26px', background: h && !open ? t.surfaceAlt : 'transparent', border: 'none', cursor: 'pointer', fontFamily: SB_B, fontSize: m ? 16 : 17.5, fontWeight: 700, lineHeight: 1.35, color: t.text, transition: 'background .2s' }}>
          <span style={{ flex: 1 }}>{q}</span>
          <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 99, background: open ? t.espresso : t.surface2, color: open ? t.gold : t.text, display: 'grid', placeItems: 'center', flexShrink: 0, transition: `background .35s ${SB2_EASE}, color .35s` }}>
            <span style={{ position: 'relative', width: 14, height: 14, transform: open ? 'rotate(180deg)' : 'none', transition: `transform .5s ${SB2_EASE}` }}>
              <span style={{ position: 'absolute', left: 0, top: 5.8, width: 14, height: 2.4, borderRadius: 2, background: 'currentColor' }} />
              <span style={{ position: 'absolute', left: 5.8, top: 0, width: 2.4, height: 14, borderRadius: 2, background: 'currentColor', transform: open ? 'scaleY(0)' : 'none', transition: `transform .45s ${SB2_EASE}` }} />
            </span>
          </span>
        </button>
      </h3>
      <div id={`${uid}-a`} role="region" aria-labelledby={`${uid}-q`} inert={open ? undefined : ''} style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: `grid-template-rows .55s ${SB2_EASE}` }}>
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          <div style={{ padding: m ? '0 18px 20px' : '0 80px 24px 26px', opacity: open ? 1 : 0, transform: open ? 'none' : 'translateY(-6px)', transition: `opacity .4s ${SB2_EASE} ${open ? 80 : 0}ms, transform .55s ${SB2_EASE}` }}>
            <p style={{ fontSize: d.body, lineHeight: 1.6, color: t.textSec, maxWidth: '64ch', textWrap: 'pretty' }}>{a}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
function SobreFaqV2({ indique, open: initOpen = [0] }) {
  const m = useSB().bp === 'm'; const d = useSBD(); const t = THEMES.light; const mo = useSB2M();
  const uid = React.useId().replace(/:/g, '');
  const ref = React.useRef(null); const v = useInView(ref, mo);
  const items = sobreFaqItems(indique);
  const [open, setOpen] = React.useState(initOpen);
  React.useEffect(() => setOpen(initOpen), [initOpen.join(',')]);
  const toggle = i => setOpen(o => (o.includes(i) ? o.filter(x => x !== i) : [...o, i]));
  return (
    <section aria-labelledby={`${uid}-h`} style={{ paddingBottom: d.secY }}>
      <SBWrap style={{ display: 'grid', gridTemplateColumns: m ? 'minmax(0,1fr)' : 'minmax(0,0.75fr) minmax(0,1.6fr)', gap: m ? 26 : 64, alignItems: 'start' }}>
        <Reveal><SBHead id={`${uid}-h`} eyebrow="Tira-dúvidas" title="Perguntas frequentes" text="Não achou sua resposta? Fale com a gente — o contato está logo abaixo." /></Reveal>
        <div ref={ref} style={{ background: t.surface, borderRadius: 22, border: `1px solid ${t.border2}`, boxShadow: t.shadowSoft, overflow: 'hidden', ...sb2rv(mo, v, 100, 24) }}>
          {items.map(([q, a], i) => <SobreFaqItemV2 key={q} uid={`${uid}-${i}`} q={q} a={a} first={i === 0} open={open.includes(i)} onToggle={() => toggle(i)} />)}
        </div>
      </SBWrap>
    </section>
  );
}

/* ---------- Montagem v2 ----------
   motion: anima (padrão true; desliga sozinho com prefers-reduced-motion)
   sticky: topo fixo que fica sólido ao rolar (só no site, com scroll da janela) */
function SobrePageV2({ bp = 'm', go = null, turnos = SOBRE_CFG.turnos, indique = SOBRE_CFG.indique, faqOpen = [0], only, motion = true, sticky = false }) {
  const t = THEMES.light;
  const mo = motion && !sb2ReducedMotion();
  const has = k => !only || only.includes(k);
  return (
    <ThemeCtx.Provider value={t}>
      <SobreCtx.Provider value={{ bp, go, sticky }}>
        <SB2Motion.Provider value={mo}>
          <div className="sb sb2" style={{ position: 'relative', width: '100%', background: t.appBg, color: t.text, fontFamily: SB_B, WebkitFontSmoothing: 'antialiased' }}>
            <style>{SB_CSS + SB2_CSS}</style>
            {has('hero') && <SobreTopV2 />}
            <main style={only && !has('hero') ? { paddingTop: SB_DIMS[bp].secY * 0.6 } : null}>
              {has('hero') && <SobreHeroV2 turnos={turnos} />}
              {has('steps') && <SobreStepsV2 />}
              {has('core') && <SobreCoreV2 />}
              {has('gancho') && <SobreGanchoV2 />}
              {has('alem') && <SobreAlemV2 />}
              {has('faq') && <SobreFaqV2 indique={indique} open={faqOpen} />}
              {has('trust') && <Reveal><SobreTrust /></Reveal>}
            </main>
            {has('footer') && <SobreFooter />}
          </div>
        </SB2Motion.Provider>
      </SobreCtx.Provider>
    </ThemeCtx.Provider>
  );
}

Object.assign(window, { SobreAgendaCard, SobreStepsV2, SobreCoreV2, SB2CoreNode, SobreGanchoV2, SB2AlemScreen, SobreAlemV2, SobreFaqItemV2, SobreFaqV2, SobrePageV2 });
