import { writable } from 'svelte/store';

type Sentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'AMBIVALENT';

export interface Symbol {
	id: string;
	name: string;
	category?: string | null;
	sentiment?: Sentiment | null;
	occurrenceCount: number;
	firstSeenAt: Date | string;
	lastSeenAt: Date | string;
}

interface SymbolsState {
	symbols: Symbol[];
	isLoading: boolean;
	error: string | null;
	lastFetched: Date | null;
}

const initialState: SymbolsState = {
	symbols: [],
	isLoading: false,
	error: null,
	lastFetched: null
};

function createSymbolsStore() {
	const { subscribe, set, update } = writable<SymbolsState>(initialState);

	return {
		subscribe,

		async fetchTopSymbols(limit = 50) {
			update((state) => ({ ...state, isLoading: true, error: null }));

			try {
				const response = await fetch(`/api/analytics/top-symbols?limit=${limit}`);
				if (!response.ok) throw new Error('Failed to fetch symbols');

				const data = await response.json();

				update((state) => ({
					...state,
					symbols: data.symbols || [],
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

		async fetchRecurringSymbols(limit = 20) {
			update((state) => ({ ...state, isLoading: true, error: null }));

			try {
				const response = await fetch(`/api/users/me/recurring-symbols?limit=${limit}`);
				if (!response.ok) throw new Error('Failed to fetch recurring symbols');

				const data = await response.json();

				update((state) => ({
					...state,
					symbols: data.symbols || [],
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

		getSymbolById(id: string): Symbol | undefined {
			let symbol: Symbol | undefined;

			subscribe((state) => {
				symbol = state.symbols.find((s) => s.id === id);
			})();

			return symbol;
		},

		invalidate() {
			update((state) => ({ ...state, lastFetched: null }));
		},

		reset() {
			set(initialState);
		}
	};
}

export const symbolsStore = createSymbolsStore();

// Helper function to get sentiment color class
export const getSentimentColor = (sentiment: Sentiment | null | undefined): string => {
	if (!sentiment) return 'text-base-content/50';

	const colors: Record<Sentiment, string> = {
		POSITIVE: 'text-success',
		NEGATIVE: 'text-error',
		NEUTRAL: 'text-base-content/50',
		AMBIVALENT: 'text-warning'
	};

	return colors[sentiment];
};
