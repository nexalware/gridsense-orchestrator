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
  /** Filmic for dark; linear for light, so a white background stays white. */
  toneMapping: "aces" | "linear";
}

export const PALETTES: Record<Theme, ScenePalette> = {
  dark: {
    background: "#000000",
    ground: "#050505",
    floor: "#464b53",
    marking: "#eab308",
    wall: "#2b3038",
    steel: "#5e646d",
    hemiSky: "#e8ecf2",
    hemiGround: "#14161a",
    hemi: 1.05,
    ambient: 0.22,
    sun: 1.5,
    bloom: 1.15,
    toneMapping: "aces",
  },
  light: {
    background: "#ffffff",
    ground: "#f5f6f8",
    floor: "#c9ced6",
    marking: "#ca8a04",
    wall: "#aab2be",
    steel: "#7f8894",
    hemiSky: "#ffffff",
    hemiGround: "#9aa3af",
    hemi: 1.35,
    ambient: 0.35,
    sun: 1.9,
    bloom: 0.5,
    toneMapping: "linear",
  },
};
