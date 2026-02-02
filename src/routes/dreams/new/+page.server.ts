import { fail, redirect } from '@sveltejs/kit';
import * as v from 'valibot';
import type { Actions } from './$types';
import { getDreamRepository } from '$lib/server/dreamRepository';
import { getPipelineCoordinator } from '$lib/server/pipelineCoordinator';

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

		const dreamRepository = getDreamRepository();

		try {
			// Create the dream in CREATED state
			const newDream = await dreamRepository.createDream({
				userId: sessionUser.id,
				rawText: validatedData.rawText,
				context: validatedData.context,
				emotions: validatedData.emotions,
				promptType: 'jungian'
			});

			// Start the analysis pipeline (actors will handle title, relationships, interpretation)
			const coordinator = await getPipelineCoordinator();
			await coordinator.startAnalysis(newDream.id);

			// Redirect to the dream page (streaming will continue in background)
			throw redirect(303, `/dreams/${newDream.id}`);
		} catch (e: any) {
			console.error('Error creating dream:', e);
			if (e.status === 303) {
				// Re-throw redirect
				throw e;
			}
			return fail(500, { rawText, context, emotions, error: 'Failed to create dream. Please try again.' });
		}
	}
};
