import { getPrismaClient } from '$lib/server/db/index.js';
import { redirect } from '@sveltejs/kit';
import { buildTsQueryFromRaw, dreamSearchFilter } from '$lib/server/search/tsquery';
import type { PageServerLoad } from './$types';
import type { Prisma } from '@prisma/client';

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
/** Whitelist: this value is interpolated into a Prisma orderBy key. */
const SORTABLE_FIELDS = ['dreamDate', 'title'] as const;

export const load: PageServerLoad = async ({ locals, url }) => {
	const sessionUser = locals.user;

	if (!sessionUser) {
		throw redirect(302, '/login');
	}

	const prisma = await getPrismaClient();

	const searchQuery = url.searchParams.get('query') || '';

	// These come straight from the query string. parseInt alone accepts NaN and
	// unbounded values, so `?page=abc` produced `skip: NaN` and `?pageSize=99999999`
	// was honoured as written.
	const clampInt = (raw: string | null, fallback: number, min: number, max: number) => {
		const n = Number.parseInt(raw ?? '', 10);
		return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
	};
	const page = clampInt(url.searchParams.get('page'), 1, 1, Number.MAX_SAFE_INTEGER);
	const pageSize = clampInt(url.searchParams.get('pageSize'), DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
	const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
	// The UI writes ?sortBy=... but the load never read it, so ordering was always
	// by dreamDate and picking "title" in the sort control did nothing.
	const sortByParam = url.searchParams.get('sortBy');
	const sortBy: (typeof SORTABLE_FIELDS)[number] = SORTABLE_FIELDS.includes(
		sortByParam as (typeof SORTABLE_FIELDS)[number]
	)
		? (sortByParam as (typeof SORTABLE_FIELDS)[number])
		: 'dreamDate';

	const skip = (page - 1) * pageSize;
	const take = pageSize;

	let whereClause: Prisma.DreamWhereInput = {
		userId: sessionUser.id
	};

	const safeSearchQuery = buildTsQueryFromRaw(searchQuery);
	if (safeSearchQuery) {
		whereClause = {
			...whereClause,
			OR: dreamSearchFilter(safeSearchQuery)
		};
	}

	// A symbol facet. It intersects with the userId scope above, so a forged id
	// belonging to another dreamer resolves to an empty list rather than leaking
	// anything - there is no ownership check to forget here because the scope is
	// already the outer condition.
	//
	// This is what full-text search cannot do: `?element=` also catches the dreams
	// where the same symbol was written `l'ocean` or `la mer`.
	const elementId = url.searchParams.get('element');
	if (elementId) {
		whereClause = { ...whereClause, elements: { some: { entryId: elementId } } };
	}

	const [dreams, totalDreams] = await prisma.$transaction([
		prisma.dream.findMany({
			where: whereClause,
			orderBy: { [sortBy]: sortOrder },
			skip,
			take
		}),
		prisma.dream.count({
			where: whereClause
		})
	]);

	// The strip: this dreamer's most-used entries. Also the only instrument that
	// makes a degraded matcher visible - it fails silently and writes well-formed
	// rows either way, so a vocabulary that stops cohering only shows up here.
	const topEntries = await prisma.vocabularyEntry.findMany({
		where: { userId: sessionUser.id },
		select: { id: true, kind: true, label: true, _count: { select: { occurrences: true } } },
		orderBy: { occurrences: { _count: 'desc' } },
		take: 15
	});
	const vocabulary = topEntries
		.filter((e) => e._count.occurrences > 0)
		.map((e) => ({ id: e.id, kind: e.kind, label: e.label, count: e._count.occurrences }));

	const activeElement = elementId
		? (vocabulary.find((v) => v.id === elementId) ??
			(await prisma.vocabularyEntry.findFirst({
				where: { id: elementId, userId: sessionUser.id },
				select: { id: true, kind: true, label: true }
			})))
		: null;

	const totalPages = Math.ceil(totalDreams / pageSize);

	return {
		dreams,
		vocabulary,
		activeElement,
		query: searchQuery,
		currentPage: page,
		pageSize: pageSize,
		totalPages: totalPages,
		totalDreams: totalDreams,
		sortOrder: sortOrder,
		sortBy: sortBy
	};
};
