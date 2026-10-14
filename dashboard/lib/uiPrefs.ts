"use client";

import { useSyncExternalStore } from "react";
import { ACCENTS, PREFS_KEY, type Accent, type Theme } from "@/lib/theme";

// Per-browser display preferences: theme, accent colour, event log open or
// closed, and "scene only" (all panels hidden, for recording). Kept in
// localStorage; everything still works if storage is unavailable.

export { ACCENTS, type Accent, type Theme };

export interface UiPrefs {
  theme: Theme;
  accent: Accent;
  logOpen: boolean;
  sceneOnly: boolean;
}

const DEFAULTS: UiPrefs = { theme: "dark", accent: "amber", logOpen: true, sceneOnly: false };

let prefs: UiPrefs = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function load(): UiPrefs {
  let stored: Partial<UiPrefs> = {};
  try {
    stored = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<UiPrefs>;
  } catch {
    // storage blocked or corrupt: defaults
  }
  const next: UiPrefs = {
    theme: stored.theme === "light" ? "light" : "dark",
    accent: stored.accent && stored.accent in ACCENTS ? stored.accent : DEFAULTS.accent,
    logOpen: stored.logOpen ?? DEFAULTS.logOpen,
    // Scene-only is a per-visit mode; ?view=scene opens the page in it.
    sceneOnly: new URLSearchParams(window.location.search).get("view") === "scene",
  };
  return next;
}

function apply(p: UiPrefs) {
  const root = document.documentElement;
  root.dataset.theme = p.theme;
  root.style.setProperty("--accent", ACCENTS[p.accent]);
}

function getSnapshot(): UiPrefs {
  if (!loaded) {
    loaded = true;
    prefs = load();
    apply(prefs);
  }
  return prefs;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updatePrefs(change: Partial<UiPrefs>) {
  prefs = { ...getSnapshot(), ...change };
  apply(prefs);
  try {
    // Scene-only is not persisted: a reload always shows the panels.
    localStorage.setItem(PREFS_KEY, JSON.stringify({ theme: prefs.theme, accent: prefs.accent, logOpen: prefs.logOpen }));
  } catch {
    // not persisted; the change still applies to this page
  }
  listeners.forEach((l) => l());
}

export function useUiPrefs(): UiPrefs {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULTS);
}

/** Flip a boolean preference, or the theme, from the current value. */
export function togglePref(key: "sceneOnly" | "logOpen" | "theme") {
  const current = getSnapshot();
  if (key === "theme") updatePrefs({ theme: current.theme === "dark" ? "light" : "dark" });
  else updatePrefs({ [key]: !current[key] });
}

const NARROW = "(max-width: 900px)";

/** True on narrow screens, where the panels stack instead of overlaying. */
export function useNarrow(): boolean {
  return useSyncExternalStore(
    (listener) => {
      const mq = window.matchMedia(NARROW);
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    },
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
}
