import { useEffect, useState } from 'react';
import TopBar from './components/TopBar';
import LeftPanel from './components/LeftPanel';
import { InspectorCard } from './components/RightPanel';
import RealMapView from './three/RealMapView';
import BottomBar from './components/BottomBar';
import RescueCanvas from './three/RescueCanvas';
import { LayerPanel, MapToolbar, Alerts, BuildingFocus, CommandPalette } from './components/Overlays';
import { useStore, fmtClock, fmtAge } from './store';

export default function App() {
  const [view, setView] = useState('Overview');
  const [layersOpen, setLayersOpen] = useState(false);
  const view3d = useStore((s) => s.view3d);
  const highContrast = useStore((s) => s.highContrast);

  useEffect(() => {
    document.body.classList.toggle('hc', highContrast);
  }, [highContrast]);

  return (
    <div className="app">
      <TopBar view={view} setView={setView} />
      <div className="main">
        <aside className="left" aria-label="Fleet and missions"><LeftPanel /></aside>
        <section className="center">
          {view === 'Overview' ? (
            view3d === 'real' ? (
              <>
                <RealMapView />
                <Alerts />
                <InspectorCard />
              </>
            ) : (
              <>
                <RescueCanvas />
                <MapToolbar onLayers={() => setLayersOpen((o) => !o)} />
                <LayerPanel open={layersOpen} onClose={() => setLayersOpen(false)} />
                <Alerts />
                <BuildingFocus />
                <InspectorCard />
              </>
            )
          ) : (
            <SecondaryView view={view} setView={setView} />
          )}
        </section>
      </div>
      <BottomBar />
      <CommandPalette />
    </div>
  );
}

/* ── deeper workflows for nav items (PRD §10) ── */
function SecondaryView({ view, setView }: { view: string; setView: (v: string) => void }) {
  const st = useStore.getState();
  const simTime = useStore((s) => s.simTime);
  const robots = useStore((s) => s.robots);
  const missions = useStore((s) => s.missions);
  const discoveries = useStore((s) => s.discoveries);
  const hazards = useStore((s) => s.hazards);
  const survivors = useStore((s) => s.survivors);
  const events = useStore((s) => s.events);
  const audit = useStore((s) => s.audit);
  const buildings = useStore((s) => s.buildings);

  const wrap: React.CSSProperties = { position: 'absolute', inset: 0, overflowY: 'auto', padding: 22, background: '#070b14' };
  const h: React.CSSProperties = { margin: '0 0 4px', fontSize: 18 };
  const sub: React.CSSProperties = { color: 'var(--mut)', fontSize: 12, marginBottom: 14 };
  const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12 };
  const th: React.CSSProperties = { textAlign: 'left', color: 'var(--mut)', fontSize: 10, letterSpacing: '.1em', padding: '7px 10px', borderBottom: '1px solid var(--line-strong)' };
  const td: React.CSSProperties = { padding: '7px 10px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--mono)' };

  function back() {
    return <button className="btn sm" style={{ marginBottom: 12 }} onClick={() => setView('Overview')}>← Back to Overview</button>;
  }

  if (view === 'Robots') return (
    <div style={wrap}><div>{back()}<h2 style={h}>Fleet — {robots.length} robots</h2>
      <p style={sub}>Health, comms and assignments. Click a row to inspect in Overview.</p>
      <table style={table}><thead><tr><th style={th}>ID</th><th style={th}>STATUS</th><th style={th}>BAT</th><th style={th}>SIG</th><th style={th}>TASK</th><th style={th}>LAST CONTACT</th></tr></thead>
        <tbody>{robots.map((r) => (
          <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => { st.select({ kind: 'robot', id: r.id }); setView('Overview'); st.focus('robot', r.id); }}>
            <td style={td}>{r.id}</td><td style={td}>{r.status}</td><td style={td}>{r.battery.toFixed(0)}%</td>
            <td style={td}>{r.signal.toFixed(0)}%</td><td style={{ ...td, fontFamily: 'inherit' }}>{r.task}</td><td style={td}>{fmtAge(simTime, r.lastContact)}</td>
          </tr>))}</tbody></table></div></div>
  );
  if (view === 'Missions') return (
    <div style={wrap}><div>{back()}<h2 style={h}>Missions — {missions.length}</h2>
      <p style={sub}>Operator-created tasking. Blocked missions need a confirmed reroute.</p>
      <table style={table}><thead><tr><th style={th}>ID</th><th style={th}>TITLE</th><th style={th}>PRI</th><th style={th}>STATUS</th><th style={th}>PROG</th><th style={th}>ROBOTS</th></tr></thead>
        <tbody>{missions.map((m) => (
          <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => { st.select({ kind: 'mission', id: m.id }); }}>
            <td style={td}>{m.id}</td><td style={{ ...td, fontFamily: 'inherit' }}>{m.title}</td><td style={td}>{m.priority}</td>
            <td style={td}>{m.status}</td><td style={td}>{m.progress.toFixed(0)}%</td><td style={td}>{m.robotIds.join(', ')}</td>
          </tr>))}</tbody></table></div></div>
  );
  if (view === 'Discoveries') return (
    <div style={wrap}><div>{back()}<h2 style={h}>Discoveries — {discoveries.length}</h2>
      <p style={sub}>Every robot observation with provenance and confidence.</p>
      <table style={table}><thead><tr><th style={th}>TIME</th><th style={th}>ROBOT</th><th style={th}>LABEL</th><th style={th}>CONF</th><th style={th}>PRI</th></tr></thead>
        <tbody>{[...discoveries].reverse().map((d) => (
          <tr key={d.id}><td style={td}>{fmtClock(d.createdAt)}</td><td style={td}>{d.robotId}</td>
            <td style={{ ...td, fontFamily: 'inherit' }}>{d.label}</td><td style={td}>{Math.round(d.confidence * 100)}%</td><td style={td}>{d.priority}</td></tr>))}</tbody></table></div></div>
  );
  if (view === 'Map') return (
    <div style={wrap}><div>{back()}<h2 style={h}>Map — {buildings.length} structures</h2>
      <p style={sub}>Baseline vs observed. “Unseen” geometry is hypothesis, not truth.</p>
      <table style={table}><thead><tr><th style={th}>ID</th><th style={th}>CONDITION</th><th style={th}>OBSERVED</th><th style={th}>FLOORS</th><th style={th}>FLAGS</th></tr></thead>
        <tbody>{buildings.map((b) => (
          <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => { st.select({ kind: 'building', id: b.id }); setView('Overview'); st.focus('building', b.id); }}>
            <td style={td}>{b.id}</td><td style={td}>{b.condition}</td><td style={td}>{Math.round(b.observed * 100)}%</td>
            <td style={td}>{b.floorsExplored.filter(Boolean).length}/{b.floors}</td>
            <td style={td}>{[b.contradicted && 'CONTRADICTED', b.stale && 'STALE', b.priority && 'PRIORITY'].filter(Boolean).join(' · ') || '—'}</td>
          </tr>))}</tbody></table></div></div>
  );
  if (view === 'Timeline') return (
    <div style={wrap}><div>{back()}<h2 style={h}>Timeline — {events.length} events</h2>
      <p style={sub}>Scrub from the bottom bar to replay. Hazards and survivors filter by replay time.</p>
      {[...events].reverse().map((e) => (
        <div key={e.id} className="feeditem" style={{ paddingLeft: 0 }}>
          <span className="num tm">{fmtClock(e.t)}</span>
          <span className="sevdot" style={{ background: e.severity === 'P0' ? '#f0abfc' : e.severity === 'P1' ? '#fbbf24' : '#475569' }} />
          <span>[{e.kind}] {e.text}</span>
        </div>))}</div></div>
  );
  if (view === 'Log') return (
    <div style={wrap}><div>{back()}<h2 style={h}>Incident log & audit</h2>
      <p style={sub}>Every operational command is recorded with actor and timestamp.</p>
      <h3 style={{ fontSize: 12, color: 'var(--mut)' }}>SURVIVORS ({survivors.length})</h3>
      {survivors.map((s) => <div key={s.id} className="num" style={{ fontSize: 12 }}>{s.id.slice(0, 12)} · {s.status} · F{s.floor} · {Math.round(s.confidence * 100)}% · {s.detectedBy}</div>)}
      <h3 style={{ fontSize: 12, color: 'var(--mut)', marginTop: 14 }}>HAZARDS ({hazards.length})</h3>
      {hazards.map((h) => <div key={h.id} className="num" style={{ fontSize: 12 }}>{fmtClock(h.createdAt)} · {h.label} · {h.severity} · {h.status}</div>)}
      <h3 style={{ fontSize: 12, color: 'var(--mut)', marginTop: 14 }}>AUDIT ({audit.length})</h3>
      {[...audit].reverse().map((a) => <div key={a.id} className="num" style={{ fontSize: 12 }}>{fmtClock(a.t)} · {a.actor} · {a.text}</div>)}
    </div></div>
  );
  return (
    <div style={wrap}><div>{back()}<h2 style={h}>System — local-first status</h2>
      <p style={sub}>No cloud, no map tiles, no API keys. Everything below runs on this machine.</p>
      {[
        ['Mode', 'SIMULATION (clearly badged — never masquerades as live)'],
        ['Map source', 'Real Paris 7e segment (Eiffel Tower) · OpenStreetMap extract, bundled locally · origin at the tower'],
        ['Telemetry', `Local simulation @ ~60 fps render · ${robots.filter((r) => r.status !== 'CommLost').length}/${robots.length} links up`],
        ['Storage', 'In-memory incident model (IndexedDB-ready schema)'],
        ['Network', '0 external requests — offline capable'],
        ['Build', 'React + Three.js + Zustand, bundled locally'],
      ].map(([k, v]) => (
        <div key={k} className="kv" style={{ maxWidth: 640 }}><span className="k">{k}</span><span className="v" style={{ fontFamily: 'inherit' }}>{v}</span></div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="btn sm" onClick={() => st.toggleContrast()}>Toggle high contrast</button>
        <button className="btn sm" onClick={() => st.toggleMotion()}>Toggle reduced motion</button>
        <button className="btn sm danger" onClick={() => st.reset()}>Reset incident</button>
      </div>
    </div></div>
  );
}
