# Decisions

Short log of project decisions, including the ones still open.

## Decided

### D1: CSE implementations

- Date: 2026-10-13
- Status: Decided
- ACME as MN-CSE (site and MEC). Mobius4 as IN-CSE.

### D4: Languages

- Date: 2026-10-13
- Status: Decided
- Python for backend components. TypeScript / Next.js for the dashboard.

### SP-ID

- Date: 2026-10-13
- Status: Decided
- `//gridsense.local` on all CSEs.

### License

- Date: 2026-10-13
- Status: Decided
- Apache-2.0.

## Open

### Simulation

- Date: 2026-10-13
- Status: Open
- Proteus for schematics. The Proteus IoT Builder → MQTT → ACME runtime flow is still to be tested.
- ACME's MQTT binding expects oneM2M TS-0010 request primitives, so Proteus must send those or go through an IPE (bridge).
- Fallback: a Python software simulator.

### D2: MEC role

- Date: 2026-10-13
- Status: Open
- Proposed: Feeder Coordinator.

### D3: Hardware tier

- Date: 2026-10-13
- Status: Open

### D5: Interim report owner

- Date: 2026-10-13
- Status: Open
