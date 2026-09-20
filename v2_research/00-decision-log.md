# Decision log — Dreamer

Append-only. Dated. Never edited, only read backwards.
One entry per decision: what was decided, why, what it closes.
Superseded thinking survives here and nowhere else.

---

## 2026-09-20 · D1 — This project is research, not implementation

**Decided.** The Claude project is for understanding and imagining the system before building it. No code, no stack proposals, no implementation plans unless explicitly asked.

**Why.** Enki wants the mental model formed first. Claude Code runs on another machine and has a different grain: pointed at a research question it produces artifacts instead of understanding.

**Closes.** Whether to do this research inside the repo with Claude Code. Not yet — see D8.

---

## 2026-09-20 · D2 — The frame is three planes

**Decided.** All work sits on P1 (UI/UX), P2 (technical system), or P3 (agentic system), or on an intersection between two.

**Why.** Enki works alone and manages the project himself; the frame exists to prevent drift and to make it visible when a discussion has moved without being noticed.

**Closes.** The shape of the research. Not the content of any plane.

---

## 2026-09-20 · D3 — The intersections are the workspace; the centre stays unnamed

**Decided.** The three pairwise intersections are where decisions are forced. Something may sit where all three meet; it is not named, and will not be named on purpose. A candidate is flagged, not declared.

**Why.** Enki does not have the vision for the centre yet and wants it to arrive on its own rather than be manufactured.

**Closes.** Nothing. Deliberately leaves an opening.

---

## 2026-09-20 · D4 — Two fixed premises

**Decided.**
1. The cost of capture at 4am is the first test of any decision, on all three planes.
2. The corpus (100+ dreams, interpretations, clarification chats) is the ground against which claims are tested.

These are argued *from*, not *about*.

**Why.** (1) is the named failure of V1: a dream entered as one block of typing, ~15 minutes, tedious, so most dreams went unrecorded. (2) the corpus already exists and makes empirical claims testable rather than imagined.

**Closes.** Re-litigating why the rewrite exists.

---

## 2026-09-20 · D5 — Everything else is reopenable, including the eight rules

**Decided.** The narration model in the PDF (iteration 12, eight rules) is the current baseline for P1, not settled ground. When P2 or P3 puts a rule under tension, the tension is named plainly rather than designed around.

**Why.** The eight rules were derived on P1 alone. They have not yet been costed against a data model or an agent's latency.

**Closes.** Nothing.

---

## 2026-09-20 · D6 — English for thinking, French vocabulary frozen

**Decided.** All research and discussion in English. The product is French. The domain vocabulary stays exactly as it stands — *beat, scène, rêve, narration, vu, symboles, portée, fil, trou, coupe franche, déduit, doute, historique* — untranslated. A genuinely new term is proposed as a term and waits.

**Why.** Enki's stated view: English is the better language for research and thinking, French for imagination. Multi-language for the product is a long-term perspective, not a current concern.

**Closes.** Language of the instructions, of the discussion, and of the domain terms.

---

## 2026-09-20 · D7 — Two document types with opposite rules

**Decided.** An append-only dated decision log (this file), plus four plane documents — P1, P2, P3, intersections — each rewritten whole when that plane moves. Invalidated content disappears from a plane document entirely and survives only here. Claude proposes updates at the end of a session; Enki replaces the project files himself.

**Why.** Append-only documents become unreadable and self-contradictory. A record of how we got here and a statement of where we are want opposite rules, so they are separate files.

**Open inside this decision.** Giving the intersections their own file avoids duplicating them across three, but puts the most active material in the file touched most often. Reopen if it proves wrong in practice.

---

## 2026-09-20 · D8 — Stay in chat for now; move to Claude Code when the documents stop changing shape

**Decided.** Research continues in the Claude project. The move into the repo happens when the plane documents stop changing shape and start accumulating detail.

**Why.** This phase is dialogue-shaped and benefits from inline diagrams. At the switch, git becomes the decision log for free — dated, append-only, never rewritten — and the plane documents become markdown in the repo.

**Closes.** The "should I switch now" question, for now.

---

## 2026-09-20 · D9 — The research moves into the repo

**Decided.** Research continues in Claude Code, inside the repo, with the five
documents in v2_research/ as working files. Supersedes the timing set in D8.

**Why.** The documents are the working surface, and chat cannot edit them —
every update meant a manual re-upload. In the repo they are editable in place
and git carries the dated, append-only history for free.

**Cost accepted.** Inline diagrams are lost, and Claude Code's grain pulls
toward implementation. The dreamer-research skill exists to counteract the
second.

**Closes.** Where the research happens.
