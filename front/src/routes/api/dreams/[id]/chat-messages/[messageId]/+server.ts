import { error, json } from '@sveltejs/kit';
import { deleteChatMessage } from '$lib/server/chat';
import { requireOwnedDream, requireUser } from '$lib/server/guards';

export async function DELETE({ params, locals }) {
	const { id: dreamId, messageId } = params;
	if (!dreamId || !messageId) error(400, 'Dream ID and Message ID are required.');

	// This route used to hand-roll its auth check and derive a 404 by
	// string-matching the thrown message. It is the last API route to adopt the
	// shared guards.
	const sessionUser = requireUser(locals);
	await requireOwnedDream(locals, dreamId);

	await deleteChatMessage(messageId, dreamId, sessionUser.id);
	return json({ message: 'Chat message deleted successfully' }, { status: 200 });
}
