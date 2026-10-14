"use client";

import { useState } from "react";
import type { GridStatus, LoadState, StateSnapshot } from "@/lib/gridsense";
import type { Connection, LogEvent } from "@/lib/useGridsense";
import { updatePrefs, type UiPrefs } from "@/lib/uiPrefs";
import { STATE_COLOR } from "@/components/factory/stateStyle";
import styles from "./Hud.module.css";

// 2D overlay. Displays what /api/state read from oneM2M; its only write is
// the grid switch, which goes to oneM2M through /api/grid.

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour12: false });

// ---- icons (inline, no icon font or CDN) ----

const Icon = {
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
  left: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M10 3.5 5.5 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  right: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="m6 3.5 4.5 4.5L6 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
};

// ---- small pieces ----

function SectionHead({ n, title, tag }: { n: string; title: string; tag?: string }) {
  return (
    <div className={styles.sectionHead}>
      <span className={styles.num}>{n}</span>
      <h3>{title}</h3>
      {tag && <span className={styles.tag}>{tag}</span>}
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

function ThemeButton({ prefs }: { prefs: UiPrefs }) {
  const next = prefs.theme === "dark" ? "light" : "dark";
  return (
    <button type="button" className={styles.iconBtn} onClick={() => updatePrefs({ theme: next })} aria-label={`Switch to ${next} theme (T)`} title={`${next} theme (T)`}>
      {prefs.theme === "dark" ? Icon.sun : Icon.moon}
    </button>
  );
}

// ---- left panel: site status ----

function GridSection({ grid, pending, connection, onToggle }: {
  grid: GridStatus | null;
  pending: GridStatus | null;
  connection: Connection;
  onToggle: (next: GridStatus) => void;
}) {
  const on = grid !== "OFF";
  const tone = grid === "ON" ? styles.live : grid === "OFF" ? styles.dead : "";
  return (
    <section className={`${styles.section} ${styles.gridSection} ${tone}`}>
      <SectionHead n="01" title="Grid supply" tag="grid-sensor" />
      <div className={styles.gridMain}>
        <span className={styles.gridDot} />
        <div>
          <div className={styles.gridValue}>{grid ?? "NO DATA"}</div>
          <div className={styles.sub}>{grid === "ON" ? "Mains live" : grid === "OFF" ? "Outage: site on battery" : "Waiting for data"}</div>
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

function BatterySection({ battery }: { battery: StateSnapshot["battery"] }) {
  const pct = battery?.percent ?? 0;
  const color = !battery ? "var(--faint)" : pct < 25 ? "var(--alert)" : pct < 40 ? "var(--warn)" : "var(--ok)";
  return (
    <section className={styles.section}>
      <SectionHead n="02" title="Battery" tag="battery" />
      <div className={styles.batteryRow}>
        <span className={styles.big}>{battery ? battery.percent.toFixed(1) : "--"}</span>
        <span className={styles.unit}>%</span>
        <span className={styles.voltage}>{battery?.voltage != null ? `${battery.voltage.toFixed(2)} V` : ""}</span>
      </div>
      <div className={styles.bar} aria-label={`Battery ${pct.toFixed(0)}%`}>
        <div className={styles.barFill} style={{ width: `${pct}%`, background: color }} />
        <span className={styles.tick} style={{ left: "25%" }} data-label="25" />
        <span className={styles.tick} style={{ left: "40%" }} data-label="40" />
      </div>
      <p className={styles.note}>On battery: P3 shed below 40%, P2 below 25%. P1 is never shed.</p>
    </section>
  );
}

function LoadsSection({ loads }: { loads: StateSnapshot["loads"] }) {
  return (
    <section className={styles.section}>
      <SectionHead n="03" title="Loads" tag="by priority" />
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

// ---- right panel: event log ----

function EventLog({ events, open }: { events: LogEvent[]; open: boolean }) {
  // Events that arrived while the panel was closed.
  const [seenId, setSeenId] = useState(0);
  const newest = events[0]?.id ?? 0;
  const unseen = open ? 0 : events.filter((e) => e.id > seenId).length;

  return (
    <>
      <aside className={`${styles.pane} ${styles.right} ${open ? "" : styles.closedRight}`} aria-label="Event log" aria-hidden={!open}>
        <div className={styles.paneHead}>
          <h2>Event log</h2>
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
            {Icon.right}
          </button>
        </div>
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
        <button type="button" className={`${styles.tab} ${styles.tabRight}`} onClick={() => updatePrefs({ logOpen: true })} aria-label="Show event log (L)" title="Show event log (L)">
          {Icon.left}
          <span>Event log</span>
          {unseen > 0 && <span className={styles.count}>+{unseen}</span>}
        </button>
      )}
    </>
  );
}

// ---- the overlay ----

export default function Hud({ snapshot, connection, events, pendingGrid, onToggleGrid, prefs }: {
  snapshot: StateSnapshot | null;
  connection: Connection;
  events: LogEvent[];
  pendingGrid: GridStatus | null;
  onToggleGrid: (next: GridStatus) => void;
  prefs: UiPrefs;
}) {
  if (prefs.sceneOnly) {
    return (
      <div className={styles.sceneBar}>
        <button type="button" className={styles.textBtn} onClick={() => updatePrefs({ sceneOnly: false })}>
          Show panels <kbd>H</kbd>
        </button>
        <ThemeButton prefs={prefs} />
      </div>
    );
  }

  return (
    <div className={styles.hud}>
      <header className={styles.topBar}>
        <span className={styles.brand}>GridSense</span>
        <div className={styles.tools}>
          <ThemeButton prefs={prefs} />
          <button type="button" className={styles.iconBtn} onClick={() => updatePrefs({ sceneOnly: true })} aria-label="Scene only (H)" title="Scene only (H)">
            {Icon.expand}
          </button>
        </div>
      </header>

      {/* Only while the connection is down: the panels then show the last state read. */}
      {connection === "error" && (
        <div className={styles.offline} role="status">
          oneM2M unreachable: showing the last state read
        </div>
      )}

      <aside className={`${styles.pane} ${styles.left} ${prefs.railOpen ? "" : styles.closedLeft}`} aria-label="Site status" aria-hidden={!prefs.railOpen}>
        <div className={styles.paneHead}>
          <h2>Site status</h2>
          <button type="button" className={styles.iconBtn} onClick={() => updatePrefs({ railOpen: false })} aria-label="Collapse site status (P)" title="Collapse (P)">
            {Icon.left}
          </button>
        </div>
        <div className={styles.paneBody}>
          <GridSection grid={snapshot?.grid?.status ?? null} pending={pendingGrid} connection={connection} onToggle={onToggleGrid} />
          <BatterySection battery={snapshot?.battery ?? null} />
          <LoadsSection loads={snapshot?.loads ?? []} />
        </div>
      </aside>
      {!prefs.railOpen && (
        <button type="button" className={`${styles.tab} ${styles.tabLeft}`} onClick={() => updatePrefs({ railOpen: true })} aria-label="Show site status (P)" title="Show site status (P)">
          <span>Site status</span>
          {Icon.right}
        </button>
      )}

      <EventLog events={events} open={prefs.logOpen} />
    </div>
  );
}
