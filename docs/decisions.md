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

### Bridge / IPE architecture

- Date: 2026-10-13 (agreed with Dare)
- Status: Decided
- oneM2M is the core of the system. Nexalware is not presented as the core.
- The bridge is an Interworking Proxy Entity (IPE) that runs locally at the site. It is two-way: device state goes up into ACME, commands come down from ACME.
- Nexalware is the device, network and security layer under oneM2M (MQTT, WebSocket, HTTPS to devices).
- Applications (Orchestrator AE, dashboard and 3D factory, AI agent via MCP) talk oneM2M only. Decisions start above oneM2M and go down through it; no application calls Nexalware or a device directly. See [architecture.md](architecture.md).

### Virtual factory

- Date: 2026-10-14
- Status: Decided
- Devices are represented in a 3D virtual factory in the dashboard, which replaces a physical site in the demo video.
- It renders the state stored in oneM2M and writes only one input, the grid switch (as the grid sensor). It makes no decisions.

### Owners

- Date: 2026-10-13
- Status: Decided
- Bridge (`bridge/`): Dare. Interim report deck: Dynamo. Infrastructure, dashboard and 3D factory: Abraham.

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

### Device data source

- Date: 2026-10-14
- Status: Open
- Proteus or a simulator script feeds the virtual devices. Until decided, a DEV ONLY feed in the dashboard (`dashboard/scripts/dev-feed.ts`) stands in for devices and Orchestrator.

### Risk: 3-level CSE routing (IN → MEC → site)

- Date: 2026-10-14
- Status: Open; test before M3
- Mobius4 rejects the `dcse` attribute, and ACME's author confirmed on the hackathon Discord that `dcse` is required for routing between multiple CSEs. Routing from Mobius4 through a MEC ACME down to the site ACME will likely fail. Two levels (site registered directly to Mobius4) work today.
- Options:
  - (A) ACME as the IN-CSE.
  - (B) Flat topology: site and MEC CSEs both registered directly to Mobius4.
  - (C) Design around downward routing, using `<pollingChannel>` and announcement.
  - (D) Wait for `dcse` support in Mobius4.
