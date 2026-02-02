# Agent Info for Dream Analyst

This document serves as a guide for AI agents working on the Dream Analyst project. It outlines the project's structure, patterns, conventions, and essential commands.

## Overview

Dream Analyst is a SvelteKit-based web application for logging and analyzing dreams using AI. It features real-time streaming analysis, audio transcription for dream logging, and conversational chat for deeper exploration.

## Tech Stack

- **Framework:** SvelteKit (using [Svelte 5 runes](https://svelte.dev/blog/runes))
- **Language:** TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Cache/Real-time:** Redis (ioredis) for stream state management and Pub/Sub
- **Styling:** Tailwind CSS & DaisyUI
- **AI/LLM:** LangChain with OpenRouter (OpenAI-compatible)
- **I18n:** Paraglide-JS (Inlang)
- **Testing:** Playwright for E2E tests
- **Logging:** Basic `console.log/error/debug`

## Essential Commands

### Development

```bash
bun install    # Install dependencies
bun run dev    # Start development server
```

### Database

```bash
bun run prisma generate    # Generate Prisma client
bun run prisma migrate dev # Create and apply migrations
bun run prisma studio      # Open Prisma Studio UI
```

### Localization (i18n)

```bash
bun run machine-translate # Translate missing keys using Inlang
```

### Build & Production

```bash
bun run build # Build for production (node-adapter/bun-adapter)
bun run start # Run production build (includes migration deployment)
```

### Testing & Quality

```bash
bun run check  # Type-check Svelte and TypeScript
bun run lint   # Lint code with ESLint and Prettier
bun run format # Format code with Prettier
bun run e2e    # Run Playwright E2E tests
```

## Project Structure

- `src/lib/`: Core logic and shared resources.
  - `client/`: Frontend-specific logic.
    - `components/`: [Svelte 5 components](https://svelte.dev/docs/svelte/runes) (using `$state`, `$derived`, `$effect`, `$props`).
    - `services/`: Client-side services (e.g., `DreamAnalysisService` for streaming).
  - `server/`: Backend-specific logic.
    - `db/`: Prisma client initialization (`src/lib/server/db/index.ts`).
    - `auth.ts`: JWT-based authentication.
    - `llmService.ts`: Low-level LLM interactions.
    - `dreamAnalysisService.ts`: Orchestrates dream analysis, titles, and relations.
    - `streamProcessor.ts`: Manages background streaming tasks.
    - `streamStateStore.ts`: Redis-backed state and Pub/Sub for analysis streams.
    - `creditService.ts`: Manages user quotas/credits.
  - `prompts/`: AI system prompts and knowledge bases.
- `src/routes/`: SvelteKit pages and API endpoints.
  - Real-time streaming is handled via `api/dreams/[id]/stream-analysis`.
- `prisma/`: Database schema and migrations.
- `messages/`: Localization JSON files.

## Code Patterns & Conventions

### Iterative Development

- **Small, Bounded Updates:** Only produce small, incremental changes to the code. Avoid large-scale refactors in a single step.
- **Controlled Updates:** Focus on one specific feature or fix at a time to ensure stability and easier debugging.
- **Test, test, test** Always provide test suite to know the behavior of your changes

### Bounded context

- Only read a few files per request
- Avoid adding a lot of context into your queries : they make you loose focus

### Svelte 5 Runes

Always use Svelte 5 runes style in `.svelte` files:

- Use `$props()` for component parameters.
- Use `$state()` for reactive variables.
- Use `$effect()` for side effects.
- Use `$derived()` for computed reactive values.
- Prefer `onclick={...}` over `on:click={...}`.

### Real-time Streaming Architecture

The app uses a sophisticated streaming setup:

1. **Client** initiates a `GET` request to `/api/dreams/[id]/stream-analysis`.
2. **Server** checks if an analysis task exists in Redis/memory.
3. If not, it launches a `StreamProcessor` that runs independently of the request.
4. The `StreamProcessor` streams from the LLM, updates the DB/Redis, and publishes updates to a Redis channel.
5. The `GET` request handler subscribes to the Redis channel and sends NDJSON chunks back to the client.

### Error Handling

- **Server:** Use `throw error(status, message)` in SvelteKit load functions and actions.
- **Client:** Handle streaming errors via callbacks in `DreamAnalysisService`.
- **LLM:** Use `AbortSignal` for cancellation to avoid unnecessary API costs.

### Authentication & Authorization

- Auth is handled via a JWT cookie (`auth_token`).
- `src/hooks.server.ts` populates `event.locals.user`.
- Always verify `locals.user` in `+page.server.ts` or `+server.ts` before performing sensitive operations.

### Database access

- Use `getPrismaClient()` from `$lib/server/db` instead of importing `PrismaClient` directly to ensure correct adapter configuration (especially for PostgreSQL).

## Localization (i18n)

- Use `* as m from '$lib/paraglide/messages'` for translated strings.
- Pass parameters to translation functions if needed: `m.hello({ name: 'World' })`.

## Gotchas

- **Streaming Persistence:** The server continues processing the LLM stream even if the client disconnects, unless explicitly canceled via the `/api/dreams/[id]/cancel-analysis` endpoint. This is to ensure DB updates (like full interpretation saving) complete.
- **Redis Dependency:** Redis is required for real-time analysis updates. If Redis is down, streaming won't work correctly.
- **Credits:** Most AI-related actions (Analysis, Chat) require credits defined in `CreditService`.
- **Search:** Prisma full-text search is used for dreams. Ensure the PostgreSQL provider supports it.
- **Prisma fullTextSearchPostgres:** This preview feature is enabled in `schema.prisma`.

## Memory Management for Agents

If you discover new build steps or important environment variables, update this section in your session or update this file.

- `DATABASE_URL`: Required for Prisma.
- `REDIS_URL`: Required for streaming.
- `OPENROUTER_API_KEY`: Required for AI features.
- `JWT_SECRET`: Required for auth.
