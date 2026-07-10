import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PacketPreviewWorkspace from './PacketPreviewWorkspace'

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}))

describe('PacketPreviewWorkspace', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('previews a prototype packet without exposing a create-work-item control', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      mode: 'read_only',
      markdown: '# Speech Practice Coach Prototype Packet',
      side_effects: {
        creates_repository: false,
        invites_testers: false,
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    render(<PacketPreviewWorkspace />)

    expect(screen.queryByRole('button', { name: /create work item/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /preview packet/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/mobile-app-foundry/prototype-packet', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer admin-token',
          'Content-Type': 'application/json',
        }),
      }))
    })
    expect(await screen.findByText(/Speech Practice Coach Prototype Packet/i)).toBeInTheDocument()
    expect(screen.getByText('creates repository')).toBeInTheDocument()
    expect(screen.getAllByText('false').length).toBeGreaterThan(0)
  })

  it('sends commercialization validation fields to the read-only packet endpoint', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      mode: 'read_only',
      markdown: '# Speech Practice Coach Commercialization Packet',
      side_effects: {
        submits_to_store: false,
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    render(<PacketPreviewWorkspace />)

    fireEvent.click(screen.getByRole('button', { name: /commercialization/i }))
    fireEvent.change(screen.getByLabelText(/validation status/i), { target: { value: 'validated' } })
    fireEvent.change(screen.getByLabelText(/prototype url/i), { target: { value: 'https://example.com/demo' } })
    fireEvent.change(screen.getByLabelText(/demo evidence/i), { target: { value: 'Simulator smoke passed.' } })
    fireEvent.click(screen.getByRole('button', { name: /preview packet/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/mobile-app-foundry/commercialization-packet', expect.any(Object))
    })
    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(request.commercialization_input).toMatchObject({
      validation_status: 'validated',
      prototype_url: 'https://example.com/demo',
      demo_evidence: ['Simulator smoke passed.'],
    })
    expect(await screen.findByText('# Speech Practice Coach Commercialization Packet')).toBeInTheDocument()
  })

  it('shows local JSON validation errors before calling the API', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<PacketPreviewWorkspace />)

    fireEvent.change(screen.getByLabelText(/backlog record json/i), { target: { value: '{' } })
    fireEvent.click(screen.getByRole('button', { name: /preview packet/i }))

    expect(await screen.findByText((text) => text.includes('Expected property name'))).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
