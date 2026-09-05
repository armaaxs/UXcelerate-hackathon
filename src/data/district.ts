// ─── Procedural disaster district (PRD §74 demo incident) ────────────────────
// Four city blocks, 14 buildings, roads, staging, relays, comms dead-zone.
// All coordinates are LOCAL meters relative to incident origin (0,0,0) —
// no GPS, no map tiles, no external services (PRD §57/58).

import type { BuildingState, Vec3 } from '../types';

export const DISTRICT = {
  size: 260, // district spans -130..+130 m
  blocks: 2,
  roadHalfWidth: 5,
};

export interface DistrictSeed {
  buildings: BuildingState[];
  roads: { x: number; z: number; w: number; d: number }[];
  staging: Vec3;
  command: Vec3;
  relays: Vec3[];
  deadZone: { x: number; z: number; rx: number; rz: number };
}

const FH = 3.4;

function B(
  id: string, label: string, x: number, z: number, w: number, d: number,
  floors: number, condition: BuildingState['condition'], observed = 0,
): BuildingState {
  return {
    id, label, x, z, w, d, floors, floorHeight: FH, condition,
    baselineConfidence: 0.35 + ((id.charCodeAt(1) * 7) % 20) / 100,
    observed, lastObserved: observed > 0 ? 0 : null,
    observedBy: observed > 0 ? 'R-01' : null,
    contradicted: false, priority: false, stale: false,
    floorsExplored: Array.from({ length: floors }, (_, i) => observed > 0.5 && i < 2),
    center: { x: x + w / 2, y: (floors * FH) / 2, z: z + d / 2 },
  };
}

export function buildDistrict(): DistrictSeed {
  // Block layout: roads along x=0 and z=0 axes (+ perimeter), buildings fill quadrants.
  const buildings: BuildingState[] = [
    // NW block (partially in comms dead-zone)
    B('B01', 'B01 · Meridian Lofts', -108, -108, 34, 26, 5, 'damaged'),
    B('B02', 'B02 · Halden Offices', -68, -112, 26, 30, 6, 'intact'),
    B('B03', 'B03 · Kestrel Warehouse', -110, -74, 30, 22, 2, 'partial', 0.4),
    B('B04', 'B04 · North Clinic', -72, -72, 24, 24, 3, 'damaged'),
    // NE block
    B('B05', 'B05 · Foundry Apartments', 22, -110, 36, 28, 5, 'damaged'),
    B('B06', 'B06 · Civic Records Hall', 66, -108, 30, 26, 4, 'intact'),
    B('B07', 'B07 · Parkside Residences', 24, -74, 28, 24, 6, 'partial'),
    B('B08', 'B08 · Transit Depot', 60, -72, 34, 22, 2, 'collapsed'),
    // SW block
    B('B09', 'B09 · Harbor Market', -110, 22, 32, 24, 2, 'partial', 0.55),
    B('B10', 'B10 · Lantern Court', -70, 20, 26, 30, 4, 'damaged'),
    B('B11', 'B11 · Cooper School', -108, 54, 36, 26, 3, 'intact'),
    B('B12', 'B12 · South Workshops', -64, 58, 28, 22, 2, 'damaged', 0.3),
    // SE block — hero building B14 + neighbour
    B('B13', 'B13 · Ember Row Shops', 22, 22, 30, 22, 3, 'damaged'),
    B('B14', 'B14 · Caldera Exchange', 60, 20, 40, 34, 5, 'partial', 0.25),
  ];

  const S = DISTRICT.size / 2;
  const r = DISTRICT.roadHalfWidth;
  const roads = [
    { x: -S, z: -r, w: S * 2, d: r * 2 }, // east-west avenue
    { x: -r, z: -S, w: r * 2, d: S * 2 }, // north-south avenue
    { x: -S, z: -S, w: S * 2, d: 6 }, // perimeter N
    { x: -S, z: S - 6, w: S * 2, d: 6 }, // perimeter S
    { x: -S, z: -S, w: 6, d: S * 2 }, // perimeter W
    { x: S - 6, z: -S, w: 6, d: S * 2 }, // perimeter E
  ];

  return {
    buildings,
    roads,
    staging: { x: -8, y: 0, z: 118 },
    command: { x: 14, y: 0, z: 118 },
    relays: [
      { x: -40, y: 0, z: 60 },
      { x: 44, y: 0, z: -40 },
      { x: -8, y: 0, z: 118 },
    ],
    deadZone: { x: -88, z: -88, rx: 42, rz: 38 },
  };
}

export function buildingTop(b: BuildingState): number {
  return b.floors * b.floorHeight;
}

export function buildingFootprintCenter(b: BuildingState): Vec3 {
  return { x: b.x + b.w / 2, y: 0, z: b.z + b.d / 2 };
}
