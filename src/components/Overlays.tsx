import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Layers, MousePointer2, Ruler, PenSquare, TriangleAlert, Crosshair,
  Video, X, Check, BellRing, Slice, Boxes, GitCompareArrows,
} from 'lucide-react';
import { useStore, fmtAge } from '../store';
import type { LayerState } from '../types';
import type { MissionType } from '../types';

/* ── floating layer control (PRD §46) ── */
const GROUPS: { title: string; keys: { k: keyof LayerState; label: string }[] }[] = [
  { title: 'ENVIRONMENT', keys: [
    { k: 'baseline', label: 'Baseline (pre-disaster)' },
    { k: 'observed', label: 'Observed reality' },
    { k: 'pointcloud', label: 'Point clouds' },
    { k: 'coverage', label: 'Exploration coverage' },
  ]},
  { title: 'OPERATIONS', keys: [
    { k: 'robots', label: 'Robots' },
    { k: 'trails', label: 'Trails' },
    { k: 'routes', label: 'Routes' },
    { k: 'missions', label: 'Missions' },
    { k: 'relays', label: 'Relays & staging' },
    { k: 'labels', label: 'Labels' },
  ]},
  { title: 'INTELLIGENCE', keys: [
    { k: 'hazards', label: 'Hazards' },
    { k: 'survivors', label: 'Survivors' },
    { k: 'discoveries', label: 'Discoveries' },
  ]},
  { title: 'SENSORS', keys: [
    { k: 'thermal', label: 'Thermal overlay' },
    { k: 'gas', label: 'Gas overlay' },
    { k: 'signal', label: 'Signal / mesh' },
  ]},
  { title: 'DIAGNOSTICS', keys: [
    { k: 'confidence', label: 'Confidence rings' },
    { k: 'freshness', label: 'Freshness fade' },
  ]},
];

export function LayerPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const layers = useStore((s) => s.layers);
  const toggleLayer = useStore((s) => s.toggleLayer);
  if (!open) return null;
  return (
    <div className="float layers" role="dialog" aria-label="Layer control">
      <div className="panel-h"><span>LAYERS</span><button className="iconbtn" style={{ width: 22, height: 22 }} onClick={onClose}><X size={12} /></button></div>
      {GROUPS.map((g) => (
        <div key={g.title}>
          <div className="layergroup">{g.title}</div>
          {g.keys.map(({ k, label }) => (
            <label key={k}>
              <input type="checkbox" checked={layers[k]} onChange={() => toggleLayer(k)} />
              {label}
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── map toolset + camera presets (PRD §48–50, §90) ── */
const MISSION_TYPES: MissionType[] = ['Explore', 'SearchStructure', 'InspectHazard', 'Verify', 'Deliver', 'Relay', 'MapInterior', 'SearchSurvivors', 'Return', 'Hold'];

export function MapToolbar({ onLayers }: { onLayers: () => void }) {
  const gotoPreset = useStore((s) => s.gotoPreset);
  const startMissionDraft = useStore((s) => s.startMissionDraft);
  const missionDraft = useStore((s) => s.missionDraft);
  const cancelMissionDraft = useStore((s) => s.cancelMissionDraft);
  const [mtype, setMtype] = useState<MissionType>('SearchStructure');
  return (
    <>
      <div className="float tools" role="toolbar" aria-label="Map tools">
        <button className="iconbtn on" title="Select (click objects)"><MousePointer2 size={14} /></button>
        <button className="iconbtn" id="layer-panel-toggle" title="Layers (L)" onClick={onLayers}><Layers size={14} /></button>
        <button className="iconbtn" title="Measure (demo: logs distance between R-04 and R-05)" onClick={() => {
          const st = useStore.getState();
          const a = st.robots.find((r) => r.id === 'R-04')!;
          const b = st.robots.find((r) => r.id === 'R-05')!;
          const d = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
          st.auditLog(`Measured R-04 ↔ R-05: ${d.toFixed(1)} m.`);
        }}><Ruler size={14} /></button>
        <button className="iconbtn" title="Annotate (adds operator note at map centre)" onClick={() => {
          const st = useStore.getState();
          st.auditLog('Annotation added at incident centre: "Staging expansion — OP-A".');
        }}><PenSquare size={14} /></button>
        <button className="iconbtn" title="Report hazard at selected robot" onClick={() => useStore.getState().triggerHazard()}><TriangleAlert size={14} /></button>
        <button className="iconbtn" title="Compare baseline vs current" onClick={() => useStore.getState().toggleCompare()}><GitCompareArrows size={14} /></button>
        <button className="iconbtn" title="Screenshot (uses browser capture)" onClick={() => window.print()}><Video size={14} /></button>
      </div>
      <div className="float campresets">
        {(['incident', 'robots', 'hazards', 'survivors', 'comms', 'coverage'] as const).map((p) => (
          <button key={p} className="btn sm" onClick={() => gotoPreset(p)}><Crosshair size={11} /> {p[0].toUpperCase() + p.slice(1)}</button>
        ))}
        {missionDraft ? (
          <span className="badge sim">CLICK MAP → {missionDraft.type.toUpperCase()} <button className="iconbtn" style={{ width: 18, height: 18 }} onClick={cancelMissionDraft}><X size={11} /></button></span>
        ) : (
          <select value={mtype} onChange={(e) => setMtype(e.target.value as MissionType)} aria-label="Mission type"
            style={{ background: '#0d1526', color: 'var(--txt)', border: '1px solid var(--line-strong)', borderRadius: 6, fontSize: 11, padding: '4px 6px' }}>
            {MISSION_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        {!missionDraft && <button className="btn sm pri" onClick={() => startMissionDraft(mtype)}>+ Mission <span className="num" style={{ opacity: .6 }}>M</span></button>}
      </div>
      <LegendFloat />
      <Minimap />
    </>
  );
}

function LegendFloat() {
  const compare = useStore((s) => s.compare);
  const isolatedId = useStore((s) => s.isolatedId);
  void isolatedId;
  return (
    <div className="float legend">
      <div className="row"><span className="sw" style={{ background: '#3b4c63' }} /> Baseline — unverified import</div>
      <div className="row"><span className="sw" style={{ background: '#2dd4bf' }} /> Observed — robot-confirmed</div>
      <div className="row"><span className="sw" style={{ background: '#f472b6' }} /> Contradicted by robots</div>
      <div className="row"><span className="sw" style={{ background: '#f0abfc' }} /> Survivor — P0 priority</div>
      {compare && <div className="row" style={{ color: '#a5f3fc' }}>◐ COMPARE: baseline vs current</div>}
      <div className="row" style={{ color: 'var(--dim)' }}>Double-click map with mission armed to task</div>
    </div>
  );
}

/* ── 2D minimap (PRD §50) ── */
function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const isolatedId = useStore((s) => s.isolatedId);
  useEffect(() => {
    let raf = 0;
    function draw() {
      raf = requestAnimationFrame(draw);
      const c = ref.current;
      if (!c) return;
      const g = c.getContext('2d')!;
      const W = c.width, H = c.height;
      const st = useStore.getState();
      const toPx = (x: number, z: number): [number, number] => [
        ((x + 130) / 260) * W, ((z + 130) / 260) * H,
      ];
      g.fillStyle = '#0a1120';
      g.fillRect(0, 0, W, H);
      for (const b of st.buildings) {
        const [x, y] = toPx(b.x, b.z);
        const w = (b.w / 260) * W, h = (b.d / 260) * H;
        g.fillStyle = b.id === isolatedId ? 'rgba(34,211,238,.8)' : b.priority ? 'rgba(240,171,252,.5)' : b.observed > 0.3 ? 'rgba(45,212,191,.45)' : 'rgba(100,116,139,.4)';
        g.fillRect(x, y, w, h);
      }
      for (const hz of st.hazards) {
        const [x, y] = toPx(hz.pos.x, hz.pos.z);
        g.fillStyle = hz.severity === 'Critical' ? '#ef4444' : '#fbbf24';
        g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill();
      }
      for (const s of st.survivors) {
        const [x, y] = toPx(s.pos.x, s.pos.z);
        g.fillStyle = '#f0abfc';
        g.fillRect(x - 3, y - 3, 6, 6);
      }
      for (const r of st.robots) {
        const [x, y] = toPx(r.pos.x, r.pos.z);
        g.fillStyle = r.status === 'CommLost' ? '#64748b' : r.color;
        g.beginPath(); g.arc(x, y, 3.4, 0, 7); g.fill();
        g.fillStyle = '#e2e8f0';
        g.font = '7px monospace';
        g.fillText(r.id, x + 5, y + 3);
      }
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, [isolatedId]);
  return (
    <div className="float minimap">
      <canvas ref={ref} width={196} height={196} aria-label="2D minimap" />
      <div className="num" style={{ fontSize: 10, color: 'var(--dim)', marginTop: 4, textAlign: 'center' }}>MINIMAP · N↑ · 260m GRID</div>
    </div>
  );
}

/* ── alerts: passive / elevated / critical (PRD §77–78) ── */
export function Alerts() {
  const alerts = useStore((s) => s.alerts);
  const simTime = useStore((s) => s.simTime);
  const ack = useStore((s) => s.ack);
  const ackAll = useStore((s) => s.ackAll);
  const pending = alerts.filter((a) => !a.acked && a.level !== 'passive').slice(0, 3);
  const critCount = alerts.filter((a) => !a.acked && a.level === 'critical').length;
  if (pending.length === 0) return null;
  return (
    <div className="toasts" role="alert">
      {critCount > 1 && (
        <button className="btn sm warn" style={{ alignSelf: 'center' }} onClick={ackAll}><Check size={12} /> Acknowledge all ({critCount + pending.length})</button>
      )}
      {pending.map((a) => (
        <div key={a.id} className={`toast ${a.level}`}>
          <BellRing size={16} color={a.level === 'critical' ? '#ef4444' : '#fbbf24'} style={{ marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div className="tt">{a.title}</div>
            <div className="td">{a.detail} · <span className="num">{fmtAge(simTime, a.t)}</span></div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button className="btn sm" onClick={() => {
                const st = useStore.getState();
                if (a.survivorId) { st.select({ kind: 'survivor', id: a.survivorId }); st.focus('survivor', a.survivorId); }
                else if (a.hazardId) { st.select({ kind: 'hazard', id: a.hazardId }); st.focus('hazard', a.hazardId); }
                else if (a.robotId) { st.select({ kind: 'robot', id: a.robotId }); st.focus('robot', a.robotId); }
                ack(a.id);
              }}>Inspect</button>
              <button className="btn sm" onClick={() => ack(a.id)}><Check size={12} /> Ack</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── building focus mode: exploded floors + cutaway (PRD §16–18, §86) ── */
export function BuildingFocus() {
  const isolatedId = useStore((s) => s.isolatedId);
  const b = useStore((s) => s.buildings.find((x) => x.id === isolatedId));
  const explode = useStore((s) => s.explode);
  const setExplode = useStore((s) => s.setExplode);
  const cutX = useStore((s) => s.cutX);
  const cutY = useStore((s) => s.cutY);
  const cutZ = useStore((s) => s.cutZ);
  const setCut = useStore((s) => s.setCut);
  const setIsolated = useStore((s) => s.setIsolated);
  const compare = useStore((s) => s.compare);
  const toggleCompare = useStore((s) => s.toggleCompare);
  const st = useStore.getState();
  if (!b) return null;
  const explored = b.floorsExplored.filter(Boolean).length;
  return (
    <div className="float bview" role="dialog" aria-label={`Building focus ${b.id}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>◀ {b.label}</h3>
        <button className="btn sm" onClick={() => setIsolated(null)}><X size={12} /> Exit</button>
      </div>
      <div className="num" style={{ fontSize: 11, color: 'var(--mut)' }}>
        {explored}/{b.floors} floors observed · {Math.round(b.observed * 100)}% · {b.condition.toUpperCase()}
      </div>
      <div style={{ marginTop: 8 }}>
        {b.floorsExplored.map((f, i) => (
          <div key={i} className="kv"><span className="k">Floor {i === 0 ? 'G' : i}</span>
            <span className="v">{f ? `${20 + i * 15}% mapped` : '── unseen ──'}</span></div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, fontSize: 11 }}>
        <Boxes size={13} /> Explode
        <input type="range" min={0} max={1} step={0.01} value={explode} style={{ flex: 1 }}
          onChange={(e) => setExplode(Number(e.target.value))} aria-label="Exploded floor separation" />
        <span className="num">{Math.round(explode * 100)}%</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 11 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}><Slice size={13} /> Cutaway planes</div>
        {(['X', 'Z'] as const).map((ax) => (
          <div key={ax} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 }}>
            <span className="num" style={{ width: 14 }}>{ax}</span>
            <input type="range" min={0} max={1} step={0.01} style={{ flex: 1 }}
              value={ax === 'X' ? cutX ?? 1 : cutZ ?? 1}
              onChange={(e) => setCut(ax, Number(e.target.value) >= 0.999 ? null : Number(e.target.value))} aria-label={`${ax} slice`} />
            <button className="btn sm" onClick={() => setCut(ax, null)}>Reset</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 }}>
          <span className="num" style={{ width: 14 }}>H</span>
          <input type="range" min={0} max={1} step={0.01} style={{ flex: 1 }} value={cutY ?? 1}
            onChange={(e) => setCut('Y', Number(e.target.value) >= 0.999 ? null : Number(e.target.value))} aria-label="Altitude slice" />
          <button className="btn sm" onClick={() => setCut('Y', null)}>Reset</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
        <button className={`btn sm${compare ? ' pri' : ''}`} onClick={toggleCompare}><GitCompareArrows size={12} /> Baseline ⇄ Observed</button>
        <button className="btn sm pri" onClick={() => st.gotoPreset('survivors')}>Survivors</button>
      </div>
    </div>
  );
}

/* ── command palette (PRD §51) ── */
export function CommandPalette() {
  const open = useStore((s) => s.paletteOpen);
  const setPalette = useStore((s) => s.setPalette);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open ]);
  const st = useStore.getState();
  const cmds = useMemo(() => {
    const all: { label: string; hint: string; run: () => void }[] = [
      ...st.robots.map((r) => ({ label: `Focus robot ${r.id} — ${r.status}`, hint: r.id, run: () => { st.select({ kind: 'robot', id: r.id }); st.focus('robot', r.id); } })),
      ...st.buildings.map((b) => ({ label: `Jump to building ${b.id}`, hint: b.id, run: () => { st.select({ kind: 'building', id: b.id }); st.focus('building', b.id); } })),
      ...st.survivors.map((s) => ({ label: `Show survivor (${s.status}, F${s.floor})`, hint: 'P0', run: () => { st.select({ kind: 'survivor', id: s.id }); st.focus('survivor', s.id); } })),
      { label: 'Create mission — search survivors', hint: 'M', run: () => st.startMissionDraft('SearchSurvivors') },
      { label: 'Toggle hazards layer', hint: 'layer', run: () => st.toggleLayer('hazards') },
      { label: 'Toggle signal overlay', hint: 'layer', run: () => st.toggleLayer('signal') },
      { label: 'Camera — full incident', hint: '1', run: () => st.gotoPreset('incident') },
      { label: 'Camera — top-down coverage', hint: '2', run: () => st.gotoPreset('coverage') },
      { label: 'Trigger aftershock (demo)', hint: 'demo', run: () => st.aftershock() },
      { label: 'Reset incident', hint: 'demo', run: () => st.reset() },
    ];
    const needle = q.trim().toLowerCase();
    return needle ? all.filter((c) => c.label.toLowerCase().includes(needle)).slice(0, 12) : all.slice(0, 12);
  }, [q, open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  return (
    <div className="palette" onClick={() => setPalette(false)}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(cmds.length - 1, i + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
            if (e.key === 'Enter' && cmds[idx]) { cmds[idx].run(); setPalette(false); }
            if (e.key === 'Escape') setPalette(false);
          }}
          placeholder="Type a command — robots, buildings, layers, camera…" aria-label="Command palette" />
        {cmds.map((c, i) => (
          <button key={c.label} className={`cmd${i === idx ? ' on' : ''}`} onMouseEnter={() => setIdx(i)}
            onClick={() => { c.run(); setPalette(false); }}>
            <span style={{ flex: 1 }}>{c.label}</span><span className="chip">{c.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
