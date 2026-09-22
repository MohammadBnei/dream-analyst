# P2 · Technical system

Rewritten whole when this plane moves. Last rewrite: 2026-09-22.

---

## What this plane covers

Design pattern, data modelling, infrastructure. The code and infra part.

## State

**This plane is almost empty, and that is accurate.** The stack is open. A separate technical discussion has been started; its content is not in this document.

## Constraints

**The corpus must be swallowed (decided, fixed premise).** 100+ dream texts, their interpretations, and clarification chats where the dreamer added details in back-and-forth. Whatever the model becomes, it has to absorb what already exists, mess included. The corpus belongs to Enki, so there is no legal constraint on its use.

**The feel test reaches this plane too (decided — D14).** Narration must feel immersive and fun, not
like a school dissertation. Latency and failure modes are *felt*, so they are experience decisions
wearing technical clothes. 4am is the example of the hour where the feel is hardest to hold, not the
test itself.

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
- **Is a *finding* stored or computed?** A finding is the agent's claim about the corpus in the
  exploration regime (D11). If it is computed on each ask — which P3's direction implies — it has
  no row, and the durable object is the dreamer's **refusal** and reaction instead. If it is
  stored, it needs stable identity across re-derivations over a growing corpus, and a matcher to
  supply it. Both sides are worked in `intersections.md` (P1×P2, P3×P1). **Hypothesis, one
  exchange old, nothing decided.**
- **Does polymorphic attachment go one-to-many?** If it does, a *fil* and a *finding* are one shape
  differing only in anchor count, and no new object is needed. If it does not, a finding is a fifth
  attachment type. This decides an open P1 vocabulary question as a side effect — see
  `intersections.md` § P1×P2.
- **What does the exploration regime cost?** D11 says real wait is acceptable there. That is a
  budget, not a number, and nothing on this plane has been sized against it.

**Added by D16 — the obligations the lecture model creates. Named, not answered.**

- **What does a synthèse written live cost on the write path?** The lecture model (D16) has the
  document thicken as the dreamer accepts, and lets him take it back « à la voix ». Nothing here is
  sized against that.
- **What identity does a *lexique* need?** It thickens dream after dream, which is a matcher problem
  with the same trap as the element matcher: a wrong merge is permanent.
- **What does an inter-dream symbol count cost to keep current?** The lecture model has an accepted
  reading write a count across the whole history, not just this dream.
- **Is the *trajectoire* stored or computed?** A corpus-wide surface built only from accepted
  lectures, with unread dreams excluded. It meets the finding-stored-or-computed question above from
  the other side.
- **What does a refusal history have to hold?** The lecture model allows exactly one reformulated
  re-proposal and then never returns — while `intersections.md` records that refusal must be
  non-final or the first tired « non » closes that space permanently. Both stand; nothing reconciles
  them.
- **What does the interpretation regime cost?** Same shape as the exploration question above, and
  equally unsized.
