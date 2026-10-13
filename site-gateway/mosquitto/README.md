# Mosquitto

Mosquitto broker config for device MQTT. `mosquitto.conf` is mounted into the `mosquitto` service in the root docker-compose.yml; Mobius4 connects to it as its MQTT broker.

- Tier: Site
- Language: configuration only (mosquitto.conf)
- Listens on 1883 inside the compose network. Not published to the host.
- Anonymous access is on, for local development only. Add `password_file` or TLS client certificates before publishing the port or connecting real devices.

Status: config in use by the Compose stack; no device traffic yet
