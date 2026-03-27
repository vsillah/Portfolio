/**
 * DATABASE HEALTH CHECK SCRIPT
 * 
 * Monitors critical database tables and alerts if row counts drop.
 * Defaults to PRODUCTION credentials (PROD_SUPABASE_*) so the pre-push
 * hook guards real data. Pass --dev to check the dev database instead.
 * 
 * Usage:
 *   npx tsx scripts/database-health-check.ts            # production (default)
 *   npx tsx scripts/database-health-check.ts --dev       # dev database
 *   npx tsx scripts/database-health-check.ts --update    # update baseline
 */

// Load environment variables from .env.local (local) or from process.env (CI)
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import {
  compareWithBaseline,
  CRITICAL_TABLES,
  OPTIONAL_TABLES,
  resolveHealthCheckEnv,
  type TableCount,
} from '../lib/database-health-check'

const envConfig = resolveHealthCheckEnv(process.argv, process.env)

if (!envConfig.supabaseUrl?.trim()) {
  console.error(`❌ ${envConfig.urlVar} is missing.`)
  console.error('   Add it to .env.local in the project root (or set in CI).')
  process.exit(1)
}
if (!envConfig.supabaseServiceKey?.trim()) {
  console.error(`❌ ${envConfig.keyVar} is missing.`)
  console.error('   Add it to .env.local in the project root (or set in CI).')
  process.exit(1)
}

const SUPABASE_URL_SAFE: string = envConfig.supabaseUrl as string
const SUPABASE_SERVICE_KEY_SAFE: string = envConfig.supabaseServiceKey as string
const BASELINE_FILE = path.join(
  __dirname,
  `../${envConfig.baselineFileName}`
)

async function getTableCounts(): Promise<TableCount[]> {
  const supabase = createClient(SUPABASE_URL_SAFE, SUPABASE_SERVICE_KEY_SAFE)
  const counts: TableCount[] = []

  for (const table of CRITICAL_TABLES) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })

      if (error) {
        if (!OPTIONAL_TABLES.has(table)) {
          console.warn(`⚠️  Table '${table}' not found or inaccessible`)
        }
        counts.push({
          table_name: table,
          row_count: -1, // -1 indicates table doesn't exist
          checked_at: new Date().toISOString(),
        })
      } else {
        counts.push({
          table_name: table,
          row_count: count || 0,
          checked_at: new Date().toISOString(),
        })
      }
    } catch (err) {
      console.error(`Error checking table '${table}':`, err)
      counts.push({
        table_name: table,
        row_count: -1,
        checked_at: new Date().toISOString(),
      })
    }
  }

  return counts
}

function loadBaseline(): TableCount[] | null {
  try {
    if (fs.existsSync(BASELINE_FILE)) {
      const data = fs.readFileSync(BASELINE_FILE, 'utf-8')
      return JSON.parse(data).tables
    }
  } catch (err) {
    console.warn('Could not load baseline file:', err)
  }
  return null
}

function saveBaseline(counts: TableCount[]): void {
  const baseline = {
    created_at: new Date().toISOString(),
    tables: counts,
  }
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2))
  console.log(`✅ Baseline saved to ${BASELINE_FILE}`)
}

async function main() {
  console.log(`🔍 Running database health check [${envConfig.envLabel}]...\n`)

  // Get current counts
  const currentCounts = await getTableCounts()

  // Load baseline
  const baseline = loadBaseline()

  if (!baseline) {
    console.log('📝 No baseline found. Creating initial baseline...\n')
    saveBaseline(currentCounts)
    
    console.log('\n📊 Current Database State:')
    currentCounts.forEach(t => {
      const status = t.row_count === -1 ? '❌ Missing' : `✅ ${t.row_count} rows`
      console.log(`  ${t.table_name.padEnd(20)} ${status}`)
    })
    
    console.log('\n✅ Baseline created! Run this script again to check for changes.')
    process.exit(0)
  }

  // Compare with baseline
  const result = compareWithBaseline(currentCounts, baseline)

  // Display results
  console.log('📊 Database Health Check Results\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  result.tables.forEach(t => {
    const baselineTable = baseline.find(b => b.table_name === t.table_name)
    const baselineCount = baselineTable?.row_count ?? 0
    const diff = t.row_count - baselineCount
    const diffStr = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '±0'
    
    let icon = '✅'
    if (t.row_count === -1) icon = '❌'
    else if (diff < 0) icon = '⚠️'
    
    console.log(
      `${icon} ${t.table_name.padEnd(20)} ${String(t.row_count).padStart(6)} rows (${diffStr.padStart(6)} from baseline)`
    )
  })
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // Display issues
  if (result.issues.length > 0) {
    console.log('⚠️  ISSUES DETECTED:\n')
    result.issues.forEach(issue => console.log(`  ${issue}`))
    console.log('')
  } else {
    console.log('✅ No issues detected. Database is healthy!\n')
  }

  // Update baseline if --update flag is passed
  if (process.argv.includes('--update')) {
    saveBaseline(currentCounts)
    console.log('✅ Baseline updated\n')
  } else if (result.status === 'healthy' && result.issues.length === 0) {
    console.log('💡 Tip: Run with --update flag to update the baseline\n')
  }

  // Exit with appropriate code
  if (result.status === 'critical') {
    console.error('🚨 CRITICAL ISSUES FOUND - BLOCKING DEPLOYMENT')
    process.exit(1)
  } else if (result.status === 'warning') {
    console.warn('⚠️  WARNINGS FOUND - REVIEW BEFORE DEPLOYING')
    process.exit(1)
  } else {
    console.log('✅ Health check passed!')
    process.exit(0)
  }
}

main().catch(err => {
  console.error('❌ Health check failed:', err)
  process.exit(1)
})
