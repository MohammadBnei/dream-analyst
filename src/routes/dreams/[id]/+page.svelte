<script lang="ts">
    import type { PageData } from './$types';
    import { goto } from '$app/navigation';
    import { onMount, onDestroy } from 'svelte';
    import { marked } from 'marked'; // You'll need to install 'marked'
    import DOMPurify from 'dompurify'; // You'll need to install 'dompurify'

    export let data: PageData;

    let dream = data.dream; // Initial dream data from server load function

    let streamedInterpretation = dream.interpretation || '';
    // let streamedTags = dream.tags || []; // Tags are no longer streamed
    let currentDreamStatus = dream.status;

    let isLoadingStream = false;
    let streamError: string | null = null;
    let eventSource: EventSource | null = null;

    // Reactive variable for rendering markdown
    $: renderedInterpretation = DOMPurify.sanitize(marked.parse(streamedInterpretation));

    // Function to determine badge color based on dream status
    function getStatusBadgeClass(status: App.Dream['status']) {
        switch (status) {
            case 'completed':
                return 'badge-success';
            case 'pending_analysis':
                return 'badge-info';
            case 'analysis_failed':
                return 'badge-error';
            default:
                return 'badge-neutral';
        }
    }

    onMount(() => {
        if (currentDreamStatus === 'pending_analysis') {
            startStream();
        }
    });

    onDestroy(() => {
        if (eventSource) {
            eventSource.close();
            console.log('EventSource closed.');
        }
    });

    function startStream() {
        isLoadingStream = true;
        streamError = null;
        // Clear interpretation only if we are starting a fresh analysis stream
        streamedInterpretation = '';
        // streamedTags = []; // Tags are no longer streamed
        currentDreamStatus = 'pending_analysis';

        eventSource = new EventSource(`/api/dreams/${dream.id}/stream-analysis`);

        eventSource.onopen = () => {
            console.log('EventSource opened.');
            // isLoadingStream = false; // Keep loading until first data or end event
        };

        eventSource.onmessage = (event) => {
            isLoadingStream = false; // Once we receive a message, we're no longer just "loading" the stream connection
            try {
                const data = JSON.parse(event.data);
                if (data.interpretation) {
                    streamedInterpretation += data.interpretation;
                }
                // if (data.tags) { // Tags are no longer streamed
                //     streamedTags = data.tags;
                // }
                // If the backend sends status updates, we can update currentDreamStatus here
            } catch (e) {
                console.error('Error parsing SSE message:', e, event.data);
                // This might happen if the backend sends non-JSON data or malformed JSON
                // We can choose to display this raw data or just log it.
                // For now, we'll log and ignore, as the backend should ideally send JSON.
            }
        };

        eventSource.addEventListener('end', (event) => {
            console.log('Stream ended:', event.data);
            isLoadingStream = false;
            currentDreamStatus = 'completed'; // Assume completed on 'end' event
            if (eventSource) {
                eventSource.close();
            }
            // Optionally, refetch dream data to get final persisted state
            // goto(window.location.href, { replaceState: true, noScroll: true });
        });

        eventSource.addEventListener('error', (event) => {
            console.error('EventSource error:', event);
            isLoadingStream = false;
            currentDreamStatus = 'analysis_failed';
            streamError = 'Failed to load dream analysis. Please try again.';
            if (eventSource) {
                eventSource.close();
            }
        });
    }
</script>

<div class="container mx-auto max-w-4xl p-4">
    <div class="flex items-center justify-between mb-6">
        <button on:click={() => goto('/dreams')} class="btn btn-ghost">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dreams
        </button>
        <h1 class="text-3xl font-bold text-center flex-grow">Dream Details</h1>
        <div class="w-24"></div> <!-- Spacer to balance the back button -->
    </div>

    <div class="card bg-base-100 shadow-xl p-6">
        <div class="card-body p-0">
            <div class="flex items-center justify-between mb-4">
                <h2 class="card-title text-2xl">
                    Dream on {new Date(dream.createdAt).toLocaleDateString()}
                </h2>
                <span class="badge {getStatusBadgeClass(currentDreamStatus)}"
                    >{currentDreamStatus.replace('_', ' ')}</span
                >
            </div>

            <div class="mb-6">
                <h3 class="text-lg font-semibold mb-2">Raw Dream Text:</h3>
                <p class="text-base-content/80 leading-relaxed whitespace-pre-wrap">
                    {dream.rawText}
                </p>
            </div>

            <!-- Removed tags display as they are no longer streamed -->
            <!-- {#if streamedTags && streamedTags.length > 0}
                <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-2">Tags:</h3>
                    <div class="flex flex-wrap gap-2">
                        {#each streamedTags as tag}
                            <span class="badge badge-primary badge-lg">{tag}</span>
                        {/each}
                    </div>
                </div>
            {/if} -->

            <div class="mb-6">
                <h3 class="text-lg font-semibold mb-2">Interpretation:</h3>
                {#if isLoadingStream}
                    <div class="alert alert-info shadow-lg">
                        <div>
                            <svg class="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Analyzing your dream...</span>
                        </div>
                    </div>
                {:else if streamError}
                    <div class="alert alert-error shadow-lg">
                        <div>
                            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            <span>{streamError}</span>
                        </div>
                    </div>
                    <button on:click={startStream} class="btn btn-primary mt-4">Retry Analysis</button>
                {:else if streamedInterpretation}
                    <div class="prose max-w-none">
                        {@html renderedInterpretation}
                    </div>
                {:else if currentDreamStatus === 'pending_analysis'}
                    <div class="alert alert-info shadow-lg">
                        <div>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current flex-shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            <span>Analysis pending... Please check back later or refresh.</span>
                        </div>
                    </div>
                {:else if currentDreamStatus === 'analysis_failed'}
                    <div class="alert alert-error shadow-lg">
                        <div>
                            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            <span>Analysis failed. We could not process your dream.</span>
                        </div>
                    </div>
                {:else}
                    <p>No interpretation available.</p>
                {/if}
            </div>

            <div class="mt-6 text-sm text-base-content/60">
                <p>Created: {new Date(dream.createdAt).toLocaleString()}</p>
                <p>Last Updated: {new Date(dream.updatedAt).toLocaleString()}</p>
            </div>
        </div>
    </div>
</div>

<style lang="postcss">
    /* Add any specific styles for markdown rendering if needed */
    /* For example, if you're using TailwindCSS with @tailwindcss/typography */
    /* Ensure you have @tailwindcss/typography plugin installed and configured in tailwind.config.js */
    .prose :global(h1) {
        @apply text-2xl font-bold;
    }
    .prose :global(h2) {
        @apply text-xl font-semibold;
    }
    .prose :global(p) {
        @apply mb-4;
    }
    .prose :global(ul) {
        @apply list-disc pl-5 mb-4;
    }
    .prose :global(ol) {
        @apply list-decimal pl-5 mb-4;
    }
    .prose :global(li) {
        @apply mb-1;
    }
</style>
