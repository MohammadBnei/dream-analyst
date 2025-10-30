/** @type {import('tailwindcss').Config} */
export default {
	content: [
		'./src/**/*.{html,js,svelte,ts}',
		'./node_modules/svelte-streamdown/**/*.{html,js,svelte,ts}' // Add svelte-streamdown for Tailwind JIT
	],
	theme: {
		extend: {}
	},
	daisyui: {
		themes: ['light', 'dark'] // Ensure light and dark themes are enabled
		// You can also specify a default theme and a theme for prefers-color-scheme: dark
		// For example:
		// themes: [
		//   {
		//     light: { ...require("daisyui/src/theming/themes")["[data-theme=light]"] },
		//   },
		//   {
		//     dark: { ...require("daisyui/src/theming/themes")["[data-theme=dark]"] },
		//   },
		// ],
	}
};
