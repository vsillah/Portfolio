import { NextRequest, NextResponse } from 'next/server'
import { isAuthError, verifyAdmin } from '@/lib/auth-server'
import {
  isVisualAssetCandidateState,
  isVisualAssetEntityType,
  isVisualAssetStatus,
  isVisualAssetTheme,
  type VisualAssetTheme,
} from '@/lib/visual-assets'

export async function requireAdmin(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return { response: NextResponse.json({ error: auth.error }, { status: auth.status }) }
  }
  return { auth }
}

export function parseJsonBody(request: NextRequest) {
  return request.json().catch(() => ({}))
}

export function parseCandidateIds(value: unknown) {
  if (!Array.isArray(value)) return undefined
  return value.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
}

export function parseCandidateQuery(url: string) {
  const searchParams = new URL(url).searchParams
  const status = searchParams.get('status')
  const entityType = searchParams.get('entity_type')
  const theme = searchParams.get('theme')
  const candidateState = searchParams.get('candidate_state')
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? Number(limitParam) : undefined

  return {
    status: status && isVisualAssetStatus(status) ? status : undefined,
    entityType: entityType && isVisualAssetEntityType(entityType) ? entityType : undefined,
    theme: theme && isVisualAssetTheme(theme) ? theme as VisualAssetTheme : undefined,
    candidateState: candidateState && isVisualAssetCandidateState(candidateState) ? candidateState : undefined,
    limit: Number.isFinite(limit) && limit ? Math.min(Math.max(limit, 1), 250) : undefined,
  }
}
