import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/value-evidence/ingest
 * 
 * Ingest classified pain point evidence from n8n workflows or manual entry.
 * Authenticated via N8N_INGEST_SECRET (same as outreach ingest).
 */

interface IngestEvidence {
  pain_point_category_name: string   // Will be looked up or created
  pain_point_display_name?: string   // For new categories
  pain_point_description?: string    // For new categories
  source_type: string
  source_id: string
  source_excerpt: string
  industry?: string
  company_size?: string
  monetary_indicator?: number
  monetary_context?: string
  confidence_score?: number
  extracted_by?: string
  contact_submission_id?: number
}

export async function POST(request: NextRequest) {
  // Authenticate via bearer token (same pattern as outreach ingest)
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  const expectedSecret = process.env.N8N_INGEST_SECRET

  if (!expectedSecret || token !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const evidenceItems: IngestEvidence[] = body.evidence || []

    if (!Array.isArray(evidenceItems)) {
      return NextResponse.json(
        { error: 'evidence must be an array' },
        { status: 400 }
      )
    }

    // Accept empty arrays gracefully (e.g. n8n AI classifier found no pain points)
    if (evidenceItems.length === 0) {
      return NextResponse.json({ total: 0, inserted: 0, categoriesCreated: 0, errors: [] })
    }

    const results = {
      total: evidenceItems.length,
      inserted: 0,
      categoriesCreated: 0,
      errors: [] as string[],
    }

    const insertedContactIds = new Set<number>()

    for (const item of evidenceItems) {
      try {
        // Validate required fields
        if (!item.pain_point_category_name || !item.source_type || !item.source_id || !item.source_excerpt) {
          results.errors.push(`Missing required fields for item: ${JSON.stringify(item).substring(0, 100)}`)
          continue
        }

        // Look up or create pain point category
        let categoryId: string
        const { data: existingCategory } = await supabaseAdmin
          .from('pain_point_categories')
          .select('id')
          .eq('name', item.pain_point_category_name)
          .single()

        if (existingCategory) {
          categoryId = existingCategory.id
        } else {
          // Create new category
          const { data: newCategory, error: createError } = await supabaseAdmin
            .from('pain_point_categories')
            .insert({
              name: item.pain_point_category_name,
              display_name: item.pain_point_display_name || item.pain_point_category_name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
              description: item.pain_point_description || null,
              industry_tags: item.industry ? [item.industry] : [],
            })
            .select('id')
            .single()

          if (createError || !newCategory) {
            results.errors.push(`Failed to create category ${item.pain_point_category_name}: ${createError?.message}`)
            continue
          }
          categoryId = newCategory.id
          results.categoriesCreated++
        }

        // Insert evidence
        const { error: insertError } = await supabaseAdmin
          .from('pain_point_evidence')
          .insert({
            pain_point_category_id: categoryId,
            source_type: item.source_type,
            source_id: item.source_id,
            source_excerpt: item.source_excerpt,
            industry: item.industry || null,
            company_size: item.company_size || null,
            monetary_indicator: item.monetary_indicator ?? null,
            monetary_context: item.monetary_context ?? null,
            confidence_score: item.confidence_score ?? 0.5,
            extracted_by: item.extracted_by ?? 'ai_classifier',
            contact_submission_id: item.contact_submission_id ?? null,
          })

        if (insertError) {
          results.errors.push(`Failed to insert evidence: ${insertError.message}`)
          continue
        }

        results.inserted++
        if (item.contact_submission_id != null) {
          insertedContactIds.add(item.contact_submission_id)
        }

        // Update frequency count on category
        await supabaseAdmin.rpc('increment_counter', {
          table_name: 'pain_point_categories',
          column_name: 'frequency_count',
          row_id: categoryId,
        }).catch(() => {
          // Fallback: manual increment if RPC doesn't exist
          supabaseAdmin
            .from('pain_point_categories')
            .select('frequency_count')
            .eq('id', categoryId)
            .single()
            .then(({ data }: { data: { frequency_count: number } | null }) => {
              if (data) {
                supabaseAdmin
                  .from('pain_point_categories')
                  .update({ frequency_count: (data.frequency_count ?? 0) + 1 })
                  .eq('id', categoryId)
                  .then(() => {})
              }
            })
        })

        // Update industry_tags if new industry
        if (item.industry) {
          const { data: cat } = await supabaseAdmin
            .from('pain_point_categories')
            .select('industry_tags')
            .eq('id', categoryId)
            .single()

          if (cat && !cat.industry_tags?.includes(item.industry)) {
            await supabaseAdmin
              .from('pain_point_categories')
              .update({
                industry_tags: [...(cat.industry_tags || []), item.industry],
              })
              .eq('id', categoryId)
          }
        }
      } catch (itemError: any) {
        results.errors.push(`Unexpected error: ${itemError.message}`)
      }
    }

    if (insertedContactIds.size > 0) {
      const ids = [...insertedContactIds]
      const { error: statusError } = await supabaseAdmin
        .from('contact_submissions')
        .update({ last_vep_status: 'success' })
        .eq('last_vep_status', 'pending')
        .in('id', ids)
      if (statusError) {
        console.warn('Failed to update last_vep_status:', statusError.message)
      }
    }

    return NextResponse.json(results)
  } catch (error: any) {
    console.error('Value evidence ingest error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
