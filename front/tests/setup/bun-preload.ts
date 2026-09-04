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
 * ALSO USED OUTSIDE TESTS: `bun run reextract` passes this file with an explicit
 * --preload, because bunfig.toml scopes `preload` to [test]. Keep it loadable
 * under a plain `bun run`. It is why reextract cannot run inside the container -
 * `.dockerignore` excludes `tests/`.
 */
mock.module('$env/dynamic/private', () => ({ env: process.env }));
mock.module('$env/dynamic/public', () => ({ env: process.env }));
mock.module('$env/static/private', () => process.env);
mock.module('$env/static/public', () => process.env);
