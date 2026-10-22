/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // Relative asset URLs: itch.io serves the build from a nested CDN path, where
  // the default absolute `/assets/...` would 404.
  base: './',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // Test files and harnesses only. Never exclude game code to reach the
      // threshold — write the test instead.
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
      reporter: ['text', 'json-summary'],
    },
  },
})
