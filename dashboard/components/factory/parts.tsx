"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, useCursor } from "@react-three/drei";
import * as THREE from "three";
import type { GridStatus, LoadSnapshot, LoadState } from "@/lib/gridsense";
import { colorOf, lampIntensity, runLevel } from "./stateStyle";
import type { ScenePalette } from "./palette";
import styles from "./scene.module.css";

// Low-poly factory parts built from primitives only (no external assets).
// Every part renders the state it is given. None of them decides anything.

type Vec3 = [number, number, number];

/** Exponential smoothing factor for a frame of `dt` seconds. */
const ease = (dt: number, rate = 4) => 1 - Math.exp(-rate * dt);

// ---- labels and indicators ----

export function Label({ position, title, badge, badgeColor, detail }: {
  position: Vec3;
  title: string;
  badge?: string;
  badgeColor?: string;
  detail?: string;
}) {
  return (
    <Html position={position} center zIndexRange={[10, 0]} className={styles.labelWrap}>
      <div className={styles.label}>
        <span className={styles.labelTitle}>{title}</span>
        {badge && (
          <span className={styles.badge} style={{ background: badgeColor }}>
            {badge}
          </span>
        )}
        {detail && <span className={styles.labelDetail}>{detail}</span>}
      </div>
    </Html>
  );
}

export function StatusLamp({ state, position, radius = 0.16 }: { state: LoadState | null; position: Vec3; radius?: number }) {
  const material = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const m = material.current;
    if (!m) return;
    const color = colorOf(state);
    m.color.set(state === "OFF" ? "#1e293b" : color);
    m.emissive.set(color);
    m.emissiveIntensity = lampIntensity(state, clock.elapsedTime);
  });
  return (
    <mesh position={position}>
      <sphereGeometry args={[radius, 20, 14]} />
      <meshStandardMaterial ref={material} toneMapped={false} roughness={0.3} />
    </mesh>
  );
}

function loadDetail(load: LoadSnapshot | undefined): string | undefined {
  if (!load || load.measuredCurrent === null) return undefined;
  return `${load.measuredCurrent.toFixed(2)} A`;
}

// ---- building ----

export function Building({ palette }: { palette: ScenePalette }) {
  const { wall, steel } = palette;
  return (
    <group>
      {/* ground and floor slab */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.21, 0]} receiveShadow>
        <planeGeometry args={[90, 90]} />
        <meshStandardMaterial color={palette.ground} roughness={1} />
      </mesh>
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <boxGeometry args={[16, 0.2, 10]} />
        <meshStandardMaterial color={palette.floor} roughness={0.9} />
      </mesh>
      {/* floor markings: walkway */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 0.2]}>
        <planeGeometry args={[14, 0.08]} />
        <meshStandardMaterial color={palette.marking} roughness={0.8} />
      </mesh>

      {/* back wall, left wall (with the grid entry), low right wall */}
      <mesh position={[0, 2.1, -5]} castShadow receiveShadow>
        <boxGeometry args={[16, 4.2, 0.2]} />
        <meshStandardMaterial color={wall} roughness={0.85} />
      </mesh>
      <mesh position={[-8, 2.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 4.2, 10]} />
        <meshStandardMaterial color={wall} roughness={0.85} />
      </mesh>
      <mesh position={[8, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 1, 10]} />
        <meshStandardMaterial color={wall} roughness={0.85} />
      </mesh>

      {/* columns and roof trusses (open roof so the inside stays visible) */}
      {[-8, -4, 0, 4, 8].map((x) =>
        // Front row: corner columns only, so nothing blocks the view in.
        (x === -8 || x === 8 ? [-5, 5] : [-5]).map((z) => (
          <mesh key={`${x}${z}`} position={[x, 2.2, z]} castShadow>
            <boxGeometry args={[0.28, 4.4, 0.28]} />
            <meshStandardMaterial color={steel} metalness={0.4} roughness={0.5} />
          </mesh>
        )),
      )}
      {[-8, -4, 0, 4, 8].map((x) => (
        <mesh key={x} position={[x, 4.35, 0]} castShadow>
          <boxGeometry args={[0.22, 0.22, 10.2]} />
          <meshStandardMaterial color={steel} metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
      {[-5].map((z) => (
        <mesh key={z} position={[0, 4.4, z]}>
          <boxGeometry args={[16.2, 0.14, 0.14]} />
          <meshStandardMaterial color={steel} metalness={0.4} roughness={0.5} />
        </mesh>
      ))}

      {/* a few crates and a workbench, for scale */}
      <mesh position={[-6.9, 0.45, -3.9]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.9, 0.9]} />
        <meshStandardMaterial color="#8b6b43" roughness={0.9} />
      </mesh>
      <mesh position={[-5.9, 0.35, -4.0]} rotation-y={0.4} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.7, 0.7]} />
        <meshStandardMaterial color="#7c5f3b" roughness={0.9} />
      </mesh>
      <mesh position={[-1.2, 0.9, -3.9]} castShadow receiveShadow>
        <boxGeometry args={[3, 0.12, 1.2]} />
        <meshStandardMaterial color="#475569" roughness={0.6} />
      </mesh>
      {[-2.5, 0.1].map((x) => (
        <mesh key={x} position={[x, 0.42, -3.9]} castShadow>
          <boxGeometry args={[0.1, 0.84, 1.1]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
      ))}
    </group>
  );
}

// ---- grid supply: pole, line into the building, entry box ----

const POLE: Vec3 = [-13, 0, -1.5];
const POLE_TOP: Vec3 = [-13, 6.1, -1.5];
const WALL_ENTRY: Vec3 = [-8.15, 3.7, -1.5];

export function GridSupply({ status }: { status: GridStatus | null }) {
  const live = status === "ON";
  const curve = useMemo(() => {
    const a = new THREE.Vector3(...POLE_TOP);
    const b = new THREE.Vector3(...WALL_ENTRY);
    const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, -0.9, 0));
    return new THREE.CatmullRomCurve3([a, mid, b]);
  }, []);
  const cable = useRef<THREE.MeshStandardMaterial>(null);
  const pulses = useRef<THREE.Group>(null);
  const insulator = useRef<THREE.MeshStandardMaterial>(null);
  const point = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }, dt) => {
    const k = ease(dt, 5);
    if (cable.current) {
      cable.current.emissiveIntensity += ((live ? 1.6 : 0) - cable.current.emissiveIntensity) * k;
    }
    if (insulator.current) {
      insulator.current.emissiveIntensity += ((live ? 2 : 0) - insulator.current.emissiveIntensity) * k;
    }
    const group = pulses.current;
    if (group) {
      group.visible = live;
      group.children.forEach((child, i) => {
        const u = (clock.elapsedTime * 0.45 + i / group.children.length) % 1;
        curve.getPointAt(u, point);
        child.position.copy(point);
      });
    }
  });

  return (
    <group>
      {/* pole and crossarm */}
      <mesh position={[POLE[0], 3.1, POLE[2]]} castShadow>
        <cylinderGeometry args={[0.16, 0.22, 6.2, 10]} />
        <meshStandardMaterial color="#6b4f35" roughness={0.9} />
      </mesh>
      <mesh position={[POLE[0], 5.8, POLE[2]]} castShadow>
        <boxGeometry args={[0.16, 0.16, 2.2]} />
        <meshStandardMaterial color="#6b4f35" roughness={0.9} />
      </mesh>
      <mesh position={POLE_TOP}>
        <cylinderGeometry args={[0.12, 0.12, 0.3, 10]} />
        <meshStandardMaterial ref={insulator} color="#e2e8f0" emissive="#facc15" emissiveIntensity={0} toneMapped={false} />
      </mesh>
      {/* the line into the building */}
      <mesh castShadow>
        <tubeGeometry args={[curve, 48, 0.05, 8, false]} />
        <meshStandardMaterial ref={cable} color={live ? "#a16207" : "#1f2937"} emissive="#facc15" emissiveIntensity={0} toneMapped={false} />
      </mesh>
      <group ref={pulses}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.11, 12, 8]} />
            <meshBasicMaterial color="#fde68a" toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* entry box on the wall */}
      <mesh position={[WALL_ENTRY[0] - 0.12, WALL_ENTRY[1] - 0.2, WALL_ENTRY[2]]} castShadow>
        <boxGeometry args={[0.25, 0.7, 0.6]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.5} roughness={0.4} />
      </mesh>
      <Label
        position={[POLE[0], 7.0, POLE[2]]}
        title="Grid supply"
        badge={status === null ? "NO DATA" : live ? "LIVE" : "DEAD"}
        badgeColor={status === null ? "#64748b" : live ? "#ca8a04" : "#b91c1c"}
      />
    </group>
  );
}

// ---- grid switch: the clickable grid sensor input ----

export function GridSwitch({ status, pending, onToggle }: {
  status: GridStatus | null;
  pending: boolean;
  onToggle: (next: GridStatus) => void;
}) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered && !pending);
  const lever = useRef<THREE.Group>(null);
  const light = useRef<THREE.MeshStandardMaterial>(null);
  const on = status !== "OFF";

  useFrame(({ clock }, dt) => {
    if (lever.current) {
      const target = on ? -0.6 : 0.6;
      lever.current.rotation.x += (target - lever.current.rotation.x) * ease(dt, 8);
    }
    const m = light.current;
    if (m) {
      const color = pending ? "#f59e0b" : on ? "#22c55e" : "#ef4444";
      m.color.set(color);
      m.emissive.set(color);
      m.emissiveIntensity = pending ? (Math.sin(clock.elapsedTime * 12) > 0 ? 2.2 : 0.2) : 1.8;
    }
  });

  const position: Vec3 = [-10.2, 0, 3.6];
  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        if (!pending) onToggle(on ? "OFF" : "ON");
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <mesh position={[0, 0.7, 0]} castShadow>
        <boxGeometry args={[0.14, 1.4, 0.14]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.65, 0]} scale={hovered ? 1.06 : 1} castShadow>
        <boxGeometry args={[0.9, 1.0, 0.3]} />
        <meshStandardMaterial color={hovered ? "#e2e8f0" : "#a8b4c5"} metalness={0.45} roughness={0.4} />
      </mesh>
      <group ref={lever} position={[0, 1.6, 0.17]}>
        <mesh position={[0, 0.22, 0.05]} castShadow>
          <boxGeometry args={[0.12, 0.44, 0.1]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.3} roughness={0.4} />
        </mesh>
      </group>
      <mesh position={[0.3, 2.0, 0.17]}>
        <sphereGeometry args={[0.08, 14, 10]} />
        <meshStandardMaterial ref={light} toneMapped={false} />
      </mesh>
      <Label
        position={[0, 2.75, 0]}
        title="Grid switch"
        badge={pending ? "WRITING..." : `click: grid ${on ? "OFF" : "ON"}`}
        badgeColor={pending ? "#b45309" : "#1d4ed8"}
      />
    </group>
  );
}

// ---- battery bank ----

const CELL_X = [-6.75, -5.85, -4.95, -4.05];
const CELL_HEIGHT = 1.8;

export function BatteryBank({ percent, voltage }: { percent: number | null; voltage: number | null }) {
  const fills = useRef<(THREE.Group | null)[]>([]);
  const fillMaterials = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const shown = useRef(percent ?? 0);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame((_, dt) => {
    shown.current += ((percent ?? 0) - shown.current) * ease(dt, 3);
    const fraction = Math.max(0.02, Math.min(1, shown.current / 100));
    fills.current.forEach((g) => {
      if (g) g.scale.y = fraction;
    });
    // Green at 80% and above, through amber, to red at 10% and below.
    const hue = Math.max(0, Math.min(1, (shown.current - 10) / 70)) * 0.33;
    color.setHSL(hue, 0.85, 0.48);
    fillMaterials.current.forEach((m) => {
      if (!m) return;
      m.color.copy(color);
      m.emissive.copy(color);
      m.emissiveIntensity = percent === null ? 0 : 0.55;
    });
  });

  return (
    <group position={[0, 0, 1.6]}>
      {/* rack */}
      <mesh position={[-5.4, 0.08, 0]} receiveShadow castShadow>
        <boxGeometry args={[4.0, 0.16, 1.1]} />
        <meshStandardMaterial color="#334155" metalness={0.4} />
      </mesh>
      {CELL_X.map((x, i) => (
        <group key={x} position={[x, 0.16, 0]}>
          {/* shell */}
          <mesh position={[0, CELL_HEIGHT / 2, 0]} castShadow>
            <boxGeometry args={[0.76, CELL_HEIGHT, 0.8]} />
            <meshPhysicalMaterial color="#cbd5e1" transparent opacity={0.22} roughness={0.15} />
          </mesh>
          {/* fill, scaled with the battery level */}
          <group
            ref={(g) => {
              fills.current[i] = g;
            }}
          >
            <mesh position={[0, (CELL_HEIGHT - 0.06) / 2, 0]}>
              <boxGeometry args={[0.64, CELL_HEIGHT - 0.06, 0.68]} />
              <meshStandardMaterial
                ref={(m) => {
                  fillMaterials.current[i] = m;
                }}
                toneMapped={false}
              />
            </mesh>
          </group>
          {/* terminals */}
          {[-0.17, 0.17].map((dx) => (
            <mesh key={dx} position={[dx, CELL_HEIGHT + 0.06, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.12, 8]} />
              <meshStandardMaterial color={dx < 0 ? "#dc2626" : "#0f172a"} />
            </mesh>
          ))}
        </group>
      ))}
      <Label
        position={[-5.4, 2.75, 0]}
        title="Battery bank"
        badge={percent === null ? "NO DATA" : `${percent.toFixed(0)}%`}
        badgeColor={percent === null ? "#64748b" : percent < 25 ? "#b91c1c" : percent < 40 ? "#c2410c" : "#15803d"}
        detail={voltage !== null ? `${voltage.toFixed(2)} V` : undefined}
      />
    </group>
  );
}

// ---- P1 cold room ----

export function ColdRoom({ load }: { load: LoadSnapshot | undefined }) {
  const state = load?.state ?? null;
  const glass = useRef<THREE.MeshStandardMaterial>(null);
  const body = useRef<THREE.MeshStandardMaterial>(null);
  const fan = useRef<THREE.Group>(null);
  const spin = useRef(0);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const level = runLevel(state, t);
    if (glass.current) {
      glass.current.emissiveIntensity += (level * 1.4 - glass.current.emissiveIntensity) * ease(dt, 5);
    }
    if (body.current) {
      body.current.emissiveIntensity = state === "FAULT" ? lampIntensity("FAULT", t) * 0.12 : 0;
    }
    spin.current += (level * 14 - spin.current) * ease(dt, 1.5);
    if (fan.current) fan.current.rotation.y += spin.current * dt;
  });

  return (
    <group position={[5.6, 0, -3.2]}>
      <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.6, 3, 3]} />
        <meshStandardMaterial ref={body} color="#dbe6f3" emissive="#ef4444" emissiveIntensity={0} roughness={0.5} />
      </mesh>
      {/* door and window on the front face */}
      <mesh position={[-0.6, 1.15, 1.51]}>
        <boxGeometry args={[1.1, 2.1, 0.04]} />
        <meshStandardMaterial color="#b8c7d9" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0.95, 1.9, 1.51]}>
        <boxGeometry args={[0.9, 0.6, 0.04]} />
        <meshStandardMaterial ref={glass} color="#0e7490" emissive="#67e8f9" emissiveIntensity={0} toneMapped={false} />
      </mesh>
      {/* condenser unit on the roof, its fan spins while the room runs */}
      <mesh position={[0.6, 3.25, -0.4]} castShadow>
        <boxGeometry args={[1.4, 0.5, 1.2]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.4} roughness={0.5} />
      </mesh>
      <group ref={fan} position={[0.6, 3.52, -0.4]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation-y={(i * Math.PI * 2) / 3}>
            <boxGeometry args={[0.9, 0.03, 0.16]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
        ))}
      </group>
      <StatusLamp state={state} position={[-1.5, 3.2, 1.3]} radius={0.2} />
      <Label position={[0, 4.4, 0.6]} title="P1 Cold room" badge={state ?? "NO DATA"} badgeColor={colorOf(state)} detail={loadDetail(load)} />
    </group>
  );
}

// ---- P2 machine with fan ----

export function Machine({ load }: { load: LoadSnapshot | undefined }) {
  const state = load?.state ?? null;
  const blades = useRef<THREE.Group>(null);
  const body = useRef<THREE.MeshStandardMaterial>(null);
  const speed = useRef(0);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    // Spin up and run down smoothly; stopped when OFF or FAULT.
    speed.current += (runLevel(state, t) * 11 - speed.current) * ease(dt, 1.2);
    if (blades.current) blades.current.rotation.z -= speed.current * dt;
    if (body.current) body.current.emissiveIntensity = state === "FAULT" ? lampIntensity("FAULT", t) * 0.15 : 0;
  });

  return (
    <group position={[4.4, 0, 2.0]}>
      <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.6, 1.6, 1.6]} />
        <meshStandardMaterial ref={body} color="#2563eb" emissive="#ef4444" emissiveIntensity={0} metalness={0.35} roughness={0.45} />
      </mesh>
      {/* fan housing on the front */}
      <mesh position={[0, 0.85, 0.86]}>
        <torusGeometry args={[0.62, 0.07, 10, 36]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.6} roughness={0.3} />
      </mesh>
      <group ref={blades} position={[0, 0.85, 0.9]}>
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.12, 0.12, 0.12, 14]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} rotation-z={(i * Math.PI * 2) / 5}>
            <boxGeometry args={[0.16, 1.05, 0.03]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.2} roughness={0.5} />
          </mesh>
        ))}
      </group>
      {/* control panel */}
      <mesh position={[1.0, 1.75, 0.3]} castShadow>
        <boxGeometry args={[0.5, 0.3, 0.5]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <StatusLamp state={state} position={[1.0, 2.02, 0.3]} />
      <Label position={[0, 2.75, 0.2]} title="P2 Machine / fan" badge={state ?? "NO DATA"} badgeColor={colorOf(state)} detail={loadDetail(load)} />
    </group>
  );
}

// ---- P3 ceiling lights ----

const FIXTURES: Vec3[] = [-4.5, -1, 2.5].flatMap((x) => [-0.8, 2.4].map((z) => [x, 3.95, z] as Vec3));

export function CeilingLights({ load }: { load: LoadSnapshot | undefined }) {
  const state = load?.state ?? null;
  const materials = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const level = useRef(0);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    // RESTARTING flickers, FAULT glows dim red, OFF is dark.
    const target = state === "RESTARTING" ? (Math.sin(t * 23) * Math.sin(t * 7) > 0 ? 0.9 : 0.15) : state === "FAULT" ? 0.25 : runLevel(state, t);
    level.current += (target - level.current) * ease(dt, state === "RESTARTING" ? 30 : 6);
    materials.current.forEach((m) => {
      if (!m) return;
      m.emissive.set(state === "FAULT" ? "#ef4444" : "#fff3d6");
      m.emissiveIntensity = level.current * 2.2;
    });
    lights.current.forEach((l) => {
      if (l) l.intensity = state === "FAULT" ? 0 : level.current * 9;
    });
  });

  return (
    <group>
      {FIXTURES.map((p, i) => (
        <group key={i} position={p}>
          <mesh position={[0, 0.25, 0]}>
            <boxGeometry args={[0.04, 0.5, 0.04]} />
            <meshStandardMaterial color="#64748b" />
          </mesh>
          <mesh>
            <boxGeometry args={[1.6, 0.1, 0.36]} />
            <meshStandardMaterial
              ref={(m) => {
                materials.current[i] = m;
              }}
              color="#e2e8f0"
              emissive="#fff3d6"
              emissiveIntensity={0}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
      {[-3, 1.5].map((x, i) => (
        <pointLight
          key={x}
          ref={(l) => {
            lights.current[i] = l;
          }}
          position={[x, 3.4, 0.4]}
          color="#ffe8c2"
          intensity={0}
          distance={14}
          decay={1.6}
        />
      ))}
      <Label position={[-1, 4.75, 2.4]} title="P3 Lights" badge={state ?? "NO DATA"} badgeColor={colorOf(state)} detail={loadDetail(load)} />
    </group>
  );
}
