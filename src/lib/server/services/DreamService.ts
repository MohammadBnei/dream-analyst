import type { Dream } from '@prisma/client';
import { getPrismaClient } from '../db';
import {
	metadataConfigService,
	type MetadataValues,
	type MetadataSchema
} from './MetadataConfigService';
import { symbolService } from './SymbolService';

export interface CreateDreamInput {
	userId: string;
	rawText: string;
	dreamDate: Date;
	promptType?: string;
	metadata?: MetadataValues;
}

export interface AnalysisContext {
	metadataContext: string;
	pastDreamsContext: string;
}

export class DreamService {
	async createDream(data: CreateDreamInput): Promise<Dream> {
		const prisma = await getPrismaClient();

		// Validate metadata if provided
		if (data.metadata) {
			const schema = await metadataConfigService.getUserEffectiveSchema(data.userId);
			if (schema) {
				const validation = metadataConfigService.validateMetadataValues(data.metadata, schema);
				if (!validation.valid) {
					throw new Error(`Invalid metadata: ${validation.errors.join(', ')}`);
				}
			}
		}

		return prisma.dream.create({
			data: {
				userId: data.userId,
				rawText: data.rawText,
				dreamDate: data.dreamDate,
				promptType: data.promptType ?? 'jungian',
				metadata: data.metadata ?? null,
				metadataSchema: data.metadata ? { version: '1.0' } : null,
				status: 'PENDING_ANALYSIS'
			}
		});
	}

	async getDreamWithSymbols(dreamId: string, userId: string) {
		const prisma = await getPrismaClient();

		return prisma.dream.findFirst({
			where: { id: dreamId, userId },
			include: {
				symbolOccurrences: {
					include: { symbol: true },
					orderBy: { prominence: 'desc' }
				},
				relatedTo: {
					select: {
						id: true,
						title: true,
						dreamDate: true
					}
				}
			}
		});
	}

	async buildAnalysisContext(dreamId: string, userId: string): Promise<AnalysisContext> {
		const prisma = await getPrismaClient();

		const dream = await prisma.dream.findFirst({
			where: { id: dreamId, userId }
		});

		if (!dream) throw new Error('Dream not found');

		// Get metadata context
		const schema = await metadataConfigService.getUserEffectiveSchema(userId);
		const metadataContext = metadataConfigService.formatForPrompt(
			dream.metadata as MetadataValues,
			schema
		);

		// Get past dreams context
		const pastDreams = await prisma.dream.findMany({
			where: {
				userId,
				id: { not: dreamId },
				status: 'COMPLETED'
			},
			orderBy: { dreamDate: 'desc' },
			take: 3,
			select: {
				title: true,
				rawText: true,
				dreamDate: true
			}
		});

		const pastDreamsContext =
			pastDreams.length > 0
				? '\n## PAST DREAMS:\n\n' +
					pastDreams
						.map(
							(d) =>
								`**${d.title || 'Untitled'}** (${d.dreamDate.toLocaleDateString()})\n${d.rawText.substring(0, 200)}...`
						)
						.join('\n\n')
				: '';

		return { metadataContext, pastDreamsContext };
	}

	async updateInterpretation(dreamId: string, interpretation: string): Promise<Dream> {
		const prisma = await getPrismaClient();

		return prisma.dream.update({
			where: { id: dreamId },
			data: {
				interpretation,
				status: 'COMPLETED',
				updatedAt: new Date()
			}
		});
	}

	async updateTitle(dreamId: string, title: string): Promise<Dream> {
		const prisma = await getPrismaClient();

		return prisma.dream.update({
			where: { id: dreamId },
			data: { title, updatedAt: new Date() }
		});
	}

	async updateStatus(
		dreamId: string,
		status: 'PENDING_ANALYSIS' | 'COMPLETED' | 'ANALYSIS_FAILED'
	): Promise<Dream> {
		const prisma = await getPrismaClient();

		return prisma.dream.update({
			where: { id: dreamId },
			data: { status, updatedAt: new Date() }
		});
	}
}

// Export singleton instance
export const dreamService = new DreamService();
