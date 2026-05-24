import { config } from 'dotenv'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { buildApifyReplacementBakeoffPlan } from '../lib/apify-replacement-bakeoff'

config({ path: resolve(process.cwd(), '.env.local') })

const args = new Set(process.argv.slice(2))
const shouldRun = args.has('--run')
const outputArg = process.argv.find((arg) => arg.startsWith('--out='))
const outputPath = outputArg?.slice('--out='.length)

async function runBraveSearch(query: string) {
  const key = process.env.BRAVE_SEARCH_API_KEY
  if (!key) return null

  const url = new URL('https://api.search.brave.com/res/v1/web/search')
  url.searchParams.set('q', query)
  url.searchParams.set('count', '5')

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': key,
    },
  })

  if (!response.ok) {
    return { ok: false, status: response.status, resultCount: 0 }
  }

  const body = await response.json() as { web?: { results?: unknown[] } }
  return { ok: true, status: response.status, resultCount: body.web?.results?.length ?? 0 }
}

async function runGooglePlacesTextSearch(query: string) {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return null

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.websiteUri',
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 5 }),
  })

  if (!response.ok) {
    return { ok: false, status: response.status, resultCount: 0 }
  }

  const body = await response.json() as { places?: unknown[] }
  return { ok: true, status: response.status, resultCount: body.places?.length ?? 0 }
}

async function main() {
  const plan = buildApifyReplacementBakeoffPlan()
  const liveResults: Array<{
    category: string
    challenger: string
    status: 'skipped' | 'ready' | 'ok' | 'failed'
    resultCount: number
    note: string
  }> = []

  for (const test of plan.tests) {
    if (!shouldRun || test.status === 'blocked') {
      liveResults.push({
        category: test.category,
        challenger: test.challenger,
        status: test.status === 'blocked' ? 'skipped' : 'ready',
        resultCount: 0,
        note: test.status === 'blocked'
          ? `Missing env: ${test.missingEnv.join(', ')}`
          : 'Ready for manual/browser review.',
      })
      continue
    }

    if (test.challenger.startsWith('Brave Search')) {
      const result = await runBraveSearch(test.sampleQuery)
      liveResults.push({
        category: test.category,
        challenger: test.challenger,
        status: result?.ok ? 'ok' : 'failed',
        resultCount: result?.resultCount ?? 0,
        note: result ? `HTTP ${result.status}` : 'Missing Brave key',
      })
      continue
    }

    if (test.challenger.startsWith('Google Places')) {
      const result = await runGooglePlacesTextSearch(test.sampleQuery)
      liveResults.push({
        category: test.category,
        challenger: test.challenger,
        status: result?.ok ? 'ok' : 'failed',
        resultCount: result?.resultCount ?? 0,
        note: result ? `HTTP ${result.status}` : 'Missing Google Maps key',
      })
      continue
    }

    liveResults.push({
      category: test.category,
      challenger: test.challenger,
      status: 'ready',
      resultCount: 0,
      note: 'Manual/browser-agent packet; no API call made by this script.',
    })
  }

  const report = {
    ...plan,
    mode: shouldRun ? 'run' : 'dry_run',
    liveResults,
  }

  const serialized = JSON.stringify(report, null, 2)
  if (outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, `${serialized}\n`)
  }

  console.log(serialized)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
