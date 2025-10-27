<script lang="ts">
  import type { ActionData } from './$types';
  import * as m from '../../paraglide/messages';

  export let form: ActionData;
</script>

<div class="hero min-h-screen bg-base-200">
  <div class="hero-content flex-col lg:flex-row-reverse">
    <div class="text-center lg:text-left">
      <h1 class="text-5xl font-bold">{m.register_title()}</h1>
      <p class="py-6">
        {m.register_subtitle()}
      </p>
    </div>
    <div class="card shrink-0 w-full max-w-sm shadow-2xl bg-base-100">
      <form method="POST" class="card-body">
        <div class="form-control">
          <label class="label" for="username">
            <span class="label-text">{m.username_label()}</span>
          </label>
          <input
            type="text"
            placeholder={m.username_label().toLowerCase()}
            class="input input-bordered"
            name="username"
            id="username"
            value={form?.username ?? ''}
            required
          />
        </div>
        <div class="form-control">
          <label class="label" for="password">
            <span class="label-text">{m.password_label()}</span>
          </label>
          <input
            type="password"
            placeholder={m.password_label().toLowerCase()}
            class="input input-bordered"
            name="password"
            id="password"
            required
          />
          <label class="label">
            <a href="/login" class="label-text-alt link link-hover">{m.have_account_link()}</a>
          </label>
        </div>
        {#if form?.message}
          <div role="alert" class="alert alert-error mt-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              /></svg
            >
            <span>{form.message}</span>
          </div>
        {/if}
        <div class="form-control mt-6">
          <button type="submit" class="btn btn-primary">{m.register_button()}</button>
        </div>
      </form>
    </div>
  </div>
</div>
