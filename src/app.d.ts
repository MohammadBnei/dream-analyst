// See https://svelte.dev/docs/kit/types#app.d.ts
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

		// Define the Dream type based on your Prisma schema
		interface Dream {
			id: string;
			userId: string;
			rawText: string;
			analysisText: string | null;
			interpretation: string | null;
			status: 'pending_analysis' | 'completed' | 'analysis_failed';
			tags: string[] | null; // Assuming tags are stored as JSONB array of strings
			createdAt: Date;
			updatedAt: Date;
		}
	}
}

export {};
