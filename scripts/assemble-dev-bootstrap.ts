/**
 * Assembles the dev bootstrap SQL from production schema components.
 * 
 * Prerequisites: Component files in scripts/prod-schema-components/ extracted
 * from production via Supabase MCP queries.
 * 
 * Usage: npx tsx scripts/assemble-dev-bootstrap.ts
 * Output: scripts/dev-combined-migrations.sql
 */

import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '..')
const COMPONENTS_DIR = path.resolve(__dirname, 'prod-schema-components')
const OUTPUT_FILE = path.resolve(__dirname, 'dev-combined-migrations.sql')

function readComponent(name: string): string {
  const p = path.join(COMPONENTS_DIR, name)
  if (!fs.existsSync(p)) {
    console.warn(`  WARNING: missing ${name}`)
    return ''
  }
  return fs.readFileSync(p, 'utf-8').trim()
}

function readSeedIfExists(name: string): string {
  const p = path.join(ROOT, name)
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8').trim() : ''
}

function main() {
  console.log('Assembling dev bootstrap SQL...\n')

  const seedFiles = [
    'database_seed_content.sql',
    'database_seed_kickoff_agenda_templates.sql',
    'database_seed_onboarding_templates.sql',
    'database_seed_progress_update_templates.sql',
    'database_schema_sales_seed.sql',
    'database_seed_test_lead.sql',
    'database_seed_test_proposal.sql',
  ]

  const seedSql = seedFiles
    .map(f => {
      const sql = readSeedIfExists(f)
      if (sql) console.log(`  Seed: ${f}`)
      return sql ? `-- -- ${f} --\n${sql}` : ''
    })
    .filter(Boolean)
    .join('\n\n')

  const phases = [
    { name: 'PHASE 1: Sequences', file: 'sequences.sql' },
    { name: 'PHASE 2: Functions (must exist before triggers)', file: 'functions.sql' },
    { name: 'PHASE 3: Tables', file: 'tables.sql' },
    { name: 'PHASE 4: Primary keys', file: 'primary-keys.sql' },
    { name: 'PHASE 5: Unique constraints (non-PK)', file: 'unique-indexes.sql' },
    { name: 'PHASE 6: Non-unique indexes', file: 'indexes.sql' },
    { name: 'PHASE 7: Foreign keys', file: 'foreign-keys.sql' },
    { name: 'PHASE 8: Check constraints', file: 'check-constraints.sql' },
    { name: 'PHASE 9: Triggers', file: 'triggers.sql' },
    { name: 'PHASE 10: RLS enable', file: 'rls-enable.sql' },
    { name: 'PHASE 11: RLS policies', file: 'rls-policies.sql' },
    { name: 'PHASE 12: Views', file: 'views.sql' },
  ]

  const parts: string[] = [
    '-- ==========================================================================',
    '-- Dev project bootstrap — extracted from production schema via Supabase MCP',
    `-- Generated: ${new Date().toISOString()}`,
    '-- DO NOT EDIT — regenerate with: npx tsx scripts/assemble-dev-bootstrap.ts',
    '-- ==========================================================================',
    '',
  ]

  for (const phase of phases) {
    const content = readComponent(phase.file)
    const lines = content.split('\n').length
    console.log(`  ${phase.name}: ${phase.file} (${lines} lines)`)
    parts.push(`-- == ${phase.name} ==`)
    parts.push('')
    parts.push(content)
    parts.push('')
  }

  parts.push('-- == PHASE 13: Seed data =================================================')
  parts.push('')
  parts.push(seedSql)
  parts.push('')
  parts.push('-- ==========================================================================')
  parts.push('-- Bootstrap complete')
  parts.push('-- ==========================================================================')

  const output = parts.join('\n')
  fs.writeFileSync(OUTPUT_FILE, output, 'utf-8')

  const sizeMb = (fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(2)
  const lineCount = output.split('\n').length
  console.log(`\nWrote: scripts/dev-combined-migrations.sql`)
  console.log(`  Size: ${sizeMb} MB, ${lineCount} lines`)
}

main()
