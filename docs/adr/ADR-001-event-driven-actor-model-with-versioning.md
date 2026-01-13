# ADR-001: Event-Driven Actor Model with State Machine and Hybrid Versioning

**Date:** January 13, 2026  
**Status:** Proposed  
**Decision Makers:** Development Team  

---

## Context

Dream Analyst currently uses a monolithic service architecture (`DreamAnalysisService` and `StreamProcessor`) that tightly couples:

- Dream enrichment logic (title generation, context gathering, relationship finding)
- LLM interpretation orchestration
- Stream processing and persistence
- Long-running background task management

As the application grows to support new features (agentic multi-turn interviews, automated tagging, summarization, feedback collection), this architecture introduces several challenges:

1. **Scalability**: Adding new analysis steps requires modifying core orchestration logic
2. **Resilience**: A failure in one step (e.g., LLM timeout) can cascade and break the entire flow
3. **Debuggability**: State is implicit and distributed; hard to track where a dream is in its analysis
4. **Testability**: Heavy interdependencies and implicit ordering make unit testing difficult
5. **Parallelization**: Current architecture doesn't naturally support running independent tasks in parallel

Additionally, we lack visibility into the evolution of a dream. Once an interpretation is generated and later the user edits the dream, the old analysis is lost with no audit trail.

---

## Decision

We will refactor Dream Analyst to use:

### 1. Event-Driven Actor Model with Explicit State Machine

**Architecture:**

- **Actors**: Independent, single-responsibility units that execute specific tasks (e.g., `TitleGenerationActor`, `InterpretationActor`, `TaggingActor`)
- **Event Bus**: A lightweight, in-memory Pub/Sub mechanism for inter-actor communication (no Redis dependency required)
- **State Machine**: An explicit, linear state machine that gates which actors can run in which states
- **Coordinator**: A minimal orchestrator that:
  - Triggers state transitions based on actor completion
  - Synthesizes milestone events (e.g., `CONTEXT_READY` when all enrichment actors complete)
  - Handles retry logic and failure cascades

**State Flow:**

```
CREATED 
  ↓
ENRICHING (TitleActor, ContextActor, RelationshipActor run in parallel)
  ↓ [Success]
INTERPRETING (InterpretationActor)
  ↓ [Success]
COMPLETED

Transitions:
- ENRICHING → INTERPRETING (when all enrichment actors complete)
- Any state → FAILED (on hard failures like LLM interpretation errors)
- COMPLETED → ENRICHING_REVISION (when user edits dream.rawText)
- FAILED → INTERPRETING (on user retry)
```

**Actor Declaration:**

```typescript
abstract class DreamActor {
  abstract name: string;
  abstract dependsOn: string[];           // Events this actor waits for
  abstract triggers: string[];            // Events that trigger this actor
  abstract allowedInStates: DreamState[]; // States where this actor can run
  
  protected abstract execute(dream: Dream): Promise<any>;
}
```

### 2. Hybrid Versioning with State Change Event Log

**Schema:**

- **Dream** table: Single current state with `version` counter (Int, increments on each edit)
- **DreamStateChangeEvent** table: Immutable event log capturing every state transition

**Event Record:**

```prisma
model DreamStateChangeEvent {
  id        String  @id @default(cuid())
  dreamId   String
  version   Int     // Version after this event
  eventType String  // 'CREATED', 'ENRICHED', 'INTERPRETED', 'EDITED', 'FAILED', 'RETRIED'
  state     DreamStatus
  
  // Deltas: what changed
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

**Usage Pattern:**

```typescript
// When an actor completes successfully:
await eventLog.recordStateChange({
  dreamId,
  newVersion: dream.version + 1,
  eventType: 'INTERPRETED',
  state: DreamStatus.COMPLETED,
  oldInterpretation: dream.interpretation,
  newInterpretation: result.interpretation
});

// Then update the main Dream table:
await dreamRepository.updateDream(dreamId, {
  version: dream.version + 1,
  interpretation: result.interpretation,
  status: DreamStatus.COMPLETED
});
```

---

## Rationale

### Why Event-Driven Actors?

1. **Modularity**: Each actor is a standalone, testable unit. New features (e.g., `SummarizerActor`, `InterviewingAgent`) are added as new actor classes with no changes to existing logic.

2. **Parallelization**: Actors with no dependencies run in parallel. TitleActor, ContextActor, and RelationshipActor all execute concurrently in ENRICHING state, reducing total time-to-interpretation.

3. **Resilience**: Soft failures (unavailable past dreams) don't block analysis. Hard failures (LLM interpretation error) transition to FAILED state, allowing retry without cascading corruption.

4. **Clear State**: The state machine makes it explicit where a dream is in its lifecycle. Debugging is simpler: "Is it ENRICHING or INTERPRETING?"

5. **Easy Extension**: Adding agentic multi-turn interview flow is a matter of adding an `InterviewingAgent` with `allowedInStates: ['CREATED']` that emits `INTERVIEW_COMPLETE` before ENRICHING can start.

### Why Explicit State Machine (vs. Auto-Orchestration)?

We considered allowing actors to self-orchestrate via dependency declaration (`dependsOn: ['CONTEXT_READY']`). However, explicit state gating provides:

1. **Prevention**: An actor literally cannot run in the wrong state. No implicit milestone event logic that could break.
2. **Debuggability**: "Where is this dream?" → Check the state column in the DB.
3. **Clarity**: State transitions are the "happy path" spec. Developers understand the flow by reading states, not event declarations.

### Why Hybrid Versioning (not Postgres temporal_tables)?

We rejected Postgres `temporal_tables` extension because:

1. **No DevOps Dependencies**: Avoids adding a Postgres extension requirement (simplifies deployment, easier local dev without extension setup)
2. **Alignment with Actors**: Each actor completion naturally creates an event. Event log becomes the actor execution history.
3. **Flexibility**: Can selectively log events, capture deltas, and avoid logging irrelevant mutations.
4. **Prisma Integration**: Full support without raw SQL queries; easier for team to query and maintain.

We rejected simple incrementing version (no event log) because:

1. **Loss of Context**: `version: 2` tells you a change happened, but not what or why.
2. **No Replay**: Can't reconstruct the dream's journey after it's edited multiple times.
3. **Debugging Gap**: Hard to correlate a failure to a specific state transition.

---

## Consequences

### Positive

- ✅ Easy to add new actors without modifying existing code (Open/Closed Principle)
- ✅ Independent actors can be unit tested in isolation
- ✅ Full audit trail of dream evolution (dream.version = 3 has events 1, 2, 3)
- ✅ Parallel execution reduces time-to-interpretation for independent tasks
- ✅ Soft failures don't cascade; graceful degradation (e.g., missing relationships don't block interpretation)
- ✅ Clear state machine makes flow self-documenting
- ✅ Easy to implement retry logic, prioritization, and backoff strategies
- ✅ Natural fit for future agentic features (agents are just actors listening to events)

### Negative / Trade-offs

- ⚠️ Actor coordination requires learning (state machine + event bus concepts)
- ⚠️ More boilerplate than monolithic service (each actor needs `name`, `dependsOn`, `triggers`, `allowedInStates`)
- ⚠️ Event log grows with every dream edit (storage overhead, but negligible at typical scale)
- ⚠️ Debugging in dev/staging requires understanding pub/sub flow (no longer a simple stack trace)

### Required Refactoring

1. Extract `TitleGenerationActor`, `ContextGatheringActor`, `RelationshipActor` from `DreamAnalysisService`
2. Refactor `StreamProcessor` into `InterpretationActor` (streaming logic) + `PipelineCoordinator` (state transitions)
3. Create lightweight `EventBus` service (in-memory Pub/Sub)
4. Create `DreamStateMachine` class (validator for state transitions)
5. Create `DreamRepository` class (all Prisma operations encapsulated)
6. Add `DreamStateChangeEvent` table + migrations
7. Update `/routes/dreams/new/+page.server.ts` to trigger the flow via state machine events

### Backward Compatibility

- No existing data migration needed (current `DreamStatus` maps to new states)
- Event log is new; existing dreams will have no history before cutover
- Can run old and new systems in parallel during gradual rollout

---

## Alternatives Considered

### Alternative A: Lightweight Orchestrator (the "Coordinator" pattern)

- Coordinator calls actors in sequence: title → context → relationships → interpretation
- Simpler to understand but couples the coordinator to actor discovery
- Doesn't scale with new features (coordinator needs modification)
- **Rejected**: Rigid ordering, not extensible

### Alternative B: Simple Incrementing Version (no event log)

- Just add `version: Int` to Dream table, increment on each edit
- Simple but loses context of what changed and why
- Can't audit which actor failed at which step
- **Rejected**: Insufficient visibility into dream evolution

### Alternative C: Postgres temporal_tables Extension

- Automatic history tracking, time-travel queries
- But adds DevOps dependency, less transparent in code
- Postgres-specific (harder to migrate later)
- **Rejected**: Over-engineered for current use case; adds deployment complexity

### Alternative D: Redis-backed Event Bus

- Use Redis Pub/Sub + Redis Streams for event persistence
- Provides automatic replay and stream state
- But introduces Redis dependency (currently only used for HTTP resilience; can be removed)
- **Rejected**: Out of scope; in-memory bus sufficient for single-instance SvelteKit

---

## Implementation Plan

1. **Phase 1: Core Infrastructure** (Week 1)
   - Create `EventBus` service
   - Create `DreamStateMachine` class
   - Add `DreamStateChangeEvent` table + migration
   - Create `DreamRepository` (consolidate all DB access)

2. **Phase 2: Extract Actors** (Week 2-3)
   - Refactor `DreamAnalysisService` → `TitleGenerationActor`, `ContextGatheringActor`, `RelationshipActor`
   - Refactor `StreamProcessor` → `InterpretationActor` + `PipelineCoordinator`
   - Wire up state transitions

3. **Phase 3: Update Routes** (Week 3)
   - Update POST `/dreams/new` to trigger state machine (emit `DREAM_CREATED` event)
   - Update PATCH `/dreams/[id]` to handle edits (trigger `ENRICHING_REVISION` flow)
   - Connect frontend to state transitions (show "Gathering context..." → "Interpreting..." → "Complete!")

4. **Phase 4: Testing & Stabilization** (Week 4)
   - Unit tests for each actor
   - E2E tests for full flows (basic, error, redo)
   - Monitor event log for correctness

---

## Related Decisions

- **ADR-002** (future): Choice of Dependency Injection container for actor instantiation
- **ADR-003** (future): Prioritization & backoff strategies for failed actors
- **ADR-004** (future): Pub/Sub persistence (when Redis becomes required)

---

## Glossary

- **Actor**: A single-responsibility service that listens for events and executes a specific task
- **Event Bus**: In-memory Pub/Sub mechanism for inter-actor communication
- **State Machine**: Gate that determines which actors can run in which states
- **Coordinator**: Listens to actor completions and triggers state transitions
- **Event Log**: Immutable record of every state transition and mutation
- **Soft Failure**: Actor fails but analysis can continue (e.g., relationships not found)
- **Hard Failure**: Actor fails and analysis cannot continue (e.g., LLM interpretation fails)
