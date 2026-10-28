import type { Session } from '@supabase/supabase-js'
import { getCurrentSession, refreshCurrentSession } from '@/lib/auth'

type SessionReader = () => Promise<Session | null>

interface AuthenticatedFetchDependencies {
  fetchImpl?: typeof fetch
  getSession?: SessionReader
  refreshSession?: SessionReader
}

function withBearerToken(init: RequestInit | undefined, session: Session): RequestInit {
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${session.access_token}`)
  return { ...init, headers }
}

export async function fetchWithSessionRecovery(
  input: RequestInfo | URL,
  init?: RequestInit,
  dependencies: AuthenticatedFetchDependencies = {},
): Promise<Response | null> {
  const fetchImpl = dependencies.fetchImpl ?? fetch
  const getSession = dependencies.getSession ?? getCurrentSession
  const refreshSession = dependencies.refreshSession ?? refreshCurrentSession
  const session = await getSession()

  if (!session) return null

  const response = await fetchImpl(input, withBearerToken(init, session))
  if (response.status !== 401) return response

  const refreshedSession = await refreshSession()
  if (!refreshedSession) return response

  return fetchImpl(input, withBearerToken(init, refreshedSession))
}
