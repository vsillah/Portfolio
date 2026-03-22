export interface TableCount {
  table_name: string
  row_count: number
  checked_at: string
}

export interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'critical'
  timestamp: string
  tables: TableCount[]
  issues: string[]
}

export const CRITICAL_TABLES = [
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
  'module_sync_custom',
] as const

export const OPTIONAL_TABLES = new Set(['projects', 'music', 'videos'])

export interface HealthCheckEnvConfig {
  useDev: boolean
  envLabel: 'DEV' | 'PROD'
  supabaseUrl: string | undefined
  supabaseServiceKey: string | undefined
  urlVar: 'NEXT_PUBLIC_SUPABASE_URL' | 'PROD_SUPABASE_URL'
  keyVar: 'SUPABASE_SERVICE_ROLE_KEY' | 'PROD_SUPABASE_SERVICE_ROLE_KEY'
  baselineFileName: '.database-baseline-dev.json' | '.database-baseline.json'
}

export function resolveHealthCheckEnv(
  argv: string[],
  env: NodeJS.ProcessEnv
): HealthCheckEnvConfig {
  const useDev = argv.includes('--dev')

  if (useDev) {
    return {
      useDev: true,
      envLabel: 'DEV',
      supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseServiceKey: env.SUPABASE_SERVICE_ROLE_KEY,
      urlVar: 'NEXT_PUBLIC_SUPABASE_URL',
      keyVar: 'SUPABASE_SERVICE_ROLE_KEY',
      baselineFileName: '.database-baseline-dev.json',
    }
  }

  return {
    useDev: false,
    envLabel: 'PROD',
    supabaseUrl: env.PROD_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseServiceKey: env.PROD_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY,
    urlVar: 'PROD_SUPABASE_URL',
    keyVar: 'PROD_SUPABASE_SERVICE_ROLE_KEY',
    baselineFileName: '.database-baseline.json',
  }
}

export function compareWithBaseline(
  current: TableCount[],
  baseline: TableCount[],
  optionalTables: ReadonlySet<string> = OPTIONAL_TABLES
): HealthCheckResult {
  const issues: string[] = []
  let status: 'healthy' | 'warning' | 'critical' = 'healthy'

  for (const currentTable of current) {
    const baselineTable = baseline.find((b) => b.table_name === currentTable.table_name)

    if (!baselineTable) {
      continue
    }

    if (
      currentTable.row_count === -1
      && baselineTable.row_count >= 0
      && !optionalTables.has(currentTable.table_name)
    ) {
      issues.push(
        `🚨 CRITICAL: Table '${currentTable.table_name}' no longer exists! (had ${baselineTable.row_count} rows)`
      )
      status = 'critical'
    } else if (currentTable.row_count < baselineTable.row_count) {
      const lossAmount = baselineTable.row_count - currentTable.row_count
      const lossPercent = ((lossAmount / baselineTable.row_count) * 100).toFixed(1)

      if (['orders', 'order_items'].includes(currentTable.table_name)) {
        issues.push(
          `🚨 CRITICAL: '${currentTable.table_name}' lost ${lossAmount} rows (${lossPercent}%) - REVENUE DATA!`
        )
        status = 'critical'
      } else if (lossAmount / baselineTable.row_count > 0.1) {
        issues.push(
          `⚠️  WARNING: '${currentTable.table_name}' lost ${lossAmount} rows (${lossPercent}%)`
        )
        if (status !== 'critical') status = 'warning'
      } else if (lossAmount > 0) {
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
