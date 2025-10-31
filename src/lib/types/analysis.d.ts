import type { Dream } from '@prisma/client';

// Define the custom type for the processed stream chunks
export interface AnalysisStreamChunk {
	content?: string;
	tags?: string[];
	status?: Dream['status']; // This refers to the DreamStatus enum from Prisma
	message?: string;
	finalStatus?: 'COMPLETED' | 'ANALYSIS_FAILED';
}
