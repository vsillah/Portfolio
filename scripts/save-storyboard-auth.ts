/**
 * Generate Playwright storage state for admin routes by signing in programmatically
 * via Supabase signInWithPassword. No browser needed.
 *
 * Reads ADMIN_E2E_EMAIL and ADMIN_E2E_PASSWORD from .env.local (or env).
 * Writes to design-files/about-page-video/.storyboard-auth-state.json.
 *
 * Usage: npx tsx scripts/save-storyboard-auth.ts
 *
 * The capture script (capture-storyboard-assets.ts) also calls this logic inline
 * when ADMIN_E2E_EMAIL/PASSWORD are set, so you rarely need to run this separately.
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

config({ path: path.join(process.cwd(), '.env.local') })

const OUT_DIR = path.join(process.cwd(), 'design-files', 'about-page-video')
const AUTH_STATE_PATH = path.join(OUT_DIR, '.storyboard-auth-state.json')

export interface StoryboardAuthOptions {
  email?: string
  password?: string
  supabaseUrl?: string
  anonKey?: string
  baseUrl?: string
  outPath?: string
}

/**
 * Sign in with email/password via Supabase and write a Playwright-compatible
 * storage state JSON. Returns the path to the written file, or null if
 * credentials are missing.
 */
export async function generateAuthState(opts: StoryboardAuthOptions = {}): Promise<string | null> {
  const email = opts.email ?? process.env.ADMIN_E2E_EMAIL
  const password = opts.password ?? process.env.ADMIN_E2E_PASSWORD
  const supabaseUrl = opts.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = opts.anonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const baseUrl = opts.baseUrl ?? process.env.BASE_URL ?? 'http://localhost:3000'
  const outPath = opts.outPath ?? AUTH_STATE_PATH

  if (!email || !password) return null
  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Supabase sign-in failed: ${error.message}`)

  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  const storageKey = `sb-${projectRef}-auth-token`

  const storageState = {
    cookies: [],
    origins: [
      {
        origin: baseUrl,
        localStorage: [
          { name: storageKey, value: JSON.stringify(data.session) },
        ],
      },
    ],
  }

  const dir = path.dirname(outPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(storageState, null, 2))
  return outPath
}

async function main() {
  const result = await generateAuthState()
  if (!result) {
    console.error('ADMIN_E2E_EMAIL and ADMIN_E2E_PASSWORD must be set in .env.local (or env).')
    process.exit(1)
  }
  console.log('Auth state saved to:', result)
}

// Only run main when this script is executed directly (not when imported by playtest-broll)
if (typeof require !== 'undefined' && require.main === module) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
