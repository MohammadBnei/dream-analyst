<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { invalidate } from '$app/navigation';
	import type { ChatMessage } from '$lib/chatService';
	import { onMount } from 'svelte';
	import { ClientChatService } from '../services/chatService';
	import { Streamdown } from 'svelte-streamdown';

	let { dreamId } = $props();

	let chatService = $state<ClientChatService | null>(null);
	let chatMessages = $state<Partial<ChatMessage>[]>([]);
	let chatInput = $state('');
	let isSendingChatMessage = $state(false);
	let chatError = $state<string | null>(null);
	let chatContainer: HTMLElement; // Reference to the chat scroll container

	$effect(() => {
		chatMessages && scrollToBottom();
	});

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
				chatError = errorMsg;
				scrollToBottom();
			},
			onClose: () => {
				console.log('Chat service stream closed.');
				isSendingChatMessage = false;
			}
		});

		chatMessages = await chatService.loadHistory();
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

		// Add user message to display
		chatMessages = [...chatMessages, { role: 'user', content: messageToSend }];
		scrollToBottom();

		try {
			await chatService.sendMessage(messageToSend);
			// The onEnd callback will handle setting isSendingChatMessage to false and reloading history
		} catch (error) {
			console.error('Error sending chat message:', error);
			chatError = `Failed to send message: ${(error as Error).message}`;
			isSendingChatMessage = false;
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
				</div>
			</div>
		{/each}
		{#if isSendingChatMessage}
			<div class="chat-start chat">
				<div class="chat-bubble">
					<span class="loading loading-dots"></span>
				</div>
			</div>
		{/if}
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
		<button
			class="btn btn-primary"
			onclick={sendChatMessage}
			disabled={!chatInput.trim() || isSendingChatMessage}
		>
			{#if isSendingChatMessage}
				<span class="loading loading-spinner"></span>
			{:else}
				{m.send_button()}
			{/if}
		</button>
	</div>
</div>
