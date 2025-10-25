FROM node:slim AS builder

# Install Bun as package manager
RUN npm install -g bun

# Install system dependencies for Playwright
RUN apt update -qq && \
    apt install -y python-is-python3 pkg-config build-essential

WORKDIR /app
COPY package.json bun.lock ./
RUN bun ci

# Install Playwright with Chromium
RUN npx playwright install --with-deps chromium

# Copy source and build
COPY . .
RUN --mount=type=secret,id=ADMIN_PASSWORD \
    --mount=type=secret,id=ORIGIN \
    ADMIN_PASSWORD="$(cat /run/secrets/ADMIN_PASSWORD)" \
    ORIGIN="$(cat /run/secrets/ORIGIN)" \
    bun run build

FROM node:slim AS runner

RUN npm install -g bun

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/build /app/build
COPY --from=builder /app/package.json /app
WORKDIR /app
ENV NODE_ENV=production
CMD [ "bun", "./build/index.js"]