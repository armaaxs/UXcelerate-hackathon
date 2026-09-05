// Dev-time only: fetches a REAL map segment (Paris 7e, Eiffel Tower) from
// OpenStreetMap via Overpass, processes it, and bundles it as
// src/data/paris.json. The app itself NEVER calls this at runtime —
// everything ships locally (offline-first, no map services).
// Usage: node scripts/fetch-paris.mjs
// License of the data: © OpenStreetMap contributors, ODbL (attributed in-app).

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LAT0 = 48.85837; // Eiffel Tower — incident origin (0,0)
const LON0 = 2.294481;
const HALF = 190; // clip box half-size, meters
const R = 6371000;

const APIS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const QUERY = `[out:json][timeout:200];(way["building"](around:380,${LAT0},${LON0});relation["building"](around:380,${LAT0},${LON0});way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|pedestrian)$"](around:380,${LAT0},${LON0});way["natural"="water"](around:420,${LAT0},${LON0});way["leisure"~"^(park|garden)$"](around:420,${LAT0},${LON0});way["landuse"="grass"](around:420,${LAT0},${LON0}););out geom tags;`;

const toXY = (lat, lon) => [
  R * ((lon - LON0) * Math.PI / 180) * Math.cos(LAT0 * Math.PI / 180),
  -R * ((lat - LAT0) * Math.PI / 180),
];

const area = (pts) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length];
    a += x1 * z2 - x2 * z1;
  }
  return Math.abs(a / 2);
};
const bboxOf = (pts) => {
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
  for (const [x, z] of pts) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  return [x0, z0, x1, z1];
};
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };
const r1 = (v) => Math.round(v * 10) / 10;

async function fetchOSM() {
  for (const api of APIS) {
    try {
      console.log('trying', api);
      const res = await fetch(api, { method: 'POST', body: new URLSearchParams({ data: QUERY }) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      if (!j.elements) throw new Error('bad payload');
      return j;
    } catch (e) { console.warn('  failed:', String(e).slice(0, 120)); }
  }
  throw new Error('all Overpass mirrors failed');
}

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const L2 = dx * dx + dz * dz || 1e-9;
  let t = ((px - ax) * dx + (pz - az) * dz) / L2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

async function main() {
  const fromIdx = process.argv.indexOf('--from');
  const osm = fromIdx > 0
    ? JSON.parse((await import('node:fs')).readFileSync(process.argv[fromIdx + 1], 'utf8'))
    : await fetchOSM();
  const els = osm.elements;
  console.log('elements:', els.length);

  const buildings = [];
  const roads = [];
  const water = [];
  const green = [];

  for (const e of els) {
    const t = e.tags || {};
    if (e.type === 'way' && t.building) {
      if (t.building === 'tower' && /eiffel/i.test(t.name || '')) continue; // modeled procedurally
      if (t.location === 'underground' || t.level === '-1') continue;
      const g = (e.geometry || []).map((p) => toXY(p.lat, p.lon));
      if (g.length < 3) continue;
      const cx = g.reduce((s, p) => s + p[0], 0) / g.length;
      const cz = g.reduce((s, p) => s + p[1], 0) / g.length;
      if (Math.abs(cx) > HALF + 20 || Math.abs(cz) > HALF + 20) continue;
      const a = area(g);
      if (a < 20) continue;
      const lv = parseFloat(t['building:levels'] || t.levels || '');
      const h = parseFloat(t.height || '');
      let floors = Number.isFinite(lv) ? Math.round(lv)
        : Number.isFinite(h) ? Math.max(1, Math.round(h / 3))
        : /apartments|retail|hotel|office|commercial/.test(t.building) ? 6
        : /house|garage|shed/.test(t.building) ? 2 : 4;
      floors = Math.max(1, Math.min(9, floors));
      const name = t.name || [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ') || null;
      buildings.push({ osm: 'w' + e.id, pts: g.map((p) => [r1(p[0]), r1(p[1])]), floors, name, kind: t.building, area: Math.round(a), cx: r1(cx), cz: r1(cz) });
    } else if (e.type === 'relation' && t.building) {
      const pts = [];
      for (const m of e.members || []) {
        if (m.role !== 'outer' || !m.geometry) continue;
        for (const p of m.geometry) pts.push(toXY(p.lat, p.lon));
      }
      if (!pts.length) continue;
      const [x0, z0, x1, z1] = bboxOf(pts);
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      if (Math.abs(cx) > HALF + 20 || Math.abs(cz) > HALF + 20) continue;
      buildings.push({ osm: 'r' + e.id, rect: [r1(x0), r1(z0), r1(x1), r1(z1)], floors: 6, name: t.name || null, kind: t.building, area: Math.round((x1 - x0) * (z1 - z0)), cx: r1(cx), cz: r1(cz) });
    } else if (e.type === 'way' && t.highway) {
      const g = (e.geometry || []).map((p) => toXY(p.lat, p.lon)).filter((p) => Math.abs(p[0]) < HALF + 40 && Math.abs(p[1]) < HALF + 40);
      if (g.length < 2) continue;
      const w = /motorway/.test(t.highway) ? 14 : t.highway === 'trunk' ? 12 : t.highway === 'primary' ? 11
        : t.highway === 'secondary' ? 9 : t.highway === 'tertiary' ? 8 : t.highway === 'pedestrian' ? 5 : 6;
      roads.push({ name: t.name || null, cls: t.highway, w, pts: g.map((p) => [r1(p[0]), r1(p[1])]) });
    } else if (e.type === 'way' && (t.natural === 'water' || t.leisure === 'park' || t.leisure === 'garden' || t.landuse === 'grass')) {
      const g = (e.geometry || []).map((p) => toXY(p.lat, p.lon));
      if (g.length < 3) continue;
      const bucket = t.natural === 'water' ? water : green;
      bucket.push({ name: t.name || null, pts: g.map((p) => [r1(p[0]), r1(p[1])]) });
    }
  }

  // nearest named street per building (authentic labels)
  const namedRoads = roads.filter((r) => r.name);
  const streetOf = (bx, bz) => {
    let best = null, bd = 30;
    for (const r of namedRoads) {
      for (let i = 0; i < r.pts.length - 1; i++) {
        const d = segDist(bx, bz, r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1]);
        if (d < bd) { bd = d; best = r.name; }
      }
    }
    return best;
  };

  // ── pick 14 hero structures, spread across quadrants ──
  const rectPoly = (r) => [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]];
  const cands = buildings.filter((b) => {
    const poly = b.pts || rectPoly(b.rect);
    const [x0, z0, x1, z1] = bboxOf(poly);
    if (x1 - x0 > 70 || z1 - z0 > 70) return false;
    return b.area >= 100 && Math.abs(b.cx) < HALF - 8 && Math.abs(b.cz) < HALF - 8;
  }).map((b) => ({ ...b, pts: b.pts || rectPoly(b.rect) }));
  cands.sort((a, b) => ((b.name ? 1 : 0) + Math.min(1, b.area / 900)) - ((a.name ? 1 : 0) + Math.min(1, a.area / 900)));
  const quads = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  const picked = [];
  for (const sep of [42, 30, 20]) {
    for (const [qx, qz] of quads) {
      for (const c of cands) {
        if (picked.length >= 14) break;
        if (picked.some((p) => p.osm === c.osm)) continue;
        if (Math.sign(c.cx) !== qx || Math.sign(c.cz) !== qz) continue;
        if (picked.some((p) => Math.hypot(p.cx - c.cx, p.cz - c.cz) < sep)) continue;
        picked.push(c);
      }
      if (picked.length >= 14) break;
    }
    if (picked.length >= 14) break;
  }
  for (const c of cands) {
    if (picked.length >= 14) break;
    if (picked.some((p) => p.osm === c.osm)) continue;
    picked.push(c);
  }
  // B14 = hero closest to the hard-hit block ESE of the tower
  let b14 = picked[0], bd = 1e9;
  for (const c of picked) {
    const d = Math.hypot(c.cx - 120, c.cz - 70);
    if (d < bd) { bd = d; b14 = c; }
  }
  const EP = [40, 30]; // quake damage epicenter (local meters)
  let n = 1;
  const heroes = picked.map((c) => {
    const hero = c.osm === b14.osm ? 'B14' : 'B' + String(n++).padStart(2, '0');
    const d = Math.hypot(c.cx - EP[0], c.cz - EP[1]);
    const hh = hash(c.osm);
    const condition = hero === 'B14' ? 'partial'
      : d < 55 ? (hh < 0.4 ? 'collapsed' : 'partial')
      : d < 115 ? (hh < 0.5 ? 'partial' : 'damaged')
      : d < 175 ? 'damaged' : (hh < 0.7 ? 'intact' : 'damaged');
    return { ...c, hero, condition, street: c.street || streetOf(c.cx, c.cz) };
  });

  const out = {
    meta: {
      center: { lat: LAT0, lon: LON0, label: 'Eiffel Tower, Paris 7e' },
      half: HALF,
      epicenter: EP,
      attribution: '© OpenStreetMap contributors (ODbL)',
      fetched: new Date().toISOString().slice(0, 10),
    },
    staging: { x: -20, y: 0, z: 165 },
    command: { x: 2, y: 0, z: 168 },
    relays: [{ x: -60, y: 0, z: 80 }, { x: 60, y: 0, z: -60 }, { x: -20, y: 0, z: 158 }],
    deadZone: { x: 105, z: 10, rx: 42, rz: 38 },
    tower: { x: 0, z: 0, height: 330, platforms: [57, 115, 276], base: 125 },
    heroes,
    context: buildings.filter((b) => !heroes.some((h) => h.osm === b.osm)).map((b) => b.pts ? { pts: b.pts } : { rect: b.rect }),
    roads, water, green,
  };

  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');
  writeFileSync(join(dir, 'paris.json'), JSON.stringify(out));
  console.log('heroes:', heroes.length, '| context:', out.context.length, '| roads:', roads.length,
    '| water:', water.length, '| green:', green.length);
  for (const h of heroes) {
    console.log(`  ${h.hero} ${h.osm} @(${h.cx},${h.cz}) ${h.floors}F ${h.condition} ${h.area}m² :: ${h.name || h.street || '(unnamed)'}`);
  }
  const bytes = JSON.stringify(out).length;
  console.log('paris.json bytes:', bytes);
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
