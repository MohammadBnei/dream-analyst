import type { MetadataConfig } from '@prisma/client';
import { getPrismaClient } from '../db';

export type MetadataFieldType =
	| 'scale'
	| 'boolean'
	| 'select'
	| 'multiselect'
	| 'text'
	| 'textarea'
	| 'number'
	| 'date'
	| 'time';

export interface MetadataFieldDef {
	id: string;
	label: string;
	type: MetadataFieldType;
	required?: boolean;
	description?: string;
	min?: number;
	max?: number;
	step?: number;
	labels?: string[];
	options?: string[];
	maxLength?: number;
}

export interface MetadataSchema {
	version: string;
	fields: MetadataFieldDef[];
}

export type MetadataValues = Record<string, unknown>;

export class MetadataConfigService {
	async getGlobalTemplates(): Promise<MetadataConfig[]> {
		const prisma = await getPrismaClient();
		return prisma.metadataConfig.findMany({
			where: { isGlobal: true },
			orderBy: [{ isDefault: 'desc' }, { name: 'asc' }]
		});
	}

	async getDefaultTemplate(): Promise<MetadataConfig | null> {
		const prisma = await getPrismaClient();
		return prisma.metadataConfig.findFirst({
			where: { isDefault: true }
		});
	}

	async getByName(name: string): Promise<MetadataConfig | null> {
		const prisma = await getPrismaClient();
		return prisma.metadataConfig.findUnique({
			where: { name }
		});
	}

	async getUserEffectiveSchema(userId: string): Promise<MetadataSchema | null> {
		const prisma = await getPrismaClient();

		const user = await prisma.user.findUnique({
			where: { id: userId },
			include: { activeMetadataConfig: true }
		});

		// Priority: custom > active > default
		if (user?.customMetadataSchema) {
			return user.customMetadataSchema as MetadataSchema;
		}

		if (user?.activeMetadataConfig) {
			return user.activeMetadataConfig.schema as MetadataSchema;
		}

		const defaultConfig = await this.getDefaultTemplate();
		return defaultConfig?.schema as MetadataSchema | null;
	}

	async setUserActiveConfig(userId: string, configId: string): Promise<void> {
		const prisma = await getPrismaClient();
		await prisma.user.update({
			where: { id: userId },
			data: { activeMetadataConfigId: configId }
		});
	}

	async setUserCustomSchema(userId: string, schema: MetadataSchema): Promise<void> {
		const prisma = await getPrismaClient();
		await prisma.user.update({
			where: { id: userId },
			data: { customMetadataSchema: schema }
		});
	}

	validateMetadataValues(
		values: MetadataValues,
		schema: MetadataSchema
	): {
		valid: boolean;
		errors: string[];
	} {
		const errors: string[] = [];

		for (const field of schema.fields) {
			const value = values[field.id];

			// Required check
			if (field.required && (value === undefined || value === null || value === '')) {
				errors.push(`${field.label} is required`);
				continue;
			}

			if (value === undefined || value === null) continue;

			// Type-specific validation
			switch (field.type) {
				case 'scale':
				case 'number':
					if (typeof value !== 'number') {
						errors.push(`${field.label} must be a number`);
					} else {
						if (field.min !== undefined && value < field.min) {
							errors.push(`${field.label} must be at least ${field.min}`);
						}
						if (field.max !== undefined && value > field.max) {
							errors.push(`${field.label} must be at most ${field.max}`);
						}
					}
					break;

				case 'select':
					if (!field.options?.includes(value as string)) {
						errors.push(`${field.label} has invalid value`);
					}
					break;

				case 'multiselect':
					if (
						!Array.isArray(value) ||
						!(value as string[]).every((v) => field.options?.includes(v))
					) {
						errors.push(`${field.label} contains invalid options`);
					}
					break;

				case 'text':
				case 'textarea':
					if (typeof value !== 'string') {
						errors.push(`${field.label} must be text`);
					} else if (field.maxLength && value.length > field.maxLength) {
						errors.push(`${field.label} exceeds max length`);
					}
					break;
			}
		}

		return { valid: errors.length === 0, errors };
	}

	formatForPrompt(values: MetadataValues | null, schema: MetadataSchema | null): string {
		if (!values || !schema) return '';

		let formatted = '\n## CONTEXTUAL INFORMATION:\n\n';

		for (const field of schema.fields) {
			const value = values[field.id];
			if (value === undefined || value === null) continue;

			let displayValue: string;

			switch (field.type) {
				case 'scale':
					const idx = Math.round((value as number) - (field.min ?? 0));
					displayValue = field.labels?.[idx] ?? `${value}/${field.max}`;
					break;
				case 'multiselect':
					displayValue = Array.isArray(value) ? value.join(', ') : String(value);
					break;
				case 'boolean':
					displayValue = value ? 'Yes' : 'No';
					break;
				default:
					displayValue = String(value);
			}

			formatted += `**${field.label}:** ${displayValue}\n`;
		}

		formatted += `\n*Consider how these factors may have influenced the dream.*\n`;
		return formatted;
	}

	// Admin methods
	async createTemplate(data: {
		name: string;
		description?: string;
		schema: MetadataSchema;
		isDefault?: boolean;
		isGlobal?: boolean;
	}): Promise<MetadataConfig> {
		const prisma = await getPrismaClient();
		return prisma.metadataConfig.create({
			data: {
				name: data.name,
				description: data.description,
				schema: data.schema,
				isDefault: data.isDefault ?? false,
				isGlobal: data.isGlobal ?? true
			}
		});
	}

	async updateTemplate(id: string, data: Partial<MetadataConfig>): Promise<MetadataConfig> {
		const prisma = await getPrismaClient();
		return prisma.metadataConfig.update({
			where: { id },
			data
		});
	}

	async deleteTemplate(id: string): Promise<void> {
		const prisma = await getPrismaClient();
		await prisma.metadataConfig.delete({ where: { id } });
	}
}

// Export singleton instance
export const metadataConfigService = new MetadataConfigService();
