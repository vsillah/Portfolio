import { getCurrentSession } from '@/lib/auth'

export class CampaignAdminRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'CampaignAdminRequestError'
  }
}

const CAMPAIGN_ADMIN_PATH = '/api/admin/campaigns'

function isCampaignAdminPath(path: string) {
  const url = new URL(path, window.location.origin)
  return (
    url.origin === window.location.origin &&
    (url.pathname === CAMPAIGN_ADMIN_PATH || url.pathname.startsWith(`${CAMPAIGN_ADMIN_PATH}/`))
  )
}

/** Send the current admin session only to same-origin campaign administration routes. */
export async function campaignAdminRequest(path: string, init: RequestInit = {}) {
  if (!isCampaignAdminPath(path)) {
    throw new CampaignAdminRequestError('Invalid campaign request destination.', 400)
  }

  const session = await getCurrentSession()
  if (!session?.access_token || (session.expires_at != null && session.expires_at <= Date.now() / 1000)) {
    throw new CampaignAdminRequestError('Sign in again to manage campaigns.', 401)
  }

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${session.access_token}`)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const url = new URL(path, window.location.origin)
  const response = await fetch(url.pathname + url.search, { ...init, headers, redirect: 'error' })
  if (response.ok) return response

  if (response.status === 401) {
    throw new CampaignAdminRequestError('Sign in again to manage campaigns.', 401)
  }
  if (response.status === 403) {
    throw new CampaignAdminRequestError('Admin access is required to manage campaigns.', 403)
  }

  if ([400, 404, 409, 422].includes(response.status)) {
    const body = await response.json().catch(() => null)
    if (typeof body?.error === 'string' && body.error.trim()) {
      throw new CampaignAdminRequestError(body.error.trim().slice(0, 300), response.status)
    }
  }

  throw new CampaignAdminRequestError('Campaign request failed. Try again.', response.status)
}
