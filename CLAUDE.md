# dream-analyst

SvelteKit dream journal: users record dreams, an LLM streams back an interpretation, and each
dream has its own chat. `front/` is the application, `helm/` deploys it, and `compose.yml` is at
the **repo root**, not in `front/`.

- `front/README.md` — setup, stack, health endpoints. Not repeated here.
- `front/document/FEATURE_CATALOG.md` — a product wish-list, not a spec. Most of it is unbuilt.
- ADRs referenced in comments (ADR-0001, ADR-0044, ADR-0046) live in the **`infra-bootstrap`**
  repo under `docs/adr/`, not here.

**The inline comments carry the rationale.** They lead with the failure that motivated the code —
read them before changing what they sit on, and don't strip them. This file exists for what no
single file can say.

## Commands

Run everything from `front/`. This project uses **Bun**, not npm.

```sh
bun run dev              # dev server (5173)
bun run check            # svelte-check; runs `generate` first
bun run lint             # prettier --check + eslint
bun test src/            # unit tests — no infrastructure
bun run test:integration # needs a live Postgres with migrations applied
bun run e2e              # Playwright; starts its own server on 4173
bun run generate         # prisma generate + paraglide compile
bun run build            # production build
bun start                # migrate-deploy, then serve (3000)
```

**Never run bare `bun test`.** It picks up `tests/integration/` and fails without a database.
Always `bun test src/`. Server modules are importable under `bun test` only because of
`tests/setup/bun-preload.ts` (wired in `bunfig.toml`) — read it if an `$env` import fails to
resolve.

CI is two jobs. `quality` runs check + lint + `bun test src/` with no database. `e2e` brings up
Postgres and Redis, applies migrations, then runs `test:integration` and Playwright. `build-push`
needs both, and Trivy fails the build on a fixable CRITICAL/HIGH.

## Where things live

`src/lib/server/` — `credits.ts`, `chat.ts`, `analysis.ts`, `relatedDreams.ts`, `guards.ts`,
`env.ts`, `auth.ts`, `db/`, `llmService.ts`, `streamProcessor.ts`, `streamStateStore.ts`,
`rateLimit.ts`, `logger.ts`, `search/tsquery.ts`, `prompts/`,
`infrastructure/transcription/sttService.ts`.

**`creditService.ts`, `chatService.ts` and `dreamAnalysisService.ts` no longer exist** — they were
singleton classes, replaced by the modules above. If a grep or a memory points you at them, it is
stale.

**But `src/lib/client/services/` are still classes.** "Services became functions" was server-side
only. `ClientChatService` and `DreamAnalysisService` are alive and unchanged.

`src/lib/paraglide/` and the Prisma client are **generated and gitignored**. Run `bun run generate`
after a clean checkout; `bun run check` does it for you.

## Locked decisions

**Validation is valibot.** Zod was removed after being used undeclared and mixing v3 with v4 APIs.
Schemas live beside the route that owns them. `login` and `register` are still hand-rolled checks —
that is a known exception, not the pattern to copy.

**Form actions are the write path.** Dream CRUD goes through `+page.server.ts` actions wrapped in
`dreamAction()` (`src/lib/server/guards.ts`), which handles the session check, ownership lookup,
form parsing and error mapping. REST exists only where the protocol needs it: stream-analysis,
chat-interpretation, cancel-analysis, chat-messages delete, transcribe. Don't add a REST route for
something a form action can do — three parallel CRUD implementations is what this repo was
recovering from.

**Ownership answers 404, not 403.** A 403 confirms to a stranger that the id exists.

**`error()` and `redirect()` signal by throwing, so resolve them outside `try`** — a `catch` will
otherwise turn a 404 into a 500. Where a wrapper must catch broadly, re-throw them first; see
`src/lib/server/guards.ts:75`.

**Domain modules take an optional trailing `prisma` param** defaulting to `getPrismaClient()`
(`credits.ts`, `chat.ts`, `analysis.ts`, `relatedDreams.ts`). Call sites pass nothing; tests pass
their own client. That is the only reason `tests/integration/` can exist.

**`getPrismaClient()` is synchronous.** Older call sites still `await` it harmlessly. Don't add the
`await` in new code.

**Configuration is validated lazily, never at module scope.** `src/lib/server/env.ts` parses every
variable through one valibot schema on first use, and reports all failures at once. It must stay
lazy: a module-scope throw also fires during `vite build`, which breaks the image build rather than
reporting a misconfigured deployment.

**Never import prompt text client-side.** `$lib/server/prompts/**` is server-only because a client
component once imported `promptService` as a value to read four names and shipped ~45KB of system
prompts to every visitor. Import `DreamPromptType` from `$lib/promptTypes`, always with the `type`
keyword.

**Credits are money.** Charges are a conditional `updateMany` guarded on sufficient balance, inside
a transaction behind a per-user advisory lock, with a DB `CHECK (credits >= 0)` as backstop. Don't
reintroduce read-modify-write. `pg_advisory_xact_lock` returns void, so it needs `$executeRaw`, not
`$queryRaw`. There is deliberately **no** unique index on daily grants — two historical
double-grant rows would block creating one, and deleting billing history to fit a constraint is the
wrong trade.

**One definition, enforced by having deleted the duplicates.** Status → CSS class:
`src/lib/client/dreamStatus.ts` (there were four, and they disagreed). NDJSON reading:
`src/lib/client/ndjson.ts` (there were two, and they had drifted). The dream search predicate:
`dreamSearchFilter` in `src/lib/server/search/tsquery.ts` (there were three). `use:enhance`
callback typing: `src/lib/client/enhance.ts`.

**i18n:** the base locale is **French**. Adding a key means editing `messages/fr.json` _and_
`messages/en.json`, then `bun run generate`. Missing one fails `bun run check`.

**ESLint escape hatches are one-line, scoped, and carry a reason.** Never file-level, never blanket.

**`src/lib/client/audio/stt-capture.js` is vendored** from MohammadBnei/ukubi-stt and must stay
byte-identical to upstream. It is why `checkJs` is off and why it is in `.prettierignore`.

## Svelte 5

The runes migration is **complete for props and events**: no `export let`, no `on:` handlers
anywhere. Write runes.

Mirror load data with `$derived`, never `$state` plus a syncing `$effect`. The one legitimate
exception is a field the user is actively editing, which must not be clobbered by an invalidation
(`DreamHeader.svelte`) — and the streaming state in `dreams/[id]/+page.svelte`, which runs ahead of
the database. Never assign to a `$derived`.

`$props()` in route files is fine untyped — SvelteKit generates the types from `./$types`.

## How an analysis flows

No single file holds this; it spans seven plus Redis pub/sub, and the producer and consumer never
appear in each other's call graph.

1. `routes/dreams/new/+page.server.ts` creates the dream `PENDING_ANALYSIS`, generates a title and
   related dreams, and redirects. **No analysis starts here.**
2. The client (`lib/client/services/dreamAnalysisService.ts`) opens
   `GET /api/dreams/[id]/stream-analysis`.
3. That endpoint either returns one final frame (already COMPLETED/FAILED), or marks the stream
   started and fire-and-forgets a `StreamProcessor`, then subscribes to Redis pub/sub and relays
   NDJSON to the browser.
4. `lib/server/streamProcessor.ts` consumes the LLM iterable, accumulates, writes Redis state and
   publishes each delta.
5. `lib/client/ndjson.ts` reads the frames back on the client.

Three invariants:

- **Published content is a delta, not the accumulated text.** A dropped frame loses words
  permanently. Do not "simplify" `publishUpdate` to send the accumulator.
- **The database is written only on `finalStatus`.** Redis is the in-flight source of truth; see
  the TTL and stall constants at the top of `streamStateStore.ts`.
- **The producer is deliberately not tied to `request.signal`**, so an analysis survives a page
  reload. It looks like a leak; it isn't.

## Gotchas

- `/healthz` is liveness only. Dependency checks belong on `/readyz` — putting them on liveness
  means a Redis blip restarts the pod and destroys every in-flight analysis.
- `prisma/migrations` must stay **out** of `.dockerignore`. It was excluded for the life of the
  deployment, which made `prisma migrate deploy` a silent no-op.
- `@sveltejs/kit` and `@prisma/adapter-pg` are runtime **dependencies**, not devDependencies. The
  adapter output externalizes Kit, so pruning dev deps without this breaks the server.
- The stream processor map is process-local. Cancel only works on the pod running the analysis;
  recovery from a restart is Redis key expiry.
- **Rate limiting fails open** if Redis is unreachable — deliberate, so a Redis outage cannot lock
  everyone out of login.
- `hooks.server.ts` re-reads the user from the database on **every** request. That read _is_ the
  revocation path: JWTs last 30 days and there is no other one. `isInternalAsset` skips it for
  `/_app/`, `/favicon.ico` and `/healthz`; `/readyz` is deliberately not skipped.

## Deliberate shortcuts

`grep -rn "ponytail:"` is the index. Each marker names its own ceiling and the upgrade path to take
when you hit it — take that path rather than inventing one. Don't add a marker without both.

## Known gaps

- **A dream's first analysis is free.** `dreams/new` makes three LLM calls and charges nothing;
  only re-analysis (`resetAnalysis`) and chat messages charge. Charging it is an open pricing
  decision, not a bug to fix silently.
