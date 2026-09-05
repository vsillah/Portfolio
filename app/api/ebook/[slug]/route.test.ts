import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

const LANDING_SELECT = 'id, title, slug, description, type, download_count, landing_page_data'
const AUDIOBOOK_SELECT = 'id, slug, title'

const landingMagnet = {
  id: 'lm-1',
  title: 'AI Audit Guide',
  slug: 'ai-audit-guide',
  description: 'Public landing copy',
  type: 'ebook',
  download_count: 12,
  landing_page_data: { hero: 'Start here' },
}

function request(slug = 'ai-audit-guide') {
  return new NextRequest(`http://localhost/api/ebook/${slug}`)
}

function params(slug = 'ai-audit-guide') {
  return { params: { slug } }
}

function magnetQuery(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result)
  const activeEq = vi.fn().mockReturnValue({ single })
  const slugEq = vi.fn().mockReturnValue({ eq: activeEq })
  const select = vi.fn().mockReturnValue({ eq: slugEq })
  return { select, slugEq, activeEq, single }
}

function publicationQuery(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const publishedEq = vi.fn().mockReturnValue({ maybeSingle })
  const magnetEq = vi.fn().mockReturnValue({ eq: publishedEq })
  const select = vi.fn().mockReturnValue({ eq: magnetEq })
  return { select, magnetEq, publishedEq, maybeSingle }
}

function audiobookQuery(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result)
  const activeEq = vi.fn().mockReturnValue({ single })
  const idEq = vi.fn().mockReturnValue({ eq: activeEq })
  const select = vi.fn().mockReturnValue({ eq: idEq })
  return { select, idEq, activeEq, single }
}

describe('GET /api/ebook/[slug]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns 400 when the slug is empty', async () => {
    const response = await GET(request(''), params(''))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid slug' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the landing magnet is missing or inactive', async () => {
    const magnet = magnetQuery({ data: null, error: { code: 'PGRST116', message: 'not found' } })
    mocks.from.mockReturnValue(magnet)

    const response = await GET(request(), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Not found' })
    expect(mocks.from).toHaveBeenCalledWith('lead_magnets')
    expect(magnet.select).toHaveBeenCalledWith(LANDING_SELECT)
    expect(magnet.slugEq).toHaveBeenCalledWith('slug', 'ai-audit-guide')
    expect(magnet.activeEq).toHaveBeenCalledWith('is_active', true)
  })

  it('returns allowlisted landing fields and no linked audiobook', async () => {
    const magnet = magnetQuery({ data: landingMagnet, error: null })
    const publication = publicationQuery({ data: null, error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'lead_magnets') return magnet
      if (table === 'publications') return publication
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await GET(request(), params())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      ...landingMagnet,
      audiobook_lead_magnet: null,
    })
    expect(body).not.toHaveProperty('file_path')
    expect(body).not.toHaveProperty('file_url')
    expect(magnet.select).toHaveBeenCalledWith(LANDING_SELECT)
    expect(publication.magnetEq).toHaveBeenCalledWith('lead_magnet_id', 'lm-1')
    expect(publication.publishedEq).toHaveBeenCalledWith('is_published', true)
  })

  it('includes an active linked audiobook magnet', async () => {
    const magnet = magnetQuery({ data: landingMagnet, error: null })
    const publication = publicationQuery({
      data: { audiobook_lead_magnet_id: 'lm-audio' },
      error: null,
    })
    const audiobook = audiobookQuery({
      data: { id: 'lm-audio', slug: 'audit-audio', title: 'Audit Audiobook' },
      error: null,
    })
    mocks.from
      .mockReturnValueOnce(magnet)
      .mockReturnValueOnce(publication)
      .mockReturnValueOnce(audiobook)

    const response = await GET(request(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ...landingMagnet,
      audiobook_lead_magnet: {
        id: 'lm-audio',
        slug: 'audit-audio',
        title: 'Audit Audiobook',
      },
    })
    expect(audiobook.select).toHaveBeenCalledWith(AUDIOBOOK_SELECT)
    expect(audiobook.idEq).toHaveBeenCalledWith('id', 'lm-audio')
    expect(audiobook.activeEq).toHaveBeenCalledWith('is_active', true)
  })

  it('omits an inactive linked audiobook magnet', async () => {
    const magnet = magnetQuery({ data: landingMagnet, error: null })
    const publication = publicationQuery({
      data: { audiobook_lead_magnet_id: 'lm-audio' },
      error: null,
    })
    const audiobook = audiobookQuery({ data: null, error: { code: 'PGRST116' } })
    mocks.from
      .mockReturnValueOnce(magnet)
      .mockReturnValueOnce(publication)
      .mockReturnValueOnce(audiobook)

    const response = await GET(request(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ...landingMagnet,
      audiobook_lead_magnet: null,
    })
  })

  it('returns a generic 500 when the lookup throws', async () => {
    mocks.from.mockImplementation(() => {
      throw new Error('boom')
    })

    const response = await GET(request(), params())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Internal server error' })
  })
})
