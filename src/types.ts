// ─── RescueGrid core data model (PRD §66–69) ────────────────────────────────
// Local-first: every entity carries provenance + freshness so the UI can
// always answer "what do we know, how do we know it, how recently?"

export type Vec3 = { x: number; y: number; z: number };

export type RobotStatus =
  | 'Ready' | 'Assigned' | 'Navigating' | 'Exploring' | 'Inspecting'
  | 'Returning' | 'Waiting' | 'Manual' | 'CommLost' | 'Immobilized'
  | 'LowBattery' | 'Fault' | 'Estop';

export type HazardCategory =
  | 'collapse' | 'unstable' | 'fire' | 'smoke' | 'gas' | 'water'
  | 'electrical' | 'chemical' | 'heat' | 'blocked' | 'debris'
  | 'aftershock' | 'blackout' | 'unknown';

export type Severity = 'Advisory' | 'Caution' | 'Dangerous' | 'Critical';

export type SurvivorStatus =
  | 'Possible' | 'Probable' | 'Confirmed' | 'Assigned'
  | 'Reached' | 'Evacuated' | 'False';

export type MissionType =
  | 'Explore' | 'SearchStructure' | 'InspectHazard' | 'Verify'
  | 'Deliver' | 'Relay' | 'MapInterior' | 'SearchSurvivors'
  | 'Return' | 'Hold';

export type MissionStatus = 'Planned' | 'Active' | 'Paused' | 'Done' | 'Aborted' | 'Blocked';

export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export interface RobotState {
  id: string;
  name: string;
  kind: string;
  pos: Vec3;
  floor: number;
  buildingId: string | null;
  heading: number; // radians
  battery: number; // 0..100
  signal: number; // 0..100
  status: RobotStatus;
  task: string;
  missionId: string | null;
  speed: number;
  waypoints: Vec3[];
  wpIndex: number;
  trail: Vec3[];
  history: { t: number; x: number; z: number; y: number }[];
  lastContact: number; // sim seconds of last telemetry
  uncertainty: number; // meters, grows on comm loss
  sensors: { lidar: boolean; thermal: boolean; gas: boolean; audio: boolean; camera: boolean };
  temp: number;
  latencyMs: number;
  packetLoss: number;
  color: string;
}

export interface BuildingState {
  id: string;
  label: string;
  x: number; z: number; w: number; d: number;
  floors: number;
  floorHeight: number;
  condition: 'intact' | 'damaged' | 'partial' | 'collapsed';
  baselineConfidence: number; // 0..1 (imported, unverified)
  observed: number; // 0..1 fraction robot-observed
  lastObserved: number | null;
  observedBy: string | null;
  contradicted: boolean;
  priority: boolean; // survivor-priority building
  stale: boolean; // after aftershock
  floorsExplored: boolean[];
  center: Vec3;
}

export interface Hazard {
  id: string;
  category: HazardCategory;
  severity: Severity;
  pos: Vec3;
  buildingId: string | null;
  floor: number | null;
  label: string;
  detail: string;
  confidence: number;
  source: string; // robot id
  confirmedBy: string[];
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'mitigated' | 'stale';
  radius: number;
}

export interface Survivor {
  id: string;
  pos: Vec3;
  buildingId: string | null;
  floor: number;
  confidence: number;
  methods: string[];
  status: SurvivorStatus;
  detectedBy: string;
  detectedAt: number;
  priority: Priority;
  accessNote: string;
}

export interface Discovery {
  id: string;
  kind: string;
  label: string;
  detail: string;
  pos: Vec3;
  buildingId: string | null;
  robotId: string;
  confidence: number;
  createdAt: number;
  priority: Priority;
}

export interface OpEvent {
  id: string;
  t: number;
  robotId: string | null;
  buildingId: string | null;
  kind: 'discovery' | 'hazard' | 'survivor' | 'route' | 'comms' | 'mission' | 'system' | 'map';
  severity: Priority;
  text: string;
}

export interface Mission {
  id: string;
  title: string;
  type: MissionType;
  priority: Priority;
  robotIds: string[];
  buildingId: string | null;
  target: Vec3;
  status: MissionStatus;
  progress: number;
  createdAt: number;
  updatedAt: number;
  discoveries: number;
  note: string;
}

export interface RouteState {
  id: string;
  robotId: string;
  waypoints: Vec3[];
  status: 'planned' | 'active' | 'done' | 'invalid' | 'suggested';
  reason?: string;
}

export interface Alert {
  id: string;
  t: number;
  level: 'passive' | 'elevated' | 'critical';
  title: string;
  detail: string;
  robotId?: string;
  hazardId?: string;
  survivorId?: string;
  acked: boolean;
  ackAt?: number;
}

export interface AuditEntry {
  id: string;
  t: number;
  actor: string;
  text: string;
}

export type Selection =
  | { kind: 'robot'; id: string }
  | { kind: 'building'; id: string }
  | { kind: 'hazard'; id: string }
  | { kind: 'survivor'; id: string }
  | { kind: 'mission'; id: string }
  | { kind: 'discovery'; id: string }
  | null;

export interface LayerState {
  baseline: boolean;
  observed: boolean;
  pointcloud: boolean;
  robots: boolean;
  routes: boolean;
  trails: boolean;
  missions: boolean;
  hazards: boolean;
  survivors: boolean;
  discoveries: boolean;
  coverage: boolean;
  thermal: boolean;
  gas: boolean;
  signal: boolean;
  confidence: boolean;
  freshness: boolean;
  relays: boolean;
  labels: boolean;
}
