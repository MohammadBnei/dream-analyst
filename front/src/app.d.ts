// See https://svelte.dev/docs/kit/types#app.d.ts

// $lib/types/chat was imported here but that directory has never existed; the
// import resolved to `any` under skipLibCheck instead of failing loudly.
import type { Dream as IDream, DreamChat, UserRole } from '@prisma/client';

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

		type Dream = IDream;
		type ChatMessage = DreamChat;
		interface AnalysisStreamChunk {
			content?: string;
			status?: Dream['status']; // This refers to the DreamStatus enum from Prisma
			message?: string;
			finalStatus?: 'COMPLETED' | 'ANALYSIS_FAILED';
		}
	}
}

export {};
