<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { invalidate } from '$app/navigation';
	import type { ChatMessage } from '$lib/chatService'; // Re-use the server-side ChatMessage interface
	import { onMount } from 'svelte';
	import { ClientChatService } from '../services/chatService';
	import { Streamdown } from 'svelte-streamdown';

	let { dreamId } = $props();

	let chatService = $state<ClientChatService | null>(null);
	let chatMessages = $state<Partial<App.ChatMessage>[]>([]); // Use App.ChatMessage
	let chatInput = $state('');
	let isSendingChatMessage = $state(false);
	let chatError = $state<string | null>(null);
	let chatContainer: HTMLElement; // Reference to the chat scroll container
	let abortController: AbortController | null = null; // To manage stream cancellation

	onMount(async () => {
		chatService = new ClientChatService(dreamId, {
			onMessage: (data) => {
				// Update the last message if it's from the assistant and still streaming
				if (
					chatMessages.length > 0 &&
					chatMessages[chatMessages.length - 1].role === 'assistant' &&
					!data.final
				) {
					chatMessages[chatMessages.length - 1].content += data.content || '';
					chatMessages = [...chatMessages]; // Trigger reactivity
				} else if (data.content) {
					// Add new assistant message if it's the first chunk or previous was final
					chatMessages = [...chatMessages, { role: 'assistant', content: data.content }];
				}
				scrollToBottom();
			},
			onEnd: async (data) => {
				isSendingChatMessage = false;
				abortController = null; // Reset controller
				if (data.message) {
					chatError = data.message;
				}
				await invalidate('dream'); // Invalidate to ensure latest DB state (including chat history) is fetched
				await loadChatHistory(); // Reload history to get the saved messages
				scrollToBottom();
			},
			onError: (errorMsg) => {
				console.error('Chat stream error:', errorMsg);
				isSendingChatMessage = false;
				abortController = null; // Reset controller
				chatError = errorMsg;
				scrollToBottom();
			},
			onClose: () => {
				console.log('Chat service stream closed.');
				isSendingChatMessage = false;
				abortController = null; // Reset controller
			}
		});

		chatMessages = await chatService.loadHistory();

		return () => {
			chatService?.closeStream();
			abortController?.abort(); // Abort any pending requests on component unmount
		};
	});

	async function loadChatHistory() {
		if (chatService) {
			chatMessages = await chatService.loadHistory();
			scrollToBottom();
		}
	}

	async function sendChatMessage() {
		if (!chatInput.trim() || !chatService || isSendingChatMessage) return;

		const messageToSend = chatInput;
		chatInput = ''; // Clear input immediately
		isSendingChatMessage = true;
		chatError = null;
		abortController = new AbortController(); // Create a new AbortController for this request

		// Add user message to display
		chatMessages = [...chatMessages, { role: 'user', content: messageToSend }];
		scrollToBottom();

		try {
			await chatService.sendMessage(messageToSend, abortController.signal);
			// The onEnd callback will handle setting isSendingChatMessage to false and reloading history
		} catch (error) {
			if ((error as Error).name === 'AbortError') {
				console.log('Chat message sending aborted by user.');
				chatError = 'Chat message sending aborted.';
			} else {
				console.error('Error sending chat message:', error);
				chatError = `Failed to send message: ${(error as Error).message}`;
			}
			isSendingChatMessage = false;
			abortController = null; // Reset controller on error or abort
		}
	}

	function cancelChatMessage() {
		if (abortController) {
			abortController.abort();
			console.log('Attempting to cancel chat message...');
			isSendingChatMessage = false; // Immediately update UI
			chatError = 'Chat generation cancelled.';
			abortController = null; // Clear the controller
		}
	}

	async function deleteChatMessage(messageId: string) {
		if (!chatService) return;

		try {
			await chatService.deleteMessage(messageId);
			chatMessages = chatMessages.filter((msg) => msg.id !== messageId);
			// Optionally, invalidate 'dream' if deleting a message should trigger a full data refresh
			// await invalidate('dream');
		} catch (error) {
			console.error('Error deleting chat message:', error);
			chatError = `Failed to delete message: ${(error as Error).message}`;
		}
	}

	function scrollToBottom() {
		// Use a timeout to ensure DOM has updated before scrolling
		setTimeout(() => {
			if (chatContainer) {
				chatContainer.scrollTop = chatContainer.scrollHeight;
			}
		}, 0);
	}
</script>

<div class="mb-6">
	<h3 class="mb-4 text-lg font-semibold">{m.chat_with_ai_heading()}</h3>
	<div
		bind:this={chatContainer}
		class="chat-container h-96 overflow-y-auto rounded-box bg-base-200 p-4"
	>
		{#each chatMessages as msg, i (msg.id || i)}
			<div class="chat {msg.role === 'user' ? 'chat-end' : 'chat-start'}">
				<div class="chat-bubble {msg.role === 'user' ? 'chat-bubble-primary' : ''}">
					<Streamdown
						animation={{ animateOnMount: true, enabled: isSendingChatMessage, type: 'blur' }}
						content={msg.content || ''}
					/>
					{#if msg.id}
						<button
							class="btn ml-2 btn-ghost btn-xs"
							onclick={() => deleteChatMessage(msg.id as string)}
							title={m.delete_chat_message_button()}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
								/>
							</svg>
						</button>
					{/if}
				</div>
			</div>
		{/each}
		{#if chatError}
			<div class="chat-start chat">
				<div class="chat-bubble chat-bubble-error">
					{chatError}
				</div>
			</div>
		{/if}
	</div>
	<div class="mt-4 flex gap-2">
		<input
			type="text"
			placeholder={m.type_your_message_placeholder()}
			class="input-bordered input flex-grow"
			bind:value={chatInput}
			onkeydown={(e) => {
				if (e.key === 'Enter' && !e.shiftKey) {
					e.preventDefault();
					sendChatMessage();
				}
			}}
			disabled={isSendingChatMessage}
		/>
		{#if isSendingChatMessage}
			<button class="btn btn-warning" onclick={cancelChatMessage}>
				<span class="loading loading-spinner"></span>
				{m.cancel_button()}
			</button>
		{:else}
			<button
				class="btn btn-primary"
				onclick={sendChatMessage}
				disabled={!chatInput.trim() || isSendingChatMessage}
			>
				{m.send_button()}
			</button>
		{/if}
	</div>
</div>
