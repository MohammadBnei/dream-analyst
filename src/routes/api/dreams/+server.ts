import { json, error } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
import * as v from 'valibot';
import { DreamStatus } from '@prisma/client'; // Import the Prisma DreamStatus enum

// Helper to get the current user from the request event
function getCurrentUser(locals: App.Locals) {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	return locals.user;
}

// GET /api/dreams - Get all dreams for the current user
export async function GET({ locals }) {
	const sessionUser = getCurrentUser(locals);
	const prisma = await getPrismaClient();

	try {
		const dreams = await prisma.dream.findMany({
			where: {
				userId: sessionUser.id
			},
			orderBy: {
				createdAt: 'desc'
			}
		});

		// Ensure tags are parsed correctly if stored as JSON string
		const dreamsWithParsedTags = dreams.map((dream) => ({
			...dream,
			tags: dream.tags ? (dream.tags as string[]) : null
		}));

		return json(dreamsWithParsedTags);
	} catch (e) {
		console.error('Error fetching dreams:', e);
		throw error(500, 'Failed to fetch dreams.');
	}
}

// POST /api/dreams - Create a new dream
export async function POST({ request, locals }) {
	const sessionUser = getCurrentUser(locals);

	const CreateDreamSchema = v.object({
		rawText: v.pipe(v.string(), v.minLength(10, 'Dream text must be at least 10 characters long.')),
		promptType: v.optional(v.string()),
		dreamDate: v.optional(v.string()), // ISO date string
		metadata: v.optional(v.record(v.string(), v.unknown()))
	});

	let validatedData;
	try {
		const body = await request.json();
		validatedData = v.parse(CreateDreamSchema, body);
	} catch (e) {
		console.error('Validation error:', e);
		throw error(400, 'Invalid request body.');
	}

	try {
		// Import DreamService dynamically to avoid circular dependencies
		const { dreamService } = await import('$lib/server/services');

		const newDream = await dreamService.createDream({
			userId: sessionUser.id,
			rawText: validatedData.rawText,
			dreamDate: validatedData.dreamDate ? new Date(validatedData.dreamDate) : new Date(),
			promptType: validatedData.promptType,
			metadata: validatedData.metadata
		});

		return json(
			{ dreamId: newDream.id, message: 'Dream saved. Initiating analysis stream...' },
			{ status: 201 }
		);
	} catch (e) {
		console.error('Error saving dream:', e);
		if (e instanceof Error && e.message.includes('Invalid metadata')) {
			throw error(400, e.message);
		}
		throw error(500, 'Failed to save dream. Please try again.');
	}
}
