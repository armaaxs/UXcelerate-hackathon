import { Battery, Radio, TriangleAlert, CircleDot } from 'lucide-react';
import { useStore, fmtAge } from '../store';
import type { RobotStatus } from '../types';

function stColor(s: RobotStatus): string {
  switch (s) {
    case 'CommLost': return '#94a3b8';
    case 'LowBattery': return '#fbbf24';
    case 'Fault': case 'Immobilized': case 'Estop': return '#ef4444';
    case 'Exploring': return '#22d3ee';
    case 'Navigating': return '#60a5fa';
    case 'Inspecting': return '#a78bfa';
    case 'Waiting': return '#fbbf24';
    default: return '#8ea0b8';
  }
}

export default function LeftPanel() {
  const robots = useStore((s) => s.robots);
  const missions = useStore((s) => s.missions);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const focus = useStore((s) => s.focus);
  const setMissionStatus = useStore((s) => s.setMissionStatus);
  const simTime = useStore((s) => s.simTime);
  const discoveries = useStore((s) => s.discoveries);

  return (
    <>
      <div className="panel-h"><span>FLEET · {robots.length}</span><span className="num" style={{ color: 'var(--dim)' }}>{robots.filter((r) => r.status === 'CommLost').length} LOST</span></div>
      <div className="scroll" style={{ maxHeight: '52%', minHeight: 0 }}>
        {robots.map((r) => {
          const sel = selection?.kind === 'robot' && selection.id === r.id;
          const last = [...discoveries].reverse().find((d) => d.robotId === r.id);
          return (
            <div key={r.id} className={`rcard${sel ? ' sel' : ''}`}
              onClick={() => { select({ kind: 'robot', id: r.id }); focus('robot', r.id); }}
              role="button" tabIndex={0} aria-label={`Robot ${r.id} ${r.status}`}>
              <div className="rt">
                <span className="rid" style={{ color: r.status === 'CommLost' ? '#94a3b8' : r.color }}>{r.id}</span>
                <span className="st" style={{ color: stColor(r.status), borderColor: stColor(r.status) }}>{r.status.toUpperCase()}</span>
              </div>
              <div style={{ color: 'var(--mut)', fontSize: 11, marginTop: 3, display: 'flex', gap: 5, alignItems: 'center' }}>
                {r.status === 'CommLost' && <TriangleAlert size={12} color="#ef4444" />}
                {r.task.slice(0, 44)}
              </div>
              <div className="kv" style={{ marginTop: 5 }}>
                <span className="k" style={{ display: 'flex', gap: 4, alignItems: 'center' }}><Battery size={12} /> {r.battery.toFixed(0)}%</span>
                <span className="k" style={{ display: 'flex', gap: 4, alignItems: 'center' }}><Radio size={12} /> {r.signal.toFixed(0)}%</span>
                <span className="v">{r.buildingId ?? `${Math.round(r.pos.x)},${Math.round(r.pos.z)}`}</span>
              </div>
              <div className="meter"><div style={{ width: `${r.battery}%`, background: r.battery < 20 ? 'var(--crit)' : r.battery < 45 ? 'var(--warn)' : 'var(--ok)' }} /></div>
              <div style={{ display: 'flex', gap: 4, marginTop: 5, alignItems: 'center' }}>
                {['lidar', 'thermal', 'gas'].map((sn) => (
                  <span key={sn} className="chip" style={{ opacity: (r.sensors as Record<string, boolean>)[sn] ? 1 : 0.3, padding: '1px 6px' }}>● {sn[0].toUpperCase()}</span>
                ))}
                <span style={{ flex: 1 }} />
                {r.status === 'CommLost'
                  ? <span className="num" style={{ fontSize: 10, color: 'var(--bad)' }}>±{r.uncertainty.toFixed(0)}m · {fmtAge(simTime, r.lastContact)}</span>
                  : last && <span className="num" style={{ fontSize: 10, color: 'var(--dim)' }}>{last.label.slice(0, 24)} · {fmtAge(simTime, last.createdAt)}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="panel-h"><span>MISSIONS · {missions.filter((m) => m.status === 'Active').length} ACTIVE</span><CircleDot size={12} /></div>
      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        {missions.map((m) => (
          <div key={m.id} className={`mcard${m.status === 'Blocked' ? ' blocked' : ''}`}
            onClick={() => useStore.getState().select({ kind: 'mission', id: m.id })} role="button" tabIndex={0}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="mt">{m.title}</span>
              <span className="pill" style={{ color: m.priority === 'P0' ? '#fca5a5' : m.priority === 'P1' ? '#fde68a' : 'var(--mut)' }}>{m.priority}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 2 }}>{m.id} · {m.type} · {m.robotIds.join(' + ')}</div>
            <div className="meter" style={{ marginTop: 6 }}><div style={{ width: `${m.progress}%`, background: m.status === 'Blocked' ? 'var(--crit)' : 'var(--acc)' }} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, alignItems: 'center' }}>
              <span className="num" style={{ fontSize: 10.5, color: m.status === 'Blocked' ? 'var(--bad)' : 'var(--mut)' }}>{m.status.toUpperCase()} · {m.progress.toFixed(0)}%</span>
              {m.status === 'Active' || m.status === 'Blocked' ? (
                <button className="btn sm" onClick={(e) => { e.stopPropagation(); setMissionStatus(m.id, 'Paused'); }}>Pause</button>
              ) : m.status === 'Paused' ? (
                <button className="btn sm" onClick={(e) => { e.stopPropagation(); setMissionStatus(m.id, 'Active'); }}>Resume</button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
