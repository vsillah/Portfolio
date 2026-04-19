/**
 * Reconcile a single `gamma_reports` row by re-checking Gamma for the stored
 * `gamma_generation_id` and patching the row's status/`gamma_url`.
 *
 * Use when our in-process poll in `runGammaGeneration` timed out (row marked
 * `failed` with a timeout error) but Gamma actually kept rendering and
 * completed after we disconnected. Recovers the existing generation without
 * spending fresh Gamma credits.
 *
 * Usage:
 *   GAMMA_API_KEY=<key> npx tsx scripts/reconcile-gamma-report.ts --id=<uuid>
 *   GAMMA_API_KEY=<key> npx tsx scripts/reconcile-gamma-report.ts --prod --id=<uuid>
 *
 * The `GAMMA_API_KEY` must be the same key used to start the generation
 * (otherwise Gamma will 404 the generationId). Copy it from Vercel env.
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * (or PROD_SUPABASE_URL + PROD_SUPABASE_SERVICE_ROLE_KEY when --prod).
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const argv = process.argv.slice(2)
const args = new Set(argv)
const isProd = args.has('--prod')

function argValue(prefix: string): string | null {
  const hit = argv.find((a) => a.startsWith(prefix))
  if (!hit) return null
  const [, v] = hit.split('=', 2)
  return v ?? null
}

const reportId = argValue('--id')
if (!reportId) {
  console.error('Missing --id=<gamma_reports.id>')
  process.exit(1)
}

if (!process.env.GAMMA_API_KEY) {
  console.error('Missing GAMMA_API_KEY (required to query Gamma generation status).')
  console.error('Copy it from Vercel env and pass inline, e.g.')
  console.error(`  GAMMA_API_KEY=<key> npx tsx scripts/reconcile-gamma-report.ts --prod --id=${reportId}`)
  process.exit(1)
}

const supabaseUrl = isProd
  ? process.env.PROD_SUPABASE_URL
  : process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = isProd
  ? process.env.PROD_SUPABASE_SERVICE_ROLE_KEY
  : process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    `Missing ${isProd ? 'PROD_' : ''}Supabase env. Need URL + SERVICE_ROLE key in .env.local.`
  )
  process.exit(1)
}

console.log(`Target: ${isProd ? 'PRODUCTION' : 'DEV'} (${supabaseUrl})`)
console.log(`Report: ${reportId}`)
console.log('')

const sb = createClient(supabaseUrl, serviceRoleKey)

async function main() {
  const { data: row, error: fetchErr } = await sb
    .from('gamma_reports')
    .select('id, status, gamma_generation_id, gamma_url, error_message, title')
    .eq('id', reportId)
    .single()

  if (fetchErr || !row) {
    console.error('Report not found:', fetchErr?.message)
    process.exit(1)
  }

  console.log(`Current status: ${row.status}`)
  console.log(`generationId:   ${row.gamma_generation_id ?? '(none)'}`)
  console.log(`gamma_url:      ${row.gamma_url ?? '(none)'}`)
  if (row.error_message) console.log(`error_message:  ${row.error_message}`)
  console.log('')

  if (!row.gamma_generation_id) {
    console.error('Row has no gamma_generation_id; cannot reconcile.')
    process.exit(1)
  }

  if (row.status === 'completed' && row.gamma_url) {
    console.log('Row already completed with gamma_url. Nothing to do.')
    return
  }

  // Dynamic import so `GAMMA_API_KEY` env check runs before module loads.
  const { getGenerationStatus } = await import('../lib/gamma-client')

  console.log(`Querying Gamma for ${row.gamma_generation_id}...`)
  const status = await getGenerationStatus(row.gamma_generation_id)
  console.log(`Gamma status:   ${status.status}`)
  if (status.gammaUrl) console.log(`Gamma URL:      ${status.gammaUrl}`)
  if (status.error) console.log(`Gamma error:    ${status.error.message}`)
  console.log('')

  if (status.status === 'completed') {
    const { error: updErr } = await sb
      .from('gamma_reports')
      .update({
        status: 'completed',
        gamma_url: status.gammaUrl ?? null,
        error_message: null,
      })
      .eq('id', reportId)

    if (updErr) {
      if (updErr.code === '23505') {
        console.error(
          'Unique-index clash: another completed audit_summary exists for this audit. Skipping update.'
        )
        process.exit(2)
      }
      console.error('Update failed:', updErr.message)
      process.exit(1)
    }
    console.log('Row recovered → status=completed.')
    return
  }

  if (status.status === 'failed') {
    const msg = status.error?.message ?? 'Gamma reported generation failed'
    await sb
      .from('gamma_reports')
      .update({ status: 'failed', error_message: msg })
      .eq('id', reportId)
    console.log(`Row marked failed: ${msg}`)
    return
  }

  console.log('Gamma still pending. Re-run this script in a minute or two.')
}

main().catch((err) => {
  console.error('Unexpected error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
