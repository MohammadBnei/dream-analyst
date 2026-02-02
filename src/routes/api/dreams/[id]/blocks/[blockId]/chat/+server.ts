import { json } from '@sveltejs/kit';
import { getPrismaClient } from '$lib/server/db';
import { chatService } from '$lib/server/services';
import { promptService } from '$lib/prompts/promptService';
import type { RequestHandler } from './$types';

/**
 * POST /api/dreams/[dreamId]/blocks/[blockId]/chat
 * Chat about a specific analysis block.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const { message } = await request.json();
	const { id: dreamId, blockId } = params;

	const prisma = await getPrismaClient();

	// Get the dream and specific block
	const dream = await prisma.dream.findFirst({
		where: { id: dreamId, userId: locals.user.userId },
		select: {
			rawText: true,
			structuredAnalysis: true,
			promptType: true,
			interpretation: true
		}
	});

	if (!dream) {
		return json({ error: 'Dream not found' }, { status: 404 });
	}

	// Find the target block
	const analysis = dream.structuredAnalysis as {
		analysisBlocks?: Array<{
			id: string;
			type: string;
			title: string;
			content: string;
		}>;
	};

	const targetBlock = analysis?.analysisBlocks?.find((b) => b.id === blockId);

	if (!targetBlock) {
		return json({ error: 'Block not found' }, { status: 404 });
	}

	// Build context-specific chat prompt
	const basePrompt = promptService.getSystemPrompt(dream.promptType || 'jungian');
	const systemPrompt = `${basePrompt}

**BLOCK-SPECIFIC CONTEXT:**
You are discussing this specific section of the analysis:

**Section:** ${targetBlock.title}
**Type:** ${targetBlock.type}
**Content:** ${targetBlock.content}

**Dream Excerpt:** ${dream.rawText.substring(0, 500)}...

The user is asking about THIS SPECIFIC SECTION only. Stay focused on this aspect of the interpretation. Provide depth and insight about this particular element while maintaining the analytical framework of a ${dream.promptType || 'jungian'} dream interpreter.`;

	// Generate response using chat service
	const response = await chatService.chatWithAI(
		systemPrompt,
		message,
		dreamId,
		locals.user.userId,
		dream.promptType || 'jungian'
	);

	return json({
		blockId,
		dreamId,
		userMessage: message,
		response: response.content,
		timestamp: new Date().toISOString()
	});
};
