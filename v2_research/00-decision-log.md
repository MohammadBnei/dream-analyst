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

---

## 2026-09-20 · D10 — The session ritual and the phase's end

**Decided.** Appetite: ten sessions of one hour, fixed time and variable scope.
Each session opens on one concrete moment of the built world, walked twice —
pre-parade, then pre-mortem on the same moment, with a failure nobody designed
for. Each session closes with a fixed sequence: dispositions, claim promotions,
log entries with consequences, plane rewrites, next moment, commits. The phase
ends on four checks and hands over one vision document in the register of the
narration mockups, its final section specifying the walking skeleton.

**Why.** A research phase has no natural end and otherwise stops at boredom.
Projection into a finished world is a known method — Amazon's working-backwards
press release, Klein's pre-mortem — and it is the register Enki will sustain for
ten hours, which a risk register is not.

**Term proposed.** *Pre-parade* — Enki, 2026-09-20. Project-local, paired with
Klein's pre-mortem. Not an established method; not to be presented as one.

**Cost accepted.** Ten hours buys the most valuable incomplete model, not a
complete one. The vision document sits outside the appetite and is not counted
in it. Claude Code's register is terser than the imaginative mode this phase
asks for; section 6 exists to counteract that, and if it fails to, the opening
half of each session moves elsewhere.

**Closes.** When the research phase is done, and what it hands over.

---

## 2026-09-20 · D11 — Use is three regimes, not one

**Decided.** Dreamer's use is segregated into three regimes: **narration**,
**interpretation**, **exploration**. Each has its own intent, its own budget and
its own rules. They cut across all three planes rather than sitting on P1 alone.

- *narration* — 4am, half asleep, a tired hand. Intent: get it down. Zero wait,
  zero choice. The agent edits while the dreamer speaks.
- *interpretation* — later, one dream. Intent: make sense of it. Some wait, some
  choice. The agent proposes a reading.
- *exploration* — thirty dreams deep. Intent: find what recurs. Real wait is
  acceptable and choice is the point. The agent proposes findings and is refused.

**Decided.** The 4am premise (D4, premise 1) governs **narration**.
Interpretation and exploration each need their own first test. **Neither is
written.** Until one is, a decision taken inside those regimes has no test at
all, and the honest answer is to say so.

**Decided.** The eight rules (D5) were derived inside narration only. They are
not a general model of the product. Before applying a rule, name the regime.

**Why.** The regimes were being collapsed into one, and the collapse was
invisible because every worked example sat in narration. A moment in exploration
— the dreamer awake, thirty dreams in, actively interrogating his own corpus —
does not obey the narration budget at all: there the dreamer *wants* to choose,
and waiting is not a defect. Applying the 4am test there would have killed the
regime's whole point, and applying narration's rules there silently mis-shapes
what gets built.

**Cost accepted.** The scope on premise 1 creates an escape hatch: any slow or
heavy feature can be relabelled "exploration" to get out from under the only
fixed test the project has. The cost is real and is accepted because the
alternative — one budget for three different bodies at three different hours —
was already producing wrong answers. Mitigation is to write the other two tests,
which is now owed work and is not yet scheduled.

**Cost accepted.** The three-way split is decided as a *distinction*; every
detail of each regime is undecided. Stating the distinction in the plane
documents before the details exist risks the sketch being read as settled.

**Open.** Whether the transitions between regimes are themselves designed
objects, or merely the absence of one regime and the presence of another.

**Closes.** Whether there is one mode of use or several. Supersedes nothing;
scopes D4's first premise and bounds D5's eight rules.

---

## 2026-09-20 · D12 — An open item is retired only by a log entry

**Decided.** An item in a plane document's *Open* section may not disappear in a
rewrite. It is removed only when a dated log entry names it and says it was
retired, accepted, or deferred to the build — the same three dispositions the
phase-end check in D10 requires.

**Why.** The plane documents are rewritten whole and invalidated content is
deleted outright (D7). That is correct for *settled* content, which survives in
the log. It is wrong for open questions, which were never written to the log at
all: a question dropped in a rewrite leaves no trace anywhere, and D10 ends the
phase on every open risk being retired, accepted or deferred. A question that
evaporated is none of the three, and nothing would detect it.

**Rejected.** A fourth document holding open questions. The plane documents and
`intersections.md` already carry them, and `intersections.md` exists precisely to
stop edges being duplicated across three files or dropped between them. A second
surface reintroduces the duplication it was built to prevent, and gives two
places to forget to update.

**Cost accepted.** Retiring a question now costs a log entry, so it is no longer
free to tidy one away. That friction is the point, and it will occasionally be
paid on a question that genuinely deserved deleting.

**Closes.** How open questions survive whole-document rewrites. Supersedes
nothing; qualifies D7's delete-outright rule for *Open* sections only.

---

## 2026-09-22 · D13 — The session opens on the moment and its PPM

**Decided.** A session opens on the moment and its PPM (pre-parade, then pre-mortem on the same
moment). The table of contents is written from what the two walks demanded, never before them.
Enki supplies the moment unprompted; Claude proposes none, and never asks which regime a moment
sits in — it reads the regime off the moment and names it back for confirmation. If a session
opens without a moment, Claude asks for the moment, not for the regime.

**Why.** Opening on regime-and-agenda selection made every session start as administration — the
register §6 already names that as failure. The two walks are what the session is for; the agenda
is their output.

**Rejected.** TOC first — the complaint itself. An explicit backcast step emitting build steps —
roadmap-shaped, §0 bans it. Claude proposing the moment — steers every session into narration.
Killing the TOC — nothing left for §7 step 1 to close against.

**Cost accepted.** Scope is unknown until the two walks are done, so the hour is less predictable
and a PPM can open more than an hour holds; the TOC is then also the cut. And **Claude now decides
which regime's budget applies**, by reading it off the moment rather than being told. That is the
escape hatch D11 named — a heavy feature landing under a looser regime — now reachable by
misreading instead of by argument. Naming the regime back is what keeps the correction cheap.

**Also recorded.** This change edits `.claude/skills/dreamer-research/SKILL.md`, which is not one
of §4's five documents. It is written on Enki's explicit instruction; §0's existing exception
covers the no-code list, not this rule.

**Closes.** The order of the ritual. **Supersedes D10's close-sequence step 5** — "propose the
next session's moment in one line" — replacing it with a narrower step that names material and
leaves the moment to Enki. Qualifies D10 elsewhere; supersedes nothing else.
