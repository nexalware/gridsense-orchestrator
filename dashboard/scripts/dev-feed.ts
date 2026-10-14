// DEV ONLY. Not part of GridSense's runtime.
//
// Stand-in for the site devices AND a minimal stand-in for the Orchestrator,
// so the dashboard and the 3D factory can be developed and demoed before the
// bridge (IPE) and a device data source exist. It will be replaced by the
// bridge (device state up into ACME) plus the real Orchestrator AE.
//
// What it does, all through oneM2M on the site MN-CSE (ACME):
//   1. Creates the provisional resource tree (AEs, containers, ACPs) if
//      missing. Idempotent; never uses ACME's admin originator.
//   2. Every tick: reads grid-sensor/grid-status (written by the dashboard's
//      grid switch), updates the battery, sheds or restarts loads by priority,
//      and writes battery-state and each load-state.
//
// Run:     npm run dev-feed [-- --speed=2 --gap=10 --fault=load-p2-machine]
// Compose: docker compose --profile dev up -d
//
// Env: DEV_FEED_ONEM2M_BASE_URL (default http://localhost:8081), ONEM2M_CSE_PATH,
// ONEM2M_ORIGINATOR (the dashboard's, to grant it access), DEV_FEED_SPEED,
// DEV_FEED_RESTART_GAP_S, DEV_FEED_FAULT, DEV_FEED_IN_CSE_ID.

import { Operation, OneM2MError, ResourceType, createOneM2MClient, type OneM2MClient } from "../lib/onem2m.ts";
import {
  ACP,
  BATTERY,
  GRID,
  LOAD_CONTAINER,
  LOADS,
  containerPath,
  type BatteryStateContent,
  type GridStatus,
  type GridStatusContent,
  type LoadDefinition,
  type LoadState,
  type LoadStateContent,
} from "../lib/gridsense.ts";

// ---- configuration ----

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

function positiveNumber(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be a positive number, got "${value}"`);
  return n;
}

const env = process.env;
const baseUrl = env.DEV_FEED_ONEM2M_BASE_URL || "http://localhost:8081";
const csePath = env.ONEM2M_CSE_PATH || "/~/id-mn/cse-mn";
const dashboardOriginator = env.ONEM2M_ORIGINATOR || "Cgridsense-dashboard";
// Mobius4 forwards the dashboard's requests with the originator rewritten to
// "<IN-CSE-ID>/<originator>" (docs/cse-setup.md, Fix 5), so the ACP names both forms.
const inCseId = env.DEV_FEED_IN_CSE_ID || "/Mobius4";
const speed = positiveNumber(arg("speed") ?? env.DEV_FEED_SPEED, 1, "DEV_FEED_SPEED");
const restartGapS = positiveNumber(arg("gap") ?? env.DEV_FEED_RESTART_GAP_S, 10, "DEV_FEED_RESTART_GAP_S");
const faultLoadId = arg("fault") ?? (env.DEV_FEED_FAULT || undefined);

if (faultLoadId && !LOADS.some((l) => l.id === faultLoadId)) {
  throw new Error(`DEV_FEED_FAULT must be one of ${LOADS.map((l) => l.id).join(", ")}, got "${faultLoadId}"`);
}

const TICK_MS = 1000;
const START_BATTERY_PERCENT = 85;
const CHARGE_PERCENT_PER_S = 0.15;
/** Battery drain per ampere of measured load current, in percent per second. */
const DRAIN_PERCENT_PER_AMP_S = 0.18;
/** Grid OFF: shed a load once the battery falls below its threshold. P1 has none. */
const SHED_BELOW_PERCENT: Record<number, number> = { 3: 40, 2: 25 };
/** How long a load stays RESTARTING (soft start) before it is ON. */
const SOFT_START_S = 3;

const RATED_CURRENT_A: Record<string, number> = {
  "load-p1-coldroom": 2.5,
  "load-p2-machine": 1.8,
  "load-p3-lights": 1.2,
};

// ---- originators: one per stand-in device AE, plus the feed itself for the ACPs ----

const FEED_ORIGINATOR = "Cgridsense-dev-feed";
const originatorOf = (ae: string) => `Cgridsense-${ae}`;
const deviceAEs = [GRID.ae, BATTERY.ae, ...LOADS.map((l) => l.id)];

const client = (originator: string): OneM2MClient => createOneM2MClient({ baseUrl, csePath, originator, timeoutMs: 4000 });
const feed = client(FEED_ORIGINATOR);
const device = Object.fromEntries(deviceAEs.map((ae) => [ae, client(originatorOf(ae))])) as Record<string, OneM2MClient>;

// Structured SP-relative ID of the CSEBase, e.g. /id-mn/cse-mn, used in acpi.
const cseId = csePath.replace(/^\/~/, "");
const acpRef = (name: string) => `${cseId}/${name}`;

// ---- logging ----

const log = (message: string) => console.log(`[dev-feed ${new Date().toISOString().slice(11, 19)}] ${message}`);

// ---- provisioning (idempotent) ----

async function exists(c: OneM2MClient, path: string): Promise<boolean> {
  try {
    await c.retrieve(path);
    return true;
  } catch (error) {
    if (error instanceof OneM2MError && error.notFound) return false;
    throw error;
  }
}

async function ensureAcp(name: string, rules: { acor: string[]; acop: number }[]) {
  const body = {
    pv: { acr: rules },
    pvs: { acr: [{ acor: [FEED_ORIGINATOR, ...deviceAEs.map(originatorOf)], acop: Operation.ALL }] },
  };
  if (await exists(feed, name)) {
    // Keep the rules current, e.g. after ONEM2M_ORIGINATOR changed.
    await feed.update(name, ResourceType.accessControlPolicy, { pv: body.pv });
  } else {
    await feed.create("", ResourceType.accessControlPolicy, { rn: name, ...body });
    log(`created <accessControlPolicy> ${name}`);
  }
}

async function ensureAE(ae: string, labels: string[]) {
  const c = device[ae];
  const acpi = [acpRef(ACP.devices)];
  if (await exists(c, ae)) {
    // ACME requires acpi to be the only attribute in an UPDATE.
    await c.update(ae, ResourceType.AE, { lbl: labels });
    await c.update(ae, ResourceType.AE, { acpi });
  } else {
    await c.create("", ResourceType.AE, { rn: ae, api: "Ngridsense", rr: false, srv: ["3"], lbl: labels, acpi });
    log(`created <AE> ${ae} (originator ${originatorOf(ae)})`);
  }
}

async function ensureContainer(ae: string, container: string, acpNames: string[], mni: number) {
  const c = device[ae];
  const path = `${ae}/${container}`;
  const acpi = acpNames.map(acpRef);
  if (await exists(c, path)) {
    await c.update(path, ResourceType.container, { acpi });
  } else {
    await c.create(ae, ResourceType.container, { rn: container, mni, acpi });
    log(`created <container> ${path}`);
  }
}

async function provision() {
  const dashboard = [dashboardOriginator, `${inCseId}/${dashboardOriginator}`];
  await ensureAcp(ACP.devices, [
    { acor: [FEED_ORIGINATOR, ...deviceAEs.map(originatorOf)], acop: Operation.ALL },
    { acor: dashboard, acop: Operation.RETRIEVE | Operation.DISCOVER },
  ]);
  await ensureAcp(ACP.gridInput, [{ acor: dashboard, acop: Operation.CREATE }]);

  await ensureAE(GRID.ae, ["gridsense/type:grid-sensor"]);
  await ensureAE(BATTERY.ae, ["gridsense/type:battery"]);
  for (const load of LOADS) await ensureAE(load.id, ["gridsense/type:load", `gridsense/priority:${load.priority}`]);

  await ensureContainer(GRID.ae, GRID.container, [ACP.devices, ACP.gridInput], 50);
  await ensureContainer(BATTERY.ae, BATTERY.container, [ACP.devices], 120);
  for (const load of LOADS) await ensureContainer(load.id, LOAD_CONTAINER, [ACP.devices], 120);
}

// ---- simulation state ----

interface FeedLoad {
  def: LoadDefinition;
  rated: number;
  state: LoadState;
  since: number; // sim seconds when the state was entered
}

let simTime = 0;
let grid: GridStatus = "ON";
let batteryPercent = START_BATTERY_PERCENT;
let restartStartedAt: number | null = null;
const loads: FeedLoad[] = [...LOADS]
  .sort((a, b) => a.priority - b.priority)
  .map((def) => ({ def, rated: RATED_CURRENT_A[def.id] ?? 1, state: "ON", since: 0 }));

const label = (l: FeedLoad) => `P${l.def.priority} ${l.def.name}`;

function setState(load: FeedLoad, state: LoadState, reason: string) {
  if (load.state === state) return;
  log(`${label(load)}: ${load.state} -> ${state} (${reason})`);
  load.state = state;
  load.since = simTime;
}

function measuredCurrent(load: FeedLoad): number {
  const noise = 1 + (Math.random() - 0.5) * 0.06;
  switch (load.state) {
    case "ON":
      return load.rated * noise;
    case "RESTARTING": {
      // Inrush, decaying to the rated current over the soft start.
      const progress = Math.min(1, (simTime - load.since) / SOFT_START_S);
      return load.rated * (1.6 - 0.6 * progress) * noise;
    }
    case "OFF":
    case "FAULT":
      return Math.random() * 0.02;
  }
}

const round = (n: number, digits: number) => Number(n.toFixed(digits));

/** Resume from what oneM2M already holds, so a restarted feed carries on. */
async function resume() {
  const [gridLatest, batteryLatest, ...loadLatest] = await Promise.all([
    feed.latestJson<GridStatusContent>(containerPath.grid),
    feed.latestJson<BatteryStateContent>(containerPath.battery),
    ...loads.map((l) => feed.latestJson<LoadStateContent>(containerPath.load(l.def.id))),
  ]);

  if (gridLatest) grid = gridLatest.content.status;
  else await device[GRID.ae].addJson(containerPath.grid, { status: "ON", ts: new Date().toISOString() } satisfies GridStatusContent);

  if (batteryLatest) batteryPercent = batteryLatest.content.percent;
  loads.forEach((load, i) => {
    const latest = loadLatest[i];
    if (latest) load.state = latest.content.state;
  });

  log(`resumed: grid ${grid}, battery ${batteryPercent.toFixed(1)}%, ${loads.map((l) => `${label(l)} ${l.state}`).join(", ")}`);
  if (grid === "ON" && loads.some((l) => l.state !== "ON")) startRestart("resumed with grid ON");
}

function startRestart(reason: string) {
  restartStartedAt = simTime;
  log(`staggered restart P1 -> P2 -> P3, gap ${restartGapS} s (${reason})`);
}

// ---- the Orchestrator stand-in ----

function step(dt: number) {
  simTime += dt;

  // Battery
  if (grid === "ON") {
    batteryPercent = Math.min(100, batteryPercent + CHARGE_PERCENT_PER_S * dt);
  } else {
    const amps = loads.reduce((sum, l) => sum + (l.state === "OFF" || l.state === "FAULT" ? 0 : measuredCurrent(l)), 0);
    batteryPercent = Math.max(0, batteryPercent - DRAIN_PERCENT_PER_AMP_S * amps * dt);
  }

  if (grid === "OFF") {
    // An empty battery stops everything. That is physics, not a policy shed.
    if (batteryPercent <= 0) {
      for (const load of loads) if (load.state !== "OFF") setState(load, "OFF", "battery empty");
      return;
    }
    // Shed lowest priority first. P1 is never shed by policy.
    for (const load of loads) {
      const threshold = SHED_BELOW_PERCENT[load.def.priority];
      if (threshold !== undefined && batteryPercent < threshold && load.state !== "OFF") {
        setState(load, "OFF", `shed: battery ${batteryPercent.toFixed(1)}% < ${threshold}%`);
      }
    }
    return;
  }

  // Grid ON: staggered restart in priority order. Every load, P1 included,
  // goes RESTARTING -> ON, one start every restartGapS to avoid inrush.
  const t0 = restartStartedAt;
  if (t0 === null) return;
  loads.forEach((load, i) => {
    const startAt = t0 + i * restartGapS;
    if (simTime < startAt) return;
    if (load.state !== "RESTARTING" && load.since < startAt) {
      setState(load, "RESTARTING", "grid restored");
    } else if (load.state === "RESTARTING" && simTime - load.since >= SOFT_START_S) {
      if (load.def.id === faultLoadId) setState(load, "FAULT", "injected fault: relay did not switch, no current measured");
      else setState(load, "ON", "soft start complete");
    }
  });
  if (loads.every((l) => (l.state === "ON" || l.state === "FAULT") && l.since >= t0)) {
    log("staggered restart complete");
    restartStartedAt = null;
  }
}

function onGridChange(next: GridStatus) {
  log(`grid ${grid} -> ${next}`);
  grid = next;
  if (next === "OFF") {
    restartStartedAt = null;
    // A load caught mid soft start is carried by the battery. The shedding
    // thresholds then apply as usual, so a grid flicker never drops P1.
    for (const load of loads) if (load.state === "RESTARTING") setState(load, "ON", "grid lost during restart: on battery");
  } else {
    startRestart("grid restored");
  }
}

async function writeState() {
  const ts = new Date().toISOString();
  const voltage = 11.6 + 1.4 * (batteryPercent / 100);
  await Promise.all([
    device[BATTERY.ae].addJson(containerPath.battery, {
      percent: round(batteryPercent, 1),
      voltage: round(voltage, 2),
      ts,
    } satisfies BatteryStateContent),
    ...loads.map((load) =>
      device[load.def.id].addJson(containerPath.load(load.def.id), {
        priority: load.def.priority,
        state: load.state,
        ratedCurrent: load.rated,
        measuredCurrent: round(measuredCurrent(load), 2),
        ts,
      } satisfies LoadStateContent),
    ),
  ]);
}

// ---- main loop ----

let running = true;
let provisioned = false;
let lastError = "";

async function tick() {
  if (!provisioned) {
    await provision();
    await resume();
    provisioned = true;
    log(`running: speed x${speed}, restart gap ${restartGapS} s${faultLoadId ? `, fault injected on ${faultLoadId}` : ""}`);
  }
  const latestGrid = await feed.latestJson<GridStatusContent>(containerPath.grid);
  if (latestGrid && latestGrid.content.status !== grid) onGridChange(latestGrid.content.status);
  step((TICK_MS / 1000) * speed);
  await writeState();
}

async function main() {
  log(`DEV ONLY feed -> ${baseUrl}${csePath}`);
  while (running) {
    const started = Date.now();
    try {
      await tick();
      if (lastError) log("oneM2M reachable again");
      lastError = "";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message !== lastError) log(`error, retrying: ${message}`);
      lastError = message;
      // Resources missing (e.g. the CSE was reset): provision again.
      if (error instanceof OneM2MError && error.notFound) provisioned = false;
      if (!provisioned) await new Promise((r) => setTimeout(r, 4000));
    }
    await new Promise((r) => setTimeout(r, Math.max(0, TICK_MS - (Date.now() - started))));
  }
}

// PID 1 in a container gets SIGTERM from `docker stop`; exit promptly.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    running = false;
    log(`${signal}: stopping`);
    process.exit(0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
