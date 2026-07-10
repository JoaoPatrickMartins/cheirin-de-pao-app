/* ============================================================
   Cheirin de Pão — Shell do protótipo
   ============================================================ */
const { useState, useEffect } = React;

const LS = 'cheirin_proto_v1';
function loadState() {
  try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; }
}
function saveState(s) {
  try { localStorage.setItem(LS, JSON.stringify(s)); } catch {}
}

/* Tab bar do cliente */
function TabBar({ route, go }) {
  const t = useT();
  const tabs = [
    { k: 'home', ic: 'home', l: 'Início' },
    { k: 'schedule', ic: 'calendar', l: 'Agenda' },
    { k: 'combos', ic: 'wallet', l: 'Créditos' },
    { k: 'history', ic: 'clock', l: 'Pedidos' },
  ];
  return (
    <div style={{ flexShrink: 0, display: 'flex', borderTop: `1px solid ${t.border2}`, background: t.surface, padding: '8px 8px calc(8px + env(safe-area-inset-bottom, 0px))' }}>
      {tabs.map(tb => {
        const on = route === tb.k || (tb.k === 'home' && route === 'home');
        return (
          <button key={tb.k} onClick={() => go(tb.k)} style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '6px 0', color: on ? t.accent : t.textTer }}>
            <Icon name={tb.ic} size={23} stroke={on ? 2.3 : 2} />
            <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 600 }}>{tb.l}</span>
          </button>
        );
      })}
    </div>
  );
}

/* A tela do cliente (com tab bar). Mantém roteamento interno. */
function ClientApp({ theme, homeVar, pricing }) {
  const init = loadState();
  const [route, setRoute] = useState(init.route && ['install', 'login', 'onboarding'].includes(init.route) ? init.route : 'install');
  const [saldo, setSaldo] = useState(init.saldo ?? 38);
  const [lastBuy, setLastBuy] = useState(0);

  useEffect(() => { saveState({ ...loadState(), route, saldo }); }, [route, saldo]);

  const go = r => setRoute(r);
  const onBuy = qtd => { setSaldo(s => s + qtd); setLastBuy(qtd); };

  const showTabs = ['home', 'schedule', 'combos', 'history', 'single'].includes(route);
  const HomeComp = { A: HomeA, B: HomeB, C: HomeC }[homeVar] || HomeA;

  let screen;
  switch (route) {
    case 'install': screen = <InstallScreen go={go} />; break;
    case 'login': screen = <LoginScreen go={go} />; break;
    case 'onboarding': screen = <OnboardingScreen go={go} />; break;
    case 'home': screen = <HomeComp go={go} saldo={saldo} />; break;
    case 'combos': screen = <CombosScreen go={go} onBuy={onBuy} pricing={pricing} />; break;
    case 'purchased': screen = <PurchasedScreen go={go} lastBuy={lastBuy} />; break;
    case 'schedule': screen = <ScheduleScreen go={go} saldo={saldo} />; break;
    case 'single': screen = <SingleScreen go={go} saldo={saldo} />; break;
    case 'history': screen = <HistoryScreen go={go} />; break;
    case 'autobuy': screen = <AutoBuyScreen go={go} />; break;
    case 'track': screen = <TrackScreen go={go} />; break;
    case 'notifs': screen = <NotifsScreen go={go} />; break;
    default: screen = <HomeComp go={go} saldo={saldo} />;
  }

  return (
    <>
      {route !== 'install' && <StatusBar />}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>{screen}</div>
      {showTabs && <TabBar route={route} go={go} />}
    </>
  );
}

/* Wrapper de tela com status bar para entregador/admin */
function RoleApp({ children }) {
  return (
    <>
      <StatusBar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>{children}</div>
    </>
  );
}

/* Segmented control reutilizável (chrome) */
function Seg({ options, value, onChange, dark }) {
  const bg = dark ? 'rgba(255,255,255,0.08)' : 'rgba(43,26,12,0.06)';
  const fg = dark ? '#FAF5EC' : '#241608';
  const sub = dark ? 'rgba(250,245,236,0.5)' : 'rgba(43,26,12,0.45)';
  const surf = dark ? '#33230F' : '#fff';
  return (
    <div style={{ display: 'flex', gap: 3, background: bg, borderRadius: 11, padding: 3 }}>
      {options.map(o => {
        const on = value === o.k;
        return (
          <button key={o.k} onClick={() => onChange(o.k)} style={{ border: 'none', cursor: 'pointer', padding: '7px 13px', borderRadius: 8, fontWeight: 700, fontSize: 13, fontFamily: 'Hanken Grotesk', background: on ? surf : 'transparent', color: on ? fg : sub, boxShadow: on ? '0 1px 3px rgba(0,0,0,0.12)' : 'none', transition: 'all .15s', whiteSpace: 'nowrap' }}>{o.l}</button>
        );
      })}
    </div>
  );
}

function App() {
  const init = loadState();
  const [themeName, setThemeName] = useState(init.themeName || 'light');
  const [role, setRole] = useState(init.role || 'cliente');
  const [homeVar, setHomeVar] = useState(init.homeVar || 'A');
  const [pricing, setPricing] = useState(init.pricing || PRICING_DEFAULT);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => { saveState({ ...loadState(), themeName, role, homeVar, pricing }); }, [themeName, role, homeVar, pricing]);

  const t = THEMES[themeName];

  const resetFlow = () => {
    const s = loadState();
    delete s.route; delete s.saldo;
    saveState(s);
    setResetKey(k => k + 1);
  };

  const pageBg = themeName === 'dark' ? '#0E0902' : '#C9BBA2';

  return (
    <ThemeCtx.Provider value={t}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: pageBg, transition: 'background .3s' }}>
        {/* Chrome de controle */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16, padding: '12px 22px', flexWrap: 'wrap', color: themeName === 'dark' ? '#FAF5EC' : '#241608' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <BreadMark size={30} color="#E3AC3F" />
            <div>
              <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em', lineHeight: 1 }}>Cheirin de Pão</div>
              <div style={{ fontSize: 10, letterSpacing: '0.16em', opacity: 0.6, fontWeight: 600, marginTop: 2 }}>PROTÓTIPO DO APP</div>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <Seg dark={themeName === 'dark'} value={role} onChange={setRole} options={[{ k: 'cliente', l: 'Cliente' }, { k: 'entregador', l: 'Entregador' }, { k: 'admin', l: 'Admin' }]} />
            {role === 'cliente' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 11, opacity: 0.55, fontWeight: 700, letterSpacing: '0.04em' }}>HOME</span>
                <Seg dark={themeName === 'dark'} value={homeVar} onChange={setHomeVar} options={[{ k: 'A', l: 'A' }, { k: 'B', l: 'B' }, { k: 'C', l: 'C' }]} />
              </div>
            )}
            <Seg dark={themeName === 'dark'} value={themeName} onChange={setThemeName} options={[{ k: 'light', l: '☀ Claro' }, { k: 'dark', l: '☾ Escuro' }]} />
            {role === 'cliente' && (
              <button onClick={resetFlow} title="Reiniciar fluxo" style={{ background: 'none', border: `1px solid ${themeName === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(43,26,12,0.18)'}`, borderRadius: 10, padding: '7px 12px', cursor: 'pointer', color: 'inherit', fontWeight: 700, fontSize: 12.5, fontFamily: 'Hanken Grotesk', opacity: 0.85 }}>↺ Reiniciar</button>
            )}
          </div>
        </div>

        {/* Palco com a tela */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px 26px', minHeight: 0 }}>
          <div style={{ width: 390, height: '100%', maxHeight: 820, background: t.appBg, borderRadius: 40, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: themeName === 'dark' ? '0 40px 90px -30px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)' : '0 40px 90px -30px rgba(43,26,12,0.45), 0 0 0 1px rgba(43,26,12,0.04)', transition: 'background .3s' }}>
            {role === 'cliente' && <ClientApp key={resetKey} theme={themeName} homeVar={homeVar} pricing={pricing} />}
            {role === 'entregador' && <RoleApp><CourierScreen /></RoleApp>}
            {role === 'admin' && <RoleApp><AdminScreen pricing={pricing} setPricing={setPricing} /></RoleApp>}
          </div>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
