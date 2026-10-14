"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import Hud from "@/components/Hud";
import { useGridsense } from "@/lib/useGridsense";
import { togglePref, updatePrefs, useNarrow, useUiPrefs } from "@/lib/uiPrefs";
import type { Insets } from "@/components/factory/FactoryScene";

// WebGL only runs in the browser.
const FactoryScene = dynamic(() => import("@/components/factory/FactoryScene"), {
  ssr: false,
  loading: () => <div className="scene-loading">Loading 3D scene</div>,
});

const NO_INSETS: Insets = { left: 0, right: 0, top: 0, bottom: 0 };

export default function FactoryView() {
  const { snapshot, connection, error, events, setGrid, pendingGrid } = useGridsense(1000);
  const prefs = useUiPrefs();
  const narrow = useNarrow();

  // H scene only, L event log, T theme, Esc leaves scene only.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      const key = e.key.toLowerCase();
      if (key === "h") togglePref("sceneOnly");
      else if (key === "l") togglePref("logOpen");
      else if (key === "t") togglePref("theme");
      else if (key === "escape") updatePrefs({ sceneOnly: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Screen space the panels cover, so the camera centres the factory in the
  // free area (matches the sizes in Hud.module.css).
  const insets: Insets =
    prefs.sceneOnly || narrow ? NO_INSETS : { left: 348, right: prefs.logOpen ? 360 : 12, top: 64, bottom: 52 };

  return (
    <main className="factory">
      <FactoryScene snapshot={snapshot} pendingGrid={pendingGrid} onToggleGrid={setGrid} theme={prefs.theme} insets={insets} />
      <Hud
        snapshot={snapshot}
        connection={connection}
        error={error}
        events={events}
        pendingGrid={pendingGrid}
        onToggleGrid={setGrid}
        prefs={prefs}
      />
    </main>
  );
}
