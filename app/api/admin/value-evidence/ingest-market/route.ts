import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

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

    for (const item of items) {
      try {
        if (!item.source_platform || !item.content_text || !item.content_type) {
          results.errors.push('Missing required fields: source_platform, content_text, content_type')
          continue
        }

        // Dedup by source_url if provided
        if (item.source_url) {
          const { data: existing } = await supabaseAdmin
            .from('market_intelligence')
            .select('id')
            .eq('source_url', item.source_url)
            .limit(1)
            .single()

          if (existing) {
            results.duplicates++
            continue
          }
        }

        const { error: insertError } = await supabaseAdmin
          .from('market_intelligence')
          .insert({
            source_platform: item.source_platform,
            source_url: item.source_url || null,
            source_author: item.source_author || null,
            content_text: item.content_text,
            content_type: item.content_type,
            industry_detected: item.industry_detected || null,
            company_size_detected: item.company_size_detected || null,
            author_role_detected: item.author_role_detected || null,
            monetary_mentions: item.monetary_mentions || [],
            sentiment_score: item.sentiment_score || null,
            relevance_score: item.relevance_score || null,
            is_processed: false,
          })

        if (insertError) {
          results.errors.push(`Insert failed: ${insertError.message}`)
          continue
        }

        results.inserted++
      } catch (itemError: any) {
        results.errors.push(`Unexpected error: ${itemError.message}`)
      }
    }

    return NextResponse.json(results)
  } catch (error: any) {
    console.error('Market intelligence ingest error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
