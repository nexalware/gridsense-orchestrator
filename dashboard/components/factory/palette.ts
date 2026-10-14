import type { Theme } from "@/lib/theme";

/** Scene colours and light levels per UI theme. State colours never change. */
export interface ScenePalette {
  background: string;
  ground: string;
  floor: string;
  marking: string;
  wall: string;
  steel: string;
  hemiSky: string;
  hemiGround: string;
  hemi: number;
  ambient: number;
  sun: number;
  bloom: number;
}

export const PALETTES: Record<Theme, ScenePalette> = {
  dark: {
    background: "#070b14",
    ground: "#0f1622",
    floor: "#4b5668",
    marking: "#eab308",
    wall: "#34425a",
    steel: "#64748b",
    hemiSky: "#dbe4ff",
    hemiGround: "#1e293b",
    hemi: 1.05,
    ambient: 0.22,
    sun: 1.5,
    bloom: 1.15,
  },
  light: {
    background: "#e8edf4",
    ground: "#d3dbe6",
    floor: "#c3cbd7",
    marking: "#ca8a04",
    wall: "#a7b3c4",
    steel: "#7c8899",
    hemiSky: "#ffffff",
    hemiGround: "#94a3b8",
    hemi: 1.35,
    ambient: 0.35,
    sun: 1.9,
    bloom: 0.5,
  },
};
