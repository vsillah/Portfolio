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

  it('previews a prototype packet without creating a work item', async () => {
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

    expect(screen.getByRole('button', { name: /create proposed item/i })).toBeDisabled()
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

  it('previews and then creates a proposed Agent Ops work item with confirmation', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      if (String(input) === '/api/admin/mobile-app-foundry/work-items' && body.action === 'create_work_item') {
        return new Response(JSON.stringify({
          ok: true,
          mode: 'confirmed_create',
          work_item_request: {
            title: 'Prototype mobile app opportunity: Speech Practice Coach',
            priority: 'high',
            status: 'proposed',
            ownerAgentKey: 'engineering-copilot',
            idempotencyKey: 'mobile-foundry:speech-practice-coach:prototype-work-item:v1',
          },
          work_items: [{ id: 'work-item-1', status: 'proposed' }],
          side_effects: {
            work_items_created: true,
            repositories_created: false,
          },
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({
        ok: true,
        mode: 'preview',
        work_item_request: {
          title: 'Prototype mobile app opportunity: Speech Practice Coach',
          priority: 'high',
          status: 'proposed',
          ownerAgentKey: 'engineering-copilot',
          idempotencyKey: 'mobile-foundry:speech-practice-coach:prototype-work-item:v1',
        },
        work_items: [],
        side_effects: {
          work_items_created: false,
          repositories_created: false,
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<PacketPreviewWorkspace />)

    fireEvent.change(screen.getByLabelText(/source run id/i), { target: { value: 'run-123' } })
    fireEvent.click(screen.getByRole('button', { name: /preview proposal/i }))

    expect(await screen.findByText('mobile-foundry:speech-practice-coach:prototype-work-item:v1')).toBeInTheDocument()
    const createButton = screen.getByRole('button', { name: /create proposed item/i })
    expect(createButton).toBeEnabled()
    fireEvent.click(createButton)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock).toHaveBeenLastCalledWith('/api/admin/mobile-app-foundry/work-items', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer admin-token',
        'Content-Type': 'application/json',
      }),
    }))
    const createRequest = JSON.parse(String(fetchMock.mock.calls[1][1]?.body))
    expect(createRequest).toMatchObject({
      action: 'create_work_item',
      confirmation: 'create_mobile_foundry_work_items',
      source_run_id: 'run-123',
    })
    expect(await screen.findByText(/Proposed Agent Ops work item ready in Decision Queue: work-item-1/i)).toBeInTheDocument()
  })

  it('clears proposal preview state when the backlog record changes', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      mode: 'preview',
      work_item_request: {
        title: 'Prototype mobile app opportunity: Speech Practice Coach',
        priority: 'high',
        status: 'proposed',
        ownerAgentKey: 'engineering-copilot',
        idempotencyKey: 'mobile-foundry:speech-practice-coach:prototype-work-item:v1',
      },
      work_items: [],
      side_effects: {
        work_items_created: false,
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    render(<PacketPreviewWorkspace />)

    fireEvent.click(screen.getByRole('button', { name: /preview proposal/i }))
    expect(await screen.findByText('mobile-foundry:speech-practice-coach:prototype-work-item:v1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create proposed item/i })).toBeEnabled()

    fireEvent.change(screen.getByLabelText(/backlog record json/i), {
      target: { value: '{"id":"changed"}' },
    })

    expect(screen.queryByText('mobile-foundry:speech-practice-coach:prototype-work-item:v1')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create proposed item/i })).toBeDisabled()
  })

  it('sends commercialization validation fields to the read-only packet endpoint', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
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
