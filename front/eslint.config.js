import prettier from 'eslint-config-prettier';
import { fileURLToPath } from 'node:url';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		}
	},
	{
		// TEMPORARY, and scoped to exactly one file.
		//
		// src/routes/dreams/[id]/+page.server.ts is 755 lines holding 12 form actions,
		// each repeating the same auth + ownership + error-mapping boilerplate. Its 21
		// `any` uses are almost all `catch (e: any)` in that repeated block. The file is
		// scheduled to be rewritten down to ~200 lines once the shared guards and
		// validation schemas exist, which removes those catch blocks wholesale.
		//
		// Typing them individually now would be work thrown away by that rewrite, so the
		// rule is relaxed HERE ONLY - it stays an error everywhere else in the project.
		//
		// DELETE THIS BLOCK when that file is refactored.
		files: ['src/routes/dreams/\\[id\\]/+page.server.ts'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off'
		}
	}
);
