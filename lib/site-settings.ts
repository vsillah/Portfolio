/**
 * Site Settings — DB-backed key-value configuration.
 *
 * Values are stored as JSONB in the `site_settings` table so they can be
 * edited from the admin UI without redeploying.
 */

import { supabaseAdmin } from './supabase'
import { resolveBusinessEmailConfig } from './business-email-config'

export async function getSiteSetting<T = string>(key: string): Promise<T | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('site_settings')
      .select('value')
      .eq('key', key)
      .single()

    if (error || !data) return null
    return data.value as T
  } catch {
    return null
  }
}

export async function setSiteSetting(key: string, value: unknown): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('site_settings')
      .upsert({ key, value }, { onConflict: 'key' })

    if (error) {
      console.error(`[SiteSettings] Failed to set ${key}:`, error.message)
      return false
    }
    return true
  } catch {
    return false
  }
}

export async function getBusinessOwnerEmail(): Promise<string> {
  const email = await getSiteSetting<string>('business_owner_email')
  return email || resolveBusinessEmailConfig().adminNotificationEmail
}
