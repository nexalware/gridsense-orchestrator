# ACME as the GridSense site MN-CSE. ACME is installed from PyPI, not copied
# into this repo. Its config is acme.ini next to this file.
FROM python:3.12-slim

# Pinned: the setup in docs/cse-setup.md was verified against this version.
ARG ACMECSE_VERSION=2026.5.3
RUN pip install --no-cache-dir "acmecse==${ACMECSE_VERSION}"

# Unprivileged user. /acme is ACME's base directory. The config stays root-owned
# and read-only; only /acme/data (TinyDB, on a named volume) is writable. The
# directory is created here so a fresh named volume inherits its ownership.
RUN useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin acme \
 && mkdir -p /acme/data \
 && chown acme:acme /acme/data
COPY acme.ini /acme/acme.ini

USER acme
WORKDIR /acme

# Log lines reach `docker compose logs` without buffering delay. Without a TTY
# ACME's console library assumes 80 columns and wraps log lines, which splits
# messages such as "Registered to registrar CSE: /Mobius4" and breaks grep.
ENV PYTHONUNBUFFERED=1 \
    COLUMNS=200

# Read by acme.ini. docker-compose.yml passes it from .env.
ENV ACME_LOG_LEVEL=info

EXPOSE 8081

# ACME installs no SIGTERM handler, and Python as PID 1 ignores SIGTERM, so a
# plain `docker stop` would wait out the timeout and then kill it. SIGINT is
# the Ctrl-C ACME handles, which shuts it down cleanly and flushes TinyDB.
STOPSIGNAL SIGINT

# Retrieve the CSEBase as the admin originator: proves the HTTP binding and the
# CSE answer, not just that the port is open.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD ["python", "-c", "import urllib.request as u; u.urlopen(u.Request('http://127.0.0.1:8081/cse-mn', headers={'X-M2M-Origin': 'CAdmin', 'X-M2M-RI': 'healthcheck', 'X-M2M-RVI': '3', 'Accept': 'application/json'}), timeout=4)"]

# Not --headless: in ACME 2026.5.3 headless mode also turns off screen logging,
# which would leave `docker compose logs acme-site` empty. Without a TTY the
# console's key reader is skipped and ACME just logs to stdout.
# ACME skips its onboarding wizard because acme.ini already exists.
CMD ["acmecse", "--base-directory", "/acme"]
