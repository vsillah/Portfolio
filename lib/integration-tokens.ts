import { supabaseAdmin } from '@/lib/supabase'

export interface IntegrationToken {
  id: string
  provider: string
  client_id: string
  client_secret: string
  access_token: string
  refresh_token: string
  token_expires_at: string
  scopes: string | null
  metadata: Record<string, unknown>
}

/**
 * Retrieve the token row for a provider.
 * Returns null when no row exists or supabaseAdmin is unavailable.
 */
export async function getToken(provider: string): Promise<IntegrationToken | null> {
  const sb = supabaseAdmin
  if (!sb) return null

  const { data, error } = await sb
    .from('integration_tokens')
    .select('*')
    .eq('provider', provider)
    .single()

  if (error || !data) return null
  return data as IntegrationToken
}

/**
 * Upsert a full token row (used for initial seeding and post-refresh updates).
 */
export async function upsertToken(
  provider: string,
  fields: {
    client_id: string
    client_secret: string
    access_token: string
    refresh_token: string
    token_expires_at: string
    scopes?: string
    metadata?: Record<string, unknown>
  }
): Promise<IntegrationToken | null> {
  const sb = supabaseAdmin
  if (!sb) return null

  const { data, error } = await sb
    .from('integration_tokens')
    .upsert(
      {
        provider,
        ...fields,
        metadata: fields.metadata ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'provider' }
    )
    .select('*')
    .single()

  if (error) {
    console.error(`[integration-tokens] upsert failed for ${provider}:`, error.message)
    return null
  }
  return data as IntegrationToken
}

/**
 * Update only the token fields after a refresh (atomic swap).
 */
export async function updateTokens(
  provider: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: string
): Promise<boolean> {
  const sb = supabaseAdmin
  if (!sb) return false

  const { error } = await sb
    .from('integration_tokens')
    .update({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('provider', provider)

  if (error) {
    console.error(`[integration-tokens] updateTokens failed for ${provider}:`, error.message)
    return false
  }
  return true
}
