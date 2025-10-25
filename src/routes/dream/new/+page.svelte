<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/stores';
  import { SpeechRecognition } from 'svelte-speech-recognition';
  import { onMount } from 'svelte';

  let dreamText: string = '';
  let isRecording: boolean = false;
  let isSaving: boolean = false;
  let analysisResult: { tags: string[]; interpretation: string } | null = null;
  let errorMessage: string | null = null;

  let speechRecognitionSupported: boolean = false;

  onMount(() => {
    speechRecognitionSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  });

  function handleRecognitionResult(event: CustomEvent<string>) {
    dreamText += event.detail + ' ';
  }

  function handleRecognitionError(event: CustomEvent<string>) {
    console.error('Speech recognition error:', event.detail);
    errorMessage = `Speech recognition error: ${event.detail}`;
    isRecording = false;
  }

  function handleRecognitionEnd() {
    isRecording = false;
  }

  async function handleSubmit() {
    isSaving = true;
    errorMessage = null;
    analysisResult = null;

    // The form action will handle the actual saving and analysis trigger
    // We just need to update the UI state here.
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
    <div class="relative">
      <textarea
        name="dreamText"
        bind:value={dreamText}
        placeholder="Type or speak your dream here..."
        rows="10"
        class="w-full p-4 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 resize-y"
        aria-label="Dream text input"
      ></textarea>

      {#if speechRecognitionSupported}
        <div class="absolute bottom-4 right-4">
          <SpeechRecognition
            lang="en-US"
            continuous={true}
            interimResults={true}
            on:result={handleRecognitionResult}
            on:error={handleRecognitionError}
            on:end={handleRecognitionEnd}
            bind:isRecording={isRecording}
          >
            <button
              type="button"
              class="p-3 rounded-full shadow-lg transition-colors duration-200"
              class:bg-red-500={isRecording}
              class:hover:bg-red-600={isRecording}
              class:bg-blue-500={!isRecording}
              class:hover:bg-blue-600={!isRecording}
              aria-label={isRecording ? 'Stop recording dream' : 'Start recording dream'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </button>
          </SpeechRecognition>
        </div>
      {:else}
        <p class="text-sm text-gray-500 mt-2">
          Voice input not supported in your browser. Please type your dream.
        </p>
      {/if}
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
