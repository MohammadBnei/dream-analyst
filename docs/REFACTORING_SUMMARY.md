# Dream Analyst Refactoring Summary

## ✅ Completed: Event-Driven Actor Model Implementation

### What We Built

We successfully refactored Dream Analyst from a monolithic service architecture to an **event-driven actor model** with explicit state machine control and hybrid versioning.

---

## New Architecture Components

### 1. Core Infrastructure

#### EventBus (`src/lib/server/eventBus.ts`)

- Lightweight in-memory Pub/Sub for inter-actor communication
- Supports event subscription, emission, and waiting for specific events
- Maintains event history for debugging (last 1000 events)
- No external dependencies (Redis not required for event bus)

#### DreamStateMachine (`src/lib/server/dreamStateMachine.ts`)

- Explicit state management with 7 states:
  - `CREATED` → `ENRICHING` → `INTERPRETING` → `COMPLETED`
  - `ENRICHING_REVISION` → `INTERPRETING_REVISION` (for edits)
  - `FAILED` (for errors with retry capability)
- Validates state transitions to prevent invalid flows
- Maps internal states to Prisma `DreamStatus` enum

#### DreamRepository (`src/lib/server/dreamRepository.ts`)

- Centralized database access layer (encapsulates all Prisma operations)
- Handles dream CRUD, relationships, search, and state history
- Records state change events for versioning

---

### 2. Actor System

#### Base Actor (`src/lib/server/actors/DreamActor.ts`)

Abstract base class defining the actor contract:

- `name`: Actor identifier
- `dependsOn`: Events to wait for before execution
- `triggers`: Events that trigger this actor
- `allowedInStates`: States where actor can run
- `execute()`: Core logic (implemented by subclasses)

#### Enrichment Actors (run in parallel)

**TitleGenerationActor** (`src/lib/server/actors/TitleGenerationActor.ts`)

- Generates concise, evocative dream titles using LLM
- Soft failure: falls back to "Untitled Dream" on error
- **Dependencies**: None
- **Triggers**: `ENRICHMENT_STARTED`

**ContextGatheringActor** (`src/lib/server/actors/ContextGatheringActor.ts`)

- Fetches last 3 dreams for context
- Formats context string for interpretation
- Soft failure: continues without context on error
- **Dependencies**: None
- **Triggers**: `ENRICHMENT_STARTED`

**RelationshipActor** (`src/lib/server/actors/RelationshipActor.ts`)

- Extracts keywords from dream using LLM
- Performs full-text search for related dreams
- Links related dreams in database
- Soft failure: continues without relationships on error
- **Dependencies**: None
- **Triggers**: `ENRICHMENT_STARTED`

#### Interpretation Actor

**InterpretationActor** (`src/lib/server/actors/InterpretationActor.ts`)

- Streams LLM interpretation using gathered context
- Emits `INTERPRETATION_CHUNK` events for real-time updates
- Saves final interpretation to database
- Hard failure: analysis fails if this actor fails
- **Dependencies**: `TitleGenerationActor_COMPLETE`, `ContextGatheringActor_COMPLETE`, `RelationshipActor_COMPLETE`
- **Triggers**: `INTERPRETATION_STARTED`

---

### 3. Orchestration

#### PipelineCoordinator (`src/lib/server/pipelineCoordinator.ts`)

- Initializes and coordinates all actors
- Manages state transitions based on actor completions
- Records state changes for versioning
- Handles enrichment completion (waits for all 3 enrichment actors)
- Handles interpretation completion/failure
- Provides `startAnalysis(dreamId)` entry point

---

### 4. Database Schema Changes

Added to `prisma/schema.prisma`:

```prisma
model Dream {
  // ... existing fields ...
  state   String? @default("CREATED")  // Internal state machine state
  version Int     @default(0)          // Version counter
  
  stateHistory DreamStateChangeEvent[] @relation("DreamStateHistory")
}

model DreamStateChangeEvent {
  id        String   @id @default(uuid())
  dreamId   String
  version   Int
  eventType String   // 'CREATED', 'ENRICHED', 'INTERPRETED', 'EDITED', 'FAILED'
  state     String   // DreamState string
  
  // Deltas (what changed)
  oldRawText        String?
  newRawText        String?
  oldInterpretation String?
  newInterpretation String?
  oldTitle          String?
  newTitle          String?
  
  createdAt DateTime @default(now())
  
  @@unique([dreamId, version])
  @@index([dreamId, version])
}
```

---

### 5. Updated Routes

#### `/dreams/new` (`src/routes/dreams/new/+page.server.ts`)

**Before:**

- Created dream
- Called `generateDreamTitle()` and `findAndSetRelatedDreams()` manually
- Redirected to dream page

**After:**

- Creates dream in `CREATED` state
- Calls `coordinator.startAnalysis(dreamId)`
- Redirects (actors handle everything in background)

#### `/api/dreams/[id]/stream-analysis` (`src/routes/api/dreams/[id]/stream-analysis/+server.ts`)

**Before:**

- Used Redis Pub/Sub for streaming
- Managed `StreamProcessor` lifecycle

**After:**

- Subscribes to EventBus for real-time updates
- Listens to `INTERPRETATION_CHUNK` and `STATE_CHANGED` events
- Returns NDJSON stream of updates

---

## How It Works: Example Flow

### User Creates a New Dream

1. **User submits dream text** → POST `/dreams/new`
2. **Dream created** in DB with `state: CREATED`, `version: 0`
3. **Coordinator starts analysis** → `coordinator.startAnalysis(dreamId)`
4. **State transition**: `CREATED` → `ENRICHING`
5. **EventBus emits**: `ENRICHMENT_STARTED`

### Enrichment Phase (Parallel)

1. **All 3 actors fire simultaneously:**
   - `TitleGenerationActor` → Generates title → Emits `TitleGenerationActor_COMPLETE`
   - `ContextGatheringActor` → Fetches context → Emits `ContextGatheringActor_COMPLETE`
   - `RelationshipActor` → Finds related dreams → Emits `RelationshipActor_COMPLETE`

2. **Coordinator sees all 3 complete**
3. **State transition**: `ENRICHING` → `INTERPRETING`
4. **EventBus emits**: `INTERPRETATION_STARTED`

### Interpretation Phase

1. **InterpretationActor fires:**
    - Waits for enrichment actor completions (dependencies)
    - Fetches dream with relations
    - Streams LLM interpretation
    - Emits `INTERPRETATION_CHUNK` for each chunk (real-time streaming)
    - Saves final interpretation to DB
    - Emits `InterpretationActor_COMPLETE`

2. **Coordinator sees completion**
3. **State transition**: `INTERPRETING` → `COMPLETED`
4. **Version incremented** and state change recorded in `DreamStateChangeEvent`

---

## Benefits of New Architecture

### ✅ Scalability

- Adding new actors (e.g., `TaggingActor`, `InterviewingAgent`) requires no changes to existing code
- Just create a new actor class and wire it into the coordinator

### ✅ Resilience

- Soft failures (title generation, context gathering) don't break the flow
- Hard failures (interpretation) transition to `FAILED` state with retry capability

### ✅ Parallelization

- Enrichment actors run in parallel → faster analysis
- Interpretation waits for all enrichment to complete via dependencies

### ✅ Debuggability

- Explicit state machine makes flow visible
- Event history shows what happened and when
- State change events create audit trail

### ✅ Testability

- Each actor is independently testable
- Mock EventBus and DreamRepository for unit tests
- State machine validates transitions

### ✅ Versioning

- Every state change is recorded with version number
- Can query dream's full journey: `dreamRepository.getStateHistory(dreamId)`
- Future: compare interpretations v1 vs v2

---

## Next Steps

### To Complete Refactoring

1. **Run database migration** (when DB is accessible):

   ```bash
   bun run prisma migrate dev --name add_state_machine_and_versioning
   ```

2. **Remove old services** (after testing):
   - `src/lib/server/dreamAnalysisService.ts` (replaced by actors)
   - `src/lib/server/streamProcessor.ts` (replaced by InterpretationActor + Coordinator)
   - `src/lib/server/streamStateStore.ts` (Redis no longer needed for streaming)

3. **Update remaining routes** that use old services:
   - `/api/dreams/[id]/interpretation` (if it exists)
   - Any chat endpoints that reference old services

4. **Add unit tests** for each actor

### Future Features (Easy to Add)

**TaggingActor:**

```typescript
class TaggingActor extends DreamActor {
  name = 'TaggingActor';
  dependsOn = ['InterpretationActor_COMPLETE'];
  triggers = ['INTERPRETATION_STARTED'];
  allowedInStates = [DreamState.INTERPRETING];
  
  async execute(dream: Dream) {
    // Extract tags from interpretation
    // Save to DB
  }
}
```

**InterviewingAgent** (for agentic entry):

```typescript
class InterviewingAgent extends DreamActor {
  name = 'InterviewingAgent';
  dependsOn = [];
  triggers = ['DREAM_CREATED'];
  allowedInStates = [DreamState.CREATED];
  
  async execute(dream: Dream) {
    // Multi-turn conversation to help user enter dream
    // Emit INTERVIEW_COMPLETE when done
  }
}
```

---

## Files Created

- `src/lib/server/eventBus.ts`
- `src/lib/server/dreamStateMachine.ts`
- `src/lib/server/dreamRepository.ts`
- `src/lib/server/actors/DreamActor.ts`
- `src/lib/server/actors/TitleGenerationActor.ts`
- `src/lib/server/actors/ContextGatheringActor.ts`
- `src/lib/server/actors/RelationshipActor.ts`
- `src/lib/server/actors/InterpretationActor.ts`
- `src/lib/server/pipelineCoordinator.ts`
- `docs/adr/ADR-001-event-driven-actor-model-with-versioning.md`
- `docs/REFACTORING_SUMMARY.md` (this file)

## Files Modified

- `prisma/schema.prisma` (added `state`, `version`, `DreamStateChangeEvent`)
- `src/routes/dreams/new/+page.server.ts` (uses coordinator)
- `src/routes/api/dreams/[id]/stream-analysis/+server.ts` (uses EventBus)

---

**The refactoring is complete and ready for testing once the database migration runs!** 🎉
