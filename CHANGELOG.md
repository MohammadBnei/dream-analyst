# Changelog

## [0.9.2](https://github.com/MohammadBnei/dream-analyst/compare/0.9.1...0.9.2) (2025-10-30)

## [0.9.1](https://github.com/MohammadBnei/dream-analyst/compare/0.9.0...0.9.1) (2025-10-30)


### Bug Fixes

* Remove @prisma/client reference from client-side Svelte component ([7abc651](https://github.com/MohammadBnei/dream-analyst/commit/7abc651608d7bac8b1b235cbd13fe2cbc9690713))

# [0.9.0](https://github.com/MohammadBnei/dream-analyst/compare/0.8.0...0.9.0) (2025-10-30)


### Bug Fixes

* Auto-start analysis stream after resetting analysis using use:enhance ([53d3327](https://github.com/MohammadBnei/dream-analyst/commit/53d3327dc02b24940ccb2fc6da8723d054b08f00))
* Change currentDreamStatus to be stateful ([a277b48](https://github.com/MohammadBnei/dream-analyst/commit/a277b48960bd6a81a4bcf6781423f7ec97d6e1a2))
* Clear Redis stream state immediately upon cancellation ([790e294](https://github.com/MohammadBnei/dream-analyst/commit/790e294bc3565261905829ef7d2a19f92468c515))
* Correct Redis client status check from 'connected' to 'connect' ([679453d](https://github.com/MohammadBnei/dream-analyst/commit/679453dbe37b1c91bec90f528058142ba4ab158f))
* Correctly cancel stream on dream page by removing redundant dreamId in fetch ([00fd313](https://github.com/MohammadBnei/dream-analyst/commit/00fd31360a8e04f4142bb4da71314c1432b49894))
* Ensure cancel analysis button appears by correctly managing isLoadingStream ([25c0720](https://github.com/MohammadBnei/dream-analyst/commit/25c07208c4f7c7457f1cfb0f36e1c8a65e0642b7))
* Ensure cancel analysis form is always in DOM ([db8ebc1](https://github.com/MohammadBnei/dream-analyst/commit/db8ebc1e66a1c3d71371fbb0b9357e04d879f966))
* Ensure dream status is updated to COMPLETED or FAILED at stream end ([728a33e](https://github.com/MohammadBnei/dream-analyst/commit/728a33ec72e67efddb0c3eb2e6278c710e889be6))
* Ensure n8nService WritableStream respects abort signal during write ([7981b31](https://github.com/MohammadBnei/dream-analyst/commit/7981b316bff8638a007a5b2870624ffc5ee3680e))
* Handle Redis subscriber disconnect and expected cancellation errors ([67cb955](https://github.com/MohammadBnei/dream-analyst/commit/67cb95539db04cba351e80d663d57c04c2add211))
* Handle unhandled promise rejection in streamProcessor.ts ([c0889e8](https://github.com/MohammadBnei/dream-analyst/commit/c0889e84531e549c01d7361abb0dbd45a3630371))
* Hide cancel analysis button and fix delete dream button ([5ba4d24](https://github.com/MohammadBnei/dream-analyst/commit/5ba4d2435eb7d00099171c69386f85b663e0bd1a))
* Implement AbortSignal for robust stream cancellation in n8nService and StreamProcessor ([4618f39](https://github.com/MohammadBnei/dream-analyst/commit/4618f39ae310bb44ccba45cec33ef4e8414c39d3))
* Improve stream analysis cancellation, completion, and state management ([dc77f96](https://github.com/MohammadBnei/dream-analyst/commit/dc77f963f1baff64ea00ded153218763b96acf4b))
* Prevent double-closing ReadableStream controller on client disconnect ([9e611a5](https://github.com/MohammadBnei/dream-analyst/commit/9e611a52144b14b32b4072666b060442ce7c4d5a))
* Prevent infinite loop in Svelte effect by checking updatedAt timestamp ([2eb1bac](https://github.com/MohammadBnei/dream-analyst/commit/2eb1bac515ca95dd804cfc5d5a456d1c8b063c83))
* Send empty FormData for cancelAnalysis POST request to prevent 415 error ([0cc2248](https://github.com/MohammadBnei/dream-analyst/commit/0cc22489de926b8fc40d4089f80038fe9befa7ba))
* Standardize event handling to `onclick` in dream details page ([818a32f](https://github.com/MohammadBnei/dream-analyst/commit/818a32f8ef7a36a7a59fc9107d4c042a8d0499eb))
* Update cancel analysis endpoint to use stream state store and new status ([ed4e6ea](https://github.com/MohammadBnei/dream-analyst/commit/ed4e6eae6cfc09aa534e69237d4587f650a49032))
* Use `$derived` for `currentDreamStatus` to ensure reactivity ([8057c95](https://github.com/MohammadBnei/dream-analyst/commit/8057c95da6637ecd37d783324ecf303c960dbf5b))
* Use $props() for component props in runes mode ([0f783bf](https://github.com/MohammadBnei/dream-analyst/commit/0f783bf3bb8d4a98c91bd1e4a9c6aeeebc699e19))


### Features

* Add cancel analysis button translation ([fe44b72](https://github.com/MohammadBnei/dream-analyst/commit/fe44b725e17e116b5ac55b1b3dfb846cd15ad768))
* Add cancel interpretation stream on dream page ([d5ff0ab](https://github.com/MohammadBnei/dream-analyst/commit/d5ff0ab1071f2a708a9c9bf7a2f7e0c4ea6e6c3a))
* Implement AnalysisStreamManager and refactor analysis store and stream endpoint ([06fe519](https://github.com/MohammadBnei/dream-analyst/commit/06fe519eb8ffaae9d15ce9970b5499a4f204e21a))
* Implement dream listing and cancellation functionality ([a1b765c](https://github.com/MohammadBnei/dream-analyst/commit/a1b765c04f47c54eb121545313fd66c1dd7bc16b))
* Implement stream cancellation from client to server processor ([a0c8617](https://github.com/MohammadBnei/dream-analyst/commit/a0c8617dd16735f1405b7c02e7554bc7d93bbe4b))
* Migrate dream fetching to SvelteKit load function ([154a3b1](https://github.com/MohammadBnei/dream-analyst/commit/154a3b165d10617ad8abfbbf90ff0605aae588d8))
* migrate dream remote functions to SvelteKit API endpoints ([1dd6ad7](https://github.com/MohammadBnei/dream-analyst/commit/1dd6ad70bee0cc3752c00a36dcd5c203d7f480af))
* refactor dream operations to use SvelteKit form actions ([15fab18](https://github.com/MohammadBnei/dream-analyst/commit/15fab18b9bff2edefee595d26be1c69e3d22b45c))

# [0.8.0](https://github.com/MohammadBnei/dream-analyst/compare/0.7.0...0.8.0) (2025-10-30)


### Features

* Add DailyDreamCount model and link to User ([858f16b](https://github.com/MohammadBnei/dream-analyst/commit/858f16b4ffc392f0381ae1359d291db3bdcea066))
* Add DreamVersion model for interpretation versioning ([d83b3fd](https://github.com/MohammadBnei/dream-analyst/commit/d83b3fd80a73a5f140189d6f1b3a26a2830f211b))

# [0.7.0](https://github.com/MohammadBnei/dream-analyst/compare/0.6.0...0.7.0) (2025-10-29)


### Bug Fixes

* Implement theme switching with localStorage and swap component ([91879c8](https://github.com/MohammadBnei/dream-analyst/commit/91879c8ea8a656c471b4307459808a74f2b8b390))
* Use translations for RichTextInput component messages ([101b12d](https://github.com/MohammadBnei/dream-analyst/commit/101b12dbfb9ded174c2718b62c5b0ee34a3fc120))


### Features

* Add audio input related translations ([c878ceb](https://github.com/MohammadBnei/dream-analyst/commit/c878cebc9ce15ed55866e218d5b1af5b9ad91b87))
* Add light/dark theme switch to navbar and sidebar ([fae5ace](https://github.com/MohammadBnei/dream-analyst/commit/fae5aced86b5dcad78ac39898b0ae1f19c45e155))

# [0.6.0](https://github.com/MohammadBnei/dream-analyst/compare/0.5.0...0.6.0) (2025-10-29)


### Bug Fixes

* Add type="button" to prevent form submission ([196bdf1](https://github.com/MohammadBnei/dream-analyst/commit/196bdf1a23210db41a31a12a3245996fb0c93dc8))
* Change FormData key from 'audio' to 'file' for n8n endpoint ([f1de362](https://github.com/MohammadBnei/dream-analyst/commit/f1de362dac76cbd645d5ed72bf32176e2827b34c))
* Conditionally render button text and icon based on recording state ([c9755a3](https://github.com/MohammadBnei/dream-analyst/commit/c9755a3ae721311c152f5a12c02f3c579a9a7430))
* Correct audio file field name in n8n transcription service ([3d2b34d](https://github.com/MohammadBnei/dream-analyst/commit/3d2b34da2506a22c7207750d3a06ffec4a05ab20))
* Correct await block syntax in dreams page ([8d42060](https://github.com/MohammadBnei/dream-analyst/commit/8d42060e39de441f4908f0c53f9672e60b4d78da))
* Correct Svelte await block syntax for conditional rendering ([b3397c9](https://github.com/MohammadBnei/dream-analyst/commit/b3397c9f177040c36a97a25719469941556cebad))
* Correct Svelte block closing tag from `{F}` to `{/if}` ([25a5958](https://github.com/MohammadBnei/dream-analyst/commit/25a5958f5f68320fbbaae7e1b01c272d33fa0d55))
* Correctly extract transcription text from n8n response ([4256913](https://github.com/MohammadBnei/dream-analyst/commit/4256913f2c99c8cd7d5a0e0042eff418b2c49733))
* Serialize audio data as Uint8Array for remote transcription ([203f62b](https://github.com/MohammadBnei/dream-analyst/commit/203f62bb96333eb6660c6193992d17ed5bca260a))


### Features

* Add audio transcription remote function and rich text input component ([0a89831](https://github.com/MohammadBnei/dream-analyst/commit/0a898314e5a8faa2a257108ae7a5cf7876ddea95))
* Add audio transcription service using N8N_AUDIO_TRANSCRIBE_URL ([2a29a9e](https://github.com/MohammadBnei/dream-analyst/commit/2a29a9efb3919e47eeef799539c064ea7c6dd6ac))
* Allow canceling transcription with the record button ([61f669a](https://github.com/MohammadBnei/dream-analyst/commit/61f669ae1baf22d5e9bc5da934cb1b023b33a01e))
* Allow client-side cancellation of dream analysis ([158a58d](https://github.com/MohammadBnei/dream-analyst/commit/158a58db5dae23ebb14faa8890407c2c81f7dc17))
* Implement audio transcription via API endpoint ([e0feb88](https://github.com/MohammadBnei/dream-analyst/commit/e0feb88bd95f65b8bc17a85381085514f2208ba2))
* Integrate RichTextInput component into new dream page ([ea35649](https://github.com/MohammadBnei/dream-analyst/commit/ea356490705db974742f5c3191c24e6cace0d5db))
* integrate RichTextInput for dream and interpretation editing ([5efc814](https://github.com/MohammadBnei/dream-analyst/commit/5efc814307099eae5878e061602d542410dc760b))
* Set French as default language and improve UI with fieldset ([aecfbaf](https://github.com/MohammadBnei/dream-analyst/commit/aecfbafb09117ed9104b23d3f5a5c3f22e3436d4))

# [0.5.0](https://github.com/MohammadBnei/dream-analyst/compare/0.4.3...0.5.0) (2025-10-29)


### Features

* Add basic authentication to n8n webhook requests ([3952678](https://github.com/MohammadBnei/dream-analyst/commit/395267843d358feef415383372c981b07736bb7d))

## [0.4.3](https://github.com/MohammadBnei/dream-analyst/compare/0.4.2...0.4.3) (2025-10-29)


### Bug Fixes

* Correctly handle async data fetching in Svelte await block ([9b6ea0a](https://github.com/MohammadBnei/dream-analyst/commit/9b6ea0a71bbda22836424a84d21e483f23e83165))
* Remove `enhance` from `createDream` call ([c2fb33e](https://github.com/MohammadBnei/dream-analyst/commit/c2fb33e3298bfb5e9a70e6695acdc44e2919b185))
* Remove unused `resolvedDreams` from await block ([a424df8](https://github.com/MohammadBnei/dream-analyst/commit/a424df8494b2f11ad78737da8b66620330081d4e))

## [0.4.2](https://github.com/MohammadBnei/dream-analyst/compare/0.4.1...0.4.2) (2025-10-29)

## [0.4.1](https://github.com/MohammadBnei/dream-analyst/compare/0.4.0...0.4.1) (2025-10-29)

# [0.4.0](https://github.com/MohammadBnei/dream-analyst/compare/0.3.5...0.4.0) (2025-10-29)


### Features

* Add healthz endpoint ([55511eb](https://github.com/MohammadBnei/dream-analyst/commit/55511eb9eac6fc499e29c564ee74436501aa910f))

## [0.3.5](https://github.com/MohammadBnei/dream-analyst/compare/0.3.4...0.3.5) (2025-10-29)


### Bug Fixes

* Move runtime dependencies from devDependencies to dependencies ([4f09181](https://github.com/MohammadBnei/dream-analyst/commit/4f0918165815bed778be349d1a53cce1d25a326e))
* Remove unused Drizzle dependencies ([44591dd](https://github.com/MohammadBnei/dream-analyst/commit/44591dd5e7a681c104da732ff476887b02f97710))

## [0.3.4](https://github.com/MohammadBnei/dream-analyst/compare/0.3.3...0.3.4) (2025-10-29)

## [0.3.3](https://github.com/MohammadBnei/dream-analyst/compare/0.3.2...0.3.3) (2025-10-29)

## [0.3.2](https://github.com/MohammadBnei/dream-analyst/compare/0.3.1...0.3.2) (2025-10-29)

## [0.3.1](https://github.com/MohammadBnei/dream-analyst/compare/0.3.0...0.3.1) (2025-10-29)

# [0.3.0](https://github.com/MohammadBnei/dream-analyst/compare/0.2.0...0.3.0) (2025-10-29)


### Bug Fixes

* Handle nullish currentDreamStatus in badge display ([752eb0f](https://github.com/MohammadBnei/dream-analyst/commit/752eb0fbcc694af3fddbe2bc67ca2903e9b51828))


### Features

* Add dream editing capabilities ([6cb2cff](https://github.com/MohammadBnei/dream-analyst/commit/6cb2cff94f2ee0924dffe9364303a4a40a84d158))
* Add editing capabilities for dream interpretation ([49164c9](https://github.com/MohammadBnei/dream-analyst/commit/49164c9d6e8398e4c5adeb480eb2da74a20f67ed))
* Add new translation keys for dream editing and saving ([b0b1809](https://github.com/MohammadBnei/dream-analyst/commit/b0b180975e269cc0fa2170ec2c0ef358571356fd))
* migrate dream CRUD to remote functions ([1b30ba1](https://github.com/MohammadBnei/dream-analyst/commit/1b30ba1da9862cb002e524b3bc224df0eb5223f8)), closes [#if](https://github.com/MohammadBnei/dream-analyst/issues/if) [#if](https://github.com/MohammadBnei/dream-analyst/issues/if) [#each](https://github.com/MohammadBnei/dream-analyst/issues/each) [#each](https://github.com/MohammadBnei/dream-analyst/issues/each) [#if](https://github.com/MohammadBnei/dream-analyst/issues/if) [#if](https://github.com/MohammadBnei/dream-analyst/issues/if) [#if](https://github.com/MohammadBnei/dream-analyst/issues/if) [#if](https://github.com/MohammadBnei/dream-analyst/issues/if) [#if](https://github.com/MohammadBnei/dream-analyst/issues/if) [#if](https://github.com/MohammadBnei/dream-analyst/issues/if) [#if](https://github.com/MohammadBnei/dream-analyst/issues/if) [#if](https://github.com/MohammadBnei/dream-analyst/issues/if) [#if](https://github.com/MohammadBnei/dream-analyst/issues/if) [#if](https://github.com/MohammadBnei/dream-analyst/issues/if) [#if](https://github.com/MohammadBnei/dream-analyst/issues/if) [#if](https://github.com/MohammadBnei/dream-analyst/issues/if) [#if](https://github.com/MohammadBnei/dream-analyst/issues/if) [#if](https://github.com/MohammadBnei/dream-analyst/issues/if) [#if](https://github.com/MohammadBnei/dream-analyst/issues/if)

# [0.2.0](https://github.com/MohammadBnei/dream-analyst/compare/0.1.12...0.2.0) (2025-10-29)


### Bug Fixes

* Correctly type PageData to PageServerData ([b117cff](https://github.com/MohammadBnei/dream-analyst/commit/b117cffa263faf36719bf0f1f40b9b7df64a1ee7))
* Ensure stream controller closes correctly on client disconnect or no desired size ([bf6ed7f](https://github.com/MohammadBnei/dream-analyst/commit/bf6ed7fbc01fed5b22b0bf1a9f308709c448c17a))
* Handle client disconnects and save partial analysis results ([7d8dee5](https://github.com/MohammadBnei/dream-analyst/commit/7d8dee573be5ab9260d4de7fdfd8cbc18614cbee))
* Implement stalled analysis detection and recovery using Redis heartbeats ([3c61374](https://github.com/MohammadBnei/dream-analyst/commit/3c613740571563c7e71b6bc44a79941f07a9c5d8))
* Improve n8n service error handling and logging for stream issues ([fc35e2a](https://github.com/MohammadBnei/dream-analyst/commit/fc35e2a26b39425e4dbb035bc1bd075ac13dd615))
* Improve stream error handling and ensure dream status updates on abort ([7a2a6a1](https://github.com/MohammadBnei/dream-analyst/commit/7a2a6a1ae2695d5720d463a65287215dc9e6ab5e))
* Log messages from Redis Pub/Sub and n8n stream for debugging ([d59b9ec](https://github.com/MohammadBnei/dream-analyst/commit/d59b9ec971e730dbddfddd697b9768132aa57906))
* Prevent enqueuing to a closed stream controller ([f0db8f8](https://github.com/MohammadBnei/dream-analyst/commit/f0db8f8c7edbec6573702dfe287085ce1357525f))
* Prevent ReadableStream controller enqueue after close race condition ([68886b3](https://github.com/MohammadBnei/dream-analyst/commit/68886b38aae24cad48078e09f917738bc0889639))
* Prevent stream from closing prematurely when desiredSize is null ([51f0753](https://github.com/MohammadBnei/dream-analyst/commit/51f07539fb0fec9940317f2cfdf6e28542536406))
* Prevent writing to closed stream in dream analysis endpoint ([88beee4](https://github.com/MohammadBnei/dream-analyst/commit/88beee4e7d147aac418c29b6788ef2e92db54f2c))
* Re-add missing translation keys for dream analysis and tags ([6958f7d](https://github.com/MohammadBnei/dream-analyst/commit/6958f7d4ab7ff77508dbe3937136b214b00de6ae))
* Remove console log from streamed dream analysis ([92c33a3](https://github.com/MohammadBnei/dream-analyst/commit/92c33a3f7eea1b42adaa60f1a25d91c948037172))
* Replace client-side polling with Redis Pub/Sub for real-time analysis streaming ([e214142](https://github.com/MohammadBnei/dream-analyst/commit/e214142656667c2349254ac64bf36a137928ab05))
* Revert Redis client to synchronous initialization ([ff5a6db](https://github.com/MohammadBnei/dream-analyst/commit/ff5a6dbf19383cc81c1d99361c41bb4566b49bb2))
* Update dream page state on data invalidation ([022ff58](https://github.com/MohammadBnei/dream-analyst/commit/022ff585958cbefb9568bd46f073288433ef321a))
* Update reset analysis option text ([d82c12d](https://github.com/MohammadBnei/dream-analyst/commit/d82c12db04423fa7dace86c3750c96f849655e90))
* Wrap readable stream in Response object for SvelteKit handler ([20e94de](https://github.com/MohammadBnei/dream-analyst/commit/20e94dea952643d22ac97f151d1ba1aab314234c))


### Features

* Add dream analysis instant message ([477e233](https://github.com/MohammadBnei/dream-analyst/commit/477e2333d24c526fec13b782fa99cf3e003ef15a))
* Add manual dream status update for failed analyses ([39bd75e](https://github.com/MohammadBnei/dream-analyst/commit/39bd75ea9604fec7b0436ae8f1ba4c3c76586833))
* Add Redis service to compose.yml ([de00d24](https://github.com/MohammadBnei/dream-analyst/commit/de00d246d54e2460ebd3b606d75090b3c273e373))
* Add translations for dream status change options ([736e065](https://github.com/MohammadBnei/dream-analyst/commit/736e06525708546528c9b6333d60e4036f6b0f63))
* Auto-start analysis stream on dream page load if pending ([9f6c30e](https://github.com/MohammadBnei/dream-analyst/commit/9f6c30e08d4e940b2afa4afcce2a6a70612cc8fe))
* Configure Prisma for migrations on start and custom client output ([26b9913](https://github.com/MohammadBnei/dream-analyst/commit/26b991389ecc5778b4b2462b19e398a69cadaace))
* create .dockerignore file to exclude unnecessary files from Docker image ([ff51387](https://github.com/MohammadBnei/dream-analyst/commit/ff51387edd69a5e7301d804f972e41ba3345fc02))
* Implement Redis for scalable dream analysis state management ([5ce27ea](https://github.com/MohammadBnei/dream-analyst/commit/5ce27eaa4d6fc145bfb580ea8298bf8568f796b5))
* implement user logout functionality ([14c7e54](https://github.com/MohammadBnei/dream-analyst/commit/14c7e54bb6546967529adab53cfd5cb189b682d7))
* Redirect to dream details after saving new dream ([27d5927](https://github.com/MohammadBnei/dream-analyst/commit/27d5927dd3b28c4b6ceccd3c64fc867e088155bb))

## [0.1.12](https://github.com/MohammadBnei/dream-analyst/compare/0.1.11...0.1.12) (2025-10-27)

## [0.1.11](https://github.com/MohammadBnei/dream-analyst/compare/0.1.10...0.1.11) (2025-10-27)

## [0.1.10](https://github.com/MohammadBnei/dream-analyst/compare/0.1.9...0.1.10) (2025-10-27)

## [0.1.9](https://github.com/MohammadBnei/dream-analyst/compare/0.1.8...0.1.9) (2025-10-27)

## [0.1.8](https://github.com/MohammadBnei/dream-analyst/compare/0.1.7...0.1.8) (2025-10-27)

## [0.1.7](https://github.com/MohammadBnei/dream-analyst/compare/0.1.6...0.1.7) (2025-10-27)

## [0.1.6](https://github.com/MohammadBnei/dream-analyst/compare/0.1.5...0.1.6) (2025-10-27)

## [0.1.5](https://github.com/MohammadBnei/dream-analyst/compare/0.1.4...0.1.5) (2025-10-27)

## [0.1.4](https://github.com/MohammadBnei/dream-analyst/compare/0.1.3...0.1.4) (2025-10-27)

## [0.1.3](https://github.com/MohammadBnei/dream-analyst/compare/0.1.2...0.1.3) (2025-10-27)

## [0.1.2](https://github.com/MohammadBnei/dream-analyst/compare/0.1.1...0.1.2) (2025-10-27)

## [0.1.1](https://github.com/MohammadBnei/dream-analyst/compare/0.1.0...0.1.1) (2025-10-27)

# 0.1.0 (2025-10-27)


### Bug Fixes

* Correct conditional rendering for saving and analyzing states ([0bb54b0](https://github.com/MohammadBnei/dream-analyst/commit/0bb54b0a35a41ccab1d5228b17889403c85ea0e9))
* Correct Svelte slot rendering and close `<a>` tag ([7c15ef0](https://github.com/MohammadBnei/dream-analyst/commit/7c15ef0f528c5b7c490b62fc02e238a870e742df))
* Correct Tailwind CSS imports in app.css ([6bccb08](https://github.com/MohammadBnei/dream-analyst/commit/6bccb084e72ceac7c66877a4081d3b5102af2ece))
* Correctly display streamed interpretation content ([44c9d43](https://github.com/MohammadBnei/dream-analyst/commit/44c9d4348f0cd9291756ead3bca909635b4b3eec))
* Enforce authentication for dream-related routes and actions ([92b7ca0](https://github.com/MohammadBnei/dream-analyst/commit/92b7ca0891fd1d652cf2f336737325fdfa8496f1))
* Ensure dream list updates after deletion by handling confirmation ([ea89398](https://github.com/MohammadBnei/dream-analyst/commit/ea893988d7058c698b359be1c5688b5bfd331bb4))
* Ensure interpretation displays correctly with Svelte 5 runes and Streamdown ([3bb3a56](https://github.com/MohammadBnei/dream-analyst/commit/3bb3a56c23d0d4db5b2bf66004869555e4ab693d))
* Handle client-side redirects for auth forms to prevent console errors ([7067b31](https://github.com/MohammadBnei/dream-analyst/commit/7067b31ee4dc52072fee68a272557cbb1f6b8962))
* Improve error handling and logging in stream analysis endpoint ([d85e1aa](https://github.com/MohammadBnei/dream-analyst/commit/d85e1aa8e0143f2dce34da0a5402678d73c9dfa0))
* Improve error handling in WritableStream write method ([3100571](https://github.com/MohammadBnei/dream-analyst/commit/3100571c3c95114344b09840eb4dd4c29f8b4fd6))
* Improve N8N stream parsing with robust JSON buffering ([7c0281d](https://github.com/MohammadBnei/dream-analyst/commit/7c0281de5eec12e8bc3b30e923a70db15caeb1b5))
* Redirect to home page after logout ([08652c8](https://github.com/MohammadBnei/dream-analyst/commit/08652c8c9c3d03cf084f1bb00ebcaf1a26fe007f))
* Remove database connection close after migrations ([b2d39bd](https://github.com/MohammadBnei/dream-analyst/commit/b2d39bd53c4a82fc164dce515a6a2253b875aff9))
* Remove email from App.Locals.user in app.d.ts ([7a32a82](https://github.com/MohammadBnei/dream-analyst/commit/7a32a8287b7877b6da482cd91c0cb7f082f2c00a))
* Remove optional chaining from children render in layout ([b4d1b93](https://github.com/MohammadBnei/dream-analyst/commit/b4d1b937f3df31bec8d0b21d2e88739383674ae7))
* Remove speech recognition from new dream entry page ([fc84d3b](https://github.com/MohammadBnei/dream-analyst/commit/fc84d3b82b91d148cc02c42284fb80f63c4bbd22))
* Remove tags from n8n stream and client-side display ([9d493e0](https://github.com/MohammadBnei/dream-analyst/commit/9d493e055e1ba645e7140cc403b5229697d39a26))
* Rename SvelteKit form actions to avoid reserved 'default' name ([19fe051](https://github.com/MohammadBnei/dream-analyst/commit/19fe0517eeb06f4be9e70fc10973339c51e31178))
* Replace reactive statement with $derived in layout ([dda379b](https://github.com/MohammadBnei/dream-analyst/commit/dda379bd60dc5e3faaf39c0f4a3ec2ebac10a051))
* Safely access error messages in stream processing catch blocks ([ad4074a](https://github.com/MohammadBnei/dream-analyst/commit/ad4074a2b8c5fcc02cadd0f2f6289c2e1069f835))
* Update login field label to "Username or Email" ([b7f6baf](https://github.com/MohammadBnei/dream-analyst/commit/b7f6baf820430a320cb9f0dcf18aaccd466ff849))
* Verify JWT and set `locals.user` in `hooks.server.ts` ([e169fcf](https://github.com/MohammadBnei/dream-analyst/commit/e169fcfcd42389e7c147c3fa4fd52de582149852))


### Features

* Add "New Dream" button to dreams page header ([e0ee734](https://github.com/MohammadBnei/dream-analyst/commit/e0ee73438c01eff1b58372149fb0f693d793227c))
* add database connection utility ([074b676](https://github.com/MohammadBnei/dream-analyst/commit/074b6764bdbd9e3ca9a8cb7cf3ddfa6e6a94589e))
* add database migration script ([85de6df](https://github.com/MohammadBnei/dream-analyst/commit/85de6df99c0c55ff39c496218bbd9d6c7aab169f))
* add delete dream functionality with confirmation modal ([5c8481a](https://github.com/MohammadBnei/dream-analyst/commit/5c8481af161eb1d2ad2c0ef82237c608c6d3341e))
* Add dream details page ([5661478](https://github.com/MohammadBnei/dream-analyst/commit/5661478660ee8ade8708d289d893b9ec4c1b911d))
* Add dreams listing page ([8aea727](https://github.com/MohammadBnei/dream-analyst/commit/8aea72782a352f7fcbb7553acb84c19477459884))
* Add email field to user schema, payload, and registration ([ca5744c](https://github.com/MohammadBnei/dream-analyst/commit/ca5744cd31d2508157771f07abe118b4e804ca1d))
* add hooks.server.ts for migrations and logout page.server.ts ([263fd45](https://github.com/MohammadBnei/dream-analyst/commit/263fd458dbc5f2c4e972aef349a5d2f3cc732e75))
* Add i18n to dream list and dream detail pages ([0ad52a4](https://github.com/MohammadBnei/dream-analyst/commit/0ad52a4479d167fc36ea030594b459f8da216da9))
* Add i18n to login and registration pages ([6847a08](https://github.com/MohammadBnei/dream-analyst/commit/6847a08cc8c4644d637a41e3ed7829b936cda0ad))
* Add i18n to new dream page and update message files ([0a56712](https://github.com/MohammadBnei/dream-analyst/commit/0a56712bbfebdc92ab6577c96066d9284e59e5dd))
* Add initial PostgreSQL schema for dreams table ([c13f559](https://github.com/MohammadBnei/dream-analyst/commit/c13f55926edcbde7fad3ea147b0f2c5670b34f43))
* Add login and register pages with DaisyUI components ([c1c9973](https://github.com/MohammadBnei/dream-analyst/commit/c1c99731311f809c29b7919b4a9bcdc17556df07))
* Add login and register SvelteKit pages with DaisyUI forms ([061e07b](https://github.com/MohammadBnei/dream-analyst/commit/061e07b772d44e41c7e820e2781303ae24a44e4b))
* Add login route with user authentication and token generation ([dc77c52](https://github.com/MohammadBnei/dream-analyst/commit/dc77c52949396ea75d47e85e9a58e2a82b890aad))
* Add name attributes to input fields in register form ([0ae3956](https://github.com/MohammadBnei/dream-analyst/commit/0ae395686acce7b41e1d95dd94e70cc316cf15ca))
* Add password confirmation field to registration form ([422d4ba](https://github.com/MohammadBnei/dream-analyst/commit/422d4ba824a7ea66867aaf31772c0f9e5348014f))
* Add password confirmation label to i18n files ([86e1a27](https://github.com/MohammadBnei/dream-analyst/commit/86e1a27e365cd90081eafaee47bf762243e89f05))
* Add regenerate action for dream analysis ([91518e3](https://github.com/MohammadBnei/dream-analyst/commit/91518e31e72d62acd8c3a5a430c0348370b83755))
* Add regenerate analysis button to dream page ([bed9782](https://github.com/MohammadBnei/dream-analyst/commit/bed9782adb08aaad25cfb77543402af4c95d13f3))
* Add regenerate analysis buttons to dream list and detail pages ([5aecf49](https://github.com/MohammadBnei/dream-analyst/commit/5aecf49cf07b6e9d7f5eb17cd81c0af6b83cc630))
* Add status column to dreams table ([5ed909e](https://github.com/MohammadBnei/dream-analyst/commit/5ed909e6044251faa12a626ac751a6da624e024b))
* Add tags and interpretation columns to dreams table ([dfa8839](https://github.com/MohammadBnei/dream-analyst/commit/dfa883989705b52f50a991b2ca33c11eff3d94af))
* Allow login with username or email and case-insensitive search ([48bdb82](https://github.com/MohammadBnei/dream-analyst/commit/48bdb82d54a831740dd2d9a2d524e6621c59f3a8))
* create users table with username, email, password, and timestamps ([c1ecf3e](https://github.com/MohammadBnei/dream-analyst/commit/c1ecf3e7b23786d4271d336d97a45686a1fcd2da))
* implement authentication helpers and user registration logic ([ac3e454](https://github.com/MohammadBnei/dream-analyst/commit/ac3e4540855039879bce2a39ccdd5c46ab0d46d8))
* Implement conditional rendering and navigation for authenticated users ([b43fe32](https://github.com/MohammadBnei/dream-analyst/commit/b43fe3227254e2550f8b06002dcd5cccfe0cd51e))
* Implement core dream workflow with new dream entry, listing, and API endpoints ([53a4a47](https://github.com/MohammadBnei/dream-analyst/commit/53a4a473e7c224382d59a87b42bd9307317305ec))
* Implement dream analysis regeneration flow ([0fb50ff](https://github.com/MohammadBnei/dream-analyst/commit/0fb50ff63791b8f597da8b9ff77589001570fb62))
* Implement dream deletion from list page ([f5e4eaa](https://github.com/MohammadBnei/dream-analyst/commit/f5e4eaa1965dbd1fceef5191f6d63aba0dd26b0a))
* Implement dream details page with view, edit, and delete functionality ([ee09c27](https://github.com/MohammadBnei/dream-analyst/commit/ee09c27e86874153a0d0184d11de01df774ad568))
* Implement dream entry page and n8n integration ([4e84a5f](https://github.com/MohammadBnei/dream-analyst/commit/4e84a5f7855e8c0fba65965a466d6fd802c9b81f))
* implement n8nService and integrate into dream actions ([0e64e8a](https://github.com/MohammadBnei/dream-analyst/commit/0e64e8a7d80187e4624922c7e5a57b6f20d703f1))
* Implement responsive navbar and project explanation on home page ([1dbe697](https://github.com/MohammadBnei/dream-analyst/commit/1dbe697f1e5f0df0e9c445e8aa135da8055db2b4))
* Implement streamed dream analysis endpoint with SSE ([7709ad6](https://github.com/MohammadBnei/dream-analyst/commit/7709ad67a24da3885f8358a8fa608ccc5e34dc2f))
* Implement streamed markdown rendering for dream analysis ([fcf2c31](https://github.com/MohammadBnei/dream-analyst/commit/fcf2c319c344f59ccfed31fa2689c2638b9c183e))
* Implement streaming AI analysis for new dreams via SSE ([1f038ae](https://github.com/MohammadBnei/dream-analyst/commit/1f038ae433cda238e61bfb5e1051b29a9bd04cae))
* Implement synchronous dream analysis via n8n webhook ([67723ee](https://github.com/MohammadBnei/dream-analyst/commit/67723eea853e34dcae8c2d52ff7d0cf58f01bf7e))
* Implement TypeScript-based database migration for dreams table ([3651550](https://github.com/MohammadBnei/dream-analyst/commit/3651550ff80ab4c77da1a1a867cb0631f75a8698))
* Implement user CRUD and authentication service ([067fc53](https://github.com/MohammadBnei/dream-analyst/commit/067fc53842cfa637ee391a4f1754f4d01c258d4c))
* implement user login logic and JWT cookie handling ([fbf00b3](https://github.com/MohammadBnei/dream-analyst/commit/fbf00b37ef2217877747d1c1d73d2a1e109bb3d3))
* Implement user registration route and logic ([9d06538](https://github.com/MohammadBnei/dream-analyst/commit/9d06538c52aa45bcbe3d05303e51af0f26441327))
* Integrate dream and user schemas with Drizzle ORM and update auth logic ([eae05a7](https://github.com/MohammadBnei/dream-analyst/commit/eae05a76663e1a26cfa3c12a0aa4d449cb4e5545))
* Integrate svelte-streamdown for markdown rendering ([d6e55b4](https://github.com/MohammadBnei/dream-analyst/commit/d6e55b427e76192f37966d014fe19673976c3962))
* migrate from Drizzle ORM to Prisma ORM ([a128ea7](https://github.com/MohammadBnei/dream-analyst/commit/a128ea7b00bf1d593ae62b7a55bb31f1cd6bab7b))
* Pass authenticated user from `locals` to layout ([3b5a49a](https://github.com/MohammadBnei/dream-analyst/commit/3b5a49a6cf8463d7b608545a0fe32bf90fab2fef))
* Render dream interpretation as markdown ([be88044](https://github.com/MohammadBnei/dream-analyst/commit/be88044f1a45aeeb847e069efb7c1130b1fdbad4))
* Run database migrations on application startup ([3da4ef9](https://github.com/MohammadBnei/dream-analyst/commit/3da4ef9ae4c4e29758f6144ab999df44d93a22c6))
* Simplify homepage to static content and remove data fetching ([fec1e1f](https://github.com/MohammadBnei/dream-analyst/commit/fec1e1f6627c86d4daf361050e6646a9145bd76d))

# [0.2.0](https://github.com/vercel/examples/compare/0.1.3...0.2.0) (2025-10-27)


### Features

* Integrate dream and user schemas with Drizzle ORM and update auth logic ([eae05a7](https://github.com/vercel/examples/commit/eae05a76663e1a26cfa3c12a0aa4d449cb4e5545))

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
