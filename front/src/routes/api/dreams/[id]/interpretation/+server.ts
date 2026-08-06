import { json, error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/utils/auth';
import { getPrismaClient } from '$lib/server/db';
import * as v from 'valibot';
import { DreamStatus } from '@prisma/client'; // Import the Prisma DreamStatus enum


// PUT /api/dreams/[id]/interpretation - Update an existing dream's interpretation
export async function PUT({ request, params, locals }) {
	const dreamId = params.id;
	const sessionUser = requireUser(locals);
	const prisma = await getPrismaClient();

	if (!dreamId) {
		throw error(400, 'Dream ID is required.');
	}

	const UpdateInterpretationSchema = v.object({
		interpretation: v.pipe(
			v.string(),
			v.minLength(10, 'Interpretation must be at least 10 characters long.')
		)
	});

	let validatedData;
	try {
		const body = await request.json();
		validatedData = v.parse(UpdateInterpretationSchema, body);
	} catch (e) {
		console.error('Validation error:', e);
		throw error(400, 'Invalid request body.');
	}

	try {
		const existingDream = await prisma.dream.findUnique({
			where: { id: dreamId }
		});

		if (!existingDream || existingDream.userId !== sessionUser.id) {
			throw error(403, 'Forbidden: You do not own this dream or it does not exist.');
		}

		const updatedDream = await prisma.dream.update({
			where: { id: dreamId },
			data: {
				interpretation: validatedData.interpretation,
				updatedAt: new Date()
			}
		});
		return json({ message: 'Dream interpretation updated successfully', dream: updatedDream });
	} catch (e) {
		console.error('Error updating dream interpretation:', e);
		throw error(500, 'Failed to update dream interpretation due to a server error.');
	}
}
