import { json, error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/utils/auth';
import { getPrismaClient } from '$lib/server/db';
import * as v from 'valibot';
import { DreamStatus } from '@prisma/client'; // Import the Prisma DreamStatus enum
import { parseDreamTags } from '$lib/server/utils/dream';


// GET /api/dreams/[id] - Get a single dream by ID for the current user
export async function GET({ params, locals }) {
	const dreamId = params.id;
	const sessionUser = requireUser(locals);
	const prisma = await getPrismaClient();

	if (!dreamId) {
		throw error(400, 'Dream ID is required.');
	}

	try {
		const dream = await prisma.dream.findUnique({
			where: {
				id: dreamId,
				userId: sessionUser.id
			}
		});

		if (!dream) {
			throw error(404, 'Dream not found.');
		}

		// Ensure tags are parsed correctly if stored as JSON string
		const dreamWithParsedTags = parseDreamTags(dream);

		return json(dreamWithParsedTags);
	} catch (e) {
		console.error(`Error fetching dream ${dreamId}:`, e);
		throw error(500, 'Failed to fetch dream.');
	}
}

// PUT /api/dreams/[id] - Update an existing dream's rawText
export async function PUT({ request, params, locals }) {
	const dreamId = params.id;
	const sessionUser = requireUser(locals);
	const prisma = await getPrismaClient();

	if (!dreamId) {
		throw error(400, 'Dream ID is required.');
	}

	const UpdateDreamSchema = v.object({
		rawText: v.pipe(v.string(), v.minLength(10, 'Dream text must be at least 10 characters long.'))
	});

	let validatedData;
	try {
		const body = await request.json();
		validatedData = v.parse(UpdateDreamSchema, body);
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
				rawText: validatedData.rawText,
				updatedAt: new Date()
			}
		});
		return json({ message: 'Dream updated successfully', dream: updatedDream });
	} catch (e) {
		console.error('Error updating dream:', e);
		throw error(500, 'Failed to update dream due to a server error.');
	}
}

// DELETE /api/dreams/[id] - Delete a dream
export async function DELETE({ params, locals }) {
	const dreamId = params.id;
	const sessionUser = requireUser(locals);
	const prisma = await getPrismaClient();

	if (!dreamId) {
		throw error(400, 'Dream ID is required.');
	}

	try {
		const dream = await prisma.dream.findUnique({
			where: {
				id: dreamId,
				userId: sessionUser.id
			}
		});

		if (!dream) {
			throw error(404, 'Dream not found or you do not have permission to delete it.');
		}

		await prisma.dream.delete({
			where: {
				id: dreamId
			}
		});

		return json({ message: 'Dream deleted successfully.' });
	} catch (e) {
		console.error('Error deleting dream:', e);
		throw error(500, 'Failed to delete dream.');
	}
}
