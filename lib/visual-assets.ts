import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import sharp from 'sharp'
import { createAgentWorkItem } from '@/lib/agent-work-items'
import { captureBroll, type RouteConfig } from '@/lib/playtest-broll'
import { supabaseAdmin } from '@/lib/supabase'

export const VISUAL_ASSET_ENTITY_TYPES = ['product', 'service', 'prototype'] as const
export const VISUAL_ASSET_STATUSES = ['proposed', 'approved', 'rejected', 'applied', 'failed'] as const
export const VISUAL_ASSET_THEMES = ['dark', 'light'] as const
export const VISUAL_ASSET_CANDIDATE_STATES = ['captured', 'needs_capture'] as const

export type VisualAssetEntityType = (typeof VISUAL_ASSET_ENTITY_TYPES)[number]
export type VisualAssetStatus = (typeof VISUAL_ASSET_STATUSES)[number]
export type VisualAssetTheme = (typeof VISUAL_ASSET_THEMES)[number]
export type VisualAssetCandidateState = (typeof VISUAL_ASSET_CANDIDATE_STATES)[number]

export type VisualAssetReasonCode =
  | 'missing_image'
  | 'image_load_failure'
  | 'low_resolution'
  | 'wrong_aspect_ratio'
  | 'high_blank_space_ratio'
  | 'light_mode_mismatch'
  | 'dark_mode_mismatch'
  | 'weak_feature_signal'
  | 'stale_generated_capture'
  | 'candidate_below_quality_bar'

export interface VisualAssetEntity {
  entityType: VisualAssetEntityType
  entityId: string
  title: string
  theme: VisualAssetTheme
  currentUrl: string | null
  captureRoute: string
  fullPage?: boolean
  metadata?: Record<string, unknown>
}

export interface VisualAssetCandidate {
  id: string
  entity_type: VisualAssetEntityType
  entity_id: string
  title: string
  theme: VisualAssetTheme
  current_url: string | null
  candidate_url: string | null
  candidate_storage_path: string | null
  capture_route: string
  score: number | null
  reason_codes: VisualAssetReasonCode[]
  status: VisualAssetStatus
  reviewed_by: string | null
  reviewed_at: string | null
  applied_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface VisualAssetScore {
  score: number
  reasonCodes: VisualAssetReasonCode[]
  metadata: {
    width: number
    height: number
    aspectRatio: number
    blankSpaceRatio: number
    lightPixelRatio: number
    darkPixelRatio: number
    edgeDensity: number
  }
}

export interface VisualAssetAgentReview {
  reviewer: 'portfolio-visual-curator'
  reviewer_name: 'Idia (Benin) - Portfolio Visual Curator'
  decision: 'passed' | 'blocked'
  reviewed_at: string
  score: number
  reason_codes: VisualAssetReasonCode[]
  summary: string
  requirements: {
    minimum_score: number
    expected_theme: VisualAssetTheme
    maximum_blank_space_ratio: number
    minimum_edge_density: number
  }
  metrics: VisualAssetScore['metadata']
}

export interface VisualAssetRejectionFeedback {
  reason?: string
  recommendation?: string
  reasonCodes?: VisualAssetReasonCode[]
}

type SupabaseLike = typeof supabaseAdmin

const MIN_WIDTH = 900
const MIN_HEIGHT = 520
const MIN_ASPECT = 1.15
const MAX_ASPECT = 2.4
const MAX_BLANK_SPACE_RATIO = 0.42
const MAX_LIGHT_PIXEL_RATIO = 0.72
const MAX_DARK_PIXEL_RATIO_FOR_LIGHT = 0.58
const MIN_EDGE_DENSITY = 0.035
const MIN_AGENT_REVIEW_SCORE = 70
const STALE_CAPTURE_DAYS = 45

function db(client: SupabaseLike = supabaseAdmin) {
  if (!client) throw new Error('Supabase admin client is not available')
  return client
}

function safeText(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function normalizeId(value: unknown) {
  return String(value ?? '').trim()
}

function asMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function normalizeReasonCodes(value: unknown): VisualAssetReasonCode[] {
  if (!Array.isArray(value)) return []
  return value.filter((reason): reason is VisualAssetReasonCode => (
    typeof reason === 'string' &&
    [
      'missing_image',
      'image_load_failure',
      'low_resolution',
      'wrong_aspect_ratio',
      'high_blank_space_ratio',
      'light_mode_mismatch',
      'dark_mode_mismatch',
      'weak_feature_signal',
      'stale_generated_capture',
      'candidate_below_quality_bar',
    ].includes(reason)
  ))
}

function appendRegenerationParams(route: string, reasonCodes: VisualAssetReasonCode[]) {
  const [pathname, query = ''] = route.split('?')
  const params = new URLSearchParams(query)
  params.set('visualRevision', '1')
  if (reasonCodes.length > 0) {
    params.set('visualFocus', reasonCodes.join(','))
  }
  return `${pathname}?${params.toString()}`
}

export function isVisualAssetEntityType(value: string): value is VisualAssetEntityType {
  return VISUAL_ASSET_ENTITY_TYPES.includes(value as VisualAssetEntityType)
}

export function isVisualAssetStatus(value: string): value is VisualAssetStatus {
  return VISUAL_ASSET_STATUSES.includes(value as VisualAssetStatus)
}

export function isVisualAssetTheme(value: string): value is VisualAssetTheme {
  return VISUAL_ASSET_THEMES.includes(value as VisualAssetTheme)
}

export function isVisualAssetCandidateState(value: string): value is VisualAssetCandidateState {
  return VISUAL_ASSET_CANDIDATE_STATES.includes(value as VisualAssetCandidateState)
}

export function visualAssetStoragePath(input: {
  entityType: VisualAssetEntityType
  entityId: string
  theme: VisualAssetTheme
  candidateId: string
}) {
  if (input.entityType === 'prototype') {
    return `prototypes/${input.entityId}/visual-candidates/${input.theme}/${input.candidateId}.png`
  }
  return `products/visual-candidates/${input.entityType}-${input.entityId}/${input.theme}/${input.candidateId}.png`
}

export function visualAssetStorageBucket(entityType: VisualAssetEntityType) {
  return entityType === 'prototype' ? 'prototypes' : 'products'
}

function getThemeVariant(
  variants: unknown,
  theme: VisualAssetTheme,
): { url: string | null; hasThemeVariant: boolean } {
  const record = asMetadata(variants)
  const themeUrl = safeText(record[theme])
  if (themeUrl) return { url: themeUrl, hasThemeVariant: true }
  return { url: null, hasThemeVariant: false }
}

export function resolveVisualAssetRoute(entity: {
  entityType: VisualAssetEntityType
  entityId: string
  title: string
  type?: string | null
  serviceType?: string | null
}) {
  if (entity.entityType === 'product') {
    return {
      route: `/store/${encodeURIComponent(entity.entityId)}?visualCapture=1`,
      requiresAdminAuth: false,
      fullPage: false,
    }
  }
  if (entity.entityType === 'service') {
    return {
      route: `/services/${encodeURIComponent(entity.entityId)}?visualCapture=1`,
      requiresAdminAuth: false,
      fullPage: false,
    }
  }
  return {
    route: '/prototypes',
    requiresAdminAuth: false,
    fullPage: false,
  }
}

export async function scoreImageBuffer(buffer: Buffer): Promise<VisualAssetScore> {
  const image = sharp(buffer).rotate()
  const metadata = await image.metadata()
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0
  const aspectRatio = height > 0 ? width / height : 0
  const sampleWidth = 96
  const sampleHeight = 64
  const raw = await image
    .resize(sampleWidth, sampleHeight, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer()

  let lightPixels = 0
  let darkPixels = 0
  let extremePixels = 0
  let edgePixels = 0
  const luminance: number[] = []
  for (let i = 0; i < raw.length; i += 3) {
    const l = (0.2126 * raw[i] + 0.7152 * raw[i + 1] + 0.0722 * raw[i + 2]) / 255
    luminance.push(l)
    if (l > 0.82) lightPixels += 1
    if (l < 0.18) darkPixels += 1
    if (l > 0.92 || l < 0.06) extremePixels += 1
  }

  for (let y = 1; y < sampleHeight; y += 1) {
    for (let x = 1; x < sampleWidth; x += 1) {
      const idx = y * sampleWidth + x
      const left = luminance[idx - 1]
      const up = luminance[idx - sampleWidth]
      if (Math.abs(luminance[idx] - left) + Math.abs(luminance[idx] - up) > 0.18) {
        edgePixels += 1
      }
    }
  }

  const pixelCount = sampleWidth * sampleHeight
  const rawExtremeSpaceRatio = extremePixels / pixelCount
  const lightPixelRatio = lightPixels / pixelCount
  const darkPixelRatio = darkPixels / pixelCount
  const edgeDensity = edgePixels / pixelCount
  const blankSpaceRatio = Math.max(0, rawExtremeSpaceRatio - edgeDensity * 3)
  const reasonCodes: VisualAssetReasonCode[] = []

  if (width < MIN_WIDTH || height < MIN_HEIGHT) reasonCodes.push('low_resolution')
  if (aspectRatio < MIN_ASPECT || aspectRatio > MAX_ASPECT) reasonCodes.push('wrong_aspect_ratio')
  if (blankSpaceRatio > MAX_BLANK_SPACE_RATIO) reasonCodes.push('high_blank_space_ratio')
  if (lightPixelRatio > MAX_LIGHT_PIXEL_RATIO) reasonCodes.push('light_mode_mismatch')
  if (edgeDensity < MIN_EDGE_DENSITY) reasonCodes.push('weak_feature_signal')

  const score = Math.max(0, Math.min(100, 100 - reasonCodes.length * 18 - Math.round(blankSpaceRatio * 18)))
  return {
    score,
    reasonCodes,
    metadata: {
      width,
      height,
      aspectRatio,
      blankSpaceRatio,
      lightPixelRatio,
      darkPixelRatio,
      edgeDensity,
    },
  }
}

function emptyScore(reasonCode: VisualAssetReasonCode): VisualAssetScore {
  return {
    score: 0,
    reasonCodes: [reasonCode],
    metadata: {
      width: 0,
      height: 0,
      aspectRatio: 0,
      blankSpaceRatio: 1,
      lightPixelRatio: 0,
      darkPixelRatio: reasonCode === 'missing_image' || reasonCode === 'image_load_failure' ? 0 : 1,
      edgeDensity: 0,
    },
  }
}

export function reviewVisualAssetCandidateQuality(
  candidate: Pick<VisualAssetCandidate, 'theme' | 'title'>,
  score: VisualAssetScore,
  reviewedAt = new Date().toISOString(),
): VisualAssetAgentReview {
  const candidateReasons = score.reasonCodes.filter((reason) => {
    if (candidate.theme === 'light' && reason === 'light_mode_mismatch') return false
    return true
  })
  const reasonCodes = new Set<VisualAssetReasonCode>(candidateReasons)

  if (candidate.theme === 'light' && score.metadata.darkPixelRatio > MAX_DARK_PIXEL_RATIO_FOR_LIGHT) {
    reasonCodes.add('dark_mode_mismatch')
  }
  if (candidate.theme === 'dark' && score.metadata.lightPixelRatio > MAX_LIGHT_PIXEL_RATIO) {
    reasonCodes.add('light_mode_mismatch')
  }
  if (score.score < MIN_AGENT_REVIEW_SCORE) {
    reasonCodes.add('candidate_below_quality_bar')
  }

  const blockingReasons: VisualAssetReasonCode[] = [
    'missing_image',
    'image_load_failure',
    'low_resolution',
    'wrong_aspect_ratio',
    'high_blank_space_ratio',
    'light_mode_mismatch',
    'dark_mode_mismatch',
    'weak_feature_signal',
    'candidate_below_quality_bar',
  ]
  const blockedCodes = Array.from(reasonCodes).filter((reason) => blockingReasons.includes(reason))
  const decision: VisualAssetAgentReview['decision'] = blockedCodes.length > 0 ? 'blocked' : 'passed'

  return {
    reviewer: 'portfolio-visual-curator',
    reviewer_name: 'Idia (Benin) - Portfolio Visual Curator',
    decision,
    reviewed_at: reviewedAt,
    score: score.score,
    reason_codes: Array.from(reasonCodes),
    summary: decision === 'passed'
      ? `Passed automated quality review for ${candidate.theme} human approval.`
      : `Blocked before human review: ${blockedCodes.map((reason) => reason.replace(/_/g, ' ')).join(', ')}.`,
    requirements: {
      minimum_score: MIN_AGENT_REVIEW_SCORE,
      expected_theme: candidate.theme,
      maximum_blank_space_ratio: MAX_BLANK_SPACE_RATIO,
      minimum_edge_density: MIN_EDGE_DENSITY,
    },
    metrics: score.metadata,
  }
}

async function scoreImageUrl(url: string | null): Promise<VisualAssetScore> {
  if (!url || !url.trim()) {
    return emptyScore('missing_image')
  }
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return scoreImageBuffer(Buffer.from(await response.arrayBuffer()))
  } catch {
    return emptyScore('image_load_failure')
  }
}

function staleCaptureReason(url: string | null, updatedAt?: string | null): VisualAssetReasonCode[] {
  if (!url || !url.includes('/visual-candidates/')) return []
  if (!updatedAt) return []
  const ageMs = Date.now() - new Date(updatedAt).getTime()
  return ageMs > STALE_CAPTURE_DAYS * 86400000 ? ['stale_generated_capture'] : []
}

export async function listHomepageVisualAssetEntities(client: SupabaseLike = supabaseAdmin): Promise<VisualAssetEntity[]> {
  const [products, services] = await Promise.all([
    db(client)
      .from('products')
      .select('id, title, type, image_url, image_variants, updated_at')
      .eq('is_active', true)
      .neq('type', 'merchandise')
      .order('display_order', { ascending: true }),
    db(client)
      .from('services')
      .select('id, title, service_type, image_url, image_variants, updated_at')
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
  ])

  if (products.error) throw new Error(`Failed to list products: ${products.error.message}`)
  if (services.error) throw new Error(`Failed to list services: ${services.error.message}`)

  const entities: VisualAssetEntity[] = []
  for (const row of products.data ?? []) {
    const route = resolveVisualAssetRoute({
      entityType: 'product',
      entityId: normalizeId(row.id),
      title: safeText(row.title, 'Product'),
      type: safeText(row.type, 'template'),
    })
    for (const theme of VISUAL_ASSET_THEMES) {
      const variant = getThemeVariant(row.image_variants, theme)
      const fallbackUrl = safeText(row.image_url) || null
      entities.push({
        entityType: 'product',
        entityId: normalizeId(row.id),
        title: safeText(row.title, 'Product'),
        theme,
        currentUrl: variant.url ?? fallbackUrl,
        captureRoute: route.route,
        fullPage: route.fullPage,
        metadata: {
          source_table: 'products',
          source_column: 'image_url',
          variant_column: 'image_variants',
          product_type: safeText(row.type),
          current_image_source: variant.hasThemeVariant ? 'theme_variant' : 'fallback_image_url',
          missing_theme_variant: !variant.hasThemeVariant,
          fallback_url: fallbackUrl,
          stale_reason_codes: staleCaptureReason(variant.url ?? fallbackUrl, safeText(row.updated_at) || null),
        },
      })
    }
  }
  for (const row of services.data ?? []) {
    const route = resolveVisualAssetRoute({
      entityType: 'service',
      entityId: normalizeId(row.id),
      title: safeText(row.title, 'Service'),
      serviceType: safeText(row.service_type),
    })
    for (const theme of VISUAL_ASSET_THEMES) {
      const variant = getThemeVariant(row.image_variants, theme)
      const fallbackUrl = safeText(row.image_url) || null
      entities.push({
        entityType: 'service',
        entityId: normalizeId(row.id),
        title: safeText(row.title, 'Service'),
        theme,
        currentUrl: variant.url ?? fallbackUrl,
        captureRoute: route.route,
        fullPage: route.fullPage,
        metadata: {
          source_table: 'services',
          source_column: 'image_url',
          variant_column: 'image_variants',
          service_type: safeText(row.service_type),
          current_image_source: variant.hasThemeVariant ? 'theme_variant' : 'fallback_image_url',
          missing_theme_variant: !variant.hasThemeVariant,
          fallback_url: fallbackUrl,
          stale_reason_codes: staleCaptureReason(variant.url ?? fallbackUrl, safeText(row.updated_at) || null),
        },
      })
    }
  }
  return entities
}

async function findOpenCandidate(entity: VisualAssetEntity, client: SupabaseLike) {
  const { data, error } = await db(client)
    .from('visual_asset_candidates')
    .select('*')
    .eq('entity_type', entity.entityType)
    .eq('entity_id', entity.entityId)
    .eq('theme', entity.theme)
    .in('status', ['proposed', 'approved'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed to read visual asset candidate: ${error.message}`)
  return data as VisualAssetCandidate | null
}

async function upsertProposedCandidate(input: {
  entity: VisualAssetEntity
  score: VisualAssetScore
  client: SupabaseLike
}) {
  const existing = await findOpenCandidate(input.entity, input.client)
  const now = new Date().toISOString()
  const staleReasonCodes = (input.entity.metadata?.stale_reason_codes ?? []) as VisualAssetReasonCode[]
  const missingThemeVariant = input.entity.metadata?.missing_theme_variant === true
  const reasonCodes = Array.from(new Set([
    ...input.score.reasonCodes,
    ...staleReasonCodes,
    ...(missingThemeVariant ? ['missing_image' as VisualAssetReasonCode] : []),
  ]))
  const payload = {
    entity_type: input.entity.entityType,
    entity_id: input.entity.entityId,
    title: input.entity.title,
    theme: input.entity.theme,
    current_url: input.entity.currentUrl,
    capture_route: input.entity.captureRoute,
    score: input.score.score,
    reason_codes: reasonCodes,
    status: existing?.status ?? 'proposed',
    metadata: {
      ...asMetadata(existing?.metadata),
      ...asMetadata(input.entity.metadata),
      current_image_score: input.score.metadata,
      audit_updated_at: now,
    },
    updated_at: now,
  }

  if (existing) {
    const { data, error } = await db(input.client)
      .from('visual_asset_candidates')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) throw new Error(`Failed to update visual asset candidate: ${error.message}`)
    return data as VisualAssetCandidate
  }

  const { data, error } = await db(input.client)
    .from('visual_asset_candidates')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw new Error(`Failed to create visual asset candidate: ${error.message}`)
  return data as VisualAssetCandidate
}

export async function listVisualAssetCandidates(input: {
  status?: VisualAssetStatus
  entityType?: VisualAssetEntityType
  theme?: VisualAssetTheme
  candidateState?: VisualAssetCandidateState
  limit?: number
  client?: SupabaseLike
} = {}) {
  let query = db(input.client)
    .from('visual_asset_candidates')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 100)

  if (input.status) query = query.eq('status', input.status)
  if (input.entityType) query = query.eq('entity_type', input.entityType)
  if (input.theme) query = query.eq('theme', input.theme)
  if (input.candidateState === 'captured') query = query.not('candidate_url', 'is', null)
  if (input.candidateState === 'needs_capture') query = query.is('candidate_url', null)

  const { data, error } = await query
  if (error) throw new Error(`Failed to list visual asset candidates: ${error.message}`)
  return (data ?? []) as VisualAssetCandidate[]
}

export async function auditVisualAssets(input: {
  createWorkItem?: boolean
  auditDate?: string
  client?: SupabaseLike
} = {}) {
  const client = input.client ?? supabaseAdmin
  const entities = await listHomepageVisualAssetEntities(client)
  const candidates: VisualAssetCandidate[] = []

  for (const entity of entities) {
    const score = await scoreImageUrl(entity.currentUrl)
    const reasonCodes = Array.from(new Set([...score.reasonCodes, ...((entity.metadata?.stale_reason_codes ?? []) as VisualAssetReasonCode[])]))
    if (reasonCodes.length === 0 && score.score >= 76) continue
    candidates.push(await upsertProposedCandidate({
      entity,
      score: { ...score, reasonCodes },
      client,
    }))
  }

  let workItemId: string | null = null
  if (input.createWorkItem) {
    const auditDate = input.auditDate ?? new Date().toISOString().slice(0, 10)
    const workItem = await createAgentWorkItem({
      title: 'Review homepage visual asset candidates',
      objective: 'Review weak homepage product and service visuals, approve useful screenshot candidates, and apply only after human review.',
      priority: candidates.length > 0 ? 'medium' : 'low',
      status: 'proposed',
      ownerAgentKey: 'portfolio-visual-curator',
      ownerRuntime: 'codex',
      source: {
        type: 'homepage_visual_audit',
        id: auditDate,
        label: 'Homepage visual audit',
      },
      expectedFiles: ['visual_asset_candidates'],
    metadata: {
        candidate_count: candidates.length,
        entity_count: entities.length,
        themes: [...VISUAL_ASSET_THEMES],
        approval_boundary: 'Audit and capture can propose candidates only. Public image fields change only through apply-approved.',
        reason_codes: Array.from(new Set(candidates.flatMap((candidate) => candidate.reason_codes))),
      },
      idempotencyKey: `portfolio-visual-curator:weekly-homepage-audit:${auditDate}`,
    })
    workItemId = workItem.id
  }

  return { entitiesScanned: entities.length, candidatesCreated: candidates.length, candidates, workItemId }
}

function toRouteConfig(candidate: VisualAssetCandidate): RouteConfig {
  return {
    route: candidate.capture_route,
    filename: `visual-candidate-${candidate.id}`,
    description: `${candidate.title} ${candidate.theme} visual candidate`,
    fullPage: false,
    colorScheme: candidate.theme,
    viewport: { width: 1440, height: 900 },
    waitForSelector: '[data-visual-capture-frame]',
    screenshotSelector: '[data-visual-capture-frame]',
  }
}

async function uploadCandidateImage(input: {
  candidate: VisualAssetCandidate
  filePath: string
  client: SupabaseLike
}) {
  const buffer = await fs.readFile(input.filePath)
  const storagePath = visualAssetStoragePath({
    entityType: input.candidate.entity_type,
    entityId: input.candidate.entity_id,
    theme: input.candidate.theme,
    candidateId: input.candidate.id,
  })
  const bucket = visualAssetStorageBucket(input.candidate.entity_type)
  const storage = db(input.client).storage.from(bucket)
  const { error } = await storage.upload(storagePath, buffer, {
    contentType: 'image/png',
    cacheControl: '3600',
    upsert: true,
  })
  if (error) throw new Error(`Failed to upload candidate image: ${error.message}`)
  const { data } = storage.getPublicUrl(storagePath)
  const score = await scoreImageBuffer(buffer)
  return { publicUrl: data.publicUrl, storagePath, score }
}

export async function captureVisualAssetCandidates(input: {
  candidateIds?: string[]
  baseUrl?: string
  noStartServer?: boolean
  client?: SupabaseLike
} = {}) {
  const client = input.client ?? supabaseAdmin
  let query = db(client)
    .from('visual_asset_candidates')
    .select('*')
    .order('created_at', { ascending: true })

  if (input.candidateIds?.length) {
    query = query.in('id', input.candidateIds).in('status', ['proposed', 'failed'])
  } else {
    query = query.eq('status', 'proposed').is('candidate_url', null)
  }

  const { data, error } = await query
  if (error) throw new Error(`Failed to list capture candidates: ${error.message}`)
  const candidates = (data ?? []) as VisualAssetCandidate[]
  if (candidates.length === 0) {
    return { captured: 0, passed: 0, blocked: 0, candidates: [] as VisualAssetCandidate[] }
  }

  const outputDir = path.join(os.tmpdir(), 'portfolio-visual-asset-candidates', String(Date.now()))
  const result = await captureBroll({
    routes: candidates.map(toRouteConfig),
    outputDir,
    baseUrl: input.baseUrl ?? process.env.BASE_URL ?? 'http://localhost:3000',
    noStartServer: input.noStartServer,
    authStateOutPath: path.join(outputDir, '.auth-state.json'),
  })

  const updated: VisualAssetCandidate[] = []
  let passed = 0
  let blocked = 0
  for (const candidate of candidates) {
    const screenshotPath = result.screenshots.find((screenshot) => path.basename(screenshot, '.png') === `visual-candidate-${candidate.id}`)
    if (!screenshotPath) {
      const failureScore = emptyScore('image_load_failure')
      const agentReview = reviewVisualAssetCandidateQuality(candidate, failureScore)
      const { data: row, error: updateError } = await db(client)
        .from('visual_asset_candidates')
        .update({
          status: 'failed',
          score: failureScore.score,
          reason_codes: agentReview.reason_codes,
          metadata: {
            ...asMetadata(candidate.metadata),
            audit_reason_codes: candidate.reason_codes,
            agent_review: agentReview,
            capture_error: 'No screenshot was produced for this candidate.',
            captured_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', candidate.id)
        .select('*')
        .single()
      if (updateError) throw new Error(`Failed to mark missing screenshot candidate: ${updateError.message}`)
      blocked += 1
      updated.push(row as VisualAssetCandidate)
      continue
    }
    const upload = await uploadCandidateImage({ candidate, filePath: screenshotPath, client })
    const agentReview = reviewVisualAssetCandidateQuality(candidate, upload.score)
    const status: VisualAssetStatus = agentReview.decision === 'passed' ? 'proposed' : 'failed'
    const { data: row, error: updateError } = await db(client)
      .from('visual_asset_candidates')
      .update({
        status,
        candidate_url: upload.publicUrl,
        candidate_storage_path: upload.storagePath,
        score: upload.score.score,
        reason_codes: agentReview.reason_codes,
        metadata: {
          ...asMetadata(candidate.metadata),
          audit_reason_codes: candidate.reason_codes,
          candidate_image_score: upload.score.metadata,
          agent_review: agentReview,
          captured_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', candidate.id)
      .select('*')
      .single()
    if (updateError) throw new Error(`Failed to update captured candidate: ${updateError.message}`)
    if (status === 'proposed') passed += 1
    else blocked += 1
    updated.push(row as VisualAssetCandidate)
  }

  return { captured: updated.length, passed, blocked, candidates: updated }
}

export async function reviewVisualAssetCandidate(input: {
  id: string
  status: Extract<VisualAssetStatus, 'approved' | 'rejected'>
  reviewedBy: string
  reason?: string
  recommendation?: string
  reasonCodes?: VisualAssetReasonCode[]
  client?: SupabaseLike
}) {
  const existing = await db(input.client)
    .from('visual_asset_candidates')
    .select('metadata')
    .eq('id', input.id)
    .maybeSingle()
  if (existing.error) throw new Error(`Failed to read visual asset candidate: ${existing.error.message}`)

  const { data, error } = await db(input.client)
    .from('visual_asset_candidates')
    .update({
      status: input.status,
      reviewed_by: input.reviewedBy,
      reviewed_at: new Date().toISOString(),
      metadata: {
        ...asMetadata(existing.data?.metadata),
        ...(input.reason ? { review_reason: input.reason } : {}),
        ...(input.recommendation ? { review_recommendation: input.recommendation } : {}),
        ...(input.reasonCodes?.length ? { review_reason_codes: input.reasonCodes } : {}),
        review_feedback: {
          status: input.status,
          reason: input.reason ?? null,
          recommendation: input.recommendation ?? null,
          reason_codes: input.reasonCodes ?? [],
          reviewed_by: input.reviewedBy,
          reviewed_at: new Date().toISOString(),
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
    .in('status', ['proposed', 'approved', 'rejected'])
    .select('*')
    .single()
  if (error) throw new Error(`Failed to ${input.status} visual asset candidate: ${error.message}`)
  return data as VisualAssetCandidate
}

export async function regenerateRejectedVisualAssetCandidate(input: {
  sourceCandidateId: string
  requestedBy: string
  feedback?: VisualAssetRejectionFeedback
  client?: SupabaseLike
}) {
  const client = input.client ?? supabaseAdmin
  const { data: source, error: sourceError } = await db(client)
    .from('visual_asset_candidates')
    .select('*')
    .eq('id', input.sourceCandidateId)
    .maybeSingle()

  if (sourceError) throw new Error(`Failed to read rejected visual asset candidate: ${sourceError.message}`)
  if (!source) throw new Error('Visual asset candidate not found')
  const candidate = source as VisualAssetCandidate
  if (candidate.status !== 'rejected') {
    throw new Error('Only rejected visual asset candidates can be regenerated')
  }

  const existingOpen = await db(client)
    .from('visual_asset_candidates')
    .select('id')
    .eq('entity_type', candidate.entity_type)
    .eq('entity_id', candidate.entity_id)
    .eq('theme', candidate.theme)
    .in('status', ['proposed', 'approved'])
    .limit(1)
    .maybeSingle()
  if (existingOpen.error) throw new Error(`Failed to check open visual asset candidates: ${existingOpen.error.message}`)
  if (existingOpen.data?.id) {
    throw new Error('An open replacement candidate already exists for this asset and theme')
  }

  const metadata = asMetadata(candidate.metadata)
  const storedFeedback = asMetadata(metadata.review_feedback)
  const reason = input.feedback?.reason || safeText(storedFeedback.reason) || safeText(metadata.review_reason) || undefined
  const recommendation = input.feedback?.recommendation || safeText(storedFeedback.recommendation) || safeText(metadata.review_recommendation) || undefined
  const reasonCodes = normalizeReasonCodes(input.feedback?.reasonCodes?.length ? input.feedback.reasonCodes : (storedFeedback.reason_codes ?? metadata.review_reason_codes))
  const requestedAt = new Date().toISOString()
  const captureRoute = appendRegenerationParams(candidate.capture_route, reasonCodes)

  const { data: replacement, error: insertError } = await db(client)
    .from('visual_asset_candidates')
    .insert({
      entity_type: candidate.entity_type,
      entity_id: candidate.entity_id,
      title: candidate.title,
      theme: candidate.theme,
      current_url: candidate.current_url,
      candidate_url: null,
      candidate_storage_path: null,
      capture_route: captureRoute,
      score: null,
      reason_codes: reasonCodes.length > 0 ? reasonCodes : candidate.reason_codes,
      status: 'proposed',
      metadata: {
        source_table: metadata.source_table,
        source_column: metadata.source_column,
        variant_column: metadata.variant_column,
        regenerated_from_candidate_id: candidate.id,
        previous_candidate_url: candidate.candidate_url,
        previous_candidate_storage_path: candidate.candidate_storage_path,
        previous_capture_route: candidate.capture_route,
        regeneration_feedback: {
          source_candidate_id: candidate.id,
          requested_by: input.requestedBy,
          requested_at: requestedAt,
          reason: reason ?? null,
          recommendation: recommendation ?? null,
          reason_codes: reasonCodes,
        },
      },
      created_at: requestedAt,
      updated_at: requestedAt,
    })
    .select('*')
    .single()

  if (insertError) throw new Error(`Failed to create regenerated visual asset candidate: ${insertError.message}`)
  return replacement as VisualAssetCandidate
}

async function applyCandidate(candidate: VisualAssetCandidate, client: SupabaseLike) {
  if (!candidate.candidate_url) throw new Error('Candidate has no candidate_url')
  const variantPatch = { [candidate.theme]: candidate.candidate_url }
  if (candidate.entity_type === 'product') {
    const { data: row, error: readError } = await db(client).from('products').select('image_variants').eq('id', candidate.entity_id).maybeSingle()
    if (readError) throw readError
    const { error } = await db(client)
      .from('products')
      .update({
        image_variants: { ...asMetadata(row?.image_variants), ...variantPatch },
        ...(candidate.theme === 'dark' ? { image_url: candidate.candidate_url } : {}),
      })
      .eq('id', candidate.entity_id)
    if (error) throw error
  } else if (candidate.entity_type === 'service') {
    const { data: row, error: readError } = await db(client).from('services').select('image_variants').eq('id', candidate.entity_id).maybeSingle()
    if (readError) throw readError
    const { error } = await db(client)
      .from('services')
      .update({
        image_variants: { ...asMetadata(row?.image_variants), ...variantPatch },
        ...(candidate.theme === 'dark' ? { image_url: candidate.candidate_url } : {}),
      })
      .eq('id', candidate.entity_id)
    if (error) throw error
  } else {
    const { data: row, error: readError } = await db(client).from('app_prototypes').select('thumbnail_variants').eq('id', candidate.entity_id).maybeSingle()
    if (readError) throw readError
    const { error } = await db(client)
      .from('app_prototypes')
      .update({
        thumbnail_variants: { ...asMetadata(row?.thumbnail_variants), ...variantPatch },
        ...(candidate.theme === 'dark' ? { thumbnail_url: candidate.candidate_url } : {}),
      })
      .eq('id', candidate.entity_id)
    if (error) throw error
  }
}

export async function applyApprovedVisualAssetCandidates(input: {
  candidateIds?: string[]
  client?: SupabaseLike
} = {}) {
  const client = input.client ?? supabaseAdmin
  let query = db(client)
    .from('visual_asset_candidates')
    .select('*')
    .eq('status', 'approved')
    .not('candidate_url', 'is', null)
    .order('reviewed_at', { ascending: true })

  if (input.candidateIds?.length) query = query.in('id', input.candidateIds)
  const { data, error } = await query
  if (error) throw new Error(`Failed to list approved visual asset candidates: ${error.message}`)

  const applied: VisualAssetCandidate[] = []
  const failed: Array<{ id: string; error: string }> = []
  for (const candidate of (data ?? []) as VisualAssetCandidate[]) {
    try {
      await applyCandidate(candidate, client)
      const { data: row, error: markError } = await db(client)
        .from('visual_asset_candidates')
        .update({
          status: 'applied',
          applied_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', candidate.id)
        .select('*')
        .single()
      if (markError) throw markError
      applied.push(row as VisualAssetCandidate)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failed.push({ id: candidate.id, error: message })
      await db(client)
        .from('visual_asset_candidates')
        .update({
          status: 'failed',
          metadata: {
            ...asMetadata(candidate.metadata),
            apply_error: message,
            apply_failed_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', candidate.id)
    }
  }

  return { applied: applied.length, failed: failed.length, appliedCandidates: applied, failures: failed }
}
