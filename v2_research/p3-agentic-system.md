# P3 · Agentic system

Rewritten whole when this plane moves. Last rewrite: 2026-09-20.

---

## What this plane covers

How the agent is part of the system rather than a service the system calls.

## The direction

**RLM + REPL (hypothesis).** Recursive Language Models, as described by Zhang, Kraska and Khattab: the context is offloaded as a variable in a REPL environment that the model interacts with, examining and decomposing it programmatically and launching recursive sub-LM calls inside it. The variable space is separated from the token space — the model loads only what it needs, when it needs it.

**Why it fits this problem (Enki's reasoning, hypothesis).** Dreams make sense as a whole, and adjusted with what is known about the person. That space grows. Answering something like "why does this woman keep coming back" requires counting occurrences across the corpus, reading a few closely, and relating them to the dreamer — work that neither a large context window nor a round of tool calls does well, and that code exploring a variable does.

**Consequence if it holds.** The agent is intertwined with the code rather than being an external service the app calls. This is stated as the thing being attempted; it is not yet designed.

## Open questions

- Recursion depth, and whether depth beyond 1 is needed here.
- What exactly is the variable: one dream, the corpus, the corpus plus what is known about the dreamer?
- How the agent *writes* — the narration model has it producing diffs, classifying dimension and operation, opening fils, marking things *déduit*. None of that write path is designed.
- Sandbox, execution environment, cost, failure modes.
- Whether the agent that edits the dream during narration and the agent that reasons over the corpus are the same thing. See the intersections document — this is where P3 collides with P1's latency budget.
