# P1 · UI/UX

Rewritten whole when this plane moves. Last rewrite: 2026-09-20.

---

## What this plane covers

What the user feels, and how the flow runs from system to human and back.

## Ground

**V1's failure (decided).** A dream is entered as one block of typing, once, at the start. It takes ~15 minutes, is tedious and unattractive, and the consequence is that most dreams go unrecorded. This is the failure the rewrite exists to fix.

**The test (decided, fixed premise).** Every decision is judged first by what it costs the dreamer at 4am. Anything that makes them compose, choose, or wait, loses.

## Current baseline — the narration phase

Source: the project PDF, twelve iterations, newest first. Iteration 12 is labelled « le modèle arrêté ». Iterations 1–11 are the reasoning trail, not live alternatives.

The premise: the dream is a document the agent edits while you talk. Not a transcript. Every chunk spoken lands as a visible change, and every change can be walked back.

**The eight rules (decided as baseline, reopenable — D5).**

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

- **Everything after narration.** The vision runs through to interpretation — an app to talk with one's subconscious. The PDF covers the narration phase only. The interpretation phase, the cross-dream journal, and the transition between them are undesigned.
- **The wake-up moment.** The PDF's « Try next » lines gesture at an entry screen at waking; nothing exists for it.
- **The counts in the mockups are placeholders.** « eau ×10 », « femme ×35 », « peur ×29 » are illustrative, not measured. They are claims about the corpus and are testable against it.
- **The 4am test has not been applied to the model as a whole.** Each rule answers it individually; whether the assembled iteration-12 screen does is untested.
