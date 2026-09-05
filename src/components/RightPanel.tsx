import { useState } from 'react';
import { Crosshair, Navigation, Pause, RotateCcw, OctagonX, HeartPulse, Flame, TriangleAlert, Eye } from 'lucide-react';
import { useStore, fmtClock, fmtAge, confLabel } from '../store';

type Tab = 'Selected' | 'Hazards' | 'Survivors' | 'Discoveries';

export default function RightPanel() {
  const [tab, setTab] = useState<Tab>('Selected');
  const selection = useStore((s) => s.selection);
  const simTime = useStore((s) => s.simTime);
  const hazards = useStore((s) => s.hazards);
  const survivors = useStore((s) => s.survivors);
  const discoveries = useStore((s) => s.discoveries);
  const robots = useStore((s) => s.robots);
  const buildings = useStore((s) => s.buildings);
  const missions = useStore((s) => s.missions);
  const routes = useStore((s) => s.routes);

  return (
    <>
      <div className="tabs" role="tablist">
        {(['Selected', 'Hazards', 'Survivors', 'Discoveries'] as Tab[]).map((t) => (
          <button key={t} role="tab" className={tab === t ? 'on' : ''}
            onClick={() => setTab(t)}>
            {t}{t === 'Hazards' && hazards.filter((h) => h.status === 'active').length ? ` (${hazards.filter((h) => h.status === 'active').length})` : ''}
            {t === 'Survivors' && survivors.length ? ` (${survivors.length})` : ''}
          </button>
        ))}
      </div>
      <div className="scroll insp" style={{ flex: 1 }}>
        {tab === 'Selected' && <SelectedTab />}
        {tab === 'Hazards' && (
          <div>
            {hazards.length === 0 && <p style={{ color: 'var(--mut)' }}>No hazards recorded yet.</p>}
            {[...hazards].reverse().map((h) => (
              <HazCard key={h.id} id={h.id} />
            ))}
          </div>
        )}
        {tab === 'Survivors' && (
          <div>
            {survivors.length === 0 && <p style={{ color: 'var(--mut)' }}>No survivor detections yet. Thermal/audio sweep in progress.</p>}
            {[...survivors].reverse().map((s) => (
              <SurvCard key={s.id} id={s.id} />
            ))}
          </div>
        )}
        {tab === 'Discoveries' && (
          <div>
            {[...discoveries].reverse().slice(0, 40).map((d) => (
              <div key={d.id} className="feeditem" style={{ paddingLeft: 0, paddingRight: 0 }}
                onClick={() => { useStore.getState().select({ kind: 'discovery', id: d.id }); }}>
                <span className="sevdot" style={{ background: d.priority === 'P0' ? '#f0abfc' : d.priority === 'P1' ? '#fbbf24' : '#475569' }} />
                <div>
                  <div style={{ fontWeight: 700 }}>{d.label}</div>
                  <div style={{ color: 'var(--mut)', fontSize: 11 }}>{d.detail}</div>
                  <div className="num" style={{ color: 'var(--dim)', fontSize: 10.5, marginTop: 2 }}>
                    {d.robotId} · {Math.round(d.confidence * 100)}% {confLabel(d.confidence)} · {fmtAge(simTime, d.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <ProvenanceFooter robots={robots.length} buildings={buildings.length} missions={missions.length} routes={routes.length} />
    </>
  );
}

function ProvenanceFooter({ robots, buildings, missions, routes }: { robots: number; buildings: number; missions: number; routes: number }) {
  return (
    <div style={{ borderTop: '1px solid var(--line)', padding: '7px 12px', fontSize: 10.5, color: 'var(--dim)' }}>
      <span className="num">{robots} robots · {buildings} structures · {missions} missions · {routes} routes</span>
      <div style={{ marginTop: 2 }}>Baseline ≠ truth — teal is robot-confirmed.</div>
    </div>
  );
}

function SelectedTab() {
  const selection = useStore((s) => s.selection);
  const simTime = useStore((s) => s.simTime);
  const st = useStore.getState();
  if (!selection) {
    return (
      <div style={{ paddingTop: 14 }}>
        <h2 style={{ fontSize: 14 }}>Nothing selected</h2>
        <p className="sub">Click a robot, building, hazard or survivor in the 3D view — or press <b>Ctrl/⌘ K</b> for the command palette.</p>
        <div className="sec"><h3>HOW TO READ THIS MAP</h3>
          <LegendMini />
        </div>
        <div className="sec"><h3>QUICK ACTIONS</h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn sm" onClick={() => st.gotoPreset('survivors')}>Survivors</button>
            <button className="btn sm" onClick={() => st.gotoPreset('hazards')}>Hazards</button>
            <button className="btn sm" onClick={() => st.gotoPreset('comms')}>Comms</button>
            <button className="btn sm" onClick={() => st.startMissionDraft('SearchSurvivors')}>+ Mission</button>
          </div>
        </div>
      </div>
    );
  }
  if (selection.kind === 'robot') return <RobotDetail id={selection.id} simTime={simTime} />;
  if (selection.kind === 'building') return <BuildingDetail id={selection.id} simTime={simTime} />;
  if (selection.kind === 'hazard') return <HazCard id={selection.id} full />;
  if (selection.kind === 'survivor') return <SurvCard id={selection.id} full />;
  if (selection.kind === 'mission') return <MissionDetail id={selection.id} />;
  const d = st.discoveries.find((x) => x.id === selection.id);
  if (!d) return <p style={{ color: 'var(--mut)' }}>Discovery aged out of buffer.</p>;
  return (
    <div style={{ paddingTop: 10 }}>
      <span className="pill">{d.kind}</span> <span className="pill">{d.priority}</span>
      <h2>{d.label}</h2>
      <p className="sub">{d.detail}</p>
      <Provenance robotId={d.robotId} at={d.createdAt} conf={d.confidence} simTime={simTime} />
    </div>
  );
}

export function LegendMini() {
  const rows: [string, string][] = [
    ['#3b4c63', 'Baseline (imported, unverified) — low opacity'],
    ['#2dd4bf', 'Observed reality (robot-confirmed) — solid'],
    ['#f472b6', 'Contradicted — baseline proven wrong'],
    ['#fbbf24', 'Uncertain / stale — verify before committing'],
    ['#ef4444', 'Danger / critical hazard'],
    ['#f0abfc', 'Survivor detection — highest priority'],
  ];
  return (
    <div>
      {rows.map(([c, t]) => (
        <div key={t} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11.5, color: 'var(--mut)', padding: '2px 0' }}>
          <span className="sw" style={{ background: c }} /> {t}
        </div>
      ))}
    </div>
  );
}

function Provenance({ robotId, at, conf, simTime, extra }: { robotId: string; at: number; conf: number; simTime: number; extra?: string }) {
  return (
    <div className="sec" style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', background: 'rgba(148,163,184,.04)' }}>
      <h3>WHY DOES THE SYSTEM BELIEVE THIS?</h3>
      <div className="kv"><span className="k">Source</span><span className="v">{robotId}</span></div>
      <div className="kv"><span className="k">Observed</span><span className="v">{fmtClock(at)} · {fmtAge(simTime, at)}</span></div>
      <div className="kv"><span className="k">Confidence</span><span className="v">{Math.round(conf * 100)}% · {confLabel(conf)}</span></div>
      <div className="confbar" style={{ marginTop: 4 }}><div style={{ width: `${conf * 100}%`, background: conf > 0.75 ? 'var(--ok)' : conf > 0.45 ? 'var(--warn)' : 'var(--bad)' }} /></div>
      {extra && <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 5 }}>{extra}</div>}
    </div>
  );
}

function RobotDetail({ id, simTime }: { id: string; simTime: number }) {
  const r = useStore((s) => s.robots.find((x) => x.id === id));
  const focus = useStore((s) => s.focus);
  const updateRobotStatus = useStore((s) => s.updateRobotStatus);
  const reconnectRobot = useStore((s) => s.reconnectRobot);
  const allDiscoveries = useStore((s) => s.discoveries);
  const discoveries = allDiscoveries.filter((d) => d.robotId === id).slice(-4).reverse();
  if (!r) return null;
  return (
    <div style={{ paddingTop: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontFamily: 'var(--mono)' }}>{r.id}</h2>
        <span className="st" style={{ borderColor: 'var(--acc)', color: 'var(--acc)' }}>{r.status.toUpperCase()}</span>
      </div>
      <div className="sub">{r.kind} · {r.task}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <button className="btn sm pri" onClick={() => focus('robot', r.id)}><Crosshair size={12} /> Focus <span className="num" style={{ opacity: .6 }}>F</span></button>
        {r.status === 'CommLost'
          ? <button className="btn sm warn" onClick={() => reconnectRobot(r.id)}><RotateCcw size={12} /> Reconnect</button>
          : <button className="btn sm" onClick={() => updateRobotStatus(r.id, 'Returning')}><Navigation size={12} /> Return</button>}
        <button className="btn sm" onClick={() => updateRobotStatus(r.id, r.status === 'Waiting' ? 'Exploring' : 'Waiting')}><Pause size={12} /> {r.status === 'Waiting' ? 'Resume' : 'Hold'}</button>
        <button className="btn sm danger" onClick={() => { if (confirm(`Emergency stop ${r.id}?`)) updateRobotStatus(r.id, 'Estop'); }}><OctagonX size={12} /> E-stop</button>
      </div>
      <div className="sec"><h3>MISSION</h3>
        <div className="kv"><span className="k">Assignment</span><span className="v">{r.missionId ?? '—'}</span></div>
        <div className="kv"><span className="k">Position</span><span className="v">{r.pos.x.toFixed(1)}, {r.pos.z.toFixed(1)} ±{r.uncertainty.toFixed(1)}m</span></div>
        <div className="kv"><span className="k">Location</span><span className="v">{r.buildingId ?? 'open ground'}</span></div>
      </div>
      <div className="sec"><h3>HEALTH · COMMS</h3>
        <div className="kv"><span className="k">Battery</span><span className="v">{r.battery.toFixed(1)}%</span></div>
        <div className="meter"><div style={{ width: `${r.battery}%`, background: r.battery < 20 ? 'var(--crit)' : 'var(--ok)' }} /></div>
        <div className="kv" style={{ marginTop: 4 }}><span className="k">Signal</span><span className="v">{r.signal.toFixed(0)}% · {r.latencyMs.toFixed(0)} ms · {r.packetLoss.toFixed(1)}% loss</span></div>
        <div className="kv"><span className="k">Last contact</span><span className="v">{fmtAge(simTime, r.lastContact)}</span></div>
        <div className="kv"><span className="k">Core temp</span><span className="v">{r.temp.toFixed(1)}°C</span></div>
      </div>
      <div className="sec"><h3>SENSORS</h3>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {Object.entries(r.sensors).map(([k, v]) => <span key={k} className="pill" style={{ opacity: v ? 1 : 0.35 }}>● {k}</span>)}
        </div>
      </div>
      <div className="sec"><h3>RECENT DISCOVERIES</h3>
        {discoveries.length === 0 && <div className="sub">None yet.</div>}
        {discoveries.map((d) => (
          <div key={d.id} style={{ fontSize: 11.5, padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
            <b>{d.label}</b><br /><span style={{ color: 'var(--mut)' }}>{Math.round(d.confidence * 100)}% · {fmtAge(simTime, d.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BuildingDetail({ id, simTime }: { id: string; simTime: number }) {
  const b = useStore((s) => s.buildings.find((x) => x.id === id));
  const st = useStore.getState();
  if (!b) return null;
  const hz = st.hazards.filter((h) => h.buildingId === id && h.status === 'active');
  const sv = st.survivors.filter((x) => x.buildingId === id);
  const explored = b.floorsExplored.filter(Boolean).length;
  return (
    <div style={{ paddingTop: 6 }}>
      <h2>{b.label}</h2>
      <div className="sub">{b.floors} floors · {b.condition.toUpperCase()} · {Math.round(b.observed * 100)}% observed</div>
      <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
        {b.contradicted && <span className="pill" style={{ color: '#f9a8d4', borderColor: '#f472b6' }}>⚠ BASELINE CONTRADICTED</span>}
        {b.stale && <span className="pill" style={{ color: '#fde68a', borderColor: '#fbbf24' }}>STALE — REVERIFY</span>}
        {b.priority && <span className="pill" style={{ color: '#f0abfc', borderColor: '#f0abfc' }}>★ PRIORITY</span>}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <button className="btn sm pri" onClick={() => { st.setIsolated(id); st.focus('building', id); }}><Eye size={12} /> Isolate + explode</button>
        <button className="btn sm" onClick={() => st.focus('building', id)}><Crosshair size={12} /> Frame</button>
      </div>
      <div className="sec"><h3>FLOORS · {explored}/{b.floors} EXPLORED</h3>
        {b.floorsExplored.map((f, i) => (
          <div key={i} className="kv"><span className="k">Floor {i === 0 ? 'G' : i}</span>
            <span className="v" style={{ color: f ? 'var(--ok)' : 'var(--dim)' }}>{f ? 'observed' : 'unseen'}</span></div>
        ))}
      </div>
      {(hz.length > 0 || sv.length > 0) && (
        <div className="sec"><h3>INSIDE THIS STRUCTURE</h3>
          {sv.map((x) => <div key={x.id} style={{ color: 'var(--surv)', fontSize: 12 }}>◆ {x.status} survivor · F{x.floor} · {Math.round(x.confidence * 100)}%</div>)}
          {hz.map((x) => <div key={x.id} style={{ color: 'var(--bad)', fontSize: 12 }}>▲ {x.label} ({x.severity})</div>)}
        </div>
      )}
      <Provenance robotId={b.observedBy ?? 'baseline import'} at={b.lastObserved ?? 0} conf={b.observed > 0 ? 0.55 + b.observed * 0.4 : b.baselineConfidence} simTime={simTime}
        extra={b.observedBy ? `Last scanned by ${b.observedBy}. Baseline import confidence ${Math.round(b.baselineConfidence * 100)}%.` : 'Never scanned — geometry is pre-disaster import. Treat as hypothesis.'} />
    </div>
  );
}

export function HazCard({ id, full }: { id: string; full?: boolean }) {
  const h = useStore((s) => s.hazards.find((x) => x.id === id));
  const simTime = useStore((s) => s.simTime);
  const st = useStore.getState();
  if (!h) return null;
  const affectedRoutes = st.routes.filter((r) => r.status === 'invalid' && r.reason?.includes(h.label.slice(0, 12)));
  const suggested = st.routes.find((r) => r.status === 'suggested' && r.reason?.includes(h.label.slice(0, 12)));
  return (
    <div style={{ border: '1px solid var(--line)', borderLeft: `3px solid ${h.severity === 'Critical' ? 'var(--crit)' : h.severity === 'Dangerous' ? 'var(--bad)' : 'var(--warn)'}`, borderRadius: 8, padding: '8px 10px', margin: full ? '10px 0' : '0 0 8px', background: 'rgba(239,68,68,.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <b style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center' }}><Flame size={13} /> {h.label}</b>
        <span className="pill">{h.severity.toUpperCase()}</span>
      </div>
      <div className="sub" style={{ marginTop: 3 }}>{h.detail}</div>
      <div className="kv" style={{ marginTop: 5 }}><span className="k">Confidence</span><span className="v">{Math.round(h.confidence * 100)}% · {confLabel(h.confidence)}</span></div>
      <div className="kv"><span className="k">Source</span><span className="v">{h.source}{h.confirmedBy.length ? ` · ✓ ${h.confirmedBy.join(',')}` : ''}</span></div>
      <div className="kv"><span className="k">Detected</span><span className="v">{fmtClock(h.createdAt)} · {fmtAge(simTime, h.updatedAt)}</span></div>
      <div className="kv"><span className="k">Position</span><span className="v">{h.buildingId ?? 'field'}{h.floor != null ? ` · F${h.floor}` : ''}</span></div>
      {affectedRoutes.length > 0 && <div style={{ color: 'var(--bad)', fontSize: 11.5, marginTop: 4 }}><TriangleAlert size={11} /> Invalidates: {affectedRoutes.map((r) => r.id).join(', ')}</div>}
      <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
        <button className="btn sm" onClick={() => { st.select({ kind: 'hazard', id: h.id }); st.focus('hazard', h.id); }}><Crosshair size={12} /> Inspect</button>
        {suggested && <button className="btn sm warn" onClick={() => st.confirmReroute(suggested.id)}>Confirm reroute</button>}
        <button className="btn sm" onClick={() => st.startMissionDraft('InspectHazard')}>Inspect mission</button>
        {h.status === 'active' && <button className="btn sm" onClick={() => st.mitigateHazard(h.id)}>Mitigate</button>}
      </div>
    </div>
  );
}

export function SurvCard({ id, full }: { id: string; full?: boolean }) {
  const sv = useStore((s) => s.survivors.find((x) => x.id === id));
  const simTime = useStore((s) => s.simTime);
  const robots = useStore((s) => s.robots);
  const st = useStore.getState();
  const [assignee, setAssignee] = useState('R-05');
  if (!sv) return null;
  const nearest = [...robots].filter((r) => r.status !== 'CommLost')
    .sort((a, b) => (Math.hypot(a.pos.x - sv.pos.x, a.pos.z - sv.pos.z)) - (Math.hypot(b.pos.x - sv.pos.x, b.pos.z - sv.pos.z)))[0];
  return (
    <div style={{ border: '1px solid rgba(240,171,252,.5)', borderRadius: 10, padding: '10px 12px', margin: full ? '10px 0' : '0 0 8px', background: 'rgba(217,70,239,.07)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <b style={{ color: 'var(--surv)', display: 'flex', gap: 6, alignItems: 'center' }}><HeartPulse size={14} /> {sv.status.toUpperCase()} SURVIVOR</b>
        <span className="pill" style={{ color: 'var(--surv)' }}>{sv.priority}</span>
      </div>
      <div className="sub" style={{ marginTop: 3 }}>{sv.buildingId ?? 'open ground'} · Floor {sv.floor} · via {sv.methods.join(' + ')}</div>
      <div className="kv" style={{ marginTop: 5 }}><span className="k">Confidence</span><span className="v">{Math.round(sv.confidence * 100)}%</span></div>
      <div className="kv"><span className="k">Detected by</span><span className="v">{sv.detectedBy} · {fmtAge(simTime, sv.detectedAt)}</span></div>
      <div className="kv"><span className="k">Nearest robot</span><span className="v">{nearest ? `${nearest.id} · ~${Math.max(1, Math.round(Math.hypot(nearest.pos.x - sv.pos.x, nearest.pos.z - sv.pos.z) / 3))} min` : '—'}</span></div>
      <div style={{ fontSize: 11.5, color: 'var(--mut)', marginTop: 4 }}>Access: {sv.accessNote}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)}
          style={{ background: '#0d1526', color: 'var(--txt)', border: '1px solid var(--line-strong)', borderRadius: 6, padding: '5px 7px', fontSize: 12 }}>
          {robots.filter((r) => r.status !== 'CommLost').map((r) => <option key={r.id} value={r.id}>{r.id}</option>)}
        </select>
        <button className="btn sm pri" onClick={() => st.verifySurvivor(sv.id, assignee)}>Assign verification</button>
        <button className="btn sm" onClick={() => { st.select({ kind: 'survivor', id: sv.id }); st.focus('survivor', sv.id); }}>Frame</button>
      </div>
      {full && (
        <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
          {(['Possible', 'Probable', 'Confirmed', 'Assigned', 'Reached', 'Evacuated', 'False'] as const).map((s) => (
            <button key={s} className={`btn sm${sv.status === s ? ' pri' : ''}`} onClick={() => st.setSurvivorStatus(sv.id, s)}>{s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function MissionDetail({ id }: { id: string }) {
  const m = useStore((s) => s.missions.find((x) => x.id === id));
  const st = useStore.getState();
  if (!m) return null;
  return (
    <div style={{ paddingTop: 10 }}>
      <span className="pill">{m.priority}</span> <span className="pill">{m.status.toUpperCase()}</span>
      <h2>{m.title}</h2>
      <p className="sub">{m.note}</p>
      <div className="kv"><span className="k">Robots</span><span className="v">{m.robotIds.join(', ')}</span></div>
      <div className="kv"><span className="k">Progress</span><span className="v">{m.progress.toFixed(0)}%</span></div>
      <div className="meter"><div style={{ width: `${m.progress}%`, background: 'var(--acc)' }} /></div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button className="btn sm" onClick={() => st.setMissionStatus(m.id, m.status === 'Active' ? 'Paused' : 'Active')}>{m.status === 'Active' ? 'Pause' : 'Resume'}</button>
        <button className="btn sm danger" onClick={() => { if (confirm(`Abort ${m.title}?`)) st.setMissionStatus(m.id, 'Aborted'); }}>Abort</button>
      </div>
    </div>
  );
}
