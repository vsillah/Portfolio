import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { classifyMarketIntel } from '@/lib/market-intel-classifier'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/value-evidence/ingest-market
 * 
 * Ingest raw market intelligence data from n8n social scraping workflows.
 * Authenticated via N8N_INGEST_SECRET.
 */

interface MarketIntelligenceItem {
  source_platform: string
  source_url?: string
  source_author?: string
  content_text: string
  content_type: string
  industry_detected?: string
  company_size_detected?: string
  author_role_detected?: string
  monetary_mentions?: Array<{ amount: number; context: string }>
  sentiment_score?: number
  relevance_score?: number
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  const expectedSecret = process.env.N8N_INGEST_SECRET

  if (!expectedSecret || token !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const items: MarketIntelligenceItem[] = body.items || []
    const contactSubmissionId: number | undefined = body.contact_submission_id

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'items array is required and must not be empty' },
        { status: 400 }
      )
    }

    const results = {
      total: items.length,
      inserted: 0,
      duplicates: 0,
      errors: [] as string[],
    }

    const VALID_PLATFORMS = ['linkedin', 'reddit', 'g2', 'capterra', 'trustradius', 'facebook', 'twitter', 'google_maps']
    const VALID_CONTENT_TYPES = ['post', 'comment', 'review', 'question', 'article', 'other']

    for (const item of items) {
      try {
        if (!item.source_platform || !item.content_text || !item.content_type) {
          results.errors.push('Missing required fields: source_platform, content_text, content_type')
          continue
        }

        if (!VALID_PLATFORMS.includes(item.source_platform)) {
          results.errors.push(`Invalid source_platform "${item.source_platform}". Must be one of: ${VALID_PLATFORMS.join(', ')}`)
          continue
        }
        if (!VALID_CONTENT_TYPES.includes(item.content_type)) {
          results.errors.push(`Invalid content_type "${item.content_type}". Must be one of: ${VALID_CONTENT_TYPES.join(', ')}`)
          continue
        }

        // Clamp relevance_score to 0-10 (DB CHECK constraint: BETWEEN 0 AND 10)
        let relevanceScore: number | null = item.relevance_score ?? null
        if (relevanceScore != null) {
          relevanceScore = Math.round(relevanceScore)
          if (relevanceScore < 0 || relevanceScore > 10) relevanceScore = null
        }

        const row: Record<string, unknown> = {
          source_platform: item.source_platform,
          source_url: item.source_url || null,
          source_author: item.source_author || null,
          content_text: item.content_text,
          content_type: item.content_type,
          industry_detected: item.industry_detected ?? null,
          company_size_detected: item.company_size_detected ?? null,
          author_role_detected: item.author_role_detected ?? null,
          monetary_mentions: item.monetary_mentions ?? [],
          sentiment_score: item.sentiment_score ?? null,
          relevance_score: relevanceScore,
          is_processed: false,
        }
        if (contactSubmissionId) {
          row.contact_submission_id = contactSubmissionId
        }

        if (item.source_url) {
          // DB has a partial unique index on source_url (WHERE source_url IS NOT NULL AND != '').
          // upsert with ignoreDuplicates skips rows that conflict — no race condition.
          const { error: upsertError, count } = await supabaseAdmin
            .from('market_intelligence')
            .upsert(row, { onConflict: 'source_url', ignoreDuplicates: true, count: 'exact' })

          if (upsertError) {
            results.errors.push(`Upsert failed: ${upsertError.message}`)
            continue
          }
          if (count === 0) {
            results.duplicates++
          } else {
            results.inserted++
          }
        } else {
          // No source_url — no dedup possible, just insert
          const { error: insertError } = await supabaseAdmin
            .from('market_intelligence')
            .insert(row)

          if (insertError) {
            results.errors.push(`Insert failed: ${insertError.message}`)
            continue
          }
          results.inserted++
        }
      } catch (itemError: any) {
        results.errors.push(`Unexpected error: ${itemError.message}`)
      }
    }

    // Auto-classify newly inserted records into pain point evidence
    let classification: { evidenceCreated: number; irrelevant: number } | null = null
    if (results.inserted > 0) {
      try {
        const classifyResult = await classifyMarketIntel(results.inserted)
        classification = {
          evidenceCreated: classifyResult.evidenceCreated,
          irrelevant: classifyResult.irrelevant,
        }
        if (classifyResult.errors.length > 0) {
          results.errors.push(...classifyResult.errors.map(e => `[classify] ${e}`))
        }
      } catch (classifyError: any) {
        console.error('Auto-classification failed (non-blocking):', classifyError)
        results.errors.push(`[classify] ${classifyError.message}`)
      }
    }

    return NextResponse.json({ ...results, classification })
  } catch (error: any) {
    console.error('Market intelligence ingest error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
