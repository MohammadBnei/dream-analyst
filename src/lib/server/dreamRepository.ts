/**
 * DreamRepository - Centralized database access layer for dreams
 * 
 * Encapsulates all Prisma operations related to dreams, state changes, and versioning.
 */

import { getPrismaClient } from '$lib/server/db';
import type { Dream, DreamStatus } from '@prisma/client';
import { AuditEventType, DreamState } from '$lib/types';

export interface DreamWithRelations extends Dream {
	relatedTo?: Array<{
		id: string;
		title: string | null;
		dreamDate: Date;
		rawText: string;
	}>;
}

export interface StateChangeEventData {
	dreamId: string;
	version: number;
	eventType: string | AuditEventType;
	state: DreamState;
	oldRawText?: string;
	newRawText?: string;
	oldInterpretation?: string;
	newInterpretation?: string;
	oldTitle?: string;
	newTitle?: string;
}

export class DreamRepository {
	private prisma: Awaited<ReturnType<typeof getPrismaClient>> | undefined;

	private async getPrisma() {
		if (!this.prisma) {
			this.prisma = await getPrismaClient();
		}
		return this.prisma;
	}

	/**
	 * Get a dream by ID with optional relations
	 */
	async getDream(dreamId: string, includeRelations = false): Promise<Dream | null> {
		const prisma = await this.getPrisma();
		return prisma.dream.findUnique({
			where: { id: dreamId },
			include: includeRelations
				? {
					relatedTo: {
						select: {
							id: true,
							title: true,
							dreamDate: true,
							rawText: true
						}
					}
				}
				: undefined
		});
	}

	/**
	 * Get a dream with full relations
	 */
	async getDreamWithRelations(dreamId: string): Promise<DreamWithRelations | null> {
		const prisma = await this.getPrisma();
		return prisma.dream.findUnique({
			where: { id: dreamId },
			include: {
				relatedTo: {
					select: {
						id: true,
						title: true,
						dreamDate: true,
						rawText: true
					}
				}
			}
		});
	}

	/**
	 * Create a new dream
	 */
	async createDream(data: {
		userId: string;
		rawText: string;
		context?: string;
		emotions?: string;
		dreamDate?: Date;
		promptType?: string;
	}): Promise<Dream> {
		const prisma = await this.getPrisma();
		return prisma.dream.create({
			data: {
				userId: data.userId,
				rawText: data.rawText,
				context: data.context,
				emotions: data.emotions,
				dreamDate: data.dreamDate || new Date(),
				promptType: data.promptType || 'jungian',
				state: DreamState.CREATED,
				version: 0,
				status: 'PENDING_ANALYSIS'
			}
		});
	}

	/**
	 * Update dream fields
	 */
	async updateDream(
		dreamId: string,
		data: Partial<{
			rawText: string;
			title: string;
			interpretation: string;
			status: DreamStatus;
			state: DreamState;
			version: number;
			tags: any;
			promptType: string;
			context: string;
			emotions: string;
		}>
	): Promise<Dream> {
		const prisma = await this.getPrisma();
		return prisma.dream.update({
			where: { id: dreamId },
			data: {
				...data,
				updatedAt: new Date()
			}
		});
	}

	/**
	 * Set related dreams
	 */
	async setRelatedDreams(dreamId: string, relatedDreamIds: string[]): Promise<Dream> {
		const prisma = await this.getPrisma();

		// First, disconnect all existing relations
		await prisma.dream.update({
			where: { id: dreamId },
			data: {
				relatedTo: {
					set: []
				}
			}
		});

		// Then, connect the new relations
		return prisma.dream.update({
			where: { id: dreamId },
			data: {
				relatedTo: {
					connect: relatedDreamIds.map((id) => ({ id }))
				},
				updatedAt: new Date()
			},
			include: {
				relatedTo: {
					select: {
						id: true,
						title: true,
						dreamDate: true,
						rawText: true
					}
				}
			}
		});
	}

	/**
	 * Get the last N dreams for a user (excluding a specific dream)
	 */
	async getLastDreams(userId: string, excludeDreamId: string, limit = 3): Promise<Dream[]> {
		const prisma = await this.getPrisma();
		return prisma.dream.findMany({
			where: {
				userId,
				id: { not: excludeDreamId }
			},
			orderBy: {
				dreamDate: 'desc'
			},
			take: limit,
			select: {
				id: true,
				rawText: true,
				dreamDate: true,
				status: true,
				title: true,
				interpretation: true,
				userId: true,
				context: true,
				emotions: true,
				analysisText: true,
				promptType: true,
				tags: true,
				state: true,
				version: true,
				createdAt: true,
				updatedAt: true
			}
		});
	}

	/**
	 * Search for relevant past dreams using full-text search
	 */
	async searchRelevantDreams(
		userId: string,
		searchTerms: string[],
		excludeDreamId: string,
		limit = 5
	): Promise<Dream[]> {
		const prisma = await this.getPrisma();

		if (searchTerms.length === 0) {
			return [];
		}

		searchTerms = searchTerms.map((term) => term.trim().split(/[^\w\d]/g).filter(Boolean)).flat();
		console.log({ searchTerms })

		return prisma.dream.findMany({
			where: {
				userId,
				id: { not: excludeDreamId },
				OR: [
					{
						rawText: {
							search: searchTerms.join('|'),
							mode: 'insensitive'
						}
					},
					{
						interpretation: {
							search: searchTerms.join('|'),
							mode: 'insensitive'
						}
					},
					{
						title: {
							search: searchTerms.join('|'),
							mode: 'insensitive'
						}
					}
				]
			},
			orderBy: {
				dreamDate: 'desc'
			},
			take: limit
		});
	}

	/**
	 * Record a state change event
	 */
	async recordStateChange(data: StateChangeEventData): Promise<void> {
		const prisma = await this.getPrisma();
		await prisma.dreamStateChangeEvent.create({
			data: {
				dreamId: data.dreamId,
				version: data.version,
				eventType: data.eventType,
				state: data.state,
				oldRawText: data.oldRawText,
				newRawText: data.newRawText,
				oldInterpretation: data.oldInterpretation,
				newInterpretation: data.newInterpretation,
				oldTitle: data.oldTitle,
				newTitle: data.newTitle
			}
		});
	}

	/**
	 * Get state change history for a dream
	 */
	async getStateHistory(dreamId: string): Promise<any[]> {
		const prisma = await this.getPrisma();
		return prisma.dreamStateChangeEvent.findMany({
			where: { dreamId },
			orderBy: { version: 'asc' }
		});
	}

	/**
	 * Get a specific version of a dream's interpretation
	 */
	async getDreamVersion(dreamId: string, version: number): Promise<any | null> {
		const prisma = await this.getPrisma();
		return prisma.dreamStateChangeEvent.findUnique({
			where: {
				dreamId_version: {
					dreamId,
					version
				}
			}
		});
	}
}

// Singleton instance
let dreamRepositoryInstance: DreamRepository;

export function getDreamRepository(): DreamRepository {
	if (!dreamRepositoryInstance) {
		dreamRepositoryInstance = new DreamRepository();
	}
	return dreamRepositoryInstance;
}
