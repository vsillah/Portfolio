#!/usr/bin/env npx tsx
/**
 * Print Portfolio Modules Inventory
 *
 * Outputs a concise inventory of:
 * 1. Template modules (from TEMPLATE_PRODUCTS in seed script)
 * 2. App prototypes (from DB: app_prototypes with app_repo_url or download_url)
 *
 * Usage:
 *   npx tsx scripts/print-modules-inventory.ts
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const REPO_BASE = 'https://github.com/vsillah/Portfolio/tree/main'

const TEMPLATE_MODULES = [
  { title: 'Chatbot Template', path: 'client-templates/chatbot-template' },
  { title: 'Lead Generation Template', path: 'client-templates/leadgen-template' },
  { title: 'Eval Template', path: 'client-templates/eval-template' },
  { title: 'Diagnostic Template', path: 'client-templates/diagnostic-template' },
  { title: 'n8n Warm Lead Pack', path: 'n8n-exports' },
]

async function main() {
  console.log('# Portfolio modules inventory (generated)\n')

  console.log('## Template modules (in-repo)\n')
  console.log('| Module | Download URL |')
  console.log('|--------|--------------|')
  for (const m of TEMPLATE_MODULES) {
    const url = `${REPO_BASE}/${m.path}`
    console.log(`| ${m.title} | ${url} |`)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.log('\n(Skip app prototypes: missing Supabase env vars)\n')
    return
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: prototypes, error } = await supabase
    .from('app_prototypes')
    .select('id, title, app_repo_url, download_url')
    .order('title')

  if (error) {
    console.error('\nError fetching app_prototypes:', error.message)
    return
  }

  const withLinks = (prototypes || []).filter(
    (p) => (p.app_repo_url && p.app_repo_url.trim()) || (p.download_url && p.download_url.trim())
  )

  console.log('\n## App prototypes (with repo or download link)\n')
  if (withLinks.length === 0) {
    console.log('None have `app_repo_url` or `download_url` set.\n')
    return
  }
  console.log('| Title | Repo URL | Download URL |')
  console.log('|-------|----------|--------------|')
  for (const p of withLinks) {
    const repo = p.app_repo_url?.trim() || '—'
    const dl = p.download_url?.trim() || '—'
    console.log(`| ${p.title} | ${repo} | ${dl} |`)
  }
  console.log('')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
