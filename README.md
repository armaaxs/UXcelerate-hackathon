# UXcelerate!

Welcome! Follow the steps below to participate and submit your entry.

## How to Participate

1. **Fork this repository**
   Click the **Fork** button at the top right of this repo to create your own copy under your GitHub account.

2. **Build your submission**
   Work entirely within your forked repository. Design and build your UI/UX submission according to the challenge brief. Commit your work as you go so we can see your process.

3. **Deploy your project (optional)**
   If you'd like, deploy your project (e.g. Vercel, Netlify, GitHub Pages) and add the live link to your repo's README or description. This isn't mandatory, but it's a great way to showcase your work.

4. **Submit your forked repo**
   Once you're done, copy the link to your forked repository and submit it via the official submission form:

   👉 **[[UXcelerate]](https://docs.google.com/forms/d/e/1FAIpQLSdF-HbTXtL_Qk098nPxq8cwys_6ANyRC2fb8I2SQCcYy4XXuQ/viewform?usp=publish-editor)**

## Notes

- Make sure your forked repo is public so we can review it.
- Double-check your form submission includes the correct repo link before the deadline.
- Reach out to the IEI team if you run into any issues.

Good luck, and have fun building! 🎨

---

# Submission — RescueGrid: Earthquake Rescue Robot Coordination Interface

**Brief:** *Design an interface for coordinating rescue robots after an earthquake where maps are incomplete and robots continuously discover new hazards.*

**Live demo:** _(add Vercel / Netlify / GitHub Pages link here after deploying `dist/`)_
**Repo:** https://github.com/armaaxs/UXcelerate-hackathon

RescueGrid is a **local-first 3D command interface** for coordinating a fleet of rescue robots across a damaged urban district. The map is treated as a *living operational model* — baseline imports are visually distinct from robot-confirmed reality, contradictions are explicit, and every critical item carries provenance (who observed it, when, with what confidence).

## Run it (no internet, no API keys, no backend)

```bash
npm install
npm run dev      # local command post at http://localhost:5173
npm run build    # static bundle in dist/ — serve anywhere, works offline
```

Stack: React + TypeScript + Vite, Three.js (bundled, no tiles/services), Zustand, Lucide icons, hand-rolled CSS. Zero runtime network requests (verified: no external URLs in the bundle).

## What to try (90-second demo)

1. Watch the incident evolve: at ~T+9s R-04's lidar **contradicts the baseline corridor** at B14 north — the route turns red/invalid and a suggested reroute appears.
2. At ~T+22s an alternative south entrance is confirmed and R-04 reroutes; at ~T+34s a **gas leak** forces R-05 clear; at ~T+50s R-06 reports a **probable survivor on B14 Floor 3** (P0 critical alert).
3. Click **B14 → Isolate + explode**: floors separate, per-floor exploration is listed, cutaway planes (X/Z/altitude) slice the structure, Baseline ⇄ Observed compares.
4. Scrub the **timeline** back to replay discoveries; robot markers jump to historical positions and future hazards hide.
5. Open **Layers** (or press `L`): toggle baseline/observed, routes, trails, coverage fog, thermal/gas/signal/confidence/freshness overlays.
6. Press **Ctrl/⌘ K** for the command palette; press `1`/`2` for top-down/perspective, `M` to arm a mission, `F` to frame a selection.
7. Hit **Aftershock** in Simulation Controls: central blocks go STALE and every active route requires reverification.

## How it maps to the brief

- **Incomplete maps:** baseline geometry renders desaturated/translucent; robot-observed volumes render solid; contradicted areas go pink; unexplored ground stays under an exploration-fog overlay.
- **Continuous discovery:** discoveries pulse on the 3D map, enter the event feed, invalidate intersecting routes, block affected missions, and raise passive/elevated/critical alerts with acknowledge tracking.
- **Uncertainty & freshness:** position-uncertainty rings grow on comms loss, confidence bars + provenance cards answer "why does the system believe this?", freshness overlay fades stale readings.
- **Coordination:** fleet cards, missions with progress/pause/abort, click-to-task mission creation, survivor verification assignment, audit log of every command, aftershock protocol.
- **Offline:** procedural district (14 buildings, 6 robots), local simulation engine, local origin coordinates — deployable to a field laptop with no connectivity.

## Project layout

```
src/
  App.tsx                 # command-center shell + secondary views (Robots/Missions/Map/…)
  types.ts                # incident data model (robot, hazard, survivor, mission, route…)
  store.ts                # zustand store + local telemetry/simulation engine
  data/district.ts        # procedural disaster district (local coordinates)
  three/RescueCanvas.tsx  # Three.js operational overview (layers, explode, cutaway…)
  components/             # TopBar, LeftPanel, RightPanel, BottomBar, Overlays
```

## Verification

- `npx tsc --noEmit` — clean
- `npm run build` — clean, single static bundle
- Headless-browser pass (Chromium): full demo sequence, robot/building selection, exploded view, palette, aftershock — **0 console/page errors**
- Bundle contains **no external service calls** (no maps, tiles, fonts, analytics)
