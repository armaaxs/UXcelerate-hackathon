# RescueGrid — Earthquake Rescue Robot Coordination Interface

> **Challenge brief:** *Design an interface for coordinating rescue robots after an earthquake, where maps are incomplete and robots continuously discover new hazards.*

RescueGrid is a **local-first 3D command interface** for running a fleet of search-and-rescue robots in a damaged urban district — rendered here as a **real map segment of Paris 7e around the Eiffel Tower**, built from OpenStreetMap footprints, streets, the Seine, and Champ de Mars (bundled locally; the runtime makes zero external calls). Its core idea: after an earthquake the map itself can't be trusted, so the interface treats the environment as a **living operational model** — pre-disaster imports are visually distinct from robot-confirmed reality, contradictions are explicit, and every critical item carries provenance (*who saw it, when, with what confidence*).

**No internet. No map tiles. No API keys. No backend.** Everything — the district, the robots, the telemetry, the hazards — is generated and rendered locally. The production bundle makes zero external network requests.

---

## 1. Execution commands

**Requirements:** Node.js 18+ and npm.

```bash
# install dependencies (once)
npm install

# start the command post locally (default http://localhost:5173)
npm run dev

# typecheck without emitting
npm run typecheck        # or: npm run typecheck

# production build -> static files in dist/ (fully offline-capable)
npm run build

# serve the production build locally to verify it
npm run preview          # default http://localhost:4173

# refresh the bundled Paris map extract from OpenStreetMap (dev-time only;
# the app never calls this at runtime — output is committed as src/data/paris.json)
node scripts/fetch-paris.mjs            # live fetch via Overpass API
node scripts/fetch-paris.mjs --from path/to/overpass.json   # process a saved response
```

Useful variants:

```bash
npm run dev -- --port 5173 --host 127.0.0.1   # pinned port + loopback
npm run preview -- --port 4173 --host 0.0.0.0 # expose the prod build on the LAN
```

Stop a running server with `Ctrl+C`, or `pkill -f "vite.*5173"` if it was started in the background.

---

## 2. What it does

- **Commands a robot fleet from one screen.** Six robots (tracked UGVs, quadrupeds, a thermal scout) deploy from Champ de Mars and work the blocks around the tower; you monitor, task, reroute, hold, recall, reconnect, or emergency-stop them.
- **Maintains a living 3D map.** Fourteen real Haussmann-block structures (plus the Eiffel Tower as an inspectable 330 m landmark with its three platforms), 200+ context footprints, real streets, the Seine, and Champ de Mars — all in local meters relative to the tower (incident origin).
- **Ingests continuous discoveries.** Robots report blocked passages, new entrances, rooms, hazards, and survivor signals. Each discovery pulses onto the map, enters the event feed and timeline, and can invalidate routes and block missions.
- **Makes uncertainty visible.** Baseline (imported, unverified) vs. observed (robot-confirmed) vs. contradicted geometry; position-uncertainty rings; per-object confidence; freshness fading; stale flags after aftershocks.
- **Prioritizes what matters.** P0–P3 priorities, passive/elevated/critical alerts with acknowledge tracking, and survivor detections that outrank routine mapping.
- **Replays history.** Scrub the timeline to replay the incident: robots jump to historical positions, future hazards/discoveries hide, and one click returns to LIVE.
- **Audits everything.** Every operator command is recorded with actor + timestamp in the audit log.

---

## 3. What you see on screen

The default **Overview** is a full-screen command center (the 3D map occupies ~70% of the workspace):

| Zone | Contents |
|---|---|
| **Top bar** | PARIS 7E incident chip · nav (Overview, Robots, Missions, Discoveries, Map, Timeline, Incident Log, System) · map search · fleet link health · unacked-alert count · SIMULATION / LIVE / REPLAY badge · incident clock |
| **Left panel** | Tabbed: **Fleet** (compact status rows — click to focus camera), **Missions**, **Intel** (survivors → hazards → latest findings) |
| **Center** | Interactive 3D Paris map + slim tool rail, view selector, collapsible map key, 2D minimap, alert toasts (max 2), building-focus card, and a floating inspector that appears only while something is selected |
| **Bottom** | Timeline scrubber with LIVE indicator, filterable event feed, simulation controls (inject discovery/hazard, drop link, spawn survivor, aftershock, reset), mini audit log |

Other nav views reuse the same live data as dense tables/workflows: **Robots** (fleet health), **Missions**, **Discoveries** (every observation + confidence), **Map** (per-structure observed % and flags), **Timeline** (full event list), **Incident Log** (survivors, hazards, audit), **System** (local-first status, contrast/motion toggles).

---

## 4. How to use it

### 4.1 The 90-second guided demo (just watch)

The incident runs itself on load (2× speed). Key beats, in sim time:

| T+ | Event |
|---|---|
| 0s | Incident declared at the Eiffel Tower; 6 robots deploy from Champ de Mars staging |
| ~9s | **R-04's lidar contradicts the baseline**: B14's north corridor is collapsed. Route goes red/invalid, mission blocks, elevated alert fires, suggested reroute appears |
| ~22s | R-05 confirms an **alternative south entrance**; R-04 reroutes |
| ~34s | **Gas leak** on B14 Floor 1 (critical alert); R-05 diverts to the east stairwell |
| ~50s | **Probable survivor, B14 Floor 3** (thermal + audio, 88%) — P0 critical alert, building flagged ★ PRIORITY, auto-selected |
| ~68s | West stairwell collapses (F2→F3 severed); east stair remains the verified access |
| ~92s | **R-02 loses link** in the eastern dead zone — grey marker, growing uncertainty ring |
| ongoing | Ambient mapping discoveries, battery drain, low-battery warnings |

### 4.2 Interacting with the map

- **Click** any robot, building, hazard, or survivor to inspect it (right panel) — drag-rotating doesn't trigger selection.
- **Orbit / pan / zoom** with the mouse (OrbitControls with damping). `1` = top-down coverage, `2` = full incident.
- **Building deep-dive:** select a building → **Isolate + explode** → neighboring structures dim, floors separate on a slider, per-floor exploration listed; **cutaway planes** (X / Z / altitude) slice the structure; **Baseline ⇄ Observed** compares import vs. robot truth. Exit with the Exit button or `Esc`.
- **Create a mission:** pick a type from the dropdown (or press `M`), click **+ Mission**, then click/double-click a map point — the nearest free robots are tasked and a planned route is drawn.
- **React to change:** hazard cards show what they invalidate and offer **Confirm reroute**; survivor cards offer **Assign verification** plus a full Possible → … → Evacuated / False state workflow; high-impact robot actions (e.g. E-stop, aborting a P0 mission) ask for confirmation.
- **Search** (`R-04`, `B14`, `gas`, `survivor`…) frames the match and opens its inspector.

### 4.3 Timeline replay

Drag the bottom scrubber backward: the badge flips to **REPLAY + timestamp**, robots render at historical positions, and anything discovered later stays hidden. Press **Back to LIVE** (or `T`) to return. The simulation keeps running underneath, so nothing is lost.

### 4.4 Command palette & keyboard shortcuts

| Key | Action |
|---|---|
| `Ctrl/⌘ K` | Command palette (focus robots, jump to buildings/survivors, layers, camera, demo triggers) |
| `F` | Frame current selection |
| `1` / `2` | Top-down coverage / full-incident camera |
| `L` | Layer panel |
| `M` | Arm mission creation |
| `T` | Back to LIVE |
| `Space` | Play / pause (when timeline focused) |
| `Esc` | Clear selection, close palette, disarm mission draft |

### 4.5 Layers (floating panel)

- **Environment:** baseline (pre-disaster import), observed reality, point clouds, exploration coverage fog
- **Operations:** robots, trails, routes, missions, relays & staging, labels
- **Intelligence:** hazards, survivors, discoveries
- **Sensors:** thermal overlay, gas overlay, signal/mesh links
- **Diagnostics:** confidence rings, freshness fade

Camera presets (bottom-left chips): **Incident · Robots · Hazards · Survivors · Comms · Coverage**.

### 4.6 Simulation controls (bottom-right)

Play/pause, **1× / 2× / 4×** speed, and demo injectors: **Discovery**, **Hazard**, **Drop link** (kill a robot's comms), **Survivor**, **Aftershock** (M5.1 — central blocks go STALE, all active routes require reverification), **Reset** (back to T+0). The **SIMULATION** badge is always visible so a demo can never masquerade as a live incident.

---

## 5. Reading the map (visual language)

| Visual | Meaning |
|---|---|
| Slate translucent mass | **Baseline** — imported, unverified hypothesis |
| Solid teal mass | **Observed** — robot-confirmed (clarity grows with observed %) |
| Pink / magenta tint | **Contradicted** — robots proved the baseline wrong |
| Dark haze over ground | **Unexplored** — fog clears as robots sweep (coverage layer) |
| Amber ring / desaturation | **Uncertain or stale** — verify before committing people |
| Red marker / route | Danger / critical hazard / invalid route |
| Amber dashed route | Suggested alternative awaiting confirmation |
| Magenta diamond + beam | **Survivor detection** — highest visual priority |
| Iron lattice tower, 330 m | **Eiffel Tower landmark** — real height/platforms, inspectable, explodable by deck |
| Grey marker + dashed ring | **Comms lost** — last-known position, uncertainty grows with time |
| Expanding white ring | Brand-new discovery (< ~14 s old) |

Color is never the only signal: every state also has an icon, label, pattern, or text treatment, and details are tabular numerals for telemetry.

---

## 6. Data, fleet & simulation details

- **District** (`src/data/district.ts` + `src/data/paris.json`): a real 380 m OpenStreetMap extract around the Eiffel Tower — 14 hero structures with true footprints/floor counts/street names (B01–B14, damage graded from the epicenter), 200+ context footprints, 50+ real streets as ribbons, the Seine, Champ de Mars lawns, staging/relays/dead-zone placed on real open ground. The Eiffel Tower is modeled procedurally at its true height (330 m, decks at 57/115/276 m) and is fully inspectable. Refresh the extract with `node scripts/fetch-paris.mjs`. Data: © OpenStreetMap contributors (ODbL), credited in the System view.
- **Fleet:** R-01 (western sweep), R-02 (NW mapping, dead-zone risk), R-03 (central relay hold), R-04 (B14 north approach, lidar quadruped), R-05 (B14 south approach, gas sensing), R-06 (SE thermal/audio scout). Pose ticks every frame; battery/signal/temperature degrade; dead-zone entry degrades link quality until loss.
- **Missions:** M-01 Search B14 (P0), M-02 Map NW (P1), M-03 SE survivor sweep (P1), M-04 relay hold (P2) — plus operator-created ones. Progress follows proximity; hazard intersections flip them to Blocked.
- **Entities** (`src/types.ts`): robot, building/structure, hazard (14 categories × Advisory/Caution/Dangerous/Critical), survivor (Possible → … → Evacuated/False), discovery, mission, route (planned/active/done/invalid/suggested), event (P0–P3), alert (passive/elevated/critical + ack), audit entry, selection, layers. Everything timestamped with source + confidence.
- **Engine** (`src/store.ts`, Zustand): fixed-clamp timestep × speed multiplier, waypoint navigation, coverage spreading (26×26 grid), 2 Hz position history (timeline replay), scripted demo beats + ambient discoveries, route-hazard intersection checks with suggested alternates, battery/comms alerting.

---

## 7. Architecture

```
src/
  main.tsx                # entry (+ DEV-only diagnostics handle, stripped from prod)
  App.tsx                 # command-center shell + secondary views
  types.ts                # incident data model
  store.ts                # zustand store + local simulation engine
  data/district.ts        # real-Paris district adapter (heroes, tower, edge anchors)
  data/paris.json         # bundled OSM extract (footprints, streets, Seine, parks)
  three/RescueCanvas.tsx  # Three.js scene: extruded real footprints, tower,
                          # street ribbons, fog texture, overlays, camera tweens, picking
  components/
    TopBar.tsx            # status, nav, search, badges, clock
    LeftPanel.tsx         # tabbed Fleet / Missions / Intel feed
    RightPanel.tsx        # floating selection inspector + intel cards + provenance
    BottomBar.tsx         # timeline, event feed, sim controls, audit mini-log
    Overlays.tsx          # layers, slim toolbar, minimap, alerts, building focus, palette
  index.css               # minimalist theme (system fonts only — offline safe)
scripts/
  fetch-paris.mjs         # dev-time OSM fetch + processing (never runs in the app)
```

**Stack:** React 18 + TypeScript + Vite 6, Three.js (bundled; `OrbitControls` from three examples), Zustand 5, Lucide icons. No Tailwind, no UI kit, no map SDK — styling is hand-rolled CSS variables so the bundle stays self-contained.

**Offline policy:** the app must never require remote fonts, tiles, CDNs, analytics, auth, or cloud APIs. Verified by running the production build in a browser and asserting **zero non-local network requests**.

**Rendering notes:** objects are reconciled by id (never rebuilt per frame), labels are canvas sprites scaled by camera distance, route/overlay geometry rebuilds at throttled rates with disposal, fog is a single 26×26 canvas texture, point clouds refresh at ~5 Hz.

---

## 8. Verification performed

- `npm run typecheck` — clean; `npm run build` — clean single static bundle (~770 KB JS, ~209 KB gzip).
- Scripted headless-browser pass (Chromium + SwiftShader): full demo arc to survivor + stair collapse, robot/building selection, isolate + explode + cutaway, command palette, aftershock, layer toggles — **0 console/page errors**, scene-graph object counts stable (no leaks).
- Simulation unit pass (headless tick to T+140 s): blocked passage, gas, survivor, route invalidation, R-02 comms loss, B14 contradicted + priority, aftershock staleness, mission creation — all PASS.
- This process caught and fixed two real defects: a Zustand selector infinite-render loop and a missing reconcile-map insert that duplicated scene objects every frame.

---

## 9. Deployment

Any static host works (the build has `base: './'`, so sub-path hosting is fine):

```bash
npm run build
# Vercel / Netlify: publish directory dist, no build tweaks needed
# GitHub Pages: upload dist/ (or wire a workflow to build + publish it)
```

Then paste the live URL here: **Live demo:** _(add link after deploying)_.

---

## 10. Accessibility & scope notes

- Keyboard navigation throughout, `Esc` always backs out, high-contrast toggle in the top bar / System view, reduced-motion toggle (disables pulses/tweens), non-color encodings for every state; critical info is always mirrored in text panels (the 3D view is never the only channel).
- Primary target is desktop command displays (1440 px+, ideally 1080p/ultrawide); panels collapse toward drawers on narrow screens.
- Deliberately **not** included (per brief): autonomous fleet control, teleoperation, medical/structural analysis, consumer navigation, or any paid mapping dependency.

---

## Challenge submission

Fork of [ieibpdc/UXcelerate](https://github.com/ieibpdc/UXcelerate) built for the IEI UI/UX Challenge. Submission: this repo (`https://github.com/armaaxs/UXcelerate-hackathon`) via the [official form](https://docs.google.com/forms/d/e/1FAIpQLSdF-HbTXtL_Qk098nPxq8cwys_6ANyRC2fb8I2SQCcYy4XXuQ/viewform?usp=publish-editor). Make sure the fork stays public until judging ends.
