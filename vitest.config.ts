import { defineConfig } from 'vitest/config';

// Only the TypeScript sources are under test. Without an explicit
// `include`, vitest also picks up the compiled copy of the suite in
// `lib/` (bob's build output, gitignored) — which is stale whenever
// `yarn prepare` hasn't been re-run, so a green run there proves
// nothing.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
