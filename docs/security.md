# Security

Status: covers the dashboard and the access control on the site CSE as of 2026-10-14. Other topics (device and network security in the Nexalware layer, TLS, MEC) are to be written.

## Principles

- Applications talk oneM2M only. No application calls Nexalware or a device directly.
- The browser never talks to a CSE. It calls the dashboard's own `/api/state` and `/api/grid`; the dashboard server talks oneM2M.
- No oneM2M originator or credential reaches the browser.
- Applications do not use a CSE's admin originator. Each has its own originator, granted only what it needs by an `<accessControlPolicy>`.

## Dashboard

- `ONEM2M_BASE_URL`, `ONEM2M_CSE_PATH` and `ONEM2M_ORIGINATOR` are read only by server code (`dashboard/lib/server/`, which imports `server-only`). None has a `NEXT_PUBLIC_` prefix, so Next.js does not put them in client bundles.
- Errors returned to the browser carry only the HTTP status and oneM2M response code (for example `oneM2M request failed (HTTP 403, RSC 4103)`). ACME's debug text can contain the originator, so it goes to the server log only.
- Verified on 2026-10-14 against the Compose build: the browser contacted only the dashboard's own host and port. A search of the shipped client JavaScript (`.next/static`) found no originator, no `mobius4` or `acme-site` host name and no CSE port.

## Access control on the site CSE (ACME)

The dev feed creates two `<accessControlPolicy>` resources under `cse-mn`, owned by its own originator `Cgridsense-dev-feed` (no admin originator). The dashboard originator is listed in both forms: `Cgridsense-dashboard` for direct access to ACME, and `/Mobius4/Cgridsense-dashboard` for requests forwarded by Mobius4 ([cse-setup.md](cse-setup.md), Fix 5).

`acp-gridsense-devices`, set as `acpi` on all five AEs and all five containers:

| `acor` | `acop` | Meaning |
| :--- | :--- | :--- |
| `Cgridsense-dev-feed` and the five device AE originators (`Cgridsense-grid-sensor`, `Cgridsense-battery`, `Cgridsense-load-p1-coldroom`, `Cgridsense-load-p2-machine`, `Cgridsense-load-p3-lights`) | 63 | all operations |
| `Cgridsense-dashboard`, `/Mobius4/Cgridsense-dashboard` | 34 | RETRIEVE (2) + DISCOVER (32) |

`acp-gridsense-grid-input`, set additionally as `acpi` on `grid-sensor/grid-status` only:

| `acor` | `acop` | Meaning |
| :--- | :--- | :--- |
| `Cgridsense-dashboard`, `/Mobius4/Cgridsense-dashboard` | 1 | CREATE: the grid switch adds a `<contentInstance>` |

Both ACPs have `pvs` (who may change the ACP itself) set to the dev feed and device originators only.

Checks run on 2026-10-14 (dashboard originator, through Mobius4 unless noted):

| Request | Result |
| :--- | :--- |
| RETRIEVE the latest instance of each of the five containers | `2000` |
| RETRIEVE each AE (ACME direct) | `2000` |
| CREATE a `<contentInstance>` in `grid-status` (the grid switch) | `2001` |
| CREATE a `<contentInstance>` in `battery-state` | `4103` |
| UPDATE `acp-gridsense-devices` (ACME direct) | `403` |
| Discovery at the CSEBase by label | `4103` |
| RETRIEVE with an unknown originator | `4103` |

### ACME behaviour that shaped these ACPs

Observed with ACME 2026.5.3:

- A `<container>` does not inherit its parent `<AE>`'s `acpi`. Each container needs its own.
- Once a `<container>` has an `acpi`, its creator loses access unless the creator is also named in the ACP. That is why the device originators are in `acp-gridsense-devices`.
- `acpi` must be the only attribute in an UPDATE request.
- ACME's default CSEBase ACP lets any originator create an `<accessControlPolicy>` under the CSEBase, so no admin originator is needed to set this up.

## Known gaps

- Originators are not authenticated. Over plain HTTP, any client that can reach ACME (port 8081) or Mobius4 (port 7599) can send any `X-M2M-Origin`. Both ports are published to the host by the Compose stack.
- The device AEs share one ACP, so each stand-in device could write to another device's container. The bridge should get its own originators and narrower rules.
- The dashboard has no login. Anyone who can reach port 3000 can flip the grid switch.
- ACME runs with its default secret unless `ACME_SECURITY_SECRET` is set; Mosquitto allows anonymous clients (not published). See the Known limitations in [cse-setup.md](cse-setup.md).
- The Mobius4 admin identity (`docker compose logs mobius4 | grep -i admin`) is a credential: keep it out of Git and chat.
