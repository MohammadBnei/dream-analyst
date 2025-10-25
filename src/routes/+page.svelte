<script>
  let { data } = $props();
</script>

{#if data.user}
  <!-- Logged-in user: Show hero with link to new dream -->
  <div class="hero min-h-screen bg-base-200">
    <div class="hero-content text-center">
      <div class="max-w-md">
        <h1 class="text-5xl font-bold">Unlock Your Dreams</h1>
        <p class="py-6">
          Dive deep into the subconscious with Dream Analyst. Record your dreams,
          and let our Generative AI provide insightful interpretations, helping
          you understand yourself better.
        </p>
        <a href="/dream/new" class="btn btn-primary">Write Your First Dream</a>
      </div>
    </div>
  </div>
{:else}
  <!-- Not logged in: Prompt to authenticate -->
  <div class="hero min-h-screen bg-base-200">
    <div class="hero-content text-center">
      <div class="max-w-md">
        <h1 class="text-5xl font-bold">Welcome to Dream Analyst</h1>
        <p class="py-6">
          Start your journey into self-discovery. Log in or register to begin journaling your dreams and unlocking AI-powered insights.
        </p>
        <div class="flex gap-4 justify-center">
          <a href="/login" class="btn btn-primary">Login</a>
          <a href="/register" class="btn btn-outline">Register</a>
        </div>
      </div>
    </div>
  </div>
{/if}
