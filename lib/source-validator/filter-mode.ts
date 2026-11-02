/** Pure downstream faithfulness filter contract. */
export type FaithfulnessMode = 'off' | 'permissive' | 'strict'

export function getFaithfulnessMode(): FaithfulnessMode {
  const raw = (process.env.VEP_FAITHFULNESS_MODE ?? '').toLowerCase().trim()
  if (raw === 'permissive' || raw === 'strict') return raw
  return 'off'
}

/**
 * Applies the project-wide downstream filter contract to a pain_point_evidence
 * Supabase query builder. Every calculation / reporting / pricing path that
 * reads pain_point_evidence should chain this helper instead of hardcoding
 * `.neq(...).neq(...)` so the rule can evolve in one place.
 *
 * Usage:
 *   const { data } = await applyValidatedEvidenceFilter(
 *     supabaseAdmin.from('pain_point_evidence').select('*')
 *   )
 *
 * Admin/display endpoints that need to see ALL rows (including rejected) must
 * NOT call this helper — they should show validation status in the UI instead.
 */
export function applyValidatedEvidenceFilter<Q extends { eq: (col: string, v: unknown) => Q; neq: (col: string, v: unknown) => Q }>(
  query: Q,
  mode: FaithfulnessMode = getFaithfulnessMode()
): Q {
  if (mode === 'off') return query
  // Always drop explicit 'rejected' source validation regardless of mode.
  let q = query.neq('source_validation_status', 'rejected')
  if (mode === 'strict') {
    q = q.eq('excerpt_faithfulness_status', 'faithful')
  } else {
    // permissive
    q = q.neq('excerpt_faithfulness_status', 'unfaithful')
  }
  return q
}
