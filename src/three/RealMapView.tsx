// ─── REAL photorealistic 3D viewport (Google Maps 3D Tiles) ─────────────────
// Zero modeling: Google's textured mesh of Paris (including the Eiffel Tower)
// is the basemap. The local simulation (robots, hazards, survivors, routes,
// missions, timeline) drives 3D markers + polylines on top, and marker clicks
// feed the same inspector as the offline scene.
// Requires internet + a Maps API key (see setup panel). Offline OSM scene
// remains the default fallback — toggle in the top bar.
import { useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { Crosshair, X } from 'lucide-react';
import { useStore } from '../store';
import type { CameraPreset } from '../store';
import type { MissionType } from '../types';
import { PARIS } from '../data/district';
import { Minimap } from '../components/Overlays';

const LAT0 = 48.85837; // must match scripts/fetch-paris.mjs
const LON0 = 2.294481;
const R = 6371000;

export function toLatLng(x: number, z: number): { lat: number; lng: number } {
  return {
    lat: LAT0 - (z / R) * 180 / Math.PI,
    lng: LON0 + (x / (R * Math.cos(LAT0 * Math.PI / 180))) * 180 / Math.PI,
  };
}
function toLocal(lat: number, lng: number): { x: number; z: number } {
  return {
    x: R * ((lng - LON0) * Math.PI / 180) * Math.cos(LAT0 * Math.PI / 180),
    z: -R * ((lat - LAT0) * Math.PI / 180),
  };
}

type Status = 'setup' | 'loading' | 'ready' | 'error';

const HZ_SHORT: Record<string, string> = {
  collapse: 'CAVE-IN', unstable: 'UNSTABLE', fire: 'FIRE', smoke: 'SMOKE',
  gas: 'GAS', water: 'WATER', electrical: 'ELEC', chemical: 'CHEM',
  heat: 'HEAT', blocked: 'BLOCKED', debris: 'DEBRIS', aftershock: 'QUAKE',
  blackout: 'DARK', unknown: 'HAZARD',
};

export default function RealMapView() {
  const mountRef = useRef<HTMLDivElement>(null);
  const key = useStore((s) => s.mapsKey);
  const [status, setStatus] = useState<Status>(key ? 'loading' : 'setup');
  const [err, setErr] = useState('');
  const [editKey, setEditKey] = useState(false);
  const [draft, setDraft] = useState('');
  const libRef = useRef<google.maps.Maps3DLibrary | null>(null);
  const mapRef = useRef<google.maps.maps3d.Map3DElement | null>(null);
  const marksRef = useRef(new Map<string, google.maps.maps3d.Marker3DInteractiveElement>());
  const linesRef = useRef(new Map<string, google.maps.maps3d.Polyline3DInteractiveElement>());

  const setMapsKey = useStore((s) => s.setMapsKey);
  const setView3d = useStore((s) => s.setView3d);

  /* ── init once per key ── */
  useEffect(() => {
    if (!key) { setStatus('setup'); return; }
    if (editKey) return;
    let cancelled = false;
    let timer = 0;
    setStatus('loading');
    setErr('');
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
      if (!cancelled) {
        setErr('Google rejected the API key. Enable the Maps JavaScript API, check billing and key restrictions.');
        setStatus('error');
      }
    };
    (async () => {
      try {
        setOptions({ key, v: 'weekly' });
        const lib = await importLibrary('maps3d');
        if (cancelled) return;
        libRef.current = lib;
        const mount = mountRef.current;
        if (!mount) return;
        mount.innerHTML = '';
        const c = toLatLng(10, 10);
        const map = new lib.Map3DElement({
          center: { lat: c.lat, lng: c.lng, altitude: 40 },
          tilt: 65, range: 620, heading: 340, mode: 'HYBRID',
        });
        mapRef.current = map;
        mount.appendChild(map);
        map.addEventListener('gmp-error', () => {
          if (!cancelled) {
            setErr('The 3D map reported an error — network, key restrictions, or the API is not enabled.');
            setStatus('error');
          }
        });
        // background click → commit armed mission (marker clicks are filtered by target)
        map.addEventListener('gmp-click', ((e: Event) => {
          if ((e as unknown as { target: unknown }).target !== map) return;
          const pos = (e as unknown as { position?: { lat: number; lng: number } | null }).position;
          if (!pos) return;
          const st = useStore.getState();
          if (!st.missionDraft) return;
          const { x, z } = toLocal(pos.lat, pos.lng);
          const avail = st.robots.filter((r) => r.status !== 'CommLost').slice(0, 2).map((r) => r.id);
          st.commitMissionDraft({
            x: Math.max(-185, Math.min(185, x)), y: 0,
            z: Math.max(-185, Math.min(185, z)),
          }, avail);
        }) as EventListener);
        timer = window.setInterval(syncMarkers, 600);
        timerRef.current = timer;
        syncMarkers();
        if (!cancelled) setStatus('ready');
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : String(e));
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      try { delete (window as unknown as { gm_authFailure?: () => void }).gm_authFailure; } catch { /* noop */ }
      marksRef.current.clear();
      linesRef.current.clear();
      if (mountRef.current) mountRef.current.innerHTML = '';
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, editKey]);

  /* ── camera requests (presets + focus) ── */
  const camReq = useStore((s) => s.camReq);
  const focusReq = useStore((s) => s.focusReq);
  useEffect(() => {
    if (!camReq || status !== 'ready') return;
    const st = useStore.getState();
    const b14 = st.buildings.find((b) => b.id === 'B14');
    const fx = b14 ? b14.x + b14.w / 2 : 120;
    const fz = b14 ? b14.z + b14.d / 2 : 0;
    const P: Record<CameraPreset, { x: number; z: number; range: number; tilt: number; heading: number }> = {
      incident: { x: 10, z: 10, range: 750, tilt: 62, heading: 340 },
      robots: { x: fx - 25, z: fz + 25, range: 300, tilt: 60, heading: 340 },
      hazards: { x: fx, z: fz, range: 190, tilt: 60, heading: 340 },
      survivors: { x: fx, z: fz, range: 190, tilt: 60, heading: 340 },
      comms: { x: 105, z: 10, range: 380, tilt: 55, heading: 0 },
      coverage: { x: 0, z: 10, range: 700, tilt: 5, heading: 0 },
    };
    flyTo(P[camReq.name]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camReq?.nonce, status]);

  useEffect(() => {
    if (!focusReq || status !== 'ready') return;
    const st = useStore.getState();
    const { kind, id } = focusReq;
    let p: { x: number; z: number } | null = null;
    if (kind === 'robot') { const r = st.robots.find((x) => x.id === id); if (r) p = posAt(r, st.viewTime); }
    if (kind === 'building') { const b = st.buildings.find((x) => x.id === id); if (b) p = { x: b.x + b.w / 2, z: b.z + b.d / 2 }; }
    if (kind === 'hazard') { const h = st.hazards.find((x) => x.id === id); if (h) p = h.pos; }
    if (kind === 'survivor') { const s = st.survivors.find((x) => x.id === id); if (s) p = s.pos; }
    if (p) flyTo({ x: p.x, z: p.z, range: 140, tilt: 58, heading: 340 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusReq?.nonce, status]);

  function flyTo(t: { x: number; z: number; range: number; tilt: number; heading: number }) {
    const map = mapRef.current;
    if (!map) return;
    const { lat, lng } = toLatLng(t.x, t.z);
    const reduced = useStore.getState().reducedMotion;
    if (reduced) {
      map.center = { lat, lng, altitude: 40 };
      map.tilt = t.tilt; map.range = t.range; map.heading = t.heading;
      return;
    }
    try {
      map.flyCameraTo({
        endCamera: { center: { lat, lng, altitude: 40 }, tilt: t.tilt, range: t.range, heading: t.heading },
        durationMillis: 1200,
      });
    } catch {
      map.center = { lat, lng, altitude: 40 };
      map.tilt = t.tilt; map.range = t.range; map.heading = t.heading;
    }
  }

  function syncMarkers() {
    try {
      syncMarkersInner();
    } catch (e) {
      window.clearInterval(timerRef.current);
      setErr(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }

  const timerRef = useRef(0);

  function syncMarkersInner() {
    const lib = libRef.current;
    const map = mapRef.current;
    if (!lib || !map) return;
    const st = useStore.getState();
    const live = st.viewTime == null;
    const simT = live ? st.simTime : (st.viewTime as number);
    const seen = new Set<string>();

    const upsert = (id: string, ll: { lat: number; lng: number }, alt: number, label: string, title: string, onClick: () => void) => {
      seen.add(id);
      let m = marksRef.current.get(id);
      if (!m) {
        m = new lib.Marker3DInteractiveElement({
          position: { lat: ll.lat, lng: ll.lng, altitude: alt },
          label, title, extruded: true, altitudeMode: 'RELATIVE_TO_GROUND',
        });
        m.addEventListener('gmp-click', ((e: Event) => {
          e.stopPropagation();
          onClick();
        }) as EventListener);
        map.appendChild(m);
        marksRef.current.set(id, m);
      } else {
        m.position = { lat: ll.lat, lng: ll.lng, altitude: alt };
        if (m.label !== label) m.label = label;
        if (m.title !== title) m.title = title;
      }
    };

    for (const r of st.robots) {
      const p = posAt(r, st.viewTime);
      const ll = toLatLng(p.x, p.z);
      upsert(`r-${r.id}`, ll, 6, r.id,
        `${r.id} · ${r.status} · batt ${r.battery.toFixed(0)}% · sig ${r.signal.toFixed(0)}%`,
        () => st.select({ kind: 'robot', id: r.id }));
    }
    for (const h of st.hazards.filter((x) => x.status === 'active' && (live || x.createdAt <= simT)).slice(-12)) {
      const ll = toLatLng(h.pos.x, h.pos.z);
      upsert(`h-${h.id}`, ll, 30, HZ_SHORT[h.category] ?? h.category.toUpperCase().slice(0, 8),
        `${h.label} · ${h.severity} · ${Math.round(h.confidence * 100)}% · src ${h.source}`,
        () => st.select({ kind: 'hazard', id: h.id }));
    }
    for (const s of st.survivors.filter((x) => live || x.detectedAt <= simT)) {
      const ll = toLatLng(s.pos.x, s.pos.z);
      upsert(`s-${s.id}`, ll, 26, 'SOS',
        `${s.status} survivor · F${s.floor} · ${Math.round(s.confidence * 100)}% · ${s.detectedBy}`,
        () => st.select({ kind: 'survivor', id: s.id }));
    }
    {
      const ll = toLatLng(PARIS.staging.x, PARIS.staging.z);
      upsert('staging', ll, 8, 'BASE', 'Staging · Champ de Mars', () => undefined);
    }
    for (const [id, m] of [...marksRef.current]) {
      if (!seen.has(id)) { m.remove(); marksRef.current.delete(id); }
    }

    // routes as colored 3D polylines
    const rseen = new Set<string>();
    if (st.layers.routes) {
      for (const rt of st.routes) {
        if (rt.status === 'done') continue;
        const rb = st.robots.find((x) => x.id === rt.robotId);
        if (!rb) continue;
        const pts = (rt.status === 'active' ? [posAt(rb, st.viewTime), ...rt.waypoints] : rt.waypoints)
          .map((w) => { const ll = toLatLng(w.x, w.z); return { lat: ll.lat, lng: ll.lng, altitude: 10 }; });
        if (pts.length < 2) continue;
        const color = rt.status === 'invalid' ? '#ef4444' : rt.status === 'suggested' ? '#fbbf24' : rt.status === 'planned' ? '#94a3b8' : '#22d3ee';
        rseen.add(rt.id);
        let line = linesRef.current.get(rt.id);
        if (!line) {
          line = new lib.Polyline3DInteractiveElement({
            coordinates: pts, outerColor: color, strokeColor: color,
            altitudeMode: 'RELATIVE_TO_GROUND',
          });
          map.appendChild(line);
          linesRef.current.set(rt.id, line);
        } else {
          line.coordinates = pts;
          if (line.outerColor !== color) { line.outerColor = color; line.strokeColor = color; }
        }
      }
    }
    for (const [id, l] of [...linesRef.current]) {
      if (!rseen.has(id)) { l.remove(); linesRef.current.delete(id); }
    }
  }

  function saveKey() {
    const v = draft.trim();
    if (!v) return;
    if (v === key) { setEditKey(false); return; }
    setMapsKey(v); // persists to sessionStorage, then clean boot so the loader picks it up
    window.location.reload();
  }

  const showSetup = !key || editKey;
  return (
    <div className="realmap" aria-label="Real photorealistic 3D map">
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
      {status === 'ready' && (
        <>
          <RealToolbar />
          <Minimap />
        </>
      )}
      {showSetup && (
        <div className="float" style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 440, maxWidth: '92%', padding: '18px 20px', zIndex: 30 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>Real photorealistic 3D</h2>
          <p style={{ color: 'var(--mut)', fontSize: 12, margin: '0 0 10px' }}>
            Textured 3D Paris from Google — the actual tower and streets, no modeling.
            Needs internet plus a free API key (Google's requirement, not ours).
          </p>
          <ol style={{ fontSize: 12, color: 'var(--mut)', paddingLeft: 18, margin: '0 0 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <li>Open the <a href="https://console.cloud.google.com/google/maps-apis/start" target="_blank" rel="noreferrer" style={{ color: 'var(--acc)' }}>Google Maps Platform console</a>, create a project.</li>
            <li>Enable the <b>Maps JavaScript API</b> (a billing account is required; demo-scale use stays in the free quota).</li>
            <li>Create an API key (restrict it to your site), paste it below — or set <span className="num">VITE_GOOGLE_MAPS_KEY</span> and rebuild.</li>
          </ol>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveKey()}
              placeholder="AIza…  (stored in this browser session only)" aria-label="Google Maps API key"
              style={{ flex: 1, background: 'rgba(255,255,255,.04)', border: '1px solid var(--line-strong)', borderRadius: 8, color: 'var(--txt)', padding: '7px 10px', fontSize: 12, outline: 'none' }} />
            <button className="btn pri" onClick={saveKey} disabled={!draft.trim()}>Load 3D</button>
          </div>
          <button className="btn sm" style={{ marginTop: 10 }} onClick={() => setView3d('offline')}>Continue with offline OSM 3D instead</button>
        </div>
      )}
      {status === 'loading' && (
        <div className="float" style={{ left: '50%', top: 16, transform: 'translateX(-50%)', padding: '8px 16px', zIndex: 30 }}>
          <span className="pulse num" style={{ fontSize: 12 }}>Loading photorealistic tiles…</span>
        </div>
      )}
      {status === 'error' && !editKey && (
        <div className="float" style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 420, maxWidth: '92%', padding: '18px 20px', zIndex: 30 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 15 }}>Real 3D failed to load</h2>
          <p className="num" style={{ color: 'var(--bad)', fontSize: 11.5, wordBreak: 'break-word' }}>{err || 'Unknown loader error.'}</p>
          <p style={{ color: 'var(--mut)', fontSize: 12 }}>Check the key, enabled APIs, billing, and network — or keep working offline.</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button className="btn sm" onClick={() => window.location.reload()}>Retry</button>
            <button className="btn sm" onClick={() => setEditKey(true)}>Change key</button>
            <button className="btn sm pri" onClick={() => setView3d('offline')}>Use offline OSM 3D</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* robot position honoring timeline replay */
function posAt(r: { pos: { x: number; y: number; z: number }; history: { t: number; x: number; z: number; y: number }[] }, viewT: number | null) {
  if (viewT == null || r.history.length === 0) return r.pos;
  let best = r.history[0];
  for (const h of r.history) { if (h.t <= viewT) best = h; else break; }
  return { x: best.x, y: best.y, z: best.z };
}

const MISSION_TYPES: MissionType[] = ['Explore', 'SearchStructure', 'InspectHazard', 'Verify', 'Deliver', 'Relay', 'MapInterior', 'SearchSurvivors', 'Return', 'Hold'];

function RealToolbar() {
  const gotoPreset = useStore((s) => s.gotoPreset);
  const startMissionDraft = useStore((s) => s.startMissionDraft);
  const missionDraft = useStore((s) => s.missionDraft);
  const cancelMissionDraft = useStore((s) => s.cancelMissionDraft);
  const [mtype, setMtype] = useState<MissionType>('SearchSurvivors');
  return (
    <div className="float campresets">
      <Crosshair size={12} color="#5f6d82" />
      <select value="" onChange={(e) => { if (e.target.value) gotoPreset(e.target.value as never); e.target.value = ''; }} aria-label="Camera view">
        <option value="">View…</option>
        {(['incident', 'robots', 'hazards', 'survivors', 'comms', 'coverage'] as const).map((p) => (
          <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
        ))}
      </select>
      {missionDraft ? (
        <span className="badge sim">CLICK MAP → {missionDraft.type.toUpperCase()} <button className="iconbtn" style={{ width: 18, height: 18 }} onClick={cancelMissionDraft} aria-label="Cancel mission"><X size={11} /></button></span>
      ) : (
        <select value={mtype} onChange={(e) => setMtype(e.target.value as MissionType)} aria-label="Mission type">
          {MISSION_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      )}
      {!missionDraft && <button className="btn sm pri" onClick={() => startMissionDraft(mtype)}>+ Task</button>}
    </div>
  );
}
