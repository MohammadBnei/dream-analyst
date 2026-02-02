/**
 * Phase 2: Meta-Analyst Service
 * Provides cross-dream synthesis and proactive insights
 */

import { getPrismaClient } from '../db';
import { getLLMService } from '../llmService';
import type {
	MetaAnalysisReport,
	MetaAnalysisInsight,
	InsightType,
	AdaptiveThresholds,
	GenerateMetaAnalysisParams,
	ReportType
} from '$lib/types/insights';
import { META_ANALYSIS_FUNCTION_SCHEMA, DEFAULT_ADAPTIVE_THRESHOLDS } from '$lib/types/insights';

export class MetaAnalystService {
	private adaptiveThresholds: AdaptiveThresholds;

	constructor(thresholds: AdaptiveThresholds = DEFAULT_ADAPTIVE_THRESHOLDS) {
		this.adaptiveThresholds = thresholds;
	}

	/**
	 * Main method: Analyze last N dreams for cross-dream patterns.
	 * Triggered automatically after threshold dreams.
	 */
	async generateMetaAnalysis(params: GenerateMetaAnalysisParams): Promise<string> {
		const { userId, dreamCount = 5, triggerEvent = 'dream_count_5' } = params;
		const prisma = await getPrismaClient();

		// Get last N completed dreams
		const dreams = await prisma.dream.findMany({
			where: {
				userId,
				status: 'COMPLETED'
			},
			orderBy: { dreamDate: 'desc' },
			take: dreamCount,
			include: {
				symbolOccurrences: {
					include: { symbol: true }
				}
			}
		});

		if (dreams.length < dreamCount) {
			throw new Error(
				`Insufficient dreams for meta-analysis (need ${dreamCount}, have ${dreams.length})`
			);
		}

		// Build synthesis prompt
		const synthesisPrompt = this.buildSynthesisPrompt(dreams);

		// Call LLM for meta-analysis
		const llm = getLLMService();
		const metaAnalysis = await llm.generateStructuredAnalysis<MetaAnalysisReport>(
			synthesisPrompt,
			'', // No single dream text for meta-analysis
			'',
			'',
			META_ANALYSIS_FUNCTION_SCHEMA
		);

		// Save report to database
		const report = await prisma.insightReport.create({
			data: {
				userId,
				reportType: 'META_ANALYSIS' as ReportType,
				triggerEvent,
				dreamIds: dreams.map((d) => d.id),
				title: metaAnalysis.overallTheme,
				summary: this.generateSummary(metaAnalysis),
				insights: metaAnalysis as Record<string, unknown>,
				priority: this.calculatePriority(metaAnalysis)
			}
		});

		console.log(`Meta-analysis report generated: ${report.id} for user ${userId}`);

		return report.id;
	}

	/**
	 * Generate weekly summary report.
	 */
	async generateWeeklyReport(userId: string): Promise<string | null> {
		const prisma = await getPrismaClient();

		// Get dreams from the past week
		const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

		const dreams = await prisma.dream.findMany({
			where: {
				userId,
				createdAt: { gte: oneWeekAgo },
				status: 'COMPLETED'
			},
			include: {
				symbolOccurrences: {
					include: { symbol: true }
				}
			}
		});

		if (dreams.length === 0) {
			console.log(`No dreams this week for user ${userId}, skipping weekly report`);
			return null;
		}

		// Build weekly prompt
		const weeklyPrompt = this.buildWeeklyPrompt(dreams);

		// Generate report
		const llm = getLLMService();
		const weeklyAnalysis = await llm.generateStructuredAnalysis<MetaAnalysisReport>(
			weeklyPrompt,
			'',
			'',
			'',
			META_ANALYSIS_FUNCTION_SCHEMA
		);

		// Save report
		const report = await prisma.insightReport.create({
			data: {
				userId,
				reportType: 'WEEKLY_SUMMARY' as ReportType,
				triggerEvent: 'weekly_cron',
				dreamIds: dreams.map((d) => d.id),
				title: `Weekly Summary: ${weeklyAnalysis.overallTheme}`,
				summary: this.generateSummary(weeklyAnalysis),
				insights: weeklyAnalysis as Record<string, unknown>,
				priority: 2 // Lower priority than meta-analysis
			}
		});

		return report.id;
	}

	/**
	 * Check if user needs meta-analysis based on activity patterns.
	 * Adaptive thresholds based on user engagement.
	 */
	async shouldTriggerMetaAnalysis(userId: string): Promise<boolean> {
		const prisma = await getPrismaClient();

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { dreamCount: true }
		});

		if (!user?.dreamCount) return false;

		// Determine user activity level
		const activityLevel = await this.determineActivityLevel(userId);
		const threshold = this.adaptiveThresholds[activityLevel];

		// Check if user has dreamed recently enough
		const lastDream = await prisma.dream.findFirst({
			where: { userId },
			orderBy: { createdAt: 'desc' },
			select: { createdAt: true }
		});

		if (!lastDream) return false;

		const daysSinceLastDream = (Date.now() - lastDream.createdAt.getTime()) / (1000 * 60 * 60 * 24);

		if (daysSinceLastDream > threshold.maxDays) {
			return false; // User hasn't been active
		}

		// Check if dream count meets threshold
		return user.dreamCount % threshold.dreamCount === 0;
	}

	/**
	 * Determine user's activity level for adaptive thresholds.
	 */
	private async determineActivityLevel(
		userId: string
	): Promise<'active' | 'moderate' | 'occasional'> {
		const prisma = await getPrismaClient();

		// Count dreams in different time windows
		const now = new Date();
		const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
		const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

		const [dreams30Days, dreams90Days] = await Promise.all([
			prisma.dream.count({
				where: { userId, createdAt: { gte: thirtyDaysAgo } }
			}),
			prisma.dream.count({
				where: { userId, createdAt: { gte: ninetyDaysAgo } }
			})
		]);

		if (dreams30Days >= 5) return 'active';
		if (dreams90Days >= 5) return 'moderate';
		return 'occasional';
	}

	/**
	 * Get unread reports for user.
	 */
	async getUnreadReports(userId: string) {
		const prisma = await getPrismaClient();
		return prisma.insightReport.findMany({
			where: { userId, isRead: false },
			orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }]
		});
	}

	/**
	 * Get all reports for user (with pagination).
	 */
	async getAllReports(userId: string, limit: number = 20, offset: number = 0) {
		const prisma = await getPrismaClient();
		return prisma.insightReport.findMany({
			where: { userId },
			orderBy: { createdAt: 'desc' },
			take: limit,
			skip: offset
		});
	}

	/**
	 * Get specific report by ID.
	 */
	async getReport(reportId: string, userId: string) {
		const prisma = await getPrismaClient();
		return prisma.insightReport.findFirst({
			where: { id: reportId, userId }
		});
	}

	/**
	 * Mark report as read.
	 */
	async markReportAsRead(reportId: string) {
		const prisma = await getPrismaClient();
		await prisma.insightReport.update({
			where: { id: reportId },
			data: { isRead: true }
		});
	}

	/**
	 * Count unread reports for user.
	 */
	async countUnreadReports(userId: string): Promise<number> {
		const prisma = await getPrismaClient();
		return prisma.insightReport.count({
			where: { userId, isRead: false }
		});
	}

	// ========== Private Helper Methods ==========

	private buildSynthesisPrompt(
		dreams: Array<{
			rawText: string;
			interpretation: string | null;
			dreamDate: Date;
			symbolOccurrences: Array<{ symbol: { name: string } }>;
		}>
	): string {
		const dreamsContext = dreams
			.map((d, i) => {
				const symbols = d.symbolOccurrences.map((s) => s.symbol.name).join(', ');
				return `
**Dream ${i + 1}** (${d.dreamDate.toLocaleDateString()})
Text: ${d.rawText.substring(0, 300)}${d.rawText.length > 300 ? '...' : ''}
Analysis: ${d.interpretation?.substring(0, 200) || 'N/A'}${d.interpretation && d.interpretation.length > 200 ? '...' : ''}
Symbols: ${symbols || 'None detected'}
`;
			})
			.join('\n---\n');

		return `You are a Meta-Analyst for dream interpretation. Your role is to identify patterns, themes, and insights ACROSS multiple dreams, not analyze individual dreams.

## Your Task
Analyze these ${dreams.length} dreams holistically. Look for:
1. **Recurring Symbols** - Same symbols appearing with evolving sentiment/context
2. **Emotional Patterns** - Mood shifts, stress correlations
3. **Theme Evolution** - How themes develop over time
4. **Metadata Correlations** - Sleep quality, external factors affecting dreams
5. **Individuation Progress** - Signs of psychological growth

## Dreams to Analyze

${dreamsContext}

## Output Requirements
Provide a structured meta-analysis with:
- Overall theme (one sentence capturing the period)
- 3-5 key insights (each with specific evidence from dreams)
- Progress indicators (symbol diversity, emotional balance)
- Actionable recommendations

Focus on **meaningful patterns**, not superficial observations. Be specific and cite dream evidence.`;
	}

	private buildWeeklyPrompt(
		dreams: Array<{ rawText: string; interpretation: string | null; dreamDate: Date }>
	): string {
		const dreamsContext = dreams
			.map(
				(d, i) => `
**Dream ${i + 1}** (${d.dreamDate.toLocaleDateString()})
Text: ${d.rawText.substring(0, 300)}${d.rawText.length > 300 ? '...' : ''}
`
			)
			.join('\n---\n');

		return `You are a Dream Analyst providing a weekly summary. Review these ${dreams.length} dreams from the past week.

## Dreams This Week

${dreamsContext}

## Output Requirements
Provide a weekly summary with:
- Overall theme for the week
- Key patterns or insights
- Notable symbols or themes
- Recommendations for the coming week

Keep the tone encouraging and insightful.`;
	}

	private generateSummary(analysis: MetaAnalysisReport): string {
		return `Over ${analysis.analyzedPeriod.dreamCount} dreams, your subconscious explored: ${analysis.overallTheme}. ${analysis.insights.length} significant patterns emerged with ${this.getSignificanceCount(analysis.insights, 'high')} high-priority insights.`;
	}

	private getSignificanceCount(insights: MetaAnalysisInsight[], significance: string): number {
		return insights.filter((i) => i.significance === significance).length;
	}

	private calculatePriority(analysis: MetaAnalysisReport): number {
		const highSigCount = analysis.insights.filter((i) => i.significance === 'high').length;
		if (highSigCount >= 2) return 5;
		if (highSigCount === 1) return 3;
		return 1;
	}
}

// Export singleton instance
export const metaAnalystService = new MetaAnalystService();
