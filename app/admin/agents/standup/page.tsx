'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  GitPullRequest,
  KanbanSquare,
  MessageSquare,
  Play,
  Send,
  Sparkles,
  Target,
  Trash2,
  Users,
  Workflow,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import AgentAvatar from '@/components/admin/AgentAvatar'
import { getCurrentSession } from '@/lib/auth'
import type {
  AgentOrgBoardAgent,
  AgentOrgBoardGoalMetric,
  AgentOrgBoardLane,
  AgentOrgBoardSnapshot,
  AgentOrgBoardTask,
} from '@/lib/agent-swarm-board'
import type { AgentGoalDraft, AgentWarRoomMessage } from '@/lib/agent-war-room'

type BoardResponse = {
  ok?: boolean
  organization?: AgentOrgBoardSnapshot
}

type WarRoomResponse = {
  ok: boolean
  run_id: string
  command: string
  messages?: AgentWarRoomMessage[]
  synthesis?: string
  goal_draft?: AgentGoalDraft | null
  created_work_items?: {
    parent: { id: string; title: string }
    children: Array<{ id: string; title: string }>
  } | null
  social_content_draft?: { id: string; href: string } | null
  error?: string
}

type WarRoomCommandTrace = {
  runId: string
  command: string
  synthesis?: string
  goalId?: string | null
  createdAt: string
}

type StandupQuestion = {
  id: string
  prompt: string
  targetLabel: string
  targetAgentKey: string | null
  targetAgentKeys: string[]
  command: 'standup' | 'discuss' | 'ask_agent'
  status: 'pending' | 'answered' | 'failed'
  runId?: string
  createdAt: string
}

type ParticipantSessionState = {
  asked: boolean
  responded: boolean
  messageCount: number
  lastResponseAt: string | null
}

type N8nProposalState = {
  workItemId: string
  title: string
  createdAt: string
}

function agentShortName(name: string) {
  return name.split(' - ')[0].replace(/\s*\([^)]*\)/g, '').trim()
}

function agentMentionToken(agent: AgentOrgBoardAgent) {
  return agentShortName(agent.name).replace(/\s+/g, '').toLowerCase()
}

function findMentionedAgent(text: string, agents: AgentOrgBoardAgent[]) {
  const match = text.match(/(?:^|\s)@([a-z0-9_-]+)/i)
  if (!match) return null
  const token = match[1].toLowerCase()
  return agents.find((agent) => {
    const display = agentMentionToken(agent)
    return token === display ||
      token === agent.key.toLowerCase() ||
      token === agent.key.toLowerCase().replace(/-/g, '') ||
      agent.name.toLowerCase().includes(token)
  }) ?? null
}

export default function AgentStandupRoomPage() {
  return (
    <ProtectedRoute requireAdmin>
      <StandupRoomContent />
    </ProtectedRoute>
  )
}

function StandupRoomContent() {
  const [organization, setOrganization] = useState<AgentOrgBoardSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAgentKeys, setSelectedAgentKeys] = useState<string[]>([])
  const [selectionInitialized, setSelectionInitialized] = useState(false)
  const [message, setMessage] = useState('')
  const [goal, setGoal] = useState('')
  const [goalType, setGoalType] = useState<'general' | 'social_outreach_linkedin_post'>('general')
  const [focusedGoalId, setFocusedGoalId] = useState<string | null>(null)
  const [goalDraft, setGoalDraft] = useState<AgentGoalDraft | null>(null)
  const [createdItems, setCreatedItems] = useState<WarRoomResponse['created_work_items']>(null)
  const [commandTraces, setCommandTraces] = useState<WarRoomCommandTrace[]>([])
  const [standupQuestions, setStandupQuestions] = useState<StandupQuestion[]>([])
  const [n8nProposal, setN8nProposal] = useState<N8nProposalState | null>(null)
  const [transcript, setTranscript] = useState<AgentWarRoomMessage[]>([
    {
      id: 'system-ready',
      role: 'system',
      content: 'Standup Room is ready. Ask all agents, select one participant, or give Shaka a goal to break into tracked work.',
      created_at: new Date().toISOString(),
    },
  ])
  const [busy, setBusy] = useState<string | null>(null)

  const fetchBoard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const response = await fetch('/api/admin/agents/swarm-board', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await response.json().catch(() => ({})) as BoardResponse
      if (!response.ok || !body.organization) throw new Error('Unable to load Agent Kanban snapshot')
      setOrganization(body.organization)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Standup Room')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBoard()
  }, [fetchBoard])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const goalId = params.get('goal')
    if (goalId) setFocusedGoalId(goalId)
  }, [])

  const participants = useMemo(() => {
    const agents = organization?.agents ?? []
    return agents.filter((agent) => agent.status !== 'planned').slice(0, 12)
  }, [organization?.agents])
  useEffect(() => {
    if (selectionInitialized || !participants.length) return
    setSelectedAgentKeys(participants.map((agent) => agent.key))
    setSelectionInitialized(true)
  }, [participants, selectionInitialized])
  const selectedAgents = useMemo(() => {
    const selected = participants.filter((agent) => selectedAgentKeys.includes(agent.key))
    return selected
  }, [participants, selectedAgentKeys])
  const allTasks = useMemo(() => organization?.lanes.flatMap((lane) => lane.tasks) ?? [], [organization?.lanes])
  const focusedGoal = useMemo(() => {
    if (!focusedGoalId || !organization) return null
    return organization.summary.goals.find((item) => item.id === focusedGoalId) ?? null
  }, [focusedGoalId, organization])
  const focusedGoalTasks = useMemo(() => {
    if (!focusedGoalId) return []
    return allTasks.filter((task) => task.goal?.id === focusedGoalId)
  }, [allTasks, focusedGoalId])
  const participantSession = useMemo(() => {
    const session = new Map<string, ParticipantSessionState>()
    for (const agent of participants) {
      const responses = transcript.filter((entry) => entry.agent_key === agent.key)
      session.set(agent.key, {
        asked: standupQuestions.some((question) => question.targetAgentKey === agent.key || question.targetAgentKeys.includes(agent.key)),
        responded: responses.length > 0,
        messageCount: responses.length,
        lastResponseAt: responses.at(-1)?.created_at ?? null,
      })
    }
    return session
  }, [participants, standupQuestions, transcript])

  function focusGoal(goalId: string | null) {
    setFocusedGoalId(goalId)
    setN8nProposal(null)
    const url = new URL(window.location.href)
    if (goalId) {
      url.searchParams.set('goal', goalId)
    } else {
      url.searchParams.delete('goal')
    }
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }

  function addQuestion(question: Omit<StandupQuestion, 'id' | 'status' | 'createdAt'>) {
    const id = `question-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setStandupQuestions((current) => [{
      ...question,
      id,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    }, ...current].slice(0, 8))
    return id
  }

  function completeQuestion(id: string, status: StandupQuestion['status'], runId?: string) {
    setStandupQuestions((current) => current.map((question) => (
      question.id === id ? { ...question, status, runId } : question
    )))
  }

  async function postWarRoom(payload: Record<string, unknown>, loadingKey: string, questionId?: string) {
    setBusy(loadingKey)
    setError(null)
    const command = typeof payload.command === 'string' ? payload.command : null
    const scopedPayload = focusedGoalId && command !== 'draft_goal'
      ? { ...payload, goal_id: focusedGoalId }
      : payload
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const response = await fetch('/api/admin/agents/war-room', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scopedPayload),
      })
      const body = await response.json().catch(() => ({})) as WarRoomResponse
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      if (body.messages?.length) setTranscript((current) => [...current, ...body.messages!])
      if (body.goal_draft) setGoalDraft(body.goal_draft)
      if (body.social_content_draft) {
        setGoalDraft((current) => current?.content_packet ? {
          ...current,
          content_packet: {
            ...current.content_packet,
            social_content_draft_id: body.social_content_draft?.id ?? null,
            social_content_draft_href: body.social_content_draft?.href ?? null,
          },
        } : current)
      }
      if (body.run_id) {
        setCommandTraces((current) => {
          const nextTrace = {
            runId: body.run_id,
            command: body.command,
            synthesis: body.synthesis,
            goalId: body.goal_draft?.goal_id ?? (payload.draft as AgentGoalDraft | undefined)?.goal_id ?? null,
            createdAt: new Date().toISOString(),
          }
          return [nextTrace, ...current.filter((trace) => trace.runId !== body.run_id)].slice(0, 5)
        })
      }
      if (body.created_work_items) {
        setCreatedItems(body.created_work_items)
        await fetchBoard()
      }
      if (questionId) completeQuestion(questionId, 'answered', body.run_id)
      return body
    } catch (err) {
      setError(err instanceof Error ? err.message : 'War Room command failed')
      if (questionId) completeQuestion(questionId, 'failed')
      return null
    } finally {
      setBusy(null)
    }
  }

  async function startStandup() {
    const targetAgentKeys = selectedAgents.map((agent) => agent.key)
    if (!targetAgentKeys.length) return
    const questionId = addQuestion({
      command: 'standup',
      prompt: `Start standup with ${targetAgentKeys.length} selected agent(s).`,
      targetLabel: `${targetAgentKeys.length} selected agent(s)`,
      targetAgentKey: null,
      targetAgentKeys,
    })
    await postWarRoom({ command: 'standup', target_agent_keys: targetAgentKeys }, 'standup', questionId)
  }

  async function askAll() {
    if (!message.trim()) return
    const text = message.trim()
    const mentionedAgent = findMentionedAgent(text, participants)
    setMessage('')
    if (mentionedAgent) {
      setSelectedAgentKeys([mentionedAgent.key])
      const questionId = addQuestion({
        command: 'ask_agent',
        prompt: text,
        targetLabel: agentShortName(mentionedAgent.name),
        targetAgentKey: mentionedAgent.key,
        targetAgentKeys: [mentionedAgent.key],
      })
      await postWarRoom({ command: 'ask_agent', message: text, target_agent_key: mentionedAgent.key }, 'ask-agent', questionId)
      return
    }
    const targetAgentKeys = participants.map((agent) => agent.key)
    const questionId = addQuestion({
      command: 'discuss',
      prompt: text,
      targetLabel: 'All agents',
      targetAgentKey: null,
      targetAgentKeys,
    })
    await postWarRoom({ command: 'discuss', message: text, target_agent_keys: targetAgentKeys }, 'ask-all', questionId)
  }

  async function askSelectedAgents() {
    if (!message.trim() || !selectedAgents.length) return
    const text = message.trim()
    setMessage('')
    if (selectedAgents.length === 1) {
      const agent = selectedAgents[0]
      const questionId = addQuestion({
        command: 'ask_agent',
        prompt: text,
        targetLabel: agentShortName(agent.name),
        targetAgentKey: agent.key,
        targetAgentKeys: [agent.key],
      })
      await postWarRoom({ command: 'ask_agent', message: text, target_agent_key: agent.key }, 'ask-agent', questionId)
      return
    }
    const targetAgentKeys = selectedAgents.map((agent) => agent.key)
    const questionId = addQuestion({
      command: 'discuss',
      prompt: text,
      targetLabel: `${selectedAgents.length} selected agents`,
      targetAgentKey: null,
      targetAgentKeys,
    })
    await postWarRoom({
      command: 'discuss',
      message: text,
      target_agent_keys: targetAgentKeys,
    }, 'ask-agent', questionId)
  }

  async function draftGoal() {
    if (!goal.trim()) return
    await postWarRoom({ command: 'draft_goal', goal: goal.trim(), goal_type: goalType }, 'draft-goal')
  }

  function applySocialOutreachTemplate() {
    setGoalType('social_outreach_linkedin_post')
    setGoal('Create one LinkedIn post package showing how AmaduTown applies AI and automation to reduce operational burden for small businesses.')
  }

  async function approveGoal() {
    if (!goalDraft) return
    const approvedGoalId = goalDraft.goal_id
    const result = await postWarRoom({ command: 'approve_readiness', draft: goalDraft }, 'approve-goal')
    if (result?.created_work_items) focusGoal(approvedGoalId)
  }

  async function createN8nProposalForGoal(goalMetric: AgentOrgBoardGoalMetric) {
    const seedId = goalMetric.automationGoalSeedId ?? goalMetric.id.replace(/^automation:/, '')
    setBusy('n8n-proposal')
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const response = await fetch('/api/admin/agents/n8n-workflow-proposals', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'draft_workflow',
          title: `${goalMetric.title} workflow`,
          objective: goalMetric.nextAction ?? `Draft the governed n8n workflow plan for ${goalMetric.title}.`,
          workflow_family: goalMetric.workflowFamily,
          automation_goal_seed_id: seedId,
          goal_id: goalMetric.id,
          goal_title: goalMetric.title,
          goal_session_href: goalMetric.sessionHref,
          proposed_workflow_name: goalMetric.title,
          trigger: 'Agent Ops Standup Room goal session',
          required_env_vars: ['N8N_INGEST_SECRET'],
          credential_needs: ['Confirm required source credentials before staging.'],
          node_plan: [
            'Identify the source trigger and dedupe/idempotency key.',
            'Draft staging-safe transformation and routing nodes.',
            'Write back Agent Ops trace, work-item, and approval evidence.',
          ],
          ingest_callbacks: ['/api/admin/agents/work-items', '/api/admin/agents/runs'],
          rollback_path: 'Delete the inactive draft workflow and close the proposal work item before any activation request.',
        }),
      })
      const body = await response.json().catch(() => ({})) as { ok?: boolean; work_item?: { id?: string; title?: string }; error?: string }
      if (!response.ok || !body.ok) throw new Error(body.error || `HTTP ${response.status}`)
      setN8nProposal({
        workItemId: body.work_item?.id ?? 'n8n-proposal',
        title: body.work_item?.title ?? `${goalMetric.title} workflow proposal`,
        createdAt: new Date().toISOString(),
      })
      await fetchBoard()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create n8n workflow proposal')
    } finally {
      setBusy(null)
    }
  }

  function updateGoalTask(taskId: string, patch: Partial<AgentGoalDraft['tasks'][number]>) {
    setGoalDraft((current) => {
      if (!current) return current
      return {
        ...current,
        tasks: current.tasks.map((task) => task.id === taskId ? { ...task, ...patch } : task),
      }
    })
  }

  function removeGoalTask(taskId: string) {
    setGoalDraft((current) => {
      if (!current) return current
      return {
        ...current,
        tasks: current.tasks.filter((task) => task.id !== taskId),
      }
    })
  }

  return (
    <div className="agent-ops-page min-h-screen p-5 text-foreground lg:p-7">
      <div className="mx-auto max-w-7xl">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Agent Operations', href: '/admin/agents' },
          { label: 'Standup Room' },
        ]} />

        <header className="agent-ops-surface-header mt-5 flex flex-col gap-4 rounded-xl border p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="agent-ops-eyebrow mb-2">
              <Users size={15} />
              Agent Ops
            </div>
            <h1 className="text-3xl font-bold">Standup Room</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Ask Shaka or the swarm directly, inspect the active board, and turn goals into review-gated Agent Ops work items.
            </p>
          </div>
          <div className="agent-ops-header-actions">
            <Link href={focusedGoalId ? `/admin/agents/swarm-board?goal=${encodeURIComponent(focusedGoalId)}` : '/admin/agents/swarm-board'} className="agent-ops-button-secondary">
              <KanbanSquare size={16} />
              Open full Kanban
            </Link>
          </div>
        </header>

        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Loading Standup Room...</div>
        ) : error && !organization ? (
          <div className="mt-5 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-100">{error}</div>
        ) : organization ? (
          <div className="mt-5 grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)_340px]">
            <ParticipantRail
              participants={participants}
              selectedAgentKeys={selectedAgents.map((agent) => agent.key)}
              session={participantSession}
              onToggle={(agent) => {
                setSelectedAgentKeys((current) => (
                  current.includes(agent.key)
                    ? current.filter((key) => key !== agent.key)
                    : [...current, agent.key]
                ))
                setMessage((current) => current || `@${agentShortName(agent.name)} `)
              }}
              onSelectAll={() => setSelectedAgentKeys(participants.map((agent) => agent.key))}
              onClear={() => setSelectedAgentKeys([])}
            />
            <main className="space-y-5">
              {focusedGoal && (
                <GoalSessionPanel
                  goal={focusedGoal}
                  tasks={focusedGoalTasks}
                  n8nProposal={n8nProposal}
                  busy={busy}
                  onCreateN8nProposal={() => createN8nProposalForGoal(focusedGoal)}
                  onClear={() => focusGoal(null)}
                />
              )}
              <StandupControlPanel
                selectedAgents={selectedAgents}
                focusedGoal={focusedGoal}
                latestTrace={commandTraces[0] ?? null}
                busy={busy}
                onStartStandup={startStandup}
              />
              <ChatRoom
                transcript={transcript}
                questions={standupQuestions}
                commandTraces={commandTraces}
                message={message}
                onMessageChange={setMessage}
                selectedAgents={selectedAgents}
                busy={busy}
                onAskAll={askAll}
                onAskAgent={askSelectedAgents}
                onQuickPrompt={setMessage}
              />
              <GoalPlanner
                goal={goal}
                goalDraft={goalDraft}
                createdItems={createdItems}
                busy={busy}
                participants={participants}
                onGoalChange={setGoal}
                goalType={goalType}
                onGoalTypeChange={setGoalType}
                onApplySocialOutreachTemplate={applySocialOutreachTemplate}
                onDraftGoal={draftGoal}
                onApproveGoal={approveGoal}
                onUpdateTask={updateGoalTask}
                onRemoveTask={removeGoalTask}
              />
            </main>
            <aside className="space-y-5">
              <MetricsPanel organization={organization} />
              <TraceHistory runs={organization.warRoom.recentRuns} commandTraces={commandTraces} />
              <MiniKanban lanes={organization.lanes} focusedGoalId={focusedGoalId} />
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ParticipantRail({
  participants,
  selectedAgentKeys,
  session,
  onToggle,
  onSelectAll,
  onClear,
}: {
  participants: AgentOrgBoardAgent[]
  selectedAgentKeys: string[]
  session: Map<string, ParticipantSessionState>
  onToggle: (agent: AgentOrgBoardAgent) => void
  onSelectAll: () => void
  onClear: () => void
}) {
  return (
    <aside className="agent-ops-card rounded-lg border p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-radiant-gold">Attendance</h2>
        <span
          aria-label={`${selectedAgentKeys.length} of ${participants.length} selected`}
          className="rounded-full border border-silicon-slate/60 px-2 py-1 text-xs text-muted-foreground"
        >
          {selectedAgentKeys.length}/{participants.length}
        </span>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={onSelectAll} className="rounded-lg border border-silicon-slate/60 px-2 py-1 text-xs text-muted-foreground hover:border-radiant-gold/50 hover:text-radiant-gold">
          Select all
        </button>
        <button type="button" onClick={onClear} className="rounded-lg border border-silicon-slate/60 px-2 py-1 text-xs text-muted-foreground hover:border-radiant-gold/50 hover:text-radiant-gold">
          Clear
        </button>
      </div>
      <div className="space-y-2">
        {participants.map((agent) => {
          const state = session.get(agent.key)
          const statusLabel = state?.responded ? 'Responded' : state?.asked ? 'Asked' : agent.live ? 'Available' : 'Idle'
          const selected = selectedAgentKeys.includes(agent.key)
          return (
            <button
              key={agent.key}
              type="button"
              onClick={() => onToggle(agent)}
              aria-pressed={selected}
              aria-label={`${selected ? 'Remove' : 'Add'} ${agentShortName(agent.name)} from standup selection`}
              className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition ${
                selected
                  ? 'border-silicon-slate/70 bg-silicon-slate/20 ring-1 ring-radiant-gold/25'
                  : 'border-silicon-slate/60 bg-background/40 hover:border-radiant-gold/40'
              }`}
            >
              <AgentAvatar agentKey={agent.key} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{agentShortName(agent.name)}</span>
                <span className="block truncate text-xs text-muted-foreground">{agent.podName}</span>
                <span className="mt-1 inline-flex rounded-full border border-silicon-slate/50 px-2 py-0.5 text-[11px] text-muted-foreground">
                  {statusLabel}{state?.messageCount ? ` · ${state.messageCount}` : ''}
                </span>
              </span>
              <span aria-hidden="true" className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                selected
                  ? 'border-radiant-gold/70 text-radiant-gold'
                  : state?.responded
                    ? 'border-radiant-gold/50 bg-radiant-gold'
                    : agent.live
                      ? 'border-green-400/60 bg-green-400'
                      : 'border-silicon-slate bg-silicon-slate'
              }`}>
                {selected && <CheckCircle2 size={14} />}
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

function StandupControlPanel({
  selectedAgents,
  focusedGoal,
  latestTrace,
  busy,
  onStartStandup,
}: {
  selectedAgents: AgentOrgBoardAgent[]
  focusedGoal: AgentOrgBoardGoalMetric | null
  latestTrace: WarRoomCommandTrace | null
  busy: string | null
  onStartStandup: () => void
}) {
  const hasSelection = selectedAgents.length > 0
  return (
    <section className="agent-ops-card rounded-lg border border-radiant-gold/35 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="agent-ops-eyebrow">
            <Target size={16} />
            Standup control
          </div>
          <h2 className="mt-2 text-xl font-semibold">
            {hasSelection ? `Run standup with ${selectedAgents.length} selected participant${selectedAgents.length === 1 ? '' : 's'}` : 'Select participants to start'}
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            The standup creates a traced room update, appends agent responses to this transcript, and gives the next follow-up a home in Trace History or Kanban.
          </p>
        </div>
        <button
          type="button"
          onClick={onStartStandup}
          disabled={busy != null || !hasSelection}
          className="agent-ops-button-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Play size={16} />
          {busy === 'standup' ? 'Starting...' : 'Start selected standup'}
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <StandupControlBlock
          title="Participants"
          value={hasSelection ? selectedAgents.map((agent) => agentShortName(agent.name)).join(', ') : 'No agents selected.'}
          tone={hasSelection ? 'default' : 'warning'}
        />
        <StandupControlBlock
          title="Scope"
          value={focusedGoal ? `Goal session: ${focusedGoal.title}` : 'General Agent Ops room. Use a goal session when work should land as traceable Kanban tasks.'}
        />
        <StandupControlBlock
          title="Output"
          value={latestTrace ? `Latest trace is ready: ${latestTrace.synthesis ?? latestTrace.command}.` : 'The next run will appear in Trace History and link back to this room.'}
        />
      </div>
    </section>
  )
}

function StandupControlBlock({ title, value, tone = 'default' }: { title: string; value: string; tone?: 'default' | 'warning' }) {
  return (
    <div className={`rounded-lg border p-3 ${
      tone === 'warning'
        ? 'border-yellow-400/35 bg-yellow-500/10'
        : 'border-silicon-slate/60 bg-background/45'
    }`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      <p className="mt-2 text-sm text-foreground/90">{value}</p>
    </div>
  )
}

function ChatRoom({
  transcript,
  questions,
  commandTraces,
  message,
  selectedAgents,
  busy,
  onMessageChange,
  onAskAll,
  onAskAgent,
  onQuickPrompt,
}: {
  transcript: AgentWarRoomMessage[]
  questions: StandupQuestion[]
  commandTraces: WarRoomCommandTrace[]
  message: string
  selectedAgents: AgentOrgBoardAgent[]
  busy: string | null
  onMessageChange: (value: string) => void
  onAskAll: () => void
  onAskAgent: () => void
  onQuickPrompt: (value: string) => void
}) {
  const latestTrace = commandTraces[0]
  return (
    <section className="agent-ops-card rounded-lg border p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <MessageSquare size={20} className="text-radiant-gold" />
            Swarm chat
          </h2>
        <p className="mt-1 text-sm text-muted-foreground">Use @agent targeting or select one or more participants from attendance.</p>
        </div>
        {selectedAgents.length > 0 && (
          <div className="flex items-center gap-2 rounded-full border border-silicon-slate/60 px-3 py-1 text-xs text-muted-foreground">
            <AgentAvatar agentKey={selectedAgents[0].key} size="sm" />
            Target: {selectedAgents.length === 1 ? agentShortName(selectedAgents[0].name) : `${selectedAgents.length} selected`}
          </div>
        )}
      </div>

      {latestTrace && (
        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-radiant-gold/35 bg-radiant-gold/10 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-radiant-gold">Latest trace</p>
            <p className="mt-1 truncate text-foreground/90">{latestTrace.synthesis ?? `${latestTrace.command} completed`}</p>
          </div>
          <Link href={`/admin/agents/runs/${latestTrace.runId}`} className="inline-flex items-center gap-2 text-radiant-gold hover:underline">
            Open trace
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {questions.length > 0 && (
        <div className="mb-4 rounded-lg border border-silicon-slate/60 bg-background/45 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Question tracker</p>
            <span className="text-xs text-muted-foreground">{questions.filter((question) => question.status === 'answered').length}/{questions.length} answered</span>
          </div>
          <div className="grid gap-2">
            {questions.slice(0, 4).map((question) => (
              <div key={question.id} className="grid gap-2 rounded-md border border-silicon-slate/50 bg-black/10 px-3 py-2 text-xs sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:items-center">
                <span className="font-semibold text-radiant-gold">{question.targetLabel}</span>
                <span className="line-clamp-1 text-muted-foreground">{question.prompt}</span>
                <span className={`rounded-full border px-2 py-0.5 ${
                  question.status === 'answered'
                    ? 'border-green-400/35 text-green-200'
                    : question.status === 'failed'
                      ? 'border-red-400/40 text-red-200'
                      : 'border-yellow-400/35 text-yellow-200'
                }`}>
                  {question.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="max-h-[360px] space-y-3 overflow-y-auto rounded-lg border border-silicon-slate/60 bg-background/50 p-3">
        {transcript.map((entry, index) => (
          <div key={`${entry.id}-${index}`} className={`flex gap-3 ${entry.role === 'user' ? 'justify-end' : ''}`}>
            {entry.role !== 'user' && <AgentAvatar agentKey={entry.agent_key ?? 'chief-of-staff'} size="sm" />}
            <div className={`max-w-[85%] rounded-lg border px-3 py-2 text-sm ${
              entry.role === 'user'
                ? 'border-radiant-gold/40 bg-radiant-gold/10'
                : 'border-silicon-slate/60 bg-silicon-slate/15'
            }`}>
              {entry.agent_name && <p className="mb-1 text-xs font-semibold text-radiant-gold">{entry.agent_name}</p>}
              <p className="leading-relaxed text-foreground/90">{entry.content}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 lg:flex-row">
        <input
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          className="min-h-11 flex-1 rounded-lg border border-silicon-slate/70 bg-silicon-slate/30 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/80 focus:border-radiant-gold/70"
          placeholder="Ask about blockers, owners, risk, next steps, or @Shaka for a direct update..."
        />
        <button onClick={onAskAll} disabled={busy != null || !message.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-radiant-gold/50 px-4 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/10 disabled:opacity-50">
          <Send size={16} />
          Ask all
        </button>
        <button onClick={onAskAgent} disabled={busy != null || !message.trim() || selectedAgents.length === 0} className="inline-flex items-center justify-center gap-2 rounded-lg bg-radiant-gold px-4 py-2 text-sm font-semibold text-obsidian hover:bg-radiant-gold/90 disabled:opacity-50">
          <Send size={16} />
          {selectedAgents.length > 1 ? `Ask ${selectedAgents.length} agents` : 'Ask selected'}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {['Give me blockers only', 'Who owns the oldest work?', 'What changed since last standup?'].map((prompt) => (
          <button key={prompt} type="button" onClick={() => onQuickPrompt(prompt)} className="rounded-full border border-radiant-gold/35 px-3 py-1 text-xs text-radiant-gold hover:bg-radiant-gold/10">
            {prompt}
          </button>
        ))}
      </div>
    </section>
  )
}

function GoalPlanner({
  goal,
  goalType,
  goalDraft,
  createdItems,
  busy,
  participants,
  onGoalChange,
  onGoalTypeChange,
  onApplySocialOutreachTemplate,
  onDraftGoal,
  onApproveGoal,
  onUpdateTask,
  onRemoveTask,
}: {
  goal: string
  goalType: 'general' | 'social_outreach_linkedin_post'
  goalDraft: AgentGoalDraft | null
  createdItems: WarRoomResponse['created_work_items']
  busy: string | null
  participants: AgentOrgBoardAgent[]
  onGoalChange: (value: string) => void
  onGoalTypeChange: (value: 'general' | 'social_outreach_linkedin_post') => void
  onApplySocialOutreachTemplate: () => void
  onDraftGoal: () => void
  onApproveGoal: () => void
  onUpdateTask: (taskId: string, patch: Partial<AgentGoalDraft['tasks'][number]>) => void
  onRemoveTask: (taskId: string) => void
}) {
  const requiredReadiness = goalDraft?.readiness_checklist?.filter((item) => item.required) ?? []
  const incompleteReadiness = requiredReadiness.filter((item) => item.status !== 'ready')
  const readyToDelegate = Boolean(
    goalDraft &&
    goalDraft.readiness_status === 'ready_for_delegation' &&
    incompleteReadiness.length === 0 &&
    (goalDraft.acceptance_criteria?.length ?? 0) > 0 &&
    (goalDraft.stage_gates?.length ?? 0) > 0 &&
    goalDraft.tasks.length > 0,
  )

  return (
    <section className="agent-ops-card rounded-lg border p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles size={18} className="text-radiant-gold" />
        <h2 className="text-xl font-semibold">Goal planner</h2>
      </div>
      <div className="mb-3 rounded-lg border border-silicon-slate/60 bg-background/45 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-radiant-gold">Pilot template</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use the LinkedIn social outreach pilot when Shaka should create a draft-only content packet, Kanban tasks, and a Social Content draft.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onGoalTypeChange('general')}
              className={`rounded-full border px-3 py-1.5 text-xs ${goalType === 'general' ? 'border-radiant-gold/70 text-radiant-gold' : 'border-silicon-slate/60 text-muted-foreground hover:text-foreground'}`}
            >
              General goal
            </button>
            <button
              type="button"
              onClick={onApplySocialOutreachTemplate}
              className={`rounded-full border px-3 py-1.5 text-xs ${goalType === 'social_outreach_linkedin_post' ? 'border-radiant-gold/70 bg-radiant-gold/10 text-radiant-gold' : 'border-silicon-slate/60 text-muted-foreground hover:text-foreground'}`}
            >
              LinkedIn pilot
            </button>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 lg:flex-row">
        <input
          value={goal}
          onChange={(event) => onGoalChange(event.target.value)}
          className="min-h-11 flex-1 rounded-lg border border-silicon-slate/70 bg-silicon-slate/30 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/80 focus:border-radiant-gold/70"
          placeholder="What should the swarm accomplish?"
        />
        <button onClick={onDraftGoal} disabled={busy != null || !goal.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-radiant-gold/50 px-4 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/10 disabled:opacity-50">
          Draft plan
        </button>
      </div>

      {goalDraft && (
        <div className="mt-4 rounded-lg border border-radiant-gold/35 bg-radiant-gold/5 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-radiant-gold">Draft packet</p>
              <h3 className="mt-1 text-lg font-semibold">{goalDraft.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{goalDraft.recommendation}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {goalDraft.goal_type === 'social_outreach_linkedin_post' && (
                  <>
                    <span className="rounded-full border border-radiant-gold/35 px-2 py-1 text-radiant-gold">LinkedIn content packet</span>
                    <span className="rounded-full border border-silicon-slate/60 px-2 py-1 text-muted-foreground">Publish gate: draft only</span>
                    <span className="rounded-full border border-silicon-slate/60 px-2 py-1 text-muted-foreground">Chronicle: manual packet</span>
                  </>
                )}
              </div>
            </div>
            <button onClick={onApproveGoal} disabled={busy != null || !readyToDelegate} className="inline-flex items-center justify-center gap-2 rounded-lg bg-radiant-gold px-4 py-2 text-sm font-semibold text-obsidian hover:bg-radiant-gold/90 disabled:opacity-50" title={readyToDelegate ? 'Create the approved goal and child work items' : 'Complete the required readiness packet before delegation'}>
              <CheckCircle2 size={16} />
              Approve readiness & delegate
            </button>
          </div>
          <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
            <div className="rounded-lg border border-silicon-slate/60 bg-background/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-radiant-gold">Definition of Ready</p>
                <span className={`rounded-full border px-2 py-1 text-xs ${readyToDelegate ? 'border-green-500/35 bg-green-500/10 text-green-100' : 'border-yellow-500/40 bg-yellow-500/10 text-yellow-100'}`}>
                  {readyToDelegate ? 'Ready to delegate' : `${incompleteReadiness.length} required open`}
                </span>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {(goalDraft.readiness_checklist ?? []).map((item) => (
                  <div key={item.key} className={`rounded-md border p-2 text-xs ${item.status === 'ready' ? 'border-green-500/25 bg-green-500/5' : item.status === 'blocked' ? 'border-red-500/35 bg-red-500/10 text-red-100' : 'border-yellow-500/35 bg-yellow-500/10 text-yellow-100'}`}>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 size={13} className={item.status === 'ready' ? 'mt-0.5 shrink-0 text-green-200' : 'mt-0.5 shrink-0 text-muted-foreground'} />
                      <div>
                        <p className="font-medium">{item.label}</p>
                        {item.evidence ? <p className="mt-1 text-muted-foreground">{item.evidence}</p> : null}
                        {item.blocker ? <p className="mt-1 text-red-100">{item.blocker}</p> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {goalDraft.missing_context?.length ? (
                <div className="mt-3 rounded-md border border-yellow-500/35 bg-yellow-500/10 p-2 text-xs text-yellow-100">
                  <p className="font-semibold">Known context still needed before final approval</p>
                  <ul className="mt-1 space-y-1">
                    {goalDraft.missing_context.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>
            <div className="rounded-lg border border-silicon-slate/60 bg-background/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-radiant-gold">Stage Gates</p>
              <div className="mt-3 space-y-2">
                {(goalDraft.stage_gates ?? []).map((gate) => (
                  <div key={gate.key} className="rounded-md border border-silicon-slate/55 bg-background/45 p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{gate.label}</p>
                      <span className="rounded-full border border-silicon-slate/50 px-2 py-0.5 text-muted-foreground">{gate.status.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      Before {gate.required_before.replace(/_/g, ' ')}{gate.approval_required ? ' · approval required' : ''}
                    </p>
                  </div>
                ))}
              </div>
              {goalDraft.authority_boundary ? (
                <div className="mt-3 rounded-md border border-silicon-slate/55 bg-black/10 p-2 text-xs text-muted-foreground">
                  <p className="font-semibold uppercase tracking-wide text-radiant-gold">Authority boundary</p>
                  <p className="mt-1">{goalDraft.authority_boundary.notes}</p>
                </div>
              ) : null}
            </div>
          </div>
          {goalDraft.acceptance_criteria?.length ? (
            <div className="mt-3 rounded-lg border border-silicon-slate/60 bg-background/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-radiant-gold">Goal acceptance criteria</p>
              <ul className="mt-2 grid gap-1 text-sm text-muted-foreground md:grid-cols-2">
                {goalDraft.acceptance_criteria.map((criterion) => <li key={criterion}>{criterion}</li>)}
              </ul>
            </div>
          ) : null}
          {goalDraft.content_packet && (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-silicon-slate/60 bg-background/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-radiant-gold">LinkedIn Content Packet</p>
                <p className="mt-2 text-sm font-medium">{goalDraft.content_packet.target_audience}</p>
                <p className="mt-2 text-sm text-muted-foreground">{goalDraft.content_packet.industry_signal_summary}</p>
                <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                  {goalDraft.content_packet.source_provenance_checklist.slice(0, 3).map((item) => (
                    <span key={item}>• {item}</span>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-silicon-slate/60 bg-background/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-radiant-gold">Visual brief</p>
                <p className="mt-2 text-sm text-muted-foreground">{goalDraft.content_packet.visual_concept}</p>
                <p className="mt-3 line-clamp-3 rounded-md border border-silicon-slate/50 bg-black/10 p-2 text-xs text-muted-foreground">
                  {goalDraft.content_packet.image_prompt}
                </p>
              </div>
            </div>
          )}
          <div className="mt-4 grid gap-2">
            {goalDraft.tasks.map((task, index) => (
              <div key={task.id} className="rounded-lg border border-silicon-slate/60 bg-background/60 p-3">
                <div className="flex items-start gap-3">
                  <span className="rounded-full border border-radiant-gold/40 px-2 py-1 text-xs text-radiant-gold">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_120px_90px_auto]">
                      <label className="text-xs text-muted-foreground">
                        Task
                        <input
                          value={task.title}
                          onChange={(event) => onUpdateTask(task.id, { title: event.target.value })}
                          className="mt-1 w-full rounded-md border border-silicon-slate/60 bg-background/70 px-2 py-1.5 text-sm text-foreground outline-none focus:border-radiant-gold/70"
                        />
                      </label>
                      <label className="text-xs text-muted-foreground">
                        Owner
                        <select
                          value={task.owner_agent_key}
                          onChange={(event) => onUpdateTask(task.id, { owner_agent_key: event.target.value })}
                          className="mt-1 w-full rounded-md border border-silicon-slate/60 bg-background/70 px-2 py-1.5 text-sm text-foreground outline-none focus:border-radiant-gold/70"
                        >
                          {participants.map((agent) => (
                            <option key={agent.key} value={agent.key}>{agentShortName(agent.name)}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs text-muted-foreground">
                        Priority
                        <select
                          value={task.priority}
                          onChange={(event) => onUpdateTask(task.id, { priority: event.target.value as AgentGoalDraft['tasks'][number]['priority'] })}
                          className="mt-1 w-full rounded-md border border-silicon-slate/60 bg-background/70 px-2 py-1.5 text-sm text-foreground outline-none focus:border-radiant-gold/70"
                        >
                          {['urgent', 'high', 'medium', 'low'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                        </select>
                      </label>
                      <label className="text-xs text-muted-foreground">
                        Weight
                        <input
                          type="number"
                          min={1}
                          max={5}
                          value={task.goal_progress_weight}
                          onChange={(event) => onUpdateTask(task.id, { goal_progress_weight: Number(event.target.value) || 1 })}
                          className="mt-1 w-full rounded-md border border-silicon-slate/60 bg-background/70 px-2 py-1.5 text-sm text-foreground outline-none focus:border-radiant-gold/70"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => onRemoveTask(task.id)}
                        className="mt-5 inline-flex h-9 items-center justify-center rounded-md border border-red-400/40 px-2 text-red-200 hover:bg-red-500/10"
                        aria-label={`Remove ${task.title}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <label className="mt-2 block text-xs text-muted-foreground">
                      Objective
                      <textarea
                        value={task.objective}
                        onChange={(event) => onUpdateTask(task.id, { objective: event.target.value })}
                        rows={2}
                        className="mt-1 w-full rounded-md border border-silicon-slate/60 bg-background/70 px-2 py-1.5 text-sm text-foreground outline-none focus:border-radiant-gold/70"
                      />
                    </label>
                    <div className="mt-2 grid gap-2 lg:grid-cols-3">
                      <label className="block text-xs text-muted-foreground">
                        Dependencies
                        <textarea
                          value={task.dependencies.join('\n')}
                          onChange={(event) => onUpdateTask(task.id, { dependencies: textareaLines(event.target.value) })}
                          rows={3}
                          className="mt-1 w-full rounded-md border border-silicon-slate/60 bg-background/70 px-2 py-1.5 text-sm text-foreground outline-none focus:border-radiant-gold/70"
                          placeholder="One dependency id per line"
                        />
                      </label>
                      <label className="block text-xs text-muted-foreground">
                        Acceptance criteria
                        <textarea
                          value={task.acceptance_criteria.join('\n')}
                          onChange={(event) => onUpdateTask(task.id, { acceptance_criteria: textareaLines(event.target.value) })}
                          rows={3}
                          className="mt-1 w-full rounded-md border border-silicon-slate/60 bg-background/70 px-2 py-1.5 text-sm text-foreground outline-none focus:border-radiant-gold/70"
                          placeholder="One acceptance criterion per line"
                        />
                      </label>
                      <label className="block text-xs text-muted-foreground">
                        Expected files
                        <textarea
                          value={task.expected_files.join('\n')}
                          onChange={(event) => onUpdateTask(task.id, { expected_files: textareaLines(event.target.value) })}
                          rows={3}
                          className="mt-1 w-full rounded-md border border-silicon-slate/60 bg-background/70 px-2 py-1.5 text-sm text-foreground outline-none focus:border-radiant-gold/70"
                          placeholder="One file or surface per line"
                        />
                      </label>
                    </div>
                    <label className="mt-2 block text-xs text-muted-foreground">
                      Risk notes
                      <input
                        value={task.risk_notes}
                        onChange={(event) => onUpdateTask(task.id, { risk_notes: event.target.value })}
                        className="mt-1 w-full rounded-md border border-silicon-slate/60 bg-background/70 px-2 py-1.5 text-sm text-foreground outline-none focus:border-radiant-gold/70"
                      />
                    </label>
                  </div>
                </div>
              </div>
            ))}
            {!goalDraft.tasks.length && (
              <div className="rounded-lg border border-dashed border-silicon-slate/60 p-4 text-sm text-muted-foreground">
                No tasks are selected for creation. Draft the goal again or keep at least one task before readiness can be delegated.
              </div>
            )}
          </div>
        </div>
      )}

      {createdItems && (
        <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-100">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>Created {createdItems.children.length} child work item(s) under {createdItems.parent.title}.</p>
            {goalDraft && (
              <Link href={`/admin/agents/swarm-board?goal=${encodeURIComponent(goalDraft.goal_id)}`} className="inline-flex items-center gap-2 text-radiant-gold hover:underline">
                Open goal on Kanban
                <ArrowRight size={14} />
              </Link>
            )}
          </div>
          {goalDraft?.content_packet?.social_content_draft_href && (
            <Link href={goalDraft.content_packet.social_content_draft_href} className="mt-2 inline-flex items-center gap-2 text-xs text-radiant-gold hover:underline">
              Open linked Social Content draft
              <ExternalLink size={13} />
            </Link>
          )}
          <div className="mt-2 grid gap-1">
            {createdItems.children.slice(0, 4).map((item, index) => (
              <p key={item.id} className="text-xs text-green-100/80">{index + 1}. {item.title}</p>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function textareaLines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function GoalSessionPanel({
  goal,
  tasks,
  n8nProposal,
  busy,
  onCreateN8nProposal,
  onClear,
}: {
  goal: AgentOrgBoardGoalMetric
  tasks: AgentOrgBoardTask[]
  n8nProposal: N8nProposalState | null
  busy: string | null
  onCreateN8nProposal: () => void
  onClear: () => void
}) {
  const orderedTasks = [...tasks].sort((a, b) => (a.goal?.sequence ?? 999) - (b.goal?.sequence ?? 999))
  const isAutomationGoal = Boolean(goal.automationGoalSeedId || goal.id.startsWith('automation:'))
  return (
    <section className="agent-ops-card rounded-lg border border-radiant-gold/35 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-radiant-gold">Goal session</p>
          <h2 className="mt-1 text-xl font-semibold">{goal.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {goal.completed}/{goal.total} complete · {goal.open} open · {goal.blocked} blocked
          </p>
          {goal.nextStageGate ? (
            <p className="mt-2 text-sm text-radiant-gold">
              Next gate: {goal.nextStageGate.label} · before {goal.nextStageGate.requiredBefore.replace(/_/g, ' ')}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {goal.draftTraceHref && <AuditLink href={goal.draftTraceHref} label="Draft trace" />}
            {goal.approvalTraceHref && <AuditLink href={goal.approvalTraceHref} label="Approval trace" />}
            {goal.latestTraceHref && <AuditLink href={goal.latestTraceHref} label="Latest room trace" />}
            {!goal.draftTraceHref && !goal.approvalTraceHref && !goal.latestTraceHref ? (
              <span className="rounded-full border border-silicon-slate/60 px-2 py-1 text-muted-foreground">Audit traces pending</span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/agents/swarm-board?goal=${encodeURIComponent(goal.id)}`} className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/50 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/10">
            Open Kanban focus
          </Link>
          <button type="button" onClick={onClear} className="rounded-lg border border-silicon-slate/60 px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
            Clear focus
          </button>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-silicon-slate/70">
        <div className="h-full bg-radiant-gold" style={{ width: `${goal.progress}%` }} />
      </div>
      {(goal.stageGates ?? []).length ? (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {(goal.stageGates ?? []).slice(0, 4).map((gate) => (
            <div key={gate.key} className="rounded-lg border border-silicon-slate/60 bg-background/55 p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{gate.label}</span>
                <span className="text-muted-foreground">{gate.status.replace(/_/g, ' ')}</span>
              </div>
              <p className="mt-1 text-muted-foreground">
                Before {gate.requiredBefore.replace(/_/g, ' ')}{gate.approvalRequired ? ' · approval gate' : ''}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      {isAutomationGoal && (
        <div className="mt-4 rounded-lg border border-silicon-slate/60 bg-background/55 p-3" aria-label="Automation workflow proposal">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-radiant-gold">
                <Workflow size={16} />
                <p className="text-xs font-semibold uppercase tracking-[0.16em]">n8n workflow proposal</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {goal.nextAction ?? 'Ask Yaa Asantewaa to draft the governed workflow plan before any staging, credential, outbound, or activation step.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {goal.workflowFamily && <span className="rounded-full border border-silicon-slate/60 px-2 py-1 text-muted-foreground">{goal.workflowFamily.replace(/_/g, ' ')}</span>}
                <span className="rounded-full border border-silicon-slate/60 px-2 py-1 text-muted-foreground">
                  {goal.n8nWorkflows.length ? `${goal.n8nWorkflows.length} known workflow(s)` : 'New workflow likely'}
                </span>
                {goal.approvalGate && <span className="rounded-full border border-radiant-gold/35 px-2 py-1 text-radiant-gold">Approval gated</span>}
              </div>
            </div>
            <button
              type="button"
              onClick={onCreateN8nProposal}
              disabled={busy != null}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-radiant-gold/50 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/10 disabled:opacity-50"
            >
              <Workflow size={15} />
              {busy === 'n8n-proposal' ? 'Drafting...' : 'Draft workflow proposal'}
            </button>
          </div>
          {n8nProposal && (
            <div className="mt-3 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-100">
              <p className="font-medium">Created {n8nProposal.title}.</p>
              <Link href="/admin/agents/coordination" className="mt-1 inline-flex text-xs text-radiant-gold hover:underline">
                Review in Decision Queue
              </Link>
            </div>
          )}
        </div>
      )}
      <div className="mt-4 grid gap-2">
        {orderedTasks.slice(0, 5).map((task) => (
          <div key={task.id} className="grid gap-2 rounded-lg border border-silicon-slate/60 bg-background/55 p-3 text-sm sm:grid-cols-[40px_minmax(0,1fr)_auto] sm:items-center">
            <span className="text-xs font-semibold uppercase tracking-wide text-radiant-gold">
              {task.goal?.sequence ? `#${task.goal.sequence}` : 'Task'}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium">{task.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{agentShortName(task.ownerAgentName)} · {task.status.replace(/_/g, ' ')}</p>
            </div>
            {task.activeRunId && (
              <Link href={`/admin/agents/runs/${task.activeRunId}`} className="text-xs text-radiant-gold hover:underline">
                Trace
              </Link>
            )}
          </div>
        ))}
        {!orderedTasks.length && (
          <p className="rounded-lg border border-dashed border-silicon-slate/60 p-3 text-sm text-muted-foreground">
            This goal has no visible Kanban cards yet. Refresh after approval or open the full Kanban board.
          </p>
        )}
      </div>
    </section>
  )
}

function AuditLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="rounded-full border border-radiant-gold/35 bg-radiant-gold/10 px-2 py-1 text-radiant-gold hover:bg-radiant-gold/15">
      {label}
    </Link>
  )
}

function MetricsPanel({ organization }: { organization: AgentOrgBoardSnapshot }) {
  const goals = organization.summary.goals.slice(0, 2)
  const wip = organization.summary.wip.slice(0, 4)
  return (
    <section className="agent-ops-card rounded-lg border p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-radiant-gold">Info radiators</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric label="Active goals" value={organization.summary.active_goals} />
        <Metric label="Blocked" value={organization.summary.blocked_work_items} />
        <Metric label="Waiting on" value={organization.summary.dependencies?.waiting_on ?? 0} />
        <Metric label="Handoffs" value={organization.summary.dependencies?.pending_handoffs ?? 0} />
        <Metric label="Cycle time" value={organization.summary.average_cycle_hours == null ? 'n/a' : `${organization.summary.average_cycle_hours}h`} />
        <Metric label="Oldest WIP" value={organization.summary.oldest_in_flight_hours == null ? 'n/a' : `${organization.summary.oldest_in_flight_hours}h`} />
      </div>
      <div className="mt-4 space-y-3">
        {goals.length ? goals.map((goal) => <GoalProgress key={goal.id} goal={goal} />) : (
          <p className="rounded-lg border border-dashed border-silicon-slate/60 p-3 text-sm text-muted-foreground">No goal-tagged work yet.</p>
        )}
      </div>
      <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">WIP limits</p>
        {wip.map((lane) => (
          <div key={lane.laneKey} className={`rounded-md border px-2 py-1.5 text-xs ${lane.overLimit ? 'border-red-400/45 bg-red-500/10 text-red-100' : 'border-silicon-slate/60 bg-background/40 text-muted-foreground'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">{lane.label}</span>
              <span>{lane.count}/{lane.limit}</span>
            </div>
          </div>
        ))}
      </div>
      <Link href="/admin/agents/swarm-board" className="mt-4 inline-flex items-center gap-2 text-sm text-radiant-gold hover:underline">
        Full metrics
        <ArrowRight size={14} />
      </Link>
    </section>
  )
}

function GoalProgress({ goal }: { goal: AgentOrgBoardGoalMetric }) {
  return (
    <div className="rounded-lg border border-silicon-slate/60 bg-background/50 p-3">
      <p className="line-clamp-1 text-sm font-semibold">{goal.title}</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-silicon-slate/70">
        <div className="h-full bg-radiant-gold" style={{ width: `${goal.progress}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{goal.progress}% complete · {goal.open} open · {goal.blocked} blocked</p>
      {goal.burndown.length > 0 && (
        <div className="mt-3 flex h-12 items-end gap-1" aria-label={`Burndown for ${goal.title}`}>
          {goal.burndown.map((point) => {
            const max = Math.max(...goal.burndown.map((item) => item.remaining), 1)
            return (
              <span
                key={point.label}
                title={`${point.label}: ${point.remaining} remaining`}
                className="flex-1 rounded-t bg-radiant-gold/55"
                style={{ height: `${Math.max(18, (point.remaining / max) * 100)}%` }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function TraceHistory({
  runs,
  commandTraces,
}: {
  runs: AgentOrgBoardSnapshot['warRoom']['recentRuns']
  commandTraces: WarRoomCommandTrace[]
}) {
  const localRuns = commandTraces.map((trace) => ({
    id: trace.runId,
    title: trace.synthesis ?? `${trace.command.replace(/_/g, ' ')} trace`,
    command: trace.command,
    status: 'created',
    startedAt: trace.createdAt,
    summary: trace.synthesis ?? 'Trace was created from this Standup Room session.',
    goalId: trace.goalId ?? null,
  }))
  const mergedRuns = [
    ...localRuns,
    ...runs.filter((run) => !localRuns.some((local) => local.id === run.id)),
  ]
  return (
    <section className="agent-ops-card rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-radiant-gold">Trace history</h2>
        <span className="rounded-full border border-silicon-slate/60 px-2 py-1 text-xs text-muted-foreground">{mergedRuns.length} trace(s)</span>
      </div>
      {mergedRuns.length ? (
        <div className="space-y-2">
          {mergedRuns.slice(0, 5).map((run) => (
            <div key={run.id} className="rounded-lg border border-silicon-slate/60 bg-background/50 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-radiant-gold/35 px-2 py-0.5 text-radiant-gold">{run.command.replace(/_/g, ' ')}</span>
                <span className="rounded-full border border-silicon-slate/60 px-2 py-0.5 text-muted-foreground">{run.status}</span>
                {run.goalId ? <span className="rounded-full border border-silicon-slate/60 px-2 py-0.5 text-muted-foreground">goal {run.goalId}</span> : null}
              </div>
              <p className="mt-2 font-medium">{run.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{run.summary}</p>
              <Link href={`/admin/agents/runs/${run.id}`} className="mt-3 inline-flex text-xs text-radiant-gold hover:underline">
                Open trace
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-silicon-slate/60 p-3 text-sm text-muted-foreground">
          No standup-room traces yet. Start a standup or ask an agent to create the first room trace.
        </p>
      )}
    </section>
  )
}

function MiniKanban({ lanes, focusedGoalId }: { lanes: AgentOrgBoardLane[]; focusedGoalId: string | null }) {
  const scopedLanes = focusedGoalId
    ? lanes.map((lane) => ({
      ...lane,
      tasks: lane.tasks.filter((task) => task.goal?.id === focusedGoalId),
    }))
    : lanes
  const previewLanes = scopedLanes.slice(0, 6)
  const activeLaneCount = scopedLanes.filter((lane) => lane.tasks.length > 0).length
  return (
    <section className="agent-ops-card rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-radiant-gold">{focusedGoalId ? 'Goal Kanban preview' : 'Kanban preview'}</h2>
        <Link href={focusedGoalId ? `/admin/agents/swarm-board?goal=${encodeURIComponent(focusedGoalId)}` : '/admin/agents/swarm-board'} className="text-xs text-radiant-gold hover:underline">Open board</Link>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Fixed lane order · {activeLaneCount} active lane(s). Empty lanes collapse so the board stays scannable.
      </p>
      <div className="space-y-3">
        {previewLanes.map((lane) => (
          <div key={lane.key} className={`rounded-lg border border-silicon-slate/60 bg-background/50 ${lane.tasks.length ? 'p-3' : 'px-3 py-2 opacity-75'}`}>
            <div className={`flex items-center justify-between text-sm ${lane.tasks.length ? 'mb-2' : ''}`}>
              <span className="font-semibold">{lane.label}</span>
              <span className="text-muted-foreground">{lane.tasks.length}</span>
            </div>
            {lane.tasks.length ? (
              <div className="space-y-2">
                {lane.tasks.slice(0, 2).map((task) => <MiniTask key={task.id} task={task} />)}
                {lane.tasks.length > 2 && (
                  <Link href={focusedGoalId ? `/admin/agents/swarm-board?goal=${encodeURIComponent(focusedGoalId)}` : '/admin/agents/swarm-board'} className="inline-flex text-xs text-radiant-gold hover:underline">
                    View {lane.tasks.length - 2} more
                  </Link>
                )}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}

function MiniTask({ task }: { task: AgentOrgBoardTask }) {
  const ageHours = Math.max(0, Math.round((Date.now() - new Date(task.createdAt).getTime()) / 36e5))
  const dependencyIds = task.dependencyIds ?? []
  const dependencies = task.dependencies ?? []
  const pendingHandoffs = (task.handoffs ?? []).filter((handoff) => handoff.status === 'pending')
  const acceptanceCriteria = task.acceptanceCriteria ?? []
  return (
    <div className="rounded-md border border-silicon-slate/50 bg-silicon-slate/15 p-2 text-xs">
      <p className="line-clamp-2 font-medium">{task.title}</p>
      <div className="mt-2 flex flex-wrap gap-1 text-muted-foreground">
        {task.goal && <span className="rounded-full border border-radiant-gold/35 px-2 py-0.5 text-radiant-gold">{task.goal.title}</span>}
        <span>{agentShortName(task.ownerAgentName)}</span>
        <span>{ageHours}h</span>
        <span>{task.status.replace(/_/g, ' ')}</span>
        <span>{task.priority}</span>
        {dependencyIds.length ? <span>{dependencyIds.length} dep.</span> : null}
        {pendingHandoffs.length ? <span>{pendingHandoffs.length} handoff</span> : null}
        {task.prUrl && <GitPullRequest size={12} />}
        {task.activeRunId && (
          <Link href={`/admin/agents/runs/${task.activeRunId}`} className="text-radiant-gold hover:underline">
            Trace
          </Link>
        )}
      </div>
      {task.objective && <p className="mt-1 line-clamp-1 text-muted-foreground">Action: {task.objective}</p>}
      {dependencies.length ? <p className="mt-1 line-clamp-1 text-yellow-100">Waiting on: {dependencies[0].title}</p> : null}
      {task.blockerSummary && <p className="mt-1 line-clamp-1 text-red-200">Blocked: {task.blockerSummary}</p>}
      {task.validationSummary && <p className="mt-1 line-clamp-1 text-muted-foreground">Next: {task.validationSummary}</p>}
      {acceptanceCriteria.length ? <p className="mt-1 line-clamp-1 text-muted-foreground">Done when: {acceptanceCriteria[0]}</p> : null}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-silicon-slate/60 bg-background/50 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  )
}
