<script>
  import { enhance } from '$app/forms';
  import { page } from '$app/stores';

  let username = '';
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
      // Redirect handled by server action
    }
  }
</script>

<div class="hero min-h-screen bg-base-200">
  <div class="hero-content flex-col lg:flex-row-reverse">
    <div class="text-center lg:text-left">
      <h1 class="text-5xl font-bold">Register for Dream Analyst</h1>
      <p class="py-6">
        Create your account to start journaling dreams and exploring your subconscious.
      </p>
    </div>
    <div class="card flex-shrink-0 w-full max-w-sm shadow-2xl bg-base-100">
      <form method="POST" action="?/register" use:enhance={handleSubmit} class="card-body">
        <div class="form-control">
          <label class="label">
            <span class="label-text">Username</span>
          </label>
          <input
            type="text"
            bind:value={username}
            placeholder="username"
            class="input input-bordered"
            required
          />
        </div>
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
            placeholder="password (min 6 characters)"
            class="input input-bordered"
            required
            minlength="6"
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
              Registering...
            {:else}
              Register
            {/if}
          </button>
        </div>
        <div class="text-center mt-4">
          <a href="/login" class="link link-primary">Already have an account? Login</a>
        </div>
      </form>
    </div>
  </div>
</div>
