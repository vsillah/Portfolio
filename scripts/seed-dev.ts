/**
 * Seeds the DEV Supabase project with representative data.
 *
 * Usage:  npx tsx scripts/seed-dev.ts
 *
 * Prerequisites:
 *   - .env.local points at the dev Supabase project
 *   - Schema + migrations have already been applied (via SQL Editor or psql)
 *
 * This script runs the existing seed scripts in the correct order.
 * Optional follow-up for store marketing images: run
 *   npx tsx scripts/capture-product-store-images.ts
 * (non-merchandise products; requires dev server and admin auth for some routes).
 * It does NOT apply schema migrations — use apply-migrations-to-dev.ts for that.
 *
 * Safety: refuses to run against the production project.
 */

import { execSync } from 'child_process'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

if (SUPABASE_URL.includes('byoriebhtbysanjhimlu')) {
  console.error('ABORT: .env.local points at the PRODUCTION Supabase project.')
  console.error('This script should only run against the dev project.')
  process.exit(1)
}

console.log(`Seeding dev project: ${SUPABASE_URL}\n`)

const scripts = [
  'scripts/seed-pricing-model.ts',
  'scripts/seed-lead-magnets.ts',
  'scripts/seed-template-products.ts',
  'scripts/seed-value-calculations.ts',
]

let succeeded = 0
let failed = 0

for (const script of scripts) {
  const fullPath = path.resolve(__dirname, '..', script)
  process.stdout.write(`  Running ${script} ... `)

  try {
    execSync(`npx tsx "${fullPath}"`, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe',
      timeout: 60_000,
    })
    console.log('OK')
    succeeded++
  } catch (err: any) {
    const stderr = err.stderr?.toString().slice(0, 300) || 'unknown error'
    console.log(`FAILED\n    ${stderr}`)
    failed++
  }
}

console.log(`\nDone. ${succeeded} succeeded, ${failed} failed.`)

if (failed > 0) {
  console.log('\nSome seed scripts failed. This is expected if the schema')
  console.log('is not fully applied yet. Run the SQL migrations first.')
}

console.log('\nReminder: To create an admin user in dev:')
console.log('  1. Sign up at http://localhost:3000/auth/login')
console.log('  2. In the dev Supabase dashboard, go to Table Editor > user_profiles')
console.log('  3. Find your row and change "role" from "user" to "admin"')
