# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
RUN apk add --no-cache bash curl unzip
RUN curl -fsSl -o install https://bun.sh/install && chmod +x ./install && BUN_INSTALL="/usr/local" ./install

WORKDIR /app
COPY package.json bun.lock ./
# Explicit rather than `bun ci`, so a lockfile that drifts from package.json
# fails the build instead of being silently resolved.
RUN bun install --frozen-lockfile

COPY . .
# prisma generate never connects; prisma.config.ts falls back to a placeholder
# URL, so no DATABASE_URL needs to be threaded through the build.
RUN bun run generate
RUN bun run build

# Production dependencies only, resolved separately so the runner does not carry
# the dev tree (previously the entire node_modules was copied, ~900MB including
# eslint, playwright, svelte-check and the Prisma engines' build tooling).
# The Prisma client is generated again here because it is emitted INTO
# node_modules/@prisma/client, which this stage installs fresh.
FROM builder AS prod-deps
WORKDIR /app
RUN rm -rf node_modules && bun install --frozen-lockfile --production && bun run prisma generate

FROM node:22-alpine AS runner
# The base image ships the npm CLI, which nothing here runs - `bun start` calls
# `bun run prisma migrate deploy` and then bun serves the build. It is dead
# weight that carried half the image's fixable HIGH CVEs (tar, pacote, sigstore,
# picomatch, brace-expansion, ip-address) purely as npm's own dependencies.
# node itself stays: the Prisma CLI needs it.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# OpenSSL is in the TLS path for every outbound LLM and database call, so it is
# worth patching ahead of a base-image bump rather than waiting for one.
RUN apk upgrade --no-cache libcrypto3 libssl3

COPY --from=builder /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=builder /app/build /app/build
COPY --from=builder /app/package.json /app/
COPY --from=builder /app/prisma.config.ts /app/
# prisma/ carries the migrations that `bun start` applies. See .dockerignore:
# this directory was excluded for the life of the deployment, which made
# `prisma migrate deploy` a silent no-op.
COPY --from=builder /app/prisma /app/prisma
COPY --from=builder /app/scripts /app/scripts
# scripts/migrate-deploy.ts imports this for its JSON log formatting.
COPY --from=builder /app/src/lib/server/logger.ts /app/src/lib/server/logger.ts

# Run unprivileged. `node` (uid 1000) already exists in the base image.
RUN chown -R node:node /app
USER node

ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "start"]
