import type { LoadState } from "@/lib/gridsense";

export const STATE_COLOR: Record<LoadState | "UNKNOWN", string> = {
  ON: "#22c55e",
  OFF: "#475569",
  RESTARTING: "#f59e0b",
  FAULT: "#ef4444",
  UNKNOWN: "#64748b",
};

export const colorOf = (state: LoadState | null) => STATE_COLOR[state ?? "UNKNOWN"];

/**
 * Emissive intensity for a status indicator at time t (seconds):
 * ON steady, OFF dark, RESTARTING pulsing, FAULT blinking.
 */
export function lampIntensity(state: LoadState | null, t: number): number {
  switch (state) {
    case "ON":
      return 1.8;
    case "OFF":
      return 0;
    case "RESTARTING":
      return 0.3 + 1.7 * (0.5 + 0.5 * Math.sin(t * 7));
    case "FAULT":
      return Math.sin(t * 9) > 0 ? 2.4 : 0.15;
    default:
      return 0.15;
  }
}

/** How much a load is "running" (0..1), used for fan speed and light output. */
export function runLevel(state: LoadState | null, t: number): number {
  switch (state) {
    case "ON":
      return 1;
    case "RESTARTING":
      return 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(t * 7));
    default:
      return 0;
  }
}
