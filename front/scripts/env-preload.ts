import { mock } from 'bun:test';

/**
 * SvelteKit's `$env` modules are virtual - Vite provides them, so anything that
 * imports them (directly or transitively) cannot be loaded by `bun test`. That
 * blocked unit-testing the entire server layer: every service reaches
 * serverEnv(), which imports $env/dynamic/private.
 *
 * `$env/dynamic/private` is process.env at runtime, so the stub is the real
 * thing. Registered via bunfig.toml `preload`.
 *
 * Lives in `scripts/`, NOT in `tests/`, and that placement is load-bearing:
 * `.dockerignore` excludes `tests/`, so while this file lived there `bun run
 * reextract` could not run inside the deployed container at all - which made the
 * only backfill tool a workstation-only affair and left every pre-existing dream
 * without elements after a deploy.
 *
 * Two consumers: `bunfig.toml` preloads it for `bun test`, and `bun run
 * reextract` passes it explicitly (bunfig scopes `preload` to [test]).
 */
mock.module('$env/dynamic/private', () => ({ env: process.env }));
mock.module('$env/dynamic/public', () => ({ env: process.env }));
mock.module('$env/static/private', () => process.env);
mock.module('$env/static/public', () => process.env);
