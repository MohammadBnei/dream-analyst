import { fail, redirect } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
import * as v from 'valibot';
import type { Actions } from './$types';

const CreateDreamSchema = v.object({
    rawText: v.pipe(v.string(), v.minLength(10, 'Dream text must be at least 10 characters long.'))
});

export const actions: Actions = {
    createDream: async ({ request, locals }) => {
        const sessionUser = locals.user;
        if (!sessionUser) {
            return fail(401, { message: 'Unauthorized' });
        }

        const formData = await request.formData();
        const rawText = formData.get('rawText');

        let validatedData;
        try {
            validatedData = v.parse(CreateDreamSchema, { rawText });
        } catch (e: any) {
            const issues = e.issues.map((issue: any) => issue.message);
            return fail(400, { rawText, error: issues.join(', ') });
        }

        const prisma = await getPrismaClient();

        try {
            const newDream = await prisma.dream.create({
                data: {
                    userId: sessionUser.id,
                    rawText: validatedData.rawText,
                    status: 'pending_analysis'
                }
            });

            throw redirect(303, `/dreams/${newDream.id}`);
        } catch (e: any) {
            console.error('Error saving dream:', e);
            if (e.status === 303) { // Re-throw redirect
                throw e;
            }
            return fail(500, { rawText, error: 'Failed to save dream. Please try again.' });
        }
    }
};
