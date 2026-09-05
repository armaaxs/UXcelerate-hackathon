// ─── RescueGrid store + local simulation engine (PRD §73–76) ────────────────
// No backend, no network. All telemetry, discoveries, hazards and comms
// behaviour are generated locally so the full interface works offline.

import { create } from 'zustand';
import type {
  Alert, AuditEntry, BuildingState, Discovery, Hazard, LayerState,
  Mission, MissionType, OpEvent, Priority, RobotState, RouteState,
  Selection, Survivor, Vec3,
} from './types';
import { buildDistrict, edgePoint } from './data/district';

let seq = 1;
const nid = (p: string) => `${p}-${seq++}-${Math.floor(Math.random() * 1e4)}`;

export const GRID_N = 26;
export const DISTRICT_HALF = 190;

const SPEEDS = [1, 2, 4];

export interface FocusReq { kind: string; id: string; nonce: number }
export interface CamReq { name: CameraPreset; nonce: number }
export type CameraPreset =
  | 'incident' | 'robots' | 'hazards' | 'survivors' | 'comms' | 'coverage';

interface Store {
  simTime: number;
  running: boolean;
  speedIdx: number;
  viewTime: number | null; // null = LIVE
  robots: RobotState[];
  buildings: BuildingState[];
  hazards: Hazard[];
  survivors: Survivor[];
  discoveries: Discovery[];
  events: OpEvent[];
  missions: Mission[];
  routes: RouteState[];
  alerts: Alert[];
  audit: AuditEntry[];
  selection: Selection;
  layers: LayerState;
  isolatedId: string | null;
  explode: number; // 0..1
  cutX: number | null; cutY: number | null; cutZ: number | null;
  compare: boolean;
  focusReq: FocusReq | null;
  camReq: CamReq | null;
  coverage: number[][];
  fired: Record<string, boolean>;
  ambientAt: number;
  histAt: number;
  missionDraft: { type: MissionType; point: Vec3 } | null;
  highContrast: boolean;
  reducedMotion: boolean;
  paletteOpen: boolean;
  simBanner: boolean;
  /** 3D viewport: local OSM scene vs real photorealistic tiles (needs key+net) */
  view3d: 'offline' | 'real';
  mapsKey: string;

  tick: (dtReal: number) => void;
  play: () => void; pause: () => void; cycleSpeed: () => void;
  setViewTime: (t: number | null) => void;
  select: (s: Selection) => void;
  focus: (kind: string, id: string) => void;
  gotoPreset: (name: CameraPreset) => void;
  toggleLayer: (k: keyof LayerState) => void;
  setIsolated: (id: string | null) => void;
  setExplode: (v: number) => void;
  setCut: (axis: 'X' | 'Y' | 'Z', v: number | null) => void;
  toggleCompare: () => void;
  ack: (id: string) => void;
  ackAll: () => void;
  reset: () => void;
  aftershock: () => void;
  triggerDiscovery: () => void;
  triggerHazard: () => void;
  disconnectRobot: (id?: string) => void;
  reconnectRobot: (id: string) => void;
  spawnSurvivor: () => void;
  startMissionDraft: (type: MissionType) => void;
  commitMissionDraft: (point: Vec3, robotIds: string[]) => void;
  cancelMissionDraft: () => void;
  assignRobot: (missionId: string, robotId: string) => void;
  setMissionStatus: (missionId: string, s: Mission['status']) => void;
  confirmReroute: (routeId: string) => void;
  verifySurvivor: (id: string, robotId: string) => void;
  setSurvivorStatus: (id: string, s: Survivor['status']) => void;
  mitigateHazard: (id: string) => void;
  updateRobotStatus: (id: string, s: RobotState['status']) => void;
  setPalette: (o: boolean) => void;
  setView3d: (v: 'offline' | 'real') => void;
  setMapsKey: (k: string) => void;
  toggleContrast: () => void; toggleMotion: () => void;
  auditLog: (text: string) => void;
}

const ROBOT_COLORS = ['#22d3ee', '#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#f472b6'];

function initialRobots(staging: Vec3): RobotState[] {
  // Waypoints follow real open ground: Champ de Mars, tower plaza (r≈73 m),
  // Quai Branly side streets and the Rue de l'Université blocks. y=0 ground.
  const defs: { id: string; kind: string; task: string; wps: Vec3[]; mission: string | null }[] = [
    { id: 'R-01', kind: 'Tracked UGV', task: 'Exploring western blocks', mission: 'M-02',
      wps: [{ x: -60, y: 0, z: 120 }, { x: -110, y: 0, z: 90 }, { x: -135, y: 0, z: 40 }, { x: -120, y: 0, z: -10 }, { x: -80, y: 0, z: -50 }], },
    { id: 'R-02', kind: 'Quadruped', task: 'Probing eastern blocks', mission: 'M-02',
      wps: [{ x: 30, y: 0, z: 70 }, { x: 70, y: 0, z: 45 }, { x: 100, y: 0, z: 20 }, { x: 112, y: 0, z: -2 }, { x: 95, y: 0, z: -40 }] },
    { id: 'R-03', kind: 'Tracked UGV', task: 'Holding tower plaza relay', mission: 'M-04',
      wps: [{ x: 70, y: 0, z: 25 }, { x: 25, y: 0, z: 72 }, { x: -68, y: 0, z: 25 }, { x: -25, y: 0, z: -68 }, { x: 40, y: 0, z: -60 }] },
    { id: 'R-04', kind: 'Quadruped · lidar', task: 'Search Structure B14 — north approach', mission: 'M-01',
      wps: [{ x: 50, y: 0, z: 110 }, { x: 110, y: 0, z: 70 }, { x: 150, y: 0, z: 25 }, { x: 168, y: 0, z: -8 }] },
    { id: 'R-05', kind: 'Tracked UGV', task: 'Search Structure B14 — south approach', mission: 'M-01',
      wps: [{ x: 30, y: 0, z: 130 }, { x: 95, y: 0, z: 95 }, { x: 140, y: 0, z: 45 }, { x: 158, y: 0, z: -30 }] },
    { id: 'R-06', kind: 'Scout · thermal', task: 'Sweeping blocks east of the tower', mission: 'M-03',
      wps: [{ x: 80, y: 0, z: 125 }, { x: 130, y: 0, z: 95 }, { x: 158, y: 0, z: 50 }, { x: 150, y: 0, z: 0 }] },
  ];
  return defs.map((d, i) => {
    const start = { x: staging.x + (i - 2.5) * 6, y: 0, z: staging.z - 6 - (i % 2) * 4 };
    return {
      id: d.id, name: d.id, kind: d.kind, pos: { ...start }, floor: 0,
      buildingId: null, heading: Math.PI, battery: 96 - i * 2.5, signal: 84 + (i % 3) * 4,
      status: i === 2 ? 'Waiting' : 'Exploring', task: d.task, missionId: d.mission,
      speed: 3.4 + (i % 3) * 0.5, waypoints: d.wps, wpIndex: 0, trail: [{ ...start }],
      history: [{ t: 0, x: start.x, z: start.z, y: 0 }],
      lastContact: 0, uncertainty: 1.4,
      sensors: { lidar: true, thermal: i === 5 || i === 3, gas: i === 4 || i === 3, audio: i === 5, camera: true },
      temp: 41 + i, latencyMs: 90 + i * 12, packetLoss: 0.4,
      color: ROBOT_COLORS[i % ROBOT_COLORS.length],
    } as RobotState;
  });
}

function initialMissions(): Mission[] {
  return [
    { id: 'M-01', title: 'Search Structure B14', type: 'SearchStructure', priority: 'P0', robotIds: ['R-04', 'R-05'], buildingId: 'B14', target: { x: 172, y: 0, z: -28 }, status: 'Active', progress: 12, createdAt: 0, updatedAt: 0, discoveries: 0, note: 'Baseline corridor assumed passable — verify with lidar.' },
    { id: 'M-02', title: 'Map western blocks', type: 'MapInterior', priority: 'P1', robotIds: ['R-01', 'R-02'], buildingId: null, target: { x: -100, y: 0, z: 20 }, status: 'Active', progress: 22, createdAt: 0, updatedAt: 0, discoveries: 1, note: 'Dead-zone comms expected east. Maintain relay via R-03.' },
    { id: 'M-03', title: 'Sweep blocks east of the tower', type: 'SearchSurvivors', priority: 'P1', robotIds: ['R-06'], buildingId: null, target: { x: 140, y: 0, z: 40 }, status: 'Active', progress: 8, createdAt: 0, updatedAt: 0, discoveries: 0, note: 'Thermal + audio sweep.' },
    { id: 'M-04', title: 'Hold tower plaza relay', type: 'Relay', priority: 'P2', robotIds: ['R-03'], buildingId: null, target: { x: 0, y: 0, z: 75 }, status: 'Active', progress: 40, createdAt: 0, updatedAt: 0, discoveries: 0, note: 'Maintain mesh uplink.' },
  ];
}

function initialRoutes(robots: RobotState[]): RouteState[] {
  return robots.map((r) => ({ id: `RT-${r.id}`, robotId: r.id, waypoints: [...r.waypoints], status: 'active' }));
}

function emptyCoverage(): number[][] {
  return Array.from({ length: GRID_N }, () => Array(GRID_N).fill(0));
}

let district = buildDistrict();

function freshState() {
  seq = 1;
  district = buildDistrict();
  const robots = initialRobots(district.staging);
  const b14c = (() => {
    const b = district.buildings.find((x) => x.id === 'B14')!;
    return { x: b.x + b.w / 2, y: 0, z: b.z + b.d / 2 };
  })();
  const missions = initialMissions().map((m) => m.id === 'M-01' ? { ...m, target: b14c } : m);
  return {
    simTime: 0,
    robots,
    buildings: district.buildings.map((b) => ({ ...b })),
    hazards: [] as Hazard[],
    survivors: [] as Survivor[],
    discoveries: [] as Discovery[],
    events: [
      { id: nid('ev'), t: 0, robotId: null, buildingId: null, kind: 'system', severity: 'P1', text: 'Incident declared — Paris 7e, Eiffel Tower sector. Origin at the tower; staging on Champ de Mars.' },
      { id: nid('ev'), t: 2, robotId: null, buildingId: null, kind: 'mission', severity: 'P2', text: '6 robots deployed from Champ de Mars staging. 4 missions opened.' },
    ] as OpEvent[],
    missions,
    routes: initialRoutes(robots),
    alerts: [
      { id: nid('al'), t: 2, level: 'passive', title: 'Fleet deployed', detail: '6 robots connected. Mesh link nominal.', acked: true },
    ] as Alert[],
    audit: [{ id: nid('au'), t: 0, actor: 'System', text: 'Incident workspace created (SIMULATION).' }] as AuditEntry[],
    coverage: emptyCoverage(),
    fired: {} as Record<string, boolean>,
    ambientAt: 26, histAt: 0,
  };
}

function deadZoneAt(x: number, z: number): boolean {
  const dz = district.deadZone;
  const dx = (x - dz.x) / dz.rx, dzz = (z - dz.z) / dz.rz;
  return dx * dx + dzz * dzz < 1;
}

function dist2(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function pushEvent(list: OpEvent[], e: Omit<OpEvent, 'id'>): OpEvent[] {
  return [...list.slice(-400), { ...e, id: nid('ev') }];
}
function pushAlert(list: Alert[], a: Omit<Alert, 'id' | 'acked'>): Alert[] {
  return [{ ...a, id: nid('al'), acked: a.level === 'passive' }, ...list].slice(0, 60);
}

function fireOnce(fired: Record<string, boolean>, key: string): boolean {
  return !fired[key];
}

// Google Maps key: build-time env wins, otherwise a key pasted in-app (session only, never committed).
function storedMapsKey(): string {
  try {
    const env = (import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined) || '';
    if (env) return env;
    return sessionStorage.getItem('rg-maps-key') || '';
  } catch { return ''; }
}

export const useStore = create<Store>((set, get) => {
  const init = freshState();

  function addDiscovery(d: Omit<Discovery, 'id'>, sev: Priority, feedText: string) {
    const s = get();
    const disc: Discovery = { ...d, id: nid('dc') };
    set({
      discoveries: [...s.discoveries, disc].slice(-200),
      events: pushEvent(s.events, { t: s.simTime, robotId: d.robotId, buildingId: d.buildingId, kind: 'discovery', severity: sev, text: feedText }),
      missions: s.missions.map((m) => m.robotIds.includes(d.robotId) ? { ...m, discoveries: m.discoveries + 1, updatedAt: s.simTime } : m),
    });
    return disc;
  }

  function addHazard(h: Omit<Hazard, 'id'>, feedText: string, alertLevel: Alert['level'], alertTitle: string) {
    const s = get();
    const hz: Hazard = { ...h, id: nid('hz') };
    // route invalidation: any active route passing within radius+6m is invalid
    const routes = s.routes.map((r) => {
      if (r.status !== 'active' && r.status !== 'planned') return r;
      const hit = r.waypoints.some((w) => dist2(w, hz.pos) < hz.radius + 8);
      return hit ? { ...r, status: 'invalid' as const, reason: `Passes through ${hz.label}` } : r;
    });
    const affected = s.routes.filter((r, i) => routes[i].status === 'invalid' && s.routes[i].status !== 'invalid');
    // suggested alternative for first affected route
    let extra: RouteState[] = [];
    if (affected.length > 0) {
      const r = affected[0];
      const alt = r.waypoints.map((w) => ({ ...w, x: w.x + 14, z: w.z + 10 }));
      extra = [{ id: nid('rt'), robotId: r.robotId, waypoints: alt, status: 'suggested', reason: `Suggested — avoids ${hz.label}` }];
    }
    const missionsBlocked = s.missions.map((m) =>
      affected.some((r) => m.robotIds.includes(r.robotId)) && m.status === 'Active'
        ? { ...m, status: 'Blocked' as const, updatedAt: s.simTime } : m);
    set({
      hazards: [...s.hazards, hz],
      routes: [...routes, ...extra],
      missions: missionsBlocked,
      events: pushEvent(s.events, { t: s.simTime, robotId: hz.source, buildingId: hz.buildingId, kind: 'hazard', severity: hz.severity === 'Critical' ? 'P0' : hz.severity === 'Dangerous' ? 'P1' : 'P2', text: feedText }),
      alerts: pushAlert(s.alerts, { t: s.simTime, level: alertLevel, title: alertTitle, detail: feedText, robotId: hz.source, hazardId: hz.id }),
      buildings: s.buildings.map((b) => b.id === hz.buildingId ? { ...b, lastObserved: s.simTime, observedBy: hz.source, observed: Math.min(1, b.observed + 0.18), priority: hz.severity === 'Critical' ? true : b.priority } : b),
    });
    return hz;
  }

  // ── scripted demo sequence (PRD §110) ──
  function script(s: Store, key: string, at: number, fn: () => void) {
    if (s.simTime >= at && fireOnce(s.fired, key)) {
      set({ fired: { ...get().fired, [key]: true } });
      fn();
    }
  }

  function runScript() {
    const s = get();
    script(s, 'blocked', 9, () => {
      const t = get().simTime;
      const b14 = get().buildings.find((b) => b.id === 'B14')!;
      const N = edgePoint(b14, 'N', 1.5);
      addDiscovery({ kind: 'blocked_passage', label: 'Blocked entrance — B14 north edge', detail: 'Lidar shows full-height collapse where baseline map assumed a passable corridor.', pos: { ...N }, buildingId: 'B14', robotId: 'R-04', confidence: 0.93, createdAt: t, priority: 'P1' },
        'P1', 'R-04 — Passage blocked: B14 north edge (lidar, 93%)');
      addHazard({ category: 'blocked', severity: 'Dangerous', pos: { ...N }, buildingId: 'B14', floor: 0, label: 'Blocked passage — B14 north', detail: 'Baseline corridor contradicted by R-04 lidar. Route invalidated.', confidence: 0.93, source: 'R-04', confirmedBy: [], createdAt: t, updatedAt: t, status: 'active', radius: 7 },
        'R-04 — Baseline corridor contradicted at B14 north. Route RT-R-04 invalid.', 'elevated', 'Route invalidated — R-04');
      set((st) => ({
        buildings: st.buildings.map((b) => b.id === 'B14' ? { ...b, contradicted: true } : b),
        robots: st.robots.map((r) => r.id === 'R-04' ? { ...r, status: 'Waiting', task: 'Holding — route invalid, awaiting replan' } : r),
      }));
      get().auditLog('System flagged RT-R-04 invalid (blocked passage, B14 north). Suggested alternative ready for confirmation.');
    });
    script(s, 'altentrance', 22, () => {
      const t = get().simTime;
      const b14 = get().buildings.find((b) => b.id === 'B14')!;
      const S = edgePoint(b14, 'S', 1.2);
      const C = { x: b14.x + b14.w / 2, y: 0, z: b14.z + b14.d / 2 };
      const A = { x: (S.x + C.x) / 2 - 12, y: 0, z: (S.z + C.z) / 2 + 14 };
      const S0 = { x: S.x, y: 0, z: S.z };
      addDiscovery({ kind: 'new_entrance', label: 'Alternative entrance — B14 south service bay', detail: 'R-05 camera confirms an accessible service opening on the south face.', pos: { ...S }, buildingId: 'B14', robotId: 'R-05', confidence: 0.87, createdAt: t, priority: 'P2' },
        'P2', 'R-05 — New entrance discovered: B14 south service bay (87%)');
      set((st) => ({
        robots: st.robots.map((r) => r.id === 'R-04'
          ? { ...r, status: 'Navigating' as const, task: 'Rerouting via B14 south entrance', waypoints: [A, S0, C], wpIndex: 0 }
          : r),
        routes: st.routes.map((r) => r.robotId === 'R-04' && r.status === 'invalid' ? { ...r, status: 'done' as const } : r).concat([{ id: nid('rt'), robotId: 'R-04', waypoints: [A, S0, C], status: 'active' as const }]),
        missions: st.missions.map((m) => m.id === 'M-01' ? { ...m, status: 'Active' as const, progress: Math.max(m.progress, 30) } : m),
      }));
      get().auditLog('Operator confirmed reroute: R-04 → B14 south entrance.');
    });
    script(s, 'gas', 34, () => {
      const t = get().simTime;
      const b14 = get().buildings.find((b) => b.id === 'B14')!;
      const C = { x: b14.x + b14.w / 2, z: b14.z + b14.d / 2 };
      addHazard({ category: 'gas', severity: 'Critical', pos: { x: C.x + 2, y: 2, z: C.z }, buildingId: 'B14', floor: 1, label: 'Gas leak — B14 Floor 1', detail: 'Elevated concentration. R-05 gas sensor + R-04 cross-check pending.', confidence: 0.91, source: 'R-05', confirmedBy: [], createdAt: t, updatedAt: t, status: 'active', radius: 10 },
        'R-05 — Gas leak detected: B14 Floor 1 (91%). R-05 rerouting clear.', 'critical', 'Gas leak — B14 Floor 1');
      set((st) => ({
        robots: st.robots.map((r) => r.id === 'R-05' ? { ...r, status: 'Navigating', task: 'Avoiding gas volume — east side', waypoints: [{ x: C.x + 14, y: 0, z: C.z + 4 }, { x: C.x + 20, y: 0, z: C.z + 16 }], wpIndex: 0 } : r),
      }));
    });
    script(s, 'survivor', 50, () => {
      const t = get().simTime;
      const b14 = get().buildings.find((b) => b.id === 'B14')!;
      const C = { x: b14.x + b14.w / 2, z: b14.z + b14.d / 2 };
      const sv: Survivor = { id: nid('sv'), pos: { x: C.x, y: 7.5, z: C.z }, buildingId: 'B14', floor: 3, confidence: 0.88, methods: ['thermal', 'audio'], status: 'Probable', detectedBy: 'R-06', detectedAt: t, priority: 'P0', accessNote: 'East stairwell passable. West stair collapsed — avoid.' };
      const st = get();
      set({
        survivors: [...st.survivors, sv],
        events: pushEvent(st.events, { t, robotId: 'R-06', buildingId: 'B14', kind: 'survivor', severity: 'P0', text: 'R-06 — Probable survivor: B14 Floor 3 (thermal + audio, 88%)' }),
        alerts: pushAlert(st.alerts, { t, level: 'critical', title: 'Probable survivor — B14 Floor 3', detail: 'Thermal + audio, 88%. Nearest: R-05 · ~3 min via east stairwell.', robotId: 'R-06', survivorId: sv.id }),
        buildings: st.buildings.map((b) => b.id === 'B14' ? { ...b, priority: true } : b),
        selection: { kind: 'survivor', id: sv.id },
      });
      get().auditLog('P0 raised: probable survivor B14-F3 (R-06). Building B14 set to priority.');
    });
    script(s, 'stair', 68, () => {
      const t = get().simTime;
      const b14 = get().buildings.find((b) => b.id === 'B14')!;
      const W = edgePoint(b14, 'W', 5);
      addHazard({ category: 'collapse', severity: 'Dangerous', pos: { ...W }, buildingId: 'B14', floor: 2, label: 'Collapsed stairwell — B14 west', detail: 'Vertical path F2→F3 severed. East stairwell remains the verified access.', confidence: 0.9, source: 'R-04', confirmedBy: ['R-05'], createdAt: t, updatedAt: t, status: 'active', radius: 6 },
        'R-04 — Stairwell collapse: B14 west (F2→F3 severed). Use east stair.', 'elevated', 'Stairwell collapse — B14');
    });
    script(s, 'comms', 92, () => {
      set((st) => ({
        robots: st.robots.map((r) => r.id === 'R-02' ? { ...r, status: 'CommLost', signal: 6, latencyMs: 2400, packetLoss: 38, task: 'Last known — eastern dead zone', uncertainty: 6 } : r),
        events: pushEvent(st.events, { t: st.simTime, robotId: 'R-02', buildingId: null, kind: 'comms', severity: 'P1', text: 'R-02 — telemetry connection lost. Last known position 12 s ago (eastern dead zone).' }),
        alerts: pushAlert(st.alerts, { t: st.simTime, level: 'elevated', title: 'Comms lost — R-02', detail: 'Last known eastern dead zone. Uncertainty radius growing.', robotId: 'R-02' }),
      }));
      get().auditLog('R-02 link lost (dead zone). Uncertainty envelope expanding.');
    });
    script(s, 'verify', 110, () => {
      const t = get().simTime;
      const b14 = get().buildings.find((b) => b.id === 'B14')!;
      const E = edgePoint(b14, 'E', 2);
      addDiscovery({ kind: 'new_room', label: 'Interior mapped — B14 Floor 1 east wing', detail: 'R-05 lidar completed east wing sweep. 6 rooms verified.', pos: { ...E }, buildingId: 'B14', robotId: 'R-05', confidence: 0.84, createdAt: t, priority: 'P3' },
        'P3', 'R-05 — Mapping completed: B14 Floor 1 east wing (84%)');
    });
  }

  const AMBIENT: { kind: string; label: (r: string) => string; detail: string; sev: Priority }[] = [
    { kind: 'new_room', label: (r) => `New room verified (${r})`, detail: 'Lidar sweep completed. Geometry promoted to observed.', sev: 'P3' },
    { kind: 'heat_source', label: () => 'Heat source logged', detail: 'Thermal anomaly recorded for later verification.', sev: 'P3' },
    { kind: 'terrain_change', label: () => 'Terrain change noted', detail: 'Rubble shift detected vs baseline.', sev: 'P2' },
    { kind: 'new_passage', label: () => 'Narrow passage probed', detail: 'Partial evidence — needs second-robot confirmation.', sev: 'P2' },
  ];

  return {
    simTime: init.simTime, running: true, speedIdx: 1, viewTime: null,
    robots: init.robots, buildings: init.buildings, hazards: init.hazards,
    survivors: init.survivors, discoveries: init.discoveries, events: init.events,
    missions: init.missions, routes: init.routes, alerts: init.alerts, audit: init.audit,
    selection: null,
    layers: { baseline: true, observed: true, pointcloud: true, robots: true, routes: true, trails: true, missions: true, hazards: true, survivors: true, discoveries: true, coverage: true, thermal: false, gas: false, signal: false, confidence: false, freshness: false, relays: true, labels: true },
    isolatedId: null, explode: 0.55, cutX: null, cutY: null, cutZ: null, compare: false,
    focusReq: null, camReq: null, coverage: init.coverage, fired: init.fired,
    ambientAt: init.ambientAt, histAt: init.histAt,
    missionDraft: null, highContrast: false, reducedMotion: false, paletteOpen: false, simBanner: true,
    view3d: storedMapsKey() ? 'real' : 'offline', mapsKey: storedMapsKey(),

    tick: (dtReal) => {
      const s = get();
      if (!s.running) return;
      const speed = SPEEDS[s.speedIdx] ?? 2;
      // Clamp huge tab-switch deltas
      const dt = Math.min(dtReal, 0.1) * speed;
      const t = s.simTime + dt;

      // move robots
      const robots: RobotState[] = s.robots.map((r) => {
        if (r.status === 'CommLost' || r.status === 'Immobilized' || r.status === 'Estop' || r.status === 'Fault') {
          return { ...r, uncertainty: Math.min(30, r.uncertainty + dt * 1.1), battery: Math.max(0, r.battery - dt * 0.01) };
        }
        if (r.status === 'Waiting' || r.status === 'Manual' || r.status === 'Ready') {
          return { ...r, battery: Math.max(0, r.battery - dt * 0.015), lastContact: t };
        }
        const target = r.waypoints[r.wpIndex % r.waypoints.length];
        if (!target) return r;
        const dx = target.x - r.pos.x, dz = target.z - r.pos.z;
        const d = Math.hypot(dx, dz);
        const step = r.speed * dt;
        let pos = r.pos, wpIndex = r.wpIndex, heading = r.heading;
        if (d < 1.2) {
          wpIndex = (r.wpIndex + 1) % r.waypoints.length;
        } else {
          const nx = r.pos.x + (dx / d) * Math.min(step, d);
          const nz = r.pos.z + (dz / d) * Math.min(step, d);
          pos = { x: nx, y: 0, z: nz };
          heading = Math.atan2(dx, dz);
        }
        const trail = (r.trail.length > 0 && dist2(r.trail[r.trail.length - 1], pos) > 2)
          ? [...r.trail.slice(-80), { ...pos }] : r.trail;
        const inDead = deadZoneAt(pos.x, pos.z);
        const signal = inDead ? Math.max(4, r.signal - dt * 8) : Math.min(96, r.signal + dt * 3);
        const battery = Math.max(0, r.battery - dt * 0.03);
        let status = r.status;
        if (battery < 18 && status !== 'LowBattery' && status !== 'Returning') status = 'LowBattery';
        return { ...r, pos, wpIndex, heading, trail, signal, battery, status, lastContact: t, uncertainty: inDead ? r.uncertainty + dt * 0.8 : Math.max(1.4, r.uncertainty - dt * 2), latencyMs: inDead ? 1400 : 90 + ((t * 7) % 60), packetLoss: inDead ? 22 : 0.4 };
      });

      // building observation: robots inside footprint raise observed + explore floors
      const buildings: BuildingState[] = s.buildings.map((b) => {
        const inside = robots.some((r) => r.status !== 'CommLost' && r.pos.x > b.x - 2 && r.pos.x < b.x + b.w + 2 && r.pos.z > b.z - 2 && r.pos.z < b.z + b.d + 2);
        if (!inside || b.condition === 'collapsed') return b;
        const obs = Math.min(1, b.observed + (inside ? dt * 0.004 : 0));
        const floorsExplored = b.floorsExplored.map((f, i) => f || (inside && obs > 0.25 + i * 0.12));
        const watcher = robots.find((r) => r.pos.x > b.x - 2 && r.pos.x < b.x + b.w + 2 && r.pos.z > b.z - 2 && r.pos.z < b.z + b.d + 2);
        return { ...b, observed: obs, floorsExplored, lastObserved: inside ? t : b.lastObserved, observedBy: inside && watcher ? watcher.id : b.observedBy };
      });

      // coverage spread
      const coverage = s.coverage.map((row, gz) => row.map((v, gx) => {
        if (v >= 1) return 1;
        const cx = -DISTRICT_HALF + ((gx + 0.5) / GRID_N) * DISTRICT_HALF * 2;
        const cz = -DISTRICT_HALF + ((gz + 0.5) / GRID_N) * DISTRICT_HALF * 2;
        const near = robots.some((r) => r.status !== 'CommLost' && Math.hypot(r.pos.x - cx, r.pos.z - cz) < 16);
        return near ? Math.min(1, v + dt * 0.06) : v;
      }));

      // history sampling @2Hz
      let histAt = s.histAt;
      let histRobots = robots;
      if (t - s.histAt > 0.5) {
        histAt = t;
        histRobots = robots.map((r) => ({ ...r, history: [...r.history.slice(-1200), { t, x: r.pos.x, z: r.pos.z, y: r.pos.y }] }));
      }

      // mission progress drift
      const missions = s.missions.map((m) => {
        if (m.status !== 'Active') return m;
        const crew = histRobots.filter((r) => m.robotIds.includes(r.id) && r.status !== 'CommLost');
        if (crew.length === 0) return m;
        const near = crew.some((r) => dist2(r.pos, m.target) < 30);
        return { ...m, progress: Math.min(97, m.progress + dt * (near ? 0.5 : 0.18)), updatedAt: t };
      });

      // battery alert (once per robot)
      let alerts = s.alerts;
      let events = s.events;
      histRobots.forEach((r) => {
        if (r.battery < 18 && r.battery > 0 && !s.fired[`batt-${r.id}`]) {
          events = pushEvent(events, { t, robotId: r.id, buildingId: null, kind: 'system', severity: 'P1', text: `${r.id} — Low battery (${r.battery.toFixed(0)}%). Recommend return-to-staging.` });
          alerts = pushAlert(alerts, { t, level: 'elevated', title: `Low battery — ${r.id}`, detail: `${r.battery.toFixed(0)}% remaining.`, robotId: r.id });
          set({ fired: { ...get().fired, [`batt-${r.id}`]: true } });
        }
      });

      set({ simTime: t, robots: histRobots, buildings, coverage, histAt, missions, alerts, events });

      runScript();

      // ambient discoveries
      const st2 = get();
      if (st2.simTime > st2.ambientAt) {
        const pool = st2.robots.filter((r) => r.status !== 'CommLost');
        const r = pool[Math.floor(Math.random() * pool.length)];
        if (r) {
          const a = AMBIENT[Math.floor(Math.random() * AMBIENT.length)];
          addDiscovery({
            kind: a.kind, label: a.label(r.id), detail: a.detail,
            pos: { x: r.pos.x + 6, y: 1, z: r.pos.z - 4 }, buildingId: r.buildingId,
            robotId: r.id, confidence: 0.55 + Math.random() * 0.3, createdAt: st2.simTime, priority: a.sev,
          }, a.sev, `${r.id} — ${a.label(r.id)}`);
        }
        set({ ambientAt: st2.simTime + 24 + Math.random() * 22 });
      }
    },

    play: () => set({ running: true }),
    pause: () => set({ running: false }),
    cycleSpeed: () => set((s) => ({ speedIdx: (s.speedIdx + 1) % SPEEDS.length })),
    setViewTime: (t) => set({ viewTime: t }),
    select: (sel) => set({ selection: sel }),
    focus: (kind, id) => set((s) => ({ focusReq: { kind, id, nonce: (s.focusReq?.nonce ?? 0) + 1 } })),
    gotoPreset: (name) => set((s) => ({ camReq: { name, nonce: (s.camReq?.nonce ?? 0) + 1 } })),
    toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
    setIsolated: (id) => set({ isolatedId: id, explode: id ? get().explode : 0 }),
    setExplode: (v) => set({ explode: v }),
    setCut: (axis, v) => set(axis === 'X' ? { cutX: v } : axis === 'Y' ? { cutY: v } : { cutZ: v }),
    toggleCompare: () => set((s) => ({ compare: !s.compare })),
    ack: (id) => set((s) => ({ alerts: s.alerts.map((a) => a.id === id ? { ...a, acked: true, ackAt: s.simTime } : a) })),
    ackAll: () => set((s) => ({ alerts: s.alerts.map((a) => ({ ...a, acked: true, ackAt: s.simTime })) })),
    auditLog: (text) => set((s) => ({ audit: [...s.audit.slice(-200), { id: nid('au'), t: s.simTime, actor: 'Operator', text }] })),

    reset: () => {
      const f = freshState();
      set({ ...f, running: true, selection: null, isolatedId: null, explode: 0.55, cutX: null, cutY: null, cutZ: null, compare: false, viewTime: null, missionDraft: null, speedIdx: 1 });
    },

    aftershock: () => {
      const s = get();
      const ids = ['B07', 'B10', 'B14'];
      set({
        buildings: s.buildings.map((b) => ids.includes(b.id) ? { ...b, stale: true, contradicted: b.id === 'B14' ? true : b.contradicted } : b),
        hazards: [...s.hazards, { id: nid('hz'), category: 'aftershock', severity: 'Dangerous', pos: { x: 40, y: 2, z: 30 }, buildingId: null, floor: null, label: 'Aftershock damage — eastern blocks', detail: 'M5.1 aftershock. Nearby-block observations marked STALE — reverification required.', confidence: 0.99, source: 'System', confirmedBy: [], createdAt: s.simTime, updatedAt: s.simTime, status: 'active', radius: 60 }],
        events: pushEvent(s.events, { t: s.simTime, robotId: null, buildingId: null, kind: 'system', severity: 'P0', text: 'AFTERSHOCK M5.1 — eastern blocks marked STALE. Safe routes require reverification.' }),
        alerts: pushAlert(s.alerts, { t: s.simTime, level: 'critical', title: 'Aftershock M5.1', detail: 'Eastern blocks stale. Routes through B07 / B10 / B14 need reverification.', }),
        routes: s.routes.map((r) => r.status === 'active' ? { ...r, status: 'invalid', reason: 'Requires reverification after aftershock' } : r),
        audit: [...s.audit, { id: nid('au'), t: s.simTime, actor: 'System', text: 'Aftershock protocol: stale flags set, routes invalidated.' }],
      });
    },

    triggerDiscovery: () => {
      const s = get();
      const r = s.robots.find((x) => x.status !== 'CommLost') ?? s.robots[0];
      const t = s.simTime;
      addDiscovery({ kind: 'new_passage', label: `Passage probed near ${r.id}`, detail: 'Operator-triggered demo discovery. Partial evidence — dispatch a second robot to confirm.', pos: { x: r.pos.x + 8, y: 1, z: r.pos.z + 5 }, buildingId: null, robotId: r.id, confidence: 0.62, createdAt: t, priority: 'P2' },
        'P2', `${r.id} — Passage probed (operator trigger, 62%)`);
    },

    triggerHazard: () => {
      const s = get();
      const r = s.robots.find((x) => x.status !== 'CommLost') ?? s.robots[0];
      const cats: Hazard['category'][] = ['fire', 'gas', 'unstable', 'debris'];
      const cat = cats[Math.floor(Math.random() * cats.length)];
      const t = s.simTime;
      const labels: Record<string, string> = { fire: 'Fire outbreak', gas: 'Gas leak', unstable: 'Unstable structure', debris: 'Unstable debris' };
      addHazard({ category: cat, severity: cat === 'fire' ? 'Critical' : 'Dangerous', pos: { x: r.pos.x + 10, y: 1.5, z: r.pos.z - 6 }, buildingId: null, floor: null, label: `${labels[cat]} (demo)`, detail: 'Operator-triggered demo hazard.', confidence: 0.8, source: r.id, confirmedBy: [], createdAt: t, updatedAt: t, status: 'active', radius: 9 },
        `${r.id} — ${labels[cat]} reported (operator trigger).`, cat === 'fire' ? 'critical' : 'elevated', `${labels[cat]} — demo`);
    },

    disconnectRobot: (id) => {
      const s = get();
      const target = id ?? s.robots.find((r) => r.status !== 'CommLost')?.id;
      if (!target) return;
      set({
        robots: s.robots.map((r) => r.id === target ? { ...r, status: 'CommLost', signal: 5, task: 'Link lost (operator trigger)', uncertainty: Math.max(r.uncertainty, 5) } : r),
        events: pushEvent(s.events, { t: s.simTime, robotId: target, buildingId: null, kind: 'comms', severity: 'P1', text: `${target} — telemetry connection lost (operator trigger).` }),
        alerts: pushAlert(s.alerts, { t: s.simTime, level: 'elevated', title: `Comms lost — ${target}`, detail: 'Uncertainty radius growing.', robotId: target }),
      });
    },
    reconnectRobot: (id) => {
      const s = get();
      set({
        robots: s.robots.map((r) => r.id === id ? { ...r, status: 'Exploring', signal: 82, uncertainty: 1.6, lastContact: s.simTime, task: 'Reconnected — resuming' } : r),
        events: pushEvent(s.events, { t: s.simTime, robotId: id, buildingId: null, kind: 'comms', severity: 'P3', text: `${id} — link re-established.` }),
      });
    },

    spawnSurvivor: () => {
      const s = get();
      const r = s.robots.find((x) => x.status !== 'CommLost') ?? s.robots[0];
      const t = s.simTime;
      const sv: Survivor = { id: nid('sv'), pos: { x: r.pos.x + 9, y: 3.4, z: r.pos.z - 7 }, buildingId: null, floor: 1, confidence: 0.74, methods: ['thermal', 'audio'], status: 'Possible', detectedBy: r.id, detectedAt: t, priority: 'P0', accessNote: 'Approach from south. Verify before committing personnel.' };
      set({
        survivors: [...s.survivors, sv],
        events: pushEvent(s.events, { t, robotId: r.id, buildingId: null, kind: 'survivor', severity: 'P0', text: `${r.id} — Possible survivor signal (operator spawn, 74%)` }),
        alerts: pushAlert(s.alerts, { t, level: 'critical', title: 'Possible survivor (demo)', detail: `${r.id} detection — verify immediately.`, robotId: r.id, survivorId: sv.id }),
        selection: { kind: 'survivor', id: sv.id },
      });
    },

    startMissionDraft: (type) => set({ missionDraft: { type, point: { x: 0, y: 0, z: 0 } } }),
    commitMissionDraft: (point, robotIds) => {
      const s = get();
      if (!s.missionDraft || robotIds.length === 0) return;
      const t = s.simTime;
      const m: Mission = { id: `M-${String(s.missions.length + 1).padStart(2, '0')}`, title: `${s.missionDraft.type} — grid ${Math.round(point.x)},${Math.round(point.z)}`, type: s.missionDraft.type, priority: 'P1', robotIds, buildingId: null, target: point, status: 'Active', progress: 2, createdAt: t, updatedAt: t, discoveries: 0, note: 'Operator-created mission.' };
      set({
        missions: [...s.missions, m],
        robots: s.robots.map((r) => robotIds.includes(r.id) ? { ...r, missionId: m.id, status: r.status === 'CommLost' ? r.status : 'Assigned', task: m.title, waypoints: [point, ...r.waypoints.slice(0, 2)], wpIndex: 0 } : r),
        routes: [...s.routes, { id: nid('rt'), robotId: robotIds[0], waypoints: [s.robots.find((r) => r.id === robotIds[0])?.pos ?? point, point], status: 'planned' }],
        events: pushEvent(s.events, { t, robotId: robotIds[0], buildingId: null, kind: 'mission', severity: 'P2', text: `Mission created: ${m.title} → ${robotIds.join(', ')}` }),
        missionDraft: null,
        audit: [...s.audit, { id: nid('au'), t, actor: 'Operator', text: `Created mission ${m.id} (${m.type}) → ${robotIds.join(', ')}.` }],
      });
    },
    cancelMissionDraft: () => set({ missionDraft: null }),
    assignRobot: (missionId, robotId) => {
      const s = get();
      set({
        missions: s.missions.map((m) => m.id === missionId && !m.robotIds.includes(robotId) ? { ...m, robotIds: [...m.robotIds, robotId], updatedAt: s.simTime } : m),
        robots: s.robots.map((r) => r.id === robotId ? { ...r, missionId, status: 'Assigned', task: s.missions.find((m) => m.id === missionId)?.title ?? r.task } : r),
        audit: [...s.audit, { id: nid('au'), t: s.simTime, actor: 'Operator', text: `Assigned ${robotId} to ${missionId}.` }],
      });
    },
    setMissionStatus: (missionId, stt) => set((s) => ({
      missions: s.missions.map((m) => m.id === missionId ? { ...m, status: stt, updatedAt: s.simTime, progress: stt === 'Done' ? 100 : m.progress } : m),
      audit: [...s.audit, { id: nid('au'), t: s.simTime, actor: 'Operator', text: `${stt === 'Aborted' ? 'Aborted' : stt} mission ${missionId}.` }],
    })),
    confirmReroute: (routeId) => set((s) => ({
      routes: s.routes.map((r) => r.id === routeId ? { ...r, status: 'active' } : r.status === 'invalid' && r.robotId === s.routes.find((x) => x.id === routeId)?.robotId ? { ...r, status: 'done' } : r),
      audit: [...s.audit, { id: nid('au'), t: s.simTime, actor: 'Operator', text: `Confirmed suggested reroute ${routeId}.` }],
    })),
    verifySurvivor: (id, robotId) => {
      const s = get();
      const sv = s.survivors.find((x) => x.id === id);
      if (!sv) return;
      set({
        survivors: s.survivors.map((x) => x.id === id ? { ...x, status: 'Assigned' } : x),
        robots: s.robots.map((r) => r.id === robotId ? { ...r, task: `Verify survivor ${id.slice(0, 8)}`, waypoints: [{ ...sv.pos, y: 0 }, ...r.waypoints], wpIndex: 0, status: 'Navigating' } : r),
        events: pushEvent(s.events, { t: s.simTime, robotId, buildingId: sv.buildingId, kind: 'mission', severity: 'P0', text: `${robotId} → verify survivor at ${sv.buildingId ?? 'field'} F${sv.floor}` }),
        audit: [...s.audit, { id: nid('au'), t: s.simTime, actor: 'Operator', text: `Assigned ${robotId} to verify survivor ${id.slice(0, 8)}.` }],
      });
    },
    setSurvivorStatus: (id, stt) => set((s) => ({
      survivors: s.survivors.map((x) => x.id === id ? { ...x, status: stt } : x),
      audit: [...s.audit, { id: nid('au'), t: s.simTime, actor: 'Operator', text: `Survivor ${id.slice(0, 8)} → ${stt}.` }],
    })),
    mitigateHazard: (id) => set((s) => ({
      hazards: s.hazards.map((h) => h.id === id ? { ...h, status: 'mitigated' } : h),
      audit: [...s.audit, { id: nid('au'), t: s.simTime, actor: 'Operator', text: `Marked hazard ${id.slice(0, 8)} mitigated.` }],
    })),
    updateRobotStatus: (id, stt) => set((s) => ({
      robots: s.robots.map((r) => r.id === id ? { ...r, status: stt, task: stt === 'Returning' ? 'Returning to staging' : stt === 'Estop' ? 'EMERGENCY STOP' : r.task } : r),
      audit: [...s.audit, { id: nid('au'), t: s.simTime, actor: 'Operator', text: `${id} → ${stt}.` }],
    })),
    setPalette: (o) => set({ paletteOpen: o }),
    setView3d: (v) => set({ view3d: v }),
    setMapsKey: (k) => {
      try { sessionStorage.setItem('rg-maps-key', k); } catch { /* private mode */ }
      set({ mapsKey: k, view3d: k ? 'real' : 'offline' });
    },
    toggleContrast: () => set((s) => ({ highContrast: !s.highContrast })),
    toggleMotion: () => set((s) => ({ reducedMotion: !s.reducedMotion })),
  };
});

export function fmtClock(simTime: number): string {
  const base = 14 * 3600 + 20 * 60; // 14:20 incident start
  const s = Math.floor(base + simTime);
  const h = Math.floor(s / 3600) % 24, m = Math.floor((s % 3600) / 60), ss = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
export function fmtAge(simTime: number, t: number): string {
  const d = Math.max(0, simTime - t);
  if (d < 60) return `${Math.floor(d)}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ago`;
}
export function confLabel(c: number): string {
  if (c >= 0.85) return 'confirmed';
  if (c >= 0.65) return 'reliable';
  if (c >= 0.4) return 'partial';
  if (c >= 0.15) return 'weak';
  return 'unknown';
}
