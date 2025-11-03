# Dream Analyst App

Welcome to the Dream Analyst App! This SvelteKit application is designed to help users capture, analyze, and understand their dreams using advanced AI.

## What is Dream Analyst?

Dream Analyst is a powerful tool for dream journaling and interpretation. It leverages an LLM (Large Language Model) to provide Jungian interpretations and extract symbolic tags from your dream entries. Our goal is to provide a seamless experience for users to record their dreams and gain insights into their subconscious.

### Key Features:

*   **Dream Capture:** Easily record your dreams via text entry or voice-to-text (using the Web Speech API).
*   **Automatic Jungian Analysis:** After saving, our AI provides a 150-200 word Jungian reading (archetypes, shadow, anima/animus, etc.) and extracts a comma-separated list of symbolic tags.
*   **Secure Vault:** All your dreams are securely stored in a personal library, indexed by date, ensuring you can always revisit them.
*   **Tag Management:** Dreams display their tags as clickable chips. Future features will include redundancy highlighting and progression scoring for tags.
*   **User-Data View:** A chronological list of your dreams with detailed views, search, and filter capabilities.
*   **Visualisation & Progress Tracking:** Future enhancements will include timelines, heatmaps, and reports to visualize dream patterns and progress over time.

## Getting Started

This project is built with SvelteKit.

### Development

Once you've cloned the repository and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

### Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
