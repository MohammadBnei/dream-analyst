import { fail, redirect } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
import * as v from 'valibot';
import type { Actions } from './$types';
import { DreamStatus, type Dream } from '@prisma/client';
import { generateDreamTitle } from '$lib/server/analysis';
import { findAndSetRelatedDreams } from '$lib/server/relatedDreams';
import { extractDreamElements } from '$lib/server/elements';
import { parseDreamDate } from '$lib/server/dreamDate';
import { claimAnalysis } from '$lib/server/credits';

const CreateDreamSchema = v.object({
	rawText: v.pipe(v.string(), v.minLength(10, 'Dream text must be at least 10 characters long.')),
	// Optional date the dream was made. Comes from <input type="date"> as YYYY-MM-DD.
	// Empty/omitted is allowed and falls back to the DB default (now()).
	dreamDate: v.optional(
		v.pipe(
			v.string(),
			v.check((s) => s === '' || !isNaN(new Date(s).getTime()), 'Invalid date format')
		)
	)
});

export const actions: Actions = {
	createDream: async ({ request, locals }) => {
		const sessionUser = locals.user;
		if (!sessionUser) {
			return fail(401, { message: 'Unauthorized' });
		}

		const formData = await request.formData();
		const rawText = formData.get('rawText');
		const dreamDate = formData.get('dreamDate');

		let validatedData;
		try {
			validatedData = v.parse(CreateDreamSchema, { rawText, dreamDate });
		} catch (e) {
			if (!v.isValiError(e)) throw e;
			return fail(400, {
				rawText,
				dreamDate,
				error: e.issues.map((issue) => issue.message).join(', ')
			});
		}

		const prisma = await getPrismaClient();

		// Save the dream before anything else can fail. The text is the one thing we
		// must never lose; the analysis is a separate, purchasable step.
		let newDream: Dream;
		try {
			newDream = await prisma.dream.create({
				data: {
					userId: sessionUser.id,
					rawText: validatedData.rawText,
					// undefined => Prisma falls back to the schema default (now())
					dreamDate: parseDreamDate(validatedData.dreamDate),
					status: DreamStatus.PENDING_ANALYSIS
				}
			});
		} catch (e) {
			console.error('Error saving dream:', e);
			return fail(500, { rawText, dreamDate, error: 'Failed to save dream. Please try again.' });
		}

		const claim = await claimAnalysis(newDream, sessionUser.id);

		// A title is free and unlimited via ?/regenerateTitle, so it is generated
		// either way - without it the dreams list shows a bare date. Related dreams
		// only feed the analysis prompt, so they are skipped when unpaid: they would
		// be stale by the time the user pays.
		//
		// These run in their own try: the dream is already saved and the money
		// decision already made, so a title or relations failure is not a reason to
		// refuse the user their navigation.
		try {
			await Promise.all([
				generateDreamTitle(newDream.rawText).then((title) =>
					prisma.dream.update({ where: { id: newDream.id }, data: { title } })
				),
				// Elements BEFORE relations, and sequentially: symbol-overlap
				// retrieval reads the rows extraction writes, so a Promise.all here
				// would search against an empty set. An async IIFE because you
				// cannot await between two elements of an array literal.
				//
				// Gated with relations on `insufficient`. Extraction is free to the
				// user but not to us, and dream creation is otherwise an unmetered
				// LLM spend vector. The unpaid dream is not stranded: its Analyze
				// button posts ?/resetAnalysis, which extracts.
				claim === 'insufficient'
					? Promise.resolve(null)
					: (async () => {
							await extractDreamElements(newDream);
							return findAndSetRelatedDreams(newDream);
						})()
			]);
		} catch (e) {
			console.error(`Dream ${newDream.id}: title/related generation failed:`, e);
		}

		// Outside the try: redirect() signals by throwing, so inside it the catch
		// swallowed the redirect and it had to be re-thrown by inspecting e.status.
		// The dream was saved either way, so this is never a form failure - the
		// explanation belongs on the page where the user can act on it.
		redirect(303, `/dreams/${newDream.id}`);
	}
};
