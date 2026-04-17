/**
 * VEP Source Validator - trust-tier taxonomy
 *
 * Maps source domains (and loose source strings) to the BCG/McKinsey-style
 * source hierarchy:
 *
 *   T1 - Government / regulatory / academic / primary data
 *        (SEC filings, BLS, Census, Eurostat, NBER, .gov, .edu)
 *   T2 - Major analyst / licensed data providers
 *        (Gartner, Forrester, IDC, S&P, Bloomberg, McKinsey, BCG, Statista,
 *         IBISWorld, Pitchbook, CB Insights)
 *   T3 - Industry associations + established trade publications
 *        (NAR, NRF, HIMSS, trade magazines)
 *   T4 - Reputable press
 *        (FT, WSJ, Reuters, NYT, Bloomberg News, The Economist, HBR)
 *   T5 - General web / blogs / user-generated (default)
 *
 * Patterns are PCRE-ish (compiled with the `i` flag). They match against:
 *   - the hostname of the source_url when present
 *   - the free-text `source` column (e.g. "BLS", "Glassdoor Finance Salary Report")
 *
 * Order matters only insofar as ties are broken by lowest tier number (most
 * trusted) across multiple matches.
 */

import type { TrustTier } from './types'

interface TierPattern {
  pattern: RegExp
  tier: TrustTier
  label: string
}

const HOST_PATTERNS: TierPattern[] = [
  // T1 - Government / regulatory / academic
  { pattern: /(^|\.)sec\.gov$/i, tier: 1, label: 'SEC' },
  { pattern: /(^|\.)bls\.gov$/i, tier: 1, label: 'BLS' },
  { pattern: /(^|\.)census\.gov$/i, tier: 1, label: 'Census' },
  { pattern: /(^|\.)bea\.gov$/i, tier: 1, label: 'BEA' },
  { pattern: /(^|\.)federalreserve\.gov$/i, tier: 1, label: 'Federal Reserve' },
  { pattern: /(^|\.)ftc\.gov$/i, tier: 1, label: 'FTC' },
  { pattern: /\.gov$/i, tier: 1, label: 'US government' },
  { pattern: /(^|\.)eurostat\.(ec\.)?europa\.eu$/i, tier: 1, label: 'Eurostat' },
  { pattern: /(^|\.)europa\.eu$/i, tier: 1, label: 'EU institutions' },
  { pattern: /(^|\.)oecd\.org$/i, tier: 1, label: 'OECD' },
  { pattern: /(^|\.)worldbank\.org$/i, tier: 1, label: 'World Bank' },
  { pattern: /(^|\.)imf\.org$/i, tier: 1, label: 'IMF' },
  { pattern: /(^|\.)un\.org$/i, tier: 1, label: 'United Nations' },
  { pattern: /(^|\.)nber\.org$/i, tier: 1, label: 'NBER' },
  { pattern: /\.edu$/i, tier: 1, label: 'Academic' },

  // T2 - Major analyst / licensed data
  { pattern: /(^|\.)gartner\.com$/i, tier: 2, label: 'Gartner' },
  { pattern: /(^|\.)forrester\.com$/i, tier: 2, label: 'Forrester' },
  { pattern: /(^|\.)idc\.com$/i, tier: 2, label: 'IDC' },
  { pattern: /(^|\.)mckinsey\.com$/i, tier: 2, label: 'McKinsey' },
  { pattern: /(^|\.)bcg\.com$/i, tier: 2, label: 'BCG' },
  { pattern: /(^|\.)bain\.com$/i, tier: 2, label: 'Bain' },
  { pattern: /(^|\.)deloitte\.com$/i, tier: 2, label: 'Deloitte' },
  { pattern: /(^|\.)pwc\.com$/i, tier: 2, label: 'PwC' },
  { pattern: /(^|\.)ey\.com$/i, tier: 2, label: 'EY' },
  { pattern: /(^|\.)kpmg\.com$/i, tier: 2, label: 'KPMG' },
  { pattern: /(^|\.)accenture\.com$/i, tier: 2, label: 'Accenture' },
  { pattern: /(^|\.)statista\.com$/i, tier: 2, label: 'Statista' },
  { pattern: /(^|\.)ibisworld\.com$/i, tier: 2, label: 'IBISWorld' },
  { pattern: /(^|\.)pitchbook\.com$/i, tier: 2, label: 'PitchBook' },
  { pattern: /(^|\.)cbinsights\.com$/i, tier: 2, label: 'CB Insights' },
  { pattern: /(^|\.)crunchbase\.com$/i, tier: 2, label: 'Crunchbase' },
  { pattern: /(^|\.)spglobal\.com$/i, tier: 2, label: 'S&P Global' },
  { pattern: /(^|\.)bloomberg\.com$/i, tier: 2, label: 'Bloomberg' },
  { pattern: /(^|\.)ponemon\.org$/i, tier: 2, label: 'Ponemon Institute' },

  // T3 - Trade associations / industry publications
  { pattern: /(^|\.)nar\.realtor$/i, tier: 3, label: 'National Association of Realtors' },
  { pattern: /(^|\.)realtor\.com$/i, tier: 3, label: 'Realtor.com' },
  { pattern: /(^|\.)nrf\.com$/i, tier: 3, label: 'National Retail Federation' },
  { pattern: /(^|\.)himss\.org$/i, tier: 3, label: 'HIMSS' },
  { pattern: /(^|\.)ama-assn\.org$/i, tier: 3, label: 'American Medical Association' },
  { pattern: /(^|\.)asq\.org$/i, tier: 3, label: 'ASQ' },
  { pattern: /(^|\.)hubspot\.com$/i, tier: 3, label: 'HubSpot research' },
  { pattern: /(^|\.)shopify\.com$/i, tier: 3, label: 'Shopify research' },
  { pattern: /(^|\.)salesforce\.com$/i, tier: 3, label: 'Salesforce research' },
  { pattern: /(^|\.)glassdoor\.com$/i, tier: 3, label: 'Glassdoor' },
  { pattern: /(^|\.)linkedin\.com$/i, tier: 3, label: 'LinkedIn' },
  { pattern: /(^|\.)insurancejournal\.com$/i, tier: 3, label: 'Insurance Journal' },
  { pattern: /(^|\.)themanufacturinginstitute\.org$/i, tier: 3, label: 'Manufacturing Institute' },

  // T4 - Reputable press
  { pattern: /(^|\.)ft\.com$/i, tier: 4, label: 'Financial Times' },
  { pattern: /(^|\.)wsj\.com$/i, tier: 4, label: 'Wall Street Journal' },
  { pattern: /(^|\.)nytimes\.com$/i, tier: 4, label: 'New York Times' },
  { pattern: /(^|\.)reuters\.com$/i, tier: 4, label: 'Reuters' },
  { pattern: /(^|\.)economist\.com$/i, tier: 4, label: 'The Economist' },
  { pattern: /(^|\.)hbr\.org$/i, tier: 4, label: 'Harvard Business Review' },
  { pattern: /(^|\.)forbes\.com$/i, tier: 4, label: 'Forbes' },
  { pattern: /(^|\.)fortune\.com$/i, tier: 4, label: 'Fortune' },
  { pattern: /(^|\.)cnbc\.com$/i, tier: 4, label: 'CNBC' },
  { pattern: /(^|\.)techcrunch\.com$/i, tier: 4, label: 'TechCrunch' },
]

/**
 * Loose patterns that match against the free-text `source` column when no URL
 * is present (e.g. "BLS", "Glassdoor Finance Salary Report"). Order: first
 * match wins within a tier; we take the best tier across all matches.
 */
const FREE_TEXT_PATTERNS: TierPattern[] = [
  // T1
  { pattern: /\bBLS\b|Bureau of Labor Statistics/i, tier: 1, label: 'BLS' },
  { pattern: /\bSEC\b|Securities and Exchange/i, tier: 1, label: 'SEC' },
  { pattern: /\bBEA\b|Bureau of Economic Analysis/i, tier: 1, label: 'BEA' },
  { pattern: /\bCensus\b/i, tier: 1, label: 'Census' },
  { pattern: /Federal Reserve/i, tier: 1, label: 'Federal Reserve' },
  { pattern: /\bOECD\b/i, tier: 1, label: 'OECD' },
  { pattern: /World Bank|IMF/i, tier: 1, label: 'World Bank / IMF' },
  { pattern: /\bNBER\b/i, tier: 1, label: 'NBER' },

  // T2
  { pattern: /Gartner/i, tier: 2, label: 'Gartner' },
  { pattern: /Forrester/i, tier: 2, label: 'Forrester' },
  { pattern: /\bIDC\b/i, tier: 2, label: 'IDC' },
  { pattern: /McKinsey/i, tier: 2, label: 'McKinsey' },
  { pattern: /\bBCG\b|Boston Consulting/i, tier: 2, label: 'BCG' },
  { pattern: /Deloitte|PwC|PricewaterhouseCoopers|KPMG|\bEY\b|Ernst & Young/i, tier: 2, label: 'Big 4 advisory' },
  { pattern: /Statista/i, tier: 2, label: 'Statista' },
  { pattern: /IBISWorld/i, tier: 2, label: 'IBISWorld' },
  { pattern: /PitchBook|CB Insights|Crunchbase/i, tier: 2, label: 'VC/deal data' },
  { pattern: /Bloomberg/i, tier: 2, label: 'Bloomberg' },
  { pattern: /S&P|Standard & Poor/i, tier: 2, label: 'S&P Global' },
  { pattern: /Ponemon/i, tier: 2, label: 'Ponemon Institute' },

  // T3
  { pattern: /Glassdoor/i, tier: 3, label: 'Glassdoor' },
  { pattern: /HubSpot/i, tier: 3, label: 'HubSpot research' },
  { pattern: /Shopify/i, tier: 3, label: 'Shopify research' },
  { pattern: /Salesforce/i, tier: 3, label: 'Salesforce research' },
  { pattern: /\bNAR\b|National Association of Realtors/i, tier: 3, label: 'NAR' },
  { pattern: /\bNRF\b|National Retail Federation/i, tier: 3, label: 'NRF' },
  { pattern: /HIMSS/i, tier: 3, label: 'HIMSS' },
  { pattern: /Insurance Journal/i, tier: 3, label: 'Insurance Journal' },
  { pattern: /Zillow/i, tier: 3, label: 'Zillow' },
  { pattern: /Medical Economics/i, tier: 3, label: 'Medical Economics' },
  { pattern: /Manufacturing Institute/i, tier: 3, label: 'Manufacturing Institute' },
  { pattern: /\bASQ\b/i, tier: 3, label: 'ASQ' },

  // T4
  { pattern: /Financial Times|\bFT\b/i, tier: 4, label: 'Financial Times' },
  { pattern: /Wall Street Journal|\bWSJ\b/i, tier: 4, label: 'Wall Street Journal' },
  { pattern: /New York Times/i, tier: 4, label: 'New York Times' },
  { pattern: /Reuters/i, tier: 4, label: 'Reuters' },
  { pattern: /\bEconomist\b/i, tier: 4, label: 'The Economist' },
  { pattern: /Harvard Business Review|\bHBR\b/i, tier: 4, label: 'HBR' },
  { pattern: /Forbes|Fortune|CNBC|TechCrunch/i, tier: 4, label: 'Business press' },
]

/**
 * Known to be unreliable / generic - force T5 and add a warning reason.
 */
const LOW_TRUST_FREE_TEXT: RegExp[] = [
  /industry estimate/i,
  /anecdotal/i,
  /internal estimate/i,
  /in-?house/i,
]

/**
 * Hosts we should not attempt to fetch (rate-limit friendly, paywalled, or
 * explicitly disallowed).
 */
export const FETCH_DENYLIST: RegExp[] = [
  /(^|\.)facebook\.com$/i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)tiktok\.com$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)linkedin\.com$/i, // frequent 999; we still tier it T3 but don't fetch
  /(^|\.)reddit\.com$/i,
]

export interface TierAssignment {
  tier: TrustTier
  label: string
  matched_on: 'host' | 'free_text' | 'default'
  matched_pattern?: string
}

export function extractHostname(url?: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url.trim())
    return u.hostname.toLowerCase()
  } catch {
    return null
  }
}

export function isFetchDenylisted(host: string | null): boolean {
  if (!host) return false
  return FETCH_DENYLIST.some((rx) => rx.test(host))
}

/**
 * Classify a source (URL + free-text) into a trust tier.
 * Strategy: take the best (lowest numeric) tier across all matches.
 */
export function classifyTier(
  sourceUrl: string | null | undefined,
  sourceText: string | null | undefined
): TierAssignment {
  const hits: Array<TierAssignment> = []

  const host = extractHostname(sourceUrl)
  if (host) {
    for (const p of HOST_PATTERNS) {
      if (p.pattern.test(host)) {
        hits.push({ tier: p.tier, label: p.label, matched_on: 'host', matched_pattern: p.pattern.source })
      }
    }
  }

  if (sourceText) {
    // Explicit low-trust free text forces T5.
    for (const rx of LOW_TRUST_FREE_TEXT) {
      if (rx.test(sourceText)) {
        hits.push({ tier: 5, label: 'low-trust free text', matched_on: 'free_text', matched_pattern: rx.source })
      }
    }
    for (const p of FREE_TEXT_PATTERNS) {
      if (p.pattern.test(sourceText)) {
        hits.push({ tier: p.tier, label: p.label, matched_on: 'free_text', matched_pattern: p.pattern.source })
      }
    }
  }

  if (hits.length === 0) {
    return { tier: 5, label: 'Unclassified / general web', matched_on: 'default' }
  }

  // Prefer host-based hits over free-text at the same tier (URL is more
  // verifiable). Then pick the best (lowest) tier.
  hits.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier
    if (a.matched_on === 'host' && b.matched_on !== 'host') return -1
    if (b.matched_on === 'host' && a.matched_on !== 'host') return 1
    return 0
  })

  return hits[0]
}

/**
 * Domain-type-aware TTLs used by the fetch cache and freshness windows.
 * Keep in sync with freshness.ts domain-type mapping.
 */
export function inferDomainType(host: string | null, sourceText: string | null | undefined):
  | 'government'
  | 'analyst'
  | 'trade'
  | 'press'
  | 'general' {
  const tier = classifyTier(host ? `https://${host}` : null, sourceText).tier
  if (tier === 1) return 'government'
  if (tier === 2) return 'analyst'
  if (tier === 3) return 'trade'
  if (tier === 4) return 'press'
  return 'general'
}
