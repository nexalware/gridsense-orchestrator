import "server-only";

import { createOneM2MClient, type OneM2MClient } from "@/lib/onem2m";
import {
  LOADS,
  containerPath,
  type BatteryStateContent,
  type GridStatus,
  type GridStatusContent,
  type LoadStateContent,
  type StateSnapshot,
} from "@/lib/gridsense";

// Server-side only. Builds the snapshot the browser polls, from the latest
// <contentInstance> of each container. The browser never talks to a CSE.

let client: OneM2MClient | null = null;

export class ConfigError extends Error {}

function getClient(): OneM2MClient {
  if (client) return client;
  const baseUrl = process.env.ONEM2M_BASE_URL;
  const csePath = process.env.ONEM2M_CSE_PATH;
  const originator = process.env.ONEM2M_ORIGINATOR;
  if (!baseUrl || !csePath || !originator) {
    throw new ConfigError("Dashboard is not configured: set ONEM2M_BASE_URL, ONEM2M_CSE_PATH and ONEM2M_ORIGINATOR.");
  }
  client = createOneM2MClient({ baseUrl, csePath, originator, timeoutMs: 3000 });
  return client;
}

// One shared read per interval, however many browser tabs poll. Mobius4
// rate-limits each client IP (RATELIMIT_MAX per minute), and every snapshot
// costs one request per container.
const CACHE_MS = 900;
let cached: { at: number; promise: Promise<StateSnapshot> } | null = null;

export function getSnapshot(): Promise<StateSnapshot> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) return cached.promise;
  const promise = readSnapshot();
  cached = { at: now, promise };
  // A failed read must not be served from the cache.
  promise.catch(() => {
    if (cached?.promise === promise) cached = null;
  });
  return promise;
}

async function readSnapshot(): Promise<StateSnapshot> {
  const c = getClient();
  const [grid, battery, ...loads] = await Promise.all([
    c.latestJson<GridStatusContent>(containerPath.grid),
    c.latestJson<BatteryStateContent>(containerPath.battery),
    ...LOADS.map((load) => c.latestJson<LoadStateContent>(containerPath.load(load.id))),
  ]);

  const timestamps: string[] = [];
  const note = (ts: string | undefined) => {
    if (ts) timestamps.push(ts);
  };
  note(grid?.content.ts);
  note(battery?.content.ts);

  const snapshot: StateSnapshot = {
    grid: grid ? { status: grid.content.status, ts: grid.content.ts } : null,
    battery: battery
      ? { percent: battery.content.percent, voltage: battery.content.voltage ?? null, ts: battery.content.ts }
      : null,
    loads: LOADS.map((def, i) => {
      const latest = loads[i] as { content: LoadStateContent } | null;
      const content = latest?.content;
      note(content?.ts);
      return {
        id: def.id,
        name: def.name,
        priority: content?.priority ?? def.priority,
        state: content?.state ?? null,
        ratedCurrent: content?.ratedCurrent ?? null,
        measuredCurrent: content?.measuredCurrent ?? null,
        ts: content?.ts ?? null,
      };
    }),
    lastUpdated: timestamps.length ? timestamps.sort().at(-1)! : null,
    fetchedAt: new Date().toISOString(),
  };
  return snapshot;
}

/** Write a new grid status, as the grid sensor would. Changes no load. */
export async function writeGridStatus(status: GridStatus): Promise<GridStatusContent> {
  const content: GridStatusContent = { status, ts: new Date().toISOString() };
  await getClient().addJson(containerPath.grid, content);
  cached = null;
  return content;
}
