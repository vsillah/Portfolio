/**
 * Stack-aware feasibility engine.
 *
 * Given proposed products (bundle), our stack (global + per-asset), and the
 * client's detected stack (BuiltWith, audit self-report, admin-verified),
 * produces a deterministic assessment of fit, effort, and open tradeoffs.
 *
 * Contains everything for v1 — types, merge, engine, and the client-view
 * projector — in one file. Will split if a second module starts importing
 * only part of it.
 *
 * See .cursor/plans/stack-aware_feasibility_assessment_8e7862c5.plan.md
 */

import { createHash } from 'node:crypto'
import {
  OUR_TECH_STACK,
  OUR_TECH_STACK_VERSION,
  DEFAULT_TECH_STACK_BY_CONTENT_TYPE,
  type OurStackEntry,
  type OurStackCategory,
} from './constants/our-tech-stack'
import { normalizeBuiltWithTag } from './constants/builtwith-tag-map'
import type { TechStackItem } from './tech-stack-lookup'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const FIT_KIND = ['match', 'integrate', 'gap', 'replace', 'unknown'] as const
export type FitKind = (typeof FIT_KIND)[number]

export const EFFORT = ['small', 'medium', 'large'] as const
export type Effort = (typeof EFFORT)[number]

export const OVERALL_FEASIBILITY = ['high', 'medium', 'low'] as const
export type OverallFeasibility = (typeof OVERALL_FEASIBILITY)[number]

export const CLIENT_STACK_SOURCE = ['verified', 'audit', 'builtwith', 'merged', 'empty'] as const
export type ClientStackSource = (typeof CLIENT_STACK_SOURCE)[number]

export const BUILTWITH_CREDITS_STATE = ['ok', 'exhausted', 'unknown'] as const
export type BuiltWithCreditsState = (typeof BUILTWITH_CREDITS_STATE)[number]

/** Per-asset tech stack declaration, stored on content_offer_roles.tech_stack. */
export interface TechStackDeclaration {
  platform: string[]
  integrations: Array<{ system: string; direction?: string; method?: string }>
  client_infrastructure_required?: string[]
  notes?: string
}

export interface ProposedItemInput {
  content_type: string
  content_id: string
  title: string
  /** From content_offer_roles.tech_stack; NULL inherits default by content_type. */
  tech_stack: TechStackDeclaration | null
}

export interface ClientStackSources {
  verified?: { technologies: TechStackItem[]; resolved_at?: string; resolved_by?: string } | null
  /** From diagnostic_audits.enriched_tech_stack. */
  audit?: { technologies: TechStackItem[] } | null
  /** From contact_submissions.website_tech_stack (BuiltWith). */
  builtwith?: {
    technologies: TechStackItem[]
    fetchedAt?: string | null
    creditsRemaining?: number | null
  } | null
}

export interface NormalizedClientTech {
  name: string
  category: OurStackCategory | null
  tag?: string
  source: 'verified' | 'audit' | 'builtwith'
}

export interface StackConflict {
  category: OurStackCategory
  builtwith?: string
  audit?: string
}

export interface MergedClientStack {
  technologies: NormalizedClientTech[]
  source: ClientStackSource
  /** Only populated when `verified` is not set. Empty when there is no disagreement. */
  conflicts: StackConflict[]
}

export interface FeasibilityItem {
  content_key: string
  content_type: string
  title: string
  requires: {
    platform: string[]
    integrations: Array<{ system: string; direction?: string; method?: string }>
    client_infrastructure: string[]
  }
  fit: Array<{
    capability: OurStackCategory | string
    kind: FitKind
    our: string
    client?: string
    note?: string
  }>
  effort: Effort
  risks: string[]
  inferred_from_defaults: boolean
}

export interface FeasibilityAssessment {
  generated_at: string
  inputs_hash: string
  our_stack_version: string
  generated_from: { bundleId: string | null; bundleName?: string | null }
  client_stack_source: ClientStackSource
  builtwith_credits_remaining: number | null
  builtwith_credits_state: BuiltWithCreditsState
  items: FeasibilityItem[]
  overall_feasibility: OverallFeasibility
  estimated_complexity: Effort
  open_tradeoffs: string[]
  stack_fit_summary: string
  /** Conflicts the admin should resolve before sending to client. Empty when verified or no disagreement. */
  conflicts: StackConflict[]
}

// ---------------------------------------------------------------------------
// mergeClientStack
// ---------------------------------------------------------------------------

/**
 * Normalize a raw TechStackItem into our form. Category may be null if no
 * BuiltWith tag matched the canonical map — treated as unknown / informational.
 */
function normalizeTech(
  t: TechStackItem,
  source: 'verified' | 'audit' | 'builtwith'
): NormalizedClientTech {
  const fromTag = normalizeBuiltWithTag(t.tag)
  const fromCategories = (t.categories ?? [])
    .map((c) => normalizeBuiltWithTag(c))
    .find((c): c is OurStackCategory => !!c)
  return {
    name: t.name,
    category: fromTag ?? fromCategories ?? null,
    tag: t.tag,
    source,
  }
}

/**
 * Merge client stack sources into a single normalized list.
 *
 * Precedence:
 *   verified (admin-resolved) > audit self-report > BuiltWith
 *
 * Conflicts are reported when verified is absent AND audit and builtwith
 * disagree within the same canonical category (different technology names).
 * Verified wins: if a verified list is provided, conflicts are returned empty.
 */
export function mergeClientStack(sources: ClientStackSources): MergedClientStack {
  const verified = sources.verified?.technologies ?? []
  const audit = sources.audit?.technologies ?? []
  const builtwith = sources.builtwith?.technologies ?? []

  if (verified.length > 0) {
    return {
      technologies: verified.map((t) => normalizeTech(t, 'verified')),
      source: 'verified',
      conflicts: [],
    }
  }

  const auditNorm = audit.map((t) => normalizeTech(t, 'audit'))
  const builtwithNorm = builtwith.map((t) => normalizeTech(t, 'builtwith'))

  const conflicts: StackConflict[] = []
  if (auditNorm.length > 0 && builtwithNorm.length > 0) {
    const byCategoryAudit = new Map<OurStackCategory, string>()
    for (const a of auditNorm) {
      if (a.category && !byCategoryAudit.has(a.category)) byCategoryAudit.set(a.category, a.name)
    }
    const byCategoryBW = new Map<OurStackCategory, string>()
    for (const b of builtwithNorm) {
      if (b.category && !byCategoryBW.has(b.category)) byCategoryBW.set(b.category, b.name)
    }
    for (const [cat, auditName] of byCategoryAudit) {
      const bwName = byCategoryBW.get(cat)
      if (bwName && bwName.toLowerCase() !== auditName.toLowerCase()) {
        conflicts.push({ category: cat, audit: auditName, builtwith: bwName })
      }
    }
  }

  const merged: NormalizedClientTech[] = []
  const seen = new Set<string>()
  for (const t of [...auditNorm, ...builtwithNorm]) {
    const key = t.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(t)
  }

  let source: ClientStackSource = 'empty'
  if (auditNorm.length > 0 && builtwithNorm.length > 0) source = 'merged'
  else if (auditNorm.length > 0) source = 'audit'
  else if (builtwithNorm.length > 0) source = 'builtwith'

  return { technologies: merged, source, conflicts }
}

// ---------------------------------------------------------------------------
// buildFeasibilityAssessment
// ---------------------------------------------------------------------------

export interface BuildFeasibilityInput {
  /** Proposed items to assess; empty or absent produces an empty items[] assessment. */
  proposedItems: ProposedItemInput[]
  /** Bundle identity for metadata. */
  bundle?: { id: string | null; name?: string | null }
  /** Client stack sources; merged internally. */
  clientStack: ClientStackSources
  /** Creditsremaining from the BuiltWith response; null if BuiltWith was not called. */
  builtwithCreditsRemaining?: number | null
}

function resolveTechStack(item: ProposedItemInput): { decl: TechStackDeclaration; inferred: boolean } {
  if (item.tech_stack && Array.isArray(item.tech_stack.platform)) {
    return { decl: item.tech_stack, inferred: false }
  }
  const fallback = DEFAULT_TECH_STACK_BY_CONTENT_TYPE[item.content_type]
  if (fallback) {
    return {
      decl: {
        platform: [...fallback.platform],
        integrations: [...fallback.integrations],
        client_infrastructure_required: fallback.client_infrastructure_required
          ? [...fallback.client_infrastructure_required]
          : [],
        notes: fallback.notes,
      },
      inferred: true,
    }
  }
  return {
    decl: { platform: [], integrations: [], client_infrastructure_required: [], notes: undefined },
    inferred: true,
  }
}

function findOurEntry(name: string): OurStackEntry | null {
  const lower = name.toLowerCase()
  return OUR_TECH_STACK.find((e) => e.name.toLowerCase() === lower) ?? null
}

function categoryOfOurName(name: string): OurStackCategory | null {
  return findOurEntry(name)?.category ?? null
}

function clientHasCategory(
  client: MergedClientStack,
  category: OurStackCategory | null
): { present: boolean; clientName?: string } {
  if (!category) return { present: false }
  const hit = client.technologies.find((t) => t.category === category)
  return hit ? { present: true, clientName: hit.name } : { present: false }
}

function scoreEffort(gaps: number, integrations: number, infra: number, replacements: number): Effort {
  const score = gaps * 2 + integrations + infra + replacements * 3
  if (score <= 2) return 'small'
  if (score <= 6) return 'medium'
  return 'large'
}

function worstEffort(a: Effort, b: Effort): Effort {
  const order: Record<Effort, number> = { small: 0, medium: 1, large: 2 }
  return order[a] >= order[b] ? a : b
}

function effortToFeasibility(effort: Effort, hasReplacement: boolean): OverallFeasibility {
  if (hasReplacement) return effort === 'large' ? 'low' : 'medium'
  if (effort === 'large') return 'medium'
  if (effort === 'medium') return 'medium'
  return 'high'
}

function hashInputs(input: BuildFeasibilityInput, merged: MergedClientStack): string {
  const normalized = {
    bundle: input.bundle?.id ?? null,
    items: input.proposedItems.map((i) => ({
      k: `${i.content_type}:${i.content_id}`,
      ts: i.tech_stack ?? null,
    })),
    client: merged.technologies.map((t) => ({ n: t.name, c: t.category, s: t.source })),
    version: OUR_TECH_STACK_VERSION,
  }
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex').slice(0, 16)
}

export function buildFeasibilityAssessment(input: BuildFeasibilityInput): FeasibilityAssessment {
  const merged = mergeClientStack(input.clientStack)

  const credits = input.builtwithCreditsRemaining ?? null
  let creditsState: BuiltWithCreditsState = 'unknown'
  if (credits !== null) creditsState = credits > 0 ? 'ok' : 'exhausted'

  const items: FeasibilityItem[] = []
  const openTradeoffs: string[] = []

  for (const prop of input.proposedItems) {
    const { decl, inferred } = resolveTechStack(prop)

    const fit: FeasibilityItem['fit'] = []
    let gaps = 0
    let integrationsCount = 0
    let replacements = 0
    const risks: string[] = []

    for (const platformName of decl.platform) {
      const category = categoryOfOurName(platformName)
      const hit = clientHasCategory(merged, category)
      if (!category) {
        fit.push({ capability: platformName, kind: 'unknown', our: platformName })
        continue
      }
      if (hit.present) {
        if (hit.clientName && hit.clientName.toLowerCase() !== platformName.toLowerCase()) {
          fit.push({
            capability: category,
            kind: 'replace',
            our: platformName,
            client: hit.clientName,
            note: `Client uses ${hit.clientName}; our delivery uses ${platformName} — decide: keep ${hit.clientName}, migrate, or coexist.`,
          })
          replacements += 1
          openTradeoffs.push(
            `${prop.title}: client runs on ${hit.clientName} (${category}); decide whether to migrate or coexist with ${platformName}.`
          )
        } else {
          fit.push({ capability: category, kind: 'match', our: platformName, client: hit.clientName })
        }
      } else {
        fit.push({ capability: category, kind: 'gap', our: platformName, note: `${platformName} will run on our platform; no client-side infrastructure needed.` })
        gaps += 1
      }
    }

    for (const integ of decl.integrations) {
      const category = categoryOfOurName(integ.system)
      const hit = clientHasCategory(merged, category)
      if (hit.present) {
        fit.push({
          capability: category ?? integ.system,
          kind: 'integrate',
          our: integ.system,
          client: hit.clientName,
          note: `We integrate ${integ.system} with your ${hit.clientName} (${integ.direction ?? 'bi-directional'} via ${integ.method ?? 'API'}).`,
        })
        integrationsCount += 1
      } else {
        fit.push({
          capability: category ?? integ.system,
          kind: 'gap',
          our: integ.system,
          note: `${integ.system} will be set up on your behalf — no current integration detected.`,
        })
        gaps += 1
      }
    }

    const infra = decl.client_infrastructure_required ?? []
    if (infra.length > 0) {
      risks.push(`Requires client-side: ${infra.join(', ')}`)
    }

    const effort = scoreEffort(gaps, integrationsCount, infra.length, replacements)

    items.push({
      content_key: `${prop.content_type}:${prop.content_id}`,
      content_type: prop.content_type,
      title: prop.title,
      requires: {
        platform: decl.platform,
        integrations: decl.integrations,
        client_infrastructure: infra,
      },
      fit,
      effort,
      risks,
      inferred_from_defaults: inferred,
    })
  }

  const aggregateEffort = items.reduce<Effort>((acc, it) => worstEffort(acc, it.effort), 'small')
  const anyReplacement = items.some((it) => it.fit.some((f) => f.kind === 'replace'))
  const overall = effortToFeasibility(aggregateEffort, anyReplacement)

  const stackFitSummary = (() => {
    if (items.length === 0) return 'No proposed items to assess.'
    const matches = items.reduce((n, it) => n + it.fit.filter((f) => f.kind === 'match').length, 0)
    const integrations = items.reduce((n, it) => n + it.fit.filter((f) => f.kind === 'integrate').length, 0)
    const gaps = items.reduce((n, it) => n + it.fit.filter((f) => f.kind === 'gap').length, 0)
    const replaces = items.reduce((n, it) => n + it.fit.filter((f) => f.kind === 'replace').length, 0)
    return `Across ${items.length} proposed items: ${matches} already-have, ${integrations} integrations, ${gaps} new setup, ${replaces} replacement decisions.`
  })()

  return {
    generated_at: new Date().toISOString(),
    inputs_hash: hashInputs(input, merged),
    our_stack_version: OUR_TECH_STACK_VERSION,
    generated_from: { bundleId: input.bundle?.id ?? null, bundleName: input.bundle?.name ?? null },
    client_stack_source: merged.source,
    builtwith_credits_remaining: credits,
    builtwith_credits_state: creditsState,
    items,
    overall_feasibility: overall,
    estimated_complexity: aggregateEffort,
    open_tradeoffs: openTradeoffs,
    stack_fit_summary: stackFitSummary,
    conflicts: merged.conflicts,
  }
}

// ---------------------------------------------------------------------------
// projectForClient
// ---------------------------------------------------------------------------

const EFFORT_LABEL_CLIENT: Record<Effort, string> = {
  small: 'Quick setup',
  medium: 'Phased rollout',
  large: 'Strategic project',
}

const OVERALL_LABEL_CLIENT: Record<OverallFeasibility, string> = {
  high: 'Strong fit with your current stack',
  medium: 'Good fit with some setup required',
  low: 'Meaningful changes required — worth discussing',
}

export interface ClientFeasibilityItem {
  title: string
  fit_summary: string
  effort_label: string
  works_with: string[]
  connects_to: string[]
  we_set_up: string[]
}

export interface ClientFeasibilityView {
  generated_at: string
  overall_fit_label: string
  estimated_complexity_label: string
  items: ClientFeasibilityItem[]
  open_decisions: string[]
  headline: string
}

/**
 * Project the internal assessment into the client-safe view rendered on
 * app/proposal/[code]/page.tsx. Strips internal hashes, effort enums, and
 * raw tradeoff language; renders friendly labels.
 */
export function projectForClient(snapshot: FeasibilityAssessment): ClientFeasibilityView {
  return {
    generated_at: snapshot.generated_at,
    overall_fit_label: OVERALL_LABEL_CLIENT[snapshot.overall_feasibility],
    estimated_complexity_label: EFFORT_LABEL_CLIENT[snapshot.estimated_complexity],
    headline: snapshot.stack_fit_summary,
    open_decisions: snapshot.open_tradeoffs,
    items: snapshot.items.map((it) => {
      const works_with: string[] = []
      const connects_to: string[] = []
      const we_set_up: string[] = []
      for (const f of it.fit) {
        if (f.kind === 'match' && f.client) works_with.push(f.client)
        else if (f.kind === 'integrate' && f.client) connects_to.push(`${f.our} ↔ ${f.client}`)
        else if (f.kind === 'gap') we_set_up.push(f.our)
        else if (f.kind === 'replace' && f.client) {
          connects_to.push(`${f.our} (coexist or replace ${f.client})`)
        }
      }
      const segments: string[] = []
      if (works_with.length) segments.push(`works with ${works_with.join(', ')}`)
      if (connects_to.length) segments.push(`connects to ${connects_to.join(', ')}`)
      if (we_set_up.length) segments.push(`we set up ${we_set_up.join(', ')}`)
      return {
        title: it.title,
        fit_summary: segments.length ? segments.join(' • ') : 'Delivered entirely on our platform.',
        effort_label: EFFORT_LABEL_CLIENT[it.effort],
        works_with,
        connects_to,
        we_set_up,
      }
    }),
  }
}
