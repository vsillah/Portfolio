/**
 * Find contact_submissions by normalized email or create a row (dedupe + 23505 race).
 * lead_source must satisfy contact_submissions_lead_source_check.
 */

import { supabaseAdmin } from './supabase'

export type FindOrCreateContactOptions = {
  name?: string
  company?: string | null
  companyDomain?: string | null
  message?: string
  /** DB CHECK constraint — use a listed value (e.g. website_form, other). */
  leadSource: string
}

export async function findOrCreateContactByEmail(
  email: string,
  options: FindOrCreateContactOptions
): Promise<number | null> {
  if (!supabaseAdmin) return null
  try {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) return null

    const { data: existing } = await supabaseAdmin
      .from('contact_submissions')
      .select('id')
      .eq('email', normalizedEmail)
      .limit(1)
      .maybeSingle()

    if (existing?.id) return existing.id

    const displayName = options.name?.trim() || normalizedEmail.split('@')[0]

    const { data: created, error } = await supabaseAdmin
      .from('contact_submissions')
      .insert({
        name: displayName,
        email: normalizedEmail,
        company: options.company ?? null,
        company_domain: options.companyDomain ?? null,
        message: options.message ?? 'Captured from site.',
        lead_source: options.leadSource,
      })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        const { data: raced } = await supabaseAdmin
          .from('contact_submissions')
          .select('id')
          .eq('email', normalizedEmail)
          .limit(1)
          .maybeSingle()
        return raced?.id ?? null
      }
      console.error('findOrCreateContactByEmail insert error:', error)
      return null
    }

    return created?.id ?? null
  } catch (err) {
    console.error('findOrCreateContactByEmail error:', err)
    return null
  }
}
