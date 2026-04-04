import { supabaseAdmin } from '@/lib/supabase'

/**
 * Whether the given user may access this audit (same rules as GET /api/user/audit, but for a specific id).
 */
export async function userOwnsAudit(
  auditId: string,
  userId: string,
  email: string
): Promise<boolean> {
  if (!supabaseAdmin) return false

  const { data: byUser } = await supabaseAdmin
    .from('diagnostic_audits')
    .select('id')
    .eq('id', auditId)
    .eq('user_id', userId)
    .maybeSingle()

  if (byUser) return true

  const norm = email.trim().toLowerCase()
  if (!norm) return false

  const { data: byEmail } = await supabaseAdmin
    .from('diagnostic_audits')
    .select('id')
    .eq('id', auditId)
    .eq('contact_email', norm)
    .maybeSingle()

  if (byEmail) return true

  const { data: contactRows } = await supabaseAdmin
    .from('contact_submissions')
    .select('id')
    .eq('email', norm)

  const contactIds = (contactRows || []).map((c: { id: number }) => c.id)
  if (contactIds.length === 0) return false

  const { data: byContact } = await supabaseAdmin
    .from('diagnostic_audits')
    .select('id')
    .eq('id', auditId)
    .in('contact_submission_id', contactIds)
    .maybeSingle()

  return !!byContact
}
