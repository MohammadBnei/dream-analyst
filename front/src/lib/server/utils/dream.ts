/**
 * Utilities for dream data transformations
 */

/**
 * Parses dream tags from Prisma's JSON type to a typed array.
 * Prisma stores tags as JSON but TypeScript doesn't know the exact type.
 *
 * @param dream - Dream object with tags property
 * @returns Dream object with tags properly typed as string[] | null
 */
export function parseDreamTags<T extends { tags: unknown }>(dream: T) {
	return {
		...dream,
		tags: dream.tags ? (dream.tags as string[]) : null
	};
}

/**
 * Parses dream tags for an array of dreams.
 *
 * @param dreams - Array of dream objects
 * @returns Array of dreams with tags properly typed
 */
export function parseDreamTagsArray<T extends { tags: unknown }>(dreams: T[]) {
	return dreams.map(parseDreamTags);
}
