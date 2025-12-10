import { fail, redirect } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
import * as v from 'valibot';
import type { Actions } from './$types';
import { DreamStatus } from '@prisma/client'; // Import the Prisma DreamStatus enum
import { getDreamAnalysisService } from '$lib/server/dreamAnalysisService'; // Import dream analysis service

const CreateDreamSchema = v.object({
	rawText: v.pipe(v.string(), v.minLength(10, 'Dream text must be at least 10 characters long.')),
	context: v.optional(v.string()),
	emotions: v.optional(v.string())
});

export const actions: Actions = {
	createDream: async ({ request, locals }) => {
		const sessionUser = locals.user;
		if (!sessionUser) {
			return fail(401, { message: 'Unauthorized' });
		}

		const formData = await request.formData();
		const rawText = formData.get('rawText');
		const context = formData.get('context');
		const emotions = formData.get('emotions');

		let validatedData;
		try {
			validatedData = v.parse(CreateDreamSchema, { rawText, context, emotions });
		} catch (e: any) {
			const issues = e.issues.map((issue: any) => issue.message);
			return fail(400, { rawText, context, emotions, error: issues.join(', ') });
		}

		const prisma = await getPrismaClient();
		const dreamAnalysisService = getDreamAnalysisService();

		try {
			let newDream = await prisma.dream.create({
				data: {
					userId: sessionUser.id,
					rawText: validatedData.rawText,
					context: validatedData.context,
					emotions: validatedData.emotions,
					status: DreamStatus.PENDING_ANALYSIS // Use enum
				}
			});

			await Promise.all([
				dreamAnalysisService.generateDreamTitle(newDream.rawText).then(
					(title) => prisma.dream.update({
						where: { id: newDream.id },
						data: { title }
					})
				),
				dreamAnalysisService.findAndSetRelatedDreams(newDream)
			])

			// --- End New Sequential Logic ---

			throw redirect(303, `/dreams/${newDream.id}`);
		} catch (e: any) {
			console.error('Error saving dream:', e);
			if (e.status === 303) {
				// Re-throw redirect
				throw e;
			}
			return fail(500, { rawText, context, emotions, error: 'Failed to save dream. Please try again.' });
		}
	}
};
