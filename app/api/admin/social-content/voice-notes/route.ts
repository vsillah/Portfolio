import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  DEFAULT_CONTENT_FRAMEWORKS,
  normalizeContentPackageOutputs,
} from '@/lib/content-packages'

export const dynamic = 'force-dynamic'

const MAX_AUDIO_BYTES = 50 * 1024 * 1024
const AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg',
  'video/webm',
])

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit')) || 10, 1), 50)

    const [intakesResult, frameworksResult] = await Promise.all([
      supabaseAdmin
        .from('social_idea_intakes')
        .select('id, title, source_type, topic_hint, target_audience, target_outputs, framework_ids, status, audio_file_name, created_at')
        .order('created_at', { ascending: false })
        .limit(limit),
      supabaseAdmin
        .from('content_frameworks')
        .select('id, display_name, creator_name, category, summary, usage_guidance, source_urls, is_active, metadata')
        .eq('is_active', true)
        .order('display_name', { ascending: true }),
    ])

    if (intakesResult.error) {
      console.error('[voice-notes] intake list failed:', intakesResult.error)
      return NextResponse.json({ error: 'Failed to list voice-note intakes' }, { status: 500 })
    }

    const frameworks = frameworksResult.error || !frameworksResult.data?.length
      ? DEFAULT_CONTENT_FRAMEWORKS.map((framework) => ({
          id: framework.id,
          display_name: framework.displayName,
          creator_name: framework.creatorName,
          category: framework.category,
          summary: framework.summary,
          usage_guidance: framework.usageGuidance,
          source_urls: framework.sourceUrls,
          is_active: true,
          metadata: framework.metadata ?? {},
        }))
      : frameworksResult.data

    return NextResponse.json({
      intakes: intakesResult.data ?? [],
      frameworks,
    })
  } catch (error) {
    console.error('[voice-notes] list error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const contentType = request.headers.get('content-type') ?? ''
    const payload = contentType.includes('multipart/form-data')
      ? await parseMultipart(request, auth.user.id)
      : await parseJson(request)

    const transcriptText = String(payload.transcript_text ?? '').trim()
    if (transcriptText.length < 10) {
      return NextResponse.json({ error: 'Transcript or notes must be at least 10 characters.' }, { status: 400 })
    }

    const title = String(payload.title || payload.topic_hint || transcriptText.slice(0, 72)).trim()
    const targetOutputs = normalizeContentPackageOutputs(payload.target_outputs)
    const frameworkIds = normalizeStringArray(payload.framework_ids)

    const { data, error } = await supabaseAdmin
      .from('social_idea_intakes')
      .insert({
        title,
        source_type: payload.audio_storage_path ? 'voice_note' : 'text_note',
        transcript_text: transcriptText,
        audio_storage_path: payload.audio_storage_path ?? null,
        audio_file_name: payload.audio_file_name ?? null,
        topic_hint: payload.topic_hint ?? null,
        target_audience: payload.target_audience ?? null,
        target_outputs: targetOutputs,
        framework_ids: frameworkIds,
        created_by: auth.user.id,
        metadata: {
          intake_surface: 'admin_social_content_voice_notes',
          audio_content_type: payload.audio_content_type ?? null,
        },
      })
      .select('id, title, status, target_outputs, framework_ids, created_at')
      .single()

    if (error || !data?.id) {
      console.error('[voice-notes] create failed:', error)
      return NextResponse.json({ error: 'Failed to create voice-note intake' }, { status: 500 })
    }

    return NextResponse.json({ intake: data })
  } catch (error) {
    console.error('[voice-notes] create error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function parseJson(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  return {
    title: stringOrNull(body.title),
    transcript_text: stringOrNull(body.transcript_text),
    topic_hint: stringOrNull(body.topic_hint),
    target_audience: stringOrNull(body.target_audience),
    target_outputs: normalizeStringArray(body.target_outputs),
    framework_ids: normalizeStringArray(body.framework_ids),
    audio_storage_path: stringOrNull(body.audio_storage_path),
    audio_file_name: stringOrNull(body.audio_file_name),
    audio_content_type: stringOrNull(body.audio_content_type),
  }
}

async function parseMultipart(request: NextRequest, userId: string) {
  const formData = await request.formData()
  const file = formData.get('audio')
  let transcriptText = stringOrNull(formData.get('transcript_text'))
  let audioStoragePath: string | null = null
  let audioFileName: string | null = null
  let audioContentType: string | null = null

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_AUDIO_BYTES) {
      throw new Error('Audio file must be less than 50MB.')
    }
    if (!AUDIO_TYPES.has(file.type)) {
      throw new Error('Unsupported audio type. Use mp3, wav, m4a, webm, or ogg.')
    }

    const extension = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'webm'
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 120)
    const storagePath = `social-voice-notes/${userId}/${Date.now()}-${safeName || `voice-note.${extension}`}`
    const buffer = Buffer.from(await file.arrayBuffer())
    if (!transcriptText) {
      transcriptText = await transcribeAudioBuffer(buffer, file.name, file.type)
    }
    const { data, error } = await supabaseAdmin.storage
      .from('documents')
      .upload(storagePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      })

    if (error || !data?.path) {
      console.error('[voice-notes] audio upload failed:', error)
      throw new Error('Failed to upload voice-note audio.')
    }

    audioStoragePath = data.path
    audioFileName = file.name
    audioContentType = file.type
  }

  return {
    title: stringOrNull(formData.get('title')),
    transcript_text: transcriptText,
    topic_hint: stringOrNull(formData.get('topic_hint')),
    target_audience: stringOrNull(formData.get('target_audience')),
    target_outputs: normalizeStringArray(formData.getAll('target_outputs')),
    framework_ids: normalizeStringArray(formData.getAll('framework_ids')),
    audio_storage_path: audioStoragePath,
    audio_file_name: audioFileName,
    audio_content_type: audioContentType,
  }
}

async function transcribeAudioBuffer(buffer: Buffer, fileName: string, contentType: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required to transcribe audio-only voice notes. Add rough notes or configure transcription.')
  }

  const form = new FormData()
  form.append('model', process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe')
  form.append('response_format', 'json')
  form.append(
    'file',
    new Blob([new Uint8Array(buffer)], { type: contentType || 'audio/webm' }),
    fileName || 'voice-note.webm',
  )

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    console.error('[voice-notes] transcription failed:', text.slice(0, 500))
    throw new Error('Audio transcription failed. Add rough notes and try again.')
  }

  const data = await response.json() as { text?: string }
  const transcript = typeof data.text === 'string' ? data.text.trim() : ''
  if (!transcript) {
    throw new Error('Audio transcription returned no text. Add rough notes and try again.')
  }
  return transcript
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }
  return []
}
