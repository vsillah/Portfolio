/**
 * One-off script: copy market_intelligence rows from prod to dev
 * for platforms missing in dev (linkedin, g2, capterra).
 * Then classify them.
 *
 * Usage: npx tsx scripts/sync-market-intel-to-dev.ts
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

import { createClient } from '@supabase/supabase-js'

const prodUrl = process.env.PROD_SUPABASE_URL!
const prodKey = process.env.PROD_SUPABASE_SERVICE_ROLE_KEY!
const devUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const devKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!prodUrl || !prodKey || !devUrl || !devKey) {
  console.error('Missing prod or dev Supabase env vars')
  process.exit(1)
}

const prod = createClient(prodUrl, prodKey)
const dev = createClient(devUrl, devKey)

async function main() {
  const platforms = ['linkedin', 'g2', 'capterra']

  console.log(`Fetching from PROD (${prodUrl}) platforms: ${platforms.join(', ')}`)

  const { data: rows, error } = await prod
    .from('market_intelligence')
    .select('source_platform, source_url, source_author, content_text, content_type, industry_detected, company_size_detected, author_role_detected, monetary_mentions, sentiment_score, relevance_score')
    .in('source_platform', platforms)
    .order('scraped_at', { ascending: false })

  if (error) {
    console.error('Fetch failed:', error.message)
    process.exit(1)
  }

  console.log(`Fetched ${rows?.length ?? 0} rows from prod`)
  if (!rows?.length) return

  let inserted = 0
  let duplicates = 0
  let errors = 0

  for (const row of rows) {
    if (row.source_url) {
      const { data: existing } = await dev
        .from('market_intelligence')
        .select('id')
        .eq('source_url', row.source_url)
        .limit(1)
        .maybeSingle()

      if (existing) {
        duplicates++
        continue
      }
    }

    const record = {
      source_platform: row.source_platform,
      source_url: row.source_url || null,
      source_author: row.source_author || null,
      content_text: row.content_text,
      content_type: row.content_type,
      industry_detected: row.industry_detected || null,
      company_size_detected: row.company_size_detected || null,
      author_role_detected: row.author_role_detected || null,
      monetary_mentions: row.monetary_mentions ?? [],
      sentiment_score: row.sentiment_score ?? null,
      relevance_score: row.relevance_score ?? null,
      is_processed: false,
    }

    const { error: insertError } = await dev
      .from('market_intelligence')
      .insert(record)

    if (insertError) {
      if (errors < 3) console.error('  Insert error:', insertError.message)
      errors++
      continue
    }
    inserted++
  }

  console.log(`\nInserted: ${inserted}, Duplicates: ${duplicates}, Errors: ${errors}`)
  console.log('\nNow run: npx tsx scripts/classify-market-intel.ts')
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
