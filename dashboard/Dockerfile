# GridSense dashboard (Next.js) and, as a separate target, the DEV ONLY feed.
#
#   docker compose up -d                 # dashboard (default target: runner)
#   docker compose --profile dev up -d   # also the dev feed (target: dev-feed)

# Node 24 LTS. The dev feed runs TypeScript directly (Node type stripping).
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund


FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build


# DEV ONLY: stand-in for the devices and the Orchestrator (scripts/dev-feed.ts).
# Needs no npm packages; package.json only sets "type": "module".
FROM node:24-alpine AS dev-feed
WORKDIR /app
COPY package.json ./
COPY lib/onem2m.ts lib/gridsense.ts ./lib/
COPY scripts/dev-feed.ts ./scripts/
USER node
CMD ["node", "scripts/dev-feed.ts"]


# Production server: Next.js standalone output, files root-owned and read-only
# to the unprivileged node user. Only .next/cache is writable.
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
RUN mkdir -p .next/cache && chown node:node .next/cache
USER node
EXPOSE 3000
CMD ["node", "server.js"]
