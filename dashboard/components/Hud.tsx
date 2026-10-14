"use client";

import { useState } from "react";
import type { GridStatus, LoadState, StateSnapshot } from "@/lib/gridsense";
import type { Connection, LogEvent } from "@/lib/useGridsense";
import { ACCENTS, updatePrefs, type Accent, type UiPrefs } from "@/lib/uiPrefs";
import { STATE_COLOR } from "@/components/factory/stateStyle";
import styles from "./Hud.module.css";

// 2D overlay. Displays what /api/state read from oneM2M; its only write is
// the grid switch, which goes to oneM2M through /api/grid.

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour12: false });

// ---- icons (inline, no icon font or CDN) ----

const Icon = {
  brand: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 1.8 20.8 6.9v10.2L12 22.2 3.2 17.1V6.9Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13.2 5.5 8.4 12.6h3.3l-1.1 5.9 5-7.4h-3.4Z" fill="currentColor" />
    </svg>
  ),
  factory: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 14V7l3.5 2V7l3.5 2V4h2.5v10Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  ),
  table: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2.5 3.5h11v9h-11ZM2.5 6.5h11M6.5 6.5v6" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  sliders: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 4h10M3 8h10M3 12h10" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="6" cy="4" r="1.5" fill="currentColor" />
      <circle cx="10" cy="8" r="1.5" fill="currentColor" />
      <circle cx="5" cy="12" r="1.5" fill="currentColor" />
    </svg>
  ),
  spark: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 1.5c.4 3.6 1.9 5.1 5.5 5.5-3.6.4-5.1 1.9-5.5 7-.4-5.1-1.9-6.6-5.5-7 3.6-.4 5.1-1.9 5.5-5.5Z" fill="currentColor" />
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="3" fill="currentColor" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M13.5 10.2A5.8 5.8 0 0 1 5.8 2.5a5.8 5.8 0 1 0 7.7 7.7Z" fill="currentColor" />
    </svg>
  ),
  expand: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  log: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M5.5 4h8M5.5 8h8M5.5 12h8" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="2.8" cy="4" r="1" fill="currentColor" />
      <circle cx="2.8" cy="8" r="1" fill="currentColor" />
      <circle cx="2.8" cy="12" r="1" fill="currentColor" />
    </svg>
  ),
  chevron: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="m6 3.5 4.5 4.5L6 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
};

// ---- small pieces ----

function CardHead({ n, title, children }: { n: string; title: string; children?: React.ReactNode }) {
  return (
    <div className={styles.cardHead}>
      <span className={styles.num}>{n}</span>
      <h2>{title}</h2>
      {children && <div className={styles.cardTools}>{children}</div>}
    </div>
  );
}

function StateChip({ state }: { state: LoadState | null }) {
  const color = STATE_COLOR[state ?? "UNKNOWN"];
  return (
    <span className={`${styles.chip} ${state === "RESTARTING" ? styles.pulse : ""} ${state === "FAULT" ? styles.blink : ""}`} style={{ "--c": color } as React.CSSProperties}>
      {state ?? "NO DATA"}
    </span>
  );
}

const connectionText: Record<Connection, string> = {
  connecting: "Connecting",
  connected: "oneM2M live",
  error: "oneM2M unreachable",
};

function ConnectionPill({ connection, error, snapshot }: { connection: Connection; error: string | null; snapshot: StateSnapshot | null }) {
  return (
    <div className={`${styles.conn} ${styles[connection]}`} title={error ?? "Polling /api/state once per second"}>
      <span className={styles.dot} />
      <span>{connectionText[connection]}</span>
      {snapshot && <span className={styles.mono}>{time(snapshot.fetchedAt)}</span>}
    </div>
  );
}

function ThemeButton({ prefs }: { prefs: UiPrefs }) {
  const next = prefs.theme === "dark" ? "light" : "dark";
  return (
    <button type="button" className={styles.iconBtn} onClick={() => updatePrefs({ theme: next })} aria-label={`Switch to ${next} theme (T)`} title={`${next} theme (T)`}>
      {prefs.theme === "dark" ? Icon.sun : Icon.moon}
    </button>
  );
}

// ---- header ----

function TopBar({ prefs, connection, error, snapshot }: { prefs: UiPrefs; connection: Connection; error: string | null; snapshot: StateSnapshot | null }) {
  return (
    <header className={styles.topBar}>
      <div className={styles.brand}>
        <span className={styles.brandMark}>{Icon.brand}</span>
        <span className={styles.brandName}>GridSense</span>
        <em>· virtual factory</em>
      </div>

      {/* Planned pages get their own routes under app/ later. */}
      <nav className={styles.seg} aria-label="Pages">
        <span className={styles.segItem} aria-current="page">
          {Icon.factory}Factory
        </span>
        <span className={styles.segItem} aria-disabled="true" title="Planned">
          {Icon.table}Status<span className={styles.soon}>planned</span>
        </span>
        <span className={styles.segItem} aria-disabled="true" title="Planned">
          {Icon.sliders}Priorities<span className={styles.soon}>planned</span>
        </span>
        <span className={styles.segItem} aria-disabled="true" title="Planned">
          {Icon.spark}AI approvals<span className={styles.soon}>planned</span>
        </span>
      </nav>

      <div className={styles.tools}>
        <ConnectionPill connection={connection} error={error} snapshot={snapshot} />
        <div className={styles.swatches} role="radiogroup" aria-label="Accent colour">
          {(Object.keys(ACCENTS) as Accent[]).map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={prefs.accent === a}
              aria-label={`${a} accent`}
              title={a}
              style={{ "--sw": ACCENTS[a] } as React.CSSProperties}
              onClick={() => updatePrefs({ accent: a })}
            />
          ))}
        </div>
        <ThemeButton prefs={prefs} />
        <button type="button" className={styles.iconBtn} onClick={() => updatePrefs({ sceneOnly: true })} aria-label="Scene only (H)" title="Scene only (H)">
          {Icon.expand}
        </button>
      </div>
    </header>
  );
}

// ---- left rail ----

function GridCard({ grid, pending, connection, onToggle }: {
  grid: GridStatus | null;
  pending: GridStatus | null;
  connection: Connection;
  onToggle: (next: GridStatus) => void;
}) {
  const on = grid !== "OFF";
  const tone = grid === "ON" ? styles.live : grid === "OFF" ? styles.dead : "";
  return (
    <section className={`${styles.card} ${styles.gridCard} ${tone}`}>
      <CardHead n="01" title="Grid supply">
        <span className={styles.tag}>grid-sensor</span>
      </CardHead>
      <div className={styles.gridMain}>
        <span className={styles.gridOrb} />
        <div>
          <div className={styles.gridValue}>{grid ?? "NO DATA"}</div>
          <div className={styles.gridSub}>{grid === "ON" ? "Mains live" : grid === "OFF" ? "Outage: site on battery" : "Waiting for data"}</div>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        className={styles.toggle}
        disabled={pending !== null || connection !== "connected"}
        onClick={() => onToggle(on ? "OFF" : "ON")}
      >
        <span className={styles.track}>
          <span className={styles.knob} />
        </span>
        <span>{pending ? "Writing to oneM2M..." : on ? "Grid switch: cut supply" : "Grid switch: restore supply"}</span>
      </button>
      <p className={styles.note}>Acts as the grid sensor: writes grid-status to oneM2M. It changes no load.</p>
    </section>
  );
}

function BatteryCard({ battery }: { battery: StateSnapshot["battery"] }) {
  const pct = battery?.percent ?? 0;
  const color = !battery ? "var(--faint)" : pct < 25 ? "var(--alert)" : pct < 40 ? "var(--warn)" : "var(--ok)";
  return (
    <section className={styles.card}>
      <CardHead n="02" title="Battery">
        <span className={styles.tag}>battery</span>
      </CardHead>
      <div className={styles.batteryRow}>
        <span className={styles.big}>{battery ? battery.percent.toFixed(1) : "--"}</span>
        <span className={styles.unit}>%</span>
        <span className={`${styles.mono} ${styles.right}`}>{battery?.voltage != null ? `${battery.voltage.toFixed(2)} V` : ""}</span>
      </div>
      <div className={styles.bar} aria-label={`Battery ${pct.toFixed(0)}%`}>
        <div className={styles.barFill} style={{ width: `${pct}%`, background: color, boxShadow: `0 0 12px ${color}` }} />
        <span className={styles.tick} style={{ left: "25%" }} data-label="25" />
        <span className={styles.tick} style={{ left: "40%" }} data-label="40" />
      </div>
      <p className={styles.note}>On battery: P3 shed below 40%, P2 below 25%. P1 is never shed.</p>
    </section>
  );
}

function LoadsCard({ loads }: { loads: StateSnapshot["loads"] }) {
  return (
    <section className={styles.card}>
      <CardHead n="03" title="Loads">
        <span className={styles.tag}>by priority</span>
      </CardHead>
      <ul className={styles.loads}>
        {loads.map((load) => (
          <li key={load.id}>
            <span className={styles.pri}>P{load.priority}</span>
            <span className={styles.loadName}>
              {load.name}
              {load.priority === 1 && <small>critical</small>}
            </span>
            <StateChip state={load.state} />
            <span className={styles.amps}>{load.measuredCurrent != null ? `${load.measuredCurrent.toFixed(2)} A` : "--"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---- event log drawer ----

function EventDrawer({ events, open }: { events: LogEvent[]; open: boolean }) {
  // Events that arrived while the drawer was closed.
  const [seenId, setSeenId] = useState(0);
  const newest = events[0]?.id ?? 0;
  const unseen = open ? 0 : events.filter((e) => e.id > seenId).length;

  return (
    <>
      <aside className={`${styles.card} ${styles.drawer} ${open ? "" : styles.drawerClosed}`} aria-label="Event log" aria-hidden={!open}>
        <CardHead n="04" title="Event log">
          <span className={styles.count}>{events.length}</span>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => {
              setSeenId(newest);
              updatePrefs({ logOpen: false });
            }}
            aria-label="Collapse event log (L)"
            title="Collapse (L)"
          >
            {Icon.chevron}
          </button>
        </CardHead>
        <ol className={styles.log}>
          {events.length === 0 && <li className={styles.empty}>Waiting for the first snapshot...</li>}
          {events.map((e) => (
            <li key={e.id} className={styles[e.level]}>
              <time dateTime={e.at}>{time(e.at)}</time>
              <span>{e.text}</span>
            </li>
          ))}
        </ol>
      </aside>
      {!open && (
        <button type="button" className={styles.logTab} onClick={() => updatePrefs({ logOpen: true })} aria-label="Show event log (L)" title="Show event log (L)">
          {Icon.log}
          <span>Event log</span>
          {unseen > 0 && <span className={styles.count}>+{unseen}</span>}
        </button>
      )}
    </>
  );
}

// ---- the overlay ----

export default function Hud({ snapshot, connection, error, events, pendingGrid, onToggleGrid, prefs }: {
  snapshot: StateSnapshot | null;
  connection: Connection;
  error: string | null;
  events: LogEvent[];
  pendingGrid: GridStatus | null;
  onToggleGrid: (next: GridStatus) => void;
  prefs: UiPrefs;
}) {
  if (prefs.sceneOnly) {
    return (
      <div className={styles.sceneBar}>
        <span className={`${styles.dot} ${styles[connection]}`} title={connectionText[connection]} />
        <button type="button" className={styles.pillBtn} onClick={() => updatePrefs({ sceneOnly: false })}>
          Show panels <kbd>H</kbd>
        </button>
        <ThemeButton prefs={prefs} />
      </div>
    );
  }

  return (
    <div className={styles.hud} data-log={prefs.logOpen ? "open" : "closed"}>
      <TopBar prefs={prefs} connection={connection} error={error} snapshot={snapshot} />

      <div className={styles.rail}>
        <GridCard grid={snapshot?.grid?.status ?? null} pending={pendingGrid} connection={connection} onToggle={onToggleGrid} />
        <BatteryCard battery={snapshot?.battery ?? null} />
        <LoadsCard loads={snapshot?.loads ?? []} />
      </div>

      <EventDrawer events={events} open={prefs.logOpen} />

      <footer className={styles.caption}>
        <span className={styles.fig}>Fig 1</span>
        <span>Site virtual factory, rendered from oneM2M. Decisions are made by the Orchestrator, not here.</span>
        <span className={styles.keys}>drag orbit · scroll zoom · H scene only · L log · T theme</span>
      </footer>
    </div>
  );
}
