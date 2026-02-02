import type { Symbol, DreamSymbolOccurrence, Sentiment } from '@prisma/client';
import { getPrismaClient } from '../db';

export type SymbolWithOccurrence = DreamSymbolOccurrence & { symbol: Symbol };

export interface SymbolProgression {
	symbolId: string;
	symbolName: string;
	category: string | null;
	totalOccurrences: number;
	firstSeen: Date;
	lastSeen: Date;
	sentimentDistribution: {
		positive: number;
		neutral: number;
		negative: number;
		ambivalent: number;
	};
	prominenceAverage: number;
	occurrences: Array<{
		dreamId: string;
		dreamDate: Date;
		sentiment: Sentiment;
		contextNote: string | null;
		prominence: number;
	}>;
}

export class SymbolService {
	async upsertSymbol(name: string, category?: string): Promise<Symbol> {
		const prisma = await getPrismaClient();
		return prisma.symbol.upsert({
			where: { name: name.trim() },
			create: {
				name: name.trim(),
				category,
				occurrenceCount: 0
			},
			update: {
				category: category ?? undefined
			}
		});
	}

	async createOccurrence(data: {
		dreamId: string;
		symbolName: string;
		sentiment: Sentiment;
		contextNote?: string;
		prominence?: number;
	}): Promise<DreamSymbolOccurrence> {
		const prisma = await getPrismaClient();

		const symbol = await this.upsertSymbol(data.symbolName);

		const occurrence = await prisma.dreamSymbolOccurrence.create({
			data: {
				dreamId: data.dreamId,
				symbolId: symbol.id,
				sentiment: data.sentiment,
				contextNote: data.contextNote,
				prominence: data.prominence ?? 2
			}
		});

		await prisma.symbol.update({
			where: { id: symbol.id },
			data: { occurrenceCount: { increment: 1 } }
		});

		return occurrence;
	}

	async bulkCreateOccurrences(
		dreamId: string,
		symbols: Array<{
			name: string;
			sentiment: Sentiment;
			contextNote?: string;
			prominence?: number;
		}>
	): Promise<void> {
		for (const s of symbols) {
			await this.createOccurrence({
				dreamId,
				symbolName: s.name,
				sentiment: s.sentiment,
				contextNote: s.contextNote,
				prominence: s.prominence
			});
		}
	}

	async getSymbolsForDream(dreamId: string): Promise<SymbolWithOccurrence[]> {
		const prisma = await getPrismaClient();
		return prisma.dreamSymbolOccurrence.findMany({
			where: { dreamId },
			include: { symbol: true },
			orderBy: { prominence: 'desc' }
		});
	}

	async getSymbolProgression(symbolId: string, userId: string): Promise<SymbolProgression> {
		const prisma = await getPrismaClient();

		const symbol = await prisma.symbol.findUnique({
			where: { id: symbolId }
		});

		if (!symbol) throw new Error('Symbol not found');

		const occurrences = await prisma.dreamSymbolOccurrence.findMany({
			where: {
				symbolId,
				dream: { userId }
			},
			include: {
				dream: {
					select: {
						id: true,
						dreamDate: true
					}
				}
			},
			orderBy: { dream: { dreamDate: 'asc' } }
		});

		const sentimentCounts = {
			positive: 0,
			neutral: 0,
			negative: 0,
			ambivalent: 0
		};

		occurrences.forEach((occ) => {
			sentimentCounts[occ.sentiment.toLowerCase() as keyof typeof sentimentCounts]++;
		});

		const avgProminence =
			occurrences.length > 0
				? occurrences.reduce((sum, occ) => sum + occ.prominence, 0) / occurrences.length
				: 0;

		return {
			symbolId: symbol.id,
			symbolName: symbol.name,
			category: symbol.category,
			totalOccurrences: occurrences.length,
			firstSeen: occurrences[0]?.dream.dreamDate ?? symbol.firstSeenAt,
			lastSeen: occurrences[occurrences.length - 1]?.dream.dreamDate ?? symbol.lastSeenAt,
			sentimentDistribution: sentimentCounts,
			prominenceAverage: avgProminence,
			occurrences: occurrences.map((occ) => ({
				dreamId: occ.dreamId,
				dreamDate: occ.dream.dreamDate,
				sentiment: occ.sentiment,
				contextNote: occ.contextNote,
				prominence: occ.prominence
			}))
		};
	}

	async getUserRecurringSymbols(userId: string, minOccurrences = 3): Promise<Symbol[]> {
		const prisma = await getPrismaClient();

		const symbols = await prisma.symbol.findMany({
			where: {
				occurrences: {
					some: { dream: { userId } }
				}
			},
			include: {
				_count: {
					select: {
						occurrences: {
							where: { dream: { userId } }
						}
					}
				}
			}
		});

		return symbols
			.filter((s) => s._count.occurrences >= minOccurrences)
			.sort((a, b) => b._count.occurrences - a._count.occurrences);
	}

	async getSymbolById(id: string): Promise<Symbol | null> {
		const prisma = await getPrismaClient();
		return prisma.symbol.findUnique({ where: { id } });
	}

	async getSymbolByName(name: string): Promise<Symbol | null> {
		const prisma = await getPrismaClient();
		return prisma.symbol.findUnique({ where: { name } });
	}
}

// Export singleton instance
export const symbolService = new SymbolService();
