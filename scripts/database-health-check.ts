/**
 * DATABASE HEALTH CHECK SCRIPT
 * 
 * Monitors critical database tables and alerts if row counts drop
 * Run this script:
 * - Before deployments
 * - Daily via cron job
 * - In CI/CD pipeline
 * 
 * Usage: npx tsx scripts/database-health-check.ts
 */

// Load environment variables from .env.local
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BASELINE_FILE = path.join(__dirname, '../.database-baseline.json')

// Critical tables to monitor
const CRITICAL_TABLES = [
  'projects',
  'music',
  'videos',
  'publications',
  'products',
  'app_prototypes',
  'orders',
  'order_items',
  'discount_codes',
  'user_profiles',
  'client_projects',
]

interface TableCount {
  table_name: string
  row_count: number
  checked_at: string
}

interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'critical'
  timestamp: string
  tables: TableCount[]
  issues: string[]
}

async function getTableCounts(): Promise<TableCount[]> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const counts: TableCount[] = []

  for (const table of CRITICAL_TABLES) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })

      if (error) {
        console.warn(`⚠️  Table '${table}' not found or inaccessible`)
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

function compareWithBaseline(
  current: TableCount[],
  baseline: TableCount[]
): HealthCheckResult {
  const issues: string[] = []
  let status: 'healthy' | 'warning' | 'critical' = 'healthy'

  for (const currentTable of current) {
    const baselineTable = baseline.find(b => b.table_name === currentTable.table_name)

    if (!baselineTable) {
      continue // New table, not an issue
    }

    // Table disappeared
    if (currentTable.row_count === -1 && baselineTable.row_count >= 0) {
      issues.push(
        `🚨 CRITICAL: Table '${currentTable.table_name}' no longer exists! (had ${baselineTable.row_count} rows)`
      )
      status = 'critical'
    }
    // Significant data loss (>10% or any loss in critical revenue tables)
    else if (currentTable.row_count < baselineTable.row_count) {
      const lossAmount = baselineTable.row_count - currentTable.row_count
      const lossPercent = ((lossAmount / baselineTable.row_count) * 100).toFixed(1)
      
      // Revenue tables are CRITICAL
      if (['orders', 'order_items'].includes(currentTable.table_name)) {
        issues.push(
          `🚨 CRITICAL: '${currentTable.table_name}' lost ${lossAmount} rows (${lossPercent}%) - REVENUE DATA!`
        )
        status = 'critical'
      }
      // >10% loss in any table
      else if (lossAmount / baselineTable.row_count > 0.1) {
        issues.push(
          `⚠️  WARNING: '${currentTable.table_name}' lost ${lossAmount} rows (${lossPercent}%)`
        )
        if (status !== 'critical') status = 'warning'
      }
      // Minor loss
      else if (lossAmount > 0) {
        issues.push(
          `ℹ️  INFO: '${currentTable.table_name}' lost ${lossAmount} rows (${lossPercent}%)`
        )
      }
    }
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    tables: current,
    issues,
  }
}

async function main() {
  console.log('🔍 Running database health check...\n')

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
