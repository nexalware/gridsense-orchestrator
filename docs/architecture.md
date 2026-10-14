# Architecture

oneM2M is the core of GridSense. Applications sit above it, devices sit below it, and everything between an application and a device goes through the oneM2M service layer. Agreed by the team on 13 Oct 2026; see [decisions.md](decisions.md).

## Layers

```text
+-----------------------------------------------------------------------+
| Applications                                talk oneM2M only          |
|   Orchestrator AE    Dashboard + 3D factory    AI agent (via MCP)     |
+-----------------------------------+-----------------------------------+
                                    |  oneM2M requests (HTTP)
+-----------------------------------v-----------------------------------+
| oneM2M service layer                        SP-ID //gridsense.local   |
|                                                                       |
|   Mobius4  IN-CSE   /Mobius4   CSEBase "Mobius"         cloud         |
|        ^  registered (<remoteCSE>), forwards requests down            |
|   ACME     MN-CSE   /id-mn     CSEBase "cse-mn"         site          |
|                                                                       |
|   (planned) ACME MN-CSE on an ETSI MEC VM               MEC edge      |
+-----------------------------------+-----------------------------------+
                                    |  oneM2M, at the site
+-----------------------------------v-----------------------------------+
| Bridge = Interworking Proxy Entity (IPE)    runs locally at the site  |
|   device state UP into ACME, commands DOWN from ACME                  |
+-----------------------------------+-----------------------------------+
                                    |  MQTT / WebSocket / HTTPS
+-----------------------------------v-----------------------------------+
| Nexalware                device, network and security layer           |
+-----------------------------------+-----------------------------------+
                                    |
+-----------------------------------v-----------------------------------+
| Devices   virtual: 3D factory + a data source (Proteus or a           |
|           simulator script, still being decided)                      |
|           real: ESP32 nodes (load, battery monitor, grid sensor)      |
+-----------------------------------------------------------------------+
```

**Applications.** The Orchestrator AE makes the shedding and restart decisions. The dashboard and its 3D virtual factory show state and take one input, the grid switch. The AI agent proposes rule changes through MCP tools and needs human approval. All of them use oneM2M requests and nothing else.

**oneM2M service layer.** The site MN-CSE (ACME) holds the site's resources: see [resource-tree.md](resource-tree.md). It is registered to the IN-CSE (Mobius4) in the cloud. Mobius4 forwards requests addressed to the site CSE (`/~/id-mn/cse-mn/...`) down to ACME, which is how the dashboard reads the site ([cse-setup.md](cse-setup.md), Fix 5). Safety decisions are designed to run at the site, so the site can keep working without the cloud.

**Bridge (IPE).** Runs at the site, next to ACME. It is the only component that translates between oneM2M and the device world: it writes device state up into ACME, and turns commands found in ACME into device actions. Owner: Dare (`bridge/`).

**Nexalware.** Our device, network and security platform, under oneM2M. It carries device traffic (MQTT, WebSocket, HTTPS). It is not the core of the system and applications never call it.

**Devices.** Virtual devices are shown in the dashboard's 3D factory, with their data coming from a data source still to be decided. Real devices are ESP32 nodes.

## Rule: decisions go down through oneM2M

A decision starts above oneM2M and reaches a device only through it: application, then a oneM2M resource on the CSE, then the bridge, then Nexalware, then the device. No application calls Nexalware or a device directly. Device state travels the same path upwards.

The dashboard follows this. Its grid switch writes a new `<contentInstance>` to `grid-sensor/grid-status`, exactly as the grid sensor device would. It changes no load: the Orchestrator reads the new grid status and acts.

## What runs today

- Mobius4 (IN-CSE), PostgreSQL/PostGIS, Mosquitto and ACME (site MN-CSE) in Docker Compose, with ACME registered to Mobius4 ([cse-setup.md](cse-setup.md)).
- The dashboard, reading the site resources through Mobius4 ([dashboard/README.md](../dashboard/README.md)).
- A DEV ONLY feed (`docker compose --profile dev`) that writes straight into ACME at the site. It stands in for the devices, the bridge and the Orchestrator until those exist, so it combines roles that are separate layers in the design above.

## Tiers and the MEC edge (planned)

The same layers map onto three deployment tiers: site (ACME, Orchestrator, bridge, Mosquitto, devices), MEC edge (planned: a second ACME MN-CSE on an ETSI MEC VM with the Feeder Coordinator AE), and cloud (Mobius4, AI agent, dashboard). The MEC tier is not built. A three-level chain site ACME → MEC ACME → Mobius4 is at risk because Mobius4 does not accept `dcse`; see Known limitations in [cse-setup.md](cse-setup.md) and the open decision in [decisions.md](decisions.md).
