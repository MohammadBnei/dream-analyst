import type { SubmitFunction } from '@sveltejs/kit';

/**
 * The callback `use:enhance` invokes *after* the form action responds.
 *
 * Components here wire forms as `use:enhance={() => handleSubmit}`, so their
 * handler is this second-stage callback (receiving `{ result, update }`) rather
 * than the submit-time one. Without this type the destructured params are
 * implicit `any`.
 */
export type EnhanceResult = NonNullable<Awaited<ReturnType<SubmitFunction>>>;
