/**
 * One-off script to classify unprocessed market intelligence records.
 * Usage: npx tsx scripts/classify-market-intel.ts [--prod]
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

import { createClient } from '@supabase/supabase-js'

const isProd = process.argv.includes('--prod')

const supabaseUrl = isProd
  ? process.env.PROD_SUPABASE_URL!
  : process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = isProd
  ? process.env.PROD_SUPABASE_SERVICE_ROLE_KEY!
  : process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  console.error(`Missing ${isProd ? 'PROD_' : ''}SUPABASE env vars`)
  process.exit(1)
}

console.log(`Target: ${isProd ? 'PRODUCTION' : 'DEV'} (${supabaseUrl})`)

const sb = createClient(supabaseUrl, serviceRoleKey)

interface PainPointCategory {
  id: string
  name: string
  display_name: string
  description: string | null
  industry_tags: string[]
}

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

const MIN_CONTENT_LENGTH = 50

function classifyContent(content: string, categories: PainPointCategory[]) {
  if (!content || content.length < MIN_CONTENT_LENGTH) return []
  const lower = content.toLowerCase()
  const matches: Array<{ categoryId: string; confidence: number; matchedKeywords: string[] }> = []

  for (const cat of categories) {
    const keywords = CATEGORY_KEYWORDS[cat.name]
    if (!keywords) continue
    const matched: string[] = []
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) matched.push(kw)
    }
    if (matched.length === 0) continue
    const confidence = Math.min(0.9, 0.25 + matched.length * 0.15)
    if (confidence >= 0.3) {
      matches.push({ categoryId: cat.id, confidence, matchedKeywords: matched })
    }
  }
  return matches.sort((a, b) => b.confidence - a.confidence)
}

async function main() {
  console.log('Loading pain point categories...')
  const { data: categories, error: catError } = await sb
    .from('pain_point_categories')
    .select('id, name, display_name, description, industry_tags')
    .eq('is_active', true)

  if (catError || !categories?.length) {
    console.error('Failed to load categories:', catError?.message)
    process.exit(1)
  }
  console.log(`Loaded ${categories.length} categories`)

  const { data: rows, error: fetchError } = await sb
    .from('market_intelligence')
    .select('id, content_text, source_platform, source_url, industry_detected, company_size_detected, monetary_mentions')
    .eq('is_processed', false)
    .order('created_at', { ascending: true })
    .limit(500)

  if (fetchError) {
    console.error('Failed to fetch:', fetchError.message)
    process.exit(1)
  }

  console.log(`Found ${rows?.length ?? 0} unprocessed market intel records`)
  if (!rows?.length) return

  let evidenceCreated = 0
  let irrelevant = 0
  let errors = 0

  for (const row of rows) {
    const matches = classifyContent(row.content_text, categories)

    if (matches.length === 0) {
      irrelevant++
      await sb.from('market_intelligence')
        .update({ is_processed: true, processed_at: new Date().toISOString() })
        .eq('id', row.id)
      continue
    }

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
        console.error(`Insert failed for ${row.id}:`, insertError.message)
        errors++
        continue
      }
      evidenceCreated++

      const cat = categories.find(c => c.id === match.categoryId)
      if (cat) {
        console.log(`  ✓ ${cat.display_name} (${match.confidence.toFixed(2)}) [${match.matchedKeywords.join(', ')}]`)
      }
    }

    await sb.from('market_intelligence')
      .update({ is_processed: true, processed_at: new Date().toISOString() })
      .eq('id', row.id)
  }

  console.log('\n=== Summary ===')
  console.log(`Processed: ${rows.length}`)
  console.log(`Evidence created: ${evidenceCreated}`)
  console.log(`Irrelevant (no match): ${irrelevant}`)
  console.log(`Errors: ${errors}`)

  // Refresh category stats
  console.log('\nRefreshing category stats...')
  const { data: allCats } = await sb
    .from('pain_point_categories')
    .select('id')
    .eq('is_active', true)

  for (const cat of allCats || []) {
    const { data: evStats } = await sb
      .from('pain_point_evidence')
      .select('monetary_indicator')
      .eq('pain_point_category_id', cat.id)

    const count = evStats?.length || 0
    const monetaryItems = (evStats || []).filter(
      (e: { monetary_indicator: string | null }) => e.monetary_indicator != null && parseFloat(e.monetary_indicator!) > 0
    )
    const avg = monetaryItems.length > 0
      ? monetaryItems.reduce((s: number, e: { monetary_indicator: string | null }) => s + parseFloat(e.monetary_indicator!), 0) / monetaryItems.length
      : null

    await sb
      .from('pain_point_categories')
      .update({ frequency_count: count, avg_monetary_impact: avg })
      .eq('id', cat.id)
  }

  console.log('Done!')
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
