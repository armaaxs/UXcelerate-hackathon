// ─── Real map segment: Paris 7e, Eiffel Tower (PRD §61) ─────────────────────
// Geometry comes from OpenStreetMap (© contributors, ODbL), fetched ONCE at
// dev time via scripts/fetch-paris.mjs and bundled as src/data/paris.json.
// Runtime stays fully offline: no tiles, no services, no API keys.
// Local frame: meters east/north of the Eiffel Tower (incident origin).

import type { BuildingState, Vec3 } from '../types';
import paris from './paris.json';

interface ParisHero {
  osm: string; pts: [number, number][]; floors: number;
  name: string | null; street: string | null; kind: string;
  area: number; cx: number; cz: number; hero: string; condition: string;
}
interface ParisData {
  meta: { half: number; epicenter: [number, number]; attribution: string };
  staging: Vec3; command: Vec3; relays: Vec3[];
  deadZone: { x: number; z: number; rx: number; rz: number };
  tower: { x: number; z: number; height: number; platforms: number[]; base: number };
  heroes: ParisHero[];
  context: ({ pts: [number, number][] } | { rect: [number, number, number, number] })[];
  roads: { name: string | null; cls: string; w: number; pts: [number, number][] }[];
  water: { name: string | null; pts: [number, number][] }[];
  green: { name: string | null; pts: [number, number][] }[];
}

const PD = paris as unknown as ParisData;
export const PARIS = PD;
export const MAP_HALF = PD.meta.half;

function bboxOf(pts: [number, number][]): [number, number, number, number] {
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
  for (const [x, z] of pts) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  return [x0, z0, x1, z1];
}

const hash01 = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
};

export interface DistrictSeed {
  buildings: BuildingState[];
  staging: Vec3;
  command: Vec3;
  relays: Vec3[];
  deadZone: { x: number; z: number; rx: number; rz: number };
}

function heroToBuilding(h: ParisHero): BuildingState {
  const [x0, z0, x1, z1] = bboxOf(h.pts);
  const w = Math.max(4, x1 - x0), d = Math.max(4, z1 - z0);
  const short = (h.name || h.street || 'Paris 7e').slice(0, 26);
  const pre = h.cz > 140 ? 0.3 + hash01(h.osm) * 0.25 : 0; // southern blocks partly pre-scanned
  return {
    id: h.hero, label: `${h.hero} · ${short}`,
    x: x0, z: z0, w, d, floors: h.floors, floorHeight: 3.1,
    condition: h.condition as BuildingState['condition'],
    baselineConfidence: 0.32 + hash01(h.osm + 'b') * 0.2,
    observed: pre, lastObserved: pre > 0 ? 0 : null,
    observedBy: pre > 0 ? 'R-01' : null,
    contradicted: false, priority: false, stale: false,
    floorsExplored: Array.from({ length: h.floors }, (_, i) => pre > 0.25 && i < 2),
    center: { x: (x0 + x1) / 2, y: (h.floors * 3.1) / 2, z: (z0 + z1) / 2 },
    poly: h.pts, kind: 'block',
  };
}

function towerBuilding(): BuildingState {
  const b = PD.tower.base; // footprint square side, meters
  return {
    id: 'EFT', label: 'Eiffel Tower · 330 m',
    x: PD.tower.x - b / 2, z: PD.tower.z - b / 2, w: b, d: b,
    floors: 3, floorHeight: 92,
    condition: 'intact', baselineConfidence: 0.95,
    observed: 0.9, lastObserved: 0, observedBy: 'R-01',
    contradicted: false, priority: false, stale: false,
    floorsExplored: [true, true, false],
    center: { x: PD.tower.x, y: 140, z: PD.tower.z },
    poly: [[-b / 2, -b / 2], [b / 2, -b / 2], [b / 2, b / 2], [-b / 2, b / 2]].map(([x, z]) => [x + PD.tower.x, z + PD.tower.z] as [number, number]),
    kind: 'tower',
  };
}

export function buildDistrict(): DistrictSeed {
  return {
    buildings: [towerBuilding(), ...PD.heroes.map(heroToBuilding)],
    staging: PD.staging, command: PD.command, relays: PD.relays, deadZone: PD.deadZone,
  };
}

export function buildingTop(b: BuildingState): number {
  return b.kind === 'tower' ? PD.tower.height : b.floors * b.floorHeight;
}

export function buildingFootprintCenter(b: BuildingState): Vec3 {
  return { x: b.x + b.w / 2, y: 0, z: b.z + b.d / 2 };
}

/** midpoint of a bbox edge — stable anchor for entrances / breaches */
export function edgePoint(b: BuildingState, side: 'N' | 'S' | 'E' | 'W', y = 0): Vec3 {
  const cx = b.x + b.w / 2, cz = b.z + b.d / 2;
  switch (side) {
    case 'N': return { x: cx, y, z: b.z };
    case 'S': return { x: cx, y, z: b.z + b.d };
    case 'E': return { x: b.x + b.w, y, z: cz };
    case 'W': return { x: b.x, y, z: cz };
  }
}
