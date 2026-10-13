# CSE Setup: ACME (site MN-CSE) registered to Mobius4 (IN-CSE)

Status: working and verified on 13 Oct 2026. This is the M1 technical exit criterion.

This guide brings up the two oneM2M CSEs GridSense is built on and registers the site gateway to the cloud CSE:

```text
ACME  (MN-CSE, site gateway)  --HTTP-->  Mobius4  (IN-CSE, cloud)
csi: /id-mn   port 8081                  csi: /Mobius4   CSEBase: Mobius   port 7599

SP-ID (both): //gridsense.local
```

Both run on one machine for now: Mobius4 in Docker, ACME natively in a Python venv. Moving both into a single Docker Compose file is the next step (see "Known limitations").

## Versions used

| Component | Version | Notes |
| :---- | :---- | :---- |
| Mobius4 | commit `3da4d8523694b5077e348ab1c9e769fb3a30df24` (4.24.5) | Pinned to the tested commit; checked out in step 1 |
| ACME | `acmecse` 2026.05.3 (PyPI) | Needs Python 3.11 or newer; tested on Python 3.14 |
| PostgreSQL / PostGIS | `ghcr.io/baosystems/postgis:17` | Set via `POSTGRES_IMAGE` in `.env`; the official PostGIS image is amd64-only, so this multi-arch build is needed on Apple Silicon (it also works on amd64) |
| Mosquitto | `eclipse-mosquitto:2` | Started by Mobius4's compose file; not used by ACME yet |

## 1. Mobius4 (IN-CSE)

```sh
git clone https://github.com/IoTKETI/mobius4.git
cd mobius4
git checkout 3da4d8523694b5077e348ab1c9e769fb3a30df24
cp .env.example .env
```

Edit `.env`. Settings used:

```dotenv
DB_USER=mobius4
DB_PW=<choose a password>
DB_NAME=mobius4

# Needed on Apple Silicon (arm64); also works on amd64
POSTGRES_IMAGE=ghcr.io/baosystems/postgis:17

# The http:// prefix is required, see Fix 3
CSE_POA=http://<your-LAN-IP>:7599

# Must match ACME's serviceProviderID, see Fix 4
CSE_SP_ID=//gridsense.local

# Empty: generated on first start
CSE_ADMIN=

HTTPS_ENABLED=false
HELMET_ENABLED=true
RATELIMIT_ENABLED=true
RATELIMIT_MAX=500
LOG_LEVEL=info
```

`.env` is gitignored by Mobius4. Never commit it.

Find your LAN IP on macOS with `ipconfig getifaddr en0` (try `en1` if empty).

Start it:

```sh
docker compose up -d
# wait ~10 seconds; curl straight after "up" can fail with "connection reset"
curl localhost:7599/health
# {"status":"ok","uptime":...,"db":"ok"}
```

Mobius4 generates an admin identity on first start and prints it once:

```sh
docker compose logs mobius4 | grep -i admin
```

That value is a full-control credential for the CSE. Keep it out of Discord and out of Git.

Identity: CSE-ID `/Mobius4` and CSEBase name `Mobius` are Mobius4's defaults (unset in `.env`). SP-ID is `//gridsense.local`, set in `.env`.

## 2. ACME (site MN-CSE)

Keep ACME's data in its own folder, not inside the Mobius4 repo.

Two folders share the name `gridsense-acme` on purpose: `~/gridsense-acme` is the Python virtual environment, and `~/Codes/gridsense-acme` holds ACME's config (`acme.ini`) and runtime data.

```sh
python3 -m venv ~/gridsense-acme
source ~/gridsense-acme/bin/activate
python -m pip install acmecse

mkdir -p ~/Codes/gridsense-acme && cd ~/Codes/gridsense-acme
acmecse
```

The first run starts an onboarding wizard. Answers used:

| Prompt | Answer | Why |
| :---- | :---- | :---- |
| Runtime data directory | `~/Codes/gridsense-acme` | Separate from the Mobius4 repo |
| Configuration file | `acme.ini` | Default |
| Target features | **Regular** | "Development" defaults to an in-memory DB |
| CSE type | **MN** | Site gateway |
| CSE secret | empty (default) | Dev only; set a real one before any shared deployment |
| CSE-ID | `id-mn` |  |
| CSE name | `cse-mn` |  |
| Service Provider ID | **`//gridsense.local`** | Must match Mobius4's `CSE_SP_ID` (Fix 4) |
| Admin originator | `CAdmin` | Default |
| Network interface | `0.0.0.0` |  |
| CSE host address | **your LAN IP** | Not `${hostIPAddress}` or 127.0.0.1; Mobius4 runs in a container and must reach ACME |
| Registrar CSE-ID | `Mobius4` |  |
| Registrar CSE name | `Mobius` |  |
| Registrar host / port | `localhost` / `7599` | ACME runs natively and reaches Docker's published port |
| Infrastructure CSE-ID | `Mobius4` | Default `id-in` points at a CSE that doesn't exist here |
| Database | **TinyDB** | File-based, survives restarts |
| Bindings | HTTP only | MQTT gets enabled in M2 for the ESP32 devices |
| HTTP port | `8081` |  |
| Console / Text UI / Web UI | Rich / No / Yes | Web UI is served on ACME's HTTP port (8081) for browsing the resource tree |
| Log level | `debug` | Drop to `info` once things work |
| Enable/disable features, advanced settings | No | Defaults include remote CSE, announcement and group services |

Then add the registration fixes (Fix 1 and 2 below) to `acme.ini` before relying on it. The full working file is in [`acme.ini.example`](acme.ini.example).

## 3. Interop fixes (ACME → Mobius4)

The two CSEs both follow oneM2M, but out of the box ACME's registration request is rejected by Mobius4. Four fixes were needed.

### Fix 1: Mobius4 rejects `spi`, `dcse` and `ici` in the `<remoteCSE>` create

Symptom in the ACME log, repeating every 60 s:

```text
error creating CSR on registrar CSE: 4000 dbg: {'m2m:dbg': 'spi => spi is not allowed'}
```

Cause: ACME sends `spi`, `dcse` (and in some versions `ici`) in the `<remoteCSE>` CREATE body. Mobius4's request schema for `<remoteCSE>` (`cse/validation/res_schema.js`) only accepts `cb, rr, srv, csi, csz, cst, poa, nl` plus the common attributes.

Fix: tell ACME to leave them out. In `acme.ini`:

```ini
[cse.registrar]
excludeCSRAttributes = spi,dcse,ici,csz
```

(`csz` is for Fix 2.)

### Fix 2: Mobius4's `csz` column is too short for ACME's values

Symptom after Fix 1:

```text
error creating CSR on registrar CSE: 4000 dbg: {'m2m:dbg': 'value too long for type character varying(10)'}
```

Cause: Mobius4 stores `csz` (supported serializations) as `VARCHAR(10)[]` (`db/init.js`, `csr` table). ACME sends full media types such as `application/json` and `application/vnd.onem2m-res+json`, which are longer than 10 characters. `csz` is optional in Mobius4's schema.

Fix: exclude `csz` too (already in the line above).

### Fix 3: `CSE_POA` needs the `http://` scheme, and is only read once

Symptom: registration succeeds (`2001`), then about 60 s later ACME's liveness check fails, it tries to re-register and gets a conflict, then reports itself disconnected:

```text
WARNING csrMonitor - unsupported url scheme: 172.20.10.2:7599
WARNING csrMonitor - error creating CSR on registrar CSE: CONFLICT dbg: {'m2m:dbg': "requested 'rn' is already used"}
INFO    csrMonitor - Disconnected from registrar CSE
```

Cause: ACME reaches Mobius4 for its liveness check through the `poa` Mobius4 advertises on its CSEBase. `CSE_POA` was set without `http://`. Mobius4 writes the CSEBase `poa` into the database only when the CSEBase is first created (`db/init.js`, `create_cb`). On later starts it reuses the stored record, so editing `.env` alone changes nothing.

Fix: set `CSE_POA=http://<your-LAN-IP>:7599` in `.env`, then reset the Mobius4 database:

```sh
cd mobius4
docker compose down -v     # wipes the DB and the stored admin identity
docker compose up -d
docker compose logs mobius4 | grep -i admin    # new admin ID
```

Then restart ACME (Ctrl-C, `acmecse`).

### Fix 4: SP-IDs must match on both CSEs

Symptom: none at first. Registration works with mismatched SP-IDs because ACME registers through SP-relative paths (`/~/Mobius4/Mobius/...`) and, after Fix 1, never sends its `spi`. The original setup had Mobius4 on `//gridsense.local` and ACME on `//localhost`.

Why it matters anyway: Mobius4 uses its SP-ID to route absolute IDs (`//sp-id/cse-id/...`) and to rewrite originators on forwarded requests (`cse/reqPrim.js`). With mismatched SP-IDs it treats the other CSE as a different service provider. That affects AEs talking upstream, announcement and notifications in later milestones. Mobius4's `docs/docker.md` states `CSE_SP_ID` must match on both CSEs.

Fix: in `acme.ini`, set `serviceProviderID = //gridsense.local` in the `[basic.config]` section. ACME stores its CSEBase on first start and reuses it, so clear its data before restarting:

```sh
rm -rf ~/Codes/gridsense-acme/data
acmecse
```

ACME deletes its old `<remoteCSE>` on Mobius4 before re-registering, so Mobius4 needs no reset.

## 4. Verify

In the ACME console, after start:

```text
created CSR on registrar CSE: /Mobius4          <- HTTP 2001 from Mobius4
Registered to registrar CSE: /Mobius4
```

About 60 s later, the `Checking connection to Registrar CSE` block should finish with no WARNING.

From Mobius4's side:

```sh
curl -s -H 'X-M2M-Origin: /id-mn' -H 'X-M2M-RI: 1' -H 'X-M2M-RVI: 3' \
  'http://localhost:7599/Mobius?fu=1&ty=16'
# {"m2m:uril":["Mobius/id-mn"]}
```

Use `/id-mn` as the originator here, not the admin. A `<remoteCSE>` created by a registering CSE has no access control policy attached, so Mobius4 shows it only to its creator. Asking as admin returns an empty list, which looks like a failed registration but isn't (documented in Mobius4's `docs/docker.md`).

## Known limitations

- **Hard-coded LAN IP.** `CSE_POA` (Mobius4) and `cseHost` (ACME) both hold the machine's LAN IP. Changing Wi-Fi breaks the setup, and fixing Mobius4's side needs `docker compose down -v`. Plan: run both CSEs in one Docker Compose file and use service names.
- **No `dcse` sent to Mobius4.** Excluding it means Mobius4 doesn't see ACME's descendant CSEs. Irrelevant with one site; revisit for multi-site / MEC.
- **Default ACME secret.** ACME warns `Using default secret key` at startup. Set `[basic.config] secret` before any shared or VM deployment.
- **ACME is MN-CSE over HTTP only.** MQTT binding plus a Mosquitto broker on the gateway come in M2 for the ESP32 devices.
- **ACME has an "ETSI MEC" target** in its onboarding wizard ("Like Regular, but enable ETSI MEC support"). Not used here; likely relevant for the MEC MN-CSE in M3. Not yet checked what it enables.

## Possible upstream report

Fixes 1 and 2 are a strictness mismatch between two oneM2M implementations rather than misconfiguration. They may be worth raising with the Mobius4 maintainers and in the hackathon Discord.
