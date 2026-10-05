import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'edge-functions/_shared/**/*.{test,spec}.js'],
    setupFiles: ['./src/test/setup.ts'],
    passWithNoTests: true,
  },
});
