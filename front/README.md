# Dream Analyst

A SvelteKit application for dream journaling and AI interpretation. Users record dreams as text
or dictation, an LLM streams back an analysis in one of four styles, and each dream can be
discussed further in a per-dream chat.

## Features

- **Dream capture** — text entry, or streaming dictation. Audio is sent in ~560ms slices to a
  self-hosted [ukubi-stt](https://github.com/MohammadBnei/ukubi-stt) service over gRPC. (This is
  not the Web Speech API; the README claimed that for a long time after it stopped being true.)
- **Analysis** — streamed token by token via OpenRouter, in a Jungian, Freudian, simple or Islamic
  style. Produces a markdown interpretation plus symbolic tags.
- **Per-dream chat** — follow-up conversation with the analysis as context.
- **Related dreams** — Postgres full-text search over your own dreams, seeded by LLM-generated
  keywords.
- **Credits** — analysis and chat cost credits, with a daily allowance per role
  (BASIC / VIP / ADMIN). Enforced atomically; see `src/lib/server/creditService.ts`.
- **i18n** — French (default) and English via Paraglide.

## Stack

SvelteKit 2 · Svelte 5 (runes) · Prisma 7 + Postgres · Redis (streaming state and rate limits) ·
OpenRouter via the `openai` SDK · Tailwind 4 + daisyUI · Bun.

## Getting started

This project uses **Bun**, not npm.

```sh
bun install
cp .env.example .env          # then fill in the required values
docker compose up -d postgres redis
bunx prisma migrate deploy
bun run dev
```

`.env.example` documents every variable the server reads. `DATABASE_URL`, `JWT_SECRET`,
`REDIS_URL` and `OPENROUTER_API_KEY` are required; the rest have defaults. Configuration is
validated on first use and fails naming the offending variable.

## Commands

```sh
bun run dev        # dev server
bun run build      # production build
bun run check      # svelte-check (runs the Prisma and Paraglide generators first)
bun run lint       # prettier --check + eslint
bun test src/      # unit tests
bun run e2e        # Playwright (starts its own server)
```

`bun run check`, `bun run lint` and both test suites gate the Docker build in CI.

## Deployment

Built with `svelte-adapter-bun` and shipped as a container. `bun start` applies pending Prisma
migrations and then serves on port 3000. Health endpoints:

- `/healthz` — liveness. The process is up; deliberately checks nothing else.
- `/readyz` — readiness. Verifies Postgres and Redis, and returns 503 naming the failed
  dependency.

They are separate on purpose: attaching dependency checks to the liveness probe would let a
transient Redis blip restart the pod and destroy every in-flight analysis.

Deployed to Kubernetes via `helm/values.yaml`.
