# Mobius4 (IN-CSE)

The Mobius4 IN-CSE runs as the `mobius4` service in the root docker-compose.yml.

- Tier: Cloud
- Language: configuration only
- Mobius4 source is NOT copied here. Compose builds it from a Git build context pinned to the tested commit: `https://github.com/IoTKETI/mobius4.git#3da4d8523694b5077e348ab1c9e769fb3a30df24` (4.24.5).
- Env vars passed (values from `.env`, see `.env.example`): `CSE_ADMIN`, `CSE_SP_ID`, `CSE_POA`, `HTTP_PORT=7599`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PW`, `MQTT_ENABLED`, `MQTT_HOST`, `MQTT_PORT`, `HELMET_ENABLED`, `RATELIMIT_ENABLED`, `RATELIMIT_MAX`, `LOG_LEVEL`.
- With `CSE_ADMIN` empty, Mobius4 generates an admin identity on first start, keeps it on the `mobius4-identity` volume and prints it once. Read it with `docker compose logs mobius4 | grep -i admin`. It is a credential: keep it out of Git and chat.
- `CSE_POA` and `CSE_SP_ID` are stored on first start only. After changing either, reset with `docker compose down -v`.

Setup and verification: docs/cse-setup.md.

Status: running in the Compose stack (verified 2026-10-13)
