import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { useStore, fmtAge } from '../store';
import type { RobotStatus } from '../types';
import { IntelTab } from './RightPanel';

function stColor(s: RobotStatus): string {
  switch (s) {
    case 'CommLost': return '#94a3b8';
    case 'LowBattery': return '#fbbf24';
    case 'Fault': case 'Immobilized': case 'Estop': return '#ef4444';
    case 'Exploring': return '#22d3ee';
    case 'Navigating': return '#60a5fa';
    case 'Inspecting': return '#a78bfa';
    case 'Waiting': return '#fbbf24';
    default: return '#5f6d82';
  }
}

type LTab = 'Fleet' | 'Missions' | 'Intel';

export default function LeftPanel() {
  const [tab, setTab] = useState<LTab>('Fleet');
  const robots = useStore((s) => s.robots);
  const missions = useStore((s) => s.missions);
  const hazards = useStore((s) => s.hazards);
  const survivors = useStore((s) => s.survivors);
  const lost = robots.filter((r) => r.status !== 'CommLost').length;
  const intelN = hazards.filter((h) => h.status === 'active').length + survivors.length;

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Operations">
        {(['Fleet', 'Missions', 'Intel'] as LTab[]).map((t) => (
          <button key={t} role="tab" className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t}
            {t === 'Fleet' && lost < robots.length ? ` · ${robots.length - lost} lost` : ''}
            {t === 'Missions' ? ` · ${missions.filter((m) => m.status === 'Active').length}` : ''}
            {t === 'Intel' && intelN ? ` · ${intelN}` : ''}
          </button>
        ))}
      </div>
      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        {tab === 'Fleet' && <FleetList />}
        {tab === 'Missions' && <MissionList />}
        {tab === 'Intel' && <IntelTab />}
      </div>
    </>
  );
}

function FleetList() {
  const robots = useStore((s) => s.robots);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const focus = useStore((s) => s.focus);
  const simTime = useStore((s) => s.simTime);
  const discoveries = useStore((s) => s.discoveries);
  return (
    <>
      {robots.map((r) => {
        const sel = selection?.kind === 'robot' && selection.id === r.id;
        const c = r.status === 'CommLost' ? '#94a3b8' : stColor(r.status);
        const last = [...discoveries].reverse().find((d) => d.robotId === r.id);
        return (
          <div key={r.id} className={`rcard${sel ? ' sel' : ''}`}
            onClick={() => { select({ kind: 'robot', id: r.id }); focus('robot', r.id); }}
            role="button" tabIndex={0} aria-label={`Robot ${r.id}, ${r.status}`}>
            <div className="rt">
              <span className="rid"><span className="sdot" style={{ background: c }} />{r.id}</span>
              <span className="st" style={{ color: c }}>{r.status === 'CommLost' ? 'NO LINK' : r.status.toUpperCase()}</span>
            </div>
            <div style={{ color: 'var(--mut)', fontSize: 11, marginTop: 2, display: 'flex', gap: 5, alignItems: 'center', whiteSpace: 'nowrap', overflow: 'hidden' }}>
              {r.status === 'CommLost' && <TriangleAlert size={11} color="#ef4444" />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.task}</span>
            </div>
            <div className="meter"><div style={{ width: `${r.battery}%`, background: r.battery < 20 ? 'var(--crit)' : r.battery < 45 ? 'var(--warn)' : 'var(--ok)' }} /></div>
            <div className="num" style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 10, color: 'var(--dim)' }}>
              <span style={{ color: r.battery < 20 ? 'var(--bad)' : undefined }}>{r.battery.toFixed(0)}%</span>
              <span>S {r.signal.toFixed(0)}</span>
              <span style={{ flex: 1 }} />
              {r.status === 'CommLost'
                ? <span style={{ color: 'var(--bad)' }}>±{r.uncertainty.toFixed(0)}m · {fmtAge(simTime, r.lastContact)}</span>
                : <span>{r.buildingId ?? `${Math.round(r.pos.x)},${Math.round(r.pos.z)}`}{last ? ` · ${fmtAge(simTime, last.createdAt)}` : ''}</span>}
            </div>
          </div>
        );
      })}
    </>
  );
}

function MissionList() {
  const missions = useStore((s) => s.missions);
  const setMissionStatus = useStore((s) => s.setMissionStatus);
  return (
    <>
      {missions.map((m) => (
        <div key={m.id} className={`mcard${m.status === 'Blocked' ? ' blocked' : ''}`}
          onClick={() => useStore.getState().select({ kind: 'mission', id: m.id })} role="button" tabIndex={0}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span className="mt" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</span>
            <span className="num" style={{ fontSize: 10, color: m.priority === 'P0' ? '#fca5a5' : m.priority === 'P1' ? '#fde68a' : 'var(--dim)', flexShrink: 0 }}>{m.priority} · {m.progress.toFixed(0)}%</span>
          </div>
          <div className="num" style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>{m.robotIds.join(' + ')}</div>
          <div className="meter"><div style={{ width: `${m.progress}%`, background: m.status === 'Blocked' ? 'var(--crit)' : 'var(--acc)' }} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, alignItems: 'center' }}>
            <span className="num" style={{ fontSize: 10, color: m.status === 'Blocked' ? 'var(--bad)' : 'var(--dim)' }}>{m.status.toUpperCase()}</span>
            {m.status === 'Active' || m.status === 'Blocked' ? (
              <button className="btn sm" onClick={(e) => { e.stopPropagation(); setMissionStatus(m.id, 'Paused'); }}>Pause</button>
            ) : m.status === 'Paused' ? (
              <button className="btn sm" onClick={(e) => { e.stopPropagation(); setMissionStatus(m.id, 'Active'); }}>Resume</button>
            ) : null}
          </div>
        </div>
      ))}
    </>
  );
}
