/**
 * Phase 2: Structured Analysis Types
 * Type definitions for the new JSON-based structured dream analysis format
 */

/**
 * Types of analysis blocks for different psychological concepts
 */
export type AnalysisBlockType =
	| 'summary'
	| 'shadow'
	| 'anima_animus'
	| 'archetype'
	| 'personal_unconscious'
	| 'collective_unconscious'
	| 'compensation'
	| 'amplification'
	| 'individuation'
	| 'symbol_interpretation'
	| 'integration_guidance'
	| 'recurring_theme'
	| 'emotional_tone'
	| 'custom'; // For extensible custom block types

/**
 * Individual analysis block with addressable ID
 */
export interface AnalysisBlock {
	id: string; // e.g., "block_shadow_1"
	type: AnalysisBlockType;
	title: string; // e.g., "Shadow Encounter"
	content: string; // The actual analysis text (markdown supported)
	symbols?: string[]; // Related symbols mentioned in this block
	confidence?: number; // 0-1 scale (optional)
	metadata?: Record<string, unknown>; // Extensible for future data
}

/**
 * Detected symbol with sentiment and context
 */
export interface DetectedSymbol {
	name: string;
	sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'AMBIVALENT';
	contextNote: string;
	prominence: number; // 1=background, 2=secondary, 3=central
}

/**
 * Complete structured dream analysis output
 */
export interface StructuredDreamAnalysis {
	version: number; // Schema version (start with 2)
	summary: string; // Brief overview (2-3 sentences)
	emotionalTone: string; // Overall emotional assessment
	primaryTheme: string; // Main psychological theme
	analysisBlocks: AnalysisBlock[];
	detectedSymbols: DetectedSymbol[];
	integrationSuggestions: string[]; // 3-5 actionable insights
	generatedAt: string; // ISO timestamp
}

/**
 * LLM function calling schema for structured analysis
 */
export const STRUCTURED_ANALYSIS_FUNCTION_SCHEMA = {
	name: 'generate_structured_analysis',
	description: 'Generate a structured psychological dream analysis with addressable sections',
	parameters: {
		type: 'object',
		properties: {
			summary: {
				type: 'string',
				description: 'Brief 2-3 sentence overview of the dream analysis'
			},
			emotionalTone: {
				type: 'string',
				description:
					'Overall emotional assessment (e.g., "anxiety-transformative", "joyful-expansive")'
			},
			primaryTheme: {
				type: 'string',
				description: 'Main psychological theme (e.g., "Shadow Integration", "Anima Encounter")'
			},
			analysisBlocks: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						id: { type: 'string' },
						type: {
							type: 'string',
							enum: [
								'shadow',
								'anima_animus',
								'archetype',
								'symbol_interpretation',
								'integration_guidance',
								'recurring_theme',
								'emotional_tone',
								'compensation',
								'amplification',
								'individuation',
								'personal_unconscious',
								'collective_unconscious',
								'custom'
							]
						},
						title: { type: 'string' },
						content: { type: 'string' },
						symbols: {
							type: 'array',
							items: { type: 'string' }
						},
						confidence: { type: 'number', minimum: 0, maximum: 1 }
					},
					required: ['id', 'type', 'title', 'content']
				}
			},
			detectedSymbols: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						name: { type: 'string' },
						sentiment: {
							type: 'string',
							enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'AMBIVALENT']
						},
						contextNote: { type: 'string' },
						prominence: { type: 'number', minimum: 1, maximum: 3 }
					},
					required: ['name', 'sentiment', 'contextNote', 'prominence']
				}
			},
			integrationSuggestions: {
				type: 'array',
				items: { type: 'string' },
				minItems: 3,
				maxItems: 5
			}
		},
		required: [
			'summary',
			'emotionalTone',
			'primaryTheme',
			'analysisBlocks',
			'detectedSymbols',
			'integrationSuggestions'
		]
	}
};

/**
 * API response type for analysis blocks endpoint
 */
export interface AnalysisBlocksResponse {
	version: 1 | 2;
	analysis: StructuredDreamAnalysis | LegacyAnalysis;
}

/**
 * Fallback legacy analysis format
 */
export interface LegacyAnalysis {
	version: 1;
	summary: string;
	analysisBlocks: AnalysisBlock[];
}
