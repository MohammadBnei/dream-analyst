/**
 * Phase 2: Meta-Analyst Insight Types
 * Type definitions for cross-dream synthesis reports and insights
 */

/**
 * Report types for insight reports
 */
export type ReportType = 'META_ANALYSIS' | 'WEEKLY_SUMMARY' | 'MILESTONE' | 'PATTERN_ALERT';

/**
 * Types of meta-analysis insights
 */
export type InsightType =
	| 'recurring_symbol'
	| 'emotional_pattern'
	| 'theme_evolution'
	| 'metadata_correlation'
	| 'individuation_progress'
	| 'sleep_quality_impact'
	| 'lucidity_progression'
	| 'custom';

/**
 * Individual insight within a meta-analysis report
 */
export interface MetaAnalysisInsight {
	type: InsightType;
	title: string;
	description: string;
	evidence: Array<{
		dreamId: string;
		dreamDate: string; // ISO date string
		excerpt: string;
	}>;
	significance: 'low' | 'medium' | 'high';
	actionableSteps?: string[];
}

/**
 * Progress indicators for the analyzed period
 */
export interface ProgressIndicators {
	symbolDiversity: number; // Unique symbols / total occurrences
	emotionalBalance: number; // Positive vs negative sentiment ratio
	lucidityProgression: number; // Average lucidity trend (0-3 scale)
	analysisDepth: number; // Average analysis block count
}

/**
 * Complete meta-analysis report structure
 */
export interface MetaAnalysisReport {
	analyzedPeriod: {
		from: string; // ISO date
		to: string; // ISO date
		dreamCount: number;
	};
	overallTheme: string; // One sentence theme
	insights: MetaAnalysisInsight[];
	progressIndicators: ProgressIndicators;
	recommendations: string[];
}

/**
 * API response for insight reports
 */
export interface InsightReportResponse {
	id: string;
	reportType: ReportType;
	triggerEvent: string;
	dreamIds: string[];
	title: string;
	summary: string;
	insights: MetaAnalysisReport;
	priority: number;
	isRead: boolean;
	createdAt: string; // ISO date
}

/**
 * LLM function schema for meta-analysis generation
 */
export const META_ANALYSIS_FUNCTION_SCHEMA = {
	name: 'generate_meta_analysis',
	description: 'Generate cross-dream synthesis report identifying patterns and insights',
	parameters: {
		type: 'object',
		properties: {
			analyzedPeriod: {
				type: 'object',
				properties: {
					from: { type: 'string' },
					to: { type: 'string' },
					dreamCount: { type: 'number' }
				},
				required: ['from', 'to', 'dreamCount']
			},
			overallTheme: {
				type: 'string',
				description: 'One sentence capturing the psychological theme of this period'
			},
			insights: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						type: {
							type: 'string',
							enum: [
								'recurring_symbol',
								'emotional_pattern',
								'theme_evolution',
								'metadata_correlation',
								'individuation_progress',
								'sleep_quality_impact',
								'lucidity_progression'
							]
						},
						title: { type: 'string' },
						description: { type: 'string' },
						evidence: {
							type: 'array',
							items: {
								type: 'object',
								properties: {
									dreamId: { type: 'string' },
									dreamDate: { type: 'string' },
									excerpt: { type: 'string' }
								},
								required: ['dreamId', 'dreamDate', 'excerpt']
							}
						},
						significance: {
							type: 'string',
							enum: ['low', 'medium', 'high']
						},
						actionableSteps: {
							type: 'array',
							items: { type: 'string' }
						}
					},
					required: ['type', 'title', 'description', 'evidence', 'significance']
				},
				minItems: 3,
				maxItems: 5
			},
			progressIndicators: {
				type: 'object',
				properties: {
					symbolDiversity: { type: 'number' },
					emotionalBalance: { type: 'number' },
					lucidityProgression: { type: 'number' },
					analysisDepth: { type: 'number' }
				},
				required: ['symbolDiversity', 'emotionalBalance', 'lucidityProgression']
			},
			recommendations: {
				type: 'array',
				items: { type: 'string' },
				minItems: 3
			}
		},
		required: [
			'analyzedPeriod',
			'overallTheme',
			'insights',
			'progressIndicators',
			'recommendations'
		]
	}
};

/**
 * Request parameters for generating meta-analysis
 */
export interface GenerateMetaAnalysisParams {
	userId: string;
	dreamCount?: number; // Default 5
	triggerEvent?: string; // e.g., "dream_count_5"
}

/**
 * Adaptive trigger thresholds for meta-analysis
 */
export interface AdaptiveThresholds {
	// For active users (dreams last 30 days): every 5 dreams
	active: {
		dreamCount: number;
		maxDays: number; // Must have dreamed within this window
	};
	// For moderate users (dreams last 90 days): every 10 dreams
	moderate: {
		dreamCount: number;
		maxDays: number;
	};
	// For occasional users: every 15 dreams
	occasional: {
		dreamCount: number;
		maxDays: number;
	};
}

/**
 * Default adaptive thresholds
 */
export const DEFAULT_ADAPTIVE_THRESHOLDS: AdaptiveThresholds = {
	active: {
		dreamCount: 5,
		maxDays: 30
	},
	moderate: {
		dreamCount: 10,
		maxDays: 90
	},
	occasional: {
		dreamCount: 15,
		maxDays: 365
	}
};
