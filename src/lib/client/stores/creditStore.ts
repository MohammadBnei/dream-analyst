/**
 * Reactive Credit Store
 * Global state management for credits with optimistic updates and polling
 */

import { writable, derived, get } from 'svelte/store';
import type { UserRole } from '@prisma/client';

interface CreditState {
	balance: number;
	dailyUsed: number;
	dailyLimit: number;
	role: UserRole;
	lastUpdated: Date;
	isLoading: boolean;
}

function createCreditStore() {
	const { subscribe, set, update } = writable<CreditState>({
		balance: 0,
		dailyUsed: 0,
		dailyLimit: 10,
		role: 'BASIC',
		lastUpdated: new Date(),
		isLoading: true
	});

	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let userId: string | null = null;

	return {
		subscribe,

		/**
		 * Initialize store with user's current credit state.
		 */
		async init(currentUserId: string) {
			userId = currentUserId;
			await this.refresh();
			this.startPolling();
		},

		/**
		 * Fetch current credit state from API.
		 */
		async refresh() {
			if (!userId) return;

			try {
				const response = await fetch('/api/users/me/credits');
				if (!response.ok) throw new Error('Failed to fetch credits');

				const data = await response.json();
				set({
					balance: data.balance,
					dailyUsed: data.dailyUsed,
					dailyLimit: data.dailyLimit,
					role: data.role,
					lastUpdated: new Date(),
					isLoading: false
				});
			} catch (error) {
				console.error('Failed to refresh credits:', error);
			}
		},

		/**
		 * Optimistically deduct credits (before API confirmation).
		 */
		optimisticDeduct(amount: number) {
			update((state) => ({
				...state,
				balance: state.balance - amount,
				dailyUsed: state.dailyUsed + amount
			}));
		},

		/**
		 * Rollback optimistic update if API fails.
		 */
		rollback(amount: number) {
			update((state) => ({
				...state,
				balance: state.balance + amount,
				dailyUsed: state.dailyUsed - amount
			}));
		},

		/**
		 * Start polling for credit updates (every 30 seconds).
		 */
		startPolling() {
			if (pollInterval) return;

			pollInterval = setInterval(() => {
				this.refresh();
			}, 30000); // Poll every 30 seconds
		},

		/**
		 * Stop polling (cleanup on page unmount).
		 */
		stopPolling() {
			if (pollInterval) {
				clearInterval(pollInterval);
				pollInterval = null;
			}
		}
	};
}

export const creditStore = createCreditStore();

/**
 * Derived store: Can user perform action?
 */
export const canAfford = derived(creditStore, ($credits) => (cost: number) => {
	return $credits.balance >= cost && $credits.dailyUsed + cost <= $credits.dailyLimit;
});

/**
 * Derived store: Credit percentage remaining.
 */
export const creditPercentage = derived(creditStore, ($credits) =>
	Math.max(0, ($credits.balance / $credits.dailyLimit) * 100)
);

/**
 * Derived store: Visual warning level.
 */
export const creditWarningLevel = derived(creditPercentage, ($percentage) => {
	if ($percentage > 50) return 'good';
	if ($percentage > 20) return 'warning';
	return 'critical';
});
