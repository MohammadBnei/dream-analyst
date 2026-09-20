# P1 · UI/UX

Rewritten whole when this plane moves. Last rewrite: 2026-09-20.

---

## What this plane covers

What the user feels, and how the flow runs from system to human and back.

## Ground

**V1's failure (decided).** A dream is entered as one block of typing, once, at the start. It takes ~15 minutes, is tedious and unattractive, and the consequence is that most dreams go unrecorded. This is the failure the rewrite exists to fix.

**The test (decided, fixed premise).** Every decision in the *narration* regime is judged first by what it costs the dreamer at 4am. Anything that makes them compose, choose, or wait, loses. See D11: this premise governs narration, not all three regimes.

## Three regimes (decided as a distinction — D11)

Use is not one thing. Three regimes, each with its own intent, budget and rules. They cut across P2 and P3 as well; they are recorded here because this is where the difference is felt.

```
                 narration            interpretation       exploration
                 ─────────            ──────────────       ───────────
  when           4am, half asleep     later, one dream     30 dreams deep
  intent         get it down          make sense of it     find what recurs
  dreamer is     a tired hand         a reader             an actor
  budget         zero wait,           some wait            real wait is fine,
                 zero choice          some choice          choice is the point
  agent          edits while you      proposes a           proposes findings,
                 speak                reading              and is refused
```

**Every detail in that table is a sketch.** The three-way distinction is decided; the contents of each column are not.

**Only narration has been designed.** The narration model below is the whole of what exists on this plane. Interpretation and exploration have an intent and nothing else — no model, no rules, and no first test of their own.

**Name the regime before applying a rule.** A rule that is load-bearing at 4am can be dead weight at thirty dreams deep, and the reverse.

## The narration regime — current baseline

Source: the project PDF, twelve iterations, newest first. Iteration 12 is labelled « le modèle arrêté ». Iterations 1–11 are the reasoning trail, not live alternatives.

The premise: the dream is a document the agent edits while you talk. Not a transcript. Every chunk spoken lands as a visible change, and every change can be walked back.

**The eight rules (decided as baseline, reopenable — D5; derived inside narration only — D11).**

1. One entry. Voice or text, same composer, same pipeline. STT writes into the input zone and is sent explicitly.
2. Beats inside scènes. The beat is the unit, the scène the container. Coupes franches are objects; trous and uncertain order are shown rather than resolved.
3. Three dimensions. *Narration* is bare prose and carries the dream. *Vu* is generated imagery in the margin. *Symboles* is the only accent-tinted thing. They interleave in one chronological margin, not three columns.
4. Symbols carry a portée — beat, scène, or the whole rêve — visible as reach and widened by speaking. Beat by default. Inferred occurrences are marked *déduit* and are refusable.
5. The agent chooses the diff. It classifies dimension and operation itself. Additive changes land silently; every modification is proposed before it overwrites.
6. Cliquer vise, parler modifie. A finger may only aim, navigate or confirm. No edit buttons anywhere.
7. Everything conversational is a *fil* anchored to a beat, scène, symbole or the rêve. None block, none expire, and a fil can still produce a diff.
8. Nothing is lost. Every operation sits in an *historique* that can be reversed, and « je ne sais plus » is a real answer that becomes a *doute*.

**Objects, as the PDF defines them.** Beat (the unit) inside scène inside rêve. Attached to a beat: texte (narration), image (vu, generated from a prompt the agent wrote), symbole (five categories — symbole, personnage, lieu, action, émotion — with a count across the whole history and a portée), note (point de vue and doute; a property of the récit, not a symbole), fil, diff, trou. Scènes and rêves carry the same attachments.

## Open

- **The interpretation regime is undesigned.** Intent only: make sense of one dream. No model, no rules, no first test.
- **The exploration regime is undesigned.** Intent only: find what recurs across the corpus. No model, no rules, no first test. The dreamer here is an actor interrogating his own history, not a reader being told about it.
- **The two missing first tests.** Narration has the 4am premise. Interpretation and exploration have nothing equivalent, and until they do, decisions inside them are untested rather than tested loosely (D11).
- **The transitions between regimes.** Whether a transition is a designed object or merely the absence of one regime and the presence of another.
- **The wake-up moment.** The PDF's « Try next » lines gesture at an entry screen at waking; nothing exists for it.
- **The counts in the mockups are placeholders.** « eau ×10 », « femme ×35 », « peur ×29 » are illustrative, not measured. They are claims about the corpus and are testable against it. No session has tested them.
- **The 4am test has not been applied to the narration model as a whole.** Each rule answers it individually; whether the assembled iteration-12 screen does is untested.
