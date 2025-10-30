import { env } from '$env/dynamic/private';
import type { Dream } from '@prisma/client';
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL_NAME = env.OPENROUTER_MODEL_NAME || 'mistralai/mistral-7b-instruct-v0.2'; // Default model
const YOUR_SITE_URL = env.YOUR_SITE_URL; // Optional, for OpenRouter rankings
const YOUR_SITE_NAME = env.YOUR_SITE_NAME; // Optional, for OpenRouter rankings

// Define the custom type for the processed stream chunks
export interface AnalysisStreamChunk {
    content?: string;
    tags?: string[];
    status?: Dream['status'];
    message?: string;
    finalStatus?: 'COMPLETED' | 'ANALYSIS_FAILED';
}

export async function initiateStreamedDreamAnalysis(dreamId: string, rawText: string, signal?: AbortSignal): Promise<ReadableStream<Uint8Array>> {
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
                // LangChain's ChatOpenAI handles the AbortSignal internally if passed in the constructor options
                // However, for streaming, we'll manage it more directly with the ReadableStream's cancel method.
            },
            {
                baseURL: 'https://openrouter.ai/api/v1',
                defaultHeaders: {
                    ...(YOUR_SITE_URL && { 'HTTP-Referer': YOUR_SITE_URL }),
                    ...(YOUR_SITE_NAME && { 'X-Title': YOUR_SITE_NAME }),
                },
            },
        );

        const stream = await chat.stream([
            new SystemMessage(
                "You are an expert dream interpreter. Analyze the user's dream, providing a detailed interpretation and extracting key themes or tags. " +
                "Provide the interpretation in a continuous stream of text. When you identify a key theme, output it as a separate JSON object. " +
                "The output should be a series of JSON objects, each on a new line. " +
                "For interpretation text, use the format: `{\"content\": \"Your interpretation text here...\"}`. " +
                "For tags, use the format: `{\"tags\": [\"tag1\", \"tag2\"]}`. " +
                "Do not include any other text outside of these JSON objects. " +
                "Ensure the interpretation is insightful and empathetic."
            ),
            new HumanMessage(`My dream: ${rawText}`),
        ], {
            signal: signal // Pass the abort signal directly to the stream method
        });

        let currentContent = '';
        let currentTags: string[] = [];

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
                            currentContent += content;
                            // Send content in small, frequent chunks
                            controller.enqueue(encoder.encode(JSON.stringify({ content: content }) + '\n'));
                        }

                        // LangChain's stream doesn't directly provide tags or status in this format.
                        // This part would require more advanced prompt engineering or post-processing
                        // if you want to extract tags dynamically during the stream.
                        // For now, we'll simulate a final tag output.
                    }

                    if (signal?.aborted) {
                        // If aborted, send a failed status
                        controller.enqueue(encoder.encode(JSON.stringify({ finalStatus: 'ANALYSIS_FAILED', message: 'Analysis aborted.' }) + '\n'));
                    } else {
                        // Simulate final tags and completion
                        // In a real scenario, you might have a separate call or a more complex prompt
                        // to extract tags at the end or during the process.
                        // For this example, let's just send a completion status.
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
                // The signal passed to chat.stream should handle the actual LLM cancellation.
            }
        });

        return readableStream;

    } catch (error) {
        console.error('Error initiating LangChain streamed dream analysis:', error);
        // Create a readable stream that immediately errors out
        return new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode(JSON.stringify({ message: `Failed to initiate streamed dream analysis service: ${(error as Error).message}`, finalStatus: 'ANALYSIS_FAILED' }) + '\n'));
                controller.close();
            }
        });
    }
}
