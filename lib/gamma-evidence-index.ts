/**
 * Gamma Evidence Index
 *
 * Single source of truth for source-data citations in Gamma reports.
 *
 * Given a ReportContext (contact + audit + value report), plus ancillary inputs
 * (meeting records and pain-point evidence), build a deterministic, numbered
 * list of EvidenceItem (`E1`, `E2`, ...). The list is then used to:
 *   1. Inject `[E#]` citation tags into prompt body (per template).
 *   2. Render an Evidence Ledger slide at the end of every deck.
 *   3. Preface the prompt with Source Fidelity Rules so Gamma quotes verbatim
 *      and never invents quotes, statistics, or sources.
 *
 * Keep this module pure — no DB calls, no I/O. Fetching is the caller's job.
 */

import type { MeetingForAudit } from './audit-from-meetings'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EvidenceKind =
  | 'meeting_quote'
  | 'audit_response'
  | 'pain_point_evidence'
  | 'tech_stack'
  | 'value_formula'
  | 'benchmark'

export interface EvidenceItem {
  /** Stable display id like "E3" — assigned by buildEvidenceIndex in deterministic order. */
  id: string
  kind: EvidenceKind
  /** Short human-readable source label (e.g. "Discovery call", "Diagnostic audit", "BuiltWith"). */
  sourceLabel: string
  /** Optional date label (YYYY-MM-DD) when the source has a known date. */
  dateLabel?: string
  /**
   * The exact text we want Gamma to quote when citing this item. For meetings this is the
   * verbatim transcript snippet; for audit responses it is the chosen-value text; for value
   * formulas it is the formulaReadable string; for tech stack it is "Detected: <tech>".
   */
  verbatim: string
  /** Free-form structured metadata to help debugging or richer ledger rendering. */
  meta?: Record<string, string>
}

/** Bag of inputs consumed by buildEvidenceIndex — kept loose so callers can omit optional bits. */
export interface EvidenceIndexInputs {
  audit: {
    diagnostic_summary?: string | null
    key_insights?: string[] | null
    recommended_actions?: string[] | null
    business_challenges?: Record<string, unknown> | null
    tech_stack?: Record<string, unknown> | null
    automation_needs?: Record<string, unknown> | null
    ai_readiness?: Record<string, unknown> | null
    budget_timeline?: Record<string, unknown> | null
    decision_making?: Record<string, unknown> | null
    enriched_tech_stack?: Record<string, unknown> | null
    urgency_score?: number | null
    opportunity_score?: number | null
  } | null
  contactWebsiteTechStack?: Record<string, unknown> | null
  valueStatements?: Array<{
    painPoint: string
    formulaReadable: string
    evidenceSummary: string
    annualValue: number
  }>
  benchmarks?: Array<{
    industry: string
    benchmark_type: string
    value: number
    source: string
  }>
  meetings?: MeetingForAudit[]
  painPointEvidence?: Array<{ id: string; excerpt: string; sourceType: string; categoryId: string }>
  /** Optional: explicit verbatim quotes the user toggled in the Admin UI's Meeting Verbatims slot. */
  pickedMeetingVerbatims?: Array<{ id: string; verbatim: string; sourceLabel: string; dateLabel?: string }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_VERBATIM_CHARS = 320
const MAX_MEETINGS_FOR_QUOTES = 5
const MAX_QUOTES_PER_MEETING = 3
const MAX_PAIN_POINT_EVIDENCE = 6
const MAX_AUDIT_RESPONSES = 18
const MAX_VALUE_FORMULAS = 8
const MAX_BENCHMARKS = 6
const MAX_TECH_STACK_ITEMS = 8

function trimVerbatim(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= MAX_VERBATIM_CHARS) return collapsed
  return `${collapsed.slice(0, MAX_VERBATIM_CHARS - 1).trimEnd()}…`
}

function dateLabel(input: string | null | undefined): string | undefined {
  if (!input) return undefined
  const d = new Date(input)
  if (isNaN(d.getTime())) return undefined
  return d.toISOString().slice(0, 10)
}

function humanizeKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Pick up to N highest-signal sentences from a transcript. Keyword bias toward pain/value. */
function pickQuotesFromTranscript(transcript: string, n: number): string[] {
  if (!transcript || transcript.trim().length === 0) return []
  const sentences = transcript
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40 && s.length <= 400)

  const KEYWORDS = [
    'manual', 'hours', 'spend', 'time', 'cost', 'lose', 'losing', 'lost',
    'struggle', 'frustrat', 'slow', 'duplicate', 'mistake', 'error',
    'missed', 'leak', 'churn', 'donor', 'volunteer', 'lead', 'follow up',
    'budget', 'priority', 'urgen', 'goal', 'need', 'want', 'wish', 'pain',
    'bottleneck', 'delay', 'risk', 'compliance',
  ]

  const scored = sentences.map((s) => {
    const lower = s.toLowerCase()
    const score = KEYWORDS.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0)
    return { s, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const picked: string[] = []
  const seen = new Set<string>()
  for (const { s, score } of scored) {
    if (picked.length >= n) break
    if (score === 0 && picked.length > 0) break
    const key = s.toLowerCase().slice(0, 80)
    if (seen.has(key)) continue
    seen.add(key)
    picked.push(s)
  }
  return picked
}

/** Pull a notes summary or top-level highlight strings from structured_notes JSON. */
function pickQuotesFromStructuredNotes(structuredNotes: unknown, n: number): string[] {
  if (!structuredNotes || typeof structuredNotes !== 'object') return []
  const obj = structuredNotes as Record<string, unknown>
  const out: string[] = []

  if (typeof obj.summary === 'string' && obj.summary.trim().length > 0) {
    out.push(obj.summary.trim())
  }
  for (const key of ['highlights', 'key_points', 'action_items', 'pains', 'priorities']) {
    const v = obj[key]
    if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === 'string' && item.trim().length > 0) out.push(item.trim())
        if (out.length >= n) break
      }
    }
    if (out.length >= n) break
  }
  return out.slice(0, n)
}

/** Extract a concise verbatim representation of an audit category's responses. */
function flattenAuditCategoryResponses(
  category: Record<string, unknown> | null | undefined
): string[] {
  if (!category || typeof category !== 'object') return []
  const out: string[] = []
  for (const [key, value] of Object.entries(category)) {
    const label = humanizeKey(key)
    if (Array.isArray(value)) {
      const flat = value.filter((v) => typeof v === 'string' || typeof v === 'number').map(String)
      if (flat.length > 0) out.push(`${label}: ${flat.join(', ')}`)
    } else if (value && typeof value === 'object') {
      const sub = Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => `${humanizeKey(k)}: ${String(v)}`)
        .join('; ')
      if (sub.length > 0) out.push(`${label}: ${sub}`)
    } else if (value !== null && value !== undefined && String(value).length > 0) {
      out.push(`${label}: ${String(value)}`)
    }
  }
  return out
}

function techStackToItems(
  source: 'Site (BuiltWith)' | 'Audit (enriched)',
  data: unknown
): Array<{ tech: string; tag?: string }> {
  if (!data || typeof data !== 'object') return []
  const obj = data as Record<string, unknown>
  const items: Array<{ tech: string; tag?: string }> = []
  if (Array.isArray(obj.technologies)) {
    for (const t of obj.technologies) {
      const name =
        typeof t === 'string'
          ? t
          : (t && typeof t === 'object'
              ? String(((t as Record<string, unknown>).name ?? (t as Record<string, unknown>).Name ?? '') as string)
              : '')
      if (name) items.push({ tech: name })
    }
  }
  if (obj.byTag && typeof obj.byTag === 'object') {
    for (const [tag, values] of Object.entries(obj.byTag as Record<string, unknown>)) {
      if (Array.isArray(values)) {
        for (const v of values) {
          const name =
            typeof v === 'string'
              ? v
              : (v && typeof v === 'object'
                  ? String(((v as Record<string, unknown>).name ?? (v as Record<string, unknown>).Name ?? '') as string)
                  : '')
          if (name) items.push({ tech: name, tag: humanizeKey(tag) })
        }
      }
    }
  }
  return items.map((it) => ({ ...it, tech: source === 'Audit (enriched)' ? `${it.tech} (enriched)` : it.tech }))
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

/**
 * Build the deterministic, numbered Evidence Index.
 *
 * Order of kinds (drives `E1…En` numbering):
 *   1. meeting_quote (chronological by meeting_date)
 *   2. audit_response (category order matches the diagnostic form)
 *   3. pain_point_evidence
 *   4. tech_stack
 *   5. value_formula
 *   6. benchmark
 */
export function buildEvidenceIndex(inputs: EvidenceIndexInputs): EvidenceItem[] {
  const items: Omit<EvidenceItem, 'id'>[] = []

  // 1. Meeting quotes — picked verbatims first, then auto-extracted snippets.
  const seenQuoteKeys = new Set<string>()
  const pushMeetingQuote = (
    sourceLabel: string,
    dateLabel: string | undefined,
    verbatim: string,
    meta?: Record<string, string>
  ) => {
    const trimmed = trimVerbatim(verbatim)
    const key = trimmed.toLowerCase().slice(0, 96)
    if (seenQuoteKeys.has(key)) return
    seenQuoteKeys.add(key)
    items.push({ kind: 'meeting_quote', sourceLabel, dateLabel, verbatim: trimmed, meta })
  }

  for (const picked of inputs.pickedMeetingVerbatims ?? []) {
    pushMeetingQuote(picked.sourceLabel, picked.dateLabel, picked.verbatim, { meeting_id: picked.id })
  }

  for (const m of (inputs.meetings ?? []).slice(0, MAX_MEETINGS_FOR_QUOTES)) {
    const label = `${humanizeKey(m.meeting_type ?? 'meeting')} call`
    const dl = dateLabel(m.meeting_date)
    const fromTranscript = pickQuotesFromTranscript(m.transcript ?? '', MAX_QUOTES_PER_MEETING)
    for (const q of fromTranscript) {
      pushMeetingQuote(label, dl, q, { meeting_id: m.id, source: 'transcript' })
    }
    if (fromTranscript.length < MAX_QUOTES_PER_MEETING) {
      const remaining = MAX_QUOTES_PER_MEETING - fromTranscript.length
      const fromNotes = pickQuotesFromStructuredNotes(m.structured_notes, remaining)
      for (const q of fromNotes) {
        pushMeetingQuote(label, dl, q, { meeting_id: m.id, source: 'structured_notes' })
      }
    }
  }

  // 2. Audit responses — high-signal categories with chosen values.
  if (inputs.audit) {
    const a = inputs.audit
    const categoryOrder: Array<{ key: keyof NonNullable<EvidenceIndexInputs['audit']>; label: string }> = [
      { key: 'business_challenges', label: 'Business Challenges' },
      { key: 'automation_needs', label: 'Automation Needs' },
      { key: 'tech_stack', label: 'Technology Stack' },
      { key: 'ai_readiness', label: 'AI Readiness' },
      { key: 'budget_timeline', label: 'Budget & Timeline' },
      { key: 'decision_making', label: 'Decision Making' },
    ]
    let count = 0
    for (const cat of categoryOrder) {
      if (count >= MAX_AUDIT_RESPONSES) break
      const lines = flattenAuditCategoryResponses(a[cat.key] as Record<string, unknown> | null | undefined)
      for (const line of lines) {
        if (count >= MAX_AUDIT_RESPONSES) break
        items.push({
          kind: 'audit_response',
          sourceLabel: `Diagnostic audit · ${cat.label}`,
          verbatim: trimVerbatim(line),
          meta: { category: String(cat.key) },
        })
        count += 1
      }
    }

    if (typeof a.urgency_score === 'number' || typeof a.opportunity_score === 'number') {
      const parts: string[] = []
      if (typeof a.urgency_score === 'number') parts.push(`Urgency ${a.urgency_score}/10`)
      if (typeof a.opportunity_score === 'number') parts.push(`Opportunity ${a.opportunity_score}/10`)
      items.push({
        kind: 'audit_response',
        sourceLabel: 'Diagnostic audit · Scores',
        verbatim: parts.join(' | '),
        meta: { category: 'scores' },
      })
    }
  }

  // 3. Pain point evidence
  for (const ppe of (inputs.painPointEvidence ?? []).slice(0, MAX_PAIN_POINT_EVIDENCE)) {
    items.push({
      kind: 'pain_point_evidence',
      sourceLabel: `Pain-point evidence · ${humanizeKey(ppe.sourceType)}`,
      verbatim: trimVerbatim(ppe.excerpt),
      meta: { evidence_id: ppe.id, category_id: ppe.categoryId },
    })
  }

  // 4. Tech stack — site (BuiltWith) first, then enriched (audit).
  const techCombined: Array<{ tech: string; tag?: string; source: string }> = []
  for (const it of techStackToItems('Site (BuiltWith)', inputs.contactWebsiteTechStack)) {
    techCombined.push({ ...it, source: 'Site (BuiltWith)' })
  }
  for (const it of techStackToItems('Audit (enriched)', inputs.audit?.enriched_tech_stack)) {
    techCombined.push({ ...it, source: 'Audit (enriched)' })
  }
  const seenTech = new Set<string>()
  let techCount = 0
  for (const t of techCombined) {
    if (techCount >= MAX_TECH_STACK_ITEMS) break
    const key = t.tech.toLowerCase()
    if (seenTech.has(key)) continue
    seenTech.add(key)
    items.push({
      kind: 'tech_stack',
      sourceLabel: t.source,
      verbatim: t.tag ? `Detected: ${t.tech} (${t.tag})` : `Detected: ${t.tech}`,
    })
    techCount += 1
  }

  // 5. Value formulas
  for (const vs of (inputs.valueStatements ?? []).slice(0, MAX_VALUE_FORMULAS)) {
    items.push({
      kind: 'value_formula',
      sourceLabel: `Value calculation · ${vs.painPoint}`,
      verbatim: trimVerbatim(`${vs.formulaReadable} — ${vs.evidenceSummary}`),
      meta: { annual_value: String(vs.annualValue) },
    })
  }

  // 6. Benchmarks
  const seenBench = new Set<string>()
  let benchCount = 0
  for (const bm of inputs.benchmarks ?? []) {
    if (benchCount >= MAX_BENCHMARKS) break
    const key = `${bm.benchmark_type}:${bm.industry}:${bm.source}`
    if (seenBench.has(key)) continue
    seenBench.add(key)
    items.push({
      kind: 'benchmark',
      sourceLabel: `Benchmark · ${bm.source}`,
      verbatim: trimVerbatim(`${humanizeKey(bm.benchmark_type)} for ${bm.industry}: ${bm.value}`),
    })
    benchCount += 1
  }

  return items.map((item, idx) => ({ ...item, id: `E${idx + 1}` }))
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

export function citationTag(id: string): string {
  return `[${id}]`
}

const KIND_HEADINGS: Record<EvidenceKind, string> = {
  meeting_quote: 'Meeting verbatims',
  audit_response: 'Diagnostic audit responses',
  pain_point_evidence: 'Pain-point evidence',
  tech_stack: 'Detected technology',
  value_formula: 'Value calculations',
  benchmark: 'Industry benchmarks',
}

const KIND_ORDER: EvidenceKind[] = [
  'meeting_quote',
  'audit_response',
  'pain_point_evidence',
  'tech_stack',
  'value_formula',
  'benchmark',
]

/**
 * Render the Evidence Ledger slide markdown. Items are grouped by kind in the
 * canonical order. If no items exist, returns a short slide that says so explicitly
 * so Gamma cannot fabricate sources.
 */
export function buildEvidenceLedgerSlide(items: EvidenceItem[]): string {
  const lines: string[] = ['# EVIDENCE LEDGER', '## Source data referenced in this deck', '']

  if (items.length === 0) {
    lines.push(
      'No structured source data was attached to this report. Treat all narrative as derived from the prospect context only and avoid making specific quantitative claims.'
    )
    return lines.join('\n')
  }

  lines.push(
    'Every `[E#]` tag in this deck refers back to one of the entries below. These are the only approved sources for quotes, statistics, and scores.',
    ''
  )

  const grouped = new Map<EvidenceKind, EvidenceItem[]>()
  for (const item of items) {
    const arr = grouped.get(item.kind) ?? []
    arr.push(item)
    grouped.set(item.kind, arr)
  }

  for (const kind of KIND_ORDER) {
    const group = grouped.get(kind)
    if (!group || group.length === 0) continue
    lines.push(`### ${KIND_HEADINGS[kind]}`)
    for (const item of group) {
      const meta = [item.sourceLabel, item.dateLabel].filter(Boolean).join(' · ')
      lines.push(`- **${item.id}** — ${meta}`)
      lines.push(`  > ${item.verbatim}`)
    }
    lines.push('')
  }

  return lines.join('\n').trimEnd()
}

/**
 * Render the Source Fidelity Rules + Evidence Index payload that gets prepended to
 * every prompt. The body of the prompt is then expected to embed `[E#]` tags as
 * directed by the per-template builders.
 */
export function buildSourceFidelityPreamble(items: EvidenceItem[]): string {
  const lines: string[] = [
    '[SOURCE FIDELITY RULES — read first]',
    '',
    'The Evidence Index below is the only approved source of quotes, statistics, scores, and tech-stack details for this deck. Follow these rules strictly:',
    '',
    '1. Whenever the deck makes a recommendation, score, claim, or quantitative statement, append the matching `[E#]` tag (e.g. `[E3]`) immediately after the sentence. Multiple tags are allowed: `[E2][E5]`.',
    '2. When citing a meeting verbatim or an audit response, quote the source text in quotation marks. Do not paraphrase numbers, names, or technology details.',
    '3. Do not invent quotes, statistics, source names, dates, or technologies. If no Evidence Index entry supports a claim, omit the claim.',
    '4. Preserve every `[E#]` tag exactly as written in the source material below — do not renumber, drop, or merge them.',
    '5. The final slide of the deck is the Evidence Ledger. Do not duplicate or alter that slide; the system appends it verbatim.',
    '',
  ]

  if (items.length === 0) {
    lines.push(
      '[EVIDENCE INDEX]',
      'No structured evidence is attached to this report. Limit the deck to qualitative framing only — do not quote anyone or cite specific numbers, technologies, or benchmarks.'
    )
    return lines.join('\n')
  }

  lines.push('[EVIDENCE INDEX]')
  for (const item of items) {
    const meta = [item.sourceLabel, item.dateLabel].filter(Boolean).join(' · ')
    lines.push(`- ${item.id} (${item.kind}) — ${meta}: "${item.verbatim}"`)
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Convenience: pick first item of a given kind (used by per-template builders
// to attach a default citation to a section that mentions a category).
// ---------------------------------------------------------------------------

export function firstOfKind(items: EvidenceItem[], kind: EvidenceKind): EvidenceItem | undefined {
  return items.find((i) => i.kind === kind)
}

/** All items whose meta.category matches (used for audit-category-specific tagging). */
export function itemsForAuditCategory(items: EvidenceItem[], category: string): EvidenceItem[] {
  return items.filter((i) => i.kind === 'audit_response' && i.meta?.category === category)
}

/** All items for a given pain-point label (matches by case-insensitive substring of value formula). */
export function itemsForPainPoint(items: EvidenceItem[], painPoint: string): EvidenceItem[] {
  const needle = painPoint.toLowerCase()
  return items.filter(
    (i) => i.kind === 'value_formula' && i.sourceLabel.toLowerCase().includes(needle)
  )
}

/** Flat list of `[E#]` tags joined with no spaces. Returns empty string when items is empty. */
export function tagsList(items: EvidenceItem[]): string {
  return items.map((i) => citationTag(i.id)).join('')
}
