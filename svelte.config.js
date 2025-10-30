import adapter from 'svelte-adapter-bun';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: [vitePreprocess()],
	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter({
            // Configuration options
            out: 'build',           // Output directory
            precompress: true       // Enable pre-compressed files
        }),
		experimental: {
			remoteFunctions: true
		},
		csrf: {
			checkOrigin: false,
			trustedOrigins: ['http://localhost:5173', 'https://dreamer.bnei.dev']
		}
	},
	extensions: ['.svelte'],
	experimental: {
		async: true
	},
	build: {
		rollupOptions: {
			external: ['@sveltejs/kit/*']
		}
  },
};

export default config;
