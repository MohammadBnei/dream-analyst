/**
 * Analytics Service
 * Provides aggregated data for dashboard visualizations
 */

import { getPrismaClient } from '../db';

export interface MoodTrendData {
	date: string;
	preSleepMood: number | null;
	postWakeMood: number | null;
}

export interface TopSymbolData {
	id: string;
	name: string;
	occurrences: number;
	avgProminence: number;
	dominantSentiment: string;
	sentimentDistribution: {
		positive: number;
		neutral: number;
		negative: number;
		ambivalent: number;
	};
}

export interface ActivityData {
	date: string;
	total: number;
	completed: number;
}

export interface CreditUsageData {
	totalTransactions: number;
	byActionType: Record<
		string,
		{
			count: number;
			totalCredits: number;
		}
	>;
	dailyAverage: number;
}

export interface UserStats {
	totalDreams: number;
	uniqueSymbols: number;
	chatMessages: number;
	insightReports: number;
	memberSince: Date;
}

export class AnalyticsService {
	/**
	 * Get mood trends over time.
	 */
	async getMoodTrends(userId: string, range: string = '30d'): Promise<MoodTrendData[]> {
		const prisma = await getPrismaClient();

		const days = this.parseDateRange(range);
		const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

		const dreams = await prisma.dream.findMany({
			where: {
				userId,
				dreamDate: { gte: since },
				metadata: { not: null }
			},
			select: {
				dreamDate: true,
				metadata: true
			},
			orderBy: { dreamDate: 'asc' }
		});

		// Extract mood data from metadata
		return dreams
			.map((d) => {
				const metadata = d.metadata as Record<string, unknown>;
				return {
					date: d.dreamDate.toISOString().split('T')[0],
					preSleepMood: (metadata?.preSleepMood as number) || null,
					postWakeMood: (metadata?.postWakeMood as number) || null
				};
			})
			.filter((d) => d.preSleepMood !== null || d.postWakeMood !== null);
	}

	/**
	 * Get top symbols with frequency and sentiment distribution.
	 */
	async getTopSymbols(userId: string, limit: number = 10): Promise<TopSymbolData[]> {
		const prisma = await getPrismaClient();

		const symbols = await prisma.symbol.findMany({
			where: {
				occurrences: {
					some: { dream: { userId } }
				}
			},
			include: {
				occurrences: {
					where: { dream: { userId } },
					select: {
						sentiment: true,
						prominence: true
					}
				}
			}
		});

		// Calculate stats for each symbol
		const symbolStats = symbols.map((symbol) => {
			const sentimentCounts = {
				positive: 0,
				neutral: 0,
				negative: 0,
				ambivalent: 0
			};

			let totalProminence = 0;

			symbol.occurrences.forEach((occ) => {
				sentimentCounts[occ.sentiment.toLowerCase() as keyof typeof sentimentCounts]++;
				totalProminence += occ.prominence;
			});

			const totalOccurrences = symbol.occurrences.length;
			const avgProminence = totalOccurrences > 0 ? totalProminence / totalOccurrences : 0;

			// Calculate dominant sentiment
			const dominantSentiment = Object.entries(sentimentCounts).reduce((a, b) =>
				a[1] > b[1] ? a : b
			)[0];

			return {
				id: symbol.id,
				name: symbol.name,
				occurrences: totalOccurrences,
				avgProminence,
				dominantSentiment,
				sentimentDistribution: sentimentCounts
			};
		});

		// Sort by occurrences and return top N
		return symbolStats.sort((a, b) => b.occurrences - a.occurrences).slice(0, limit);
	}

	/**
	 * Get dream activity over time.
	 */
	async getDreamActivity(
		userId: string,
		range: string = '30d',
		granularity: 'day' | 'week' | 'month' = 'day'
	): Promise<ActivityData[]> {
		const prisma = await getPrismaClient();

		const days = this.parseDateRange(range);
		const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

		const dreams = await prisma.dream.findMany({
			where: {
				userId,
				dreamDate: { gte: since }
			},
			select: {
				dreamDate: true,
				status: true
			},
			orderBy: { dreamDate: 'asc' }
		});

		// Group by date based on granularity
		const grouped = dreams.reduce(
			(acc, dream) => {
				const key = this.formatDateByGranularity(dream.dreamDate, granularity);
				if (!acc[key]) {
					acc[key] = { total: 0, completed: 0 };
				}
				acc[key].total++;
				if (dream.status === 'COMPLETED') {
					acc[key].completed++;
				}
				return acc;
			},
			{} as Record<string, { total: number; completed: number }>
		);

		return Object.entries(grouped).map(([date, stats]) => ({
			date,
			...stats
		}));
	}

	/**
	 * Get credit usage analytics.
	 */
	async getCreditUsage(userId: string, range: string = '30d'): Promise<CreditUsageData> {
		const prisma = await getPrismaClient();

		const days = this.parseDateRange(range);
		const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

		const transactions = await prisma.creditTransaction.findMany({
			where: {
				userId,
				createdAt: { gte: since }
			},
			select: {
				amount: true,
				actionType: true,
				createdAt: true
			},
			orderBy: { createdAt: 'asc' }
		});

		// Group by action type
		const byActionType = transactions.reduce(
			(acc, tx) => {
				const type = tx.actionType;
				if (!acc[type]) {
					acc[type] = { count: 0, totalCredits: 0 };
				}
				acc[type].count++;
				acc[type].totalCredits += Math.abs(tx.amount);
				return acc;
			},
			{} as CreditUsageData['byActionType']
		);

		return {
			totalTransactions: transactions.length,
			byActionType,
			dailyAverage: transactions.length / days
		};
	}

	/**
	 * Get user's overall statistics.
	 */
	async getUserStats(userId: string): Promise<UserStats> {
		const prisma = await getPrismaClient();

		const [dreamCount, symbolCount, chatMessageCount, insightReportCount, firstDream] =
			await Promise.all([
				prisma.dream.count({ where: { userId } }),
				prisma.symbol.count({
					where: {
						occurrences: { some: { dream: { userId } } }
					}
				}),
				prisma.dreamChat.count({ where: { userId, role: 'user' } }),
				prisma.insightReport.count({ where: { userId } }),
				prisma.dream.findFirst({
					where: { userId },
					orderBy: { createdAt: 'asc' },
					select: { createdAt: true }
				})
			]);

		return {
			totalDreams: dreamCount,
			uniqueSymbols: symbolCount,
			chatMessages: chatMessageCount,
			insightReports: insightReportCount,
			memberSince: firstDream?.createdAt || new Date()
		};
	}

	/**
	 * Parse date range string (e.g., "30d", "7d", "90d").
	 */
	private parseDateRange(range: string): number {
		const match = range.match(/^(\d+)([dwmy])$/);
		if (!match) return 30; // Default 30 days

		const [, num, unit] = match;
		const value = parseInt(num);

		switch (unit) {
			case 'd':
				return value;
			case 'w':
				return value * 7;
			case 'm':
				return value * 30;
			case 'y':
				return value * 365;
			default:
				return 30;
		}
	}

	/**
	 * Format date based on granularity.
	 */
	private formatDateByGranularity(date: Date, granularity: 'day' | 'week' | 'month'): string {
		const d = new Date(date);

		switch (granularity) {
			case 'day':
				return d.toISOString().split('T')[0];
			case 'week': {
				// Get week number
				const startOfYear = new Date(d.getFullYear(), 0, 1);
				const pastDays = (d.getTime() - startOfYear.getTime()) / 86400000;
				const weekNum = Math.ceil((pastDays + startOfYear.getDay() + 1) / 7);
				return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
			}
			case 'month':
				return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		}
	}
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
