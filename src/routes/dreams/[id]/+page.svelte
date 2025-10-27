<script lang="ts">
    import type { PageData } from './$types';
    import { goto } from '$app/navigation';

    export let data: PageData;

    const dream = data.dream;

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
                <span class="badge {getStatusBadgeClass(dream.status as App.Dream['status'])}"
                    >{dream.status.replace('_', ' ')}</span
                >
            </div>

            <div class="mb-6">
                <h3 class="text-lg font-semibold mb-2">Raw Dream Text:</h3>
                <p class="text-base-content/80 leading-relaxed whitespace-pre-wrap">
                    {dream.rawText}
                </p>
            </div>

            {#if dream.tags && dream.tags.length > 0}
                <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-2">Tags:</h3>
                    <div class="flex flex-wrap gap-2">
                        {#each dream.tags as tag}
                            <span class="badge badge-primary badge-lg">{tag}</span>
                        {/each}
                    </div>
                </div>
            {/if}

            {#if dream.interpretation}
                <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-2">Interpretation:</h3>
                    <div class="prose max-w-none">
                        <p>{dream.interpretation}</p>
                    </div>
                </div>
            {:else if dream.status === 'pending_analysis'}
                <div class="alert alert-info shadow-lg">
                    <div>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current flex-shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <span>Analysis pending... Please check back later.</span>
                    </div>
                </div>
            {:else if dream.status === 'analysis_failed'}
                <div class="alert alert-error shadow-lg">
                    <div>
                        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <span>Analysis failed. We could not process your dream.</span>
                    </div>
                </div>
            {/if}

            <div class="mt-6 text-sm text-base-content/60">
                <p>Created: {new Date(dream.createdAt).toLocaleString()}</p>
                <p>Last Updated: {new Date(dream.updatedAt).toLocaleString()}</p>
            </div>
        </div>
    </div>
</div>
