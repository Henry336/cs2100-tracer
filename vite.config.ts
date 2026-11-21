import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Served from https://henry336.github.io/cs2100-tracer/ on GitHub Pages.
export default defineConfig({
  base: '/cs2100-tracer/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
  },
})
