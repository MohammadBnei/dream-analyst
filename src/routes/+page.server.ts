import { redirect } from '@sveltejs/kit';

export const load = async ({ locals, fetch }: { locals: any; fetch: any }) => {
	const user = locals.user;

	// If not logged in, redirect to old landing page behavior (or login)
	if (!user) {
		return {
			isLoggedIn: false
		};
	}

	// Fetch dashboard data in parallel
	const [statsRes, insightsRes, symbolsRes, dreamsRes] = await Promise.all([
		fetch('/api/analytics/stats').catch(() => null),
		fetch('/api/insights?limit=1&type=WEEKLY_SUMMARY').catch(() => null),
		fetch('/api/users/me/recurring-symbols?limit=20').catch(() => null),
		fetch('/api/dreams?limit=5').catch(() => null)
	]);

	const stats = statsRes?.ok ? await statsRes.json() : null;
	const insights = insightsRes?.ok ? await insightsRes.json() : null;
	const symbols = symbolsRes?.ok ? await symbolsRes.json() : null;
	const dreams = dreamsRes?.ok ? await dreamsRes.json() : null;

	return {
		isLoggedIn: true,
		stats: stats || {
			totalDreams: 0,
			dreamsThisWeek: 0,
			totalSymbols: 0
		},
		latestInsight: insights?.insights?.[0] || null,
		recurringSymbols: symbols?.symbols || [],
		recentDreams: dreams?.dreams || []
	};
};
