// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			// The user object will now be derived from the JWT payload
			// It will contain at least the userId, and potentially other user data
			user?: {
				userId: string;
			};
			// The 'session' object is removed as we are no longer using Lucia's session management
		}
		// interface Error {}
		// interface PageData {}
		// interface Platform {}
	}
}

export {};
