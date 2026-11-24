import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Entry point: only wires stdio, exercised by the e2e test against dist/.
      exclude: ['src/index.ts'],
      reporter: ['text', 'lcov'],
      thresholds: { 100: true },
    },
  },
});
