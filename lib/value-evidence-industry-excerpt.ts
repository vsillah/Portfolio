/**
 * Loads a compact block from `value_evidence_summary` for outreach prompts.
 * Gives the model industry-grounded pain-point signal without full VEP payloads.
 */

import { supabaseAdmin } from '@/lib/supabase'

const MAX_ROWS = 12
const MAX_BLOCK_CHARS = 2_500

type SummaryRow = {
  display_name: string | null
  industry: string | null
  evidence_count: number | null
  avg_confidence: number | null
  monetary_evidence_count: number | null
  description: string | null
}

export interface ValueEvidenceExcerptResult {
  block: string | null
  rowsUsed: number
  chars: number
}

function formatRows(rows: SummaryRow[]): string {
  const lines: string[] = [
    '## Industry value signal (aggregated internal evidence)',
    'Use as qualitative proof of common pain in this sector — do not attribute quotes to unnamed companies.',
  ]
  for (const r of rows) {
    const name = r.display_name ?? 'Category'
    const n = r.evidence_count ?? 0
    const conf =
      r.avg_confidence != null && !Number.isNaN(Number(r.avg_confidence))
        ? `avg confidence ${Number(r.avg_confidence).toFixed(2)}`
        : null
    const money =
      r.monetary_evidence_count != null && r.monetary_evidence_count > 0
        ? `${r.monetary_evidence_count} $-linked signals`
        : null
    const bits = [conf, money].filter(Boolean).join('; ')
    const desc = r.description?.trim()
    const tail = desc ? ` — ${desc.slice(0, 160)}${desc.length > 160 ? '…' : ''}` : ''
    lines.push(`- **${name}** (${n} evidence rows${bits ? `; ${bits}` : ''})${tail}`)
  }
  let out = lines.join('\n')
  if (out.length > MAX_BLOCK_CHARS) {
    out = out.slice(0, MAX_BLOCK_CHARS) + '\n…[truncated]'
  }
  return out
}

/**
 * Best-effort excerpt for the lead's industry. Falls back to global top categories
 * (industry IS NULL in the view) when the industry has no rows.
 */
export async function fetchIndustryValueEvidenceExcerpt(
  industry: string | null,
): Promise<ValueEvidenceExcerptResult> {
  if (!supabaseAdmin || !industry?.trim()) {
    return { block: null, rowsUsed: 0, chars: 0 }
  }
  const ind = industry.trim()

  const run = async (filter: 'industry' | 'null') => {
    let q = supabaseAdmin.from('value_evidence_summary').select(
      'display_name, industry, evidence_count, avg_confidence, monetary_evidence_count, description',
    )
    if (filter === 'industry') {
      q = q.eq('industry', ind)
    } else {
      q = q.is('industry', null)
    }
    return q.order('evidence_count', { ascending: false }).limit(MAX_ROWS)
  }

  let { data, error } = await run('industry')
  if (error) {
    console.warn('[value-evidence-industry-excerpt]', error.message)
    return { block: null, rowsUsed: 0, chars: 0 }
  }

  let rows = (data ?? []) as SummaryRow[]
  if (!rows.length) {
    const fb = await run('null')
    if (fb.error) {
      console.warn('[value-evidence-industry-excerpt] fallback:', fb.error.message)
      return { block: null, rowsUsed: 0, chars: 0 }
    }
    rows = (fb.data ?? []) as SummaryRow[]
  }

  if (!rows.length) {
    return { block: null, rowsUsed: 0, chars: 0 }
  }

  const block = formatRows(rows)
  return { block, rowsUsed: rows.length, chars: block.length }
}
