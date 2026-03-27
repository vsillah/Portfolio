import { getToken, updateTokens } from '@/lib/integration-tokens'

const READ_AI_API_BASE = 'https://api.read.ai'
const READ_AI_TOKEN_URL = 'https://authn.read.ai/oauth2/token'
const PROVIDER = 'read_ai'
const TOKEN_BUFFER_SECONDS = 60

export interface ReadAiMeeting {
  id: string
  title: string
  start_time_ms: number
  end_time_ms: number | null
  participants: Array<{
    name: string
    email: string | null
    invited: boolean
    attended: boolean
  }>
  owner: { name: string; email: string }
  report_url: string
  platform: string
  summary?: string
  action_items?: Array<{ text: string; assignee?: string }>
  transcript?: { text: string }
}

export interface ReadAiListResponse {
  object: string
  url: string
  has_more: boolean
  data: ReadAiMeeting[]
}

/**
 * Get a valid access token, refreshing if expired or about to expire.
 * Returns null if no token is configured.
 */
async function getValidAccessToken(): Promise<string | null> {
  const token = await getToken(PROVIDER)
  if (!token) return null

  const expiresAt = new Date(token.token_expires_at).getTime()
  const now = Date.now()

  if (expiresAt - now > TOKEN_BUFFER_SECONDS * 1000) {
    return token.access_token
  }

  const refreshed = await refreshAccessToken(
    token.client_id,
    token.client_secret,
    token.refresh_token
  )

  if (!refreshed) {
    console.error('[read-ai] Token refresh failed — returning stale token as fallback')
    return token.access_token
  }

  return refreshed.access_token
}

async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const res = await fetch(READ_AI_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[read-ai] Refresh failed (${res.status}):`, body)
      return null
    }

    const data = await res.json()
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()

    await updateTokens(PROVIDER, data.access_token, data.refresh_token, expiresAt)

    return data
  } catch (err) {
    console.error('[read-ai] Refresh error:', err)
    return null
  }
}

async function readAiFetch<T>(path: string, params?: Record<string, string | string[]>): Promise<T> {
  const accessToken = await getValidAccessToken()
  if (!accessToken) {
    throw new Error('Read.ai is not configured — no integration token found')
  }

  const url = new URL(path, READ_AI_API_BASE)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, v))
      } else {
        url.searchParams.set(key, value)
      }
    }
  }

  let res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  // Retry once on 401 (token may have expired between check and use)
  if (res.status === 401) {
    const token = await getToken(PROVIDER)
    if (token) {
      const refreshed = await refreshAccessToken(token.client_id, token.client_secret, token.refresh_token)
      if (refreshed) {
        res = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${refreshed.access_token}`,
            Accept: 'application/json',
          },
          cache: 'no-store',
        })
      }
    }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Read.ai API error ${res.status}: ${body.slice(0, 300)}`)
  }

  return res.json()
}

/**
 * List recent meetings, optionally filtering by a time window.
 * Returns up to `limit` meetings (max 10 per Read.ai page).
 */
export async function listMeetings(options?: {
  limit?: number
  afterMs?: number
  cursor?: string
  expand?: string[]
}): Promise<ReadAiListResponse> {
  const params: Record<string, string | string[]> = {}
  if (options?.limit) params.limit = String(options.limit)
  if (options?.afterMs) params['start_time_ms.gt'] = String(options.afterMs)
  if (options?.cursor) params.cursor = options.cursor
  if (options?.expand) params['expand[]'] = options.expand

  return readAiFetch<ReadAiListResponse>('/v1/meetings', params)
}

/**
 * Search meetings where a given email appears in the participants list.
 * Since Read.ai doesn't support server-side filtering by participant,
 * we fetch pages and filter client-side.
 */
export async function searchMeetingsByAttendeeEmail(
  email: string,
  options?: { maxPages?: number; afterMs?: number }
): Promise<ReadAiMeeting[]> {
  const normalizedEmail = email.toLowerCase().trim()
  if (!normalizedEmail) return []

  const maxPages = options?.maxPages ?? 5
  const matched: ReadAiMeeting[] = []
  let cursor: string | undefined

  for (let page = 0; page < maxPages; page++) {
    const result = await listMeetings({
      limit: 10,
      afterMs: options?.afterMs,
      cursor,
      expand: ['summary', 'action_items'],
    })

    for (const meeting of result.data) {
      const hasAttendee = meeting.participants.some(
        (p) => p.email?.toLowerCase() === normalizedEmail
      )
      if (hasAttendee) {
        matched.push(meeting)
      }
    }

    if (!result.has_more || result.data.length === 0) break
    cursor = result.data[result.data.length - 1].id
  }

  return matched
}

/**
 * Get full meeting detail including transcript.
 */
export async function getMeetingDetail(meetingId: string): Promise<ReadAiMeeting> {
  return readAiFetch<ReadAiMeeting>(`/v1/meetings/${meetingId}`, {
    'expand[]': ['summary', 'action_items', 'transcript', 'topics'],
  })
}

/**
 * Check if Read.ai integration is configured (token row exists).
 */
export async function isReadAiConfigured(): Promise<boolean> {
  const token = await getToken(PROVIDER)
  return token !== null
}
