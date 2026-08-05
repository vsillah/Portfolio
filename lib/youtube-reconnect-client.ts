export const YOUTUBE_RECONNECT_PATH = '/admin/social-content/youtube/reconnect'
export const YOUTUBE_RECONNECT_LOGIN_PATH = `/auth/login?redirect=${encodeURIComponent(YOUTUBE_RECONNECT_PATH)}`

type SessionResult = {
  data?: {
    session?: {
      access_token?: string | null
    } | null
  } | null
  error?: {
    message?: string
  } | null
}

type FetchResponse = {
  ok: boolean
  json: () => Promise<unknown>
}

export type YouTubeReconnectResult =
  | { status: 'redirecting' }
  | { status: 'error'; message: string }

export async function startYouTubeReconnect({
  getSession,
  fetchAuthUrl,
  redirect,
}: {
  getSession: () => Promise<SessionResult>
  fetchAuthUrl: (accessToken: string) => Promise<FetchResponse>
  redirect: (url: string) => void
}): Promise<YouTubeReconnectResult> {
  const { data } = await getSession()
  const accessToken = data?.session?.access_token

  if (!accessToken) {
    redirect(YOUTUBE_RECONNECT_LOGIN_PATH)
    return { status: 'redirecting' }
  }

  const response = await fetchAuthUrl(accessToken)
  const body = await response.json().catch(() => null)
  const authUrl = typeof body === 'object' && body !== null && 'auth_url' in body
    ? body.auth_url
    : null

  if (!response.ok || typeof authUrl !== 'string' || !authUrl) {
    const message = typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
      ? body.error
      : 'YouTube connection could not start.'
    return { status: 'error', message }
  }

  redirect(authUrl)
  return { status: 'redirecting' }
}
