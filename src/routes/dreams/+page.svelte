<script lang="ts">
  import type { PageData } from './$types';
  import { goto } from '$app/navigation';
  import { enhance } from '$app/forms';
  import { page } from '$app/stores';

  export let data: PageData;

  // Function to navigate to a dream's detail page
  function viewDream(dreamId: string) {
    goto(`/dreams/${dreamId}`);
  }

  // Function to handle editing a dream (placeholder)
  function editDream(dreamId: string) {
    console.log('Edit dream:', dreamId);
    // Implement navigation to an edit page or open a modal
  }

  // Function to handle deleting a dream (placeholder)
  async function deleteDream(dreamId: string) {
    if (!confirm('Are you sure you want to delete this dream?')) {
      return;
    }
    console('Delete dream:', dreamId);
    // Implement API call to delete dream
  }

  // Function to handle regenerating analysis
  async function regenerateDream(dreamId: string) {
    if (!confirm('Are you sure you want to regenerate the analysis for this dream?')) {
      return;
    }
    // The form action will handle the regeneration
  }

  // Handle form submission success/failure
  $: if ($page.form) {
    if ($page.form.success) {
      // Refresh the page or update the list (for simplicity, reload)
      window.location.reload();
    } else if ($page.form.error) {
      alert($page.form.error);
    }
  }
</script>

<div class="container mx-auto p-4 max-w-3xl">
  <h1 class="text-3xl font-bold mb-6 text-center">My Dreams</h1>

  {#if data.dreams.length === 0}
    <p class="text-center text-gray-600">You haven't recorded any dreams yet. <a href="/dream/new" class="text-blue-600 hover:underline">Start a new dream!</a></p>
  {:else}
    <ul class="space-y-4">
      {#each data.dreams as dream (dream.id)}
        <li class="bg-white p-6 rounded-lg shadow-md border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center">
          <div class="flex-grow mb-4 md:mb-0">
            <h2 class="text-xl font-semibold text-gray-800 mb-2">
              {new Date(dream.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </h2>
            <p class="text-gray-600 line-clamp-2 mb-2">
              {dream.raw_text}
            </p>
            <div class="flex flex-wrap gap-2">
              {#if dream.tags && dream.tags.length > 0}
                {#each dream.tags as tag}
                  <span class="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                    {tag}
                  </span>
                {/each}
              {:else if dream.status === 'pending_analysis'}
                <span class="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                  Analyzing...
                </span>
              {:else if dream.status === 'analysis_failed'}
                <span class="px-2 py-0.5 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                  Analysis Failed
                </span>
              {:else}
                <span class="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                  No Tags
                </span>
              {/if}
            </div>
          </div>
          <div class="flex space-x-2">
            <button
              on:click={() => viewDream(dream.id)}
              class="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-200"
              aria-label="View dream details"
            >
              View
            </button>
            <button
              on:click={() => editDream(dream.id)}
              class="px-3 py-1 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors duration-200"
              aria-label="Edit dream"
            >
              Edit
            </button>
            <form method="POST" action={`/dreams/${dream.id}?/regenerate`} use:enhance={regenerateDream}>
              <button
                type="submit"
                class="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors duration-200"
                aria-label="Regenerate analysis"
              >
                Regenerate
              </button>
            </form>
            <button
              on:click={() => deleteDream(dream.id)}
              class="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors duration-200"
              aria-label="Delete dream"
            >
              Delete
            </button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>
