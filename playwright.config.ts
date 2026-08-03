import fs from 'node:fs'
import { defineConfig, devices } from '@playwright/test'
import { getVercelAutomationBypassSecret } from './scripts/vercel-validation-env'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const authStatePath = process.env.PLAYWRIGHT_AUTH_STATE || '.auth/portfolio-admin-storage-state.json'
const isLocalBaseURL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(baseURL)
const storageState = fs.existsSync(authStatePath) ? authStatePath : undefined
const vercelBypassSecret = getVercelAutomationBypassSecret()
const vercelBypassHeaders = vercelBypassSecret
  ? {
      'x-vercel-protection-bypass': vercelBypassSecret,
      'x-vercel-set-bypass-cookie': 'true',
    }
  : undefined

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL,
    extraHTTPHeaders: vercelBypassHeaders,
    storageState,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Start the dev server for local E2E only. Preview/prod URLs are validated
  // directly so captain QA does not spawn an unrelated localhost server.
  webServer: isLocalBaseURL
    ? {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 30000,
      }
    : undefined,
})
