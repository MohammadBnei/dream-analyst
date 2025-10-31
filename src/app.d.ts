// See https://svelte.dev/docs/kit/types#app.d.ts

import type { Dream, DreamChat } from '@prisma/client';
import type { ChatMessage } from '$lib/types/chat'; // Import the shared ChatMessage interface

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
				role: UserRole;
			};
		}
		// interface Error {}
		// interface PageData {}
		// interface Platform {}

		// Remove the redundant ChatMessage declaration here
		// interface ChatMessage extends DreamChat {}
	}
}

export {};
