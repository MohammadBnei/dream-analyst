/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{html,js,svelte,ts}',
    './node_modules/svelte-streamdown/**/*.{html,js,svelte,ts}' // Add svelte-streamdown for Tailwind JIT
  ],
  theme: {
    extend: {},
  },
  daisyui: {
    themes: ["light", "dark"],
  },
}
