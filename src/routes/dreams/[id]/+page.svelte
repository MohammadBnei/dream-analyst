<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';
  import { page } from '$app/stores'; // Import page store
  import { Streamdown } from 'svelte-streamdown'; // Import Streamdown for markdown rendering

  export let data: PageData;

  let isDeleting = false;
  let isRegenerating = false;

  function handleEdit() {
    // Basic edit: redirect to new dream entry (as per FDD)
    goto('/dream/new');
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this dream? This action cannot be undone.')) {
      return;
    }
    isDeleting = true;
    // The form action will handle the deletion
  }

  async function handleRegenerate() {
    if (!confirm('Are you sure you want to regenerate the analysis for this dream?')) {
      return;
    }
    isRegenerating = true;
    // The form action will handle the regeneration
  }

  // Handle form submission success/failure
  $: if ($page.form) {
    isDeleting = false;
    isRegenerating = false;
    if ($page.form.error) {
      alert($page.form.error.error); // Access the error message from the form object
    } else if ($page.form.success) {
      // Refresh the page to show updated status
      window.location.reload();
    }
  }
</script>

<div class="container mx-auto p-4 max-w-4xl">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-3xl font-bold">Dream Details</h1>
    <div class="flex gap-2">
      {#if data.dream.status === 'completed' || data.dream.status === 'analysis_failed'}
        <form method="POST" action="?/regenerate" use:enhance={handleRegenerate}>
          <button
            type="submit"
            class="btn btn-success btn-sm"
            disabled={isRegenerating}
            aria-label="Regenerate analysis"
          >
            {#if isRegenerating}
              Regenerating...
            {:else}
              Regenerate Analysis
            {/if}
          </button>
        </form>
      {/if}
      <button
        on:click={handleEdit}
        class="btn btn-outline btn-sm"
        aria-label="Edit dream"
      >
        Edit
      </button>
      <form method="POST" action="?/delete" use:enhance={handleDelete}>
        <button
          type="submit"
          class="btn btn-error btn-sm"
          disabled={isDeleting}
          aria-label="Delete dream"
        >
          {#if isDeleting}
            Deleting...
          {:else}
            Delete
          {/if}
        </button>
      </form>
    </div>
  </div>

  <div class="card bg-base-100 shadow-md">
    <div class="card-body">
      <div class="mb-4">
        <p class="text-sm text-gray-500">
          Created on {new Date(data.dream.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>

      <div class="mb-6">
        <h2 class="text-xl font-semibold mb-2">Dream Text</h2>
        <p class="text-gray-700 leading-relaxed whitespace-pre-wrap">{data.dream.raw_text}</p>
      </div>

      <div class="mb-6">
        <h2 class="text-xl font-semibold mb-2">Status</h2>
        {#if data.dream.status === 'completed'}
          <span class="badge badge-success">Analysis Completed</span>
        {:else if data.dream.status === 'pending_analysis'}
          <span class="badge badge-warning">Analyzing...</span>
        {:else if data.dream.status === 'analysis_failed'}
          <span class="badge badge-error">Analysis Failed</span>
        {:else}
          <span class="badge badge-neutral">{data.dream.status}</span>
        {/if}
      </div>

      {#if data.dream.tags && data.dream.tags.length > 0}
        <div class="mb-6">
          <h2 class="text-xl font-semibold mb-2">Symbolic Tags</h2>
          <div class="flex flex-wrap gap-2">
            {#each data.dream.tags as tag}
              <span class="badge badge-primary">{tag}</span>
            {/each}
          </div>
        </div>
      {/if}

      {#if data.dream.interpretation}
        <div class="mb-6">
          <h2 class="text-xl font-semibold mb-2">Jungian Interpretation</h2>
          <div class="p-4 bg-base-200 rounded-lg">
            <!-- Render the interpretation as markdown using Streamdown -->
            <Streamdown content={data.dream.interpretation} />
          </div>
        </div>
      {:else if data.dream.status === 'pending_analysis'}
        <div class="alert alert-info">
          <span>Analysis is still in progress. Check back later.</span>
        </div>
      {:else if data.dream.status === 'analysis_failed'}
        <div class="alert alert-error">
          <span>Analysis failed. You can try re-saving the dream to trigger a new analysis.</span>
        </div>
      {/if}
    </div>
  </div>

  <div class="mt-6 text-center">
    <a href="/dreams" class="btn btn-secondary">Back to My Dreams</a>
  </div>
</div>
