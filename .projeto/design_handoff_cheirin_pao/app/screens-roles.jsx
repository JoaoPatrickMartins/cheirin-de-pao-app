/* ============================================================
   Cheirin de Pão — Entregador
   Lista de entregas + Rota (mapa) entre condomínios
   ============================================================ */

function CourierScreen() {
  const t = useT();
  const [view, setView] = React.useState('lista');
  const [data, setData] = React.useState(() => JSON.parse(JSON.stringify(ENTREGAS)));
  const [open, setOpen] = React.useState(0);
  const totalParadas = data.reduce((a, c) => a + c.paradas.length, 0);
  const feitas = data.reduce((a, c) => a + c.paradas.filter(p => p.feito).length, 0);
  const toggle = (ci, pi) => setData(d => { const n = JSON.parse(JSON.stringify(d)); n[ci].paradas[pi].feito = !n[ci].paradas[pi].feito; return n; });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '4px 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, background: t.espresso, display: 'grid', placeItems: 'center' }}><BreadMark size={27} color="#E3AC3F" /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, color: t.textTer, fontWeight: 600 }}>Rota de hoje · 11 jun</div>
            <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 18, color: t.text, letterSpacing: '-0.02em' }}>Olá, Seu Antônio</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px 12px' }}>
        <div style={{ display: 'flex', gap: 6, background: t.surface2, borderRadius: 13, padding: 4 }}>
          {[['lista', 'Lista', 'list'], ['rota', 'Rota', 'route']].map(([k, l, ic]) => (
            <button key={k} onClick={() => setView(k)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13.5, fontFamily: 'Hanken Grotesk', background: view === k ? t.surface : 'transparent', color: view === k ? t.text : t.textSec, boxShadow: view === k ? t.shadowSoft : 'none' }}><Icon name={ic} size={17} />{l}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        <Card pad={0} style={{ overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ background: t.espresso, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', bottom: -40, right: -16, opacity: 0.12 }}><BreadMark size={130} color="#E3AC3F" /></div>
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 11.5, color: '#E3AC3F', fontWeight: 700, letterSpacing: '0.06em' }}>PROGRESSO</div>
              <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 26, color: '#FAF5EC', marginTop: 2 }}>{feitas}/{totalParadas} paradas</div>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ position: 'relative', textAlign: 'right' }}>
              <div style={{ fontSize: 11.5, color: '#C7B595', fontWeight: 600, whiteSpace: 'nowrap' }}>Total de pães</div>
              <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 26, color: '#E3AC3F' }}>{data.reduce((a, c) => a + c.total, 0)}</div>
            </div>
          </div>
          <div style={{ height: 6, background: t.surface2 }}>
            <div style={{ height: '100%', width: `${(feitas / totalParadas) * 100}%`, background: t.gold, transition: 'width .3s' }} />
          </div>
        </Card>
      </div>

      {view === 'rota' ? <CourierRoute data={data} /> : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.map((c, ci) => {
            const done = c.paradas.filter(p => p.feito).length;
            const isOpen = open === ci;
            return (
              <Card key={ci} pad={0} style={{ overflow: 'hidden' }}>
                <div onClick={() => setOpen(isOpen ? -1 : ci)} style={{ cursor: 'pointer', padding: '15px 16px', display: 'flex', alignItems: 'center', gap: 13 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 11, background: t.gold, color: t.onGold, display: 'grid', placeItems: 'center', flexShrink: 0, fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 16 }}>{ci + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 16, color: t.text, letterSpacing: '-0.02em' }}>{c.condo}</div>
                    <div style={{ fontSize: 12.5, color: t.textTer, marginTop: 1 }}>{c.bairro} · {c.total} pães · {c.paradas.length} paradas</div>
                  </div>
                  {done === c.paradas.length
                    ? <Pill tone="good"><Icon name="check" size={13} />Ok</Pill>
                    : <Pill tone="gold">{done}/{c.paradas.length}</Pill>}
                  <Icon name="chevD" size={18} color={t.textTer} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                </div>
                {isOpen && (
                  <div style={{ borderTop: `1px solid ${t.border2}`, padding: '6px 0' }}>
                    <div style={{ padding: '6px 16px 2px', fontSize: 11, color: t.textTer, fontWeight: 700, letterSpacing: '0.04em' }}>ORDEM SUGERIDA NO PRÉDIO</div>
                    {c.paradas.map((p, pi) => (
                      <div key={pi} onClick={() => toggle(ci, pi)} style={{ cursor: 'pointer', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ width: 22, height: 22, borderRadius: 99, background: t.surface2, color: t.textSec, display: 'grid', placeItems: 'center', flexShrink: 0, fontWeight: 800, fontSize: 12, fontFamily: 'Bricolage Grotesque, sans-serif' }}>{pi + 1}</span>
                        <div style={{ width: 28, height: 28, borderRadius: 9, border: `2px solid ${p.feito ? t.good : t.border}`, background: p.feito ? t.good : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0, transition: 'all .15s' }}>
                          {p.feito && <Icon name="check" size={16} color={t.name === 'dark' ? '#1E1207' : '#fff'} stroke={3} />}
                        </div>
                        <div style={{ flex: 1, opacity: p.feito ? 0.5 : 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14.5, color: t.text, textDecoration: p.feito ? 'line-through' : 'none' }}>{p.ap}</div>
                          <div style={{ fontSize: 12.5, color: t.textTer }}>{p.cliente}</div>
                        </div>
                        <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 17, color: t.accent }}>{p.qtd}🥖</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Rota: mapa estilizado com ordem de paradas (sec. 4.2) ---------- */
function CourierRoute({ data }) {
  const t = useT();
  // posições fixas no "mapa" (viewBox 0..320 x 0..300)
  const pts = [
    { x: 60, y: 70 }, { x: 230, y: 120 }, { x: 110, y: 210 }, { x: 250, y: 250 },
  ];
  const stops = data.map((c, i) => ({ ...c, ...pts[i % pts.length] }));
  const mapBg = t.name === 'dark' ? '#241608' : '#EFE6D3';
  const road = t.name === 'dark' ? 'rgba(250,245,236,0.10)' : 'rgba(43,26,12,0.10)';
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px' }}>
      <Card pad={0} style={{ overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ position: 'relative', background: mapBg, height: 290 }}>
          <svg viewBox="0 0 320 300" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            {/* malha de ruas */}
            {[40, 110, 180, 250].map(y => <line key={'h' + y} x1="0" y1={y} x2="320" y2={y} stroke={road} strokeWidth="10" />)}
            {[60, 150, 240].map(x => <line key={'v' + x} x1={x} y1="0" x2={x} y2="300" stroke={road} strokeWidth="10" />)}
            {/* rota */}
            <polyline points={stops.map(s => `${s.x},${s.y}`).join(' ')} fill="none" stroke={t.gold} strokeWidth="4" strokeDasharray="2 9" strokeLinecap="round" />
            {/* pinos */}
            {stops.map((s, i) => (
              <g key={i}>
                <circle cx={s.x} cy={s.y} r="16" fill={t.espresso} />
                <circle cx={s.x} cy={s.y} r="16" fill="none" stroke={t.gold} strokeWidth="2.5" />
                <text x={s.x} y={s.y + 5} textAnchor="middle" fontSize="15" fontWeight="800" fill="#E3AC3F" fontFamily="Bricolage Grotesque, sans-serif">{i + 1}</text>
              </g>
            ))}
            <g>
              <circle cx="60" cy="70" r="6" fill={t.good} />
            </g>
          </svg>
          <div style={{ position: 'absolute', left: 14, bottom: 14, display: 'flex', gap: 8, alignItems: 'center', background: t.surface, borderRadius: 10, padding: '7px 11px', boxShadow: t.shadowSoft }}>
            <Icon name="route" size={16} color={t.accent} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: t.text }}>~9,2 km · 4 paradas</span>
          </div>
        </div>
      </Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {stops.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, background: t.surface, borderRadius: 16, border: `1px solid ${t.border2}`, padding: '13px 16px' }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: t.gold, color: t.onGold, display: 'grid', placeItems: 'center', flexShrink: 0, fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 15 }}>{i + 1}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: t.text }}>{c.condo}</div>
              <div style={{ fontSize: 12, color: t.textTer }}>{c.bairro} · {c.total} pães</div>
            </div>
            <span style={{ fontSize: 12.5, color: t.textSec, fontWeight: 700 }}>{['07:05', '07:25', '07:45', '08:05'][i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { CourierScreen, CourierRoute });
