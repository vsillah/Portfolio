import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KickoffContext } from './kickoff-agenda'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  n8nWebhookUrl: vi.fn(() => 'https://n8n.example/webhook/provisioning-reminder'),
}))

vi.mock('./supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('./n8n', () => ({
  n8nWebhookUrl: mocks.n8nWebhookUrl,
}))

import {
  fireProvisioningReminder,
  markOffboardingStep,
  populateKickoffTokens,
} from './kickoff-agenda'

function context(overrides: Partial<KickoffContext> = {}): KickoffContext {
  return {
    client_name: 'Neil',
    client_email: 'neil@example.com',
    client_company: 'KMB FireSpring',
    project_name: 'AI Ops Sprint',
    project_start_date: '2026-03-15T12:00:00.000Z',
    estimated_end_date: '2026-05-10T12:00:00.000Z',
    slack_channel: 'kmb-ai-ops',
    sender_name: 'Vambah',
    dashboard_url: 'https://amadutown.com/client/dashboard/token-1',
    milestones: [
      {
        week: 1,
        title: 'Kickoff',
        description: 'Align on outcomes',
        deliverables: [],
        phase: 1,
        status: 'pending',
      },
    ],
    communication_plan: {
      cadence: 'Weekly',
      channels: ['slack', 'email'],
      meetings: [
        {
          type: 'standup',
          frequency: 'weekly',
          duration_minutes: 30,
          description: 'Progress check',
        },
      ],
      escalation_path: 'Ping Vambah in Slack',
    },
    setup_requirements: [
      {
        title: 'Share analytics access',
        description: 'GA4 viewer role',
        category: 'access',
        is_client_action: true,
      },
      {
        title: 'Provision workspace',
        description: 'Internal setup',
        category: 'ops',
        is_client_action: false,
      },
    ],
    win_conditions: [
      {
        metric: 'Hours saved',
        target: '8/week',
        measurement_method: 'time log',
        timeframe: '30 days',
      },
    ],
    warranty: {
      duration_months: 3,
      coverage_description: 'bug fixes on delivered automations',
      exclusions: [],
      extended_support_available: false,
      extended_support_description: '',
    },
    ...overrides,
  }
}

function formatKickoffDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

describe('populateKickoffTokens', () => {
  it('replaces project, communication, and win-condition tokens', () => {
    const ctx = context()
    const rendered = populateKickoffTokens(
      [
        'Hello {{client_name}} at {{client_company}} from {{sender_name}}.',
        'Project {{project_name}} starts {{project_start_date}} and ends {{estimated_end_date}} ({{duration_weeks}} weeks).',
        'Talk in {{communication_channel}}.',
        '{{communication_plan_details}}',
        '{{milestones_summary}}',
        '{{platform_checklist}}',
        '{{win_conditions_summary}}',
        '{{warranty_summary}}',
        'Dashboard: {{dashboard_url}}',
      ].join('\n'),
      ctx,
    )

    expect(rendered).toContain('Hello Neil at KMB FireSpring from Vambah.')
    expect(rendered).toContain('Project AI Ops Sprint')
    expect(rendered).toContain(formatKickoffDate(ctx.project_start_date!))
    expect(rendered).toContain(formatKickoffDate(ctx.estimated_end_date!))
    expect(rendered).toContain('(8 weeks)')
    expect(rendered).toContain('Talk in Slack (#kmb-ai-ops).')
    expect(rendered).toContain('Cadence: Weekly')
    expect(rendered).toContain('standup: weekly, 30 min — Progress check')
    expect(rendered).toContain('1. Week 1: Kickoff — Align on outcomes')
    expect(rendered).toContain('1. Share analytics access — GA4 viewer role')
    expect(rendered).not.toContain('Provision workspace')
    expect(rendered).toContain('- Hours saved: 8/week (30 days)')
    expect(rendered).toContain('3-month warranty: bug fixes on delivered automations')
    expect(rendered).toContain('Dashboard: https://amadutown.com/client/dashboard/token-1')
    expect(rendered).not.toMatch(/\{\{.+?\}\}/)
  })

  it('uses safe fallbacks when optional project details are missing', () => {
    const rendered = populateKickoffTokens(
      [
        '{{client_company}}',
        'start={{project_start_date}} end={{estimated_end_date}} weeks={{duration_weeks}}',
        '{{communication_channel}}',
        '{{milestones_summary}}',
        '{{platform_checklist}}',
        '{{win_conditions_summary}}',
        '{{warranty_summary}}',
        '{{dashboard_url}}',
        '{{first_update_day}}',
      ].join('\n'),
      context({
        client_company: null,
        project_start_date: null,
        estimated_end_date: null,
        slack_channel: null,
        dashboard_url: null,
        milestones: [],
        communication_plan: null,
        setup_requirements: [],
        win_conditions: [],
        warranty: null,
      }),
    )

    expect(rendered).toContain('Neil')
    expect(rendered).toContain('start=TBD end=TBD weeks=0')
    expect(rendered).toContain('email')
    expect(rendered).toContain('Milestones will be shared after this call.')
    expect(rendered).toContain('No platform signups required for this engagement.')
    expect(rendered).toContain('Win conditions will be finalized during discovery.')
    expect(rendered).toContain('Standard warranty included')
    expect(rendered).toContain('Will be shared after this call')
    expect(rendered).toContain('after project kickoff')
  })
})

describe('markOffboardingStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('marks completed as complete and writes completed_at', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ update })

    await expect(markOffboardingStep('proj-1', 'completed')).resolves.toBe(true)
    expect(mocks.from).toHaveBeenCalledWith('offboarding_checklists')
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'complete',
        completed_at: expect.any(String),
      }),
    )
    expect(eq).toHaveBeenCalledWith('client_project_id', 'proj-1')
  })

  it('marks intermediate steps as in_progress on the matching timestamp column', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ update })

    await expect(markOffboardingStep('proj-1', 'access_revoked')).resolves.toBe(true)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'in_progress',
        access_revoked_at: expect.any(String),
      }),
    )
  })
})

describe('fireProvisioningReminder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }))
  })

  it('does not call n8n when the project is missing', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'missing' } }),
        }),
      }),
    })

    await expect(fireProvisioningReminder('missing')).resolves.toEqual({
      triggered: false,
      message: 'Project not found',
    })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('does not call n8n when no provisioning items are pending', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'client_projects') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  client_name: 'Neil',
                  client_email: 'neil@example.com',
                  project_name: 'AI Ops Sprint',
                  slack_channel: 'kmb-ai-ops',
                },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'provisioning_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [{ id: 'item-1', title: 'Done', status: 'complete', is_client_action: true }],
                error: null,
              }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    await expect(fireProvisioningReminder('proj-1')).resolves.toEqual({
      triggered: false,
      message: 'No pending provisioning items',
      pendingCount: 0,
    })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
