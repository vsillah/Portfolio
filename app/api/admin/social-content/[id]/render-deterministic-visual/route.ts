import { NextRequest, NextResponse } from 'next/server'

import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  assertDeterministicVisualRenderRequest,
  bufferSha256,
  buildDeterministicVisualAssetPatch,
  DeterministicVisualRenderError,
  deterministicVisualRenderInputHash,
  deterministicVisualStoragePath,
  DETERMINISTIC_VISUAL_STORAGE_BUCKET,
  projectDeterministicVisualRender,
  readDeterministicVisualSpec,
  type DeterministicVisualRenderProjection,
} from '@/lib/social-deterministic-visual'
import {
  completeDeterministicVisualBindingQaFixture,
  deterministicVisualBindingQaFixture,
  isDeterministicVisualBindingQaFixtureId,
  parseDeterministicVisualQaState,
} from '@/lib/social-deterministic-visual-qa-fixture'
import {
  loadAmaduTownLogoPng,
  renderDeterministicVisualPng,
} from '@/lib/social-deterministic-visual-renderer'
import { hasSocialCopyReleaseEvidence, socialCopyVersion, withSocialCopyRevision } from '@/lib/social-copy-revision'
import { readSocialQueueForWrite, SocialQueueWriteConflict, updateSocialQueueWithVersion } from '@/lib/social-queue-write'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function serverStorageConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

function projectionFor(item: Record<string, unknown>, storageAvailable = serverStorageConfigured()) {
  return projectDeterministicVisualRender({
    item: item as never,
    copyVersion: socialCopyVersion(item),
    storageAvailable,
    releaseLocked: hasSocialCopyReleaseEvidence(item),
  })
}

function itemWithProjection(item: Record<string, unknown>, storageAvailable = serverStorageConfigured()) {
  return {
    ...withSocialCopyRevision(item),
    deterministic_visual_render: projectionFor(item, storageAvailable),
  }
}

function blockedResponse(error: DeterministicVisualRenderError, projection?: DeterministicVisualRenderProjection) {
  return NextResponse.json({
    error: error.message,
    code: error.code,
    recovery_action: error.recoveryAction,
    provider: 'none',
    provider_calls_enabled: false,
    render: projection
      ? { ...projection, state: 'blocked', code: error.code, can_render: false, summary: error.message, recovery_action: error.recoveryAction }
      : undefined,
  }, { status: error.status })
}

function isDuplicateStorageError(error: { message?: string; error?: string; statusCode?: string | number } | null) {
  if (!error) return false
  return Number(error.statusCode) === 409 || /duplicate|already exists|resource exists/i.test(`${error.error ?? ''} ${error.message ?? ''}`)
}

function publicAssetUrl(storagePath: string): string | null {
  const result = supabaseAdmin.storage
    .from(DETERMINISTIC_VISUAL_STORAGE_BUCKET)
    .getPublicUrl(storagePath)
  const value = result.data?.publicUrl
  if (!value) return null
  try {
    const url = new URL(value)
    const expectedOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').origin
    if (url.origin !== expectedOrigin) return null
    if (!url.pathname.startsWith(`/storage/v1/object/public/${DETERMINISTIC_VISUAL_STORAGE_BUCKET}/`)) return null
    return url.href
  } catch {
    return null
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  let body: Record<string, unknown>
  try {
    body = record(await request.json())
  } catch {
    body = {}
  }

  if (isDeterministicVisualBindingQaFixtureId(params.id)) {
    const qaState = parseDeterministicVisualQaState(typeof body.qa_state === 'string' ? body.qa_state : null)
    const fixture = deterministicVisualBindingQaFixture(qaState)
    const projection = fixture.deterministic_visual_render!
    try {
      const action = assertDeterministicVisualRenderRequest({
        projection,
        expectedCopyVersion: body.expected_copy_version,
        expectedCandidateId: body.expected_candidate_id,
        expectedCandidateHash: body.expected_candidate_hash,
      })
      const item = action === 'current' ? fixture : completeDeterministicVisualBindingQaFixture()
      return NextResponse.json({
        success: true,
        fixture: true,
        idempotent: action === 'current',
        provider: 'none',
        provider_calls_enabled: false,
        item,
        render: item.deterministic_visual_render,
        message: action === 'current'
          ? 'The deterministic review asset is already current.'
          : 'Synthetic deterministic review asset rendered. No shared storage, database, or media provider was called.',
      })
    } catch (error) {
      if (error instanceof DeterministicVisualRenderError) return blockedResponse(error, projection)
      throw error
    }
  }

  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let original: Record<string, unknown>
  try {
    original = await readSocialQueueForWrite(supabaseAdmin, params.id)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The current Social Content record could not be prepared for rendering.'
    return blockedResponse(new DeterministicVisualRenderError('release_locked', message, 'Reload the record and reconcile any schedule or publication evidence before rendering.'))
  }

  const projection = projectionFor(original)
  let action: 'render' | 'current'
  try {
    action = assertDeterministicVisualRenderRequest({
      projection,
      expectedCopyVersion: body.expected_copy_version,
      expectedCandidateId: body.expected_candidate_id,
      expectedCandidateHash: body.expected_candidate_hash,
    })
  } catch (error) {
    if (error instanceof DeterministicVisualRenderError) return blockedResponse(error, projection)
    throw error
  }

  if (action === 'current') {
    return NextResponse.json({
      success: true,
      idempotent: true,
      provider: 'none',
      provider_calls_enabled: false,
      item: itemWithProjection(original),
      render: projection,
      message: 'The deterministic review asset is already current. No render, upload, provider call, or record write occurred.',
    })
  }

  const spec = readDeterministicVisualSpec(original.rag_context)
  if (!spec || !projection.candidate_hash || !projection.candidate_id) {
    return blockedResponse(new DeterministicVisualRenderError(
      'candidate_missing',
      'The current deterministic candidate could not be read.',
      'Reload the record after the approved HTML/SVG candidate is restored.',
    ), projection)
  }

  let logoPng: Buffer
  let renderedPng: Buffer
  try {
    logoPng = await loadAmaduTownLogoPng()
    renderedPng = await renderDeterministicVisualPng({ spec, logoPng })
  } catch (error) {
    console.error('Deterministic visual render failed:', error)
    return blockedResponse(new DeterministicVisualRenderError(
      'render_unavailable',
      'The local HTML/SVG renderer could not create the review asset.',
      'Restore the bundled AmaduTown logo and Sharp renderer, then retry. Do not fall back to a media provider.',
      503,
    ), projection)
  }

  const brandAssetHash = bufferSha256(logoPng)
  const renderInputHash = deterministicVisualRenderInputHash({
    copyVersion: projection.copy_version,
    candidateHash: projection.candidate_hash,
    brandAssetHash,
  })
  const storagePath = deterministicVisualStoragePath({
    socialContentId: params.id,
    copyVersion: projection.copy_version,
    candidateId: projection.candidate_id,
    renderInputHash,
  })
  const storage = supabaseAdmin.storage.from(DETERMINISTIC_VISUAL_STORAGE_BUCKET)
  const upload = await storage.upload(storagePath, renderedPng, {
    contentType: 'image/png',
    cacheControl: '31536000',
    upsert: false,
  })
  if (upload.error && !isDuplicateStorageError(upload.error)) {
    console.error('Deterministic visual storage failed:', upload.error)
    return blockedResponse(new DeterministicVisualRenderError(
      'storage_unavailable',
      'Internal Social Content storage did not accept the deterministic review asset.',
      'Restore the social-content bucket or server storage authorization, then retry. No provider fallback is allowed.',
      503,
    ), projection)
  }
  const assetUrl = publicAssetUrl(storagePath)
  if (!assetUrl) {
    return blockedResponse(new DeterministicVisualRenderError(
      'storage_unavailable',
      'Internal Social Content storage did not return a trusted public review URL.',
      'Verify the social-content bucket public-read configuration and server project binding, then retry.',
      503,
    ), projection)
  }

  const renderedAt = new Date().toISOString()
  const patch = buildDeterministicVisualAssetPatch({
    item: original as never,
    copyVersion: projection.copy_version,
    candidateHash: projection.candidate_hash,
    renderInputHash,
    brandAssetHash,
    assetSha256: bufferSha256(renderedPng),
    assetUrl,
    storagePath,
    actor: auth.user.id,
    renderedAt,
  })

  try {
    const result = await updateSocialQueueWithVersion(supabaseAdmin, original, patch)
    const item = itemWithProjection(result.data, true)
    return NextResponse.json({
      success: true,
      idempotent: false,
      provider: 'none',
      provider_calls_enabled: false,
      item,
      render: item.deterministic_visual_render,
      message: 'Deterministic review asset rendered and bound to the current copy and candidate. No media provider was called.',
    })
  } catch (error) {
    if (error instanceof SocialQueueWriteConflict) {
      try {
        const latest = await readSocialQueueForWrite(supabaseAdmin, params.id)
        const latestProjection = projectionFor(latest, true)
        if (
          latestProjection.state === 'current'
          && latestProjection.copy_version === projection.copy_version
          && latestProjection.candidate_id === projection.candidate_id
          && latestProjection.candidate_hash === projection.candidate_hash
        ) {
          return NextResponse.json({
            success: true,
            idempotent: true,
            provider: 'none',
            provider_calls_enabled: false,
            item: itemWithProjection(latest, true),
            render: latestProjection,
            message: 'A concurrent request already bound the same deterministic review asset.',
          })
        }
      } catch {
        // Preserve the original version-conflict result below.
      }
      return blockedResponse(new DeterministicVisualRenderError(
        'write_conflict',
        'The Social Content record changed while the local asset was rendering.',
        'Reload the record and verify the current copy and candidate before retrying.',
      ), projection)
    }
    throw error
  }
}
