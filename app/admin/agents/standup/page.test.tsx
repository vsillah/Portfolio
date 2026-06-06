import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AgentStandupRoomPage from './page'

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/admin/Breadcrumbs', () => ({
  default: () => null,
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}))

const organization = {
  generated_at: '2026-05-14T10:00:00.000Z',
  summary: {
    agents: 2,
    live_agents: 1,
    active_work_items: 1,
    unassigned_work_items: 0,
    blocked_work_items: 1,
    ready_for_merge: 0,
    pending_approvals: 0,
    activity_entries: 0,
    active_goals: 1,
    average_cycle_hours: 3.5,
    oldest_in_flight_hours: 12,
    wip: [{ laneKey: 'chief-of-staff', label: 'Shaka', count: 1, limit: 4, overLimit: false }],
    goals: [{
      id: 'goal-1',
      title: 'Improve standup transparency',
      total: 2,
      completed: 1,
      progress: 50,
      blocked: 0,
      open: 1,
      burndown: [{ label: 'May 14', remaining: 1 }],
      sessionHref: '/admin/agents/standup?goal=goal-1',
      draftRunId: 'draft-run',
      approvalRunId: 'approval-run',
      latestRunId: 'room-run',
      draftTraceHref: '/admin/agents/runs/draft-run',
      approvalTraceHref: '/admin/agents/runs/approval-run',
      latestTraceHref: '/admin/agents/runs/room-run',
      readinessStatus: 'delegated',
      stageGates: [{ key: 'review', label: 'Review gate', ownerAgentKey: 'chief-of-staff', requiredBefore: 'handoff', status: 'pending', approvalRequired: true }],
      nextStageGate: { key: 'review', label: 'Review gate', ownerAgentKey: 'chief-of-staff', requiredBefore: 'handoff', status: 'pending', approvalRequired: true },
    }],
  },
  agents: [
    {
      key: 'chief-of-staff',
      name: 'Shaka (Zulu) - Chief of Staff',
      podKey: 'chief_of_staff',
      podName: 'Chief of Staff',
      status: 'partial',
      runtime: 'mixed',
      live: true,
      todayTurns: 2,
      latestAction: 'Coordinated standup.',
      latestRunId: 'run-1',
    },
    {
      key: 'engineering-copilot',
      name: 'Piye (Kush) - Engineering Copilot',
      podKey: 'product_automation',
      podName: 'Product & Automation Pod',
      status: 'partial',
      runtime: 'codex',
      live: false,
      todayTurns: 1,
      latestAction: 'Prepared implementation.',
      latestRunId: null,
    },
  ],
  lanes: [
    {
      key: 'chief-of-staff',
      label: 'Shaka',
      agentKey: 'chief-of-staff',
      agentName: 'Shaka (Zulu) - Chief of Staff',
      status: 'live',
      tasks: [{
        id: 'task-1',
        title: 'Draft standup room',
        objective: 'Create an interactive room.',
        status: 'in_progress',
        priority: 'high',
        ownerAgentKey: 'chief-of-staff',
        ownerAgentName: 'Shaka (Zulu) - Chief of Staff',
        ownerRuntime: 'mixed',
        branchName: null,
        worktreePath: null,
        prNumber: null,
        prUrl: null,
        activeRunId: 'run-1',
        blockerSummary: null,
        validationSummary: null,
        overlapGroup: null,
        parentWorkItemId: 'goal-parent',
        createdAt: '2026-05-14T08:00:00.000Z',
        updatedAt: '2026-05-14T09:00:00.000Z',
        completedAt: null,
        goal: {
          id: 'goal-1',
          title: 'Improve standup transparency',
          sequence: 1,
          status: 'approved',
          progressWeight: 1,
          sessionHref: '/admin/agents/standup?goal=goal-1',
          draftRunId: 'draft-run',
          approvalRunId: 'approval-run',
          latestRunId: 'room-run',
          parentWorkItemId: 'goal-parent',
          draftTraceHref: '/admin/agents/runs/draft-run',
          approvalTraceHref: '/admin/agents/runs/approval-run',
          latestTraceHref: '/admin/agents/runs/room-run',
          readinessStatus: 'delegated',
          stageGates: [{ key: 'review', label: 'Review gate', ownerAgentKey: 'chief-of-staff', requiredBefore: 'handoff', status: 'pending', approvalRequired: true }],
          nextStageGate: { key: 'review', label: 'Review gate', ownerAgentKey: 'chief-of-staff', requiredBefore: 'handoff', status: 'pending', approvalRequired: true },
        },
      }],
    },
    {
      key: 'engineering-copilot',
      label: 'Piye',
      agentKey: 'engineering-copilot',
      agentName: 'Piye (Kush) - Engineering Copilot',
      status: 'idle',
      tasks: [],
    },
  ],
  activity: [],
  warRoom: {
    roster: [],
    recentRuns: [{
      id: 'war-room-run-1',
      title: 'Agent Standup Room direct ask',
      command: 'ask_agent',
      status: 'completed',
      startedAt: '2026-05-14T11:00:00.000Z',
      summary: 'Shaka answered with scoped work context.',
      goalId: 'goal-1',
    }],
    commands: [],
    suggestedPrompt: 'Ask for blockers.',
  },
}

const readinessPacket = {
  readiness_status: 'ready_for_delegation',
  readiness_checklist: [
    { key: 'outcome_clear', label: 'Outcome is clear', status: 'ready', required: true, evidence: 'Goal objective is stated.' },
    { key: 'stage_gates_named', label: 'Stage gates are named', status: 'ready', required: true, evidence: 'Planning, review, and approval gates are named.' },
  ],
  acceptance_criteria: ['Goal scope is clear before delegation.'],
  stage_gates: [{ key: 'ready_to_delegate', label: 'Ready to delegate', owner_agent_key: 'chief-of-staff', required_before: 'work_item_creation', status: 'pending', approval_required: true }],
  authority_boundary: { publish: 'manual_approval_required', send: 'manual_approval_required', deploy: 'manual_approval_required', merge: 'manual_approval_required', notes: 'Work creation only; merge and deploy remain approval-gated.' },
  missing_context: [],
  planning_participants: ['chief-of-staff', 'engineering-copilot'],
}

describe('AgentStandupRoomPage', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/admin/agents/standup')
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      if (String(url).includes('/api/admin/agents/swarm-board')) {
        return { ok: true, json: async () => ({ ok: true, organization }) }
      }
      if (String(url).includes('/api/admin/agents/war-room')) {
        const body = JSON.parse(String((init as RequestInit).body ?? '{}'))
        if (body.command === 'draft_goal') {
          if (body.goal_type === 'social_outreach_linkedin_post') {
            return {
              ok: true,
              json: async () => ({
                ok: true,
                run_id: 'social-goal-run',
                command: 'draft_goal',
                goal_draft: {
                  goal_id: 'goal-social',
                  goal_type: 'social_outreach_linkedin_post',
                  title: body.goal,
                  objective: `Produce one draft-only LinkedIn content packet for: ${body.goal}`,
                  recommendation: 'Approve this pilot only if the output should stop at a Social Content draft.',
                  risk_notes: 'Manual Chronicle evidence and approved Open Brain context are required.',
                  ...readinessPacket,
                  authority_boundary: { ...readinessPacket.authority_boundary, publish: 'not_allowed', send: 'not_allowed' },
                  missing_context: ['Attach manual Chronicle evidence packet before final content approval.'],
                  publish_gate: 'draft_only',
                  source_requirements: ['One source-backed industry signal'],
                  chronicle_packet_status: 'manual_packet_required',
                  content_packet_id: 'packet-goal-social',
                  content_packet: {
                    id: 'packet-goal-social',
                    goal_statement: body.goal,
                    target_audience: 'LinkedIn audience: small business, nonprofit, and product leaders.',
                    industry_signal_summary: 'Pending research: capture one current industry signal.',
                    amadutown_proof_points: ['Agent Ops proves the workflow.'],
                    open_brain_references: ['Approved Open Brain references only.'],
                    chronicle_evidence_notes: ['Manual Chronicle packet required in V1.'],
                    draft_linkedin_post: 'A small business does not need another AI demo.',
                    visual_concept: 'Mission Control routes one social outreach goal into accountable work.',
                    image_prompt: 'Dark operating-console illustration with gold command accents.',
                    source_provenance_checklist: ['Open Brain references are approved/public-safe.', 'Chronicle notes are manually sanitized.'],
                    approval_checklist: ['Social Content item remains draft-only until separately approved.'],
                    content_calibration: {
                      status: 'needs_operator_context',
                      prior_success_patterns: [{
                        label: 'Builder proof post',
                        pattern: 'Open with a concrete build observation.',
                        why_it_worked: 'It referenced actual builder work and named the risk.',
                        reuse_guidance: 'Use when the draft needs more practical proof.',
                      }],
                      voice_principles: ['Open with a concrete scene, tension, or practical problem.'],
                      audience_notes: ['Speak to leaders trying to reduce burden.'],
                      revision_questions: ['Does the draft sound like a point Vambah would stand behind publicly?'],
                      missing_context_prompts: ['Paste or link one high-performing LinkedIn post.'],
                      comparison_prompt: 'Compare this draft against Vambah LinkedIn voice guidance.',
                    },
                  },
                  tasks: [{
                    id: 'goal-social-post-draft',
                    title: 'Draft the LinkedIn post',
                    objective: 'Turn source evidence into one Vambah-aligned LinkedIn draft.',
                    owner_agent_key: 'voice-content-architect',
                    priority: 'high',
                    dependencies: [],
                    expected_files: ['docs/linkedin-voice.md'],
                    acceptance_criteria: ['Draft opens with a concrete tension'],
                    risk_notes: 'No raw private material.',
                    goal_progress_weight: 3,
                  }],
                },
                messages: [],
              }),
            }
          }
          return {
            ok: true,
            json: async () => ({
              ok: true,
              run_id: 'goal-run',
              command: 'draft_goal',
              goal_draft: {
                goal_id: 'goal-draft',
                title: body.goal,
                objective: `Accomplish: ${body.goal}`,
                recommendation: 'Approve after review.',
                risk_notes: 'Review gated.',
                ...readinessPacket,
                tasks: [{
                  id: 'task-draft',
                  title: 'Implement room',
                  objective: 'Build it.',
                  owner_agent_key: 'engineering-copilot',
                  priority: 'high',
                  dependencies: [],
                  expected_files: ['app/admin/agents/standup/page.tsx'],
                  acceptance_criteria: ['Renders'],
                  risk_notes: 'Low',
                  goal_progress_weight: 1,
                }, {
                  id: 'task-validation',
                  title: 'Validate room',
                  objective: 'Test it.',
                  owner_agent_key: 'chief-of-staff',
                  priority: 'medium',
                  dependencies: [],
                  expected_files: ['app/admin/agents/standup/page.test.tsx'],
                  acceptance_criteria: ['Covered'],
                  risk_notes: 'Low',
                  goal_progress_weight: 1,
                }],
              },
              messages: [],
            }),
          }
        }
        if (body.command === 'approve_goal' || body.command === 'approve_readiness') {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              run_id: 'approval-run',
              command: body.command,
              messages: [],
              social_content_draft: body.draft?.goal_type === 'social_outreach_linkedin_post'
                ? { id: 'social-draft-1', href: '/admin/social-content/social-draft-1' }
                : null,
              created_work_items: {
                parent: { id: 'parent', title: 'Goal: Improve standup' },
                children: [{ id: 'child', title: 'Implement room' }],
              },
            }),
          }
        }
        return {
          ok: true,
          json: async () => ({
            ok: true,
            run_id: 'room-run',
            command: body.command,
            messages: [{
              id: `message-${body.command}`,
              role: 'agent',
              agent_key: body.target_agent_key ?? 'chief-of-staff',
              agent_name: 'Shaka (Zulu) - Chief of Staff',
              content: 'Scoped response ready.',
              created_at: '2026-05-14T10:00:00.000Z',
            }],
          }),
        }
      }
      if (String(url).includes('/api/admin/agents/n8n-workflow-proposals')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            work_item: {
              id: 'n8n-proposal-work-item',
              title: 'n8n proposal: Automate meeting intake to follow-up drafts workflow',
            },
          }),
        }
      }
      return { ok: false, json: async () => ({ error: 'not found' }) }
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.history.pushState({}, '', '/')
  })

  it('renders participants, chat, goal planner, mini Kanban, metrics, and avatars', async () => {
    render(<AgentStandupRoomPage />)

    expect(await screen.findByRole('heading', { name: 'Standup Room' })).toBeInTheDocument()
    expect(screen.getByText('Attendance')).toBeInTheDocument()
    expect(await screen.findByLabelText('2 of 2 selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Select all' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: /Illustrated avatar for Shaka/i }).length).toBeGreaterThan(0)
    expect(screen.getByText('Standup control')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Run standup with 2 selected participants' })).toBeInTheDocument()
    expect(screen.getByText('Shaka, Piye')).toBeInTheDocument()
    expect(screen.getByText(/The next run will appear in Trace History/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Swarm chat' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Goal planner' })).toBeInTheDocument()
    expect(screen.getByText('Kanban preview')).toBeInTheDocument()
    expect(screen.getByText('Fixed lane order · 1 active lane(s). Empty lanes collapse so the board stays scannable.')).toBeInTheDocument()
    expect(screen.getAllByText('Piye').length).toBeGreaterThan(0)
    expect(screen.getByText('Info radiators')).toBeInTheDocument()
    expect(screen.getByText('Trace history')).toBeInTheDocument()
    expect(screen.getByText('Agent Standup Room direct ask')).toBeInTheDocument()
    expect(screen.getByText('Shaka answered with scoped work context.')).toBeInTheDocument()
    expect(screen.getByText('ask agent')).toBeInTheDocument()
    expect(screen.getAllByText('completed').length).toBeGreaterThan(0)
    expect(screen.getByText('goal goal-1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open trace/i })).toHaveAttribute('href', '/admin/agents/runs/war-room-run-1')
    expect(screen.getAllByText('Improve standup transparency').length).toBeGreaterThan(0)
  })

  it('renders an empty persisted trace history state', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).includes('/api/admin/agents/swarm-board')) {
        return { ok: true, json: async () => ({ ok: true, organization: { ...organization, warRoom: { ...organization.warRoom, recentRuns: [] } } }) } as Response
      }
      return { ok: false, json: async () => ({ error: 'not found' }) } as Response
    })

    render(<AgentStandupRoomPage />)

    expect(await screen.findByText('No standup-room traces yet. Start a standup or ask an agent to create the first room trace.')).toBeInTheDocument()
  })

  it('posts standup and direct agent asks through war-room commands', async () => {
    render(<AgentStandupRoomPage />)

    fireEvent.click(await screen.findByRole('button', { name: /Start selected standup/i }))
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/war-room', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ command: 'standup', target_agent_keys: ['chief-of-staff', 'engineering-copilot'] }),
      }))
    })
    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: /Open trace/i }).some((link) => link.getAttribute('href') === '/admin/agents/runs/room-run')).toBe(true)
    })
    expect(screen.getByText('Question tracker')).toBeInTheDocument()
    expect(screen.getByText('1/1 answered')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/Ask about blockers/i), { target: { value: '@Shaka what is blocked?' } })
    fireEvent.click(screen.getByRole('button', { name: /Ask all/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/war-room', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ command: 'ask_agent', message: '@Shaka what is blocked?', target_agent_key: 'chief-of-staff' }),
      }))
    })

    fireEvent.click(screen.getByRole('button', { name: /Add Piye from standup selection/i }))
    expect(screen.getByText(/Target: 2 selected/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Ask about blockers/i)).toHaveValue('@Piye ')

    fireEvent.change(screen.getByPlaceholderText(/Ask about blockers/i), { target: { value: 'What changed since last standup?' } })
    fireEvent.click(screen.getByRole('button', { name: /Ask all/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/war-room', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          command: 'discuss',
          message: 'What changed since last standup?',
          target_agent_keys: ['chief-of-staff', 'engineering-copilot'],
        }),
      }))
    })

    fireEvent.change(screen.getByPlaceholderText(/Ask about blockers/i), { target: { value: 'Give us your implementation updates' } })
    fireEvent.click(screen.getByRole('button', { name: /Ask 2 agents/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/war-room', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          command: 'discuss',
          message: 'Give us your implementation updates',
          target_agent_keys: ['chief-of-staff', 'engineering-copilot'],
        }),
      }))
    })
  })

  it('drafts a goal before approving work item creation', async () => {
    render(<AgentStandupRoomPage />)

    fireEvent.change(await screen.findByPlaceholderText('What should the swarm accomplish?'), { target: { value: 'Improve standup' } })
    fireEvent.click(screen.getByRole('button', { name: /Draft plan/i }))

    expect(await screen.findByText('Approve after review.')).toBeInTheDocument()
    expect(screen.getByText('Definition of Ready')).toBeInTheDocument()
    expect(screen.getAllByText('Ready to delegate').length).toBeGreaterThan(0)
    expect(screen.getByText('Goal acceptance criteria')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Open trace/i }).some((link) => link.getAttribute('href') === '/admin/agents/runs/goal-run')).toBe(true)
    expect(fetch).toHaveBeenCalledWith('/api/admin/agents/war-room', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ command: 'draft_goal', goal: 'Improve standup', goal_type: 'general' }),
    }))

    fireEvent.change(screen.getByDisplayValue('Implement room'), { target: { value: 'Implement reviewed room' } })
    fireEvent.click(screen.getByRole('button', { name: /Remove Validate room/i }))
    fireEvent.click(screen.getByRole('button', { name: /Approve readiness & delegate/i }))

    await waitFor(() => {
      expect(screen.getByText(/Created 1 child work item/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: /Open goal on Kanban/i })).toHaveAttribute('href', '/admin/agents/swarm-board?goal=goal-draft')
    const approveCall = vi.mocked(fetch).mock.calls.find(([, init]) => String((init as RequestInit)?.body ?? '').includes('"command":"approve_readiness"'))
    expect(approveCall).toBeTruthy()
    const approveBody = JSON.parse(String((approveCall?.[1] as RequestInit).body))
    expect(approveBody.draft.tasks).toHaveLength(1)
    expect(approveBody.draft.tasks[0].title).toBe('Implement reviewed room')
  })

  it('renders the LinkedIn pilot template and draft-only packet before approval', async () => {
    render(<AgentStandupRoomPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'LinkedIn pilot' }))
    expect(screen.getByPlaceholderText('What should the swarm accomplish?')).toHaveValue('Create one LinkedIn post package showing how AmaduTown applies AI and automation to reduce operational burden for small businesses.')

    fireEvent.click(screen.getByRole('button', { name: /Draft plan/i }))

    expect(await screen.findByText('LinkedIn content packet')).toBeInTheDocument()
    expect(screen.getByText('Publish gate: draft only')).toBeInTheDocument()
    expect(screen.getByText('Chronicle: manual packet')).toBeInTheDocument()
    expect(screen.getByText('LinkedIn audience: small business, nonprofit, and product leaders.')).toBeInTheDocument()
    expect(screen.getByText('Pending research: capture one current industry signal.')).toBeInTheDocument()
    expect(screen.getByText(/Open Brain references are approved\/public-safe/i)).toBeInTheDocument()
    expect(screen.getByText('Mission Control routes one social outreach goal into accountable work.')).toBeInTheDocument()
    expect(screen.getByText('Content calibration')).toBeInTheDocument()
    expect(screen.getByText('Builder proof post')).toBeInTheDocument()
    expect(screen.getByText(/Paste or link one high-performing LinkedIn post/i)).toBeInTheDocument()
    expect(screen.getByText(/Compare this draft against Vambah LinkedIn voice guidance/i)).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/admin/agents/war-room', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        command: 'draft_goal',
        goal: 'Create one LinkedIn post package showing how AmaduTown applies AI and automation to reduce operational burden for small businesses.',
        goal_type: 'social_outreach_linkedin_post',
      }),
    }))

    fireEvent.click(screen.getByRole('button', { name: /Approve readiness & delegate/i }))

    expect(await screen.findByRole('link', { name: /Open linked Social Content draft/i })).toHaveAttribute('href', '/admin/social-content/social-draft-1')
  })

  it('opens a linked goal session from the query string', async () => {
    window.history.pushState({}, '', '/admin/agents/standup?goal=goal-1')

    render(<AgentStandupRoomPage />)

    expect(await screen.findByText('Goal session')).toBeInTheDocument()
    expect(screen.getByText('1/2 complete · 1 open · 0 blocked')).toBeInTheDocument()
    expect(screen.getAllByText('Draft standup room').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Open Kanban focus' })).toHaveAttribute('href', '/admin/agents/swarm-board?goal=goal-1')
    expect(screen.getByRole('link', { name: 'Open board' })).toHaveAttribute('href', '/admin/agents/swarm-board?goal=goal-1')
    expect(screen.getByRole('link', { name: 'Draft trace' })).toHaveAttribute('href', '/admin/agents/runs/draft-run')
    expect(screen.getByRole('link', { name: 'Approval trace' })).toHaveAttribute('href', '/admin/agents/runs/approval-run')
    expect(screen.getByRole('link', { name: 'Latest room trace' })).toHaveAttribute('href', '/admin/agents/runs/room-run')
    expect(screen.getByText('Goal Kanban preview')).toBeInTheDocument()

    expect(screen.getByText(/Goal session: Improve standup transparency/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Start selected standup/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/agents/war-room', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ command: 'standup', target_agent_keys: ['chief-of-staff', 'engineering-copilot'], goal_id: 'goal-1' }),
      }))
    })

    fireEvent.click(screen.getByRole('button', { name: 'Clear focus' }))

    expect(screen.queryByText('Goal session')).not.toBeInTheDocument()
    expect(window.location.search).toBe('')
  })

  it('prefills traceable work from an agentic content review decision link', async () => {
    window.history.pushState(
      {},
      '',
      '/admin/agents/standup?context=agentic-content-review&asset=p0-linkedin-flagship-agentic-operating-system&decision=approve_next_gate',
    )

    render(<AgentStandupRoomPage />)

    const goalInput = await screen.findByPlaceholderText('What should the swarm accomplish?') as HTMLTextAreaElement
    expect(goalInput.value).toContain('Agentic content review: approve next gate - Flagship post: Anyone can launch an agent now')
    expect(goalInput.value).toContain('Preserve the approval boundary: Social Content approval before scheduling or publishing.')
    expect(goalInput.value).toContain('Asset ID: p0-linkedin-flagship-agentic-operating-system')
    expect(goalInput.value).toContain('Approval status: human_review_ready')
    expect((screen.getByPlaceholderText(/Ask about blockers/i) as HTMLTextAreaElement).value).toContain('Keep this inside the existing Portfolio approval path.')
    expect(screen.getByText(/Loaded Flagship post: Anyone can launch an agent now for approve next gate/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Draft plan/i }))

    await waitFor(() => {
      const draftCall = vi.mocked(fetch).mock.calls.find(([, init]) => String((init as RequestInit)?.body ?? '').includes('"command":"draft_goal"'))
      expect(draftCall).toBeTruthy()
      const draftBody = JSON.parse(String((draftCall?.[1] as RequestInit).body))
      expect(draftBody.goal_type).toBe('general')
      expect(draftBody.goal).toContain('Agentic content review: approve next gate')
    })
  })

  it('prefills provider-blocked render readiness work from a decision link', async () => {
    window.history.pushState(
      {},
      '',
      '/admin/agents/standup?context=agentic-render-readiness&asset=render-p0-youtube-agentic-ai-teams-skip&decision=prepare_preflight',
    )

    render(<AgentStandupRoomPage />)

    const goalInput = await screen.findByPlaceholderText('What should the swarm accomplish?') as HTMLTextAreaElement
    expect(goalInput.value).toContain('Agentic video render-readiness: prepare render preflight - YouTube script: The Part of Agentic AI Most Teams Skip')
    expect(goalInput.value).toContain('Provider targets: HeyGen, ElevenLabs, Remotion, HyperFrames')
    expect(goalInput.value).toContain('Hard blocks:')
    expect(goalInput.value).toContain('No HeyGen, ElevenLabs, Remotion, HyperFrames, publishing, or outbound provider job is approved by this packet.')
    expect((screen.getByPlaceholderText(/Ask about blockers/i) as HTMLTextAreaElement).value).toContain('Keep provider execution blocked')
    expect(screen.getByText(/Loaded YouTube script: The Part of Agentic AI Most Teams Skip for prepare render preflight/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Draft plan/i }))

    await waitFor(() => {
      const draftCall = vi.mocked(fetch).mock.calls.find(([, init]) => String((init as RequestInit)?.body ?? '').includes('"command":"draft_goal"'))
      expect(draftCall).toBeTruthy()
      const draftBody = JSON.parse(String((draftCall?.[1] as RequestInit).body))
      expect(draftBody.goal_type).toBe('general')
      expect(draftBody.goal).toContain('Agentic video render-readiness: prepare render preflight')
    })
  })

  it('ignores invalid agentic decision links without changing the default standup form', async () => {
    window.history.pushState(
      {},
      '',
      '/admin/agents/standup?context=agentic-content-review&asset=unknown&decision=not-a-decision',
    )

    render(<AgentStandupRoomPage />)

    expect(await screen.findByText('Agent Standup Room')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('What should the swarm accomplish?')).toHaveValue('')
    expect(screen.getByPlaceholderText(/Ask about blockers/i)).toHaveValue('')
    expect(screen.queryByText(/Loaded .* for .*Review the prefilled/i)).not.toBeInTheDocument()
  })

  it('creates governed n8n workflow proposals from automation goal sessions', async () => {
    const automationGoal = {
      ...organization.summary.goals[0],
      id: 'automation:meeting-intake-follow-up-drafts',
      title: 'Automate meeting intake to follow-up drafts',
      sessionHref: '/admin/agents/standup?goal=automation%3Ameeting-intake-follow-up-drafts',
      automationGoalSeedId: 'meeting-intake-follow-up-drafts',
      workflowFamily: 'meeting_follow_up',
      automationLevel: 'draft_to_review',
      requiresNewWorkflow: false,
      n8nWorkflows: ['WF-SLK', 'WF-CAL'],
      approvalGate: 'External emails and calendar invitations stay approval-gated.',
      nextAction: 'Confirm every meeting can route into a draft follow-up.',
    }
    const automationTask = {
      ...organization.lanes[0].tasks[0],
      goal: {
        ...organization.lanes[0].tasks[0].goal!,
        id: automationGoal.id,
        title: automationGoal.title,
        sessionHref: automationGoal.sessionHref,
        automationGoalSeedId: automationGoal.automationGoalSeedId,
        workflowFamily: automationGoal.workflowFamily,
        automationLevel: automationGoal.automationLevel,
        requiresNewWorkflow: automationGoal.requiresNewWorkflow,
        n8nWorkflows: automationGoal.n8nWorkflows,
        approvalGate: automationGoal.approvalGate,
        nextAction: automationGoal.nextAction,
      },
    }
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (String(url).includes('/api/admin/agents/swarm-board')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            organization: {
              ...organization,
              summary: { ...organization.summary, goals: [automationGoal] },
              lanes: [{ ...organization.lanes[0], tasks: [automationTask] }, organization.lanes[1]],
            },
          }),
        } as Response
      }
      if (String(url).includes('/api/admin/agents/n8n-workflow-proposals')) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            work_item: {
              id: 'n8n-proposal-work-item',
              title: 'n8n proposal: Automate meeting intake to follow-up drafts workflow',
            },
          }),
        } as Response
      }
      return { ok: false, json: async () => ({ error: 'not found' }) } as Response
    })
    window.history.pushState({}, '', '/admin/agents/standup?goal=automation%3Ameeting-intake-follow-up-drafts')

    render(<AgentStandupRoomPage />)

    expect(await screen.findByLabelText('Automation workflow proposal')).toBeInTheDocument()
    expect(screen.getByText('meeting follow up')).toBeInTheDocument()
    expect(screen.getByText('2 known workflow(s)')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Draft workflow proposal/i }))

    await waitFor(() => {
      expect(screen.getByText(/Created n8n proposal: Automate meeting intake to follow-up drafts workflow/i)).toBeInTheDocument()
    })
    const proposalCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes('/api/admin/agents/n8n-workflow-proposals'))
    expect(proposalCall).toBeTruthy()
    const proposalBody = JSON.parse(String((proposalCall?.[1] as RequestInit).body))
    expect(proposalBody).toMatchObject({
      action: 'draft_workflow',
      automation_goal_seed_id: 'meeting-intake-follow-up-drafts',
      goal_id: 'automation:meeting-intake-follow-up-drafts',
      goal_title: 'Automate meeting intake to follow-up drafts',
      workflow_family: 'meeting_follow_up',
    })
    expect(proposalBody.confirmation).toBeUndefined()
  })

  it('requires at least one selected participant before starting standup', async () => {
    render(<AgentStandupRoomPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Clear' }))

    expect(screen.getByRole('heading', { name: 'Select participants to start' })).toBeInTheDocument()
    expect(screen.getByText('No agents selected.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Start selected standup/i })).toBeDisabled()
  })
})
