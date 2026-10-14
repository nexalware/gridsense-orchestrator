// GridSense resource tree on the site MN-CSE (ACME, CSEBase cse-mn) and the
// JSON content of each <contentInstance>.
//
// PROVISIONAL: to be aligned with the bridge (Dare). See docs/resource-tree.md.
// No secrets and no dependencies here: imported by server code, the dev feed
// and client components.

export type GridStatus = "ON" | "OFF";
export type LoadState = "ON" | "OFF" | "RESTARTING" | "FAULT";

export const GRID = { ae: "grid-sensor", container: "grid-status" } as const;
export const BATTERY = { ae: "battery", container: "battery-state" } as const;
export const LOAD_CONTAINER = "load-state";

export interface LoadDefinition {
  id: string;
  name: string;
  priority: 1 | 2 | 3;
}

/** The three demo loads. `id` is the AE resource name. */
export const LOADS: readonly LoadDefinition[] = [
  { id: "load-p1-coldroom", name: "Cold room", priority: 1 },
  { id: "load-p2-machine", name: "Machine / fan", priority: 2 },
  { id: "load-p3-lights", name: "Lights", priority: 3 },
];

/** <accessControlPolicy> resource names, children of the CSEBase. */
export const ACP = {
  devices: "acp-gridsense-devices",
  gridInput: "acp-gridsense-grid-input",
} as const;

export const containerPath = {
  grid: `${GRID.ae}/${GRID.container}`,
  battery: `${BATTERY.ae}/${BATTERY.container}`,
  load: (loadId: string) => `${loadId}/${LOAD_CONTAINER}`,
};

// ---- <contentInstance> content (JSON in "con"); ts is ISO 8601 UTC ----

export interface GridStatusContent {
  status: GridStatus;
  ts: string;
}

export interface BatteryStateContent {
  percent: number;
  voltage: number;
  ts: string;
}

export interface LoadStateContent {
  priority: 1 | 2 | 3;
  state: LoadState;
  ratedCurrent: number;
  measuredCurrent: number;
  ts: string;
}

// ---- GET /api/state response ----

export interface LoadSnapshot {
  id: string;
  name: string;
  priority: number;
  state: LoadState | null;
  ratedCurrent: number | null;
  measuredCurrent: number | null;
  ts: string | null;
}

export interface StateSnapshot {
  grid: { status: GridStatus; ts: string } | null;
  battery: { percent: number; voltage: number | null; ts: string } | null;
  loads: LoadSnapshot[];
  /** Newest ts across all resources, or null if nothing has been written yet. */
  lastUpdated: string | null;
  /** When the dashboard server read oneM2M (ISO 8601 UTC). */
  fetchedAt: string;
}

export interface StateError {
  error: string;
  fetchedAt: string;
}
