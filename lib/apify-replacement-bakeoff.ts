export type ReplacementTestStatus = 'ready' | 'blocked' | 'manual_ready'

export interface ReplacementTestSpec {
  category: string
  currentApifySignal: string
  challenger: string
  requiredEnv: string[]
  sampleQuery: string
  acceptanceGate: string
  status: ReplacementTestStatus
  missingEnv: string[]
}

export interface ApifyReplacementBakeoffPlan {
  generatedAt: string
  readyCount: number
  blockedCount: number
  manualReadyCount: number
  tests: ReplacementTestSpec[]
  nextAction: string
}

const TEST_DEFINITIONS = [
  {
    category: 'Reddit listening',
    currentApifySignal: '72 items / $0.47360 sampled actor cost',
    challenger: 'Brave Search API with Reddit/source filters',
    requiredEnv: ['BRAVE_SEARCH_API_KEY'],
    sampleQuery: 'site:reddit.com nonprofit website migration pain points',
    acceptanceGate: 'Capture comparable conversations with source URLs, lower review burden, and acceptable attribution.',
  },
  {
    category: 'Google Maps',
    currentApifySignal: '68 items / $0.58600 sampled actor cost',
    challenger: 'Google Places API Text Search with field masks and strict quotas',
    requiredEnv: ['GOOGLE_MAPS_API_KEY'],
    sampleQuery: 'nonprofit organizations near Omaha NE',
    acceptanceGate: 'Return enough qualified businesses with required fields while staying inside free or low-tier quota.',
  },
  {
    category: 'LinkedIn post search',
    currentApifySignal: '135 items / $0.27220 sampled actor cost',
    challenger: 'Browser-agent sampling plus manual review packet',
    requiredEnv: [],
    sampleQuery: 'LinkedIn posts about nonprofit website migration',
    acceptanceGate: 'Return comparable accepted leads without increasing account risk or manual review time.',
  },
  {
    category: 'Capterra reviews',
    currentApifySignal: '40 items / $0.62400 sampled actor cost',
    challenger: 'Brave Search or browser capture into a source register',
    requiredEnv: ['BRAVE_SEARCH_API_KEY'],
    sampleQuery: 'site:capterra.com nonprofit CRM reviews implementation',
    acceptanceGate: 'Match accepted evidence quality while preserving reviewable source URLs and snippets.',
  },
] as const

export function buildApifyReplacementBakeoffPlan(
  env: Record<string, string | undefined> = process.env,
  generatedAt = new Date().toISOString()
): ApifyReplacementBakeoffPlan {
  const tests = TEST_DEFINITIONS.map((definition) => {
    const missingEnv = definition.requiredEnv.filter((key) => !env[key]?.trim())
    const status: ReplacementTestStatus = definition.requiredEnv.length === 0
      ? 'manual_ready'
      : missingEnv.length === 0
        ? 'ready'
        : 'blocked'

    return {
      ...definition,
      requiredEnv: [...definition.requiredEnv],
      missingEnv,
      status,
    }
  })

  const readyCount = tests.filter((test) => test.status === 'ready').length
  const blockedCount = tests.filter((test) => test.status === 'blocked').length
  const manualReadyCount = tests.filter((test) => test.status === 'manual_ready').length

  return {
    generatedAt,
    readyCount,
    blockedCount,
    manualReadyCount,
    tests,
    nextAction: blockedCount > 0
      ? 'Add the missing read-only replacement credentials, then rerun scripts/apify-replacement-bakeoff.ts --run.'
      : 'Run scripts/apify-replacement-bakeoff.ts --run and compare accepted-result rate against the Apify baseline.',
  }
}
