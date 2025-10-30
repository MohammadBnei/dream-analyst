import { error, json } from '@sveltejs/kit';
import { getStreamStateStore } from '$lib/server/streamStateStore';
import { getPrismaClient } from '$lib/server/db';
import { DreamStatus } from '@prisma/client';
import { getOrCreateStreamProcessor } from '$lib/server/streamProcessor'; // Import getOrCreateStreamProcessor

function getCurrentUser(locals: App.Locals) {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}
	return locals.user;
}

export async function POST({ params, locals, platform }) {
	const dreamId = params.id;
	const sessionUser = getCurrentUser(locals);

	if (!sessionUser) {
		throw error(401, 'Unauthorized');
	}

	if (!dreamId) {
		throw error(400, 'Dream ID is required.');
	}

	const prisma = await getPrismaClient();
	const streamStateStore = await getStreamStateStore();

	try {
		const dream = await prisma.dream.findUnique({
			where: { id: dreamId }
		});

		if (!dream || dream.userId !== sessionUser.id) {
			throw error(403, 'Forbidden: Dream does not belong to user or does not exist.');
		}

		// Get the existing processor. We pass the dream and platform just in case
		// it needs to be created (though it should already exist if analysis is pending).
		const processor = getOrCreateStreamProcessor(dream, platform);

		if (processor) {
			console.log(`Received cancel request for dream ${dreamId} from user ${sessionUser.id}. Signaling processor to cancel.`);
			processor.cancelStream(); // This will trigger the AbortController in StreamProcessor
			// The StreamProcessor's handleStreamAbort will then update the DB status to ANALYSIS_FAILED
			// and clear its own Redis state.
		} else {
			console.log(`No active StreamProcessor found for dream ${dreamId}.`);
			// If no processor is found, ensure the dream status is updated in DB if it's still PENDING_ANALYSIS
			if (dream.status === DreamStatus.PENDING_ANALYSIS) {
				await prisma.dream.update({
					where: { id: dreamId },
					data: { status: DreamStatus.ANALYSIS_FAILED } // Mark as failed if cancelled before completion
				});
			}
		}

		// Clear the Redis state for this stream ID to ensure no client tries to re-subscribe to it
		// and to remove any lingering state if the processor wasn't found or hadn't fully started.
		await streamStateStore.clearStreamState(dreamId);

		return json({ message: 'Analysis cancellation initiated successfully.' }, { status: 200 });
	} catch (e) {
		console.error(`Error cancelling analysis for dream ${dreamId}:`, e);
		throw error(500, `Failed to cancel analysis: ${(e as Error).message}`);
	}
}
