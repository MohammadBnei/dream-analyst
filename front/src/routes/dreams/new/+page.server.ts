import { fail, redirect } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
import * as v from 'valibot';
import type { Actions } from './$types';
import { DreamStatus, type Dream } from '@prisma/client';
import { generateDreamTitle } from '$lib/server/analysis';
import { findAndSetRelatedDreams } from '$lib/server/relatedDreams';
import { parseDreamDate } from '$lib/server/dreamDate';

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

			await Promise.all([
				generateDreamTitle(newDream.rawText).then((title) =>
					prisma.dream.update({
						where: { id: newDream.id },
						data: { title }
					})
				),
				findAndSetRelatedDreams(newDream)
			]);
		} catch (e) {
			console.error('Error saving dream:', e);
			return fail(500, { rawText, dreamDate, error: 'Failed to save dream. Please try again.' });
		}

		// Outside the try: redirect() signals by throwing, so inside it the catch
		// swallowed the redirect and it had to be re-thrown by inspecting e.status.
		redirect(303, `/dreams/${newDream.id}`);
	}
};
