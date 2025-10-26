<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/stores';

  let dreamText: string = '';
  let isSaving: boolean = false;
  let analysisResult: { tags: string[]; interpretation: string } | null = null;
  let errorMessage: string | null = null;

  async function handleSubmit() {
    isSaving = true;
    errorMessage = null;
    analysisResult = null;
    // The form action will handle the actual saving and analysis trigger
  }

  // Handle form submission success/failure
  $: if ($page.form) {
    isSaving = false;
    if ($page.form.success) {
      dreamText = ''; // Clear text area on successful save
      analysisResult = $page.form.analysisResult;
      errorMessage = null;
    } else if ($page.form.error) {
      errorMessage = $page.form.error;
      analysisResult = null;
    }
  }

  $: canSave = dreamText.trim().length >= 10 && !isSaving;
</script>

<div class="container mx-auto p-4 max-w-2xl">
  <h1 class="text-3xl font-bold mb-6 text-center">New Dream</h1>

  <form method="POST" action="?/saveDream" use:enhance={handleSubmit} class="space-y-6">
    <div>
      <textarea
        name="dreamText"
        bind:value={dreamText}
        placeholder="Type your dream here..."
        rows="10"
        class="w-full p-4 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 resize-y"
        aria-label="Dream text input"
        required
      ></textarea>
    </div>

    <button
      type="submit"
      class="w-full py-3 px-4 bg-green-600 text-white font-semibold rounded-lg shadow-md transition-colors duration-200"
      class:opacity-50={!canSave}
      class:cursor-not-allowed={!canSave}
      disabled={!canSave}
      aria-live="polite"
    >
      {#if isSaving}
        Saving and Analyzing...
      {:else}
        Save Dream
      {/if}
    </button>
  </form>

  {#if isSaving}
    <div class="mt-6 text-center text-blue-600">
      <p>Dream saved! Analyzing...</p>
      <div class="spinner mt-2"></div>
    </div>
  {/if}

  {#if errorMessage}
    <div class="mt-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg" role="alert">
      <p class="font-bold">Error:</p>
      <p>{errorMessage}</p>
      {#if errorMessage.includes('analysis failed')}
        <button
          class="mt-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
          on:click={() => {
            // Implement retry logic here, e.g., re-submit the form or call a specific API
            // For now, we'll just clear the error.
            errorMessage = null;
          }}
        >
          Retry Analysis
        </button>
      {/if}
    </div>
  {/if}

  {#if analysisResult}
    <div class="mt-6 p-6 bg-gray-50 rounded-lg shadow-inner">
      <h2 class="text-2xl font-semibold mb-4">Analysis Result</h2>
      <div class="mb-4">
        <h3 class="text-xl font-medium mb-2">Tags:</h3>
        <div class="flex flex-wrap gap-2">
          {#each analysisResult.tags as tag}
            <span class="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
              {tag}
            </span>
          {/each}
        </div>
      </div>
      <div>
        <h3 class="text-xl font-medium mb-2">Interpretation:</h3>
        <p class="text-gray-700 leading-relaxed whitespace-pre-wrap">{analysisResult.interpretation}</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .spinner {
    border: 4px solid rgba(0, 0, 0, 0.1);
    border-left-color: #2563eb; /* blue-600 */
    border-radius: 50%;
    width: 36px;
    height: 36px;
    animation: spin 1s linear infinite;
    margin: 0 auto;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
