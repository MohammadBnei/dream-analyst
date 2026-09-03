# dream-analyst

SvelteKit dream journal with LLM analysis. App code is in `front/`; `helm/` deploys it.

## Commands

Run everything from `front/`. This project uses **Bun**, not npm.

```sh
bun run dev            # dev server
bun run check          # svelte-check — runs prisma generate + paraglide compile first
bun run lint           # prettier --check + eslint
bun test src/          # unit tests (bun's runner, not vitest)
bun run e2e            # Playwright — starts its own server
```

`check`, `lint`, `bun test` and `e2e` all gate the Docker build in CI. Keep them at zero.

## Conventions

**Validation is valibot.** Not zod — it was removed after being used undeclared, mixing v3 and v4
APIs. Shared schemas live next to the route that owns them.

**Form actions are the write path.** Dream CRUD goes through `+page.server.ts` actions, wrapped in
`dreamAction()` from `$lib/server/guards`, which handles the session check, ownership lookup, form
parsing and error mapping. REST endpoints exist only where the protocol needs them: streaming
analysis, chat, cancel, chat-message delete, transcribe. Don't add a REST route for something a
form action can do — three parallel CRUD implementations is what this codebase was recovering from.

**Ownership answers 404, not 403.** A 403 confirms the id exists to someone who doesn't own it.

**Never import prompt text client-side.** `$lib/server/prompts/**` is server-only for a reason: a
client component once imported `promptService` as a value to read four names and shipped 45KB of
system prompts to every visitor. Prompt *type identifiers* live in `$lib/promptTypes`, which is
client-safe.

**Configuration is validated lazily, never at module scope.** See `src/lib/server/env.ts` and the
comment on `jwtSecret()` in `auth.ts` — a module-scope throw also fires during `vite build`, which
breaks the image build rather than reporting a misconfigured deployment.

**Credits are money.** Charges use a conditional `updateMany` guarded on sufficient balance, inside
a transaction behind a per-user advisory lock, with a DB `CHECK (credits >= 0)` as backstop. Don't
reintroduce read-modify-write. `pg_advisory_xact_lock` returns void, so it needs `$executeRaw`, not
`$queryRaw`.

**Svelte 5 runes throughout.** `interface Props` + `let { … }: Props = $props()`. Mirror load data
with `$derived`, not `$state` plus a syncing `$effect`. Never assign to a `$derived`.

**`src/lib/client/audio/stt-capture.js` is vendored** from MohammadBnei/ukubi-stt and must stay
byte-identical to upstream. It is in `.prettierignore`, and `checkJs` is off because of it.

## Gotchas

- `/healthz` is liveness only. Dependency checks belong on `/readyz`; putting them on liveness
  means a Redis blip restarts the pod and kills in-flight analyses.
- `prisma/migrations` must stay OUT of `.dockerignore`. It was excluded for the life of the
  deployment, which made `prisma migrate deploy` a silent no-op.
- `@sveltejs/kit` and `@prisma/adapter-pg` are runtime **dependencies**, not devDependencies. The
  adapter output externalizes Kit, so pruning dev deps without this breaks the server.
- The stream processor map is process-local. Cancel only works on the pod running the analysis;
  recovery from a restart is Redis key expiry.
