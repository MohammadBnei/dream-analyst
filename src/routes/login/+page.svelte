<script>
  import { enhance } from '$app/forms';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation'; // Add this import

  let email = '';
  let password = '';
  let isSubmitting = false;

  // Handle form submission
  function handleSubmit() {
    isSubmitting = true;
  }

  // Handle success/failure from server action
  $: if ($page.form) {
    isSubmitting = false;
    if ($page.form.success) {
      goto('/'); // Redirect on success
    }
  }
</script>

<div class="hero min-h-screen bg-base-200">
  <div class="hero-content flex-col lg:flex-row-reverse">
    <div class="text-center lg:text-left">
      <h1 class="text-5xl font-bold">Login to Dream Analyst</h1>
      <p class="py-6">
        Access your personal dream journal and unlock AI-powered insights.
      </p>
    </div>
    <div class="card flex-shrink-0 w-full max-w-sm shadow-2xl bg-base-100">
      <form method="POST" action="?/login" use:enhance={handleSubmit} class="card-body">
        <div class="form-control">
          <label class="label">
            <span class="label-text">Email</span>
          </label>
          <input
            type="email"
            bind:value={email}
            placeholder="email@example.com"
            class="input input-bordered"
            required
          />
        </div>
        <div class="form-control">
          <label class="label">
            <span class="label-text">Password</span>
          </label>
          <input
            type="password"
            bind:value={password}
            placeholder="password"
            class="input input-bordered"
            required
          />
        </div>
        {#if $page.form?.message}
          <div class="alert alert-error">
            <span>{$page.form.message}</span>
          </div>
        {/if}
        <div class="form-control mt-6">
          <button type="submit" class="btn btn-primary" disabled={isSubmitting}>
            {#if isSubmitting}
              <span class="loading loading-spinner"></span>
              Logging in...
            {:else}
              Login
            {/if}
          </button>
        </div>
        <div class="text-center mt-4">
          <a href="/register" class="link link-primary">Don't have an account? Register</a>
        </div>
      </form>
    </div>
  </div>
</div>
