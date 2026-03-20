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

const CRITICAL_REVENUE_TABLES = new Set(['orders', 'order_items'])

export function compareWithBaseline(
  current: TableCount[],
  baseline: TableCount[],
  optionalTables: ReadonlySet<string>
): HealthCheckResult {
  const issues: string[] = []
  let status: 'healthy' | 'warning' | 'critical' = 'healthy'

  for (const currentTable of current) {
    const baselineTable = baseline.find((b) => b.table_name === currentTable.table_name)

    if (!baselineTable) {
      continue // New table, not an issue
    }

    // Table disappeared (skip for optional tables that may not exist yet)
    if (
      currentTable.row_count === -1 &&
      baselineTable.row_count >= 0 &&
      !optionalTables.has(currentTable.table_name)
    ) {
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
      if (CRITICAL_REVENUE_TABLES.has(currentTable.table_name)) {
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
        issues.push(`ℹ️  INFO: '${currentTable.table_name}' lost ${lossAmount} rows (${lossPercent}%)`)
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
