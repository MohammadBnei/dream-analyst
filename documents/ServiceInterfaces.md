# Service Interfaces Documentation

This document outlines the primary methods, their inputs, and their outputs for the core services in the application.

---

## 1. LLMService (`src/lib/server/services/llmService.ts`)

**Purpose:** Encapsulates all direct interactions with the Large Language Model (LLM) provider (e.g., OpenRouter). It provides a generic streaming interface for LLM completions.

### `streamChatCompletion`

-   **Description:** Streams a chat completion from the configured LLM.
-   **Inputs:**
    -   `messages`: `BaseMessage[]` - An array of messages representing the conversation history, including system, human, and AI messages.
    -   `signal?`: `AbortSignal` - An optional signal to abort the LLM request.
-   **Outputs:**
    -   `Promise<AsyncIterable<string>>` - An asynchronous iterable that yields raw string chunks of the LLM's response as they become available.

---

## 2. ServerChatService (`src/lib/server/chatService.ts`)

**Purpose:** Manages chat interactions on the server-side, including loading/saving chat history, deducting credits, and orchestrating the conversation flow with the LLM via `LLMService`.

### `loadChatHistory`

-   **Description:** Loads the chat history for a specific dream and user from the database.
-   **Inputs:**
    -   `dreamId`: `string` - The ID of the dream.
    -   `userId`: `string` - The ID of the user.
-   **Outputs:**
    -   `Promise<App.ChatMessage[]>` - A promise that resolves to an array of chat messages. Each `App.ChatMessage` includes `id`, `role`, `content`, and `promptType`.

### `saveChatMessage`

-   **Description:** Saves a single chat message (user or assistant) to the database.
-   **Inputs:**
    -   `dreamId`: `string` - The ID of the dream.
    -   `userId`: `string` - The ID of the user.
    -   `role`: `'user' | 'assistant'` - The role of the message sender.
    -   `content`: `string` - The content of the message.
    -   `promptType?`: `DreamPromptType` - The optional prompt type used for this message (primarily for AI messages).
-   **Outputs:**
    -   `Promise<App.ChatMessage>` - A promise that resolves to the newly created chat message object, including its database ID.

### `clearChatHistory`

-   **Description:** Deletes all chat messages associated with a specific dream and user from the database.
-   **Inputs:**
    -   `dreamId`: `string` - The ID of the dream.
    -   `userId`: `string` - The ID of the user.
-   **Outputs:**
    -   `Promise<void>` - A promise that resolves when the operation is complete.

### `chatWithAI`

-   **Description:** Initiates a conversational chat with the LLM for dream interpretation, handling credit deductions and database updates for messages.
-   **Inputs:**
    -   `dreamId`: `string` - The ID of the dream.
    -   `userId`: `string` - The ID of the user.
    -   `userMessage`: `string` - The user's current message.
    -   `dreamRawText`: `string` - The raw text of the dream being discussed.
    -   `dreamInterpretation`: `string` - The initial interpretation provided for the dream.
    -   `promptType?`: `DreamPromptType` - The type of interpretation prompt to use (defaults to 'jungian').
    -   `signal?`: `AbortSignal` - An optional signal to abort the LLM request.
-   **Outputs:**
    -   `Promise<ReadableStream<Uint8Array>>` - A promise that resolves to a `ReadableStream` of `Uint8Array` chunks. Each chunk contains a JSON string representing `ChatStreamChunk` (with `content`, `final`, `message` properties), encoded with `TextEncoder` and delimited by newlines.

---

## 3. DreamAnalysisService (`src/lib/server/services/dreamAnalysisService.ts`)

**Purpose:** Focuses on initiating the raw LLM stream for dream analysis. It acts as an intermediary between the `StreamProcessor` (which handles database updates and credit deductions) and the `LLMService`.

### `initiateRawStreamedDreamAnalysis`

-   **Description:** Initiates a raw streamed dream analysis from the LLM. This function is solely responsible for interacting with the LLM and returning its raw text stream.
-   **Inputs:**
    -   `dream`: `Dream` - The dream object containing at least `id` and `rawText`.
    -   `promptType?`: `DreamPromptType` - The type of interpretation prompt to use (defaults to 'jungian').
    -   `signal?`: `AbortSignal` - An optional signal to abort the LLM request.
-   **Outputs:**
    -   `Promise<AsyncIterable<string>>` - An asynchronous iterable that yields raw string chunks of the LLM's analysis response.

---

## 4. ClientChatService (`src/lib/client/services/chatService.ts`)

**Purpose:** Provides client-side functionality for chat interactions, including loading history, sending messages, and handling the streaming response from the server.

### `loadHistory`

-   **Description:** Fetches the chat history for the current dream from the server API.
-   **Inputs:**
    -   None (uses `this.dreamId`).
-   **Outputs:**
    -   `Promise<App.ChatMessage[]>` - A promise that resolves to an array of chat messages.

### `sendMessage`

-   **Description:** Sends a user message to the server-side chat API and processes the streamed response.
-   **Inputs:**
    -   `message`: `string` - The user's message to send.
    -   `signal?`: `AbortSignal` - An optional signal to cancel the fetch request.
-   **Outputs:**
    -   `Promise<void>` - A promise that resolves when the message sending and stream processing are complete or an error occurs. It uses callbacks (`onMessage`, `onEnd`, `onError`, `onClose`) to communicate stream events.

### `deleteMessage`

-   **Description:** Deletes a specific chat message from the database via the server API.
-   **Inputs:**
    -   `messageId`: `string` - The ID of the message to delete.
-   **Outputs:**
    -   `Promise<void>` - A promise that resolves if the deletion is successful, or rejects with an error.

### `closeStream`

-   **Description:** A placeholder method for client-side stream cleanup. For fetch-based streams, cancellation is handled by the `AbortSignal` passed to `sendMessage`.
-   **Inputs:**
    -   None.
-   **Outputs:**
    -   `void`.

---

## 5. Client DreamAnalysisService (`src/lib/client/services/dreamAnalysisService.ts`)

**Purpose:** Provides client-side functionality for initiating and managing the dream analysis stream from the server.

### `startStream`

-   **Description:** Initiates a streamed dream analysis request to the server and processes the incoming stream of analysis chunks.
-   **Inputs:**
    -   `promptType?`: `DreamPromptType` - The type of interpretation prompt to use (defaults to 'jungian').
-   **Outputs:**
    -   `Promise<void>` - A promise that resolves when the stream starts or an error occurs. It uses callbacks (`onMessage`, `onEnd`, `onError`, `onClose`) to communicate stream events.

### `closeStream`

-   **Description:** Aborts the active dream analysis stream and optionally sends a cancellation signal to the server.
-   **Inputs:**
    -   `silent?`: `boolean` - If true, suppresses the `onClose` callback and server cancellation signal.
-   **Outputs:**
    -   `Promise<void>` - A promise that resolves when the stream is closed and any cancellation signal is sent.
