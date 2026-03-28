/**
 * Meeting Pain Point Classifier (server-side only)
 *
 * Classifies freetext pain points and quick wins against pain_point_categories
 * using a two-pass approach:
 *   1. Keyword matching (reusing CATEGORY_KEYWORDS from market-intel-classifier)
 *   2. AI fallback via GPT for unmatched items
 *
 * Used when importing Read.ai meeting notes or pasted transcripts into the
 * lead enrichment flow, before pushing to the Value Evidence Pipeline.
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
}

export interface ClassifiedItem {
  text: string
  categoryId: string
  categoryName: string
  categoryDisplayName: string
  confidence: number
  method: 'keyword' | 'ai'
  matchedKeywords?: string[]
}

export interface ClassifyResult {
  classified: ClassifiedItem[]
  unclassified: string[]
}

export interface InsertEvidenceResult {
  inserted: number
  errors: string[]
  affectedCategoryIds: string[]
}

// ============================================================================
// Keyword map — same categories as market-intel-classifier.ts
// ============================================================================

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
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
    'scattered data', 'data everywhere', 'data in spreadsheets',
    'can\'t find data', 'data access', 'data management',
    'unorganized data', 'messy data', 'data chaos',
  ],
  inconsistent_followup: [
    'follow up', 'follow-up', 'followup', 'falling through the cracks',
    'forgot to follow', 'no follow up', 'missed follow', 'lead fell through',
    'dropped the ball', 'never heard back', 'inconsistent communication',
    'no response', 'ghosted', 'lost track',
  ],
  manual_processes: [
    'manual data entry', 'data entry', 'entering data', 'copy paste',
    'manual input', 'typing in', 'manually entering', 'repetitive entry',
    'form filling', 'data migration', 'transcription', 'keying in data',
    'no automation', 'lack of automation', 'everything manual', 'automate',
    'workflow automation', 'repetitive task', 'manual workflow', 'manual process',
    'could be automated', 'still doing it manually', 'automation opportunity',
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
  poor_communication: [
    'poor communication', 'miscommunication', 'communication gap',
    'information doesn\'t flow', 'nobody told me', 'email overload',
    'communication breakdown', 'team communication', 'internal communication',
    'siloed communication', 'slack overload',
  ],
}

const MIN_CONFIDENCE_THRESHOLD = 0.3

// ============================================================================
// Text splitting
// ============================================================================

/**
 * Split freetext containing multiple pain points/quick wins into individual items.
 * Handles bullets, numbered lists, newline-delimited, and "--- From meeting:" headers.
 */
export function splitIntoItems(text: string): string[] {
  if (!text?.trim()) return []

  const lines = text.split('\n')
  const items: string[] = []
  let currentItem = ''

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      if (currentItem.trim()) {
        items.push(currentItem.trim())
        currentItem = ''
      }
      continue
    }

    if (line.startsWith('--- From meeting:')) continue

    const isBullet = /^[-•*]\s/.test(line)
    const isNumbered = /^\d+[.)]\s/.test(line)

    if (isBullet || isNumbered) {
      if (currentItem.trim()) {
        items.push(currentItem.trim())
      }
      currentItem = line.replace(/^[-•*\d.)\s]+/, '').trim()
    } else {
      currentItem = currentItem ? `${currentItem} ${line}` : line
    }
  }

  if (currentItem.trim()) {
    items.push(currentItem.trim())
  }

  return items.filter((item) => item.length >= 10)
}

// ============================================================================
// Keyword classifier (pass 1)
// ============================================================================

function keywordClassifyItem(
  text: string,
  categories: PainPointCategory[]
): ClassifiedItem | null {
  const lower = text.toLowerCase()
  let bestMatch: ClassifiedItem | null = null
  let bestConfidence = 0

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

    const confidence = Math.min(0.9, 0.25 + matched.length * 0.15)
    if (confidence >= MIN_CONFIDENCE_THRESHOLD && confidence > bestConfidence) {
      bestConfidence = confidence
      bestMatch = {
        text,
        categoryId: cat.id,
        categoryName: cat.name,
        categoryDisplayName: cat.display_name,
        confidence,
        method: 'keyword',
        matchedKeywords: matched,
      }
    }
  }

  return bestMatch
}

// ============================================================================
// AI classifier (pass 2 — fallback for unmatched items)
// ============================================================================

async function aiClassifyItems(
  items: string[],
  categories: PainPointCategory[]
): Promise<ClassifiedItem[]> {
  if (items.length === 0 || categories.length === 0) return []

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY
  if (!OPENAI_API_KEY) {
    console.warn('[meeting-pain-classifier] OPENAI_API_KEY not set — skipping AI classification')
    return []
  }

  const categoryList = categories
    .map((c) => `- ${c.name} (${c.display_name}): ${c.description || 'No description'}`)
    .join('\n')

  const prompt = `You are a business pain point classifier. Given a list of pain point or quick win items from a meeting, classify each into the most appropriate category.

Categories:
${categoryList}

Items to classify:
${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}

Respond with a JSON array where each element has:
- "index": the 1-based item number
- "category_name": the category name slug (e.g. "manual_processes") or "uncategorized" if no good fit
- "confidence": a number between 0.3 and 0.85

Only include items that have a reasonable match (confidence >= 0.3). Respond ONLY with the JSON array, no other text.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      console.error('[meeting-pain-classifier] OpenAI API error:', response.status)
      return []
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content?.trim() || ''

    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      index: number
      category_name: string
      confidence: number
    }>

    const results: ClassifiedItem[] = []
    for (const entry of parsed) {
      if (entry.category_name === 'uncategorized') continue
      if (entry.confidence < MIN_CONFIDENCE_THRESHOLD) continue

      const cat = categories.find((c) => c.name === entry.category_name)
      if (!cat) continue

      const itemIndex = entry.index - 1
      if (itemIndex < 0 || itemIndex >= items.length) continue

      results.push({
        text: items[itemIndex],
        categoryId: cat.id,
        categoryName: cat.name,
        categoryDisplayName: cat.display_name,
        confidence: Math.min(0.85, entry.confidence),
        method: 'ai',
      })
    }

    return results
  } catch (err) {
    console.error('[meeting-pain-classifier] AI classification failed:', err)
    return []
  }
}

// ============================================================================
// Main classifier
// ============================================================================

export async function classifyMeetingPainPoints(
  painPointsText: string,
  quickWinsText: string
): Promise<ClassifyResult> {
  const sb = supabaseAdmin
  if (!sb) throw new Error('supabaseAdmin not available (server-side only)')

  const { data: categoriesRaw, error: catError } = await sb
    .from('pain_point_categories')
    .select('id, name, display_name, description')
    .eq('is_active', true)

  if (catError || !categoriesRaw?.length) {
    return { classified: [], unclassified: [] }
  }

  const categories = categoriesRaw as PainPointCategory[]

  const allItems = [
    ...splitIntoItems(painPointsText),
    ...splitIntoItems(quickWinsText),
  ]

  if (allItems.length === 0) {
    return { classified: [], unclassified: [] }
  }

  const classified: ClassifiedItem[] = []
  const unmatched: string[] = []

  for (const item of allItems) {
    const kwResult = keywordClassifyItem(item, categories)
    if (kwResult) {
      classified.push(kwResult)
    } else {
      unmatched.push(item)
    }
  }

  if (unmatched.length > 0) {
    const aiResults = await aiClassifyItems(unmatched, categories)
    const aiMatchedTexts = new Set(aiResults.map((r) => r.text))

    classified.push(...aiResults)

    const stillUnmatched = unmatched.filter((item) => !aiMatchedTexts.has(item))
    return { classified, unclassified: stillUnmatched }
  }

  return { classified, unclassified: [] }
}

// ============================================================================
// Evidence insertion
// ============================================================================

export async function insertClassifiedEvidence(
  items: ClassifiedItem[],
  contactSubmissionId?: number
): Promise<InsertEvidenceResult> {
  const sb = supabaseAdmin
  if (!sb) throw new Error('supabaseAdmin not available (server-side only)')

  const result: InsertEvidenceResult = {
    inserted: 0,
    errors: [],
    affectedCategoryIds: [],
  }

  const affectedIds = new Set<string>()

  for (const item of items) {
    const excerpt = item.text.length > 500
      ? item.text.substring(0, 497) + '...'
      : item.text

    const { error } = await sb
      .from('pain_point_evidence')
      .insert({
        pain_point_category_id: item.categoryId,
        source_type: 'lead_enrichment',
        source_id: contactSubmissionId ? String(contactSubmissionId) : null,
        source_excerpt: excerpt,
        confidence_score: item.confidence,
        extracted_by: item.method === 'keyword' ? 'keyword_classifier' : 'ai_classifier',
        contact_submission_id: contactSubmissionId || null,
      })

    if (error) {
      result.errors.push(`Insert failed for "${item.text.substring(0, 50)}...": ${error.message}`)
      continue
    }

    result.inserted++
    affectedIds.add(item.categoryId)
  }

  result.affectedCategoryIds = [...affectedIds]

  for (const catId of affectedIds) {
    try {
      await refreshCategoryStats(sb, catId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`Stats refresh failed for ${catId}: ${msg}`)
    }
    try {
      await linkEvidenceToCalculations(catId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push(`Calc linking failed for ${catId}: ${msg}`)
    }
  }

  return result
}
