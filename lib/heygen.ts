/**
 * HeyGen API integration for avatar video generation.
 * Uses REST API (x-api-key auth). MCP is Cursor-side only.
 */

import { channelToAspectRatio, type VideoAspectRatio, type VideoChannel } from './constants/video-channel'

const HEYGEN_API_BASE = 'https://api.heygen.com'

export interface CreateAvatarVideoParams {
  avatarId: string
  script: string
  voiceId: string
  title?: string
  aspectRatio?: VideoAspectRatio
  channel?: VideoChannel
  callbackId?: string
  /** Include captions in the video (if supported by HeyGen avatar API). */
  caption?: boolean
  /** Include GIF preview URL in webhook/callback response. */
  includeGif?: boolean
  /** HeyGen folder ID for organization. */
  folderId?: string
}

export interface CreateAvatarVideoResult {
  videoId: string | null
  taskId?: string | null
  error: string | null
}

export interface VideoStatusResult {
  videoId: string | null
  status: string | null
  videoUrl: string | null
  videoShareUrl: string | null
  thumbnailUrl: string | null
  duration?: number | null
  error: string | null
  errorDetails?: unknown
}

export interface AvatarOption {
  id: string
  name: string
  type: 'avatar'
}

export interface ListAvatarsResult {
  avatars: AvatarOption[]
  error: string | null
}

/**
 * List available avatars from HeyGen API (v2).
 * Returns only standard avatars (not talking photos) for use with createAvatarVideo.
 */
export async function listAvatars(): Promise<ListAvatarsResult> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) {
    return { avatars: [], error: 'HEYGEN_API_KEY is not configured' }
  }

  const res = await fetch(`${HEYGEN_API_BASE}/v2/avatars`, {
    method: 'GET',
    headers: { 'x-api-key': apiKey },
  })

  let json: {
    error?: string | { code?: string; message?: string } | null
    data?: { avatars?: Array<{ avatar_id?: string; avatar_name?: string }> }
  } = {}
  try {
    json = (await res.json()) as typeof json
  } catch {
    return { avatars: [], error: `HeyGen API returned invalid JSON (HTTP ${res.status})` }
  }

  const extractError = (): string => {
    const e = json.error
    if (typeof e === 'string') return e
    if (e && typeof e === 'object' && e.message) return e.message
    return `HTTP ${res.status}`
  }

  if (!res.ok) {
    const errMsg = extractError()
    console.error('[HeyGen] List avatars failed:', res.status, errMsg)
    return { avatars: [], error: errMsg }
  }
  if (json.error) {
    const errMsg = extractError()
    console.error('[HeyGen] List avatars API error:', errMsg)
    return { avatars: [], error: errMsg }
  }

  const avatars = (json.data?.avatars ?? []).map(a => ({
    id: a.avatar_id ?? '',
    name: a.avatar_name ?? a.avatar_id ?? 'Unknown',
    type: 'avatar' as const,
  })).filter(a => a.id)

  return { avatars, error: null }
}

export interface VoiceOption {
  id: string
  name: string
  language: string
  gender: string
}

export interface ListVoicesResult {
  voices: VoiceOption[]
  error: string | null
}

/**
 * List available voices from HeyGen API (v2).
 */
export async function listVoices(): Promise<ListVoicesResult> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) {
    return { voices: [], error: 'HEYGEN_API_KEY is not configured' }
  }

  const res = await fetch(`${HEYGEN_API_BASE}/v2/voices`, {
    method: 'GET',
    headers: { 'x-api-key': apiKey },
  })

  let json: {
    error?: string | { code?: string; message?: string } | null
    data?: { voices?: Array<{ voice_id?: string; name?: string; language?: string; gender?: string }> }
  } = {}
  try {
    json = (await res.json()) as typeof json
  } catch {
    return { voices: [], error: `HeyGen API returned invalid JSON (HTTP ${res.status})` }
  }

  const extractError = (): string => {
    const e = json.error
    if (typeof e === 'string') return e
    if (e && typeof e === 'object' && e.message) return e.message
    return `HTTP ${res.status}`
  }

  if (!res.ok) {
    return { voices: [], error: extractError() }
  }
  if (json.error) {
    return { voices: [], error: extractError() }
  }

  const voices = (json.data?.voices ?? []).map(v => ({
    id: v.voice_id ?? '',
    name: v.name ?? v.voice_id ?? 'Unknown',
    language: v.language ?? '',
    gender: v.gender ?? '',
  })).filter(v => v.id)

  return { voices, error: null }
}

/**
 * Resolve the display name for a HeyGen asset by ID.
 * Fetches the full avatar or voice list and finds the matching entry.
 */
export async function resolveAssetName(
  assetType: 'avatar' | 'voice',
  assetId: string
): Promise<{ name: string | null; error: string | null }> {
  if (assetType === 'avatar') {
    const { avatars, error } = await listAvatars()
    if (error) return { name: null, error }
    const match = avatars.find(a => a.id === assetId)
    return { name: match?.name ?? null, error: match ? null : `Avatar "${assetId}" not found in HeyGen account` }
  }
  const { voices, error } = await listVoices()
  if (error) return { name: null, error }
  const match = voices.find(v => v.id === assetId)
  return { name: match?.name ?? null, error: match ? null : `Voice "${assetId}" not found in HeyGen account` }
}

/** Map aspect ratio to HeyGen dimension (width x height) */
function aspectRatioToDimension(ratio: VideoAspectRatio): { width: number; height: number } {
  return ratio === '9:16' ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 }
}

/**
 * Create an avatar video via HeyGen API.
 * Returns video_id for status polling.
 */
export async function createAvatarVideo(params: CreateAvatarVideoParams): Promise<CreateAvatarVideoResult> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) {
    return { videoId: null, error: 'HEYGEN_API_KEY is not configured' }
  }

  const aspectRatio = params.aspectRatio ?? (params.channel ? channelToAspectRatio(params.channel) : '16:9')
  const dimension = aspectRatioToDimension(aspectRatio)

  const body = {
    title: params.title ?? '',
    callback_id: params.callbackId ?? undefined,
    dimension: {
      width: dimension.width,
      height: dimension.height,
    },
    video_inputs: [
      {
        character: {
          type: 'avatar',
          avatar_id: params.avatarId,
        },
        voice: {
          type: 'text',
          voice_id: params.voiceId,
          input_text: params.script,
        },
      },
    ],
  }

  const res = await fetch(`${HEYGEN_API_BASE}/v2/video/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(body),
  })

  const HEYGEN_SCRIPT_MAX_LENGTH = 5000

  if (params.script.length > HEYGEN_SCRIPT_MAX_LENGTH) {
    return {
      videoId: null,
      error: `Script exceeds HeyGen limit of ${HEYGEN_SCRIPT_MAX_LENGTH} characters (${params.script.length} provided). Shorten the script or split into multiple videos.`,
    }
  }

  let json: {
    error?: string | { code?: string; message?: string } | null
    data?: { video_id?: string }
    message?: string
  } = {}
  try {
    json = (await res.json()) as typeof json
  } catch {
    return { videoId: null, error: `HeyGen API returned invalid JSON (HTTP ${res.status})` }
  }

  const extractError = (): string => {
    const e = json.error
    if (typeof e === 'string') return e
    if (e && typeof e === 'object' && e.message) return e.message
    return json.message ?? `HTTP ${res.status}`
  }

  if (!res.ok) {
    const errMsg = extractError()
    console.error('[HeyGen] Generate failed:', res.status, errMsg, JSON.stringify(json))
    return { videoId: null, error: errMsg }
  }
  if (json.error) {
    const errMsg = extractError()
    console.error('[HeyGen] API error in response:', errMsg)
    return { videoId: null, error: errMsg }
  }
  const videoId = json.data?.video_id ?? null
  return { videoId, error: null }
}

// --- Template API (Brand System + Brand Glossary) ---

export interface GenerateFromTemplateParams {
  templateId: string
  script: string
  title?: string
  aspectRatio?: VideoAspectRatio
  channel?: VideoChannel
  brandVoiceId?: string
  /** Template variable name for script content (default: "script") */
  scriptVariableName?: string
  /** Enable captions in the generated video. */
  caption?: boolean
  /** Include GIF preview URL in webhook/callback response. */
  includeGif?: boolean
  /** HeyGen folder ID for organization. */
  folderId?: string
  /** Per-request callback URL when video is ready (in addition to global webhook). */
  callbackUrl?: string
  /** Make video publicly shareable immediately after creation. */
  enableSharing?: boolean
}

export interface TemplateOption {
  templateId: string
  name: string
  aspectRatio: 'landscape' | 'portrait'
}

export interface ListTemplatesResult {
  templates: TemplateOption[]
  error: string | null
}

export interface BrandVoiceOption {
  id: string
  name: string
}

export interface ListBrandVoicesResult {
  brandVoices: BrandVoiceOption[]
  error: string | null
}

/**
 * List templates from HeyGen API (v2).
 * Used to discover template IDs for generateFromTemplate.
 */
export async function listTemplates(): Promise<ListTemplatesResult> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) {
    return { templates: [], error: 'HEYGEN_API_KEY is not configured' }
  }

  const res = await fetch(`${HEYGEN_API_BASE}/v2/templates`, {
    method: 'GET',
    headers: { 'x-api-key': apiKey },
  })

  let json: {
    error?: string | { code?: string; message?: string } | null
    data?: { templates?: Array<{ template_id?: string; name?: string; aspect_ratio?: string }> }
  } = {}
  try {
    json = (await res.json()) as typeof json
  } catch {
    return { templates: [], error: `HeyGen API returned invalid JSON (HTTP ${res.status})` }
  }

  const extractError = (): string => {
    const e = json.error
    if (typeof e === 'string') return e
    if (e && typeof e === 'object' && e.message) return e.message
    return `HTTP ${res.status}`
  }

  if (!res.ok || json.error) {
    return { templates: [], error: extractError() }
  }

  const templates = (json.data?.templates ?? []).map(t => ({
    templateId: t.template_id ?? '',
    name: t.name ?? t.template_id ?? 'Unknown',
    aspectRatio: (t.aspect_ratio === 'portrait' ? 'portrait' : 'landscape') as 'landscape' | 'portrait',
  })).filter(t => t.templateId)

  return { templates, error: null }
}

/**
 * List brand voices (Brand Glossary) from HeyGen API (v1).
 * Used for pronunciation, terminology, and tone in Template API.
 */
export async function listBrandVoices(): Promise<ListBrandVoicesResult> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) {
    return { brandVoices: [], error: 'HEYGEN_API_KEY is not configured' }
  }

  const res = await fetch(`${HEYGEN_API_BASE}/v1/brand_voice/list`, {
    method: 'GET',
    headers: { 'x-api-key': apiKey },
  })

  let json: {
    error?: string | null
    data?: { list?: Array<{ id?: string; name?: string }> }
  } = {}
  try {
    json = (await res.json()) as typeof json
  } catch {
    return { brandVoices: [], error: `HeyGen API returned invalid JSON (HTTP ${res.status})` }
  }

  if (!res.ok || json.error) {
    return {
      brandVoices: [],
      error: typeof json.error === 'string' ? json.error : `HTTP ${res.status}`,
    }
  }

  const brandVoices = (json.data?.list ?? []).map(b => ({
    id: b.id ?? '',
    name: b.name ?? b.id ?? 'Unknown',
  })).filter(b => b.id)

  return { brandVoices, error: null }
}

/**
 * Generate video from a HeyGen template with Brand Glossary support.
 * Use when you have an AmaduTown template with Brand System + {{script}} placeholder.
 * brand_voice_id applies pronunciation, terminology, and tone from Brand Glossary.
 */
export async function generateFromTemplate(
  params: GenerateFromTemplateParams
): Promise<CreateAvatarVideoResult> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) {
    return { videoId: null, error: 'HEYGEN_API_KEY is not configured' }
  }

  const aspectRatio = params.aspectRatio ?? (params.channel ? channelToAspectRatio(params.channel) : '16:9')
  const dimension = aspectRatioToDimension(aspectRatio)
  const varName = params.scriptVariableName ?? 'script'

  // HeyGen variables format: { "varName": { "name": "varName", "type": "text", "properties": { "content": "..." } } }
  const variables: Record<string, { name: string; type: string; properties: { content: string } }> = {
    [varName]: {
      name: varName,
      type: 'text',
      properties: { content: params.script },
    },
  }

  const HEYGEN_SCRIPT_MAX_LENGTH = 5000
  if (params.script.length > HEYGEN_SCRIPT_MAX_LENGTH) {
    return {
      videoId: null,
      error: `Script exceeds HeyGen limit of ${HEYGEN_SCRIPT_MAX_LENGTH} characters (${params.script.length} provided). Shorten the script or split into multiple videos.`,
    }
  }

  const body: Record<string, unknown> = {
    variables: JSON.stringify(variables),
    title: params.title ?? '',
    dimension: { width: dimension.width, height: dimension.height },
  }
  if (params.brandVoiceId) {
    body.brand_voice_id = params.brandVoiceId
  }
  if (params.caption === true) {
    body.caption = true
  }
  if (params.includeGif === true) {
    body.include_gif = true
  }
  if (params.folderId) {
    body.folder_id = params.folderId
  }
  if (params.callbackUrl) {
    body.callback_url = params.callbackUrl
  }
  if (params.enableSharing === true) {
    body.enable_sharing = true
  }

  const res = await fetch(
    `${HEYGEN_API_BASE}/v2/template/${encodeURIComponent(params.templateId)}/generate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(body),
    }
  )

  let json: {
    error?: string | { code?: string; message?: string } | null
    data?: { video_id?: string }
    message?: string
  } = {}
  try {
    json = (await res.json()) as typeof json
  } catch {
    return { videoId: null, error: `HeyGen API returned invalid JSON (HTTP ${res.status})` }
  }

  const extractError = (): string => {
    const e = json.error
    if (typeof e === 'string') return e
    if (e && typeof e === 'object' && e.message) return e.message
    return json.message ?? `HTTP ${res.status}`
  }

  if (!res.ok) {
    const errMsg = extractError()
    console.error('[HeyGen] Template generate failed:', res.status, errMsg, JSON.stringify(json))
    return { videoId: null, error: errMsg }
  }
  if (json.error) {
    const errMsg = extractError()
    console.error('[HeyGen] Template API error:', errMsg)
    return { videoId: null, error: errMsg }
  }

  const videoId = json.data?.video_id ?? null
  return { videoId, error: null }
}

export interface CreateVideoParams {
  script: string
  title?: string
  aspectRatio?: VideoAspectRatio
  channel?: VideoChannel
  /** For avatar mode */
  avatarId?: string
  voiceId?: string
  /** For template mode (overrides avatar when both templateId and avatarId are set) */
  templateId?: string
  brandVoiceId?: string
  scriptVariableName?: string
  /** Enable captions (template only for now). */
  caption?: boolean
  /** Include GIF preview in webhook/callback (template only for now). */
  includeGif?: boolean
  /** HeyGen folder ID. */
  folderId?: string
  /** Per-request callback URL (template only). */
  callbackUrl?: string
  /** Make video shareable immediately (template only). */
  enableSharing?: boolean
  /** Passed to HeyGen for job correlation (avatar or template). */
  callbackId?: string
}

/**
 * Unified entry point: uses Template API when HEYGEN_TEMPLATE_ID (or templateId param) is set,
 * otherwise uses createAvatarVideo. Brand Glossary applied when using template + HEYGEN_BRAND_VOICE_ID.
 */
export async function createVideo(params: CreateVideoParams): Promise<CreateAvatarVideoResult> {
  const templateId =
    params.templateId ?? process.env.HEYGEN_TEMPLATE_ID
  const brandVoiceId =
    params.brandVoiceId ?? process.env.HEYGEN_BRAND_VOICE_ID

  if (templateId) {
    return generateFromTemplate({
      templateId,
      script: params.script,
      title: params.title,
      aspectRatio: params.aspectRatio,
      channel: params.channel,
      brandVoiceId: brandVoiceId || undefined,
      scriptVariableName: params.scriptVariableName,
      caption: params.caption,
      includeGif: params.includeGif,
      folderId: params.folderId,
      callbackUrl: params.callbackUrl,
      enableSharing: params.enableSharing,
    })
  }

  let avatarId = params.avatarId ?? process.env.HEYGEN_AVATAR_ID
  let voiceId = params.voiceId ?? process.env.HEYGEN_VOICE_ID

  if (!avatarId || !voiceId) {
    try {
      const { getHeyGenDefaults } = await import('./heygen-config')
      const defaults = await getHeyGenDefaults()
      if (!avatarId && defaults.avatarId) avatarId = defaults.avatarId
      if (!voiceId && defaults.voiceId) voiceId = defaults.voiceId
    } catch { /* DB not available; rely on env vars */ }
  }

  if (!avatarId || !voiceId) {
    return {
      videoId: null,
      error: 'avatarId and voiceId are required when not using template. Set defaults via Admin → Video Generation → Settings, or set HEYGEN_AVATAR_ID / HEYGEN_VOICE_ID env vars.',
    }
  }

  return createAvatarVideo({
    avatarId,
    voiceId,
    script: params.script,
    title: params.title,
    aspectRatio: params.aspectRatio,
    channel: params.channel,
    callbackId: params.callbackId,
    caption: params.caption,
    includeGif: params.includeGif,
    folderId: params.folderId,
  })
}

/**
 * Get video status from HeyGen API.
 * Status: pending | waiting | processing | completed | failed
 */
export async function getVideoStatus(videoId: string): Promise<VideoStatusResult> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) {
    return { videoId, status: null, videoUrl: null, videoShareUrl: null, thumbnailUrl: null, error: 'HEYGEN_API_KEY is not configured' }
  }

  const res = await fetch(`${HEYGEN_API_BASE}/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`, {
    method: 'GET',
    headers: { 'x-api-key': apiKey },
  })

  const json = (await res.json()) as {
    error?: string | null
    data?: {
      video_id?: string
      status?: string
      video_url?: string
      video_url_caption?: string
      thumbnail_url?: string
      duration?: number
      error_details?: unknown
    }
  }

  if (!res.ok) {
    return {
      videoId,
      status: null,
      videoUrl: null,
      videoShareUrl: null,
      thumbnailUrl: null,
      error: json.error ?? `HTTP ${res.status}`,
    }
  }
  if (json.error) {
    return {
      videoId,
      status: null,
      videoUrl: null,
      videoShareUrl: null,
      thumbnailUrl: null,
      error: json.error,
      errorDetails: json.data?.error_details,
    }
  }

  const data = json.data
  return {
    videoId: data?.video_id ?? videoId,
    status: data?.status ?? null,
    videoUrl: data?.video_url ?? null,
    videoShareUrl: null,
    thumbnailUrl: data?.thumbnail_url ?? null,
    duration: data?.duration ?? null,
    error: null,
    errorDetails: data?.error_details,
  }
}
