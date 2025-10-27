# Changelog

## [0.1.3](https://github.com/vercel/examples/compare/0.1.2...0.1.3) (2025-10-27)

## [0.1.2](https://github.com/vercel/examples/compare/0.1.1...0.1.2) (2025-10-26)

## [0.1.1](https://github.com/vercel/examples/compare/0.1.0...0.1.1) (2025-10-26)

# 0.1.0 (2025-10-26)


### Bug Fixes

* Enforce authentication for dream-related routes and actions ([92b7ca0](https://github.com/vercel/examples/commit/92b7ca0891fd1d652cf2f336737325fdfa8496f1))
* Ensure dream list updates after deletion by handling confirmation ([ea89398](https://github.com/vercel/examples/commit/ea893988d7058c698b359be1c5688b5bfd331bb4))
* Handle client-side redirects for auth forms to prevent console errors ([7067b31](https://github.com/vercel/examples/commit/7067b31ee4dc52072fee68a272557cbb1f6b8962))
* Redirect to home page after logout ([08652c8](https://github.com/vercel/examples/commit/08652c8c9c3d03cf084f1bb00ebcaf1a26fe007f))
* Remove database connection close after migrations ([b2d39bd](https://github.com/vercel/examples/commit/b2d39bd53c4a82fc164dce515a6a2253b875aff9))
* Remove optional chaining from children render in layout ([b4d1b93](https://github.com/vercel/examples/commit/b4d1b937f3df31bec8d0b21d2e88739383674ae7))
* Remove speech recognition from new dream entry page ([fc84d3b](https://github.com/vercel/examples/commit/fc84d3b82b91d148cc02c42284fb80f63c4bbd22))
* Rename SvelteKit form actions to avoid reserved 'default' name ([19fe051](https://github.com/vercel/examples/commit/19fe0517eeb06f4be9e70fc10973339c51e31178))
* Verify JWT and set `locals.user` in `hooks.server.ts` ([e169fcf](https://github.com/vercel/examples/commit/e169fcfcd42389e7c147c3fa4fd52de582149852))


### Features

* add database connection utility ([074b676](https://github.com/vercel/examples/commit/074b6764bdbd9e3ca9a8cb7cf3ddfa6e6a94589e))
* add database migration script ([85de6df](https://github.com/vercel/examples/commit/85de6df99c0c55ff39c496218bbd9d6c7aab169f))
* add hooks.server.ts for migrations and logout page.server.ts ([263fd45](https://github.com/vercel/examples/commit/263fd458dbc5f2c4e972aef349a5d2f3cc732e75))
* Add initial PostgreSQL schema for dreams table ([c13f559](https://github.com/vercel/examples/commit/c13f55926edcbde7fad3ea147b0f2c5670b34f43))
* Add login and register SvelteKit pages with DaisyUI forms ([061e07b](https://github.com/vercel/examples/commit/061e07b772d44e41c7e820e2781303ae24a44e4b))
* Add name attributes to input fields in register form ([0ae3956](https://github.com/vercel/examples/commit/0ae395686acce7b41e1d95dd94e70cc316cf15ca))
* Add regenerate action for dream analysis ([91518e3](https://github.com/vercel/examples/commit/91518e31e72d62acd8c3a5a430c0348370b83755))
* Add regenerate analysis buttons to dream list and detail pages ([5aecf49](https://github.com/vercel/examples/commit/5aecf49cf07b6e9d7f5eb17cd81c0af6b83cc630))
* Add status column to dreams table ([5ed909e](https://github.com/vercel/examples/commit/5ed909e6044251faa12a626ac751a6da624e024b))
* Add tags and interpretation columns to dreams table ([dfa8839](https://github.com/vercel/examples/commit/dfa883989705b52f50a991b2ca33c11eff3d94af))
* create users table with username, email, password, and timestamps ([c1ecf3e](https://github.com/vercel/examples/commit/c1ecf3e7b23786d4271d336d97a45686a1fcd2da))
* implement authentication helpers and user registration logic ([ac3e454](https://github.com/vercel/examples/commit/ac3e4540855039879bce2a39ccdd5c46ab0d46d8))
* Implement conditional rendering and navigation for authenticated users ([b43fe32](https://github.com/vercel/examples/commit/b43fe3227254e2550f8b06002dcd5cccfe0cd51e))
* Implement core dream workflow with new dream entry, listing, and API endpoints ([53a4a47](https://github.com/vercel/examples/commit/53a4a473e7c224382d59a87b42bd9307317305ec))
* Implement dream deletion from list page ([f5e4eaa](https://github.com/vercel/examples/commit/f5e4eaa1965dbd1fceef5191f6d63aba0dd26b0a))
* Implement dream details page with view, edit, and delete functionality ([ee09c27](https://github.com/vercel/examples/commit/ee09c27e86874153a0d0184d11de01df774ad568))
* Implement synchronous dream analysis via n8n webhook ([67723ee](https://github.com/vercel/examples/commit/67723eea853e34dcae8c2d52ff7d0cf58f01bf7e))
* Implement TypeScript-based database migration for dreams table ([3651550](https://github.com/vercel/examples/commit/3651550ff80ab4c77da1a1a867cb0631f75a8698))
* implement user login logic and JWT cookie handling ([fbf00b3](https://github.com/vercel/examples/commit/fbf00b37ef2217877747d1c1d73d2a1e109bb3d3))
* Pass authenticated user from `locals` to layout ([3b5a49a](https://github.com/vercel/examples/commit/3b5a49a6cf8463d7b608545a0fe32bf90fab2fef))
* Render dream interpretation as markdown ([be88044](https://github.com/vercel/examples/commit/be88044f1a45aeeb847e069efb7c1130b1fdbad4))
* Run database migrations on application startup ([3da4ef9](https://github.com/vercel/examples/commit/3da4ef9ae4c4e29758f6144ab999df44d93a22c6))
* Simplify homepage to static content and remove data fetching ([fec1e1f](https://github.com/vercel/examples/commit/fec1e1f6627c86d4daf361050e6646a9145bd76d))
