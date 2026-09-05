import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Layers, MousePointer2, Ruler, PenSquare, TriangleAlert, Crosshair,
  Video, X, Check, BellRing, Slice, Boxes, GitCompareArrows,
} from 'lucide-react';
import { useStore, fmtAge, DISTRICT_HALF } from '../store';
import { PARIS } from '../data/district';
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
      <div className="float tools vertical" role="toolbar" aria-label="Map tools">
        <button className="iconbtn" id="layer-panel-toggle" title="Layers (L)" onClick={onLayers}><Layers size={15} /></button>
        <button className="iconbtn" title="Measure R-04 ↔ R-05" onClick={() => {
          const st = useStore.getState();
          const a = st.robots.find((r) => r.id === 'R-04')!;
          const b = st.robots.find((r) => r.id === 'R-05')!;
          const d = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
          st.auditLog(`Measured R-04 ↔ R-05: ${d.toFixed(1)} m.`);
        }}><Ruler size={15} /></button>
        <button className="iconbtn" title="Add operator note" onClick={() => {
          const st = useStore.getState();
          st.auditLog('Annotation added at incident centre: "Staging expansion — OP-A".');
        }}><PenSquare size={15} /></button>
        <button className="iconbtn" title="Report hazard at selected robot" onClick={() => useStore.getState().triggerHazard()}><TriangleAlert size={15} /></button>
        <button className="iconbtn" title="Compare baseline vs current" onClick={() => useStore.getState().toggleCompare()}><GitCompareArrows size={15} /></button>
      </div>
      <div className="float campresets">
        <Crosshair size={12} color="#5f6d82" />
        <select value="" onChange={(e) => { if (e.target.value) gotoPreset(e.target.value as never); e.target.value = ''; }} aria-label="Camera view">
          <option value="">View…</option>
          {(['incident', 'robots', 'hazards', 'survivors', 'comms', 'coverage'] as const).map((p) => (
            <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
          ))}
        </select>
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
  const [open, setOpen] = useState(false);
  const compare = useStore((s) => s.compare);
  return (
    <div className="float keychip">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Map key">
        <span className="sw" style={{ background: '#2dd4bf' }} /> Map key {open ? '▾' : '▸'}
      </button>
      {open && (
        <div className="rows">
          <div className="row"><span className="sw" style={{ background: '#3b4c63' }} /> Baseline — unverified import</div>
          <div className="row"><span className="sw" style={{ background: '#2dd4bf' }} /> Observed — robot-confirmed</div>
          <div className="row"><span className="sw" style={{ background: '#f472b6' }} /> Contradicted by robots</div>
          <div className="row"><span className="sw" style={{ background: '#f0abfc' }} /> Survivor — P0 priority</div>
          {compare && <div className="row" style={{ color: '#a5f3fc' }}>◐ COMPARE: baseline vs current</div>}
        </div>
      )}
    </div>
  );
}

/* ── 2D minimap over the real Paris segment (PRD §50) ── */
function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const isolatedId = useStore((s) => s.isolatedId);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (hidden) return;
    let raf = 0;
    function draw() {
      raf = requestAnimationFrame(draw);
      const c = ref.current;
      if (!c) return;
      const g = c.getContext('2d')!;
      const W = c.width, H = c.height;
      const st = useStore.getState();
      const S = DISTRICT_HALF;
      const toPx = (x: number, z: number): [number, number] => [
        ((x + S) / (2 * S)) * W, ((z + S) / (2 * S)) * H,
      ];
      const path = (pts: [number, number][]) => {
        g.beginPath();
        pts.forEach(([x, z], i) => {
          const [px, py] = toPx(x, z);
          if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        });
        g.closePath();
      };
      g.fillStyle = '#070c15';
      g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(20,70,110,.85)';
      for (const w of PARIS.water) { path(w.pts); g.fill(); }
      g.fillStyle = 'rgba(20,53,34,.9)';
      for (const gr of PARIS.green) { if (gr.pts.length > 2) { path(gr.pts); g.fill(); } }
      g.strokeStyle = 'rgba(90,110,140,.5)';
      g.lineWidth = 1;
      for (const r of PARIS.roads) {
        g.beginPath();
        r.pts.forEach(([x, z], i) => {
          const [px, py] = toPx(x, z);
          if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        });
        g.stroke();
      }
      g.fillStyle = 'rgba(100,116,139,.45)';
      for (const cb of PARIS.context) {
        const pts = 'pts' in cb ? cb.pts : [[cb.rect[0], cb.rect[1]], [cb.rect[2], cb.rect[1]], [cb.rect[2], cb.rect[3]], [cb.rect[0], cb.rect[3]]] as [number, number][];
        path(pts); g.fill();
      }
      for (const b of st.buildings) {
        if (b.kind === 'tower') {
          const [x, y] = toPx(b.x + b.w / 2, b.z + b.d / 2);
          g.fillStyle = '#e7d6b5';
          g.fillRect(x - 2, y - 2, 4, 4);
          continue;
        }
        g.fillStyle = b.id === isolatedId ? 'rgba(34,211,238,.85)' : b.priority ? 'rgba(240,171,252,.55)' : b.observed > 0.3 ? 'rgba(45,212,191,.5)' : 'rgba(100,116,139,.5)';
        path(b.poly ?? [[b.x, b.z], [b.x + b.w, b.z], [b.x + b.w, b.z + b.d], [b.x, b.z + b.d]]);
        g.fill();
      }
      for (const hz of st.hazards) {
        const [x, y] = toPx(hz.pos.x, hz.pos.z);
        g.fillStyle = hz.severity === 'Critical' ? '#ef4444' : '#fbbf24';
        g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill();
      }
      for (const s of st.survivors) {
        const [x, y] = toPx(s.pos.x, s.pos.z);
        g.fillStyle = '#f0abfc';
        g.fillRect(x - 2, y - 2, 4, 4);
      }
      for (const r of st.robots) {
        const [x, y] = toPx(r.pos.x, r.pos.z);
        g.fillStyle = r.status === 'CommLost' ? '#64748b' : r.color;
        g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill();
      }
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, [isolatedId, hidden]);
  return (
    <div className="float minimap">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span className="num" style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: '.08em' }}>PARIS 7E · N↑</span>
        <button className="iconbtn" style={{ width: 18, height: 18 }} onClick={() => setHidden((h) => !h)} aria-label="Toggle minimap">
          <X size={10} />
        </button>
      </div>
      {!hidden && <canvas ref={ref} width={148} height={148} aria-label="2D minimap of Paris segment" />}
    </div>
  );
}

/* ── alerts: passive / elevated / critical (PRD §77–78) ── */
export function Alerts() {
  const alerts = useStore((s) => s.alerts);
  const simTime = useStore((s) => s.simTime);
  const ack = useStore((s) => s.ack);
  const ackAll = useStore((s) => s.ackAll);
  const pending = alerts.filter((a) => !a.acked && a.level !== 'passive').slice(0, 2);
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
      { label: 'Measure R-04 ↔ R-05', hint: 'tool', run: () => {
        const a = st.robots.find((r) => r.id === 'R-04')!;
        const b = st.robots.find((r) => r.id === 'R-05')!;
        st.auditLog(`Measured R-04 ↔ R-05: ${Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z).toFixed(1)} m.`);
      } },
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
