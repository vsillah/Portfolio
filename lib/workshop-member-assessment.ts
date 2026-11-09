import { supabaseAdmin } from '@/lib/supabase'
import { getDashboardByToken } from '@/lib/client-dashboard'

// The content edition is the durable workshop discriminator in the existing
// member schema. Never infer a workshop from a lesson ID or from the latest audit.
export async function loadWorkshopMemberAssessment(userId: string, contentVersion: string) {
  const owners = await supabaseAdmin.from('accelerated_decision_file_owners')
    .select('intake_id').eq('user_id', userId)
  if (owners.error) throw new Error('Workshop ownership unavailable')
  const ownerIds = (owners.data ?? []).map((row: { intake_id: string }) => row.intake_id)
  if (!ownerIds.length) return { intakeCount: 0, assessmentStatus: null, assessment: null, recommendations: [] }

  const intakes = await supabaseAdmin.from('accelerated_decision_file_intakes')
    .select('id,linked_audit_id,review_status,submitted_at')
    .in('id', ownerIds).eq('content_version', contentVersion)
    .order('submitted_at', { ascending: false })
  if (intakes.error) throw new Error('Workshop intakes unavailable')
  const linked = (intakes.data ?? []).find((row: { review_status: string; linked_audit_id: number | null }) =>
    row.review_status === 'linked' && row.linked_audit_id != null)
  if (!linked) return { intakeCount: intakes.data?.length ?? 0, assessmentStatus: null, assessment: null, recommendations: [] }

  const audit = await supabaseAdmin.from('diagnostic_audits')
    .select('id,status,diagnostic_summary').eq('id', linked.linked_audit_id)
    .eq('user_id', userId).eq('status', 'completed').maybeSingle()
  if (audit.error) throw new Error('Workshop assessment unavailable')
  if (!audit.data) return { intakeCount: intakes.data?.length ?? 0, assessmentStatus: null, assessment: null, recommendations: [] }

  let recommendations = await supabaseAdmin.from('accelerated_member_recommendations')
    .select('id,offer_kind,offer_id,title,rationale,reviewed_at,approved_price,approved_is_quote_based,approved_is_print_on_demand,approved_variant_prices')
    .eq('user_id', userId).eq('intake_id', linked.id).eq('audit_id', audit.data.id).eq('review_status', 'approved')
  // The purchase snapshot columns are staged separately. Preserve read-only
  // recommendations on a deployment that has not received that migration.
  if (recommendations.error?.code === '42703') {
    recommendations = await supabaseAdmin.from('accelerated_member_recommendations')
      .select('id,offer_kind,offer_id,title,rationale,reviewed_at')
      .eq('user_id', userId).eq('intake_id', linked.id).eq('audit_id', audit.data.id).eq('review_status', 'approved')
  }
  if (recommendations.error) throw new Error('Workshop recommendations unavailable')

  const access = await supabaseAdmin.from('client_dashboard_access')
    .select('access_token').eq('diagnostic_audit_id', audit.data.id).eq('is_active', true).limit(1).maybeSingle()
  if (access.error) throw new Error('Workshop assessment access unavailable')
  let assessment = null
  if (access.data?.access_token) {
    const projected = await getDashboardByToken(access.data.access_token)
    if (projected.error) throw new Error('Workshop assessment projection unavailable')
    if (projected.stage === 'lead') assessment = projected.data
  }
  return {
    intakeCount: intakes.data?.length ?? 0,
    assessmentStatus: { status: audit.data.status, summary: audit.data.diagnostic_summary },
    assessment,
    recommendations: recommendations.data ?? [],
  }
}
