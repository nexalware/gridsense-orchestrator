"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import type * as THREE from "three";
import type { GridStatus, StateSnapshot } from "@/lib/gridsense";
import type { Theme } from "@/lib/theme";
import { BatteryBank, Building, CeilingLights, ColdRoom, GridSupply, GridSwitch, Machine } from "./parts";
import { PALETTES } from "./palette";

// The virtual factory: devices "installed" in a low-poly scene. It renders the
// state read from oneM2M and writes only one input, the grid switch.

/** Screen pixels covered by HUD panels on each side. */
export interface Insets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

// Default view frames the whole site, pole and grid switch included, for video.
const CAMERA_POSITION: [number, number, number] = [3.2, 15.5, 27.5];
const CAMERA_TARGET: [number, number, number] = [-2.4, 1.8, 0.2];

/**
 * Keeps the factory centred in the area the panels leave free, and scales it
 * to fit: shifts the projection (setViewOffset) instead of moving the camera,
 * so orbiting still pivots on the factory. Eases when panels open or close.
 */
function CameraFit({ insets }: { insets: Insets }) {
  const current = useRef({ x: 0, y: 0, zoom: 1, w: 0, h: 0 });

  useFrame((state, dt) => {
    const camera = state.camera as THREE.PerspectiveCamera;
    const size = state.size;
    const freeW = Math.max(200, size.width - insets.left - insets.right);
    const freeH = Math.max(200, size.height - insets.top - insets.bottom);
    const target = {
      x: (insets.right - insets.left) / 2,
      y: (insets.bottom - insets.top) / 2,
      zoom: Math.min(1.6, Math.max(0.5, Math.min(freeW / 940, freeH / 560))),
    };
    const c = current.current;
    const k = 1 - Math.exp(-6 * dt);
    const resized = c.w !== size.width || c.h !== size.height;
    const moving = Math.abs(target.x - c.x) > 0.3 || Math.abs(target.y - c.y) > 0.3 || Math.abs(target.zoom - c.zoom) > 0.001;
    if (!moving && !resized) return;
    c.x += (target.x - c.x) * k;
    c.y += (target.y - c.y) * k;
    c.zoom += (target.zoom - c.zoom) * k;
    c.w = size.width;
    c.h = size.height;
    camera.setViewOffset(size.width, size.height, c.x, c.y, size.width, size.height);
    camera.zoom = c.zoom;
    camera.updateProjectionMatrix();
  });
  return null;
}

export default function FactoryScene({ snapshot, pendingGrid, onToggleGrid, theme, insets }: {
  snapshot: StateSnapshot | null;
  pendingGrid: GridStatus | null;
  onToggleGrid: (next: GridStatus) => void;
  theme: Theme;
  insets: Insets;
}) {
  const palette = PALETTES[theme];
  const load = (id: string) => snapshot?.loads.find((l) => l.id === id);
  const grid = snapshot?.grid?.status ?? null;

  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: CAMERA_POSITION, fov: 42, near: 0.1, far: 200 }}>
      <color attach="background" args={[palette.background]} />
      <fog attach="fog" args={[palette.background, 40, 85]} />

      <hemisphereLight args={[palette.hemiSky, palette.hemiGround, palette.hemi]} />
      <ambientLight intensity={palette.ambient} />
      <directionalLight
        position={[9, 16, 11]}
        intensity={palette.sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0004}
      />

      <Building palette={palette} />
      <GridSupply status={grid} />
      <GridSwitch status={grid} pending={pendingGrid !== null} onToggle={onToggleGrid} />
      <BatteryBank percent={snapshot?.battery?.percent ?? null} voltage={snapshot?.battery?.voltage ?? null} />
      <ColdRoom load={load("load-p1-coldroom")} />
      <Machine load={load("load-p2-machine")} />
      <CeilingLights load={load("load-p3-lights")} />

      <CameraFit insets={insets} />
      <OrbitControls
        makeDefault
        target={CAMERA_TARGET}
        enableDamping
        dampingFactor={0.08}
        minDistance={7}
        maxDistance={48}
        maxPolarAngle={Math.PI * 0.47}
      />

      {/* Glow on lamps, the live line and lit fixtures (emissive above 1). */}
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.25} intensity={palette.bloom} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </Canvas>
  );
}
