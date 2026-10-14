"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GridStatus, LoadState, StateError, StateSnapshot } from "@/lib/gridsense";

// Client-side state: polls the dashboard's own /api/state (never a CSE) and
// turns differences between snapshots into a timestamped event log.

export type Connection = "connecting" | "connected" | "error";
export type EventLevel = "info" | "ok" | "warn" | "alert";

export interface LogEvent {
  id: number;
  at: string;
  level: EventLevel;
  text: string;
}

const MAX_EVENTS = 100;
const BATTERY_THRESHOLDS = [40, 25];

const loadLevel: Record<LoadState, EventLevel> = { ON: "ok", OFF: "warn", RESTARTING: "info", FAULT: "alert" };
const loadReason: Partial<Record<LoadState, string>> = { FAULT: " (no current measured)" };

/** "(shed)" only when it can be a policy shed: grid down, battery not empty. */
function offReason(next: StateSnapshot): string {
  if (next.grid?.status !== "OFF") return "";
  return next.battery && next.battery.percent <= 0 ? " (battery empty)" : " (shed)";
}

/** Events describing what changed between two snapshots. */
function diff(prev: StateSnapshot | null, next: StateSnapshot): Omit<LogEvent, "id">[] {
  const now = next.fetchedAt;
  if (!prev) {
    const parts = [
      next.grid ? `grid ${next.grid.status}` : "grid: no data",
      next.battery ? `battery ${next.battery.percent.toFixed(0)}%` : "battery: no data",
      ...next.loads.map((l) => `P${l.priority} ${l.state ?? "no data"}`),
    ];
    return [{ at: now, level: "info", text: `Initial state: ${parts.join(", ")}` }];
  }

  const events: Omit<LogEvent, "id">[] = [];
  if (next.grid && next.grid.status !== prev.grid?.status) {
    events.push({
      at: next.grid.ts,
      level: next.grid.status === "OFF" ? "alert" : "ok",
      text: next.grid.status === "OFF" ? "Grid OFF: site running on battery" : "Grid ON: supply restored",
    });
  }

  if (next.battery && prev.battery) {
    for (const t of BATTERY_THRESHOLDS) {
      if (prev.battery.percent >= t && next.battery.percent < t) {
        events.push({ at: next.battery.ts, level: "warn", text: `Battery below ${t}% (${next.battery.percent.toFixed(1)}%)` });
      } else if (prev.battery.percent < t && next.battery.percent >= t) {
        events.push({ at: next.battery.ts, level: "info", text: `Battery back above ${t}%` });
      }
    }
  }

  for (const load of next.loads) {
    const before = prev.loads.find((l) => l.id === load.id);
    if (load.state && load.state !== before?.state) {
      events.push({
        at: load.ts ?? now,
        level: loadLevel[load.state],
        text: `P${load.priority} ${load.name}: ${before?.state ?? "no data"} -> ${load.state}${load.state === "OFF" ? offReason(next) : (loadReason[load.state] ?? "")}`,
      });
    }
  }
  return events;
}

export function useGridsense(intervalMs = 1000) {
  const [snapshot, setSnapshot] = useState<StateSnapshot | null>(null);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [pendingGrid, setPendingGrid] = useState<GridStatus | null>(null);

  const previous = useRef<StateSnapshot | null>(null);
  const lastConnection = useRef<Connection>("connecting");
  const nextId = useRef(1);

  const addEvents = useCallback((items: Omit<LogEvent, "id">[]) => {
    if (!items.length) return;
    const withIds = items.map((e) => ({ ...e, id: nextId.current++ }));
    setEvents((current) => [...withIds.reverse(), ...current].slice(0, MAX_EVENTS));
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      const started = Date.now();
      try {
        const response = await fetch("/api/state", { cache: "no-store", signal: AbortSignal.timeout(4000) });
        const body = (await response.json()) as StateSnapshot | StateError;
        if (!response.ok || "error" in body) throw new Error("error" in body ? body.error : `HTTP ${response.status}`);
        if (stopped) return;

        const items = diff(previous.current, body);
        if (lastConnection.current === "error") items.unshift({ at: body.fetchedAt, level: "ok", text: "Connection to oneM2M restored" });
        addEvents(items);
        previous.current = body;
        lastConnection.current = "connected";
        setSnapshot(body);
        setConnection("connected");
        setError(null);
      } catch (e) {
        if (stopped) return;
        const message = e instanceof Error ? e.message : String(e);
        if (lastConnection.current !== "error") {
          addEvents([{ at: new Date().toISOString(), level: "alert", text: `Connection to oneM2M lost: ${message}` }]);
        }
        lastConnection.current = "error";
        setConnection("error");
        setError(message);
      } finally {
        if (!stopped) timer = setTimeout(poll, Math.max(0, intervalMs - (Date.now() - started)));
      }
    };

    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [intervalMs, addEvents]);

  // The grid switch writes the new grid status into oneM2M; the display only
  // changes once the next snapshot reads it back.
  const setGrid = useCallback(
    async (status: GridStatus) => {
      setPendingGrid(status);
      try {
        const response = await fetch("/api/grid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${response.status}`);
        }
        addEvents([{ at: new Date().toISOString(), level: "info", text: `Grid switch set to ${status} (written to oneM2M)` }]);
      } catch (e) {
        addEvents([{ at: new Date().toISOString(), level: "alert", text: `Grid switch write failed: ${e instanceof Error ? e.message : e}` }]);
      } finally {
        setPendingGrid(null);
      }
    },
    [addEvents],
  );

  return { snapshot, connection, error, events, setGrid, pendingGrid };
}
