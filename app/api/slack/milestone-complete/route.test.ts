import { createHmac } from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  triggerProgressUpdate: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/progress-update-templates', () => ({
  triggerProgressUpdate: mocks.triggerProgressUpdate,
}))

import { POST } from './route'

const ORIGINAL_ENV = process.env
const SECRET = 'test-slack-secret'

function signedRequest(fields: Record<string, string>, secret = SECRET) {
  const rawBody = new URLSearchParams(fields).toString()
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`

  return new NextRequest('http://localhost/api/slack/milestone-complete', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-slack-request-timestamp': timestamp,
      'x-slack-signature': signature,
    },
    body: rawBody,
  })
}

function mockProjectAndPlan(
  project: Record<string, unknown> | null,
  plan: { id: string; milestones: Array<{ title: string; status: string }> } | null,
  updateError: unknown = null,
) {
  mocks.from.mockImplementation((table: string) => {
    if (table === 'client_projects') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: project,
              error: project ? null : { message: 'not found' },
            }),
          }),
        }),
      }
    }
    if (table === 'onboarding_plans') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: plan, error: plan ? null : { message: 'missing' } }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: updateError }),
        }),
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  })
}

const project = {
  id: 'proj-1',
  client_name: 'Acme Co',
  client_email: 'ops@acme.test',
  product_purchased: 'Advisory',
}

describe('POST /api/slack/milestone-complete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    process.env = { ...ORIGINAL_ENV, SLACK_SIGNING_SECRET: SECRET }
    mocks.triggerProgressUpdate.mockResolvedValue({ channel: 'email' })
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('rejects invalid Slack signatures', async () => {
    const response = await POST(signedRequest({ text: 'cli_1 1' }, 'wrong-secret'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid Slack signature' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns usage help when arguments are missing', async () => {
    const response = await POST(signedRequest({ text: 'cli_1', user_name: 'vambah' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.response_type).toBe('ephemeral')
    expect(body.text).toContain('Usage:')
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a non-positive milestone number', async () => {
    const response = await POST(signedRequest({ text: 'cli_1 0', user_name: 'vambah' }))
    const body = await response.json()

    expect(body.text).toContain('positive integer')
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('reports when the client project is missing', async () => {
    mockProjectAndPlan(null, null)

    const response = await POST(signedRequest({ text: 'cli_missing 1', user_name: 'vambah' }))
    const body = await response.json()

    expect(body.text).toContain('Could not find a project')
    expect(mocks.triggerProgressUpdate).not.toHaveBeenCalled()
  })

  it('reports when the onboarding plan is missing', async () => {
    mockProjectAndPlan(project, null)

    const response = await POST(signedRequest({ text: 'cli_20260201_1 1', user_name: 'vambah' }))
    const body = await response.json()

    expect(body.text).toContain('No onboarding plan found')
  })

  it('rejects a milestone index outside the plan', async () => {
    mockProjectAndPlan(project, {
      id: 'plan-1',
      milestones: [{ title: 'Kickoff', status: 'pending' }],
    })

    const response = await POST(signedRequest({ text: 'cli_20260201_1 3', user_name: 'vambah' }))
    const body = await response.json()

    expect(body.text).toContain('out of range')
    expect(mocks.triggerProgressUpdate).not.toHaveBeenCalled()
  })

  it('does not re-complete an already complete milestone', async () => {
    mockProjectAndPlan(project, {
      id: 'plan-1',
      milestones: [{ title: 'Kickoff', status: 'complete' }],
    })

    const response = await POST(signedRequest({ text: 'cli_20260201_1 1', user_name: 'vambah' }))
    const body = await response.json()

    expect(body.text).toContain('already marked as complete')
    expect(mocks.triggerProgressUpdate).not.toHaveBeenCalled()
  })

  it('marks the milestone complete and triggers a progress update', async () => {
    mockProjectAndPlan(project, {
      id: 'plan-1',
      milestones: [
        { title: 'Kickoff', status: 'pending' },
        { title: 'Discovery', status: 'pending' },
      ],
    })

    const response = await POST(signedRequest({ text: 'cli_20260201_1 2', user_name: 'vambah' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.text).toContain('Marked milestone 2 ("Discovery") as complete')
    expect(body.text).toContain('Acme Co')
    expect(body.text).toContain('email')
    expect(mocks.triggerProgressUpdate).toHaveBeenCalledWith({
      clientProjectId: 'proj-1',
      milestoneIndex: 1,
      newStatus: 'complete',
      senderName: 'vambah',
      triggeredBy: 'slack_cmd',
    })
  })
})
