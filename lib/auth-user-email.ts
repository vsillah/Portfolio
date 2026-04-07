/**
 * Resolve primary email for a Supabase Auth user (service role).
 */

import { supabaseAdmin } from './supabase'

export async function getAuthUserPrimaryEmail(userId: string): Promise<string | null> {
  if (!supabaseAdmin || !userId) return null
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (error || !data?.user?.email) return null
    const email = data.user.email.trim().toLowerCase()
    return email || null
  } catch {
    return null
  }
}
