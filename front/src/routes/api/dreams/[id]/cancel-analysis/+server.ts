import { error, json } from '@sveltejs/kit';
import { getStreamStateStore } from '$lib/server/streamStateStore';
import { getPrismaClient } from '$lib/server/db';
import { DreamStatus } from '@prisma/client';
import { getOrCreateStreamProcessor } from '$lib/server/streamProcessor';
import { requireOwnedDream } from '$lib/server/guards';

export async function POST({ params, locals, platform }) {
	const dreamId = params.id;
	if (!dreamId) error(400, 'Dream ID is required.');

	// Outside the try on purpose: error() signals by throwing, so a 401/404 raised
	// inside would be caught below and re-reported as a 500.
	const dream = await requireOwnedDream(locals, dreamId);

	const prisma = getPrismaClient();
	const streamStateStore = await getStreamStateStore();

	try {
		// ponytail: getOrCreateStreamProcessor CREATES a processor when none is
		// found, so cancelling on a pod that is not running the analysis starts a
		// fresh one only to abort it. The lookup/start split that fixes this lands
		// with the streaming-lifecycle work; leaving the existing behaviour here
		// rather than half-changing it.
		const processor = getOrCreateStreamProcessor(dream, platform);

		if (processor) {
			processor.cancelStream();
		} else if (dream.status === DreamStatus.PENDING_ANALYSIS) {
			await prisma.dream.update({
				where: { id: dreamId },
				data: { status: DreamStatus.ANALYSIS_FAILED }
			});
		}

		// Clear Redis state so no client re-subscribes to a cancelled stream.
		await streamStateStore.clearStreamState(dreamId);

		return json({ message: 'Analysis cancellation initiated successfully.' }, { status: 200 });
	} catch (e) {
		// Was interpolating the raw message into the response, leaking internals.
		console.error(`Error cancelling analysis for dream ${dreamId}:`, e);
		error(500, 'Failed to cancel analysis.');
	}
}
