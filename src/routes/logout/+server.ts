import { deleteAuthTokenCookie } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';

export async function POST({ cookies }) {
	deleteAuthTokenCookie(cookies);
	throw redirect(302, '/');
}
