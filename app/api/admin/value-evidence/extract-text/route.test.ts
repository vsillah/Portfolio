import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  pdfParse: vi.fn(),
  extractRawText: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('pdf-parse', () => ({
  default: (buffer: Buffer) => mocks.pdfParse(buffer),
}))

vi.mock('mammoth', () => ({
  default: {
    extractRawText: (input: { buffer: Buffer }) => mocks.extractRawText(input),
  },
}))

import { POST } from './route'

function fakeFile(options: {
  name: string
  type: string
  content?: string | Uint8Array
  size?: number
}) {
  const bytes = typeof options.content === 'string'
    ? new TextEncoder().encode(options.content)
    : options.content ?? new Uint8Array()
  const copy = new Uint8Array(bytes)
  return {
    name: options.name,
    type: options.type,
    size: options.size ?? copy.byteLength,
    arrayBuffer: async () => copy.buffer,
  }
}

function fileRequest(file: ReturnType<typeof fakeFile> | null) {
  const request = new NextRequest('http://localhost/api/admin/value-evidence/extract-text', {
    method: 'POST',
  })
  vi.spyOn(request, 'formData').mockResolvedValue({
    get: (key: string) => (key === 'file' ? file : null),
  } as unknown as FormData)
  return request
}

describe('POST /api/admin/value-evidence/extract-text', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication before reading the upload', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(fileRequest(fakeFile({ name: 'notes.txt', type: 'text/plain', content: 'secret' })))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('rejects a missing file, an oversized file, and an unsupported type', async () => {
    const missing = await POST(fileRequest(null))
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({ error: 'No file provided' })

    const oversized = await POST(fileRequest(fakeFile({
      name: 'big.txt',
      type: 'text/plain',
      content: 'tiny',
      size: 10 * 1024 * 1024 + 1,
    })))
    expect(oversized.status).toBe(400)
    await expect(oversized.json()).resolves.toEqual({ error: 'File size must be less than 10MB' })

    const zip = await POST(fileRequest(fakeFile({ name: 'archive.zip', type: 'application/zip', content: 'PK' })))
    expect(zip.status).toBe(400)
    await expect(zip.json()).resolves.toEqual({
      error: 'Unsupported file type. Supported: PDF, DOCX, plain text, CSV, images.',
    })
    expect(mocks.pdfParse).not.toHaveBeenCalled()
  })

  it('extracts text and csv, counts words, and truncates past 50,000 characters', async () => {
    const text = await POST(fileRequest(fakeFile({
      name: 'notes.txt',
      type: 'text/plain',
      content: 'alpha   beta\n\ngamma',
    })))
    expect(text.status).toBe(200)
    await expect(text.json()).resolves.toEqual({
      text: 'alpha   beta\n\ngamma',
      metadata: {
        filename: 'notes.txt',
        mimeType: 'text/plain',
        wordCount: 3,
      },
    })

    const csv = await POST(fileRequest(fakeFile({ name: 'rows.csv', type: 'text/csv', content: 'a,b\nc,d' })))
    await expect(csv.json()).resolves.toMatchObject({
      text: 'a,b\nc,d',
      metadata: { mimeType: 'text/csv', wordCount: 2 },
    })

    const huge = `${'word '.repeat(20_000)}TAIL`
    const truncated = await POST(fileRequest(fakeFile({ name: 'long.txt', type: 'text/plain', content: huge })))
    const body = await truncated.json()
    expect(body.text.startsWith(huge.slice(0, 50_000))).toBe(true)
    expect(body.text.endsWith('\n\n[… truncated — document exceeded extraction limit]')).toBe(true)
    expect(body.text.length).toBeGreaterThan(50_000)
    expect(body.metadata.wordCount).toBe(body.text.split(/\s+/).filter(Boolean).length)
  })

  it('labels images, including unknown image subtypes, without parsing them', async () => {
    const png = await POST(fileRequest(fakeFile({
      name: 'photo.png',
      type: 'image/png',
      content: new Uint8Array([1, 2, 3]),
    })))
    await expect(png.json()).resolves.toEqual({
      text: '[Image uploaded: photo.png]',
      metadata: {
        filename: 'photo.png',
        mimeType: 'image/png',
        wordCount: 3,
      },
    })

    const svg = await POST(fileRequest(fakeFile({ name: 'icon.svg', type: 'image/svg+xml', content: '<svg/>' })))
    await expect(svg.json()).resolves.toMatchObject({
      text: '[Image uploaded: icon.svg]',
      metadata: { mimeType: 'image/svg+xml' },
    })
    expect(mocks.pdfParse).not.toHaveBeenCalled()
  })

  it('returns pdf page counts and hides parser failures', async () => {
    mocks.pdfParse.mockResolvedValue({ text: 'Page one. Page two.', numpages: 2 })
    const pdf = fakeFile({
      name: 'audit.pdf',
      type: 'application/pdf',
      content: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    })
    const ok = await POST(fileRequest(pdf))
    expect(ok.status).toBe(200)
    await expect(ok.json()).resolves.toMatchObject({
      text: 'Page one. Page two.',
      metadata: { filename: 'audit.pdf', pages: 2, wordCount: 4 },
    })
    expect(mocks.pdfParse).toHaveBeenCalledOnce()

    mocks.extractRawText.mockRejectedValue(new Error('mammoth exploded'))
    const docx = fakeFile({
      name: 'brief.docx',
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      content: 'PK',
    })
    const failed = await POST(fileRequest(docx))
    expect(failed.status).toBe(500)
    await expect(failed.json()).resolves.toEqual({ error: 'Failed to extract text from file' })
  })
})
