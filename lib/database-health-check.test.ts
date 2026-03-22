import { describe, expect, it } from 'vitest'
import {
  compareWithBaseline,
  resolveHealthCheckEnv,
  type TableCount,
} from './database-health-check'

function tableCount(table_name: string, row_count: number): TableCount {
  return {
    table_name,
    row_count,
    checked_at: '2026-03-22T00:00:00.000Z',
  }
}

describe('resolveHealthCheckEnv', () => {
  it('uses PROD-specific credentials by default', () => {
    const config = resolveHealthCheckEnv([], {
      NEXT_PUBLIC_SUPABASE_URL: 'https://dev.example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'dev-key',
      PROD_SUPABASE_URL: 'https://prod.example.supabase.co',
      PROD_SUPABASE_SERVICE_ROLE_KEY: 'prod-key',
    })

    expect(config.useDev).toBe(false)
    expect(config.envLabel).toBe('PROD')
    expect(config.supabaseUrl).toBe('https://prod.example.supabase.co')
    expect(config.supabaseServiceKey).toBe('prod-key')
    expect(config.urlVar).toBe('PROD_SUPABASE_URL')
    expect(config.keyVar).toBe('PROD_SUPABASE_SERVICE_ROLE_KEY')
    expect(config.baselineFileName).toBe('.database-baseline.json')
  })

  it('falls back to standard Supabase variables when PROD-specific vars are missing', () => {
    const config = resolveHealthCheckEnv([], {
      NEXT_PUBLIC_SUPABASE_URL: 'https://fallback.example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'fallback-key',
    })

    expect(config.useDev).toBe(false)
    expect(config.supabaseUrl).toBe('https://fallback.example.supabase.co')
    expect(config.supabaseServiceKey).toBe('fallback-key')
  })

  it('uses dev variables and baseline when --dev flag is present', () => {
    const config = resolveHealthCheckEnv(['--dev'], {
      NEXT_PUBLIC_SUPABASE_URL: 'https://dev.example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'dev-key',
      PROD_SUPABASE_URL: 'https://prod.example.supabase.co',
      PROD_SUPABASE_SERVICE_ROLE_KEY: 'prod-key',
    })

    expect(config.useDev).toBe(true)
    expect(config.envLabel).toBe('DEV')
    expect(config.supabaseUrl).toBe('https://dev.example.supabase.co')
    expect(config.supabaseServiceKey).toBe('dev-key')
    expect(config.urlVar).toBe('NEXT_PUBLIC_SUPABASE_URL')
    expect(config.keyVar).toBe('SUPABASE_SERVICE_ROLE_KEY')
    expect(config.baselineFileName).toBe('.database-baseline-dev.json')
  })
})

describe('compareWithBaseline', () => {
  it('marks any revenue row loss as critical', () => {
    const result = compareWithBaseline(
      [tableCount('orders', 9)],
      [tableCount('orders', 10)]
    )

    expect(result.status).toBe('critical')
    expect(result.issues[0]).toContain('CRITICAL')
    expect(result.issues[0]).toContain('REVENUE DATA')
  })

  it('marks >10% non-revenue loss as warning', () => {
    const result = compareWithBaseline(
      [tableCount('products', 89)],
      [tableCount('products', 100)]
    )

    expect(result.status).toBe('warning')
    expect(result.issues[0]).toContain('WARNING')
  })

  it('does not mark missing optional tables as critical', () => {
    const result = compareWithBaseline(
      [tableCount('projects', -1)],
      [tableCount('projects', 50)]
    )

    expect(result.status).toBe('warning')
    expect(result.issues[0]).toContain('WARNING')
  })
})
