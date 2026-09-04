/**
 * Fails the image build when the server bundle imports a package the image does
 * not contain.
 *
 * `svelte-streamdown` sat in devDependencies while two shipped components
 * imported it. SvelteKit bundles a Svelte library's own components into the SSR
 * output, so the build and every test passed - but its plain-JS dependencies
 * (@floating-ui/dom, marked, tailwind-merge) stayed external, and pruning dev
 * dependencies removed them. Every dream page 500ed in production while
 * /login, /healthz and /readyz stayed green, because those routes import none
 * of it.
 *
 * Runs in the runner stage, where the built output and the pruned node_modules
 * finally sit side by side - the only place the mismatch is visible.
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isBuiltin } from 'node:module';

const SERVER_DIR = 'build/server';
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;
// A package specifier, optionally scoped, optionally with a subpath. Anything
// else matched by the regex above is a string literal that merely looks like an
// import, so it is not a missing dependency.
const SPECIFIER = /^(?:@[a-z0-9-~][\w.-]*\/)?[a-z0-9-~][\w.-]*(?:\/[\w.-]+)*$/;

function* files(dir: string): Generator<string> {
	for (const entry of readdirSync(dir)) {
		const p = join(dir, entry);
		if (statSync(p).isDirectory()) yield* files(p);
		else if (p.endsWith('.js')) yield p;
	}
}

const missing = new Map<string, string>();
const seen = new Set<string>();

for (const file of files(SERVER_DIR)) {
	// Block comments are stripped first: the bundle carries JSDoc like
	// `@param {import('types')}`, which the regex below would otherwise report as
	// a missing package called "types".
	const source = (await Bun.file(file).text()).replace(/\/\*[\s\S]*?\*\//g, '');
	for (const [, spec] of source.matchAll(IMPORT)) {
		// Relative paths, SvelteKit virtual modules, and a dependency's own
		// internal import map ("#client") are not packages to install.
		if (spec.startsWith('.') || spec.startsWith('$') || spec.startsWith('#')) continue;
		if (isBuiltin(spec) || seen.has(spec) || !SPECIFIER.test(spec)) continue;
		seen.add(spec);
		try {
			Bun.resolveSync(spec, process.cwd());
		} catch {
			missing.set(spec, file);
		}
	}
}

if (missing.size > 0) {
	console.error(`\n${missing.size} package(s) imported by the server bundle are not installed:\n`);
	for (const [spec, file] of missing) console.error(`  ${spec}\n      imported by ${file}`);
	console.error(
		'\nMove the package that owns them from devDependencies to dependencies.' +
			'\nA Svelte library is a runtime dependency whenever a shipped component imports it.\n'
	);
	process.exit(1);
}

console.log(`check-runtime-deps: ${seen.size} external imports, all resolvable.`);
