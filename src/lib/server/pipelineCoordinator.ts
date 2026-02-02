/**
 * PipelineCoordinator - Orchestrates the dream analysis pipeline
 * 
 * Responsibilities:
 * - Manage state transitions
 * - Coordinate actor execution
 * - Handle actor completion/failure events
 * - Record state changes for versioning
 * - Emit milestone events
 */

import { getDreamStateMachine } from './dreamStateMachine';
import { getEventBus, type EventBus } from './eventBus';
import { getDreamRepository, type DreamRepository } from './dreamRepository';
import { TitleGenerationActor } from './actors/TitleGenerationActor';
import { ContextGatheringActor } from './actors/ContextGatheringActor';
import { RelationshipActor } from './actors/RelationshipActor';
import { InterpretationActor } from './actors/InterpretationActor';
import { AuditEventType, DreamState, EventType, type StateTransitionEvent } from '$lib/types';

export class PipelineCoordinator {
	private stateMachine = getDreamStateMachine();
	private eventBus: EventBus;
	private dreamRepository: DreamRepository;
	private actors: Map<string, any> = new Map();
	private enrichmentActors = [
		EventType.TITLE_GENERATION_COMPLETE,
		EventType.CONTEXT_GATHERING_COMPLETE,
		EventType.RELATIONSHIP_COMPLETE
	];
	private enrichmentTimeouts: Map<string, NodeJS.Timeout> = new Map();

	constructor() {
		this.eventBus = getEventBus();
		this.dreamRepository = getDreamRepository();
	}

	/**
	 * Initialize all actors and set up event handlers
	 */
	async initialize(): Promise<void> {
		// Create and initialize all actors
		const titleActor = new TitleGenerationActor(
			this.eventBus,
			this.dreamRepository,
			this.stateMachine
		);
		const contextActor = new ContextGatheringActor(
			this.eventBus,
			this.dreamRepository,
			this.stateMachine
		);
		const relationshipActor = new RelationshipActor(
			this.eventBus,
			this.dreamRepository,
			this.stateMachine
		);
		const interpretationActor = new InterpretationActor(
			this.eventBus,
			this.dreamRepository,
			this.stateMachine
		);

		await titleActor.initialize();
		await contextActor.initialize();
		await relationshipActor.initialize();
		await interpretationActor.initialize();

		this.actors.set(titleActor.name, titleActor);
		this.actors.set(contextActor.name, contextActor);
		this.actors.set(relationshipActor.name, relationshipActor);
		this.actors.set(interpretationActor.name, interpretationActor);

		// Set up coordinator event handlers
		this.setupEventHandlers();

		console.log('PipelineCoordinator initialized with actors:', Array.from(this.actors.keys()));
	}

	/**
	 * Set up event handlers for actor completions and failures
	 */
	private setupEventHandlers(): void {
		// Track enrichment actor completions
		const enrichmentCompletions = new Map<string, Set<EventType>>();

		// Map complete events to fail events
		const enrichmentPairs: [EventType, EventType][] = [
			[EventType.TITLE_GENERATION_COMPLETE, EventType.TITLE_GENERATION_FAILED],
			[EventType.CONTEXT_GATHERING_COMPLETE, EventType.CONTEXT_GATHERING_FAILED],
			[EventType.RELATIONSHIP_COMPLETE, EventType.RELATIONSHIP_FAILED]
		];

		// Listen for enrichment actor completions
		for (const [completeEvent, failEvent] of enrichmentPairs) {
			this.eventBus.on(completeEvent, async (data) => {
				const { dreamId } = data;

				if (!enrichmentCompletions.has(dreamId)) {
					enrichmentCompletions.set(dreamId, new Set());
				}
				enrichmentCompletions.get(dreamId)!.add(completeEvent);

				// Check if all enrichment actors have completed
				if (enrichmentCompletions.get(dreamId)!.size === this.enrichmentActors.length) {
					console.log(`PipelineCoordinator: All enrichment actors complete for dream ${dreamId}`);
					await this.handleEnrichmentComplete(dreamId);
					enrichmentCompletions.delete(dreamId); // Clean up
				}
			});

			this.eventBus.on(failEvent, async (data) => {
				// Enrichment failures are soft failures - continue anyway
				console.warn(`PipelineCoordinator: ${failEvent} (soft), continuing:`, data.error);

				const { dreamId } = data;
				if (!enrichmentCompletions.has(dreamId)) {
					enrichmentCompletions.set(dreamId, new Set());
				}
				enrichmentCompletions.get(dreamId)!.add(completeEvent); // Count as "complete" even if failed

				// Check if all enrichment actors have finished (complete or failed)
				if (enrichmentCompletions.get(dreamId)!.size === this.enrichmentActors.length) {
					console.log(`PipelineCoordinator: All enrichment actors finished for dream ${dreamId}`);
					await this.handleEnrichmentComplete(dreamId);
					enrichmentCompletions.delete(dreamId);
				}
			});
		}

		// Listen for interpretation completion
		this.eventBus.on(EventType.INTERPRETATION_COMPLETE, async (data) => {
			await this.handleInterpretationComplete(data.dreamId);
		});

		this.eventBus.on(EventType.INTERPRETATION_FAILED, async (data) => {
			await this.handleInterpretationFailure(data.dreamId, data.error);
		});
	}

	/**
	 * Start the dream analysis pipeline
	 */
	async startAnalysis(dreamId: string, signal?: AbortSignal): Promise<void> {
		console.log(`PipelineCoordinator: Starting analysis for dream ${dreamId}`);

		// Transition to ENRICHING state
		await this.transitionState(dreamId, DreamState.ENRICHING, 'USER_ENTERS_TEXT', {
			eventType: AuditEventType.STARTED
		});

		// Set a safety timeout for enrichment phase (15 seconds)
		// If enrichment actors don't finish by then, we proceed to interpretation anyway
		const timeout = setTimeout(async () => {
			console.warn(`PipelineCoordinator: Enrichment timeout for dream ${dreamId}. Proceeding to interpretation.`);
			await this.handleEnrichmentComplete(dreamId);
		}, 15000);
		this.enrichmentTimeouts.set(dreamId, timeout);

		// Emit ENRICHMENT_STARTED event to trigger all enrichment actors
		await this.eventBus.emit(EventType.ENRICHMENT_STARTED, { dreamId, signal });
	}

	/**
	 * Handle completion of all enrichment actors
	 */
	private async handleEnrichmentComplete(dreamId: string): Promise<void> {
		// Clear timeout if it exists
		const timeout = this.enrichmentTimeouts.get(dreamId);
		if (timeout) {
			clearTimeout(timeout);
			this.enrichmentTimeouts.delete(dreamId);
		}

		const dream = await this.dreamRepository.getDream(dreamId);
		if (!dream) {
			console.error(`PipelineCoordinator: Dream ${dreamId} not found`);
			return;
		}

		const currentState = (dream.state as DreamState) || DreamState.ENRICHING;

		// If already in an interpretation state or beyond, don't re-trigger
		if (
			currentState === DreamState.INTERPRETING ||
			currentState === DreamState.INTERPRETING_REVISION ||
			currentState === DreamState.COMPLETED ||
			currentState === DreamState.FAILED
		) {
			return;
		}

		// Determine next state (INTERPRETING or INTERPRETING_REVISION)
		let nextState: DreamState;
		if (currentState === DreamState.ENRICHING_REVISION) {
			nextState = DreamState.INTERPRETING_REVISION;
		} else {
			nextState = DreamState.INTERPRETING;
		}

		// Transition to interpreting state
		await this.transitionState(dreamId, nextState, 'ALL_ENRICHMENT_COMPLETE', {
			eventType: AuditEventType.ENRICHED
		});

		// Emit INTERPRETATION_STARTED event
		await this.eventBus.emit(EventType.INTERPRETATION_STARTED, { dreamId });
	}

	/**
	 * Handle interpretation completion
	 */
	private async handleInterpretationComplete(dreamId: string): Promise<void> {
		await this.transitionState(dreamId, DreamState.COMPLETED, 'INTERPRETATION_COMPLETE', {
			eventType: AuditEventType.INTERPRETED
		});

		console.log(`PipelineCoordinator: Analysis complete for dream ${dreamId}`);
	}

	/**
	 * Handle interpretation failure
	 */
	private async handleInterpretationFailure(dreamId: string, error: Error): Promise<void> {
		await this.transitionState(dreamId, DreamState.FAILED, 'INTERPRETATION_ERROR', {
			eventType: AuditEventType.FAILED,
			error: error.message
		});

		console.error(`PipelineCoordinator: Interpretation failed for dream ${dreamId}:`, error);
	}

	/**
	 * Transition dream to a new state and record the change
	 */
	private async transitionState(
		dreamId: string,
		newState: DreamState,
		event: StateTransitionEvent,
		metadata: any = {}
	): Promise<void> {
		const dream = await this.dreamRepository.getDream(dreamId);
		if (!dream) {
			throw new Error(`Dream ${dreamId} not found`);
		}

		const currentState = (dream.state as DreamState) || DreamState.CREATED;

		// Validate transition
		if (!this.stateMachine.canTransition(currentState, event)) {
			console.warn(
				`PipelineCoordinator: Invalid transition from ${currentState} to ${newState} via ${event}`
			);
			return;
		}

		// Record state change event
		await this.dreamRepository.recordStateChange({
			dreamId,
			version: dream.version + 1,
			eventType: metadata.eventType || event,
			state: newState,
			// Deltas can be added here if needed
		});

		// Update dream state and status
		const prismaStatus = this.stateMachine.toPrismaStatus(newState);
		await this.dreamRepository.updateDream(dreamId, {
			state: newState,
			status: prismaStatus,
			version: dream.version + 1
		});

		// Emit state change event
		await this.eventBus.emit(EventType.STATE_CHANGED, {
			dreamId,
			oldState: currentState,
			newState,
			event,
			metadata
		});

		console.log(`PipelineCoordinator: Dream ${dreamId} transitioned: ${currentState} → ${newState}`);
	}

	/**
	 * Handle user editing dream text (trigger re-analysis)
	 */
	async handleDreamEdit(dreamId: string, oldRawText: string, newRawText: string): Promise<void> {
		const dream = await this.dreamRepository.getDream(dreamId);
		if (!dream) {
			throw new Error(`Dream ${dreamId} not found`);
		}

		// Record the edit
		await this.dreamRepository.recordStateChange({
			dreamId,
			version: dream.version + 1,
			eventType: AuditEventType.EDITED,
			state: DreamState.ENRICHING_REVISION,
			oldRawText,
			newRawText
		});

		// Update the dream
		await this.dreamRepository.updateDream(dreamId, {
			rawText: newRawText,
			state: DreamState.ENRICHING_REVISION,
			version: dream.version + 1
		});

		// Start re-analysis
		await this.eventBus.emit(EventType.ENRICHMENT_STARTED, { dreamId });
	}

	/**
	 * Get the event bus for external listeners
	 */
	getEventBus(): EventBus {
		return this.eventBus;
	}
}

// Singleton instance
let coordinatorInstance: PipelineCoordinator;

export async function getPipelineCoordinator(): Promise<PipelineCoordinator> {
	if (!coordinatorInstance) {
		coordinatorInstance = new PipelineCoordinator();
		await coordinatorInstance.initialize();
	}
	return coordinatorInstance;
}
