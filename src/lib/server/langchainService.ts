import { env } from '$env/dynamic/private';
import type { Dream } from '@prisma/client';
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { DreamPromptType } from '../prompts/dreamAnalyst'; // Import the type
import { promptService } from '$lib/prompts/promptService';

const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL_NAME = env.OPENROUTER_MODEL_NAME || 'mistralai/mistral-7b-instruct-v0.2'; // Default model
const YOUR_SITE_URL = env.ORIGIN; // Optional, for OpenRouter rankings

// Define the custom type for the processed stream chunks
export interface AnalysisStreamChunk {
    content?: string;
    tags?: string[];
    status?: Dream['status'];
    message?: string;
    finalStatus?: 'COMPLETED' | 'ANALYSIS_FAILED';
}

export async function initiateStreamedDreamAnalysis(
    dreamId: string,
    rawText: string,
    promptType: DreamPromptType = 'jungian', // Add promptType parameter with a default
    signal?: AbortSignal
): Promise<ReadableStream<Uint8Array>> {
    if (!OPENROUTER_API_KEY) {
        throw new Error("OPENROUTER_API_KEY is not defined");
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    try {
        const chat = new ChatOpenAI(
            {
                model: OPENROUTER_MODEL_NAME,
                temperature: 0.7, // A reasonable default for creative tasks
                streaming: true,
                apiKey: OPENROUTER_API_KEY,
                configuration: {
                    baseURL: 'https://openrouter.ai/api/v1',
                    defaultHeaders: {
                        ...(YOUR_SITE_URL && { 'HTTP-Referer': YOUR_SITE_URL }),
                    },
                },
            },
        );

        // Use the PromptService to get the system prompt, which now handles Jungian knowledge
        const systemPrompt = promptService.getSystemPrompt(promptType);
        const messages = [
            new SystemMessage(systemPrompt),
            new HumanMessage(`My dream: ${rawText}`),
        ];

        const stream = await chat.stream(messages, {
            signal: signal // Pass the abort signal directly to the stream method
        });

        const readableStream = new ReadableStream<Uint8Array>({
            async start(controller) {
                try {
                    for await (const chunk of stream) {
                        if (signal?.aborted) {
                            console.debug(`Dream ${dreamId}: LangChain stream aborted by signal.`);
                            break; // Exit the loop if aborted
                        }

                        const content = chunk.content;
                        if (content) {
                            // LangChain's stream provides content directly.
                            // We need to parse it to extract tags if the prompt is designed to output them.
                            // For now, we'll assume the prompt outputs JSON lines as specified in the prompt.
                            // This part needs to be robust to handle partial JSON or non-JSON output.
                            try {
                                const parsed = JSON.parse(content); // Attempt to parse if it's a full JSON object
                                if (parsed.content) {
                                    controller.enqueue(encoder.encode(JSON.stringify({ content: parsed.content }) + '\n'));
                                }
                                if (parsed.tags) {
                                    controller.enqueue(encoder.encode(JSON.stringify({ tags: parsed.tags }) + '\n'));
                                }
                            } catch (e) {
                                // If it's not a full JSON object, treat it as raw content
                                controller.enqueue(encoder.encode(JSON.stringify({ content: content }) + '\n'));
                            }
                        }
                    }

                    if (signal?.aborted) {
                        controller.enqueue(encoder.encode(JSON.stringify({ finalStatus: 'ANALYSIS_FAILED', message: 'Analysis aborted.' }) + '\n'));
                    } else {
                        controller.enqueue(encoder.encode(JSON.stringify({ finalStatus: 'COMPLETED' }) + '\n'));
                    }
                } catch (error) {
                    console.error(`Dream ${dreamId}: Error during LangChain stream processing:`, error);
                    controller.enqueue(encoder.encode(JSON.stringify({ finalStatus: 'ANALYSIS_FAILED', message: `Stream error: ${(error as Error).message}` }) + '\n'));
                } finally {
                    controller.close();
                }
            },
            cancel(reason) {
                console.debug(`Dream ${dreamId}: Client stream cancelled (ReadableStream cancel). Reason:`, reason);
            }
        });

        return readableStream;

    } catch (error) {
        console.error('Error initiating LangChain streamed dream analysis:', error);
        return new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode(JSON.stringify({ message: `Failed to initiate streamed dream analysis service: ${(error as Error).message}`, finalStatus: 'ANALYSIS_FAILED' }) + '\n'));
                controller.close();
            }
        });
    }
}
