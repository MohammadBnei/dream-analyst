# P1 · UI/UX

Rewritten whole when this plane moves. Last rewrite: 2026-09-22.

---

## What this plane covers

What the user feels, and how the flow runs from system to human and back.

## Ground

**V1's failure (decided).** A dream is entered as one block of typing, once, at the start. It takes ~15 minutes and most dreams go unrecorded. The failure is not that it was expensive — it is that it was **dull**: a school exercise where an experience belonged.

**The test (decided, D14).** Narration is judged first by whether it feels **immersive and fun**, not like a school dissertation. Anything that makes the dreamer compose, choose, or wait works against that. 4am is the example, not the test — the hour where the feel is hardest to hold. This premise governs *narration*; interpretation and exploration each need their own first test, and neither is written (D11).

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

**Narration and interpretation have a baseline. Exploration has an intent and nothing else** — no model, no rules, no first test of its own.

**Name the regime before applying a rule.** A rule that is load-bearing at 4am can be dead weight at thirty dreams deep, and the reverse.

## Source

`interface/Dream Capture.dc.html`, fifteen iterations, newest first. Iterations 1–12 are the narration phase; 13–15 are the lecture phase. Earlier iterations are the reasoning trail, not live alternatives.

## The narration regime — current baseline

Iteration 12 is labelled « le modèle arrêté ».

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

**Objects, as the deck defines them.** Beat (the unit) inside scène inside rêve. Attached to a beat: texte (narration), image (vu, generated from a prompt the agent wrote), symbole (five categories — symbole, personnage, lieu, action, émotion — with a count across the whole history and a portée), note (point de vue and doute; a property of the récit, not a symbole), fil, diff, trou. Scènes and rêves carry the same attachments.

## The interpretation regime — current baseline

**Decided as baseline, reopenable — D16; derived inside interpretation only.** Source: iterations 13, 14 and 15. The deck's own framing of its rules: « Six rules, each a call I made from your two examples; each is contestable ».

A French fragment in guillemets below is copied from the deck exactly. Anything without guillemets is paraphrase.

**The six rules (13 A–F).**

- **A · Une seconde surface, pas un second écran.** Récit and Lecture are two states of one document. « Le récit ne bouge pas de place ; la marge change de contenu. »
- **B · L'hypothèse est le nouveau déduit.** A lecture attaches to a span of prose, underlines itself in dots, and is refused with one gesture — « même grammaire que le symbole déduit de la phase 1 ».
- **C · Le doigt ne fait qu'accepter, refuser, avancer.** Phase 1's rule holds. « Tu ne rédiges qu'une fois : à la question finale. »
- **D · La synthèse s'épaissit sous tes yeux.** Each accepted lecture writes a line. « Tu ne la reçois pas finie, tu la vois se construire — et tu peux la reprendre. »
- **E · Une lecture acceptée redescend dans le récit.** « Le symbole gagne sa ligne de lecture et son compte inter-rêves ; le lexique s'épaissit. » A lecture can also correct the narration — the same diff as phase 1.
- **F · La résonance est une marque, pas une page.** « 3e fois cette année » is read in the margin, beside the beat. « La trajectoire du corpus reste hors champ pour ce tour » — which iteration 14 then overrides: « La trajectoire existe. »

**The objects of phase 2 (13d).** The caption reads « Sept objets dans la phase 2, et pour chacun : ce qu'il vise, ce qu'il écrit, comment on le refuse » — and then lists eight. Recorded as the deck has them, discrepancy included (see *Open*):

| object | what it aims at, and how it is refused |
| --- | --- |
| **une lecture** | the unit of phase 2 — a span of récit, a symbole, a scène or the rêve, « jamais rien qui n'existe pas déjà dans le document » |
| **empan marqué** | the dotted underline. « La prose reste intacte » |
| **hypothèse** | the card. « Trois issues seulement : ça me parle, non, plus tard. Aucune n'oblige à écrire. » |
| **symbole + lecture** | accepted, it descends into the récit and gains its reading line and its inter-dream count; « Le lexique s'épaissit rêve après rêve » |
| **3e fois** | a resonance. « Un fait, pas une hypothèse : elle ne se refuse pas, elle se déplie vers les autres rêves. » It lives in the margin, not a page of its own |
| **avant / après** | a lecture correcting the narration — « Exactement le diff de la phase 1, même carte, même historique réversible » |
| **synthèse** | the document. It writes itself as you accept; what is missing shows in the negative. Its parts: « Titre, fil narratif, actes, symboles, continuité ». « Tu peux le reprendre à la voix » |
| **fil** | the question finale opens a fil anchored to the rêve — phase 1's object. « C'est le seul endroit où tu rédiges vraiment » |

**The inverted loop (14b).** Narration runs *tu parles → l'agent écrit → tu vérifies*; lecture runs *l'agent demande → tu tries → le document s'écrit*.

```
  identical    la colonne de lecture · la marge · la carte de diff · le fil ancré
               l'historique réversible · cliquer vise / parler modifie
  different    qui ouvre le tour · ce que contient la marge · everything here can
               be refused without losing anything
```

What inverts is the direction: « en narration l'agent consigne ce que tu sais, en lecture il avance ce que tu ne sais pas ». In one line of the deck's own: « c'est qui tient la plume » — phase 1 *tu tiens la plume*, phase 2 *il tient la plume, tu tiens le veto*. Each half has its own risk: the agent as « un greffier rapide, et son risque est de mal entendre », and the reader whose risk is going too far. And the justification for the whole regime: « une interprétation que tu aurais rédigée ne t'apprendrait rien ».

**The five views (14a).** The reading waits, sometimes days, and announces its duration — « La lecture attend, parfois des jours — et elle annonce sa durée », `ANALYSE JUNGIENNE · ~15 MIN`. The agent leads and proposes the answers; « Le micro reste là pour ce qu'il n'a pas prévu ». The pivot is view 3: « Ta réponse ne devient pas une ligne de récit — elle devient une hypothèse à trier. C'est là, et seulement là, que les deux phases diffèrent. » Accepting writes three times — « Dans la synthèse, sur le symbole côté récit, dans le lexique » — and the screen says so, « c'est le seul moment didactique du produit ». The document is the destination: « Consultable dès la première ligne, avec ses trous en clair. Tu ne le reçois jamais fini : tu le vois se remplir. »

**The noyau and its two déploiements (15).** One sentence, not a paragraph and not a label: « Un paragraphe est trop cher à refuser : il faut l'avoir lu pour le juger, et on finit par accepter par politesse envers un beau texte. » « Une étiquette (« l'Enfant divin ») est trop maigre pour être ressentie. » The noyau is « Assez court pour être refusé sans regret, assez écrit pour te faire quelque chose ».

The deck's heading says « Trois réceptions » and its body lists four (see *Open*):

- **Ça me touche** — « Déploie en deuxième personne », « court, sans tradition ni preuve ». Written into the synthèse with an accent stroke. « Ouvre le micro : c'est là que tu parles, si ça vient. Le symbole passe dans ton lexique. »
- **Ça m'intéresse** — « Déploie en troisième personne : la tradition symbolique, les beats cités, les autres rêves. » Neutral stroke. « Pas de micro — il n'y a rien à répondre à un savoir. »
- **Non** — « Ne déploie rien, n'écrit rien. Le noyau reste visible, barré, dans l'historique de la lecture — pour que tu puisses voir ce que tu as écarté. » « Une seule reprise autorisée : l'agent peut reproposer le même noyau une fois, formulé autrement. Refusé deux fois, il ne revient pas. »
- **Passer** — « Ni oui ni non. Le noyau retourne dans la pile et reviendra à la fin. Passer n'est pas un échec et ne se compte pas — la barre de progression ne recule pas. »

The distribution is read as a fact about the dreamer, never as a score for the agent: « la réception n'est pas une note de qualité donnée à l'agent, c'est une information sur toi ». A dream received mostly as interesting and little as touching reads as distance — « c'est un fait sur toi, pas un échec de la lecture. L'agent peut le dire, jamais le corriger en forçant. »

**La synthèse à deux voix (15c).** The stroke in the gouttière records how each passage was received. « Relue dans un mois, la synthèse est autant un portrait de ta réception que du rêve. » A refused noyau persists inside the synthèse itself, marked `REFUSÉ · GARDÉ VISIBLE`, and the document offers `Relire dans un mois`.

**La trajectoire (14c).** One axis, time; recurring symbols as continuous strokes in the gouttière. « Rien ici n'est déduit : la surface ne se remplit qu'avec les lectures que tu as acceptées. » Unread dreams do not appear. It also carries a natural-language query onto the corpus: « Montre-moi tous les rêves où il y a de l'eau ».

**La question finale (14d).** It opens a *fil* anchored to the rêve — phase 1's object, not a new one. The answer comes back as a revision of the synthèse, « qu'il faut accepter comme tout le reste », so the document is never finished.

**La lentille.** Iteration 14 states « La lentille est nommée. » — « Analyse jungienne » appears in the chrome and in the synthèse — and « C'est une position du produit, pas un réglage. », correcting 13a. Iteration 13's own *Open* line still asks the question; both are recorded, and the item stays open until a log entry retires it (D12).

## Open

**Carried from the previous rewrite.**

- **The exploration regime is undesigned.** Intent only: find what recurs across the corpus. No model, no rules, no first test. The dreamer here is an actor interrogating his own history, not a reader being told about it.
- **The two missing first tests.** Narration has the 4am premise. Interpretation and exploration have nothing equivalent, and until they do, decisions inside them are untested rather than tested loosely (D11). *(D14 replaces the 4am framing with the feel test; the item itself is unchanged and still stands for both regimes.)*
- **The transitions between regimes.** Whether a transition is a designed object or merely the absence of one regime and the presence of another.
- **The wake-up moment.** The deck's « Try next » lines gesture at an entry screen at waking; nothing exists for it.
- **The counts in the mockups are placeholders.** « eau ×10 », « femme ×35 », « peur ×29 » are illustrative, not measured. They are claims about the corpus and are testable against it. No session has tested them.
- **The 4am test has not been applied to the narration model as a whole.** Each rule answers it individually; whether the assembled iteration-12 screen does is untested. *(D14: the test is now the feel, and the question stands in that form too.)*

**The deck's own open lines, iterations 13–15.**

- la trajectoire du corpus *(13; iteration 14 answers it with « La trajectoire existe », and 14c gives it a surface — the item leaves only by a log entry)*
- la lentille (jungienne / neutre) nommée ou non *(13; iteration 14 answers it — same)*
- refuser une lecture en reformulant plutôt qu'en disant non *(13, restated in 14)*
- relire une synthèse un mois plus tard *(13)* — « relire une synthèse un mois après, quand elle ne te parle plus pareil » *(14)*
- ce que devient une lecture refusée (oubliée, ou proposée autrement plus tard) *(14)*
- la longueur du noyau (une phrase ou deux ?) *(15)*
- « ça me touche » mais tu ne dis rien — l'agent relance-t-il ? *(15)*
- un rêve entièrement refusé, que reste-t-il *(15)*
- la reprise unique d'un noyau refusé, reformulée par qui *(15)*

**Surfaced by reading the deck against itself — Claude, not the dialogue.**

- 13d's caption says « Sept objets » and its table lists eight.
- 15b's heading says « Trois réceptions » and its body lists four, *Passer* included.
- Two reception vocabularies, never reconciled: « ça me parle, non, plus tard » (13d, 14b) and *Ça me touche / Ça m'intéresse / Non* with *Passer* (15b) — and 15a, where an arrow means « plus tard ».
- *noyau* or *hypothèse*: the same card in the same slot (`HYPOTHÈSE · 2 BEATS` in 14a, `NOYAU · UNE PHRASE` in 15a). A rename, or a narrower object.
- Rule B extends the frozen term *déduit* to cover the hypothèse. D6 freezes the vocabulary; this widens one. It leaves by a log entry or by a different term.

**New vocabulary.** The lecture model arrives with twenty-one French terms D6 does not cover. They are proposed and waiting, and are recorded in D16 so that a future rewrite of this document cannot delete them.
