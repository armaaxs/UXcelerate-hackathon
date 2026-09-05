// ─── RescueGrid 3D operational overview (PRD §11–18, §33, §36–38, §43–46) ────
// Three.js scene: baseline vs observed geometry, hazards, survivors, robots,
// routes, trails, exploration fog, comms/sensor overlays, exploded + cutaway.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useStore } from '../store';
import type { CameraPreset } from '../store';
import { GRID_N, DISTRICT_HALF } from '../store';

const SEV_COLOR: Record<string, number> = {
  Advisory: 0x94a3b8, Caution: 0xfbbf24, Dangerous: 0xfb7185, Critical: 0xef4444,
};

function makeLabel(text: string, opts?: { fg?: string; bg?: string; size?: number }): THREE.Sprite {
  const { fg = '#e2e8f0', bg = 'rgba(8,12,22,0.82)', size = 44 } = opts ?? {};
  const c = document.createElement('canvas');
  c.width = 256; c.height = 80;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  const r = 16;
  g.beginPath();
  g.roundRect(4, 8, 248, 64, r);
  g.fill();
  g.strokeStyle = 'rgba(148,163,184,0.35)';
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = fg;
  g.font = `600 ${size - 12}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 41);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(14, 4.4, 1);
  sp.renderOrder = 50;
  return sp;
}

function setLabel(sp: THREE.Sprite, text: string, opts?: { fg?: string }) {
  const key = text + (opts?.fg ?? '');
  if ((sp.userData.key as string) === key) return;
  sp.userData.key = key;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 80;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(8,12,22,0.82)';
  g.beginPath();
  g.roundRect(4, 8, 248, 64, 16);
  g.fill();
  g.strokeStyle = opts?.fg ?? 'rgba(148,163,184,0.35)';
  g.lineWidth = 2.5;
  g.stroke();
  g.fillStyle = opts?.fg ?? '#e2e8f0';
  g.font = '600 30px ui-monospace, Menlo, monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text.slice(0, 20), 128, 41);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  (sp.material as THREE.SpriteMaterial).map?.dispose();
  (sp.material as THREE.SpriteMaterial).map = tex;
  (sp.material as THREE.SpriteMaterial).needsUpdate = true;
}

function robotColor(status: string): string {
  switch (status) {
    case 'CommLost': return '#64748b';
    case 'LowBattery': return '#fbbf24';
    case 'Fault': case 'Immobilized': case 'Estop': return '#ef4444';
    case 'Navigating': return '#60a5fa';
    case 'Inspecting': return '#a78bfa';
    default: return '#22d3ee';
  }
}

const PRESETS: Record<CameraPreset, { pos: [number, number, number]; tgt: [number, number, number] }> = {
  incident: { pos: [150, 165, 150], tgt: [0, 0, 0] },
  robots: { pos: [60, 70, 110], tgt: [50, 0, 45] },
  hazards: { pos: [80, 55, 90], tgt: [72, 2, 38] },
  survivors: { pos: [95, 45, 70], tgt: [78, 7, 32] },
  comms: { pos: [-40, 170, 60], tgt: [-60, 0, -60] },
  coverage: { pos: [0, 220, 40], tgt: [0, 0, 0] },
};

export default function RescueCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.localClippingEnabled = true;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b14);
    scene.fog = new THREE.Fog(0x070b14, 320, 640);
    if (import.meta.env.DEV) {
      (window as unknown as { __scene: THREE.Scene }).__scene = scene;
    }

    const camera = new THREE.PerspectiveCamera(52, mount.clientWidth / mount.clientHeight, 0.5, 2000);
    camera.position.set(150, 165, 150);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.minDistance = 8;
    controls.maxDistance = 520;

    scene.add(new THREE.HemisphereLight(0x8fb3d9, 0x0b0f1a, 0.85));
    const dir = new THREE.DirectionalLight(0xdbeafe, 1.1);
    dir.position.set(120, 180, 60);
    scene.add(dir);
    const amb = new THREE.AmbientLight(0x334155, 0.5);
    scene.add(amb);

    // ── static district furniture ──
    const staticG = new THREE.Group();
    scene.add(staticG);
    {
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(DISTRICT_HALF * 2 + 40, DISTRICT_HALF * 2 + 40),
        new THREE.MeshStandardMaterial({ color: 0x0d1424, roughness: 1 }),
      );
      ground.rotation.x = -Math.PI / 2;
      staticG.add(ground);
      const grid = new THREE.GridHelper(DISTRICT_HALF * 2 + 40, 52, 0x1e3a5f, 0x14243c);
      grid.position.y = 0.05;
      (grid.material as THREE.Material).transparent = true;
      (grid.material as THREE.Material).opacity = 0.5;
      staticG.add(grid);
      // origin marker
      const axes = new THREE.AxesHelper(12);
      axes.position.y = 0.1;
      staticG.add(axes);
    }

    const district = (() => {
      // read seed geometry from store initial buildings (static layout)
      const st = useStore.getState();
      return { buildings: st.buildings };
    })();
    void district;

    // roads
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x131c30, roughness: 1 });
    const roadGeos: THREE.Mesh[] = [];
    const S = DISTRICT_HALF, r = 5;
    const roadDefs = [
      { x: -S, z: -r, w: S * 2, d: r * 2 }, { x: -r, z: -S, w: r * 2, d: S * 2 },
      { x: -S, z: -S, w: S * 2, d: 6 }, { x: -S, z: S - 6, w: S * 2, d: 6 },
      { x: -S, z: -S, w: 6, d: S * 2 }, { x: S - 6, z: -S, w: 6, d: S * 2 },
    ];
    roadDefs.forEach((rd) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(rd.w, 0.18, rd.d), roadMat);
      m.position.set(rd.x + rd.w / 2, 0.09, rd.z + rd.d / 2);
      staticG.add(m); roadGeos.push(m);
    });
    // staging + command
    function flatMarker(x: number, z: number, w: number, d: number, color: number, opacity: number) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.22, z);
      staticG.add(m);
      return m;
    }
    flatMarker(-8, 118, 46, 14, 0x10b981, 0.22);
    flatMarker(14, 118, 10, 10, 0x22d3ee, 0.3);
    // dead zone (comms blackout)
    const dzMesh = new THREE.Mesh(new THREE.CircleGeometry(1, 48),
      new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.08, side: THREE.DoubleSide }));
    dzMesh.rotation.x = -Math.PI / 2;
    dzMesh.position.set(-88, 0.25, -88);
    dzMesh.scale.set(42, 38, 1);
    staticG.add(dzMesh);
    const dzRing = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 48),
      new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    dzRing.rotation.x = -Math.PI / 2;
    dzRing.position.set(-88, 0.26, -88);
    dzRing.scale.set(42, 38, 1);
    staticG.add(dzRing);
    const dzLabel = makeLabel('COMMS DEAD ZONE', { fg: '#fca5a5' });
    dzLabel.position.set(-88, 10, -88);
    staticG.add(dzLabel);

    // relay towers
    const relayG = new THREE.Group();
    scene.add(relayG);
    const relayPos: [number, number][] = [[-40, 60], [44, -40], [-8, 112]];
    relayPos.forEach(([x, z]) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 16, 8),
        new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0e7490, emissiveIntensity: 0.7 }));
      pole.position.set(x, 8, z);
      relayG.add(pole);
      const halo = new THREE.Mesh(new THREE.CircleGeometry(26, 40),
        new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.07, side: THREE.DoubleSide }));
      halo.rotation.x = -Math.PI / 2;
      halo.position.set(x, 0.3, z);
      relayG.add(halo);
    });

    // exploration fog overlay (single canvas texture — cheap)
    const fogCanvas = document.createElement('canvas');
    fogCanvas.width = GRID_N; fogCanvas.height = GRID_N;
    const fogTex = new THREE.CanvasTexture(fogCanvas);
    const fogPlane = new THREE.Mesh(new THREE.PlaneGeometry(DISTRICT_HALF * 2, DISTRICT_HALF * 2),
      new THREE.MeshBasicMaterial({ map: fogTex, transparent: true, opacity: 0.85, depthWrite: false }));
    fogPlane.rotation.x = -Math.PI / 2;
    fogPlane.position.y = 0.4;
    scene.add(fogPlane);

    const bldG = new THREE.Group(); scene.add(bldG);    const robotG = new THREE.Group(); scene.add(robotG);
    const hzG = new THREE.Group(); scene.add(hzG);
    const svG = new THREE.Group(); scene.add(svG);
    const routeG = new THREE.Group(); scene.add(routeG);
    const overlayG = new THREE.Group(); scene.add(overlayG);

    // point cloud (robot-generated geometry feel)
    const pcGeo = new THREE.BufferGeometry();
    const pcCount = 2600;
    const pcArr = new Float32Array(pcCount * 3);
    pcGeo.setAttribute('position', new THREE.BufferAttribute(pcArr, 3));
    const pcMat = new THREE.PointsMaterial({ color: 0x67e8f9, size: 0.55, transparent: true, opacity: 0.75 });
    const points = new THREE.Points(pcGeo, pcMat);
    scene.add(points);

    // ── reconcile maps ──
    const bMesh = new Map<string, THREE.Group>();
    const rMesh = new Map<string, THREE.Group>();
    const hMesh = new Map<string, THREE.Group>();
    const sMesh = new Map<string, THREE.Group>();
    const routeLines = new Map<string, THREE.Line>();

    const ray = new THREE.Raycaster();
    const ptr = new THREE.Vector2();
    const scratch = new THREE.Vector3();
    // distance-attenuated labels: constant ~screen-size text from street level to full-incident zoom
    function attenuate(sp: THREE.Sprite, world: THREE.Vector3, baseW: number, baseH: number) {
      const d = camera.position.distanceTo(world);
      const w = THREE.MathUtils.clamp(d * 0.085, 2.4, 30);
      sp.scale.set(w, w * (baseH / baseW), 1);
    }
    let camAnim: { p0: THREE.Vector3; p1: THREE.Vector3; t0: THREE.Vector3; t1: THREE.Vector3; k: number } | null = null;
    let lastCamNonce = 0; let lastFocusNonce = 0;
    let syncAt = 0;

    function tweenCam(p: [number, number, number], t: [number, number, number]) {
      const st = useStore.getState();
      if (st.reducedMotion) {
        camera.position.set(...p); controls.target.set(...t); return;
      }
      camAnim = { p0: camera.position.clone(), p1: new THREE.Vector3(...p), t0: controls.target.clone(), t1: new THREE.Vector3(...t), k: 0 };
    }

    function groundPoint(e: MouseEvent): THREE.Vector3 | null {
      const rect = renderer.domElement.getBoundingClientRect();
      ptr.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ptr.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(ptr, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const out = new THREE.Vector3();
      return ray.ray.intersectPlane(plane, out) ? out : null;
    }

    renderer.domElement.addEventListener('dblclick', (e) => {
      const st = useStore.getState();
      if (!st.missionDraft) return;
      const p = groundPoint(e);
      if (!p) return;
      const avail = st.robots.filter((x) => x.status !== 'CommLost').slice(0, 2).map((x) => x.id);
      st.commitMissionDraft({ x: THREE.MathUtils.clamp(p.x, -120, 120), y: 0, z: THREE.MathUtils.clamp(p.z, -120, 120) }, avail);
    });

    let downX = 0, downY = 0;
    renderer.domElement.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });

    renderer.domElement.addEventListener('click', (e) => {
      // ignore drag-rotates (OrbitControls) — only treat true clicks as picks
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      const st = useStore.getState();
      const rect = renderer.domElement.getBoundingClientRect();
      ptr.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ptr.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(ptr, camera);
      // mission draft: single click sets target too
      if (st.missionDraft) {
        const p = groundPoint(e);
        if (p) {
          const avail = st.robots.filter((x) => x.status !== 'CommLost').slice(0, 2).map((x) => x.id);
          st.commitMissionDraft({ x: THREE.MathUtils.clamp(p.x, -120, 120), y: 0, z: THREE.MathUtils.clamp(p.z, -120, 120) }, avail);
        }
        return;
      }
      const hits = ray.intersectObjects([robotG, hzG, svG, bldG], true);
      for (const h of hits) {
        let o: THREE.Object3D | null = h.object;
        while (o) {
          const u = o.userData;
          if (u.robotId) { st.select({ kind: 'robot', id: u.robotId }); st.focus('robot', u.robotId); return; }
          if (u.hazardId) { st.select({ kind: 'hazard', id: u.hazardId }); return; }
          if (u.survivorId) { st.select({ kind: 'survivor', id: u.survivorId }); return; }
          if (u.buildingId) { st.select({ kind: 'building', id: u.buildingId }); return; }
          o = o.parent;
        }
      }
      // clicked empty space → clear (keep isolation)
      st.select(null);
    });

    // keyboard shortcuts (PRD §91)
    function onKey(e: KeyboardEvent) {
      const st = useStore.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); st.setPalette(true); return; }
      if (e.key === 'Escape') { st.select(null); st.setPalette(false); st.cancelMissionDraft(); }
      if (e.key === '1') st.gotoPreset('coverage');
      if (e.key === '2') st.gotoPreset('incident');
      if (e.key.toLowerCase() === 'f') {
        const sel = st.selection;
        if (sel && sel.kind !== 'discovery' && sel.kind !== 'mission') st.focus(sel.kind, sel.id);
      }
      if (e.key.toLowerCase() === 'l') document.getElementById('layer-panel-toggle')?.click();
      if (e.key.toLowerCase() === 'm') st.startMissionDraft('Explore');
      if (e.key.toLowerCase() === 't') document.getElementById('timeline-live')?.click();
    }
    window.addEventListener('keydown', onKey);

    function robotPosAt(r: { pos: { x: number; y: number; z: number }; history: { t: number; x: number; z: number; y: number }[] }, viewT: number | null) {
      if (viewT == null || r.history.length === 0) return r.pos;
      let best = r.history[0];
      for (const h of r.history) { if (h.t <= viewT) best = h; else break; }
      return { x: best.x, y: best.y, z: best.z };
    }

    // ── per-frame sync ──
    const clock = new THREE.Clock();
    let raf = 0;
    function animate() {
      raf = requestAnimationFrame(animate);
      const dtReal = Math.min(clock.getDelta(), 0.25);
      const elapsed = clock.elapsedTime;
      const st = useStore.getState();
      if (st.running) st.tick(dtReal);

      // camera requests
      if (st.camReq && st.camReq.nonce !== lastCamNonce) {
        lastCamNonce = st.camReq.nonce;
        const p = PRESETS[st.camReq.name];
        tweenCam(p.pos, p.tgt);
      }
      if (st.focusReq && st.focusReq.nonce !== lastFocusNonce) {
        lastFocusNonce = st.focusReq.nonce;
        const { kind, id } = st.focusReq;
        let tgt: THREE.Vector3 | null = null;
        if (kind === 'robot') { const r = st.robots.find((x) => x.id === id); if (r) tgt = new THREE.Vector3(r.pos.x, 2, r.pos.z); }
        if (kind === 'building') { const b = st.buildings.find((x) => x.id === id); if (b) tgt = new THREE.Vector3(b.x + b.w / 2, 6, b.z + b.d / 2); }
        if (kind === 'hazard') { const h = st.hazards.find((x) => x.id === id); if (h) tgt = new THREE.Vector3(h.pos.x, 2, h.pos.z); }
        if (kind === 'survivor') { const sv = st.survivors.find((x) => x.id === id); if (sv) tgt = new THREE.Vector3(sv.pos.x, 4, sv.pos.z); }
        if (tgt) {
          // kind-aware framing distance + enforced elevation so we never end up inside geometry
          const dist = kind === 'building' ? 95 : kind === 'robot' ? 34 : 48;
          const dirV = camera.position.clone().sub(controls.target);
          if (dirV.lengthSq() < 1e-4) dirV.set(1, 0.6, 1);
          const az = Math.atan2(dirV.x, dirV.z);
          const el = THREE.MathUtils.degToRad(38);
          const off = new THREE.Vector3(
            Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el),
          ).multiplyScalar(dist);
          tweenCam([tgt.x + off.x, tgt.y + off.y, tgt.z + off.z], [tgt.x, tgt.y, tgt.z]);
        }
      }
      if (camAnim) {
        camAnim.k = Math.min(1, camAnim.k + dtReal * 0.9);
        const k = camAnim.k < 0.5 ? 2 * camAnim.k * camAnim.k : 1 - Math.pow(-2 * camAnim.k + 2, 2) / 2;
        camera.position.lerpVectors(camAnim.p0, camAnim.p1, k);
        controls.target.lerpVectors(camAnim.t0, camAnim.t1, k);
        if (camAnim.k >= 1) camAnim = null;
      }
      controls.update();

      const viewT = st.viewTime;
      const live = viewT == null;
      const simT = live ? st.simTime : viewT;

      // clipping planes
      const planes: THREE.Plane[] = [];
      if (st.cutX != null) planes.push(new THREE.Plane(new THREE.Vector3(-1, 0, 0), -130 + st.cutX * 260));
      if (st.cutZ != null) planes.push(new THREE.Plane(new THREE.Vector3(0, 0, -1), -130 + st.cutZ * 260));
      if (st.cutY != null) planes.push(new THREE.Plane(new THREE.Vector3(0, -1, 0), st.cutY * 24));

      // ── buildings ──
      for (const b of st.buildings) {
        let g = bMesh.get(b.id);
        if (!g) {
          g = new THREE.Group();
          g.userData.buildingId = b.id;
          bldG.add(g);
          bMesh.set(b.id, g);
        }
        // rebuild if floor count changed (cheap check)
        if ((g.userData.floors as number) !== b.floors) {
          while (g.children.length) { const c = g.children.pop()!; g.remove(c); }
          g.userData.floors = b.floors;
          const cx = b.x + b.w / 2, cz = b.z + b.d / 2;
          const H = b.floors * b.floorHeight;
          // baseline mass (what we believed)
          const base = new THREE.Mesh(
            new THREE.BoxGeometry(b.w, H, b.d),
            new THREE.MeshStandardMaterial({ color: 0x3b4c63, transparent: true, opacity: 0.32, roughness: 0.9, depthWrite: false, clippingPlanes: planes }),
          );
          base.position.set(cx, H / 2, cz);
          base.userData.buildingId = b.id;
          g.add(base);
          g.userData.base = base;
          // observed mass (what robots confirmed)
          const obs = new THREE.Mesh(
            new THREE.BoxGeometry(b.w, H, b.d),
            new THREE.MeshStandardMaterial({ color: b.condition === 'collapsed' ? 0x5b3a36 : 0x2dd4bf, transparent: true, opacity: 0.5, roughness: 0.7, clippingPlanes: planes }),
          );
          obs.position.set(cx, H / 2, cz);
          obs.userData.buildingId = b.id;
          g.add(obs);
          g.userData.obs = obs;
          // edges
          const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(b.w, H, b.d)), new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.5 }));
          edge.position.set(cx, H / 2, cz);
          g.add(edge);
          // floor slabs for exploded view
          const slabs: THREE.Mesh[] = [];
          for (let f = 0; f < b.floors; f++) {
            const slab = new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.5, b.d),
              new THREE.MeshStandardMaterial({ color: 0x155e75, transparent: true, opacity: 0.85, clippingPlanes: planes }));
            slab.userData.buildingId = b.id;
            slab.visible = false;
            g.add(slab);
            slabs.push(slab);
          }
          g.userData.slabs = slabs;
          // rubble for damaged/collapsed
          if (b.condition === 'collapsed' || b.condition === 'partial') {
            const rub = new THREE.Group();
            for (let i = 0; i < 9; i++) {
              const rr = new THREE.Mesh(new THREE.TetrahedronGeometry(1 + Math.random() * 2.2),
                new THREE.MeshStandardMaterial({ color: 0x6b5b4f, roughness: 1 }));
              rr.position.set(cx + (Math.random() - 0.5) * b.w * 1.1, 0.8 + Math.random() * 2, cz + (Math.random() - 0.5) * b.d * 1.1);
              rr.rotation.set(Math.random() * 3, Math.random() * 3, 0);
              rub.add(rr);
            }
            g.add(rub);
          }
          // label
          const lb = makeLabel(`${b.id} · ${b.floors}F`);
          lb.position.set(cx, H + 6, cz);
          g.add(lb);
          g.userData.label = lb;
        }
        const H = b.floors * b.floorHeight;
        const cx = b.x + b.w / 2, cz = b.z + b.d / 2;
        const isolated = st.isolatedId === b.id;
        const dimOthers = st.isolatedId != null && !isolated;
        const base = g.userData.base as THREE.Mesh;
        const obs = g.userData.obs as THREE.Mesh;
        const slabs = (g.userData.slabs as THREE.Mesh[]) ?? [];
        const label = g.userData.label as THREE.Sprite;
        (base.material as THREE.MeshStandardMaterial).clippingPlanes = planes;
        (obs.material as THREE.MeshStandardMaterial).clippingPlanes = planes;
        slabs.forEach((sl) => { (sl.material as THREE.MeshStandardMaterial).clippingPlanes = planes; });

        const showBase = st.layers.baseline && !st.compare;
        const showObs = st.layers.observed || st.compare;
        base.visible = showBase && !isolated && !dimOthers ? true : showBase && dimOthers ? true : false;
        (base.material as THREE.MeshStandardMaterial).opacity = dimOthers ? 0.05 : st.compare ? 0.12 : 0.32;
        obs.visible = showObs;
        const om = obs.material as THREE.MeshStandardMaterial;
        // observed clarity scales with observed fraction (PRD §14: unknown must look unknown)
        om.opacity = dimOthers ? 0.03 : isolated ? 0.28 : 0.12 + b.observed * 0.5;
        om.color.set(b.condition === 'collapsed' ? 0x8a5a52 : b.stale ? 0x8a7a4d : 0x2dd4bf);
        if (b.contradicted) { om.color.set(0xf472b6); }
        // slabs in exploded/isolated mode
        const explodeOn = isolated && st.explode > 0.02;
        slabs.forEach((sl, f) => {
          sl.visible = explodeOn;
          const gap = st.explode * 10;
          sl.position.set(cx, f * (b.floorHeight + gap) + 1, cz);
          const explored = b.floorsExplored[f];
          (sl.material as THREE.MeshStandardMaterial).color.set(explored ? 0x0e7490 : 0x1e293b);
          (sl.material as THREE.MeshStandardMaterial).opacity = explored ? 0.55 : 0.3;
        });
        if (explodeOn) { obs.visible = false; base.visible = st.layers.baseline; }
        label.visible = st.layers.labels && !dimOthers;
        if (label.visible) {
          const conf = Math.round((b.observed > 0 ? 0.55 + b.observed * 0.4 : b.baselineConfidence) * 100);
          setLabel(label, `${b.id} ${Math.round(b.observed * 100)}% · ${b.condition.slice(0, 4).toUpperCase()}`, { fg: b.priority ? '#f0abfc' : b.contradicted ? '#f9a8d4' : '#bae6fd' });
          label.position.set(cx, (explodeOn ? b.floors * (b.floorHeight + st.explode * 10) : H) + 6, cz);
          attenuate(label, label.position, 14, 4.4);
        }
        // priority ring
        if (b.priority && !g.userData.pring) {
          const pr = new THREE.Mesh(new THREE.RingGeometry(Math.max(b.w, b.d) * 0.75, Math.max(b.w, b.d) * 0.75 + 1.2, 48),
            new THREE.MeshBasicMaterial({ color: 0xf0abfc, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
          pr.rotation.x = -Math.PI / 2;
          pr.position.set(cx, 0.5, cz);
          g.add(pr);
          g.userData.pring = pr;
        }
        if (g.userData.pring) (g.userData.pring as THREE.Mesh).visible = b.priority;
      }

      // ── robots ──
      if (st.layers.robots) robotG.visible = true; else robotG.visible = false;
      for (const rb of st.robots) {
        let g = rMesh.get(rb.id);
        if (!g) {
          g = new THREE.Group();
          g.userData.robotId = rb.id;
          const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 1.4, 12),
            new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0e7490, emissiveIntensity: 0.6 }));
          body.position.y = 1;
          body.userData.robotId = rb.id;
          const nose = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.2, 8),
            new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }));
          nose.rotation.x = Math.PI / 2;
          nose.position.set(0, 1, 2.4);
          nose.userData.robotId = rb.id;
          const unc = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40),
            new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
          unc.rotation.x = -Math.PI / 2;
          unc.position.y = 0.35;
          const lb = makeLabel(rb.id);
          lb.position.y = 6.5;
          const trailGeo = new THREE.BufferGeometry();
          trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 90), 3));
          const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.55 }));
          g.add(body, nose, unc, lb, trail);
          g.userData = { robotId: rb.id, body, nose, unc, lb, trail };
          rMesh.set(rb.id, g);
          robotG.add(g);
        }
        const p = robotPosAt(rb, viewT);
        const h = bMeshHeightAt(st, p.x, p.z);
        g.position.set(p.x, (h ?? 0), p.z);
        g.rotation.y = rb.heading;
        const col = new THREE.Color(robotColor(rb.status));
        ((g.userData.body as THREE.Mesh).material as THREE.MeshStandardMaterial).color.copy(col);
        const unc = g.userData.unc as THREE.Mesh;
        unc.scale.setScalar(Math.max(1, rb.uncertainty));
        ((unc.material as THREE.MeshBasicMaterial).opacity = rb.status === 'CommLost' ? 0.85 : 0.25);
        (unc.material as THREE.MeshBasicMaterial).color.set(rb.status === 'CommLost' ? 0xef4444 : 0xfbbf24);
        const lb = g.userData.lb as THREE.Sprite;
        lb.visible = st.layers.labels;
        if (lb.visible) {
          const stale = st.simTime - rb.lastContact > 5;
          setLabel(lb, `${rb.id} · ${Math.round(rb.battery)}%${rb.status === 'CommLost' ? ' ✕' : ''}${stale && rb.status !== 'CommLost' ? ' ~' : ''}`,
            { fg: rb.status === 'CommLost' ? '#94a3b8' : '#a5f3fc' });
          attenuate(lb, scratch.copy(g.position).setY(g.position.y + 6.5), 14, 4.4);
        }
        // selected highlight
        const sel = st.selection?.kind === 'robot' && st.selection.id === rb.id;
        ((g.userData.body as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = sel ? 1.6 : 0.6;
        // trail
        const trail = g.userData.trail as THREE.Line;
        trail.visible = st.layers.trails;
        if (trail.visible) {
          const pts = rb.trail.slice(-90);
          const attr = trail.geometry.getAttribute('position') as THREE.BufferAttribute;
          for (let i = 0; i < 90; i++) {
            const q = pts[Math.min(i, pts.length - 1)] ?? p;
            attr.setXYZ(i, q.x - p.x, 1.2 + (q.y - (h ?? 0)) * 0.2, q.z - p.z);
          }
          attr.needsUpdate = true;
          (trail.material as THREE.LineBasicMaterial).color.copy(col);
        }
      }

      // ── hazards ──
      hzG.visible = st.layers.hazards;
      const hzVisible = st.hazards.filter((hz) => live || hz.createdAt <= simT);
      for (const hz of hzVisible) {
        let g = hMesh.get(hz.id);
        if (!g) {
          g = new THREE.Group();
          g.userData.hazardId = hz.id;
          const cat = hz.category;
          let core: THREE.Mesh;
          if (cat === 'fire') {
            core = new THREE.Mesh(new THREE.ConeGeometry(2.6, 7, 10),
              new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xef4444, emissiveIntensity: 1.4, transparent: true, opacity: 0.92 }));
            core.position.y = 3.5;
          } else if (cat === 'gas' || cat === 'chemical') {
            core = new THREE.Mesh(new THREE.SphereGeometry(3.2, 18, 14),
              new THREE.MeshStandardMaterial({ color: 0xa3e635, transparent: true, opacity: 0.32, emissive: 0x4d7c0f, emissiveIntensity: 0.5 }));
            core.position.y = 2;
          } else if (cat === 'unstable') {
            core = new THREE.Mesh(new THREE.BoxGeometry(5, 7, 5),
              new THREE.MeshBasicMaterial({ color: 0xfbbf24, wireframe: true, transparent: true, opacity: 0.9 }));
            core.position.y = 3.5;
          } else if (cat === 'blackout' || cat === 'aftershock') {
            core = new THREE.Mesh(new THREE.CylinderGeometry(hz.radius, hz.radius, 3, 28, 1, true),
              new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
            core.position.y = 1.5;
          } else {
            core = new THREE.Mesh(new THREE.OctahedronGeometry(2.4),
              new THREE.MeshStandardMaterial({ color: 0xfb7185, emissive: 0x881337, emissiveIntensity: 0.8, flatShading: true }));
            core.position.y = 2.4;
          }
          core.userData.hazardId = hz.id;
          const ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 4.4, 40),
            new THREE.MeshBasicMaterial({ color: SEV_COLOR[hz.severity] ?? 0xfbbf24, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.4;
          const lb = makeLabel(hz.label.slice(0, 18), { fg: '#fecaca' });
          lb.position.y = 10;
          // "new discovery" expanding pulse ring
          const pulse = new THREE.Mesh(new THREE.RingGeometry(1, 1.5, 40),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
          pulse.rotation.x = -Math.PI / 2;
          pulse.position.y = 0.5;
          g.add(core, ring, lb, pulse);
          g.userData = { hazardId: hz.id, core, ring, lb, pulse, born: hz.createdAt };
          hMesh.set(hz.id, g);
          hzG.add(g);
        }
        g.position.set(hz.pos.x, hz.pos.y > 4 ? 0 : hz.pos.y * 0.2, hz.pos.z);
        const age = simT - hz.createdAt;
        const pulse = g.userData.pulse as THREE.Mesh;
        if (age < 14 && !st.reducedMotion) {
          const k = (age % 2) / 2;
          pulse.visible = true;
          pulse.scale.setScalar(2 + k * 9);
          ((pulse.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k));
        } else pulse.visible = false;
        const core = g.userData.core as THREE.Mesh;
        if (!st.reducedMotion) {
          const s = 1 + Math.sin(elapsed * 3 + hz.pos.x) * 0.12;
          core.scale.setScalar(hz.category === 'gas' ? s * (1 + hz.radius / 8) : s);
        }
        // freshness overlay: old readings fade
        if (st.layers.freshness) {
          const fresh = Math.max(0.15, 1 - age / 300);
          (core.material as THREE.Material).transparent = true;
          (core.material as THREE.Material).opacity = 0.25 + fresh * 0.7;
        }
        const lb = g.userData.lb as THREE.Sprite;
        lb.visible = st.layers.labels;
        if (lb.visible) {
          setLabel(lb, `${hz.category.toUpperCase()} · ${Math.round(hz.confidence * 100)}%`, { fg: hz.severity === 'Critical' ? '#fca5a5' : '#fde68a' });
          attenuate(lb, scratch.copy(g.position).setY(g.position.y + 10), 14, 4.4);
        }
      }
      // remove stale hazard meshes
      for (const [id, g] of [...hMesh]) {
        if (!st.hazards.some((h) => h.id === id)) { hzG.remove(g); hMesh.delete(id); }
      }

      // ── survivors ──
      svG.visible = st.layers.survivors;
      const svVisible = st.survivors.filter((s) => live || s.detectedAt <= simT);
      for (const sv of svVisible) {
        let g = sMesh.get(sv.id);
        if (!g) {
          g = new THREE.Group();
          g.userData.survivorId = sv.id;
          const gem = new THREE.Mesh(new THREE.OctahedronGeometry(2),
            new THREE.MeshStandardMaterial({ color: 0xf0abfc, emissive: 0xd946ef, emissiveIntensity: 1.6 }));
          gem.position.y = 2;
          gem.userData.survivorId = sv.id;
          const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.4, 26, 10, 1, true),
            new THREE.MeshBasicMaterial({ color: 0xf0abfc, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
          beam.position.y = 13;
          const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.4, 40),
            new THREE.MeshBasicMaterial({ color: 0xf0abfc, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.4;
          const lb = makeLabel(`SURVIVOR F${sv.floor} ${Math.round(sv.confidence * 100)}%`, { fg: '#f0abfc' });
          lb.position.y = 12;
          lb.scale.set(20, 6.2, 1);
          g.add(gem, beam, ring, lb);
          g.userData = { survivorId: sv.id, gem, ring, lb };
          sMesh.set(sv.id, g);
          svG.add(g);
        }
        g.position.set(sv.pos.x, sv.pos.y > 4 ? sv.pos.y - 5 : 0, sv.pos.z);
        const svLb = g.userData.lb as THREE.Sprite;
        svLb.visible = st.layers.labels;
        if (svLb.visible) attenuate(svLb, scratch.copy(g.position).setY(g.position.y + 12), 20, 6.2);
        if (!st.reducedMotion) {
          const gem = g.userData.gem as THREE.Mesh;
          gem.rotation.y = elapsed * 1.4;
          gem.position.y = 2 + Math.sin(elapsed * 2.2) * 0.5;
          const ring = g.userData.ring as THREE.Mesh;
          ring.scale.setScalar(1 + Math.sin(elapsed * 2.2) * 0.15);
        }
      }

      // ── routes (geometry rebuilt at ~8Hz — cheap, avoids per-frame churn) ──
      const rtVisible = st.layers.routes ? st.routes.filter((r) => st.robots.some((x) => x.id === r.robotId)) : [];
      const rtKey = rtVisible.map((r) => r.id + r.status).join(';')
        + st.robots.map((r) => `${Math.round(r.pos.x)}:${Math.round(r.pos.z)}`).join(';')
        + (st.isolatedId ?? '');
      if (rtKey !== (routeG.userData.key as string) || elapsed - (routeG.userData.at as number ?? -9) > 0.12) {
        routeG.userData.key = rtKey;
        routeG.userData.at = elapsed;
        const seen = new Set<string>();
        for (const rt of rtVisible) {
          seen.add(rt.id);
          let line = routeLines.get(rt.id);
          const rb = st.robots.find((x) => x.id === rt.robotId);
          const pts = (rt.status === 'active' && rb
            ? [rb.pos, ...rt.waypoints]
            : rt.waypoints).map((w) => new THREE.Vector3(w.x, 1.4, w.z));
          const geo = new THREE.BufferGeometry().setFromPoints(pts.length > 1 ? pts : [new THREE.Vector3(), new THREE.Vector3(0.1, 1.4, 0)]);
          if (!line) {
            const mat = new THREE.LineDashedMaterial({ color: 0x22d3ee, dashSize: 3, gapSize: 2, transparent: true, opacity: 0.9 });
            line = new THREE.Line(geo, mat);
            routeG.add(line);
            routeLines.set(rt.id, line);
          } else {
            line.geometry.dispose();
            line.geometry = geo;
          }
          const m = line.material as THREE.LineDashedMaterial;
          if (rt.status === 'invalid') { m.color.set(0xef4444); m.dashSize = 2; m.gapSize = 2; }
          else if (rt.status === 'suggested') { m.color.set(0xfbbf24); m.dashSize = 4; m.gapSize = 3; }
          else if (rt.status === 'done') { m.color.set(0x34d399); }
          else if (rt.status === 'planned') { m.color.set(0x94a3b8); }
          else { m.color.set(0x22d3ee); }
          line.computeLineDistances();
          line.visible = !(st.isolatedId && !rt.waypoints.some((w) => inBuilding(st, w.x, w.z, st.isolatedId!)));
        }
        for (const [id, l] of [...routeLines]) {
          if (!seen.has(id)) { routeG.remove(l); l.geometry.dispose(); (l.material as THREE.Material).dispose(); routeLines.delete(id); }
        }
      }

      // ── overlays: coverage fog texture @ ~5Hz ──
      if (st.layers.coverage && elapsed - syncAt > 0.2) {
        syncAt = elapsed;
        const g2 = fogCanvas.getContext('2d')!;
        const img = g2.createImageData(GRID_N, GRID_N);
        for (let z = 0; z < GRID_N; z++) {
          for (let x = 0; x < GRID_N; x++) {
            const v = st.coverage[z][x];
            const i = (z * GRID_N + x) * 4;
            img.data[i] = 4; img.data[i + 1] = 8; img.data[i + 2] = 18;
            img.data[i + 3] = Math.round((1 - v) * 235);
          }
        }
        g2.putImageData(img, 0, 0);
        fogTex.needsUpdate = true;
        // point cloud refresh near observed buildings
        const posAttr = pcGeo.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < pcCount; i++) {
          const b = st.buildings[(i * 7) % st.buildings.length];
          const known = b.observed > 0.15;
          const px = b.x + Math.random() * b.w;
          const py = known ? Math.random() * b.floors * b.floorHeight : -10;
          const pz = b.z + Math.random() * b.d;
          posAttr.setXYZ(i, px, py, pz);
        }
        posAttr.needsUpdate = true;
      }
      fogPlane.visible = st.layers.coverage;
      points.visible = st.layers.pointcloud;
      relayG.visible = st.layers.relays || st.layers.signal;

      // comms / sensor / confidence overlays — rebuilt at 2Hz max, with disposal
      const overlayKey = [
        st.layers.signal, st.layers.thermal, st.layers.gas, st.layers.confidence,
        hzVisible.length, svVisible.length, st.robots.length,
        live ? 'live' : Math.round(simT),
      ].join('|');
      if (overlayKey !== (overlayG.userData.key as string) || elapsed - (overlayG.userData.at as number ?? -9) > 2) {
        overlayG.userData.key = overlayKey;
        overlayG.userData.at = elapsed;
        overlayG.children.slice().forEach((c) => {
          overlayG.remove(c);
          c.traverse((o: THREE.Object3D) => {
            const anyO = o as unknown as { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] };
            if (anyO.geometry) anyO.geometry.dispose();
            if (anyO.material) (Array.isArray(anyO.material) ? anyO.material : [anyO.material]).forEach((x) => x.dispose());
          });
        });
        if (st.layers.signal) {
          for (const rb of st.robots) {
            const p = robotPosAt(rb, viewT);
            const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(14, 8, 118), new THREE.Vector3(p.x, 2, p.z)]);
            const lm = new THREE.LineBasicMaterial({ color: rb.status === 'CommLost' ? 0xef4444 : rb.signal > 50 ? 0x34d399 : 0xfbbf24, transparent: true, opacity: 0.65 });
            overlayG.add(new THREE.Line(lg, lm));
          }
        }
      if (st.layers.thermal) {
        for (const sv of svVisible) {
          const blob = new THREE.Mesh(new THREE.CircleGeometry(9, 24),
            new THREE.MeshBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
          blob.rotation.x = -Math.PI / 2;
          blob.position.set(sv.pos.x, 0.6, sv.pos.z);
          overlayG.add(blob);
        }
      }
      if (st.layers.gas) {
        for (const hz of hzVisible.filter((h) => h.category === 'gas' || h.category === 'chemical' || h.category === 'smoke')) {
          const blob = new THREE.Mesh(new THREE.CircleGeometry(hz.radius + 6, 28),
            new THREE.MeshBasicMaterial({ color: 0xa3e635, transparent: true, opacity: 0.16, side: THREE.DoubleSide }));
          blob.rotation.x = -Math.PI / 2;
          blob.position.set(hz.pos.x, 0.55, hz.pos.z);
          overlayG.add(blob);
        }
      }
      if (st.layers.confidence) {
        for (const b of st.buildings) {
          const c = b.observed > 0 ? 0.55 + b.observed * 0.4 : b.baselineConfidence;
          const ring = new THREE.Mesh(new THREE.RingGeometry(Math.max(b.w, b.d) * 0.55, Math.max(b.w, b.d) * 0.55 + 0.8, 32),
            new THREE.MeshBasicMaterial({ color: c > 0.75 ? 0x34d399 : c > 0.45 ? 0xfbbf24 : 0x64748b, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(b.x + b.w / 2, 0.45, b.z + b.d / 2);
          overlayG.add(ring);
        }
      }
      }

      renderer.render(scene, camera);
    }
    animate();

    function onResize() {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="map3d" aria-label="3D operational map" />;
}

function bMeshHeightAt(st: ReturnType<typeof useStore.getState>, x: number, z: number): number | null {
  const b = st.buildings.find((bb) => x > bb.x && x < bb.x + bb.w && z > bb.z && z < bb.z + bb.d);
  if (!b) return null;
  if (st.isolatedId === b.id) return null;
  return null; // robots stay ground-level in overview; floors shown in building view
}

function inBuilding(st: ReturnType<typeof useStore.getState>, x: number, z: number, id: string): boolean {
  const b = st.buildings.find((bb) => bb.id === id);
  if (!b) return false;
  return x > b.x - 4 && x < b.x + b.w + 4 && z > b.z - 4 && z < b.z + b.d + 4;
}
