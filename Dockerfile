FROM node:alpine AS builder

# Install Bun as package manager
RUN npm install -g bun

WORKDIR /app
COPY package.json bun.lock ./
RUN bun ci

# Copy source and build
COPY . .

RUN bun run prisma generate
RUN bun run build

FROM node:alpine AS runner

RUN npm install -g bun

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/build /app/build
COPY --from=builder /app/package.json /app
WORKDIR /app
ENV NODE_ENV=production
CMD [ "bun", "start"]