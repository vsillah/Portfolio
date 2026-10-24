import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  from: vi.fn(),
  upload: vi.fn(),
  intakes: [] as Array<{ data: unknown; error: unknown }>,
  frameworks: [] as Array<{ data: unknown; error: unknown }>,
  inserts: [] as unknown[],
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (result: { error?: string }) => Boolean(result && 'error' in result),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
    storage: {
      from: vi.fn(() => ({
        upload: mocks.upload,
      })),
    },
  },
}))

import { GET, POST } from './route'
import { DEFAULT_CONTENT_FRAMEWORKS } from '@/lib/content-packages'

function asAdmin() {
  mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
}

function listBuilder(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.limit = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  return chain
}

function installList() {
  mocks.from.mockImplementation((table: string) => {
    if (table === 'social_idea_intakes') return listBuilder(mocks.intakes.shift() ?? { data: [], error: null })
    if (table === 'content_frameworks') return listBuilder(mocks.frameworks.shift() ?? { data: [], error: null })
    throw new Error(`unexpected table ${table}`)
  })
}

describe('GET /api/admin/social-content/voice-notes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.intakes = []
    mocks.frameworks = []
    asAdmin()
    installList()
  })

  it('rejects non-admins before listing intakes', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await GET(new NextRequest('http://localhost/api/admin/social-content/voice-notes'))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('clamps the limit and falls back to default frameworks when the table is empty', async () => {
    mocks.intakes.push({ data: [{ id: 'intake-1' }], error: null })
    mocks.frameworks.push({ data: [], error: null })

    const response = await GET(new NextRequest('http://localhost/api/admin/social-content/voice-notes?limit=80'))
    const body = await response.json()

    expect(body.intakes).toEqual([{ id: 'intake-1' }])
    expect(body.frameworks.map((framework: { id: string }) => framework.id)).toEqual(
      DEFAULT_CONTENT_FRAMEWORKS.map((framework) => framework.id),
    )
    expect(body.frameworks[0]).toMatchObject({
      display_name: DEFAULT_CONTENT_FRAMEWORKS[0].displayName,
      is_active: true,
    })
    const intakes = mocks.from.mock.results.find((result) => result.value)?.value
    expect(intakes.limit).toHaveBeenCalledWith(50)
  })

  it('uses stored frameworks when the query succeeds', async () => {
    const stored = [{ id: 'custom', display_name: 'Custom', is_active: true }]
    mocks.intakes.push({ data: null, error: null })
    mocks.frameworks.push({ data: stored, error: null })

    const response = await GET(new NextRequest('http://localhost/api/admin/social-content/voice-notes?limit=0'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ intakes: [], frameworks: stored })
  })

  it('returns a generic list error and the raw thrown message', async () => {
    mocks.intakes.push({ data: null, error: { message: 'relation missing' } })
    const failed = await GET(new NextRequest('http://localhost/api/admin/social-content/voice-notes'))
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({ error: 'Failed to list voice-note intakes' })

    mocks.from.mockImplementation(() => {
      throw 'list exploded'
    })
    const thrown = await GET(new NextRequest('http://localhost/api/admin/social-content/voice-notes'))
    expect(thrown.status).toBe(500)
    expect(await thrown.json()).toEqual({ error: 'list exploded' })
  })
})

describe('POST /api/admin/social-content/voice-notes', () => {
  const originalKey = process.env.OPENAI_API_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.inserts = []
    asAdmin()
    delete process.env.OPENAI_API_KEY
    mocks.upload.mockResolvedValue({ data: { path: 'stored/voice.mp3' }, error: null })
    mocks.from.mockImplementation((table: string) => ({
      insert: vi.fn((payload: unknown) => {
        mocks.inserts.push({ table, payload })
        return {
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { id: 'intake-1', title: (payload as { title: string }).title, status: 'new' },
              error: null,
            }),
          })),
        }
      }),
    }))
  })

  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = originalKey
  })

  function jsonRequest(body: unknown) {
    return new NextRequest('http://localhost/api/admin/social-content/voice-notes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('rejects a transcript shorter than 10 characters', async () => {
    const response = await POST(jsonRequest({ transcript_text: '   short   ' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Transcript or notes must be at least 10 characters.' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('stores a text note, default outputs, and a title taken from the topic', async () => {
    const response = await POST(jsonRequest({
      transcript_text: '  Operators need a governed intake.  ',
      topic_hint: '  Voice intake  ',
      target_outputs: ['not-a-type'],
      framework_ids: ' alpha , beta ',
      audio_storage_path: '  notes/audio.webm  ',
    }))

    expect(response.status).toBe(200)
    expect(mocks.inserts).toEqual([
      {
        table: 'social_idea_intakes',
        payload: expect.objectContaining({
          title: 'Voice intake',
          source_type: 'voice_note',
          transcript_text: 'Operators need a governed intake.',
          audio_storage_path: 'notes/audio.webm',
          target_outputs: [
            'linkedin_post',
            'linkedin_carousel',
            'pptx_deck',
            'video_script',
            'heygen_video',
            'elevenlabs_audio',
          ],
          framework_ids: ['alpha', 'beta'],
          created_by: 'admin-1',
          metadata: {
            intake_surface: 'admin_social_content_voice_notes',
            audio_content_type: null,
          },
        }),
      },
    ])
  })

  it('uses the transcript prefix when no title or topic is present', async () => {
    const transcript = 'abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz0123456789EXTRA'
    await POST(jsonRequest({ transcript_text: transcript }))

    expect(mocks.inserts[0]).toEqual({
      table: 'social_idea_intakes',
      payload: expect.objectContaining({
        title: transcript.slice(0, 72),
        source_type: 'text_note',
      }),
    })
  })

  it('returns a generic create error', async () => {
    mocks.from.mockImplementation(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'insert failed' } }),
        })),
      })),
    }))

    const response = await POST(jsonRequest({ transcript_text: 'Operators need a governed intake.' }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to create voice-note intake' })
  })

  it('rejects an oversized or unsupported audio file with the thrown message', async () => {
    const huge = new File([new Uint8Array([1])], 'big.mp3', { type: 'audio/mpeg' })
    Object.defineProperty(huge, 'size', { value: 50 * 1024 * 1024 + 1 })
    const oversized = await postAudio(huge, 'Operators need a governed intake.')
    expect(oversized.status).toBe(500)
    expect(await oversized.json()).toEqual({ error: 'Audio file must be less than 50MB.' })

    const odd = new File([new Uint8Array([1])], 'note.flac', { type: 'audio/flac' })
    const unsupported = await postAudio(odd, 'Operators need a governed intake.')
    expect(unsupported.status).toBe(500)
    expect(await unsupported.json()).toEqual({
      error: 'Unsupported audio type. Use mp3, wav, m4a, webm, or ogg.',
    })
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('requires a transcription key for audio-only notes and uploads a provided transcript', async () => {
    const audio = new File([new Uint8Array([1, 2, 3])], 'voice note!.mp3', { type: 'audio/mpeg' })
    const missingKey = await postAudio(audio, '')
    expect(missingKey.status).toBe(500)
    expect(await missingKey.json()).toEqual({
      error: 'OPENAI_API_KEY is required to transcribe audio-only voice notes. Add rough notes or configure transcription.',
    })

    mocks.upload.mockResolvedValue({ data: null, error: { message: 'bucket missing' } })
    const uploadFailed = await postAudio(audio, 'Operators need a governed intake.')
    expect(uploadFailed.status).toBe(500)
    expect(await uploadFailed.json()).toEqual({ error: 'Failed to upload voice-note audio.' })

    mocks.upload.mockResolvedValue({ data: { path: 'stored/voice.mp3' }, error: null })
    const saved = await postAudio(audio, 'Operators need a governed intake.')
    expect(saved.status).toBe(200)
    const payload = (mocks.inserts.at(-1) as { payload: { audio_storage_path: string; audio_file_name: string } }).payload
    expect(payload.audio_storage_path).toBe('stored/voice.mp3')
    expect(payload.audio_file_name).toBe('voice note!.mp3')
    expect(mocks.upload).toHaveBeenLastCalledWith(
      expect.stringMatching(/^social-voice-notes\/admin-1\/\d+-voice_note_\.mp3$/),
      expect.any(Buffer),
      { contentType: 'audio/mpeg', cacheControl: '3600', upsert: false },
    )
  })
})

function postAudio(file: File, transcript: string) {
  if (typeof file.arrayBuffer !== 'function') {
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => Uint8Array.from([1, 2, 3]).buffer,
    })
  }
  const form = {
    get(name: string) {
      if (name === 'audio') return file
      if (name === 'transcript_text') return transcript
      return null
    },
    getAll() {
      return []
    },
  }
  const request = new NextRequest('http://localhost/api/admin/social-content/voice-notes', {
    method: 'POST',
    headers: { 'content-type': 'multipart/form-data; boundary=test' },
  })
  vi.spyOn(request, 'formData').mockResolvedValue(form as unknown as FormData)
  return POST(request)
}
