import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'portfolio-old', '.next', 'e2e'],
    coverage: {
      provider: 'v8',
      include: ['lib/**', 'components/**', 'app/api/**'],
      exclude: ['**/*.test.*', '**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
