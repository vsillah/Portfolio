/**
 * Canonical industry definitions aligned with the GICS (Global Industry
 * Classification Standard) framework at the Industry tier (6-digit codes).
 *
 * Single source of truth for industry slugs, GICS codes, display labels,
 * and sector mappings. All other files (UI dropdowns, seed scripts, API
 * validation, migrations) should import from here.
 *
 * GICS reference: https://www.msci.com/indexes/index-resources/gics
 *
 * When adding/removing industries: update this file, insert matching
 * industry_benchmarks rows, and run seed-value-calculations.ts.
 */

export interface IndustryDefinition {
  slug: string
  gicsCode: string
  gicsIndustryName: string
  sectorCode: string
  sectorName: string
  displayName: string
  isCustomExtension: boolean
  isNonprofit: boolean
}

/**
 * All supported industries keyed by slug.
 * Slugs are the values stored in industry_benchmarks.industry,
 * value_calculations.industry, value_reports.industry, etc.
 */
export const INDUSTRIES: Record<string, IndustryDefinition> = {
  professional_services: {
    slug: 'professional_services',
    gicsCode: '202020',
    gicsIndustryName: 'Professional Services',
    sectorCode: '20',
    sectorName: 'Industrials',
    displayName: 'Professional Services',
    isCustomExtension: false,
    isNonprofit: false,
  },
  management_consulting: {
    slug: 'management_consulting',
    gicsCode: '202020',
    gicsIndustryName: 'Professional Services',
    sectorCode: '20',
    sectorName: 'Industrials',
    displayName: 'Management Consulting',
    isCustomExtension: false,
    isNonprofit: false,
  },
  saas: {
    slug: 'saas',
    gicsCode: '451030',
    gicsIndustryName: 'Software',
    sectorCode: '45',
    sectorName: 'Information Technology',
    displayName: 'SaaS / Software',
    isCustomExtension: false,
    isNonprofit: false,
  },
  ecommerce: {
    slug: 'ecommerce',
    gicsCode: '255030',
    gicsIndustryName: 'Broadline Retail',
    sectorCode: '25',
    sectorName: 'Consumer Discretionary',
    displayName: 'E-Commerce',
    isCustomExtension: false,
    isNonprofit: false,
  },
  healthcare: {
    slug: 'healthcare',
    gicsCode: '351020',
    gicsIndustryName: 'Health Care Providers & Services',
    sectorCode: '35',
    sectorName: 'Health Care',
    displayName: 'Healthcare',
    isCustomExtension: false,
    isNonprofit: false,
  },
  finance: {
    slug: 'finance',
    gicsCode: '402010',
    gicsIndustryName: 'Financial Services',
    sectorCode: '40',
    sectorName: 'Financials',
    displayName: 'Financial Services',
    isCustomExtension: false,
    isNonprofit: false,
  },
  real_estate: {
    slug: 'real_estate',
    gicsCode: '602010',
    gicsIndustryName: 'Real Estate Management & Development',
    sectorCode: '60',
    sectorName: 'Real Estate',
    displayName: 'Real Estate',
    isCustomExtension: false,
    isNonprofit: false,
  },
  insurance: {
    slug: 'insurance',
    gicsCode: '403010',
    gicsIndustryName: 'Insurance',
    sectorCode: '40',
    sectorName: 'Financials',
    displayName: 'Insurance',
    isCustomExtension: false,
    isNonprofit: false,
  },
  marketing: {
    slug: 'marketing',
    gicsCode: '502010',
    gicsIndustryName: 'Media',
    sectorCode: '50',
    sectorName: 'Communication Services',
    displayName: 'Marketing & Advertising',
    isCustomExtension: false,
    isNonprofit: false,
  },
  manufacturing: {
    slug: 'manufacturing',
    gicsCode: '201060',
    gicsIndustryName: 'Machinery',
    sectorCode: '20',
    sectorName: 'Industrials',
    displayName: 'Manufacturing',
    isCustomExtension: false,
    isNonprofit: false,
  },
  retail: {
    slug: 'retail',
    gicsCode: '255040',
    gicsIndustryName: 'Specialty Retail',
    sectorCode: '25',
    sectorName: 'Consumer Discretionary',
    displayName: 'Retail',
    isCustomExtension: false,
    isNonprofit: false,
  },
  nonprofit: {
    slug: 'nonprofit',
    gicsCode: '900010',
    gicsIndustryName: 'Nonprofit & Civic Organizations',
    sectorCode: '90',
    sectorName: 'Custom Extension',
    displayName: 'Nonprofit / NGO',
    isCustomExtension: true,
    isNonprofit: true,
  },
  education: {
    slug: 'education',
    gicsCode: '253020',
    gicsIndustryName: 'Diversified Consumer Services',
    sectorCode: '25',
    sectorName: 'Consumer Discretionary',
    displayName: 'Education',
    isCustomExtension: false,
    isNonprofit: true,
  },
} as const

/** The fallback slug used when no industry-specific benchmark exists */
export const DEFAULT_INDUSTRY_SLUG = '_default'
export const DEFAULT_INDUSTRY_GICS_CODE = '000000'

/** All industry slugs (excluding _default) */
export const INDUSTRY_SLUGS = Object.keys(INDUSTRIES) as string[]

/** Lookup display name for a slug, with fallback formatting */
export function getIndustryDisplayName(slug: string): string {
  if (slug === DEFAULT_INDUSTRY_SLUG) return 'Default (fallback)'
  return INDUSTRIES[slug]?.displayName ?? slug.replace(/_/g, ' ')
}

/** Lookup GICS code for a slug */
export function getIndustryGicsCode(slug: string): string {
  if (slug === DEFAULT_INDUSTRY_SLUG) return DEFAULT_INDUSTRY_GICS_CODE
  return INDUSTRIES[slug]?.gicsCode ?? DEFAULT_INDUSTRY_GICS_CODE
}

/** Get all industries as a sorted array (for dropdowns) */
export function getIndustryOptions(): Array<{ value: string; label: string }> {
  return Object.values(INDUSTRIES)
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .map(ind => ({ value: ind.slug, label: ind.displayName }))
}

/** Industries that should use nonprofit/CI tier pricing */
export function isNonprofitIndustry(slug: string): boolean {
  return INDUSTRIES[slug]?.isNonprofit ?? false
}

/**
 * Slug-to-GICS mapping for data migration.
 * Includes _default for completeness.
 */
export const SLUG_TO_GICS: Record<string, string> = {
  ...Object.fromEntries(Object.values(INDUSTRIES).map(i => [i.slug, i.gicsCode])),
  _default: DEFAULT_INDUSTRY_GICS_CODE,
}
