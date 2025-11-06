import { DreamStatus, type Dream } from '@prisma/client';
import { getStreamStateStore } from '$lib/server/streamStateStore';
import { getPrismaClient } from '$lib/server/db';
import type { DreamPromptType } from '$lib/prompts/dreamAnalyst';
import { getDreamAnalysisService } from './dreamAnalysisService'; // Import the new DreamAnalysisService

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
	private streamStateStore: Awaited<ReturnType<typeof getStreamStateStore>>;
	private prisma: Awaited<ReturnType<typeof getPrismaClient>>;
	abortController: AbortController; // Internal AbortController for server-side cancellation

	private accumulatedInterpretation: string = '';
	private accumulatedTags: string[] = [];
	private resultUpdatedInDb: boolean = false;
	private promptType: DreamPromptType = 'jungian'; // Added promptType property

	constructor(streamId: string, platform: App.Platform | undefined) {
		this.streamId = streamId;
		this.platform = platform;
		this.abortController = new AbortController(); // Initialize internal AbortController
	}

	/**
	 * Initializes the processor by getting necessary clients.
	 * Must be called before `startProcessing`.
	 */
	public async init() {
		this.streamStateStore = await getStreamStateStore();
		this.prisma = await getPrismaClient();
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
					await this.handleStreamAbort(reason);
				}
			}),
			{ signal: this.abortController.signal } // Pass the internal abort signal to pipeTo
		);

		// Use platform.context.waitUntil if available (e.g., Cloudflare Workers)
		if (this.platform?.context?.waitUntil) {
			this.platform.context.waitUntil(
				backgroundProcessingPromise.catch((e) => {
					// Catch and log errors from the pipeTo promise
					console.error(
						`Stream ${this.streamId}: Unhandled error in background processing pipeTo:`,
						e
					);
				})
			);
		} else {
			// For Node.js environments, ensure the promise rejection is caught.
			backgroundProcessingPromise.catch((e) => {
				console.error(
					`Stream ${this.streamId}: Unhandled error in background processing pipeTo:`,
					e
				);
			});
		}
	}

	/**
	 * Cancels the ongoing stream processing.
	 */
	public cancelStream(): void {
		console.log(`Stream ${this.streamId}: Received cancellation request.`);
		this.abortController.abort('Analysis cancelled by user.');
	}

	private async processChunk(parsedChunk: App.AnalysisStreamChunk): Promise<void> {
		// Accumulate interpretation and tags in memory
		if (parsedChunk.content) {
			this.accumulatedInterpretation += parsedChunk.content;
		}
		if (parsedChunk.tags) {
			this.accumulatedTags = parsedChunk.tags;
		}

		// Update Redis with current progress and publish
		const redisUpdateChunk: App.AnalysisStreamChunk = {
			content: parsedChunk.content, // Send delta content
			tags: parsedChunk.tags,
			status: parsedChunk.status || DreamStatus.PENDING_ANALYSIS // Still specific to DreamStatus
		};
		await this.streamStateStore.updateStreamState(this.streamId, redisUpdateChunk, false);
		await this.streamStateStore.publishUpdate(this.streamId, redisUpdateChunk);

		// Database update only on finalStatus or ANALYSIS_FAILED
		if (parsedChunk.finalStatus && !this.resultUpdatedInDb) {
			await this.updateResultInDb(parsedChunk.finalStatus);
			this.resultUpdatedInDb = true;
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
			await this.updateResultInDb(DreamStatus.ANALYSIS_FAILED);
			this.resultUpdatedInDb = true;
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
		if (!this.resultUpdatedInDb) {
			// If the stream closed without an explicit finalStatus and no error was reported, assume completion
			await this.updateResultInDb(DreamStatus.COMPLETED);
			console.debug(`Stream ${this.streamId}: Processor finished, status set to COMPLETED in DB.`);
			await this.streamStateStore.publishUpdate(this.streamId, {
				finalStatus: 'COMPLETED',
				message: 'Processing completed.'
			}); // Publish final status
		}
		await this.streamStateStore.clearStreamState(this.streamId); // Ensure Redis state is cleared on close
		activeStreamProcessors.delete(this.streamId); // Remove from map on completion/close
	}

	private async handleStreamAbort(reason: any): Promise<void> {
		const errorMessage =
			reason instanceof Error ? reason.message : String(reason || 'Unknown error');
		console.error(`Stream ${this.streamId}: Processor aborted:`, errorMessage);

		if (!this.resultUpdatedInDb) {
			await this.updateResultInDb(DreamStatus.ANALYSIS_FAILED);
			console.debug(
				`Stream ${this.streamId}: Processor aborted, status set to ANALYSIS_FAILED in DB.`
			);
			await this.streamStateStore.publishUpdate(this.streamId, {
				finalStatus: 'ANALYSIS_FAILED',
				message: `Processing aborted: ${errorMessage}`
			}); // Publish final status
		}
		await this.streamStateStore.clearStreamState(this.streamId); // Ensure Redis state is cleared on abort
		activeStreamProcessors.delete(this.streamId); // Remove from map on abortion
	}

	private async updateResultInDb(status: DreamStatus): Promise<void> {
		try {
			await this.prisma.dream.update({
				where: { id: this.streamId },
				data: {
					status: status,
					interpretation: this.accumulatedInterpretation,
					tags: this.accumulatedTags,
					promptType: this.promptType // Save the prompt type
				}
			});
		} catch (updateError) {
			console.error(
				`Stream ${this.streamId}: Failed to update dream status to ${status} in DB:`,
				updateError
			);
		}
	}
}

// A map to keep track of active processors to prevent duplicate background processes
const activeStreamProcessors = new Map<string, StreamProcessor>();

/**
 * Initiates or retrieves an existing StreamProcessor for a given stream.
 * This factory function is responsible for creating the source stream (e.g., from n8n).
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
			const dreamAnalysisService = getDreamAnalysisService(); // Get DreamAnalysisService here

			// If promptType is not provided, try to get it from the dream object or Redis state
			const effectivePromptType = promptType || (dream.promptType as DreamPromptType) || 'jungian';
			processor.setPromptType(effectivePromptType);

			// Create the LangChain stream here, passing the processor's internal abort signal
			const llmAsyncIterable = await dreamAnalysisService.initiateDreamAnalysis(
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
		.catch((e) => {
			console.error(`Stream ${dream.id}: Error initializing or starting processor:`, e);
			activeStreamProcessors.delete(dream.id); // Clean up if initialization fails
		});

	return processor;
}
