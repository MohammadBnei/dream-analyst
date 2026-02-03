# Dream Analyst App

Welcome to the Dream Analyst App! This SvelteKit application is designed to help users capture, analyze, and understand their dreams using advanced AI.

## What is Dream Analyst?

Dream Analyst is a powerful tool for dream journaling and interpretation. It leverages an LLM (Large Language Model) to provide various interpretations and extract symbolic tags from your dream entries. Our goal is to provide a seamless experience for users to record their dreams and gain insights into their subconscious.

### Key Features:

*   **Dream Capture:** Easily record your dreams via text entry or voice-to-text (using the Web Speech API).
*   **Advanced Dream Analysis:** After saving, our AI provides a detailed reading and extracts a comma-separated list of symbolic tags. You can choose from different analysis types:
    *   **Jungian:** Focuses on archetypes, shadow, anima/animus, and collective unconscious.
    *   **Freudian:** Interprets dreams based on repressed desires and unconscious conflicts.
    *   **Simple:** Provides a straightforward, easy-to-understand interpretation.
    *   **Islamic:** Offers interpretations based on Islamic dream interpretation traditions.
*   **Interactive AI Chat:** Engage in a conversation with the AI analyst to delve deeper into your dream's meaning, ask follow-up questions, and gain further insights beyond the initial analysis.
*   **Secure Vault:** All your dreams are securely stored in a personal library, indexed by date, ensuring you can always revisit them.
*   **Credit System:** To ensure fair usage and manage resources, the application incorporates a credit system for AI analysis and chat interactions. Users will have a limited number of daily credits for these features.
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
