/**
 * Generates a combined SQL file for bootstrapping the DEV Supabase project.
 *
 * Usage:  npx tsx scripts/apply-migrations-to-dev.ts
 *
 * Output: scripts/dev-combined-migrations.sql
 *
 * Uses the production schema DDL (extracted via MCP) as the source of truth
 * for table structure, avoiding ordering conflicts from schema files.
 * Then appends RLS policies, functions, triggers, and seed data.
 *
 * Safety: refuses to run if .env.local points at the production project.
 */

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

if (SUPABASE_URL.includes('byoriebhtbysanjhimlu')) {
  console.error('ABORT: .env.local points at the PRODUCTION Supabase project.')
  process.exit(1)
}

const ROOT = path.resolve(__dirname, '..')
const MIGRATIONS_DIR = path.join(ROOT, 'migrations')
const OUTPUT_FILE = path.resolve(__dirname, 'dev-combined-migrations.sql')

function readSql(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8').trim()
}

function readIfExists(filePath: string): string {
  return fs.existsSync(filePath) ? readSql(filePath) : ''
}

function main() {
  const prodDdl = readIfExists(path.join(__dirname, 'prod-schema-ddl.sql'))
  if (!prodDdl) {
    console.error('Missing scripts/prod-schema-ddl.sql — extract it from production first.')
    process.exit(1)
  }

  const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql') && !f.includes('.draft.'))
    .sort()

  const seedFiles = [
    'database_seed_content.sql',
    'database_seed_kickoff_agenda_templates.sql',
    'database_seed_onboarding_templates.sql',
    'database_seed_progress_update_templates.sql',
    'database_schema_sales_seed.sql',
    'database_seed_test_lead.sql',
    'database_seed_test_proposal.sql',
  ].filter(f => fs.existsSync(path.join(ROOT, f)))

  const parts: string[] = [
    '-- ==========================================================================',
    '-- Dev project bootstrap — generated from production schema DDL',
    `-- Generated: ${new Date().toISOString()}`,
    '-- ==========================================================================',
    '',
    '-- == PHASE 1: Tables (from production schema snapshot) ====================',
    '',
    prodDdl,
    '',
    '-- == PHASE 2: Migrations (idempotent — adds constraints, indexes, RLS, etc.) ==',
    '',
  ]

  for (const file of migrationFiles) {
    const sql = readSql(path.join(MIGRATIONS_DIR, file))
    if (!sql) continue
    parts.push(`-- -- ${file} --`)
    parts.push(sql)
    parts.push('')
  }

  parts.push('-- == PHASE 3: Seed data =================================================')
  parts.push('')

  for (const file of seedFiles) {
    const sql = readSql(path.join(ROOT, file))
    if (!sql) continue
    parts.push(`-- -- ${file} --`)
    parts.push(sql)
    parts.push('')
  }

  fs.writeFileSync(OUTPUT_FILE, parts.join('\n'), 'utf-8')

  const sizeMb = (fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(2)
  console.log(`Wrote: scripts/dev-combined-migrations.sql (${sizeMb} MB)`)
  console.log(`  - Production schema DDL (tables)`)
  console.log(`  - ${migrationFiles.length} migrations`)
  console.log(`  - ${seedFiles.length} seed files`)
  console.log()
  console.log(`Next steps:`)
  console.log(`  1. Reset the dev DB:  DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ...`)
  console.log(`  2. Paste scripts/dev-combined-migrations.sql into the SQL Editor`)
  console.log(`  3. Click "Run"`)
}

main()
