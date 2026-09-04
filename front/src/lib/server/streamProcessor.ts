import { DreamStatus, type Dream } from '@prisma/client';
import { getStreamStateStore } from '$lib/server/streamStateStore';
import { getPrismaClient } from '$lib/server/db';
import type { DreamPromptType } from '$lib/promptTypes';
import { initiateDreamAnalysis } from './analysis';
import { annotateDream } from './elements';

// Utility function to convert AsyncIterable<string> to ReadableStream<Uint8Array>
function asyncIterableToReadableStream(
	asyncIterable: AsyncIterable<string>
): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	return new ReadableStream({
		async start(controller) {
			for await (const chunk of asyncIterable) {
				// Each chunk from the asyncIterable is a string.
				// We need to encode it and add a newline to make it a valid NDJSON chunk.
				controller.enqueue(encoder.encode(JSON.stringify({ content: chunk }) + '\n'));
			}
			controller.close();
		},
		async cancel(reason) {
			console.debug('ReadableStream created from AsyncIterable cancelled:', reason);
			// If the underlying async iterable has a way to be cancelled,
			// you might call it here. For now, just log.
		}
	});
}

/**
 * Manages the lifecycle of a single stream processing task.
 * This class is responsible for:
 * - Receiving a raw stream of chunks.
 * - Parsing and accumulating chunks.
 * - Persisting intermediate and final states to Redis via StreamStateStore.
 * - Publishing updates to Redis Pub/Sub via StreamStateStore.
 * - Updating the database with final results.
 * - Handling cancellation and errors.
 */
export class StreamProcessor {
	private streamId: string;
	private platform: App.Platform | undefined;
	private prisma: ReturnType<typeof getPrismaClient>;
	// Still assigned in init() rather than the constructor, because
	// getStreamStateStore() is genuinely async (it establishes the Redis publisher).
	// Asserted rather than optional to avoid a null check at every use site; every
	// method that touches it runs after init().
	private streamStateStore!: Awaited<ReturnType<typeof getStreamStateStore>>;
	abortController: AbortController; // Internal AbortController for server-side cancellation

	private accumulatedInterpretation: string = '';
	private resultUpdatedInDb: boolean = false;
	private promptType: DreamPromptType = 'jungian'; // Added promptType property

	constructor(streamId: string, platform: App.Platform | undefined) {
		this.streamId = streamId;
		this.platform = platform;
		this.prisma = getPrismaClient();
		this.abortController = new AbortController();
	}

	/**
	 * Initializes the processor by getting necessary clients.
	 * Must be called before `startProcessing`.
	 */
	public async init() {
		this.streamStateStore = await getStreamStateStore();
	}

	/**
	 * Sets the prompt type for this stream processing task.
	 * @param type The DreamPromptType to use.
	 */
	public setPromptType(type: DreamPromptType): void {
		this.promptType = type;
	}

	/**
	 * Starts the background stream processing, consuming the provided ReadableStream.
	 * This method should be called once per stream processing task.
	 * @param sourceStream The ReadableStream containing the chunks to process.
	 */
	public async startProcessing(sourceStream: ReadableStream<Uint8Array>): Promise<void> {
		if (!this.streamStateStore || !this.prisma) {
			throw new Error('StreamProcessor not initialized. Call init() first.');
		}

		const decoder = new TextDecoder();
		let jsonBuffer = '';
		const streamId = this.streamId;
		const processChunk = this.processChunk.bind(this); // Bind 'this' for the WritableStream context

		const backgroundProcessingPromise = sourceStream.pipeTo(
			new WritableStream({
				async write(chunk) {
					jsonBuffer += decoder.decode(chunk, { stream: true });

					let boundary = jsonBuffer.indexOf('\n');
					while (boundary !== -1) {
						const line = jsonBuffer.substring(0, boundary).trim();
						jsonBuffer = jsonBuffer.substring(boundary + 1);

						if (line) {
							try {
								const parsedChunk: App.AnalysisStreamChunk = JSON.parse(line);
								await processChunk(parsedChunk);
							} catch (e) {
								console.warn(
									`Stream ${streamId}: Processor failed to parse stream line or process chunk: ${line}`,
									e
								);
							}
						}
						boundary = jsonBuffer.indexOf('\n');
					}
				},
				close: async () => {
					await this.handleStreamClose();
				},
				abort: async (reason) => {
					await this.failRun(reason);
				}
			}),
			{ signal: this.abortController.signal } // Pass the internal abort signal to pipeTo
		);

		// This used to branch on platform.context.waitUntil for Cloudflare Workers.
		// Both branches did the same thing apart from the waitUntil wrapper, and this
		// app ships on svelte-adapter-bun, which never populates platform.context - so
		// only this path ever ran. Kept as the single behaviour.
		// The map entry was only removed by the WritableStream's close/abort
		// callbacks. Any other rejection left a dead processor in the map forever, so
		// every later request for this dream got the corpse back - and left the dream
		// itself stuck PENDING_ANALYSIS.
		backgroundProcessingPromise.catch((e) => this.failRun(e));
	}

	/**
	 * Cancels the ongoing stream processing.
	 */
	public cancelStream(): void {
		console.log(`Stream ${this.streamId}: Received cancellation request.`);
		this.abortController.abort('Analysis cancelled by user.');
	}

	private async processChunk(parsedChunk: App.AnalysisStreamChunk): Promise<void> {
		// Accumulate interpretation in memory
		if (parsedChunk.content) {
			this.accumulatedInterpretation += parsedChunk.content;
		}

		// Update Redis with current progress and publish
		const redisUpdateChunk: App.AnalysisStreamChunk = {
			content: parsedChunk.content, // Send delta content
			status: parsedChunk.status || DreamStatus.PENDING_ANALYSIS // Still specific to DreamStatus
		};
		await this.streamStateStore.updateStreamState(this.streamId, redisUpdateChunk, false);
		await this.streamStateStore.publishUpdate(this.streamId, redisUpdateChunk);

		// Database update only on finalStatus or ANALYSIS_FAILED
		if (parsedChunk.finalStatus && !this.resultUpdatedInDb) {
			this.resultUpdatedInDb = await this.updateResultInDb(parsedChunk.finalStatus);
			console.debug(
				`Stream ${this.streamId}: Processor updated final status to ${parsedChunk.finalStatus} in DB.`
			);
			await this.streamStateStore.updateStreamState(
				this.streamId,
				{ finalStatus: parsedChunk.finalStatus },
				true
			); // Update Redis with final status
			await this.streamStateStore.publishUpdate(this.streamId, {
				finalStatus: parsedChunk.finalStatus
			}); // Publish final status
		} else if (parsedChunk.status === DreamStatus.ANALYSIS_FAILED && !this.resultUpdatedInDb) {
			this.resultUpdatedInDb = await this.updateResultInDb(DreamStatus.ANALYSIS_FAILED);
			console.debug(
				`Stream ${this.streamId}: Processor updated final status to ANALYSIS_FAILED (from chunk status) in DB.`
			);
			await this.streamStateStore.updateStreamState(
				this.streamId,
				{ finalStatus: DreamStatus.ANALYSIS_FAILED },
				true
			); // Update Redis with final status
			await this.streamStateStore.publishUpdate(this.streamId, {
				finalStatus: DreamStatus.ANALYSIS_FAILED
			}); // Publish final status
		}
	}

	private async handleStreamClose(): Promise<void> {
		// `written` is whether THIS call actually landed the terminal row - not
		// merely whether nothing had written one yet. The distinction is the whole
		// point: on a database blip updateResultInDb catches, returns false, and
		// leaves the dream PENDING_ANALYSIS with its paid token intact. Publishing
		// COMPLETED and clearing Redis regardless would tell the browser the run
		// finished while every later page load re-spawned a billed request on that
		// one charge - the exact regression updateResultInDb's own comment records
		// as already fixed once.
		let written = false;
		if (!this.resultUpdatedInDb) {
			written = await this.updateResultInDb(DreamStatus.COMPLETED);
			this.resultUpdatedInDb = written;
			console.debug(`Stream ${this.streamId}: Processor finished, status set to COMPLETED in DB.`);
			if (written) {
				await this.streamStateStore.publishUpdate(this.streamId, {
					finalStatus: 'COMPLETED',
					message: 'Processing completed.'
				}); // Publish final status
			} else {
				// The write failed. Leave Redis alone so isStreamOngoing can still see
				// this run, and tell the client the truth.
				await this.streamStateStore.publishUpdate(this.streamId, {
					finalStatus: 'ANALYSIS_FAILED',
					message: 'Could not save the analysis.'
				});
			}
		}
		await this.streamStateStore.clearStreamState(this.streamId); // Ensure Redis state is cleared on close
		activeStreamProcessors.delete(this.streamId); // Remove from map on completion/close

		// Per-element notes, describing what each image did in THIS dream. Free,
		// additive, and structurally unable to disturb the run it describes.
		//
		// Everything about this call site is deliberate:
		//
		// - HERE, not in updateResultInDb. That function releases the paid
		//   entitlement in the same statement that writes the terminal state, and
		//   anything added inside its `try` would be swallowed by its catch and
		//   returned as `false` AFTER the commit - which makes the caller write a
		//   second time and publish a second terminal frame.
		//
		// - HERE, not in processChunk. Its `finalStatus` / `status` branches are
		//   unreachable: the only producer (asyncIterableToReadableStream) emits
		//   `{content}` and nothing else, so this method is the sole success path.
		//
		// - Only when THIS call completed the run. failRun also reaches
		//   updateResultInDb, and cancelling routes through it - answering a user's
		//   Stop by starting a new model request is a shape this file has already
		//   been burned by, see the comment on getStreamProcessor.
		//
		// - Promise.resolve().then(), NOT queueMicrotask. A synchronous throw in a
		//   microtask callback has no enclosing promise to reject and surfaces as
		//   an uncaught exception; on a single-replica deploy holding
		//   activeStreamProcessors in memory that kills every other in-flight
		//   analysis. Wrapping in a promise converts a sync throw into a rejection
		//   the .catch below can absorb.
		//
		// - After the map cleanup above, so annotation never runs while this dream
		//   still looks like it has a live processor.
		if (written) {
			const streamId = this.streamId;
			Promise.resolve()
				.then(() => annotateDream(streamId, this.prisma))
				.catch((e) => console.warn(`Stream ${streamId}: annotation failed:`, e));
		}
	}

	/**
	 * Drives a run to a terminal state. The one exit for every way a run can die:
	 * the stream aborting, `pipeTo` rejecting, or `init()` never succeeding.
	 *
	 * The last two used to only delete the map entry. The dream stayed
	 * PENDING_ANALYSIS forever - which now also means holding a paid entitlement,
	 * so every page load would restart the analysis on that single charge.
	 */
	public async failRun(reason: unknown): Promise<void> {
		const errorMessage =
			reason instanceof Error ? reason.message : String(reason || 'Unknown error');
		console.error(`Stream ${this.streamId}: Processor failed:`, errorMessage);

		if (!this.resultUpdatedInDb) {
			this.resultUpdatedInDb = await this.updateResultInDb(DreamStatus.ANALYSIS_FAILED);
		}
		// Best effort: init() is itself one of the things that can fail here, and it
		// is what assigns the store - so there may be nobody to publish to.
		try {
			await this.streamStateStore?.publishUpdate(this.streamId, {
				finalStatus: 'ANALYSIS_FAILED',
				message: `Processing failed: ${errorMessage}`
			});
			await this.streamStateStore?.clearStreamState(this.streamId);
		} catch (e) {
			console.error(`Stream ${this.streamId}: Failed to clear stream state:`, e);
		}
		activeStreamProcessors.delete(this.streamId);
	}

	/**
	 * Writes the terminal state and RELEASES the paid entitlement in the same
	 * statement, so one charge funds exactly one run.
	 *
	 * Returns whether the write landed. It used to swallow the error while the
	 * caller set `resultUpdatedInDb = true` regardless — so a failed write left the
	 * dream PENDING_ANALYSIS with its token intact, and every page load re-streamed
	 * it.
	 */
	private async updateResultInDb(status: DreamStatus): Promise<boolean> {
		try {
			await this.prisma.dream.update({
				where: { id: this.streamId },
				data: {
					status: status,
					interpretation: this.accumulatedInterpretation,
					promptType: this.promptType,
					analysisPaidAt: null
				}
			});
			return true;
		} catch (updateError) {
			console.error(
				`Stream ${this.streamId}: Failed to update dream status to ${status} in DB:`,
				updateError
			);
			return false;
		}
	}
}

// A map to keep track of active processors to prevent duplicate background processes
const activeStreamProcessors = new Map<string, StreamProcessor>();

/**
 * Look up a running processor WITHOUT creating one.
 *
 * Split out from the factory because the cancel endpoint used to call the
 * create-or-get form: cancelling an analysis that this process was not running
 * would CREATE a processor, kick off a whole new LLM request, and then abort it -
 * a spurious billed request per cancel, while the real analysis carried on. It
 * also made the endpoint's `else` branch unreachable, since the factory never
 * returns a falsy value.
 *
 * ponytail: process-local map, so this only sees analyses started by this pod.
 * Recovery from a pod restart is Redis key expiry. Upgrade path if a second
 * replica is ever added: publish cancellation on a Redis channel the owning pod
 * subscribes to.
 */
export function getStreamProcessor(dreamId: string): StreamProcessor | undefined {
	return activeStreamProcessors.get(dreamId);
}

/**
 * Start analysis for a dream, or return the processor already running it.
 * @param dream The dream object.
 * @param platform The SvelteKit platform object.
 * @param promptType The type of prompt to use for analysis.
 * @returns The StreamProcessor instance.
 */
export function getOrCreateStreamProcessor(
	dream: Dream,
	platform: App.Platform | undefined,
	promptType?: DreamPromptType // Make promptType optional here, as it might be retrieved from Redis state
): StreamProcessor {
	if (activeStreamProcessors.has(dream.id)) {
		const existingProcessor = activeStreamProcessors.get(dream.id)!;
		if (promptType) {
			existingProcessor.setPromptType(promptType); // Update promptType if provided
		}
		return existingProcessor;
	}

	const processor = new StreamProcessor(dream.id, platform);
	activeStreamProcessors.set(dream.id, processor);

	// Asynchronously initialize and start processing
	processor
		.init()
		.then(async () => {
			// If promptType is not provided, try to get it from the dream object or Redis state
			const effectivePromptType = promptType || (dream.promptType as DreamPromptType) || 'jungian';
			processor.setPromptType(effectivePromptType);

			// Create the LangChain stream here, passing the processor's internal abort signal
			const llmAsyncIterable = await initiateDreamAnalysis(
				dream,
				effectivePromptType,
				processor.abortController.signal
			);

			// Convert the AsyncIterable<string> to ReadableStream<Uint8Array>
			const llmReadableStream = asyncIterableToReadableStream(llmAsyncIterable);

			// Start the processing in the background.
			// The processor itself will handle its lifecycle and removal from the map
			// once the processing is truly complete or failed.
			processor.startProcessing(llmReadableStream);
		})
		.catch((e) => processor.failRun(e));

	return processor;
}
