# GridSense Orchestrator

Offline-first, power-aware device coordination on oneM2M that sheds loads lowest-priority first during a grid outage to protect backup power, then restarts them in priority order with gaps between loads to avoid inrush.

## Status

- Working: CSE stack in Docker Compose, with the site MN-CSE (ACME) registered to the IN-CSE (Mobius4).
- First version: dashboard with a 3D virtual factory, showing the site live from oneM2M. Until the bridge and a device data source exist, a dev-only feed provides the data.
- Everything else: in progress.

## Architecture

Architecture diagram: coming

The planned design has three tiers:

1. Site: ACME CSE as MN-CSE, an Orchestrator AE, an MQTT broker (Mosquitto), and devices (ESP32 or a software simulator). Safety decisions are made locally at the site, so it is designed to keep working without internet.
2. MEC edge: ACME CSE as MN-CSE on an ETSI MEC VM, and a Feeder Coordinator AE that assigns restart windows to sites on the same feeder.
3. Cloud: Mobius4 as IN-CSE, an AI agent with MCP tools (suggest-only, human approval), and a dashboard.

## Repository map

- `cloud/`: Mobius4 IN-CSE config, AI agent, MCP tools
- `mec/`: MEC MN-CSE (ACME) and Feeder Coordinator AE
- `site-gateway/`: site MN-CSE (ACME), Orchestrator AE, Mosquitto config
- `bridge/`: Interworking Proxy Entity (IPE) between the Nexalware platform and oneM2M
- `simulator/`: software grid sensor, battery and loads, plus scripted test scenarios
- `dashboard/`: Next.js dashboard and 3D virtual factory; reads oneM2M server-side through Mobius4, plus a dev-only data feed
- `firmware/`: ESP32 firmware per node type (PlatformIO)
- `hardware/`: Proteus schematics, wiring notes, bill of materials
- `libs/`: shared Python libraries (oneM2M request helper)
- `docs/`: architecture, resource tree, protocols, security, decisions
- `.github/`: CI workflow

## oneM2M features (planned)

None of these are implemented yet.

- `group` with `fanOutPoint` (planned)
- `pollingChannel` (planned)
- announcement (planned)
- `flexContainer` (planned)
- `timeSeries` (planned)
- subscriptions (planned)
- `accessControlPolicy` (planned)

## Quick start

```sh
cp .env.example .env    # then set DB_PW (and POSTGRES_IMAGE on Apple Silicon)
docker compose up -d
docker compose ps       # wait until all four services are healthy
```

Verify that ACME (site MN-CSE) is registered to Mobius4 (IN-CSE):

```sh
curl -s -H 'X-M2M-Origin: /id-mn' -H 'X-M2M-RI: 1' -H 'X-M2M-RVI: 3' 'http://localhost:7599/Mobius?fu=1&ty=16'
# expected: {"m2m:uril":["Mobius/id-mn"]}
```

Details, logs to check and the manual setup: [docs/cse-setup.md](docs/cse-setup.md).

## Links

- hackster.io article: TBD
- Demo video: TBD

## Team

Team Nexalware, 2026 oneM2M International Hackathon (oneM2M + ETSI MEC).

- Abraham Folorunso
- Dare Timileyin
- Sunday Gabriel

## License

Apache License 2.0. See [LICENSE](LICENSE).
