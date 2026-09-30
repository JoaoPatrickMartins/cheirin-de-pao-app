/* ============================================================
   Cheirin de Pão — Primeiro acesso do cliente
   Parte A: telas explicativas (carrossel 3 passos)
   Parte B: tour do app (coach-marks com spotlight)
   ============================================================ */

/* ---------- StepDots (reaproveita o padrão do cadastro) ---------- */
function StepDots({ total, current }) {
  const t = useT();
  return (
    <div style={{ display: 'flex', gap: 7, justifyContent: 'center' }}>
      {Array.from({ length: total }).map((_, i) =>
      <div key={i} style={{ width: i === current ? 24 : 8, height: 8, borderRadius: 99, background: i === current ? t.accent : t.border, transition: 'all .28s cubic-bezier(.22,1,.36,1)' }} />
      )}
    </div>);

}

/* ============================================================
   PARTE A — Telas explicativas
   ============================================================ */

/* Slot de visual — composto só com primitivas (Icon + BreadMark + CSS).
   Estruturado pra trocar o miolo por <img>/Lottie depois. */
function StepVisual({ kind }) {
  const t = useT();
  const tile = {
    position: 'relative', width: '100%', height: 'clamp(150px, 30vh, 248px)', borderRadius: 28,
    overflow: 'hidden', display: 'grid', placeItems: 'center',
    boxShadow: t.shadowSoft
  };

  if (kind === 'compra') {
    return (
      <div style={{ ...tile, background: `linear-gradient(160deg, ${t.goldSoft}, ${t.surface})` }}>
        <div style={{ position: 'absolute', top: -34, right: -28, opacity: 0.12 }}><BreadMark size={170} color={t.accent} /></div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', position: 'relative' }}>
          {/* pedido único */}
          <div style={{ width: 104, height: 132, borderRadius: 22, background: t.surface, border: `1px solid ${t.border2}`, boxShadow: t.shadowSoft, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: t.surface2, display: 'grid', placeItems: 'center', color: t.accent }}><Icon name="bag" size={28} /></div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Avulso</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: t.textTer, marginTop: 2 }}>Pedido único</div>
            </div>
          </div>
          <div style={{ width: 30, height: 30, borderRadius: 99, background: t.espresso, display: 'grid', placeItems: 'center', color: t.gold, flexShrink: 0 }}><Icon name="plus" size={16} stroke={2.6} /></div>
          {/* agenda semanal */}
          <div style={{ width: 104, height: 132, borderRadius: 22, background: t.espresso, boxShadow: t.shadow, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, position: 'relative', overflow: 'hidden' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(227,172,63,0.16)', display: 'grid', placeItems: 'center', color: t.gold }}><Icon name="calendar" size={28} /></div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#E3AC3F' }}>Agenda</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9A876B', marginTop: 2 }}>Semanal</div>
            </div>
          </div>
        </div>
      </div>);

  }

  if (kind === 'gancho') {
    return (
      <div style={{ ...tile, background: `linear-gradient(165deg, ${t.surface2}, ${t.surface})` }}>
        <div style={{ position: 'absolute', top: -30, left: -24, opacity: 0.08 }}><BreadMark size={150} color={t.accent} /></div>
        {/* porta */}
        <div style={{ position: 'relative', width: 150, height: 196, borderRadius: '14px 14px 6px 6px', background: `linear-gradient(110deg, #B0702A, #8A551E)`, boxShadow: '0 22px 40px -22px rgba(43,26,12,0.6)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 14, borderRadius: 8, border: '2px solid rgba(250,245,236,0.16)' }} />
          <div style={{ position: 'absolute', inset: '26px 26px auto 26px', height: 64, borderRadius: 6, border: '2px solid rgba(250,245,236,0.13)' }} />
          {/* maçaneta */}
          <div style={{ position: 'absolute', top: 104, right: 22, width: 11, height: 11, borderRadius: 99, background: '#E3AC3F' }} />
          {/* gancho fixado na porta */}
          <svg width="80" height="70" viewBox="0 0 80 70" style={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)' }} fill="none">
            <path d="M44 6 L44 34 C44 46 28 46 28 36" fill="none" stroke="#241608" strokeWidth="5" strokeLinecap="round" />
            <circle cx="44" cy="6" r="4" fill="#241608" />
          </svg>
        </div>

      </div>);

  }

  // pão quentinho — mesma cena do gancho, com a sacola pendurada nele
  return (
    <div style={{ ...tile, background: `linear-gradient(165deg, ${t.surface2}, ${t.surface})` }}>
      <div style={{ position: 'absolute', top: -30, left: -24, opacity: 0.08 }}><BreadMark size={150} color={t.accent} /></div>
      {/* porta */}
      <div style={{ position: 'relative', width: 150, height: 196, borderRadius: '14px 14px 6px 6px', background: `linear-gradient(110deg, #B0702A, #8A551E)`, boxShadow: '0 22px 40px -22px rgba(43,26,12,0.6)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 14, borderRadius: 8, border: '2px solid rgba(250,245,236,0.16)' }} />
        <div style={{ position: 'absolute', inset: '26px 26px auto 26px', height: 64, borderRadius: 6, border: '2px solid rgba(250,245,236,0.13)' }} />
        {/* maçaneta */}
        <div style={{ position: 'absolute', top: 104, right: 22, width: 11, height: 11, borderRadius: 99, background: '#E3AC3F' }} />
        {/* gancho em J */}
        <svg width="80" height="70" viewBox="0 0 80 70" style={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)' }} fill="none">
          <path d="M44 6 L44 34 C44 46 28 46 28 36" fill="none" stroke="#241608" strokeWidth="5" strokeLinecap="round" />
          <circle cx="44" cy="6" r="4" fill="#241608" />
        </svg>
      </div>
      {/* sacola pendurada no gancho, com alça */}
      <div style={{ position: 'absolute', top: 88, left: '50%', transform: 'translateX(-54%)', width: 64, height: 72, borderRadius: '10px 10px 18px 18px', background: t.surface, border: `1px solid ${t.border}`, boxShadow: t.shadow, display: 'grid', placeItems: 'center' }}>
        <div style={{ position: 'absolute', top: -15, left: '50%', transform: 'translateX(-50%)', width: 30, height: 20, borderRadius: '15px 15px 0 0', border: `3px solid ${t.accent}`, borderBottom: 'none' }} />
        <BreadMark size={42} color={t.accent} />
      </div>
    </div>);

}

const SLIDES = [
{ kind: 'compra', title: 'Peça do seu jeito', body: 'Compre seus pães e escolha: um pedido único ou uma agenda semanal que se repete sozinha.' },
{ kind: 'gancho', title: 'Seu gancho do Cheirin', body: 'Você recebe um gancho para a porta (de acrílico transparente, super discreto). Toda manhã o entregador pendura a sacola de pães fresquinhos nele.' },
{ kind: 'pao', title: 'Pão fresquinho na porta', body: 'É só abrir a porta de manhã e pegar seu pão fresquinho. Todo dia, sem precisar fazer nada.' }];


function OnboardingOverlay({ onFinish }) {
  const t = useT();
  const [step, setStep] = React.useState(0);
  const last = step === SLIDES.length - 1;
  const drag = React.useRef({ x: 0, active: false });

  const next = () => last ? onFinish() : setStep((s) => s + 1);
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const onDown = (e) => {drag.current = { x: e.touches ? e.touches[0].clientX : e.clientX, active: true };};
  const onUp = (e) => {
    if (!drag.current.active) return;
    const x = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const dx = x - drag.current.x;
    drag.current.active = false;
    if (dx < -45 && !last) setStep((s) => s + 1);else
    if (dx > 45 && step > 0) setStep((s) => s - 1);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: t.appBg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <StatusBar />
      {/* topo: marca + pular */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 22px 0' }}>
        <BreadMark size={34} color={t.gold} />
        <button onClick={onFinish} style={{ background: 'none', border: 'none', color: t.textSec, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Hanken Grotesk', padding: '8px 6px' }}>Pular</button>
      </div>

      {/* track */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
      onMouseDown={onDown} onMouseUp={onUp} onTouchStart={onDown} onTouchEnd={onUp}>
        <div style={{ display: 'flex', width: '100%', transform: `translateX(-${step * 100}%)`, transition: 'transform .5s cubic-bezier(.22,1,.36,1)' }}>
          {SLIDES.map((s, i) =>
          <div key={i} style={{ width: '100%', flexShrink: 0, padding: '8px 30px', display: 'flex', flexDirection: 'column' }}>
              <StepVisual kind={s.kind} />
              <div style={{ marginTop: 'clamp(16px, 3vh, 30px)' }}>
                <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 28, letterSpacing: '-0.03em', color: t.text, lineHeight: 1.1 }}>{s.title}</div>
                <div style={{ fontSize: 15.5, color: t.textSec, marginTop: 12, lineHeight: 1.55, maxWidth: 320 }}>{s.body}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* rodapé: dots + navegação */}
      <div style={{ padding: '0 26px 30px', flexShrink: 0 }}>
        <div style={{ marginBottom: 22 }}><StepDots total={SLIDES.length} current={step} /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {step > 0 && <Btn variant="ghost" size="lg" onClick={prev} icon="arrowL">Voltar</Btn>}
          <Btn variant="primary" size="lg" full onClick={next} icon={last ? 'check' : undefined}>
            {last ? 'Começar' : 'Próximo'}
          </Btn>
        </div>
      </div>
    </div>);

}

/* ============================================================
   PARTE B — Tour do App (coach-marks com spotlight)
   ============================================================ */

const TOUR_STOPS = [
{ sel: 'saldo', title: 'Seu saldo, em pães', body: 'Pães disponíveis na sua conta para agendar entregas.' },
{ sel: 'comprar-paes', title: 'Comprar pães', body: 'Sem pães? Compre aqui em segundos, por Pix ou cartão.' },
{ sel: 'entrega-hoje', title: 'Sua entrega do dia', body: 'Acompanhe por aqui quando o pão está a caminho e quando chega.' },
{ sel: 'pedido-avulso', title: 'Avulso ou agenda', body: 'Precisa de pão só num dia? Faça um pedido avulso, único, sem compromisso.' },
{ sel: 'tab-agenda', title: 'Monte sua agenda', body: 'Escolha os dias da semana e pronto — o pão chega sozinho.' },
{ sel: 'tab-perfil', title: 'Recarga automática', body: 'No Perfil (ou na aba Pães) você ativa a recarga automática — seu saldo renova sozinho e você nunca fica sem.' }];


function AppTour({ stageRef, onFinish }) {
  const t = useT();
  const [i, setI] = React.useState(0);
  const [rect, setRect] = React.useState(null);
  const stop = TOUR_STOPS[i];
  const last = i === TOUR_STOPS.length - 1;

  const measureRef = React.useRef();
  measureRef.current = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const el = stage.querySelector(`[data-tour="${TOUR_STOPS[i].sel}"]`);
    if (!el) return;
    const sr0 = stage.getBoundingClientRect();
    const er0 = el.getBoundingClientRect();
    if (typeof el.scrollIntoView === 'function' && (er0.top < sr0.top + 8 || er0.bottom > sr0.bottom - 8)) {
      el.scrollIntoView({ block: 'center' });
    }
    const er = el.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    const next = { top: er.top - sr.top, left: er.left - sr.left, width: er.width, height: er.height };
    setRect((prev) => prev && Math.abs(prev.top - next.top) < 0.5 && Math.abs(prev.left - next.left) < 0.5 && Math.abs(prev.width - next.width) < 0.5 && Math.abs(prev.height - next.height) < 0.5 ? prev : next);
  };

  // re-mede a cada render (i fresco, sem closure obsoleta) + tenta de novo enquanto anima
  React.useLayoutEffect(() => {measureRef.current();});
  React.useEffect(() => {
    const m = () => measureRef.current();
    const timers = [16, 80, 200, 360].map((ms) => setTimeout(m, ms));
    window.addEventListener('resize', m);
    const stage = stageRef.current;
    stage && stage.addEventListener('scroll', m, true);
    return () => {timers.forEach(clearTimeout);window.removeEventListener('resize', m);stage && stage.removeEventListener('scroll', m, true);};
  }, [i, stageRef]);

  React.useEffect(() => {
    const onKey = (e) => {if (e.key === 'Escape') onFinish();};
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFinish]);

  const next = () => last ? onFinish() : setI((n) => n + 1);
  const prev = () => setI((n) => Math.max(0, n - 1));

  const pad = 6;
  const spot = rect ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;

  // balão acima ou abaixo conforme espaço (alvo na metade de baixo → balão acima)
  const stageH = stageRef.current ? stageRef.current.getBoundingClientRect().height : 800;
  const below = spot ? spot.top + spot.height / 2 < stageH * 0.5 : true;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 100 }} role="dialog" aria-modal="true">
      {/* backdrop + recorte via box-shadow gigante */}
      <div onClick={next} style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}>
        {spot &&
        <div style={{ position: 'absolute', top: spot.top, left: spot.left, width: spot.width, height: spot.height, borderRadius: 18, boxShadow: '0 0 0 9999px rgba(20,12,4,0.62)', pointerEvents: 'none', transition: 'all .42s cubic-bezier(.22,1,.36,1)', outline: `2px solid ${t.gold}`, outlineOffset: 2 }} />
        }
      </div>

      {/* balão */}
      {spot &&
      <div aria-live="polite" style={{
        position: 'absolute', left: 18, right: 18,
        [below ? 'top' : 'bottom']: below ? spot.top + spot.height + 16 : stageH - spot.top + 16,
        zIndex: 101, transition: 'all .42s cubic-bezier(.22,1,.36,1)'
      }}>
          {/* seta */}
          <div style={{ position: 'absolute', [below ? 'top' : 'bottom']: -7, left: Math.max(20, Math.min(spot.left + spot.width / 2 - 18, 300)), width: 16, height: 16, background: t.surface, transform: 'rotate(45deg)', borderRadius: 3, boxShadow: below ? '-2px -2px 4px rgba(43,26,12,0.05)' : '2px 2px 4px rgba(43,26,12,0.05)' }} />
          <div style={{ position: 'relative', background: t.surface, borderRadius: 22, padding: 20, boxShadow: t.shadow, border: `1px solid ${t.border2}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: t.accent, letterSpacing: '0.04em' }}>{i + 1} de {TOUR_STOPS.length}</span>
              <button onClick={onFinish} style={{ background: 'none', border: 'none', color: t.textTer, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Hanken Grotesk' }}>Pular</button>
            </div>
            <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em', color: t.text }}>{stop.title}</div>
            <div style={{ fontSize: 14, color: t.textSec, marginTop: 7, lineHeight: 1.5 }}>{stop.body}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18 }}>
              <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                {TOUR_STOPS.map((_, k) => <div key={k} style={{ width: k === i ? 18 : 7, height: 7, borderRadius: 99, background: k === i ? t.accent : t.border, transition: 'all .25s' }} />)}
              </div>
              {i > 0 && <Btn variant="ghost" size="sm" onClick={prev}>Anterior</Btn>}
              <Btn variant="primary" size="sm" onClick={next} icon={last ? 'check' : 'chevR'}>{last ? 'Concluir' : 'Próximo'}</Btn>
            </div>
          </div>
        </div>
      }
    </div>);

}

/* ============================================================
   Home real do cliente novo (saldo 0) — com âncoras data-tour
   ============================================================ */
function TourHome() {
  const t = useT();
  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 90 }}>
      <Greet saldo={0} />
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* saldo + comprar */}
        <div data-tour="saldo">
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ background: `linear-gradient(135deg, ${t.espresso}, #2E1D0D)`, padding: '22px 22px 20px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', bottom: -50, right: -30, opacity: 0.1 }}><BreadMark size={200} color="#E3AC3F" /></div>
              <div style={{ position: 'relative' }}>
                <div style={{ fontSize: 12.5, color: '#C7B595', fontWeight: 600, letterSpacing: '0.04em' }}>SEUS PÃES</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                  <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 52, color: '#FAF5EC', lineHeight: 1, letterSpacing: '-0.03em' }}>0</span>
                  <span style={{ fontSize: 16, color: '#E3AC3F', fontWeight: 700 }}>pães</span>
                </div>
                <div style={{ fontSize: 12.5, color: '#9A876B', marginTop: 8 }}>Compre seus primeiros pães pra começar</div>
              </div>
            </div>
            <div style={{ display: 'flex', padding: 12, gap: 10 }}>
              <div data-tour="comprar-paes" style={{ flex: 1, display: 'flex' }}>
                <Btn variant="gold" full icon="plus">Comprar pães</Btn>
              </div>
            </div>
          </Card>
        </div>

        {/* entrega de hoje — estado vazio (cliente novo) */}
        <div data-tour="entrega-hoje">
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: 13 }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, background: t.surface2, display: 'grid', placeItems: 'center', color: t.textTer, flexShrink: 0 }}>
                <Icon name="truck" size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11.5, color: t.textTer, fontWeight: 700, letterSpacing: '0.06em' }}>ENTREGA DE HOJE</div>
                <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 17, color: t.text, marginTop: 2 }}>Nenhuma entrega agendada</div>
              </div>
            </div>
          </Card>
        </div>

        <div data-tour="pedido-avulso"><QuickActions go={() => {}} /></div>
        <NextDays />
      </div>
    </div>);

}

/* Tab bar com âncora na aba Agenda */
function TourTabBar() {
  const t = useT();
  const tabs = [
  { k: 'home', ic: 'home', l: 'Início' },
  { k: 'agenda', ic: 'calendar', l: 'Agenda' },
  { k: 'paes', ic: 'bag', l: 'Pães' },
  { k: 'history', ic: 'clock', l: 'Pedidos' },
  { k: 'perfil', ic: 'user', l: 'Perfil' }];

  return (
    <div style={{ flexShrink: 0, display: 'flex', borderTop: `1px solid ${t.border2}`, background: t.surface, padding: '8px 8px calc(8px + env(safe-area-inset-bottom, 0px))' }}>
      {tabs.map((tb) => {
        const on = tb.k === 'home';
        return (
          <button key={tb.k} data-tour={tb.k === 'agenda' ? 'tab-agenda' : tb.k === 'perfil' ? 'tab-perfil' : undefined} aria-label={tb.l} style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '6px 0', color: on ? t.accent : t.textTer }}>
            <Icon name={tb.ic} size={23} stroke={on ? 2.3 : 2} />
            <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 600 }}>{tb.l}</span>
          </button>);

      })}
    </div>);

}

/* ============================================================
   Shell — orquestra fases: slides → tour → done
   ============================================================ */
function OnboardingShell() {
  const [phase, setPhase] = React.useState('slides'); // slides | tour | done
  const stageRef = React.useRef(null);
  const t = useT();

  const finishSlides = () => setPhase('tour');
  const finishTour = () => setPhase('done');
  const restart = () => {setPhase('done');setTimeout(() => setPhase('slides'), 30);};

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#C9BBA2' }}>
      {/* barra de controle do protótipo */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 22px', color: '#241608', flexWrap: 'wrap' }}>
        <BreadMark size={30} color="#E3AC3F" />
        <div>
          <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em', lineHeight: 1 }}>Cheirin de Pão</div>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', opacity: 0.6, fontWeight: 600, marginTop: 2 }}>PRIMEIRO ACESSO</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 3, background: 'rgba(43,26,12,0.06)', borderRadius: 11, padding: 3 }}>
          {[{ k: 'slides', l: '1 · Telas' }, { k: 'tour', l: '2 · Tour' }].map((o) => {
            const on = phase === o.k || o.k === 'tour' && phase === 'done';
            return <button key={o.k} onClick={() => o.k === 'slides' ? restart() : setPhase('tour')} style={{ border: 'none', cursor: 'pointer', padding: '7px 13px', borderRadius: 8, fontWeight: 700, fontSize: 13, fontFamily: 'Hanken Grotesk', background: on ? '#fff' : 'transparent', color: on ? '#241608' : 'rgba(43,26,12,0.45)', boxShadow: on ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}>{o.l}</button>;
          })}
        </div>
        <button onClick={restart} style={{ background: 'none', border: '1px solid rgba(43,26,12,0.18)', borderRadius: 10, padding: '7px 12px', cursor: 'pointer', color: 'inherit', fontWeight: 700, fontSize: 12.5, fontFamily: 'Hanken Grotesk', opacity: 0.85 }}>↺ Reiniciar</button>
      </div>

      {/* palco */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px 26px', minHeight: 0 }}>
        <div ref={stageRef} style={{ position: 'relative', width: 390, height: '100%', maxHeight: 820, background: t.appBg, borderRadius: 40, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 40px 90px -30px rgba(43,26,12,0.45), 0 0 0 1px rgba(43,26,12,0.04)' }}>
          {/* Home real por baixo */}
          <StatusBar />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <TourHome />
          </div>
          <TourTabBar />

          {/* Parte A */}
          {phase === 'slides' && <OnboardingOverlay onFinish={finishSlides} />}
          {/* Parte B */}
          {phase === 'tour' && <AppTour stageRef={stageRef} onFinish={finishTour} />}

          {/* badge de concluído */}
          {phase === 'done' &&
          <div style={{ position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: t.espresso, color: '#FAF5EC', padding: '11px 18px', borderRadius: 14, fontSize: 13.5, fontWeight: 700, boxShadow: t.shadow, display: 'flex', alignItems: 'center', gap: 9, animation: 'fadeUp .4s ease', textAlign: "center", width: "250px" }}>
              <Icon name="check" size={18} color="#E3AC3F" /> Tudo pronto! Bem-Vindo ao Cheirin de Pão!
            </div>
          }
        </div>
      </div>
    </div>);

}

function OnboardingApp() {
  return (
    <ThemeCtx.Provider value={THEMES.light}>
      <OnboardingShell />
    </ThemeCtx.Provider>);

}

ReactDOM.createRoot(document.getElementById('root')).render(<OnboardingApp />);