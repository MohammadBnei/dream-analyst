# Dream Analyst

A SvelteKit application for dream journaling and AI interpretation. Users record dreams as text
or dictation, an LLM streams back an analysis in one of four styles, each dream is decomposed into
a personal symbol vocabulary, and each dream can be discussed further in a per-dream chat.

The application lives in `front/`. `helm/` deploys it and `compose.yml` (repo root) brings up its
dependencies.

## Features

- **Dream capture** — text entry, or streaming dictation. Audio is sent in 560ms slices to a
  self-hosted [ukubi-stt](https://github.com/MohammadBnei/ukubi-stt) service over native gRPC
  (h2c, hand-framed — see `src/lib/server/infrastructure/transcription/sttService.ts`). (This is
  not the Web Speech API; the README claimed that for a long time after it stopped being true.)
- **Analysis** — streamed token by token via OpenRouter, in a Jungian, Freudian, simple or Islamic
  style. Produces a markdown interpretation. Redis carries the in-flight stream, so the analysis
  survives a page reload.
- **Elements and vocabulary** — after an analysis, two agents on two models decompose the dream
  into typed elements (symbol / character / setting / action / emotion), canonicalised against
  entries the dreamer has used before, with a coarse valence and intensity per occurrence. Free,
  idempotent and re-runnable over the whole corpus (`bun run reextract`), because the taxonomy is
  expected to move.
- **Related dreams** — two separate signals, kept apart all the way into the prompt: the recent
  series (the last 5 dreams, oldest first) and the echoes (older dreams sharing canonicalised
  vocabulary, most overlap first, deliberately not ordered by date). The earlier LLM-keyword +
  full-text approach is gone; full-text search remains for the dream list's search box.
- **Per-dream chat** — follow-up conversation with the analysis as context.
- **Credits** — a daily grant per role (BASIC / VIP / ADMIN) and a separate, larger daily spend
  cap, enforced atomically; see `src/lib/server/credits.ts`. Charged: every analysis (the first
  one included) and every chat message. A failed run gets exactly one free retry. **Not** charged:
  title generation, element extraction and related-dream discovery — all cheap-model calls, free
  by design so that re-extraction stays cheap enough to run on a whim. Balance and today's usage
  are on the profile page; `/admin` grants and deducts.
- **i18n** — French (default) and English via Paraglide.

## Stack

SvelteKit 2 · Svelte 5 (runes) · Vite 8 · Prisma 7 + Postgres · Redis (streaming state and rate
limits) · OpenRouter via the `openai` SDK · valibot · Tailwind 4 + daisyUI · Bun.

## Getting started

This project uses **Bun**, not npm. Everything below runs from `front/`, except
`docker compose`, which runs from the repo root.

```sh
docker compose up -d postgres redis   # repo root
cd front
bun install
cp .env.example .env                  # then fill in the required values
bunx prisma migrate deploy
bun run dev
```

`.env.example` documents every variable the server reads. `DATABASE_URL`, `JWT_SECRET`,
`REDIS_URL` and `OPENROUTER_API_KEY` are required; the rest have defaults. Configuration is
validated on first use and fails naming every offending variable at once. Model names can also be
overridden at runtime by rows in the `app_setting` table, without a deploy.

## Commands

```sh
bun run dev        # dev server (5173)
bun run build      # production build
bun run check      # svelte-check (runs the Prisma and Paraglide generators first)
bun run lint       # prettier --check + eslint
bun test src/            # unit tests (no infrastructure)
bun run test:integration # needs a running Postgres with migrations applied
bun run e2e              # Playwright (starts its own server on 4173)
bun run reextract        # re-run element extraction over the corpus; workstation tool
```

Run `bun test src/`, never bare `bun test` — the latter picks up `tests/integration/` and fails
without a database.

## CI

One workflow, `.github/workflows/docker.yml`: `quality` (check + lint + unit tests, no database),
`e2e` (Postgres and Redis, migrations, integration tests and Playwright) and `scan` (Trivy, which
fails the build on a fixable CRITICAL/HIGH) gate `release`, which bumps the version and changelog.
`build-push` then builds the image onto the LAN registry — the only job on the self-hosted runner,
and only because that registry is not reachable from anywhere else — and `deploy` rolls it out.

## Deployment

Built with `svelte-adapter-bun` and shipped as a container. `bun start` applies pending Prisma
migrations and then serves on port 3000. Health endpoints:

- `/healthz` — liveness. The process is up; deliberately checks nothing else.
- `/readyz` — readiness. Verifies Postgres and Redis, and returns 503 naming the failed
  dependency.

They are separate on purpose: attaching dependency checks to the liveness probe would let a
transient Redis blip restart the pod and destroy every in-flight analysis.

Deployed to Kubernetes via `helm/values.yaml`. Single replica: the map of in-flight analyses is
process-local, so a second replica would run its own.
