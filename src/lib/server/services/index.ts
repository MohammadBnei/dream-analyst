// Service Factory - Central export for all services
// Usage: import { metadataConfigService, symbolService, dreamService } from '$lib/server/services';

export { MetadataConfigService, metadataConfigService } from './MetadataConfigService';
export { SymbolService, symbolService } from './SymbolService';
export { DreamService, dreamService } from './DreamService';
export { MetaAnalystService, metaAnalystService } from './MetaAnalystService';

// Export types for convenience
export type {
	MetadataSchema,
	MetadataValues,
	MetadataFieldDef,
	MetadataFieldType
} from './MetadataConfigService';

export type { SymbolProgression, SymbolWithOccurrence } from './SymbolService';

export type { CreateDreamInput, AnalysisContext } from './DreamService';

// Phase 2: Structured analysis types
export type {
	StructuredDreamAnalysis,
	AnalysisBlock,
	AnalysisBlockType,
	DetectedSymbol,
	AnalysisBlocksResponse,
	LegacyAnalysis
} from '$lib/types/structuredAnalysis';

export { STRUCTURED_ANALYSIS_FUNCTION_SCHEMA } from '$lib/types/structuredAnalysis';

// Phase 2: Meta-Analyst insight types
export type {
	MetaAnalysisInsight,
	InsightType,
	ProgressIndicators,
	MetaAnalysisReport,
	InsightReportResponse,
	GenerateMetaAnalysisParams,
	AdaptiveThresholds,
	ReportType
} from '$lib/types/insights';

export { META_ANALYSIS_FUNCTION_SCHEMA, DEFAULT_ADAPTIVE_THRESHOLDS } from '$lib/types/insights';
