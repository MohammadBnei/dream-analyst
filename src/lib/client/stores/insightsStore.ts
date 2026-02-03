import { writable, derived } from 'svelte/store';

type InsightType = 'META_ANALYSIS' | 'WEEKLY_SUMMARY' | 'MILESTONE' | 'PATTERN_ALERT';

export interface Insight {
	id: string;
	userId: string;
	reportType: InsightType;
	triggerEvent: string;
	dreamIds: string[];
	title: string;
	summary: string;
	insights: Record<string, unknown>;
	priority: number;
	isRead: boolean;
	createdAt: Date | string;
}

interface InsightsState {
	insights: Insight[];
	isLoading: boolean;
	error: string | null;
	lastFetched: Date | null;
}

const initialState: InsightsState = {
	insights: [],
	isLoading: false,
	error: null,
	lastFetched: null
};

function createInsightsStore() {
	const { subscribe, set, update } = writable<InsightsState>(initialState);

	let refreshInterval: ReturnType<typeof setInterval> | null = null;

	return {
		subscribe,

		async fetchInsights(limit = 10) {
			update((state) => ({ ...state, isLoading: true, error: null }));

			try {
				const response = await fetch(`/api/insights?limit=${limit}`);
				if (!response.ok) throw new Error('Failed to fetch insights');

				const data = await response.json();

				update((state) => ({
					...state,
					insights: data.insights || [],
					isLoading: false,
					lastFetched: new Date()
				}));
			} catch (error) {
				update((state) => ({
					...state,
					isLoading: false,
					error: error instanceof Error ? error.message : 'Unknown error'
				}));
			}
		},

		async markAsRead(insightId: string) {
			try {
				const response = await fetch(`/api/insights/${insightId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ isRead: true })
				});

				if (!response.ok) throw new Error('Failed to mark as read');

				update((state) => ({
					...state,
					insights: state.insights.map((insight) =>
						insight.id === insightId ? { ...insight, isRead: true } : insight
					)
				}));
			} catch (error) {
				console.error('Failed to mark insight as read:', error);
			}
		},

		async fetchUnreadCount(): Promise<number> {
			try {
				const response = await fetch('/api/insights/unread-count');
				if (!response.ok) return 0;

				const data = await response.json();
				return data.count || 0;
			} catch (error) {
				console.error('Failed to fetch unread count:', error);
				return 0;
			}
		},

		startPolling(intervalMs = 300000) {
			// 5 minutes default
			if (refreshInterval) return;

			refreshInterval = setInterval(() => {
				this.fetchInsights();
			}, intervalMs);
		},

		stopPolling() {
			if (refreshInterval) {
				clearInterval(refreshInterval);
				refreshInterval = null;
			}
		},

		reset() {
			set(initialState);
			this.stopPolling();
		}
	};
}

export const insightsStore = createInsightsStore();

// Derived store for unread insights
export const unreadInsights = derived(insightsStore, ($store) =>
	$store.insights.filter((i) => !i.isRead)
);

// Derived store for unread count
export const unreadCount = derived(unreadInsights, ($unread) => $unread.length);
