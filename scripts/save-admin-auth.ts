/**
 * Generate a Playwright storage state for Portfolio admin validation.
 *
 * This avoids repeated manual browser login during rendered QA. It signs in
 * through Supabase email/password using env vars and writes only a local,
 * gitignored Playwright storage-state file.
 *
 * Required env:
 * - ADMIN_E2E_EMAIL
 * - ADMIN_E2E_PASSWORD
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * Optional:
 * - PLAYWRIGHT_BASE_URL or BASE_URL
 * - PLAYWRIGHT_AUTH_STATE
 *
 * Usage:
 *   PLAYWRIGHT_BASE_URL=https://preview.example.vercel.app npm run admin:auth:save
 */

import * as path from 'node:path'
import { generateAuthState } from './save-storyboard-auth'
import {
  getVercelProjectEnvValues,
  shouldUseVercelPreviewEnv,
} from './vercel-validation-env'

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index === -1) return undefined
  return process.argv[index + 1]
}

async function main() {
  const baseUrl =
    readArg('--base-url') ||
    process.env.PLAYWRIGHT_BASE_URL ||
    process.env.BASE_URL ||
    'http://localhost:3000'

  const outPath =
    readArg('--out') ||
    process.env.PLAYWRIGHT_AUTH_STATE ||
    path.join(process.cwd(), '.auth', 'portfolio-admin-storage-state.json')

  const vercelPreviewEnv = shouldUseVercelPreviewEnv(baseUrl)
    ? getVercelProjectEnvValues([
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      ])
    : {}

  const result = await generateAuthState({
    baseUrl,
    outPath,
    supabaseUrl: vercelPreviewEnv.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: vercelPreviewEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })

  if (!result) {
    console.error(
      'ADMIN_E2E_EMAIL and ADMIN_E2E_PASSWORD must be set in .env.local or the current environment.',
    )
    process.exit(1)
  }

  console.log(`Admin auth state saved for ${baseUrl}: ${result}`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
