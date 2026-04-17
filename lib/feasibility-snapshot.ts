/**
 * Shared helpers for loading the stack-aware feasibility assessment for a
 * given bundle + contact/audit pair. Used by the Gamma report builder and by
 * the proposal create endpoint so both write the same snapshot into
 * `gamma_reports.feasibility_assessment` and `proposals.feasibility_assessment`.
 *
 * A single source of truth avoids drift between the deck prompt and the
 * client-facing proposal projection.
 */

import { supabaseAdmin } from './supabase'
import { expandBundleItems } from './bundle-expand'
import {
  buildFeasibilityAssessment,
  type FeasibilityAssessment,
  type ProposedItemInput,
  type ClientStackSources,
  type TechStackDeclaration,
} from './implementation-feasibility'
import type { TechStackItem } from './tech-stack-lookup'

export const FEASIBILITY_ASSESSMENT_ENABLED =
  (process.env.FEASIBILITY_ASSESSMENT_ENABLED ?? 'false').toLowerCase() === 'true'

export function technologiesFromBlob(
  blob: Record<string, unknown> | null | undefined
): TechStackItem[] {
  if (!blob || typeof blob !== 'object') return []
  const arr = (blob as { technologies?: unknown }).technologies
  if (!Array.isArray(arr)) return []
  return arr.filter(
    (t): t is TechStackItem =>
      !!t && typeof t === 'object' && typeof (t as TechStackItem).name === 'string'
  )
}

export interface ClientStackInput {
  contactWebsiteTechStack: Record<string, unknown> | null | undefined
  contactVerifiedTechStack: Record<string, unknown> | null | undefined
  auditEnrichedTechStack: Record<string, unknown> | null | undefined
}

export function extractClientStackSources(input: ClientStackInput): {
  sources: ClientStackSources
  creditsRemaining: number | null
} {
  const contactBlob = input.contactWebsiteTechStack ?? null
  const verifiedBlob = input.contactVerifiedTechStack ?? null
  const auditBlob = input.auditEnrichedTechStack ?? null

  const creditsRemaining =
    contactBlob && typeof (contactBlob as { creditsRemaining?: unknown }).creditsRemaining === 'number'
      ? (contactBlob as { creditsRemaining: number }).creditsRemaining
      : null

  const verifiedTechs = technologiesFromBlob(verifiedBlob)
  const auditTechs = technologiesFromBlob(auditBlob)
  const builtwithTechs = technologiesFromBlob(contactBlob)

  return {
    sources: {
      verified:
        verifiedTechs.length > 0
          ? {
              technologies: verifiedTechs,
              resolved_at: (verifiedBlob as { resolved_at?: string } | null)?.resolved_at,
              resolved_by: (verifiedBlob as { resolved_by?: string } | null)?.resolved_by,
            }
          : null,
      audit: auditTechs.length > 0 ? { technologies: auditTechs } : null,
      builtwith:
        builtwithTechs.length > 0
          ? { technologies: builtwithTechs, fetchedAt: null, creditsRemaining }
          : null,
    },
    creditsRemaining,
  }
}

const TABLE_MAP: Record<string, string> = {
  product: 'products',
  project: 'projects',
  video: 'videos',
  publication: 'publications',
  music: 'music',
  lead_magnet: 'lead_magnets',
  prototype: 'app_prototypes',
  service: 'services',
}

export async function loadBundleProposedItems(
  bundleId: string | undefined | null
): Promise<ProposedItemInput[]> {
  if (!bundleId || !supabaseAdmin) return []
  const expanded = await expandBundleItems(bundleId)
  if (expanded.length === 0) return []

  const byType = new Map<string, string[]>()
  for (const it of expanded) {
    const ids = byType.get(it.content_type) ?? []
    ids.push(it.content_id)
    byType.set(it.content_type, ids)
  }

  const techByKey = new Map<string, TechStackDeclaration | null>()
  const titleByKey = new Map<string, string>()

  for (const [ct, ids] of byType.entries()) {
    const [rolesRes, contentRes] = await Promise.all([
      supabaseAdmin
        .from('content_offer_roles')
        .select('content_id, tech_stack')
        .eq('content_type', ct)
        .in('content_id', ids),
      TABLE_MAP[ct]
        ? supabaseAdmin.from(TABLE_MAP[ct]).select('id, title').in('id', ids)
        : Promise.resolve({ data: [] as Array<{ id: string; title?: string }> }),
    ])
    for (const r of ((rolesRes as { data?: Array<{ content_id: string; tech_stack: TechStackDeclaration | null }> }).data ?? [])) {
      techByKey.set(`${ct}:${r.content_id}`, r.tech_stack ?? null)
    }
    for (const c of ((contentRes as { data?: Array<{ id: string; title?: string; name?: string }> }).data ?? [])) {
      titleByKey.set(`${ct}:${c.id}`, c.title ?? c.name ?? 'Untitled')
    }
  }

  return expanded.map((it) => {
    const key = `${it.content_type}:${it.content_id}`
    return {
      content_type: it.content_type,
      content_id: it.content_id,
      title: it.override_title ?? titleByKey.get(key) ?? 'Untitled',
      tech_stack: techByKey.get(key) ?? null,
    }
  })
}

export interface BuildSnapshotParams {
  bundleId: string | null | undefined
  contactSubmissionId?: number | null
  diagnosticAuditId?: string | number | null
}

/**
 * Build a feasibility snapshot by loading the client stack sources from
 * `contact_submissions` + `diagnostic_audits` and the proposed items from
 * the bundle. Returns null when the feature is disabled, the bundle is
 * missing, or Supabase admin is unavailable.
 */
export async function buildFeasibilitySnapshot(
  params: BuildSnapshotParams
): Promise<FeasibilityAssessment | null> {
  if (!FEASIBILITY_ASSESSMENT_ENABLED) return null
  if (!params.bundleId) return null
  if (!supabaseAdmin) return null

  const [proposedItems, bundleRow, contactRow, auditRow] = await Promise.all([
    loadBundleProposedItems(params.bundleId),
    supabaseAdmin
      .from('offer_bundles')
      .select('id, name')
      .eq('id', params.bundleId)
      .single()
      .then((r: { data: { id: string; name: string } | null }) => r.data),
    params.contactSubmissionId
      ? supabaseAdmin
          .from('contact_submissions')
          .select('website_tech_stack, client_verified_tech_stack')
          .eq('id', params.contactSubmissionId)
          .single()
          .then(
            (r: {
              data:
                | {
                    website_tech_stack: Record<string, unknown> | null
                    client_verified_tech_stack: Record<string, unknown> | null
                  }
                | null
            }) => r.data
          )
      : Promise.resolve(null),
    params.diagnosticAuditId
      ? supabaseAdmin
          .from('diagnostic_audits')
          .select('enriched_tech_stack')
          .eq('id', params.diagnosticAuditId)
          .single()
          .then(
            (r: { data: { enriched_tech_stack: Record<string, unknown> | null } | null }) => r.data
          )
      : Promise.resolve(null),
  ])

  if (proposedItems.length === 0) return null

  const { sources, creditsRemaining } = extractClientStackSources({
    contactWebsiteTechStack: contactRow?.website_tech_stack ?? null,
    contactVerifiedTechStack: contactRow?.client_verified_tech_stack ?? null,
    auditEnrichedTechStack: auditRow?.enriched_tech_stack ?? null,
  })

  return buildFeasibilityAssessment({
    proposedItems,
    bundle: { id: bundleRow?.id ?? params.bundleId, name: bundleRow?.name ?? null },
    clientStack: sources,
    builtwithCreditsRemaining: creditsRemaining,
  })
}
