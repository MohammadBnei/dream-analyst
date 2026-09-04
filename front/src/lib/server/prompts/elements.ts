import { ELEMENT_KINDS, type ElementKind, type RawElement } from '$lib/elementKinds';

/**
 * Prompts for the two-agent element pipeline.
 *
 * Every rule in here was bought with a measurement - see the step-0 spike in the
 * plan. Do not "tidy" them without re-running it.
 *
 * NOT registered in promptService: that is a Record<DreamPromptType, string> of
 * interpretation personas, and these are neither.
 */

/**
 * Extractor. Runs on the weak model, which handles it fine ONCE the prompt
 * demands canonical labels.
 *
 * The canonical-label rules are the single highest-value thing here: without
 * them the extractor bakes tonight's adjective into the label ("mer calme",
 * "vagues énormes", "ville la nuit") and every dream mints a permanent
 * singleton that can never merge with anything. Adding these rules alone cut
 * total entries by 24% in the spike.
 *
 * The language sentence is load-bearing, not politeness: without it the same
 * corpus yields `water` on some dreams and `eau` on others, and the unique
 * constraint treats them as unrelated. The repo already carries this exact
 * instruction in analysis.ts and (formerly) relatedDreams.ts.
 */
export const extractorPrompt = (
	rawText: string
) => `Extract the recurring elements of this dream, as a person's dream vocabulary.

Return ONLY a JSON array. Each item: {"kind": one of ${ELEMENT_KINDS.join('|')}, "label": canonical form, "valence": -1..1, "intensity": 0..1}.

LABELS - this is the important part. Give the CANONICAL, REUSABLE form, not how it appeared tonight:
- Strip every adjective and qualifier: "mer calme" -> "mer", "vagues énormes" -> "vague", "forêt de bouleaux" -> "forêt", "ville la nuit" -> "ville", "couloir inconnu" -> "couloir".
- Singular, not plural: "coquillages" -> "coquillage".
- Verbs in the infinitive: "je nageais" -> "nager", "il regardait" -> "regarder", "je me suis assis" -> "s'asseoir".
- One or two words. Never a phrase or a clause.
- Never the dreamer: no "moi", "je", "le rêveur", "la personne".
- SAME LANGUAGE as the dream text. Do not translate.

KINDS - be consistent, the same thing must always get the same kind:
- symbol: a thing or image (mer, eau, dent, clé, feu, serpent, porte)
- setting: a place the dream happens in (plage, maison, ville, forêt, hôpital)
- character: a being (père, mère, grand-mère, inconnu, chien)
- action: something done (nager, voler, tomber, chercher, fuir)
- emotion: a feeling (peur, joie, honte, tristesse)
Water in any form is a symbol, never a setting. A beach or a shore is a setting.

"valence"/"intensity" are optional; include them when the element carries a clear emotional charge, for ANY kind - a symbol can be frightening.
No prose, no markdown fences, no explanation.

Dream:
"""${rawText}"""`;

/**
 * Matcher. Runs on the MATCHER model, not the weak one.
 *
 * Two hard-won details:
 *
 * 1. It answers with the candidate's LABEL, never its index. Asking a model to
 *    index into a 100+ row list produces confident, wrong numbers - the spike
 *    saw `photo`, `clé`, `vitrine` and `feu` merged into `mer` and `père` split
 *    across two entries, purely from index drift. The caller resolves the label
 *    by exact match, so anything reworded or invented simply fails the lookup
 *    and becomes a new entry, which is the safe direction to fail in.
 *
 * 2. The NEVER-merge list is explicit and specific. A generic "only merge
 *    synonyms" instruction produced `grand-mère <- mère` - two real people fused
 *    permanently. Every line below is a failure that actually happened.
 *
 * Exact matches never reach this prompt: the caller resolves them with a Map
 * lookup first, which is both free and more reliable than asking.
 */
export const matcherPrompt = (
	elements: RawElement[],
	candidates: { kind: string; label: string; also: string[] }[]
) => `You are canonicalising dream vocabulary for one person. Your job is to recognise when a new element is something they have ALREADY dreamt about.

ELEMENTS extracted from tonight's dream:
${elements.map((e, i) => `${i}. [${e.kind}] ${e.label}`).join('\n')}

VOCABULARY this person has used before:
${
	candidates.length
		? candidates
				.map(
					(c, i) =>
						`${i}. [${c.kind}] ${c.label}` +
						(c.also.length ? ` (aussi : ${c.also.join(', ')})` : '')
				)
				.join('\n')
		: '(empty - this is their first dream)'
}

Merge an element ONLY when it denotes THE SAME THING. Not merely related, not the same theme, not the same category.

NEVER merge:
- two different people. "mère" and "grand-mère" are different. "père" and "grand-père" are different.
- two different places. "maison" is not "chambre"; "cuisine" is not "salle à manger"; "garage" is not "parking"; "maison" is not "hôpital".
- two different acts. "marcher" is not "courir"; "chercher" is not "trouver".
- OPPOSITES, ever. "fermer" is not "ouvrir"; "monter" is not "descendre"; "peur" is not "soulagement"; "inquiétude" is not "calme".
- two different feelings. "joie" is not "sérénité"; "tristesse" is not "honte".
- words that merely sound alike. "mer" and "mère" are unrelated.

DO merge genuine synonyms and the same referent under another name: "océan"/"mer", "papa"/"père", "bagnole"/"voiture".

Test yourself: if you need a sentence to explain WHY they are similar, the answer is null.

Return ONLY a JSON array of {"i": element index, "label": the vocabulary label copied EXACTLY, or null}.
Copy the label character for character from the list above. Do not reword it, do not translate it, do not invent one.
Prefer null. A new entry costs nothing; a wrong merge is permanent and shows the person a symbol they never dreamt.
No prose, no markdown fences.`;

export type { ElementKind };

/**
 * Annotation. Runs AFTER the terminal write, never on the credit path.
 *
 * Produces one short line per element saying what that image did in THIS dream -
 * the only genuinely new content this feature generates, and the material the
 * history block later feeds back so the interpreter has something to interpret
 * rather than a frequency table to restate.
 *
 * Keyed pairs again, for the same reason as the matcher: mapping notes back onto
 * rows by position silently misattributes every one of them when the model
 * returns a different count than it was given.
 */
export const annotationPrompt = (
	rawText: string,
	interpretation: string,
	elements: { kind: string; label: string }[]
) => `Here is a dream and its interpretation.

DREAM:
"""${rawText}"""

INTERPRETATION:
"""${interpretation}"""

For each element below, write ONE short sentence about what that image did in THIS dream - the role it played, the charge it carried, how it behaved. Ground it in this dream, not in general symbolism: "the sea stayed calm while he watched from the shore" is useful, "the sea represents the unconscious" is not.

ELEMENTS:
${elements.map((e, i) => `${i}. [${e.kind}] ${e.label}`).join('\n')}

Write in the SAME LANGUAGE as the dream. Do not translate.
Return ONLY a JSON array of {"i": element index, "note": one sentence}.
Omit any element you have nothing specific to say about - a missing note is better than a generic one.
No prose, no markdown fences.`;
