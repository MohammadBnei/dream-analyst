// See https://svelte.dev/docs/kit/types#app.d.ts

import type { Dream } from "@prisma/client";

// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			// The user object will now be derived from the JWT payload
			// It will contain at least the userId, and potentially other user data
			user?: {
				id: string;
				username: string;
				email: string; // Added email field
			};
			// The 'session' object is removed as we are no longer using Lucia's session management
		}
		// interface Error {}
		// interface PageData {}
		// interface Platform {}

	}
}

export { };
