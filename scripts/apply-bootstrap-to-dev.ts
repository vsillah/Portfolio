/**
 * Applies the bootstrap SQL to the dev Supabase project.
 * 
 * Reads scripts/prod-schema-components/*.sql and applies each phase
 * sequentially to the dev project using the supabase-js client with
 * the service role key.
 * 
 * Usage: npx tsx scripts/apply-bootstrap-to-dev.ts
 * 
 * Safety: refuses to run against the production project.
 */

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (SUPABASE_URL.includes('byoriebhtbysanjhimlu')) {
  console.error('ABORT: .env.local points at the PRODUCTION Supabase project.')
  process.exit(1)
}

if (!SERVICE_ROLE_KEY) {
  console.error('ABORT: SUPABASE_SERVICE_ROLE_KEY not set in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const COMPONENTS_DIR = path.resolve(__dirname, 'prod-schema-components')

async function executeSql(sql: string): Promise<{ error: string | null }> {
  // supabase-js doesn't have a raw SQL method.
  // Use the PostgREST RPC endpoint with a helper function.
  // First, we need to create the helper function.
  // But we can't create it without raw SQL access...
  
  // Use fetch directly against the Supabase Management API
  const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '')
  
  // Supabase provides a direct SQL endpoint at the project level for service role
  // via the /rest/v1/rpc/ path, but only for existing functions.
  
  // The real solution: use the Supabase Management API with the access token.
  // But we don't have that. Let's use the pg module with the pooler connection.
  
  // Actually, Supabase free tier projects expose a direct connection at:
  // postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
  // But we need the database password.
  
  // Alternative: use the Supabase CLI's `supabase db execute` command
  // But that requires the CLI to be installed and linked.
  
  return { error: 'No direct SQL execution method available' }
}

async function main() {
  console.log(`Target: ${SUPABASE_URL}`)
  console.log(`Project ref: ${SUPABASE_URL.replace('https://', '').replace('.supabase.co', '')}`)
  console.log('')
  
  // Check if we can use pg module with connection string
  const dbPassword = process.env.SUPABASE_DB_PASSWORD
  if (!dbPassword) {
    console.error('SUPABASE_DB_PASSWORD not found in .env.local')
    console.error('')
    console.error('To add it:')
    console.error('  1. Go to https://supabase.com/dashboard/project/xxissfhcdjivuhxwjyhv/settings/database')
    console.error('  2. Copy the database password')
    console.error('  3. Add to .env.local: SUPABASE_DB_PASSWORD=your_password_here')
    console.error('')
    console.error('Or paste the bootstrap SQL manually:')
    console.error('  1. Go to https://supabase.com/dashboard/project/xxissfhcdjivuhxwjyhv/sql/new')
    console.error('  2. First run: DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;')
    console.error('  3. Then paste the contents of scripts/dev-combined-migrations.sql and run it')
    process.exit(1)
  }
  
  const { Client } = await import('pg')
  const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '')
  const connectionString = `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-us-west-2.pooler.supabase.com:5432/postgres`
  
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  
  try {
    await client.connect()
    console.log('Connected to dev database\n')
  } catch (err: any) {
    console.error('Failed to connect:', err.message)
    console.error('Check your SUPABASE_DB_PASSWORD in .env.local')
    process.exit(1)
  }
  
  // Phase 0: Enable extensions and reset public schema
  console.log('PHASE 0: Enabling extensions and resetting public schema...')
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions')
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions')
    await client.query('DROP SCHEMA IF EXISTS public CASCADE')
    await client.query('CREATE SCHEMA public')
    await client.query('GRANT ALL ON SCHEMA public TO postgres')
    await client.query('GRANT ALL ON SCHEMA public TO public')
    await client.query('GRANT USAGE ON SCHEMA public TO anon')
    await client.query('GRANT USAGE ON SCHEMA public TO authenticated')
    await client.query('GRANT USAGE ON SCHEMA public TO service_role')
    console.log('  Done\n')
  } catch (err: any) {
    console.error('  Failed:', err.message)
    process.exit(1)
  }
  
  const phases = [
    { name: 'PHASE 1: Sequences', file: 'sequences.sql' },
    { name: 'PHASE 2: Functions', file: 'functions.sql' },
    { name: 'PHASE 3: Tables', file: 'tables.sql' },
    { name: 'PHASE 4: Primary keys', file: 'primary-keys.sql' },
    { name: 'PHASE 5: Unique constraints', file: 'unique-indexes.sql' },
    { name: 'PHASE 6: Non-unique indexes', file: 'indexes.sql' },
    { name: 'PHASE 7: Foreign keys', file: 'foreign-keys.sql' },
    { name: 'PHASE 8: Check constraints', file: 'check-constraints.sql' },
    { name: 'PHASE 9: Triggers', file: 'triggers.sql' },
    { name: 'PHASE 10: RLS enable', file: 'rls-enable.sql' },
    { name: 'PHASE 11: RLS policies', file: 'rls-policies.sql' },
    { name: 'PHASE 12: Views', file: 'views.sql' },
  ]
  
  for (const phase of phases) {
    const filePath = path.join(COMPONENTS_DIR, phase.file)
    if (!fs.existsSync(filePath)) {
      console.log(`${phase.name}: SKIPPED (file not found)`)
      continue
    }
    
    const sql = fs.readFileSync(filePath, 'utf-8').trim()
    if (!sql) {
      console.log(`${phase.name}: SKIPPED (empty)`)
      continue
    }
    
    process.stdout.write(`${phase.name}...`)
    try {
      await client.query(sql)
      console.log(' OK')
    } catch (err: any) {
      console.log(` FAILED: ${err.message.substring(0, 100)}`)
      
      // For constraint/index/policy phases, retry statement-by-statement
      const retryableFiles = [
        'foreign-keys.sql', 'check-constraints.sql', 'rls-policies.sql',
        'indexes.sql', 'unique-indexes.sql', 'triggers.sql', 'primary-keys.sql',
      ]
      if (retryableFiles.includes(phase.file)) {
        console.log('  Retrying statement-by-statement...')
        const statements = sql.split(/;\s*\n/).filter(s => s.trim())
        let ok = 0, failed = 0
        for (const stmt of statements) {
          const trimmed = stmt.trim()
          if (!trimmed || trimmed.startsWith('--')) continue
          try {
            await client.query(trimmed + ';')
            ok++
          } catch (stmtErr: any) {
            failed++
            if (failed <= 5) {
              console.error(`    Failed: ${stmtErr.message.substring(0, 150)}`)
            }
          }
        }
        if (failed > 5) console.log(`    ... and ${failed - 5} more failures`)
        console.log(`  Results: ${ok} OK, ${failed} failed`)
      }
    }
  }
  
  // Grant default privileges for Supabase roles
  console.log('\nGranting default privileges...')
  const grantSql = `
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
    GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO authenticated;
  `
  try {
    await client.query(grantSql)
    console.log('  Done')
  } catch (err: any) {
    console.log('  Warning:', err.message.substring(0, 100))
  }
  
  // Verify table count
  const result = await client.query(
    "SELECT count(*) as cnt FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
  )
  console.log(`\nVerification: ${result.rows[0].cnt} tables in public schema`)
  
  await client.end()
  console.log('\nBootstrap complete.')
  console.log('Next: run `npx tsx scripts/seed-dev.ts` to populate with seed data.')
}

main().catch(err => {
  console.error('Fatal error:', err.message)
  process.exit(1)
})
