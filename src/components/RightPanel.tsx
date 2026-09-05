// Inspector (floating, selection-only) + Intel feed.
// Nothing here renders persistently — the map stays the interface.
import { useState } from 'react';
import { Crosshair, Navigation, Pause, RotateCcw, OctagonX, HeartPulse, Flame, TriangleAlert, Eye, X } from 'lucide-react';
import { useStore, fmtClock, fmtAge, confLabel } from '../store';

/* ── floating inspector: appears only while something is selected ── */
export function InspectorCard() {
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const simTime = useStore((s) => s.simTime);
  if (!selection) return null;
  return (
    <div className="float inspector" role="dialog" aria-label="Inspector">
      <button className="iconbtn" aria-label="Close inspector"
        style={{ position: 'absolute', top: 6, right: 6, zIndex: 2 }}
        onClick={() => select(null)}>
        <X size={13} />
      </button>
      <div className="insp" style={{ maxHeight: '100%', overflowY: 'auto' }}>
        {selection.kind === 'robot' && <RobotDetail id={selection.id} simTime={simTime} />}
        {selection.kind === 'building' && <BuildingDetail id={selection.id} simTime={simTime} />}
        {selection.kind === 'hazard' && <HazCard id={selection.id} full />}
        {selection.kind === 'survivor' && <SurvCard id={selection.id} full />}
        {selection.kind === 'mission' && <MissionDetail id={selection.id} />}
        {selection.kind === 'discovery' && <DiscoveryDetail id={selection.id} simTime={simTime} />}
      </div>
    </div>
  );
}

function DiscoveryDetail({ id, simTime }: { id: string; simTime: number }) {
  const d = useStore((s) => s.discoveries.find((x) => x.id === id));
  if (!d) return <p style={{ color: 'var(--mut)' }}>Discovery aged out of buffer.</p>;
  return (
    <div style={{ paddingTop: 8 }}>
      <span className="pill">{d.kind}</span> <span className="pill">{d.priority}</span>
      <h2>{d.label}</h2>
      <p className="sub">{d.detail}</p>
      <Provenance robotId={d.robotId} at={d.createdAt} conf={d.confidence} simTime={simTime} />
    </div>
  );
}

/* ── intel feed for the left panel: survivors → hazards → discoveries ── */
export function IntelTab() {
  const hazards = useStore((s) => s.hazards);
  const survivors = useStore((s) => s.survivors);
  const discoveries = useStore((s) => s.discoveries);
  const simTime = useStore((s) => s.simTime);
  const active = hazards.filter((h) => h.status === 'active');
  if (hazards.length === 0 && survivors.length === 0 && discoveries.length === 0) {
    return <p style={{ color: 'var(--mut)', padding: '12px 14px' }}>Quiet for now. Robots are still sweeping.</p>;
  }
  return (
    <div style={{ paddingBottom: 12 }}>
      {survivors.length > 0 && (
        <>
          <div className="panel-h"><span>SURVIVORS · {survivors.length}</span></div>
          {[...survivors].reverse().map((s) => <SurvCard key={s.id} id={s.id} />)}
        </>
      )}
      {active.length > 0 && (
        <>
          <div className="panel-h"><span>HAZARDS · {active.length}</span></div>
          {[...active].reverse().map((h) => <HazCard key={h.id} id={h.id} />)}
        </>
      )}
      {discoveries.length > 0 && (
        <>
          <div className="panel-h"><span>LATEST FINDINGS</span></div>
          {[...discoveries].reverse().slice(0, 15).map((d) => (
            <div key={d.id} className="feeditem"
              onClick={() => { useStore.getState().select({ kind: 'discovery', id: d.id }); }}>
              <span className="sevdot" style={{ background: d.priority === 'P0' ? '#f0abfc' : d.priority === 'P1' ? '#fbbf24' : '#3a4557' }} />
              <div>
                <div style={{ fontWeight: 600 }}>{d.label}</div>
                <div className="num" style={{ color: 'var(--dim)', fontSize: 10.5, marginTop: 1 }}>
                  {d.robotId} · {Math.round(d.confidence * 100)}% · {fmtAge(simTime, d.createdAt)}
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function Provenance({ robotId, at, conf, simTime, extra }: { robotId: string; at: number; conf: number; simTime: number; extra?: string }) {
  return (
    <div className="sec">
      <h3>WHY BELIEVE THIS</h3>
      <div className="kv"><span className="k">Source</span><span className="v">{robotId}</span></div>
      <div className="kv"><span className="k">Observed</span><span className="v">{fmtClock(at)} · {fmtAge(simTime, at)}</span></div>
      <div className="kv"><span className="k">Confidence</span><span className="v">{Math.round(conf * 100)}% · {confLabel(conf)}</span></div>
      <div className="confbar" style={{ marginTop: 5 }}><div style={{ width: `${conf * 100}%`, background: conf > 0.75 ? 'var(--ok)' : conf > 0.45 ? 'var(--warn)' : 'var(--bad)' }} /></div>
      {extra && <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 6 }}>{extra}</div>}
    </div>
  );
}

function RobotDetail({ id, simTime }: { id: string; simTime: number }) {
  const r = useStore((s) => s.robots.find((x) => x.id === id));
  const focus = useStore((s) => s.focus);
  const updateRobotStatus = useStore((s) => s.updateRobotStatus);
  const reconnectRobot = useStore((s) => s.reconnectRobot);
  const allDiscoveries = useStore((s) => s.discoveries);
  const discoveries = allDiscoveries.filter((d) => d.robotId === id).slice(-3).reverse();
  if (!r) return null;
  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 style={{ fontFamily: 'var(--mono)', margin: 0 }}>{r.id}</h2>
        <span className="num" style={{ fontSize: 10.5, color: 'var(--mut)' }}>{r.status.toUpperCase()}</span>
      </div>
      <div className="sub">{r.kind} · {r.task}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
        <button className="btn sm pri" onClick={() => focus('robot', r.id)}><Crosshair size={12} /> Focus</button>
        {r.status === 'CommLost'
          ? <button className="btn sm warn" onClick={() => reconnectRobot(r.id)}><RotateCcw size={12} /> Reconnect</button>
          : <button className="btn sm" onClick={() => updateRobotStatus(r.id, 'Returning')}><Navigation size={12} /> Return</button>}
        <button className="btn sm" onClick={() => updateRobotStatus(r.id, r.status === 'Waiting' ? 'Exploring' : 'Waiting')}><Pause size={12} /> {r.status === 'Waiting' ? 'Resume' : 'Hold'}</button>
        <button className="btn sm danger" onClick={() => { if (confirm(`Emergency stop ${r.id}?`)) updateRobotStatus(r.id, 'Estop'); }}><OctagonX size={12} /> E-stop</button>
      </div>
      <div className="sec"><h3>STATUS</h3>
        <div className="kv"><span className="k">Mission</span><span className="v">{r.missionId ?? '—'}</span></div>
        <div className="kv"><span className="k">Grid</span><span className="v">{r.pos.x.toFixed(1)}, {r.pos.z.toFixed(1)} ±{r.uncertainty.toFixed(1)}m</span></div>
        <div className="kv"><span className="k">Signal</span><span className="v">{r.signal.toFixed(0)}% · {r.latencyMs.toFixed(0)} ms</span></div>
        <div className="kv"><span className="k">Battery</span><span className="v">{r.battery.toFixed(0)}%</span></div>
        <div className="meter"><div style={{ width: `${r.battery}%`, background: r.battery < 20 ? 'var(--crit)' : 'var(--ok)' }} /></div>
      </div>
      {discoveries.length > 0 && (
        <div className="sec"><h3>LATEST</h3>
          {discoveries.map((d) => (
            <div key={d.id} style={{ fontSize: 11.5, padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
              {d.label} <span className="num" style={{ color: 'var(--dim)' }}>· {fmtAge(simTime, d.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
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
    <div style={{ paddingTop: 4 }}>
      <h2 style={{ margin: 0 }}>{b.label}</h2>
      <div className="sub">{b.floors} floors · {b.condition} · {Math.round(b.observed * 100)}% observed</div>
      {(b.contradicted || b.stale || b.priority) && (
        <div style={{ marginTop: 7, fontSize: 11, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {b.contradicted && <span style={{ color: '#f9a8d4' }}>⚠ Baseline contradicted by robots</span>}
          {b.stale && <span style={{ color: '#fde68a' }}>Stale — reverification required</span>}
          {b.priority && <span style={{ color: 'var(--surv)' }}>★ Priority structure</span>}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
        <button className="btn sm pri" onClick={() => { st.setIsolated(id); st.focus('building', id); }}><Eye size={12} /> Isolate + explode</button>
        <button className="btn sm" onClick={() => st.focus('building', id)}><Crosshair size={12} /> Frame</button>
      </div>
      <div className="sec"><h3>FLOORS · {explored}/{b.floors}</h3>
        {b.floorsExplored.map((f, i) => (
          <div key={i} className="kv"><span className="k">Floor {i === 0 ? 'G' : i}</span>
            <span className="v" style={{ color: f ? 'var(--ok)' : 'var(--dim)' }}>{f ? 'observed' : 'unseen'}</span></div>
        ))}
      </div>
      {(hz.length > 0 || sv.length > 0) && (
        <div className="sec"><h3>INSIDE</h3>
          {sv.map((x) => <div key={x.id} style={{ color: 'var(--surv)', fontSize: 12 }}>◆ {x.status} survivor · F{x.floor}</div>)}
          {hz.map((x) => <div key={x.id} style={{ color: 'var(--bad)', fontSize: 12 }}>▲ {x.label} ({x.severity})</div>)}
        </div>
      )}
      <Provenance robotId={b.observedBy ?? 'baseline import'} at={b.lastObserved ?? 0} conf={b.observed > 0 ? 0.55 + b.observed * 0.4 : b.baselineConfidence} simTime={simTime}
        extra={b.observedBy ? `Last scanned by ${b.observedBy}.` : 'Never scanned — pre-disaster import. Treat as hypothesis.'} />
    </div>
  );
}

function sevColor(s: string): string {
  return s === 'Critical' ? 'var(--crit)' : s === 'Dangerous' ? 'var(--bad)' : 'var(--warn)';
}

export function HazCard({ id, full }: { id: string; full?: boolean }) {
  const h = useStore((s) => s.hazards.find((x) => x.id === id));
  const simTime = useStore((s) => s.simTime);
  const st = useStore.getState();
  if (!h) return null;
  const affectedRoutes = st.routes.filter((r) => r.status === 'invalid' && r.reason?.includes(h.label.slice(0, 12)));
  const suggested = st.routes.find((r) => r.status === 'suggested' && r.reason?.includes(h.label.slice(0, 12)));
  return (
    <div style={{ borderTop: '1px solid var(--line)', borderLeft: `2px solid ${sevColor(h.severity)}`, padding: '9px 12px 9px 10px', margin: full ? '10px 0' : '0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <b style={{ fontSize: 12.5, fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}><Flame size={13} color={sevColor(h.severity)} /> {h.label}</b>
        <span className="num" style={{ fontSize: 10, color: sevColor(h.severity), flexShrink: 0 }}>{h.severity.toUpperCase()}</span>
      </div>
      <div className="sub" style={{ marginTop: 2 }}>{h.detail}</div>
      <div className="kv" style={{ marginTop: 4 }}><span className="k">Confidence</span><span className="v">{Math.round(h.confidence * 100)}%</span></div>
      <div className="kv"><span className="k">Source</span><span className="v">{h.source}{h.confirmedBy.length ? ` · ✓ ${h.confirmedBy.join(',')}` : ''}</span></div>
      <div className="kv"><span className="k">Seen</span><span className="v">{fmtAge(simTime, h.updatedAt)}</span></div>
      {affectedRoutes.length > 0 && <div style={{ color: 'var(--bad)', fontSize: 11.5, marginTop: 4 }}><TriangleAlert size={11} /> Invalidates {affectedRoutes.map((r) => r.id).join(', ')}</div>}
      <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
        <button className="btn sm" onClick={() => { st.select({ kind: 'hazard', id: h.id }); st.focus('hazard', h.id); }}><Crosshair size={12} /> Inspect</button>
        {suggested && <button className="btn sm warn" onClick={() => st.confirmReroute(suggested.id)}>Confirm reroute</button>}
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
    <div style={{ borderTop: '1px solid var(--line)', borderLeft: '2px solid var(--surv)', padding: '9px 12px 9px 10px', margin: full ? '10px 0' : '0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <b style={{ color: 'var(--surv)', display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}><HeartPulse size={14} /> {sv.status.toUpperCase()} SURVIVOR</b>
        <span className="num" style={{ fontSize: 10, color: 'var(--surv)' }}>{sv.priority}</span>
      </div>
      <div className="sub" style={{ marginTop: 2 }}>{sv.buildingId ?? 'open ground'} · Floor {sv.floor} · {sv.methods.join(' + ')} · {Math.round(sv.confidence * 100)}%</div>
      <div className="kv" style={{ marginTop: 4 }}><span className="k">Detected</span><span className="v">{sv.detectedBy} · {fmtAge(simTime, sv.detectedAt)}</span></div>
      <div className="kv"><span className="k">Nearest</span><span className="v">{nearest ? `${nearest.id} · ~${Math.max(1, Math.round(Math.hypot(nearest.pos.x - sv.pos.x, nearest.pos.z - sv.pos.z) / 3))} min` : '—'}</span></div>
      <div style={{ fontSize: 11.5, color: 'var(--mut)', marginTop: 3 }}>{sv.accessNote}</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Robot to assign">
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
    <div style={{ paddingTop: 8 }}>
      <span className="pill">{m.priority}</span> <span className="pill">{m.status}</span>
      <h2>{m.title}</h2>
      <p className="sub">{m.note}</p>
      <div className="kv"><span className="k">Robots</span><span className="v">{m.robotIds.join(', ')}</span></div>
      <div className="kv"><span className="k">Progress</span><span className="v">{m.progress.toFixed(0)}%</span></div>
      <div className="meter"><div style={{ width: `${m.progress}%`, background: 'var(--acc)' }} /></div>
      <div style={{ display: 'flex', gap: 6, marginTop: 9 }}>
        <button className="btn sm" onClick={() => st.setMissionStatus(m.id, m.status === 'Active' ? 'Paused' : 'Active')}>{m.status === 'Active' ? 'Pause' : 'Resume'}</button>
        <button className="btn sm danger" onClick={() => { if (confirm(`Abort ${m.title}?`)) st.setMissionStatus(m.id, 'Aborted'); }}>Abort</button>
      </div>
    </div>
  );
}
