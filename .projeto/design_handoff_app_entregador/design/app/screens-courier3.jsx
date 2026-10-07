/* ============================================================
   App do Entregador — Rota
   E8 Iniciar rota · E9 Rota ativa (mapa) · E10 Encerrar/resumo · E11 Realizadas
   ============================================================ */

/* ---------- Mapa (Leaflet + OSM). Sem Leaflet, cai num mapa esquemático. ----------
   stops: [{ ll, n, done, label }] · me: [lat,lng] · base: [lat,lng]
   path: 'route' (traçado) · 'points' (só pontos) · couriers: [{ ll, ini, stale }] (admin) */
function crPath(pts) {
  const out = [];
  pts.forEach((p, i) => { if (i) { const a = pts[i - 1]; out.push([a[0], p[1]]); } out.push(p); });
  return out;
}
/* No app real: tiles do OpenStreetMap (tile.openstreetmap.org). No protótipo usamos Esri, que aceita o domínio do preview. */
const CR_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
function CRMap({ h = 290, stops = [], me, base = ROUTE_CFG.base.ll, path = 'route', couriers, radius = 22, label, dim, pinBase }) {
  const t = useT();
  const ref = React.useRef(null);
  const ok = typeof window !== 'undefined' && window.L;
  const [vis, setVis] = React.useState(!window.CR_LAZY_MAPS);
  React.useEffect(() => {
    if (vis || !ref.current || !window.IntersectionObserver) { setVis(true); return; }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setVis(true); io.disconnect(); } }, { rootMargin: '150px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  React.useEffect(() => {
    if (!ok || !vis || !ref.current) return;
    const L = window.L;
    const map = L.map(ref.current, { zoomControl: false, attributionControl: true, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false, tap: false });
    L.tileLayer(CR_TILES, { maxZoom: 19, attribution: 'Tiles © Esri · © OpenStreetMap' }).addTo(map);
    const pts = stops.filter(s => s.ll).map(s => s.ll);
    const line = [base, ...pts].filter(Boolean);
    if (path !== 'none' && line.length > 1) {
      const ll = path === 'route' ? crPath(line) : line;
      if (path === 'route') L.polyline(ll, { color: '#1E1207', weight: 7, opacity: 0.12 }).addTo(map);
      L.polyline(ll, { color: '#E3AC3F', weight: 4.5, dashArray: path === 'route' ? '2 9' : '1 12', lineCap: 'round', opacity: path === 'route' ? 1 : 0.8 }).addTo(map);
    }
    if (base) L.marker(base, { icon: L.divIcon({ className: '', iconSize: [34, 34], iconAnchor: [17, 17], html: `<div style="width:34px;height:34px;border-radius:11px;background:#FAF5EC;border:2.5px solid #1E1207;display:grid;place-items:center;box-shadow:0 3px 8px rgba(0,0,0,.25)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E1207" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${pinBase ? Ic.pin : Ic.home}"/></svg></div>` }) }).addTo(map);
    stops.filter(s => s.ll).forEach(s => {
      const bg = s.done ? '#DCEBDF' : s.next ? '#E3AC3F' : '#1E1207';
      const fg = s.done ? '#3E7C53' : s.next ? '#1E1207' : '#E3AC3F';
      const inner = s.done ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3E7C53" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="${Ic.check}"/></svg>` : s.n;
      L.marker(s.ll, { icon: L.divIcon({ className: '', iconSize: [34, 34], iconAnchor: [17, 17], html: `<div style="width:34px;height:34px;border-radius:10px;background:${bg};color:${fg};display:grid;place-items:center;font:800 15px 'Bricolage Grotesque',sans-serif;box-shadow:0 3px 8px rgba(0,0,0,.3);border:2px solid ${s.done ? '#3E7C53' : '#E3AC3F'};opacity:${s.done ? 0.85 : 1}">${inner}</div>` }) }).addTo(map);
    });
    if (me) L.marker(me, { icon: L.divIcon({ className: '', iconSize: [44, 44], iconAnchor: [22, 22], html: `<div style="width:44px;height:44px;border-radius:99px;background:rgba(62,124,83,.22);display:grid;place-items:center;animation:crHalo 2s ease-out infinite"><div style="width:18px;height:18px;border-radius:99px;background:#3E7C53;border:3.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div></div>` }) }).addTo(map);
    (couriers || []).forEach(c => L.marker(c.ll, { icon: L.divIcon({ className: '', iconSize: [48, 56], iconAnchor: [24, 52], html: `<div style="display:flex;flex-direction:column;align-items:center;opacity:${c.stale ? 0.6 : 1}"><div style="width:42px;height:42px;border-radius:99px;background:#1E1207;color:#E3AC3F;border:3px solid ${c.stale ? '#A89A82' : '#3E7C53'};display:grid;place-items:center;font:800 14px 'Bricolage Grotesque',sans-serif;box-shadow:0 4px 10px rgba(0,0,0,.35)">${c.ini}</div><div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${c.stale ? '#A89A82' : '#3E7C53'}"></div></div>` }) }).addTo(map));
    const all = [...line, ...(me ? [me] : []), ...(couriers || []).map(c => c.ll)];
    if (all.length > 1) map.fitBounds(L.latLngBounds(all), { padding: [34, 34] }); else map.setView(all[0] || base, 16);
    return () => map.remove();
  }, [vis]);
  return (
    <div style={{ position: 'relative', zIndex: 0, isolation: 'isolate', height: h, borderRadius: radius, overflow: 'hidden', background: '#EFE6D3', border: `1px solid ${t.border2}` }}>
      {ok ? <div ref={ref} className="cr-map" style={{ position: 'absolute', inset: 0, opacity: dim ? 0.6 : 1 }} /> : (
        <svg viewBox="0 0 320 290" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>{[40, 110, 180, 250].map(y => <line key={y} x1="0" y1={y} x2="320" y2={y} stroke="rgba(43,26,12,.1)" strokeWidth="10" />)}{[60, 150, 240].map(x => <line key={x} x1={x} y1="0" x2={x} y2="290" stroke="rgba(43,26,12,.1)" strokeWidth="10" />)}</svg>
      )}
      {label && <div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 500, display: 'flex', gap: 7, alignItems: 'center', background: t.surface, borderRadius: 12, padding: '8px 12px', boxShadow: t.shadowSoft, fontSize: 13, fontWeight: 800, color: t.text }}><Icon name="route" size={16} color={t.accent} />{label}</div>}
    </div>
  );
}
const crStopsFrom = (list, nextIdx) => list.map((c, i) => ({ ll: c.ll, n: i + 1, done: c.paradas.every(p => p.status !== 'pendente'), next: i === nextIdx }));
const CR_ME = [-23.5628, -46.6552];

/* ---------- E8 — Iniciar rota (sheet). st: normal · noloc · starting · local */
function CRStartSheet({ st = 'normal', r = ROTAS_HOJE[0] }) {
  const t = useT();
  const local = st === 'local';
  return (
    <CRSheet title="Iniciar rota">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 18, background: t.espresso, color: '#FAF5EC' }}>
        <span style={{ fontSize: 28 }}>{r.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 19 }}>{r.nome} · {r.paradas} paradas</div>
          <div style={{ fontSize: 13.5, color: '#C7B595', fontWeight: 600 }}>~{crN(r.km)} km · {r.dur} · saída {r.hora}</div>
        </div>
      </div>
      <CRLabel style={{ marginTop: 18 }}>Ponto de partida</CRLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <CRChoice ic="home" on={!local} note={ROUTE_CFG.base.endereco}>Base — {ROUTE_CFG.base.nome}</CRChoice>
        <CRChoice ic="locate" on={local} disabled={st === 'noloc'} note={st === 'noloc' ? 'Localização desligada no celular' : 'Onde você está agora'}>Minha localização</CRChoice>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        <CRNote ic="bell" tone="gold">Ao iniciar, seus clientes veem que o pão saiu para entrega.</CRNote>
        {st === 'noloc'
          ? <CRNote ic="alert" tone="danger">Sem permissão de localização: a rota começa na base e a operação não vê sua posição no mapa ao vivo. <b style={{ textDecoration: 'underline' }}>Permitir localização</b></CRNote>
          : <CRNote ic="pin">Sua localização é compartilhada com a operação só durante a rota.</CRNote>}
      </div>
      <div style={{ height: 18 }} />
      <CRBig icon={st === 'starting' ? null : 'play'} h={62} right={st === 'starting' ? <CRSpin color={t.gold} /> : null}>{st === 'starting' ? 'Iniciando…' : 'Iniciar rota'}</CRBig>
    </CRSheet>
  );
}

/* ---------- Escolher app de mapas (1º toque em Navegar) ---------- */
function CRNavSheet({ iphone = false, sel = 'google' }) {
  const t = useT();
  const apps = [['google', 'Google Maps', 'pin'], ['waze', 'Waze', 'navigate'], ...(iphone ? [['apple', 'Apple Maps', 'locate']] : [])];
  return (
    <CRSheet title="Abrir com qual app?" sub="O app de mapas do celular faz a navegação até o prédio.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{apps.map(([k, l, ic]) => <CRChoice key={k} ic={ic} on={sel === k}>{l}</CRChoice>)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 4px' }}><span style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>Lembrar minha escolha</span><Switch on onChange={() => {}} /></div>
      <CRBig icon="external">Abrir {apps.find(a => a[0] === sel)[1]}</CRBig>
      <div style={{ textAlign: 'center', fontSize: 12.5, color: t.textTer, marginTop: 10, fontWeight: 600 }}>Dá para trocar depois em Perfil › Preferências.</div>
    </CRSheet>
  );
}

/* ---------- Card "Próxima parada" ---------- */
function CRNextStop({ c = CR_ENTREGAS[0], idx = 0, arrived }) {
  const t = useT();
  const pend = c.paradas.filter(p => p.status === 'pendente');
  const paes = pend.reduce((a, p) => a + p.qtd, 0), cest = pend.filter(p => p.cesta).length;
  return (
    <div style={{ background: arrived ? t.good : t.surface, color: arrived ? '#fff' : t.text, borderRadius: 22, padding: 16, boxShadow: t.shadow, border: arrived ? 'none' : `1px solid ${t.border2}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: arrived ? 'rgba(255,255,255,0.2)' : t.gold, color: arrived ? '#fff' : t.onGold, display: 'grid', placeItems: 'center', fontFamily: CR_H, fontWeight: 800, fontSize: 20, flexShrink: 0 }}>{arrived ? <Icon name="pin" size={22} color="#fff" /> : idx + 1}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: arrived ? 'rgba(255,255,255,0.8)' : t.textTer }}>{arrived ? 'VOCÊ CHEGOU' : 'PRÓXIMA PARADA'}</div>
          <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{arrived ? `Você chegou ao ${c.condo}` : c.condo}</div>
        </div>
        {!arrived && <div style={{ textAlign: 'right' }}><div style={{ fontSize: 11.5, color: t.textTer, fontWeight: 700 }}>previsto</div><div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 18 }}>{c.eta}</div></div>}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10, color: arrived ? 'rgba(255,255,255,0.92)' : t.textSec }}>{pend.length} portas · {paes} pães{cest ? ` · ${cest} Cestinha${cest > 1 ? 's' : ''}` : ''}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {arrived ? <CRBig variant="light" icon="list" style={{ flex: 1, background: '#fff', color: t.good, border: 'none' }}>Abrir lista do prédio</CRBig> : <>
          <CRBig icon="navigate" style={{ flex: 1.1 }}>Navegar</CRBig>
          <CRBig variant="ghost" icon="list" style={{ flex: 1, fontSize: 15 }}>Lista do prédio</CRBig>
        </>}
      </div>
    </div>
  );
}

/* ---------- Ordem de paradas (normal / reordenando) ---------- */
function CRStopOrder({ list, reorder, altered, nomapIdx, start = 0 }) {
  const t = useT();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {list.map((c, i) => {
        const done = c.paradas.every(p => p.status !== 'pendente');
        const lifted = reorder && i === 2;
        return (
          <div key={c.condo} style={{ display: 'flex', alignItems: 'center', gap: 12, background: t.surface, borderRadius: 16, border: `1.5px solid ${lifted ? t.gold : t.border2}`, padding: '0 14px', minHeight: 62, boxShadow: lifted ? t.shadow : 'none', transform: lifted ? 'scale(1.02) rotate(-0.6deg)' : 'none', opacity: done && !reorder ? 0.6 : 1 }}>
            {reorder && <span style={{ color: t.textTer, display: 'grid', placeItems: 'center', width: 28, height: 44 }}><Icon name="grip" size={22} stroke={3.4} /></span>}
            <div style={{ width: 32, height: 32, borderRadius: 10, background: done ? t.goodSoft : t.gold, color: done ? t.good : t.onGold, display: 'grid', placeItems: 'center', flexShrink: 0, fontFamily: CR_H, fontWeight: 800, fontSize: 15 }}>{done && !reorder ? <Icon name="check" size={16} stroke={3} /> : i + 1 + start}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: t.text, textDecoration: done && !reorder ? 'line-through' : 'none' }}>{c.condo}</div>
              <div style={{ fontSize: 12.5, color: t.textTer, fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}>{c.paradas.length} paradas{nomapIdx === i && <CRTag ic="pin" tone="warn" size="sm">sem mapa</CRTag>}{altered && i === 1 && <CRTag ic="repeat" size="sm">mudou hoje</CRTag>}</div>
            </div>
            {!reorder && <span style={{ fontSize: 14, color: done ? t.good : t.textSec, fontWeight: 800 }}>{done ? 'feito' : c.eta}</span>}
          </div>
        );
      })}
    </div>
  );
}

/* ===== E9 — Aba Rota
   st: pronta · emrota · arrived · reorder · altered · noloc · nomap · nopath · done · dois */
function CRRouteTab({ st = 'emrota', embedded }) {
  const t = useT();
  const done = st === 'done';
  const list = done ? crAllDone(CR_ENTREGAS) : st === 'pronta' ? CR_ENTREGAS.map(c => ({ ...c, paradas: c.paradas.map(p => ({ ...p, status: 'pendente' })) })) : st === 'altered' || st === 'reorder' ? [CR_ENTREGAS[0], CR_ENTREGAS[2], CR_ENTREGAS[1], CR_ENTREGAS[3]] : CR_ENTREGAS;
  const nextIdx = done ? -1 : 0;
  let stops = crStopsFrom(list, nextIdx);
  if (st === 'nomap') stops = stops.map((s, i) => i === 3 ? { ...s, ll: null } : s);
  const me = ['emrota', 'arrived', 'altered', 'nomap', 'nopath', 'dois'].includes(st) ? (st === 'arrived' ? [-23.5643, -46.6535] : CR_ME) : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {st === 'dois' && (
        <div style={{ display: 'flex', gap: 6 }}>
          {ROTAS_HOJE.map((r, i) => <button key={r.turno} style={{ flex: 1, height: 44, borderRadius: 13, border: `2px solid ${i === 0 ? t.text : t.border}`, background: i === 0 ? t.text : t.surface, color: i === 0 ? t.appBg : t.text, fontWeight: 800, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>{r.emoji} {r.nome} · {i === 0 ? 'em rota' : 'pronta'}</button>)}
        </div>
      )}
      {st === 'altered' && <CRNote ic="repeat" tone="gold">Ordem alterada hoje. Amanhã volta a rota padrão.</CRNote>}
      {st === 'noloc' && <CRNote ic="locate" tone="danger">Localização desligada — o mapa não mostra onde você está. <b style={{ textDecoration: 'underline' }}>Permitir</b></CRNote>}
      {st === 'nopath' && <CRNote ic="route">Não conseguimos traçar o caminho agora. Os pontos seguem na ordem da rota.</CRNote>}
      <div style={{ position: 'relative' }}>
        <CRMap h={st === 'reorder' ? 220 : 290} stops={stops} me={me} path={st === 'nopath' ? 'points' : 'route'} label={`~${crN(st === 'altered' ? 9.8 : 9.2)} km · ${list.length} prédios`} dim={st === 'reorder'} />
        {me && <div style={{ position: 'absolute', right: 12, top: 12, zIndex: 500 }}><CRIconBtn icon="locate" label="Centralizar em mim" /></div>}
      </div>
      {st === 'pronta' && <CRNote ic="route">Esta é a sua rota salva. O traçado começa na base — {ROUTE_CFG.base.nome}.</CRNote>}
      {['emrota', 'altered', 'noloc', 'nomap', 'nopath', 'dois'].includes(st) && <CRNextStop c={list[0]} idx={0} />}
      {st === 'arrived' && <CRNextStop c={list[0]} idx={0} arrived />}
      {done && (
        <div style={{ background: t.goodSoft, borderRadius: 22, padding: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 34 }}>🥖</div>
          <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 22, color: t.text, marginTop: 4 }}>Tudo entregue!</div>
          <div style={{ fontSize: 14, color: t.textSec, marginTop: 4, marginBottom: 14 }}>Confira o resumo e encerre a rota da manhã.</div>
          <CRBig variant="gold" icon="flag">Encerrar rota</CRBig>
        </div>
      )}
      <CRLabel style={{ marginTop: 4 }} right={COURIER.regras.podeReordenar && !['reorder', 'done'].includes(st) ? <button style={{ height: 36, padding: '0 12px', borderRadius: 11, border: `1.5px solid ${t.border}`, background: t.surface, color: t.text, fontWeight: 800, fontSize: 13, fontFamily: 'inherit', display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}><Icon name="grip" size={15} stroke={3} />Reordenar</button> : null}>Ordem de paradas</CRLabel>
      {st === 'reorder' && <CRNote ic="alert" tone="gold"><b>Essa ordem vale só para hoje.</b> A operação vê a mudança e pode adotar como rota padrão.</CRNote>}
      <CRStopOrder list={list} reorder={st === 'reorder'} altered={st === 'altered'} nomapIdx={st === 'nomap' ? 3 : -1} />
      {st === 'reorder' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CRBig icon="check">Salvar ordem de hoje</CRBig>
          <CRBig variant="ghost" icon="refresh">Voltar à rota padrão</CRBig>
        </div>
      )}
    </div>
  );
}

/* ===== E10 — Encerrar rota / resumo do turno
   st: pend · ok · nofuel · done */
function CREndScreen({ st = 'ok' }) {
  const t = useT();
  const pend = st === 'pend';
  const stats = [['Entregues', '11', 'check', t.good], ['Não entregues', '1', 'x', t.danger], ['Pães', '64', null, t.accent, '🥖'], ['Cestinhas', '6', 'basket', t.accent], ['Ganchos', '1', 'hook', t.accent], ['Duração', '1h28', 'clock', t.accent]];
  if (st === 'done') return (
    <div style={{ flex: 1, background: t.espresso, color: '#FAF5EC', display: 'flex', flexDirection: 'column', padding: '20px 22px 28px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -60, right: -60, opacity: 0.1 }}><BreadMark size={300} color="#E3AC3F" /></div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
        <div style={{ width: 84, height: 84, borderRadius: 28, background: '#E3AC3F', display: 'grid', placeItems: 'center', animation: 'crPop .3s ease-out' }}><Icon name="flag" size={40} color="#1E1207" stroke={2.3} /></div>
        <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 36, letterSpacing: '-0.03em', lineHeight: 1.05, marginTop: 22 }}>Rota da manhã concluída 🥖</div>
        <div style={{ fontSize: 16, color: '#C7B595', marginTop: 10, lineHeight: 1.5 }}>11 portas com pão fresquinho. Encerrada às 06:40.</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          {[['11', 'entregas'], ['64', 'pães'], ['~9,6 km', 'estimado']].map(([v, l]) => <div key={l} style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 16, padding: '12px 12px' }}><div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 22, color: '#E3AC3F' }}>{v}</div><div style={{ fontSize: 12.5, color: '#C7B595', fontWeight: 600 }}>{l}</div></div>)}
        </div>
      </div>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 16, background: 'rgba(227,172,63,0.12)', fontSize: 14.5, fontWeight: 700 }}>🌇 Próxima: Tarde · 16:00 · 5 paradas</div>
        <CRBig variant="gold">Voltar ao início</CRBig>
      </div>
    </div>
  );
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <AppBar title="Encerrar rota" onBack={() => {}} />
      <div className="cr-col" style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CRTurnoChip r={ROTAS_HOJE[0]} /><span style={{ fontSize: 13.5, fontWeight: 700, color: t.textSec }}>05:12 → {pend ? 'agora' : '06:40'}</span></div>
        {pend && (
          <Card pad={0} style={{ overflow: 'hidden', border: `2px solid ${t.danger}` }}>
            <div style={{ padding: '12px 16px', background: t.dangerSoft, color: t.danger, fontWeight: 800, fontSize: 14.5, display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="alert" size={18} stroke={2.3} />Resolva antes de encerrar</div>
            {[['list', '2 paradas sem desfecho', 'Edifício Aurora · Apto 63, Vila Verde · A 3', 'Resolver'], ['ban', '1 sem foto', 'Condomínio Bela Vista · Apto 74', 'Tirar foto'], ['cloudOff', '3 envios pendentes', 'Sobem quando o sinal voltar', 'Tentar agora']].map(([ic, h, s, a], i) => (
              <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: i ? `1px solid ${t.border2}` : 'none' }}>
                <Icon name={ic} size={20} color={t.danger} stroke={2.2} />
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 800, fontSize: 15, color: t.text }}>{h}</div><div style={{ fontSize: 12.5, color: t.textSec }}>{s}</div></div>
                <button style={{ height: 44, padding: '0 12px', borderRadius: 12, border: 'none', background: t.espresso, color: '#FAF5EC', fontWeight: 800, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>{a}</button>
              </div>
            ))}
          </Card>
        )}
        <CRLabel style={{ marginTop: 4 }}>Resumo do turno</CRLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {stats.map(([l, v, ic, c, em]) => (
            <div key={l} style={{ background: t.surface, borderRadius: 16, padding: '12px 12px', border: `1px solid ${t.border2}` }}>
              <div style={{ color: c, height: 18 }}>{em ? <span style={{ fontSize: 15 }}>{em}</span> : <Icon name={ic} size={17} stroke={2.4} />}</div>
              <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 24, color: t.text, marginTop: 4 }}>{pend && l === 'Entregues' ? '9' : v}</div>
              <div style={{ fontSize: 12, color: t.textSec, fontWeight: 700 }}>{l}</div>
            </div>
          ))}
        </div>
        {st !== 'nofuel' ? (
          <Card pad={16} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: t.goldSoft, color: t.accent, display: 'grid', placeItems: 'center' }}><Icon name="fuel" size={22} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 20, color: t.text }}>~9,6 km · ≈ R$ 1,54</div>
              <div style={{ fontSize: 12.5, color: t.textSec, marginTop: 2, lineHeight: 1.4 }}>Estimado pela rota planejada, com a volta à base · 38 km/l · gasolina R$ 6,09</div>
            </div>
          </Card>
        ) : <CRNote ic="fuel">~9,6 km estimados. Sem consumo do veículo cadastrado, não calculamos combustível.</CRNote>}
      </div>
      <div style={{ padding: '10px 16px 22px' }}>
        <CRBig variant="gold" icon="flag" h={62} disabled={pend}>Encerrar rota</CRBig>
        {pend && <div style={{ textAlign: 'center', fontSize: 13, color: t.textSec, fontWeight: 700, marginTop: 8 }}>Libera quando as pendências forem resolvidas</div>}
      </div>
    </div>
  );
}

/* ===== E11 — Realizadas
   st: full · empty · reported · embedded: dentro da E1 */
function CRDoneList({ st = 'full', embedded }) {
  const t = useT();
  if (st === 'empty') return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: t.textSec }}>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: t.surface2, display: 'grid', placeItems: 'center', margin: '0 auto', color: t.textTer }}><Icon name="check" size={30} /></div>
      <div style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 20, color: t.text, marginTop: 14 }}>Nada por aqui ainda</div>
      <div style={{ fontSize: 14, marginTop: 6 }}>As entregas confirmadas hoje aparecem aqui, com a foto.</div>
    </div>
  );
  const groups = CR_ENTREGAS.map(c => ({ ...c, paradas: c.paradas.filter(p => p.status !== 'pendente') })).filter(c => c.paradas.length);
  const ent = groups.reduce((a, c) => a + c.paradas.filter(p => p.status === 'entregue').length, 0);
  const nao = groups.reduce((a, c) => a + c.paradas.filter(p => p.status === 'nao_entregue').length, 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {[[ent, 'entregues', 'check', t.good], [nao, 'não entregue', 'x', t.danger], [38, 'pães', null, t.accent]].map(([v, l, ic, c]) => <div key={l} style={{ flex: 1, background: t.surface, borderRadius: 16, padding: '10px 12px', border: `1px solid ${t.border2}` }}><div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: CR_H, fontWeight: 800, fontSize: 22, color: t.text }}>{ic ? <Icon name={ic} size={16} color={c} stroke={3} /> : '🥖'}{v}</div><div style={{ fontSize: 12, fontWeight: 700, color: t.textSec }}>{l}</div></div>)}
      </div>
      {groups.map(c => (
        <Card key={c.condo} pad={0} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', fontFamily: CR_H, fontWeight: 700, fontSize: 16.5, color: t.text, borderBottom: `1px solid ${t.border2}` }}>{c.condo}</div>
          {c.paradas.map((p, i) => {
            const rep = st === 'reported' && p.id === 's2';
            return (
              <div key={p.id} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderTop: i ? `1px solid ${t.border2}` : 'none', alignItems: 'flex-start' }}>
                {p.foto === 'ok' ? <CRPhotoPh w={56} h={56} r={12} /> : <div style={{ width: 56, height: 56, borderRadius: 12, background: t.surface2, display: 'grid', placeItems: 'center', color: p.foto === 'sem' ? t.danger : t.textTer, flexShrink: 0 }}><Icon name={p.foto === 'sem' ? 'ban' : p.foto === 'enviando' ? 'cloudUp' : 'cloudOff'} size={22} /></div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><span style={{ fontWeight: 800, fontSize: 15, color: t.text, flex: 1 }}>{p.bloco ? `Bloco ${p.bloco} · ` : ''}{crApto(p)}</span><span style={{ fontFamily: CR_H, fontWeight: 800, fontSize: 14, color: t.textSec }}>{p.hora}</span></div>
                  <div style={{ fontSize: 13, color: t.textSec }}>{p.cliente}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                    {p.status === 'entregue' ? <CRTag ic="check" tone="good" size="sm">entregue</CRTag> : <CRTag ic="x" tone="danger" size="sm">não entregue · {p.motivo}</CRTag>}
                    {p.foto !== 'ok' && <CRProof s={p.foto} />}
                    {rep && <CRTag ic="alert" tone="gold" size="sm">reportado</CRTag>}
                  </div>
                  {!rep && <button style={{ marginTop: 4, height: 36, padding: 0, background: 'none', border: 'none', color: t.accent, fontWeight: 800, fontSize: 13, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}><Icon name="alert" size={14} stroke={2.4} />Reportar problema</button>}
                </div>
              </div>
            );
          })}
        </Card>
      ))}
    </div>
  );
}
function CRReportSheet({ sel = 'Confirmei por engano', st }) {
  const t = useT();
  return (
    <CRSheet title="Reportar problema" sub="Apto 204 · Bloco 1 · Pedro Alves · 05:33">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{['Confirmei por engano', 'Deixei no apartamento errado', 'Outro'].map(l => <CRChoice key={l} on={sel === l}>{l}</CRChoice>)}</div>
      <CRTextarea value={sel === 'Outro' ? '' : 'Escaneei o cupom do 204 mas o saquinho ainda está comigo'} placeholder="Conte o que aconteceu (opcional)" style={{ marginTop: 10 }} />
      <CRNote ic="alert" style={{ marginTop: 12 }}>A entrega não é desfeita. A operação recebe o aviso e resolve.</CRNote>
      <div style={{ height: 16 }} />
      <CRBig icon="send">{st === 'sending' ? 'Enviando…' : 'Enviar para a operação'}</CRBig>
    </CRSheet>
  );
}

/* E9 — variações da aba Rota, só o trecho que muda */
function CRRouteVariants() {
  const t = useT();
  const V = ({ l, children }) => <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.1em', color: t.textTer }}>{l}</div>{children}</div>;
  const alt = [CR_ENTREGAS[0], CR_ENTREGAS[2], CR_ENTREGAS[1]];
  return (
    <div style={{ width: 390, padding: '20px 16px', background: t.appBg, display: 'flex', flexDirection: 'column', gap: 26 }}>
      <V l="VOCÊ CHEGOU · ~80 M DO PRÉDIO"><CRNextStop c={CR_ENTREGAS[0]} arrived /></V>
      <V l="ORDEM ALTERADA HOJE"><CRNote ic="repeat" tone="gold">Ordem alterada hoje. Amanhã volta a rota padrão.</CRNote><CRStopOrder list={alt} altered /></V>
      <V l="SEM PERMISSÃO DE LOCALIZAÇÃO"><CRNote ic="locate" tone="danger">Localização desligada — o mapa não mostra onde você está. <b style={{ textDecoration: 'underline' }}>Permitir</b></CRNote><CRMap h={170} stops={crStopsFrom(CR_ENTREGAS, 0)} label="sem “você está aqui”" /></V>
      <V l="PRÉDIO SEM LOCALIZAÇÃO NO MAPA"><CRStopOrder list={CR_ENTREGAS.slice(2)} start={2} nomapIdx={1} /></V>
      <V l="ROTA SEM TRAÇADO · SÓ PONTOS"><CRNote ic="route">Não conseguimos traçar o caminho agora. Os pontos seguem na ordem da rota.</CRNote><CRMap h={170} stops={crStopsFrom(CR_ENTREGAS, 0)} path="points" me={CR_ME} /></V>
    </div>
  );
}

Object.assign(window, { CRRouteVariants, crPath, CRMap, crStopsFrom, CR_ME, CRStartSheet, CRNavSheet, CRNextStop, CRStopOrder, CRRouteTab, CREndScreen, CRDoneList, CRReportSheet });
