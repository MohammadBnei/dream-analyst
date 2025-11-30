FROM node:22-alpine AS builder

RUN apk update -qq && apk add bash curl unzip

RUN curl -fsSl -o install https://bun.sh/install && chmod +x ./install && BUN_INSTALL="/usr/local" ./install

WORKDIR /app
COPY package.json bun.lock ./
RUN bun ci

# Copy source and build
COPY . .

RUN bun run prisma generate
RUN bun run build

FROM node:22-alpine AS runner

COPY --from=builder /usr/local/bin/bun /usr/local/bin/bun

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/build /app/build
COPY --from=builder /app/package.json /app
COPY --from=builder /app/prisma /app/prisma

WORKDIR /app
ENV NODE_ENV=production
CMD [ "bun", "start"]
