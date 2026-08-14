type SupabaseClientLike = {
  from: (table: string) => any
}

type FetchLike = typeof fetch

export type XOAuthCredentials = {
  access_token?: string | null
  refresh_token?: string | null
  expires_in?: number | null
  token_obtained_at?: string | null
  token_type?: string | null
  scope?: string | null
  user_id?: string | null
}

export type XOAuthRefreshErrorCode =
  | 'x_refresh_token_missing'
  | 'x_oauth_client_config_missing'
  | 'x_token_refresh_failed'
  | 'x_token_refresh_persist_failed'
  | 'x_token_refresh_concurrent_update'

export type XOAuthRefreshError = {
  code: XOAuthRefreshErrorCode
  message: string
  status?: number
}

export type XOAuthRefreshResult = {
  refreshed: boolean
  credentials: XOAuthCredentials
  error?: XOAuthRefreshError
}

const X_TOKEN_URL = 'https://api.x.com/2/oauth2/token'

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asPositiveNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function xClientConfig(env: NodeJS.ProcessEnv = process.env) {
  const clientId = asString(env.X_CLIENT_ID) || asString(env.TWITTER_CLIENT_ID)
  const clientSecret = asString(env.X_CLIENT_SECRET) || asString(env.TWITTER_CLIENT_SECRET)
  return { clientId, clientSecret }
}

export function isXAccessTokenStale(input: {
  credentials: XOAuthCredentials
  now?: Date
  bufferMs?: number
  missingMetadataIsStale?: boolean
}) {
  const now = input.now ?? new Date()
  const bufferMs = input.bufferMs ?? 10 * 60 * 1000
  const expiresIn = asPositiveNumber(input.credentials.expires_in)
  const obtainedAtValue = asString(input.credentials.token_obtained_at)

  if (!expiresIn || !obtainedAtValue) return Boolean(input.missingMetadataIsStale)

  const obtainedAt = new Date(obtainedAtValue).getTime()
  if (Number.isNaN(obtainedAt)) return Boolean(input.missingMetadataIsStale)

  return now.getTime() + bufferMs >= obtainedAt + expiresIn * 1000
}

async function persistXOAuthCredentials(input: {
  db: SupabaseClientLike
  previousRefreshToken: string
  previousTokenObtainedAt: string | null
  credentials: XOAuthCredentials
}): Promise<{ error?: XOAuthRefreshError }> {
  let query = input.db
    .from('social_content_config')
    .update({ credentials: input.credentials })
    .eq('platform', 'x')
    .eq('credentials->>refresh_token', input.previousRefreshToken)

  query = input.previousTokenObtainedAt
    ? query.eq('credentials->>token_obtained_at', input.previousTokenObtainedAt)
    : query.is('credentials->>token_obtained_at', null)

  const result = await query
    .select('credentials')
    .maybeSingle()

  if (result.error) {
    return {
      error: {
        code: 'x_token_refresh_persist_failed',
        message: 'X token refresh succeeded but refreshed credentials could not be recorded; reconnect X before retrying.',
      },
    }
  }

  if (!result.data) {
    return {
      error: {
        code: 'x_token_refresh_concurrent_update',
        message: 'X token refresh was superseded by a newer credential update; retry after reloading provider config.',
      },
    }
  }

  return {}
}

export async function refreshXOAuthCredentials(input: {
  db: SupabaseClientLike
  credentials: XOAuthCredentials
  fetchImpl?: FetchLike
  now?: Date
  env?: NodeJS.ProcessEnv
}): Promise<XOAuthRefreshResult> {
  const credentials = input.credentials
  const refreshToken = asString(credentials.refresh_token)
  if (!refreshToken) {
    return {
      refreshed: false,
      credentials,
      error: {
        code: 'x_refresh_token_missing',
        message: 'Stored X access token is stale and no refresh token is available; reconnect X before retrying.',
      },
    }
  }

  const { clientId, clientSecret } = xClientConfig(input.env)
  if (!clientId || !clientSecret) {
    return {
      refreshed: false,
      credentials,
      error: {
        code: 'x_oauth_client_config_missing',
        message: 'X OAuth client credentials are not configured for token refresh.',
      },
    }
  }

  let response: Response
  try {
    response = await (input.fetchImpl ?? fetch)(X_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
      }),
    })
  } catch {
    return {
      refreshed: false,
      credentials,
      error: {
        code: 'x_token_refresh_failed',
        message: 'X token refresh failed before a provider request could be attempted.',
      },
    }
  }

  const data = await response.json().catch(() => ({})) as {
    access_token?: unknown
    refresh_token?: unknown
    expires_in?: unknown
    token_type?: unknown
    scope?: unknown
  }
  const accessToken = asString(data.access_token)
  const expiresIn = asPositiveNumber(data.expires_in)

  if (!response.ok || !accessToken || !expiresIn) {
    return {
      refreshed: false,
      credentials,
      error: {
        code: 'x_token_refresh_failed',
        message: `X token refresh failed (${response.status}); reconnect X before retrying.`,
        status: response.status,
      },
    }
  }

  const refreshedCredentials: XOAuthCredentials = {
    ...credentials,
    access_token: accessToken,
    refresh_token: asString(data.refresh_token) || refreshToken,
    expires_in: expiresIn,
    token_type: asString(data.token_type) || credentials.token_type,
    scope: asString(data.scope) || credentials.scope,
    token_obtained_at: (input.now ?? new Date()).toISOString(),
  }

  const persisted = await persistXOAuthCredentials({
    db: input.db,
    previousRefreshToken: refreshToken,
    previousTokenObtainedAt: asString(credentials.token_obtained_at),
    credentials: refreshedCredentials,
  })
  if (persisted.error) {
    return {
      refreshed: false,
      credentials,
      error: persisted.error,
    }
  }

  return {
    refreshed: true,
    credentials: refreshedCredentials,
  }
}
