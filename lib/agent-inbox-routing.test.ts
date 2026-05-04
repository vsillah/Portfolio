import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  buildAgentMissionControlSnapshot: vi.fn(),
  createAgentEngagementRun: vi.fn(),
  runAgentWarRoom: vi.fn(),
}))

vi.mock('@/lib/agent-mission-control', () => ({
  buildAgentMissionControlSnapshot: mocks.buildAgentMissionControlSnapshot,
}))

vi.mock('@/lib/agent-engagement', () => ({
  createAgentEngagementRun: mocks.createAgentEngagementRun,
}))

vi.mock('@/lib/agent-war-room', () => ({
  runAgentWarRoom: mocks.runAgentWarRoom,
}))

import { buildAgentInboxRouteNote, findAgentInboxItem, routeAgentInboxItem } from '@/lib/agent-inbox-routing'
import type { AgentInboxItem } from '@/lib/agent-mission-control'

const failedItem: AgentInboxItem = {
  id: 'failed-run:failed',
  priority: 'high',
  agent_key: 'automation-systems',
  agent_name: 'Automation Systems Agent',
  pod: 'Product & Automation',
  title: 'Failure needs triage: Workflow dispatch',
  reason: 'Webhook returned 500.',
  action_label: 'Open trace',
  href: '/admin/agents/runs/failed-run',
  source_run_id: 'failed-run',
}

const standupItem: AgentInboxItem = {
  id: 'chief-of-staff:standup',
  priority: 'low',
  agent_key: 'chief-of-staff',
  agent_name: 'Chief of Staff Agent',
  pod: 'Chief of Staff',
  title: 'No War Room standup yet',
  reason: 'Run a standup to turn current signals into an operating brief.',
  action_label: 'Run standup',
  href: '/admin/agents',
  source_run_id: null,
}

describe('Agent Inbox routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.buildAgentMissionControlSnapshot.mockResolvedValue({
      agent_inbox: [failedItem, standupItem],
    })
    mocks.createAgentEngagementRun.mockResolvedValue({
      runId: 'engagement-run',
      status: 'completed',
      executionMode: 'read_only',
    })
    mocks.runAgentWarRoom.mockResolvedValue({
      runId: 'standup-run',
    })
  })

  it('finds inbox items by number or id', () => {
    expect(findAgentInboxItem([failedItem, standupItem], '1')).toEqual(failedItem)
    expect(findAgentInboxItem([failedItem, standupItem], 'chief-of-staff:standup')).toEqual(standupItem)
    expect(findAgentInboxItem([failedItem, standupItem], '3')).toBeUndefined()
  })

  it('builds a route note with item context and source run', () => {
    const note = buildAgentInboxRouteNote(failedItem)

    expect(note).toContain('Failure needs triage')
    expect(note).toContain('Priority: high')
    expect(note).toContain('Source run: failed-run')
  })

  it('routes failed inbox items into read-only agent engagement runs', async () => {
    const result = await routeAgentInboxItem({
      itemRef: '1',
      actor: { id: 'admin-user', label: 'Admin user', type: 'admin_user', userId: 'admin-user' },
      triggerSource: 'test_route',
    })

    expect(mocks.createAgentEngagementRun).toHaveBeenCalledWith(expect.objectContaining({
      agent: expect.objectContaining({ key: 'automation-systems' }),
      triggerSource: 'test_route',
      note: expect.stringContaining('Webhook returned 500.'),
      eventMetadata: expect.objectContaining({
        agent_inbox_item_id: 'failed-run:failed',
        source_run_id: 'failed-run',
        route_action: 'agent_engagement',
      }),
    }))
    expect(result).toMatchObject({
      runId: 'engagement-run',
      routeAction: 'agent_engagement',
      executionMode: 'read_only',
    })
  })

  it('routes stale standup inbox items to War Room standup', async () => {
    const result = await routeAgentInboxItem({
      itemRef: '2',
      actor: { id: 'U123', label: 'vambah', type: 'slack_command' },
      triggerSource: 'test_standup_route',
    })

    expect(mocks.runAgentWarRoom).toHaveBeenCalledWith(expect.objectContaining({
      command: 'standup',
      triggerSource: 'test_standup_route',
    }))
    expect(mocks.createAgentEngagementRun).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      runId: 'standup-run',
      routeAction: 'war_room_standup',
      executionMode: 'read_only',
    })
  })
})
