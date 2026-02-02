// Service Factory - Central export for all services
// Usage: import { metadataConfigService, symbolService, dreamService } from '$lib/server/services';

export { MetadataConfigService, metadataConfigService } from './MetadataConfigService';
export { SymbolService, symbolService } from './SymbolService';
export { DreamService, dreamService } from './DreamService';

// Export types for convenience
export type {
	MetadataSchema,
	MetadataValues,
	MetadataFieldDef,
	MetadataFieldType
} from './MetadataConfigService';

export type { SymbolProgression, SymbolWithOccurrence } from './SymbolService';

export type { CreateDreamInput, AnalysisContext } from './DreamService';
