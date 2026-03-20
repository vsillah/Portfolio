import { describe, expect, it } from 'vitest'
import { compareWithBaseline, type TableCount } from './database-health-check'

const NOW = '2026-03-20T00:00:00.000Z'
const OPTIONAL_TABLES = new Set(['projects', 'music', 'videos'])

function row(tableName: string, count: number): TableCount {
  return {
    table_name: tableName,
    row_count: count,
    checked_at: NOW,
  }
}

describe('compareWithBaseline', () => {
  it('marks revenue-table row loss as critical', () => {
    const baseline = [row('orders', 10)]
    const current = [row('orders', 9)]

    const result = compareWithBaseline(current, baseline, OPTIONAL_TABLES)

    expect(result.status).toBe('critical')
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]).toContain('CRITICAL')
    expect(result.issues[0]).toContain('REVENUE DATA')
  })

  it('marks >10% loss in non-revenue tables as warning', () => {
    const baseline = [row('products', 100)]
    const current = [row('products', 85)]

    const result = compareWithBaseline(current, baseline, OPTIONAL_TABLES)

    expect(result.status).toBe('warning')
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]).toContain('WARNING')
    expect(result.issues[0]).toContain("'products' lost 15 rows")
  })

  it('keeps status healthy for <=10% loss in non-revenue tables', () => {
    const baseline = [row('products', 100)]
    const current = [row('products', 95)]

    const result = compareWithBaseline(current, baseline, OPTIONAL_TABLES)

    expect(result.status).toBe('healthy')
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]).toContain('INFO')
  })

  it('does not flag optional tables that are missing', () => {
    const baseline = [row('projects', 20)]
    const current = [row('projects', -1)]

    const result = compareWithBaseline(current, baseline, OPTIONAL_TABLES)

    expect(result.status).toBe('healthy')
    expect(result.issues).toHaveLength(0)
  })

  it('flags non-optional missing tables as critical', () => {
    const baseline = [row('products', 20)]
    const current = [row('products', -1)]

    const result = compareWithBaseline(current, baseline, OPTIONAL_TABLES)

    expect(result.status).toBe('critical')
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]).toContain("Table 'products' no longer exists")
  })

  it('ignores tables not present in baseline', () => {
    const baseline = [row('products', 3)]
    const current = [row('products', 3), row('new_table', 0)]

    const result = compareWithBaseline(current, baseline, OPTIONAL_TABLES)

    expect(result.status).toBe('healthy')
    expect(result.issues).toHaveLength(0)
    expect(result.tables).toHaveLength(2)
  })
})
