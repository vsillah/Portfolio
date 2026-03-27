import { describe, it, expect } from 'vitest'
import {
  PAIN_POINT_DEFAULT_METHODS,
  autoGenerateCalculation,
  determineConfidence,
  findBestBenchmark,
  normalizeCompanySize,
  type IndustryBenchmark,
} from './value-calculations'

const BASE_BENCHMARK: Omit<IndustryBenchmark, 'id' | 'industry' | 'company_size_range' | 'benchmark_type' | 'value'> = {
  source: 'Test Source',
  source_url: null,
  year: 2026,
  notes: null,
}

function makeBenchmark(
  id: string,
  industry: string,
  companySize: string,
  benchmarkType: IndustryBenchmark['benchmark_type'],
  value: number
): IndustryBenchmark {
  return {
    id,
    industry,
    company_size_range: companySize,
    benchmark_type: benchmarkType,
    value,
    ...BASE_BENCHMARK,
  }
}

describe('value-calculations regression coverage', () => {
  it('uses fallback order in findBestBenchmark', () => {
    const withExact: IndustryBenchmark[] = [
      makeBenchmark('same-industry', 'healthcare', '51-200', 'avg_hourly_wage', 65),
      makeBenchmark('exact', 'healthcare', '11-50', 'avg_hourly_wage', 70),
      makeBenchmark('default-size', '_default', '11-50', 'avg_hourly_wage', 55),
      makeBenchmark('default-any', '_default', '201-1000', 'avg_hourly_wage', 45),
    ]
    const withoutExact: IndustryBenchmark[] = [
      makeBenchmark('same-industry', 'healthcare', '51-200', 'avg_hourly_wage', 65),
      makeBenchmark('default-size', '_default', '11-50', 'avg_hourly_wage', 55),
      makeBenchmark('default-any', '_default', '201-1000', 'avg_hourly_wage', 45),
    ]
    const defaultOnly: IndustryBenchmark[] = [
      makeBenchmark('default-size', '_default', '11-50', 'avg_hourly_wage', 55),
      makeBenchmark('default-any', '_default', '201-1000', 'avg_hourly_wage', 45),
    ]
    const defaultAnyOnly: IndustryBenchmark[] = [
      makeBenchmark('default-any', '_default', '201-1000', 'avg_hourly_wage', 45),
    ]

    expect(findBestBenchmark(withExact, 'healthcare', '11-50', 'avg_hourly_wage')?.id).toBe('exact')
    expect(findBestBenchmark(withoutExact, 'healthcare', '1-10', 'avg_hourly_wage')?.id).toBe('same-industry')
    expect(findBestBenchmark(defaultOnly, 'retail', '11-50', 'avg_hourly_wage')?.id).toBe('default-size')
    expect(findBestBenchmark(defaultAnyOnly, 'retail', '1-10', 'avg_hourly_wage')?.id).toBe('default-any')
  })

  it('normalizes company size from common messy formats', () => {
    expect(normalizeCompanySize(null)).toBe('11-50')
    expect(normalizeCompanySize('7 employees')).toBe('1-10')
    expect(normalizeCompanySize('11-50')).toBe('11-50')
    expect(normalizeCompanySize('51-200 employees')).toBe('51-200')
    expect(normalizeCompanySize('250')).toBe('201-1000')
    expect(normalizeCompanySize('not sure')).toBe('1-10')
  })

  it('keeps merged pain-point defaults available', () => {
    expect(PAIN_POINT_DEFAULT_METHODS.manual_processes?.method).toBe('time_saved')
    expect(PAIN_POINT_DEFAULT_METHODS.scattered_tools?.method).toBe('time_saved')
    expect(PAIN_POINT_DEFAULT_METHODS.manual_data_entry).toBeUndefined()
  })

  it('auto-generates manual_processes value using hourly wage benchmark', () => {
    const calc = autoGenerateCalculation(
      'manual_processes',
      [makeBenchmark('wage-1', 'healthcare', '11-50', 'avg_hourly_wage', 55)],
      'healthcare',
      '11-50 employees',
      5,
      true
    )

    expect(calc).not.toBeNull()
    expect(calc?.method).toBe('time_saved')
    expect(calc?.annualValue).toBe(28600) // 10 hrs/week * $55/hr * 52 weeks
    expect(calc?.benchmarksUsed.map((b) => b.id)).toEqual(['wage-1'])
    expect(calc?.confidenceLevel).toBe('high')
  })

  it('falls back to hardcoded defaults when no benchmark exists', () => {
    const calc = autoGenerateCalculation(
      'scattered_tools',
      [],
      'retail',
      '11-50',
      0,
      false
    )

    expect(calc).not.toBeNull()
    expect(calc?.annualValue).toBe(10400) // 5 hrs/week * $40/hr fallback * 52 weeks
    expect(calc?.benchmarksUsed).toEqual([])
    expect(calc?.confidenceLevel).toBe('low')
  })

  it('returns null for unknown pain point names', () => {
    const calc = autoGenerateCalculation('does_not_exist', [], 'healthcare', '11-50')
    expect(calc).toBeNull()
  })

  it('handles confidence thresholds deterministically', () => {
    expect(determineConfidence(5, true, true)).toBe('high')
    expect(determineConfidence(3, true, false)).toBe('medium')
    expect(determineConfidence(1, false, false)).toBe('low')
  })
})
