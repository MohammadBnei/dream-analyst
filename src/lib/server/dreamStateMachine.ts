/**
 * DreamStateMachine - Validates and manages state transitions for dream analysis
 * 
 * States:
 * - CREATED: Dream just created, no processing started
 * - ENRICHING: Gathering context (title, relationships, past dreams)
 * - ENRICHING_REVISION: Re-enriching after user edits dream
 * - INTERPRETING: LLM streaming interpretation
 * - INTERPRETING_REVISION: Re-interpreting after user edits dream
 * - COMPLETED: Analysis complete, ready for chat
 * - FAILED: Analysis failed, can retry
 */

import { DreamStatus } from '@prisma/client';
import { DreamState, type StateTransitionEvent } from '$lib/types';

interface StateConfig {
	allowedTransitions: Partial<Record<StateTransitionEvent, DreamState>>;
	allowedActors: string[];
	prismaStatus: DreamStatus; // Map to Prisma DreamStatus enum
}

export const STATE_CONFIGS: Record<DreamState, StateConfig> = {
	[DreamState.CREATED]: {
		allowedTransitions: {
			USER_ENTERS_TEXT: DreamState.ENRICHING
		},
		allowedActors: [],
		prismaStatus: DreamStatus.PENDING_ANALYSIS
	},
	[DreamState.ENRICHING]: {
		allowedTransitions: {
			ALL_ENRICHMENT_COMPLETE: DreamState.INTERPRETING,
			ENRICHMENT_HARD_FAIL: DreamState.FAILED
		},
		allowedActors: ['TitleGenerationActor', 'ContextGatheringActor', 'RelationshipActor'],
		prismaStatus: DreamStatus.PENDING_ANALYSIS
	},
	[DreamState.ENRICHING_REVISION]: {
		allowedTransitions: {
			ALL_ENRICHMENT_COMPLETE: DreamState.INTERPRETING_REVISION,
			ENRICHMENT_HARD_FAIL: DreamState.FAILED
		},
		allowedActors: ['TitleGenerationActor', 'ContextGatheringActor', 'RelationshipActor'],
		prismaStatus: DreamStatus.PENDING_ANALYSIS
	},
	[DreamState.INTERPRETING]: {
		allowedTransitions: {
			INTERPRETATION_COMPLETE: DreamState.COMPLETED,
			INTERPRETATION_ERROR: DreamState.FAILED
		},
		allowedActors: ['InterpretationActor'],
		prismaStatus: DreamStatus.PENDING_ANALYSIS
	},
	[DreamState.INTERPRETING_REVISION]: {
		allowedTransitions: {
			INTERPRETATION_COMPLETE: DreamState.COMPLETED,
			INTERPRETATION_ERROR: DreamState.FAILED
		},
		allowedActors: ['InterpretationActor'],
		prismaStatus: DreamStatus.PENDING_ANALYSIS
	},
	[DreamState.COMPLETED]: {
		allowedTransitions: {
			USER_EDITS_TEXT: DreamState.ENRICHING_REVISION,
			MANUAL_FAIL: DreamState.FAILED
		},
		allowedActors: [],
		prismaStatus: DreamStatus.COMPLETED
	},
	[DreamState.FAILED]: {
		allowedTransitions: {
			USER_RETRIES_INTERPRETATION: DreamState.INTERPRETING,
			USER_RETRIES_ENRICHMENT: DreamState.ENRICHING
		},
		allowedActors: [],
		prismaStatus: DreamStatus.ANALYSIS_FAILED
	}
};

export class DreamStateMachine {
	/**
	 * Check if a state transition is allowed
	 */
	canTransition(currentState: DreamState, event: StateTransitionEvent): boolean {
		const config = STATE_CONFIGS[currentState];
		const allowed = event in config.allowedTransitions;
		
		if (process.env.NODE_ENV !== 'production') {
			console.debug(`[FSM] 🔍 Checking transition: ${currentState} --(${event})--> ${allowed ? config.allowedTransitions[event] : 'INVALID'}`);
		}
		
		return allowed;
	}

	/**
	 * Get the next state for a given event
	 * @throws Error if transition is not allowed
	 */
	transition(currentState: DreamState, event: StateTransitionEvent): DreamState {
		const config = STATE_CONFIGS[currentState];
		const nextState = config.allowedTransitions[event];

		if (process.env.NODE_ENV !== 'production') {
			console.debug(`[FSM] ⚙️ Executing transition: ${currentState} --(${event})--> ${nextState || 'ERROR'}`);
		}

		if (!nextState) {
			throw new Error(
				`Invalid transition: Cannot transition from ${currentState} with event ${event}`
			);
		}

		return nextState;
	}

	/**
	 * Check if an actor is allowed to run in a given state
	 */
	canActorRun(state: DreamState, actorName: string): boolean {
		const config = STATE_CONFIGS[state];
		return config.allowedActors.includes(actorName);
	}

	/**
	 * Get all actors allowed to run in a given state
	 */
	getAllowedActors(state: DreamState): string[] {
		return STATE_CONFIGS[state].allowedActors;
	}

	/**
	 * Map internal state to Prisma DreamStatus enum
	 */
	toPrismaStatus(state: DreamState): DreamStatus {
		return STATE_CONFIGS[state].prismaStatus;
	}

	/**
	 * Map Prisma DreamStatus to internal state (best guess)
	 * Used for backwards compatibility when loading existing dreams
	 */
	fromPrismaStatus(status: DreamStatus): DreamState {
		switch (status) {
			case DreamStatus.PENDING_ANALYSIS:
				return DreamState.CREATED; // Default to CREATED for pending
			case DreamStatus.COMPLETED:
				return DreamState.COMPLETED;
			case DreamStatus.ANALYSIS_FAILED:
				return DreamState.FAILED;
			default:
				return DreamState.CREATED;
		}
	}

	/**
	 * Get all possible transitions from a state
	 */
	getAvailableTransitions(state: DreamState): StateTransitionEvent[] {
		const config = STATE_CONFIGS[state];
		return Object.keys(config.allowedTransitions) as StateTransitionEvent[];
	}
}

// Singleton instance
let stateMachineInstance: DreamStateMachine;

export function getDreamStateMachine(): DreamStateMachine {
	if (!stateMachineInstance) {
		stateMachineInstance = new DreamStateMachine();
	}
	return stateMachineInstance;
}
