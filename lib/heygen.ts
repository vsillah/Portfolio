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

/**
 * Get video status from HeyGen API.
 * Status: pending | waiting | processing | completed | failed
 */
export async function getVideoStatus(videoId: string): Promise<VideoStatusResult> {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) {
    return { videoId, status: null, videoUrl: null, thumbnailUrl: null, error: 'HEYGEN_API_KEY is not configured' }
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
      thumbnailUrl: null,
      error: json.error ?? `HTTP ${res.status}`,
    }
  }
  if (json.error) {
    return {
      videoId,
      status: null,
      videoUrl: null,
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
    thumbnailUrl: data?.thumbnail_url ?? null,
    duration: data?.duration ?? null,
    error: null,
    errorDetails: data?.error_details,
  }
}
