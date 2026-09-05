import { useState } from 'react';
import { Search, Radio, Clock3, ShieldAlert, Contrast, PersonStanding, Command } from 'lucide-react';
import { useStore, fmtClock } from '../store';

const NAV = ['Overview', 'Robots', 'Missions', 'Discoveries', 'Map', 'Timeline', 'Incident Log', 'System'];

export default function TopBar({ view, setView }: { view: string; setView: (v: string) => void }) {
  const { simTime, robots, alerts, viewTime, layers } = useStore();
  const [q, setQ] = useState('');
  const focus = useStore((s) => s.focus);
  const select = useStore((s) => s.select);
  const toggleContrast = useStore((s) => s.toggleContrast);
  const setPalette = useStore((s) => s.setPalette);

  const connected = robots.filter((r) => r.status !== 'CommLost').length;
  const crit = alerts.filter((a) => !a.acked && a.level === 'critical').length;
  const elev = alerts.filter((a) => !a.acked && a.level === 'elevated').length;

  function search() {
    const needle = q.trim().toUpperCase();
    if (!needle) return;
    const st = useStore.getState();
    const r = st.robots.find((x) => x.id.toUpperCase() === needle || x.id.toUpperCase().includes(needle));
    if (r) { select({ kind: 'robot', id: r.id }); focus('robot', r.id); setView('Overview'); return; }
    const b = st.buildings.find((x) => x.id.toUpperCase() === needle || x.label.toUpperCase().includes(needle));
    if (b) { select({ kind: 'building', id: b.id }); focus('building', b.id); setView('Overview'); return; }
    const hz = st.hazards.find((x) => x.label.toUpperCase().includes(needle) || x.category.toUpperCase() === needle);
    if (hz) { select({ kind: 'hazard', id: hz.id }); focus('hazard', hz.id); return; }
    const sv = st.survivors.find((x) => x.id.toUpperCase().includes(needle));
    if (sv) { select({ kind: 'survivor', id: sv.id }); focus('survivor', sv.id); return; }
  }

  return (
    <header className="topbar">
      <div className="brand"><span className="dot" /><span>RESCUEGRID</span></div>
      <span className="chip">PARIS 7E · M6.2</span>
      <nav className="nav" aria-label="Primary">
        {NAV.map((n) => (
          <button key={n} className={view === n ? 'on' : ''} onClick={() => setView(n)}>{n}</button>
        ))}
      </nav>
      <div style={{ flex: 1 }} />
      <div className="search">
        <Search size={14} color="#8ea0b8" />
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Search R-04 · B14 · gas · survivor…" aria-label="Map search" />
        <button className="iconbtn" style={{ width: 22, height: 22 }} onClick={() => setPalette(true)} title="Command palette (Ctrl+K)">
          <Command size={12} />
        </button>
      </div>
      <span className="badge" title="Fleet link health"><Radio size={12} color={connected < robots.length ? '#fbbf24' : '#34d399'} />
        <span className="num">{connected}/{robots.length}</span>
      </span>
      <span className="badge" title="Unacknowledged alerts" style={{ color: crit ? '#fca5a5' : elev ? '#fde68a' : undefined }}>
        <ShieldAlert size={12} /> <span className="num">{crit + elev}</span>
      </span>
      {viewTime == null
        ? <span className="badge sim"><span className="pulse">●</span> SIMULATION</span>
        : <span className="badge replay">◉ REPLAY {fmtClock(viewTime)}</span>}
      <span className="badge live" title="Incident clock"><Clock3 size={12} /> <span className="num">{fmtClock(simTime)}</span></span>
      <button className="iconbtn" onClick={toggleContrast} title="High contrast"><Contrast size={14} /></button>
      <span title="Operator" style={{ color: 'var(--mut)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
        <PersonStanding size={14} /> OP-A
      </span>
      <span style={{ display: 'none' }}>{String(layers.baseline)}</span>
    </header>
  );
}
