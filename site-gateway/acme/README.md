# ACME MN-CSE (Site)

Dockerfile and acme.ini for the site MN-CSE, run as the `acme-site` service in the root docker-compose.yml.

- Tier: Site
- Language: configuration only (ACME itself is Python)
- ACME is installed from PyPI (`acmecse==2026.5.3`), not copied here.
- `acme.ini` here is the container config and is tracked in Git. Other `acme.ini` files stay gitignored; docs/acme.ini.example is the manual-setup version.
- Secret and log level come from `.env` (`ACME_SECURITY_SECRET`, `ACME_LOG_LEVEL`).

Setup and verification: docs/cse-setup.md.

Status: running in the Compose stack and registered to Mobius4 (verified 2026-10-13)
