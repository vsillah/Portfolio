/**
 * Market Intelligence Auto-Classifier (server-side only)
 *
 * Matches raw market_intelligence rows to pain_point_categories using
 * keyword/phrase matching, then creates pain_point_evidence rows and
 * marks the source as processed.
 *
 * Designed to run automatically after market intel ingest — no human
 * in the loop needed.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { refreshCategoryStats, linkEvidenceToCalculations } from '@/lib/value-evidence-linker'

// ============================================================================
// Types
// ============================================================================

interface PainPointCategory {
  id: string
  name: string
  display_name: string
  description: string | null
  industry_tags: string[]
}

interface MarketIntelRow {
  id: string
  content_text: string
  source_platform: string
  source_url: string | null
  industry_detected: string | null
  company_size_detected: string | null
  monetary_mentions: Array<{ amount: number; context: string }> | null
}

interface ClassificationMatch {
  categoryId: string
  confidence: number
  matchedKeywords: string[]
}

export interface ClassifySummary {
  processed: number
  evidenceCreated: number
  irrelevant: number
  errors: string[]
}

// ============================================================================
// Keyword map per pain point category name
//
// Each entry is an array of phrases. A phrase can be multi-word; matching is
// case-insensitive and checks for substring presence in the content.
// ============================================================================

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  poor_lead_qualification: [
    'lead qualification', 'lead scoring', 'unqualified leads', 'bad leads',
    'lead quality', 'wasting time on leads', 'qualifying leads', 'lead filtering',
    'lead generation waste', 'wrong prospects', 'tire kickers', 'no-show',
    'sales pipeline', 'lead nurturing', 'conversion rate', 'sales funnel',
    'prospecting', 'cold outreach', 'lead management',
  ],
  scaling_bottlenecks: [
    'scaling', 'bottleneck', 'can\'t grow', 'growth limit', 'capacity constraint',
    'manual processes', 'can\'t scale', 'growth plateau', 'hiring to scale',
    'operational capacity', 'bandwidth', 'overwhelmed', 'too many clients',
    'can\'t take on more', 'growing pains', 'infrastructure limit',
  ],
  manual_reporting: [
    'manual report', 'reporting takes', 'spreadsheet report', 'hours on reports',
    'analytics manually', 'dashboard', 'kpi tracking', 'data visualization',
    'report generation', 'excel report', 'google sheets report',
    'time spent reporting', 'manual analytics',
  ],
  customer_churn: [
    'customer churn', 'losing customers', 'client retention', 'customer retention',
    'cancel', 'churn rate', 'customer attrition', 'lost clients',
    'customer leaving', 'reduce churn', 'proactive engagement', 'win back',
    'customer lifetime value', 'client turnover', 'subscription cancel',
  ],
  scattered_tools: [
    'data silo', 'scattered tools', 'too many tools', 'disconnected systems',
    'tool sprawl', 'integration', 'switching between', 'copy paste between',
    'double entry', 'duplicate data', 'fragmented', 'no single source of truth',
    'multiple platforms', 'context switching', 'app fatigue',
  ],
  inconsistent_followup: [
    'follow up', 'follow-up', 'followup', 'falling through the cracks',
    'forgot to follow', 'no follow up', 'missed follow', 'lead fell through',
    'dropped the ball', 'never heard back', 'inconsistent communication',
    'no response', 'ghosted', 'lost track',
  ],
  manual_data_entry: [
    'manual data entry', 'data entry', 'entering data', 'copy paste',
    'manual input', 'typing in', 'manually entering', 'repetitive entry',
    'form filling', 'data migration', 'transcription', 'keying in data',
  ],
  knowledge_loss: [
    'tribal knowledge', 'documentation', 'knowledge loss', 'brain drain',
    'key person risk', 'institutional knowledge', 'undocumented',
    'process documentation', 'onboarding documentation', 'knowledge base',
    'sop', 'standard operating', 'know-how', 'single point of failure',
  ],
  employee_onboarding: [
    'employee onboarding', 'new hire', 'onboarding process', 'ramp up time',
    'training new', 'time to productivity', 'onboarding slow',
    'orientation', 'new employee', 'staff training',
  ],
  slow_response_times: [
    'slow response', 'response time', 'delayed response', 'wait time',
    'client waiting', 'turnaround time', 'slow to reply', 'sla',
    'service level', 'ticket response', 'support response', 'queue',
  ],
  no_automation: [
    'no automation', 'lack of automation', 'everything manual', 'automate',
    'workflow automation', 'repetitive task', 'manual workflow', 'manual process',
    'could be automated', 'still doing it manually', 'automation opportunity',
  ],
  poor_communication: [
    'poor communication', 'miscommunication', 'communication gap',
    'information doesn\'t flow', 'nobody told me', 'email overload',
    'communication breakdown', 'team communication', 'internal communication',
    'siloed communication', 'slack overload',
  ],
  scattered_data: [
    'scattered data', 'data everywhere', 'data in spreadsheets',
    'can\'t find data', 'data access', 'data management',
    'unorganized data', 'messy data', 'data chaos',
  ],
}

const MIN_CONTENT_LENGTH = 50
const MIN_CONFIDENCE_THRESHOLD = 0.3

// ============================================================================
// Core Classifier
// ============================================================================

function classifyContent(
  content: string,
  categories: PainPointCategory[]
): ClassificationMatch[] {
  if (!content || content.length < MIN_CONTENT_LENGTH) return []

  const lower = content.toLowerCase()
  const matches: ClassificationMatch[] = []

  for (const cat of categories) {
    const keywords = CATEGORY_KEYWORDS[cat.name]
    if (!keywords) continue

    const matched: string[] = []
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        matched.push(kw)
      }
    }

    if (matched.length === 0) continue

    // Confidence based on keyword density: 1 match = 0.4, 2 = 0.6, 3+ = 0.75+
    const confidence = Math.min(0.9, 0.25 + matched.length * 0.15)

    if (confidence >= MIN_CONFIDENCE_THRESHOLD) {
      matches.push({
        categoryId: cat.id,
        confidence,
        matchedKeywords: matched,
      })
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence)
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Classify unprocessed market_intelligence rows, create pain_point_evidence,
 * and mark them processed. Processes in batches to avoid memory issues.
 *
 * @param limit  Max rows to process per call (default 100)
 * @param ids    Optional specific market_intelligence IDs to process
 */
export async function classifyMarketIntel(
  limit = 100,
  ids?: string[]
): Promise<ClassifySummary> {
  const sb = supabaseAdmin
  if (!sb) throw new Error('supabaseAdmin not available (server-side only)')

  const summary: ClassifySummary = {
    processed: 0,
    evidenceCreated: 0,
    irrelevant: 0,
    errors: [],
  }

  // Load active pain point categories
  const { data: categoriesRaw, error: catError } = await sb
    .from('pain_point_categories')
    .select('id, name, display_name, description, industry_tags')
    .eq('is_active', true)

  const categories: PainPointCategory[] = (categoriesRaw || []) as PainPointCategory[]

  if (catError || !categoriesRaw?.length) {
    summary.errors.push(`Failed to load categories: ${catError?.message ?? 'none found'}`)
    return summary
  }

  // Fetch unprocessed market intel
  let query = sb
    .from('market_intelligence')
    .select('id, content_text, source_platform, source_url, industry_detected, company_size_detected, monetary_mentions')
    .eq('is_processed', false)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (ids?.length) {
    query = query.in('id', ids)
  }

  const { data: rows, error: fetchError } = await query

  if (fetchError) {
    summary.errors.push(`Failed to fetch market intel: ${fetchError.message}`)
    return summary
  }

  if (!rows?.length) return summary

  const affectedCategoryIds = new Set<string>()

  for (const row of rows) {
    summary.processed++

    const matches = classifyContent(row.content_text, categories)

    if (matches.length === 0) {
      summary.irrelevant++
      // Mark as processed even if irrelevant — don't reprocess junk
      await sb
        .from('market_intelligence')
        .update({ is_processed: true, processed_at: new Date().toISOString() })
        .eq('id', row.id)
      continue
    }

    // Create evidence for each matched category (usually 1-2)
    for (const match of matches) {
      const excerpt = row.content_text.length > 500
        ? row.content_text.substring(0, 497) + '...'
        : row.content_text

      const monetaryMentions = row.monetary_mentions as Array<{ amount: number; context: string }> | null
      const firstMonetary = monetaryMentions?.[0]

      const { error: insertError } = await sb
        .from('pain_point_evidence')
        .insert({
          pain_point_category_id: match.categoryId,
          source_type: 'market_intelligence',
          source_id: row.id,
          source_excerpt: excerpt,
          industry: row.industry_detected || null,
          company_size: row.company_size_detected || null,
          monetary_indicator: firstMonetary?.amount ?? null,
          monetary_context: firstMonetary?.context ?? null,
          confidence_score: match.confidence,
          extracted_by: 'ai_classifier',
        })

      if (insertError) {
        summary.errors.push(`Evidence insert failed for ${row.id}: ${insertError.message}`)
        continue
      }

      summary.evidenceCreated++
      affectedCategoryIds.add(match.categoryId)

      // Update industry_tags on the category if we have a new industry
      if (row.industry_detected) {
        const cat = categories.find(c => c.id === match.categoryId)
        if (cat && !cat.industry_tags?.includes(row.industry_detected)) {
          cat.industry_tags = [...(cat.industry_tags || []), row.industry_detected]
          await sb
            .from('pain_point_categories')
            .update({ industry_tags: cat.industry_tags })
            .eq('id', match.categoryId)
        }
      }
    }

    // Mark market intel row as processed
    await sb
      .from('market_intelligence')
      .update({ is_processed: true, processed_at: new Date().toISOString() })
      .eq('id', row.id)
  }

  // Refresh stats and link evidence to calculations for affected categories
  for (const catId of affectedCategoryIds) {
    try {
      await refreshCategoryStats(sb, catId)
    } catch (err: any) {
      summary.errors.push(`Stats refresh failed for ${catId}: ${err.message}`)
    }
    try {
      await linkEvidenceToCalculations(catId)
    } catch (err: any) {
      summary.errors.push(`Calc linking failed for ${catId}: ${err.message}`)
    }
  }

  return summary
}
