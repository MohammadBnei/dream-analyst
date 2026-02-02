/**
 * DreamActor - Base class for all dream processing actors
 * 
 * Each actor is a single-responsibility unit that:
 * - Listens for specific events
 * - Executes when triggered
 * - Emits completion/failure events
 * - Can declare dependencies on other events
 */

import type { Dream } from '@prisma/client';
import type { EventBus } from '../eventBus';
import type { DreamRepository } from '../dreamRepository';
import type { DreamState, EventType } from '$lib/types';
import type { DreamStateMachine } from '../dreamStateMachine';

export interface ActorResult {
	success: boolean;
	data?: any;
	error?: Error;
}

export abstract class DreamActor {
	abstract name: string;
	abstract completeEvent: EventType;
	abstract failEvent: EventType;
	abstract dependsOn: (string | EventType)[]; // Events this actor waits for before executing
	abstract triggers: (string | EventType)[]; // Events that trigger this actor
	abstract allowedInStates: DreamState[]; // States where this actor can run

	constructor(
		protected eventBus: EventBus,
		protected dreamRepository: DreamRepository,
		protected stateMachine: DreamStateMachine
	) {}

	/**
	 * Initialize the actor by subscribing to relevant events
	 */
	async initialize(): Promise<void> {
		for (const trigger of this.triggers) {
			this.eventBus.on(trigger, async (data) => {
				try {
					await this.handle(data);
				} catch (error) {
					console.error(`${this.name}: Error in event handler for ${trigger}:`, error);
				}
			});
		}
		console.log(`${this.name} initialized and listening for events:`, this.triggers);
	}

	/**
	 * Handle an incoming event
	 */
	protected async handle(data: any): Promise<void> {
		const { dreamId, signal } = data;

		try {
			// Fetch the dream
			const dream = await this.dreamRepository.getDream(dreamId);
			if (!dream) {
				throw new Error(`Dream ${dreamId} not found`);
			}

			// Check if actor is allowed to run in current state
			const currentState = (dream.state as DreamState) || DreamState.CREATED;
			if (!this.canRunInState(currentState)) {
				console.debug(
					`${this.name}: Skipped (state ${currentState} not in allowedInStates ${this.allowedInStates.join(', ')})`
				);
				return;
			}

			// Wait for dependencies if any
			if (this.dependsOn.length > 0) {
				console.debug(`${this.name}: Waiting for dependencies:`, this.dependsOn);
				await Promise.all(
					this.dependsOn.map((dep) =>
						this.eventBus.waitFor(
							dep,
							30000,
							(eventData) => eventData.dreamId === dreamId // Only wait for events for this specific dream
						)
					)
				);
			}

			console.log(`${this.name}: Starting execution for dream ${dreamId}`);

			// Execute the actor's logic
			const result = await this.execute(dream, signal);

			if (result.success) {
				console.log(`${this.name}: Completed successfully for dream ${dreamId}`);
				await this.eventBus.emit(this.completeEvent, {
					dreamId,
					actorName: this.name,
					result: result.data
				});
			} else {
				console.error(`${this.name}: Failed for dream ${dreamId}:`, result.error);
				await this.eventBus.emit(this.failEvent, {
					dreamId,
					actorName: this.name,
					error: result.error
				});
			}
		} catch (error) {
			console.error(`${this.name}: Unhandled error for dream ${dreamId}:`, error);
			await this.eventBus.emit(this.failEvent, {
				dreamId,
				actorName: this.name,
				error: error instanceof Error ? error : new Error(String(error))
			});
		}
	}

	/**
	 * Check if this actor can run in the given state
	 */
	protected canRunInState(state: DreamState): boolean {
		return this.allowedInStates.includes(state);
	}

	/**
	 * Execute the actor's core logic
	 * Must be implemented by subclasses
	 */
	protected abstract execute(dream: Dream, signal?: AbortSignal): Promise<ActorResult>;
}
