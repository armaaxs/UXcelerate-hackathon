import { Play, Pause, RotateCcw, Zap, RadioTower, TriangleAlert, FlaskConical, HeartPulse, Mountain } from 'lucide-react';
import { useStore, fmtClock } from '../store';

const SPEEDS = ['1×', '2×', '4×'];

export default function BottomBar() {
  const simTime = useStore((s) => s.simTime);
  const running = useStore((s) => s.running);
  const speedIdx = useStore((s) => s.speedIdx);
  const viewTime = useStore((s) => s.viewTime);
  const events = useStore((s) => s.events);
  const st = useStore.getState();

  const live = viewTime == null;
  const shown = live ? simTime : viewTime;

  return (
    <footer className="bottom" style={{ flexDirection: 'column' }}>
      <div className="timeline">
        <button className="iconbtn" onClick={() => (running ? st.pause() : st.play())} title="Play / pause simulation">
          {running ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button className="btn sm" onClick={() => st.cycleSpeed()} title="Simulation speed">
          <Zap size={12} /> {SPEEDS[speedIdx]}
        </button>
        <span className="num" style={{ fontSize: 11, color: 'var(--dim)' }}>{fmtClock(0)}</span>
        <input className="tl-slider" type="range" min={0} max={Math.max(1, simTime)} step={1}
          value={shown} aria-label="Incident timeline scrubber"
          onChange={(e) => {
            const v = Number(e.target.value);
            st.setViewTime(v >= simTime - 1 ? null : v);
          }} />
        <span className="num" style={{ fontSize: 11, color: 'var(--dim)' }}>{fmtClock(simTime)}</span>
        {live
          ? <span className="badge live">● LIVE</span>
          : <button id="timeline-live" className="btn sm pri" onClick={() => st.setViewTime(null)}>Back to LIVE</button>}
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <EventFeed events={events} />
        <div style={{ width: 300, flex: '0 0 300px', borderLeft: '1px solid var(--line)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="panel-h"><span>SIMULATION CONTROLS</span></div>
          <div className="simctl" style={{ borderTop: 0, paddingTop: 0 }}>
            <button className="btn sm" onClick={() => st.triggerDiscovery()} title="Inject a mapping discovery"><FlaskConical size={12} /> Discovery</button>
            <button className="btn sm warn" onClick={() => st.triggerHazard()} title="Inject a hazard"><TriangleAlert size={12} /> Hazard</button>
            <button className="btn sm" onClick={() => st.disconnectRobot()} title="Drop a robot link"><RadioTower size={12} /> Drop link</button>
            <button className="btn sm pri" onClick={() => st.spawnSurvivor()}><HeartPulse size={12} /> Survivor</button>
            <button className="btn sm danger" onClick={() => { if (confirm('Trigger M5.1 aftershock? Central blocks go STALE.')) st.aftershock(); }}><Mountain size={12} /> Aftershock</button>
            <button className="btn sm" onClick={() => { if (confirm('Reset incident to T+0?')) st.reset(); }}><RotateCcw size={12} /> Reset</button>
          </div>
          <AuditMini />
        </div>
      </div>
    </footer>
  );
}

function EventFeed({ events }: { events: ReturnType<typeof useStore.getState>['events'] }) {
  const simTime = useStore((s) => s.simTime);
  void simTime;
  const list = [...events].reverse().slice(0, 30);
  function color(sev: string) {
    return sev === 'P0' ? '#f0abfc' : sev === 'P1' ? '#fbbf24' : sev === 'P2' ? '#60a5fa' : '#475569';
  }
  function jump(e: (typeof events)[number]) {
    const st = useStore.getState();
    if (e.robotId) { st.select({ kind: 'robot', id: e.robotId }); st.focus('robot', e.robotId); }
    else if (e.buildingId) { st.select({ kind: 'building', id: e.buildingId }); st.focus('building', e.buildingId); }
  }
  return (
    <div className="scroll" style={{ flex: 1, minHeight: 0 }} aria-label="Event feed">
      <div className="panel-h"><span>EVENT FEED · {events.length}</span><span style={{ letterSpacing: 0 }}>P0 interrupts · P3 stays in feed</span></div>
      {list.map((e) => (
        <div key={e.id} className="feeditem" onClick={() => jump(e)}>
          <span className="num tm">{fmtClock(e.t)}</span>
          <span className="sevdot" style={{ background: color(e.severity) }} />
          <span>{e.text}</span>
        </div>
      ))}
    </div>
  );
}

function AuditMini() {
  const audit = useStore((s) => s.audit);
  const list = audit.slice(-4).reverse();
  return (
    <div style={{ padding: '2px 12px 8px', fontSize: 10.5, color: 'var(--dim)', overflow: 'hidden' }}>
      <div style={{ fontWeight: 800, letterSpacing: '.1em', fontSize: 9.5, marginBottom: 3 }}>AUDIT LOG</div>
      {list.map((a) => (
        <div key={a.id} className="num" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {fmtClock(a.t)} · {a.actor} · {a.text.slice(0, 64)}
        </div>
      ))}
    </div>
  );
}
