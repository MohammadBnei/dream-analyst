# P2 · Technical system

Rewritten whole when this plane moves. Last rewrite: 2026-09-20.

---

## What this plane covers

Design pattern, data modelling, infrastructure. The code and infra part.

## State

**This plane is almost empty, and that is accurate.** The stack is open. A separate technical discussion has been started; its content is not in this document.

## Constraints

**The corpus must be swallowed (decided, fixed premise).** 100+ dream texts, their interpretations, and clarification chats where the dreamer added details in back-and-forth. Whatever the model becomes, it has to absorb what already exists, mess included. The corpus belongs to Enki, so there is no legal constraint on its use.

**The 4am test applies here too (decided, fixed premise).** Latency and failure modes are UX decisions wearing technical clothes.

## Hypotheses

- **Event-driven design pattern.** Currently a hypothesis, not a decision. It has not been argued for in writing, and it has not been costed against anything on P1.

## Named but undecided

Topics identified as belonging to this plane, with nothing settled about them:

- Storage
- Text search and vector search
- Polymorphic attachment
- Infrastructure

## Open questions

- What does the existing V1 data actually look like, and what shape does it force?
- What does « nothing is lost » (rule 8) cost in storage and in model complexity?
- What is the write path during narration — one that must never make the dreamer wait?
- Is the historique a projection of an event log, or a separate structure?
