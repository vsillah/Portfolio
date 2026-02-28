/**
 * One-time setup: register the package_shipped webhook URL with Printful.
 * Requires PRINTFUL_API_KEY with webhooks scope; set NEXT_PUBLIC_SITE_URL for production.
 *
 * Usage: npm run printful:webhook
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.local before any module that reads process.env (ESM hoists imports, so we load printful inside main)
config({ path: resolve(process.cwd(), '.env.local') })

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL?.trim()) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  }
  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}

async function main() {
  const { printful } = await import('../lib/printful')

  const baseUrl = getBaseUrl()
  const webhookUrl = `${baseUrl}/api/webhooks/printful`

  console.log('Registering Printful webhook...')
  console.log('URL:', webhookUrl)

  const result = await printful.setWebhookConfig({
    url: webhookUrl,
    types: ['package_shipped'],
  })

  console.log('Success.')
  console.log('Current config:', JSON.stringify(result, null, 2))
}

main().catch((err) => {
  console.error('Failed to set webhook:', err)
  process.exit(1)
})
