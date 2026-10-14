# oneM2M Resource Tree

**PROVISIONAL: to be aligned with the bridge (Dare).** This is the contract the dashboard and the dev feed use today. Names, originators and content shapes may change when the bridge (IPE) is built.

All resources live on the site MN-CSE: ACME, CSE-ID `/id-mn`, CSEBase `cse-mn`, SP-ID `//gridsense.local`. Address them SP-relative as `/~/id-mn/cse-mn/...`, either on ACME directly (`http://acme-site:8081`) or through Mobius4 (`http://mobius4:7599`), which forwards to ACME (see [cse-setup.md](cse-setup.md), Fix 5).

For now this uses plain `<AE>` + `<container>` + `<contentInstance>` with JSON content. `<flexContainer>` and `<timeSeries>` come later (M2) and need their definitions registered in ACME first.

## Tree

```text
cse-mn                        <CSEBase>   ACME site MN-CSE, /id-mn
├── acp-gridsense-devices     <accessControlPolicy>
├── acp-gridsense-grid-input  <accessControlPolicy>
├── grid-sensor               <AE>        lbl gridsense/type:grid-sensor
│   └── grid-status           <container> mni 50
│       └── (latest)          <contentInstance>  {"status", "ts"}
├── battery                   <AE>        lbl gridsense/type:battery
│   └── battery-state         <container> mni 120
│       └── (latest)          <contentInstance>  {"percent", "voltage", "ts"}
├── load-p1-coldroom          <AE>        lbl gridsense/type:load, gridsense/priority:1
│   └── load-state            <container> mni 120
├── load-p2-machine           <AE>        lbl gridsense/type:load, gridsense/priority:2
│   └── load-state            <container> mni 120
└── load-p3-lights            <AE>        lbl gridsense/type:load, gridsense/priority:3
    └── load-state            <container> mni 120
        └── (latest)          <contentInstance>  {"priority", "state", "ratedCurrent", "measuredCurrent", "ts"}
```

| AE (`rn`) | AE-ID / originator (dev feed) | Container | `acpi` on AE and container |
| :--- | :--- | :--- | :--- |
| `grid-sensor` | `Cgridsense-grid-sensor` | `grid-status` | AE: devices. Container: devices + grid-input |
| `battery` | `Cgridsense-battery` | `battery-state` | devices |
| `load-p1-coldroom` | `Cgridsense-load-p1-coldroom` | `load-state` | devices |
| `load-p2-machine` | `Cgridsense-load-p2-machine` | `load-state` | devices |
| `load-p3-lights` | `Cgridsense-load-p3-lights` | `load-state` | devices |

The AE-IDs are the dev feed's stand-in device originators. The ACPs are described in [security.md](security.md).

## Content of each `<contentInstance>`

Every `<contentInstance>` has `cnf` = `application/json:0` and its `con` is a JSON string. `ts` is ISO 8601 UTC, set by the writer. The newest instance is read with `GET .../<container>/la`.

`grid-sensor/grid-status`, written by the grid sensor (today: the dashboard's grid switch, and the dev feed once at start):

```json
{"status": "ON", "ts": "2026-10-14T19:28:39.099Z"}
```

`status` is `"ON"` or `"OFF"`.

`battery/battery-state`, written by the battery monitor (today: the dev feed):

```json
{"percent": 91.9, "voltage": 12.89, "ts": "2026-10-14T19:29:01.038Z"}
```

`percent` is 0 to 100, `voltage` in volts (12 V demo system).

`load-*/load-state`, written per load (today: the dev feed):

```json
{"priority": 3, "state": "ON", "ratedCurrent": 1.2, "measuredCurrent": 1.23, "ts": "2026-10-14T19:29:01.038Z"}
```

`priority` is 1, 2 or 3. `state` is `"ON"`, `"OFF"` (shed or stopped), `"RESTARTING"` (soft start) or `"FAULT"` (switched on, but no current measured). Currents in amperes.

## Who reads and writes

| Container | Writes today | Writes later | Reads |
| :--- | :--- | :--- | :--- |
| `grid-status` | dashboard grid switch (CREATE), dev feed (initial value) | bridge, from the grid sensor device | dev feed (Orchestrator stand-in), dashboard |
| `battery-state` | dev feed | bridge | dashboard |
| `load-state` (x3) | dev feed | bridge | dashboard |

## Commands used to check the tree

Run from the host with the Compose stack and the dev feed up. Every request needs `X-M2M-Origin`, a unique `X-M2M-RI` and `X-M2M-RVI: 3`.

```sh
# an AE and its labels, ACME direct, as the dashboard
curl -s -H 'X-M2M-Origin: Cgridsense-dashboard' -H 'X-M2M-RI: chk-1' -H 'X-M2M-RVI: 3' \
  'http://localhost:8081/~/id-mn/cse-mn/load-p3-lights'

# latest load state through Mobius4 (forwarded to ACME), as the dashboard
curl -s -H 'X-M2M-Origin: Cgridsense-dashboard' -H 'X-M2M-RI: chk-2' -H 'X-M2M-RVI: 3' \
  'http://localhost:7599/~/id-mn/cse-mn/load-p3-lights/load-state/la'

# an ACP, as its owner (the dev feed)
curl -s -H 'X-M2M-Origin: Cgridsense-dev-feed' -H 'X-M2M-RI: chk-3' -H 'X-M2M-RVI: 3' \
  'http://localhost:8081/~/id-mn/cse-mn/acp-gridsense-devices'
```

## Open points for alignment with the bridge

- AE-IDs and originators: the bridge registers its own AEs. The ACPs must then list the bridge's originators instead of the dev feed's.
- One AE per device (as here) or one IPE AE with a container per device.
- Commands down from ACME to devices (for example a `load-command` container per load) are not defined yet. Today the dev feed's Orchestrator stand-in sets load states directly.
- Discovery by label: the labels are set, but a discovery at the CSEBase (`?fu=1&lbl=...`) needs a privilege on the CSEBase that only ACME's admin can grant. ACME's default CSEBase ACP, `acpCreateRootResources`, grants other originators CREATE only, and only for policy resources such as `<accessControlPolicy>`; the discovery answers `4103`. The dashboard therefore reads the fixed paths above.
- `mni` (kept instances) is 50 for `grid-status` and 120 for the others, to bound storage at one write per second.
