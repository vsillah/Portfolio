import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profileSingle: vi.fn(),
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
  remove: vi.fn(),
  createBucket: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
  }),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      expect(table).toBe('user_profiles')
      return {
        select: () => ({
          eq: () => ({
            single: mocks.profileSingle,
          }),
        }),
      }
    },
    storage: {
      from: (bucket: string) => {
        expect(bucket).toBe('prototypes')
        return {
          upload: mocks.upload,
          getPublicUrl: mocks.getPublicUrl,
          remove: mocks.remove,
        }
      },
      createBucket: mocks.createBucket,
    },
  },
}))

import { DELETE, POST } from './route'

function postRequest(fields: Record<string, string | File | null>, token = 'admin-token') {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null) form.append(key, value)
  }
  return {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'authorization' ? (token ? `Bearer ${token}` : null) : null,
    },
    formData: async () => form,
  } as unknown as NextRequest
}

function deleteRequest(path?: string, token = 'admin-token') {
  const url = new URL('http://localhost/api/prototypes/upload')
  if (path !== undefined) url.searchParams.set('path', path)
  return new NextRequest(url, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
}

function oversizedImage() {
  const file = new File(['x'], 'hero.png', { type: 'image/png' })
  Object.defineProperty(file, 'size', { value: 50 * 1024 * 1024 + 1 })
  return file
}

describe('/api/prototypes/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-anon'
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mocks.profileSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    mocks.upload.mockResolvedValue({ data: { path: 'ok' }, error: null })
    mocks.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example/proto.png' } })
    mocks.remove.mockResolvedValue({ error: null })
    mocks.createBucket.mockResolvedValue({ error: null })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789)
    if (typeof File.prototype.arrayBuffer !== 'function') {
      File.prototype.arrayBuffer = async function arrayBuffer() {
        return new Uint8Array([1, 2, 3]).buffer
      }
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('POST', () => {
    it('rejects missing bearer tokens before storage', async () => {
      const response = await POST(postRequest({ file: new File(['x'], 'a.png', { type: 'image/png' }) }, ''))

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Authentication required' })
      expect(mocks.getUser).not.toHaveBeenCalled()
      expect(mocks.upload).not.toHaveBeenCalled()
    })

    it('rejects invalid sessions before storage', async () => {
      mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad token' } })

      const response = await POST(
        postRequest({ file: new File(['x'], 'a.png', { type: 'image/png' }) }),
      )

      expect(response.status).toBe(401)
      expect(mocks.upload).not.toHaveBeenCalled()
    })

    it('rejects non-admin profiles with 403', async () => {
      mocks.profileSingle.mockResolvedValue({ data: { role: 'member' }, error: null })

      const response = await POST(
        postRequest({ file: new File(['x'], 'a.png', { type: 'image/png' }) }),
      )

      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: 'Admin access required' })
      expect(mocks.upload).not.toHaveBeenCalled()
    })

    it('returns 400 when no file is provided', async () => {
      const response = await POST(postRequest({ prototypeId: 'proto-1' }))

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'No file provided' })
      expect(mocks.upload).not.toHaveBeenCalled()
    })

    it('rejects files larger than 50MB', async () => {
      const response = await POST(postRequest({ file: oversizedImage() }))

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'File size exceeds 50MB limit' })
      expect(mocks.upload).not.toHaveBeenCalled()
    })

    it.each([
      ['thumbnail', 'video/mp4', 'Thumbnail must be an image (JPEG, PNG, GIF, WebP, or SVG)'],
      ['demo_video', 'image/png', 'Demo video must be a video file (MP4, WebM, or MOV)'],
      ['demo_image', 'video/mp4', 'Demo image must be an image (JPEG, PNG, GIF, WebP, or SVG)'],
    ] as const)('rejects mismatched MIME for mediaType=%s', async (mediaType, type, error) => {
      const file = new File(['x'], 'clip.bin', { type })
      const response = await POST(postRequest({ file, mediaType, prototypeId: 'proto-1' }))

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error })
      expect(mocks.upload).not.toHaveBeenCalled()
    })

    it.each([
      ['thumbnail', 'image/png', 'hero.PNG', 'prototypes/proto-1/thumbnails/', '.png'],
      ['demo_video', 'video/mp4', 'walkthrough.MP4', 'prototypes/proto-1/demos/', '.mp4'],
      ['demo_image', 'image/webp', 'shot.WEBP', 'prototypes/proto-1/images/', '.webp'],
      ['other', 'image/gif', 'misc.GIF', 'prototypes/proto-1/images/', '.gif'],
    ] as const)('stores mediaType=%s under %s', async (mediaType, type, name, prefix, ext) => {
      const file = new File(['hello'], name, { type })
      const response = await POST(postRequest({ file, mediaType, prototypeId: 'proto-1' }))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.file_path.startsWith(prefix)).toBe(true)
      expect(body.file_path.endsWith(ext)).toBe(true)
      expect(body.public_url).toBe('https://cdn.example/proto.png')
      expect(body.media_type).toBe(mediaType)
      expect(mocks.upload).toHaveBeenCalledWith(
        body.file_path,
        expect.any(Buffer),
        { contentType: type, cacheControl: '3600', upsert: false },
      )
    })

    it('skips MIME checks for unknown mediaType and stores under images/', async () => {
      const file = new File(['pdf'], 'notes.pdf', { type: 'application/pdf' })
      const response = await POST(postRequest({ file, mediaType: 'other', prototypeId: 'proto-1' }))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.file_path.startsWith('prototypes/proto-1/images/')).toBe(true)
      expect(body.media_type).toBe('other')
    })

    it('defaults missing mediaType to thumbnail temp storage', async () => {
      const file = new File(['img'], 'card.png', { type: 'image/png' })
      const response = await POST(postRequest({ file }))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.media_type).toBe('thumbnail')
      expect(body.file_path.startsWith('prototypes/temp/thumbnails/')).toBe(true)
    })

    it('returns a storage error without creating a bucket for unrelated failures', async () => {
      mocks.upload.mockResolvedValue({ data: null, error: { message: 'permission denied' } })
      const file = new File(['x'], 'a.png', { type: 'image/png' })

      const response = await POST(postRequest({ file, prototypeId: 'proto-1' }))

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'permission denied' })
      expect(mocks.createBucket).not.toHaveBeenCalled()
    })

    it('creates the prototypes bucket and retries when upload reports not found', async () => {
      mocks.upload
        .mockResolvedValueOnce({ data: null, error: { message: 'Bucket not found' } })
        .mockResolvedValueOnce({ data: { path: 'ok' }, error: null })
      const file = new File(['img'], 'card.png', { type: 'image/png' })

      const response = await POST(postRequest({ file, prototypeId: 'proto-1' }))

      expect(response.status).toBe(200)
      expect(mocks.createBucket).toHaveBeenCalledWith('prototypes', {
        public: true,
        fileSizeLimit: 50 * 1024 * 1024,
      })
      expect(mocks.upload).toHaveBeenCalledTimes(2)
    })
  })

  describe('DELETE', () => {
    it('rejects missing bearer tokens before storage', async () => {
      const response = await DELETE(deleteRequest('prototypes/proto-1/thumbnails/a.png', ''))

      expect(response.status).toBe(401)
      expect(mocks.remove).not.toHaveBeenCalled()
    })

    it('rejects non-admin profiles with 403', async () => {
      mocks.profileSingle.mockResolvedValue({ data: { role: 'member' }, error: null })

      const response = await DELETE(deleteRequest('prototypes/proto-1/thumbnails/a.png'))

      expect(response.status).toBe(403)
      expect(mocks.remove).not.toHaveBeenCalled()
    })

    it('requires a storage path', async () => {
      const response = await DELETE(deleteRequest())

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'File path is required' })
      expect(mocks.remove).not.toHaveBeenCalled()
    })

    it('removes the requested object from the prototypes bucket', async () => {
      const response = await DELETE(deleteRequest('prototypes/proto-1/thumbnails/a.png'))

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ success: true })
      expect(mocks.remove).toHaveBeenCalledWith(['prototypes/proto-1/thumbnails/a.png'])
    })

    it('returns the storage error message on the 500 path', async () => {
      mocks.remove.mockResolvedValue({ error: { message: 'object locked' } })

      const response = await DELETE(deleteRequest('prototypes/proto-1/thumbnails/a.png'))

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'object locked' })
    })
  })
})
