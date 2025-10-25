<script>
  import '../app.css';
  let { children, data } = $props();
</script>

<div class="min-h-screen bg-base-100">
  {#if data.user}
    <nav class="navbar bg-base-200 shadow-md">
      <div class="navbar-start">
        <a href="/" class="btn btn-ghost text-xl font-bold">Dream Journal</a>
      </div>
      <div class="navbar-center">
        <a href="/dreams" class="btn btn-ghost">My Dreams</a>
        <a href="/dream/new" class="btn btn-ghost">New Dream</a>
      </div>
      <div class="navbar-end">
        <form method="POST" action="/logout">
          <button class="btn btn-outline btn-sm">Logout</button>
        </form>
      </div>
    </nav>
  {/if}

  <main class="container mx-auto p-4">
    {@render children()}
  </main>
</div>
