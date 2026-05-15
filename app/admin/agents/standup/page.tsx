'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  GitPullRequest,
  KanbanSquare,
  MessageSquare,
  Play,
  Send,
  Sparkles,
  Trash2,
  Users,
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
  const [selectedAgentKey, setSelectedAgentKey] = useState('chief-of-staff')
  const [message, setMessage] = useState('')
  const [goal, setGoal] = useState('')
  const [focusedGoalId, setFocusedGoalId] = useState<string | null>(null)
  const [goalDraft, setGoalDraft] = useState<AgentGoalDraft | null>(null)
  const [createdItems, setCreatedItems] = useState<WarRoomResponse['created_work_items']>(null)
  const [commandTraces, setCommandTraces] = useState<WarRoomCommandTrace[]>([])
  const [standupQuestions, setStandupQuestions] = useState<StandupQuestion[]>([])
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
  const selectedAgent = participants.find((agent) => agent.key === selectedAgentKey) ?? participants[0]
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
        asked: standupQuestions.some((question) => question.targetAgentKey === agent.key || question.targetAgentKey === null),
        responded: responses.length > 0,
        messageCount: responses.length,
        lastResponseAt: responses.at(-1)?.created_at ?? null,
      })
    }
    return session
  }, [participants, standupQuestions, transcript])

  function focusGoal(goalId: string | null) {
    setFocusedGoalId(goalId)
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
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const response = await fetch('/api/admin/agents/war-room', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => ({})) as WarRoomResponse
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
      if (body.messages?.length) setTranscript((current) => [...current, ...body.messages!])
      if (body.goal_draft) setGoalDraft(body.goal_draft)
      if (body.run_id) {
        setCommandTraces((current) => [{
          runId: body.run_id,
          command: body.command,
          synthesis: body.synthesis,
          goalId: body.goal_draft?.goal_id ?? (payload.draft as AgentGoalDraft | undefined)?.goal_id ?? null,
          createdAt: new Date().toISOString(),
        }, ...current].slice(0, 5))
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
    const questionId = addQuestion({
      command: 'standup',
      prompt: 'Start standup and ask every available agent for current posture.',
      targetLabel: 'All available agents',
      targetAgentKey: null,
    })
    await postWarRoom({ command: 'standup' }, 'standup', questionId)
  }

  async function askAll() {
    if (!message.trim()) return
    const text = message.trim()
    const mentionedAgent = findMentionedAgent(text, participants)
    setMessage('')
    if (mentionedAgent) {
      setSelectedAgentKey(mentionedAgent.key)
      const questionId = addQuestion({
        command: 'ask_agent',
        prompt: text,
        targetLabel: agentShortName(mentionedAgent.name),
        targetAgentKey: mentionedAgent.key,
      })
      await postWarRoom({ command: 'ask_agent', message: text, target_agent_key: mentionedAgent.key }, 'ask-agent', questionId)
      return
    }
    const questionId = addQuestion({
      command: 'discuss',
      prompt: text,
      targetLabel: 'All relevant agents',
      targetAgentKey: null,
    })
    await postWarRoom({ command: 'discuss', message: text }, 'ask-all', questionId)
  }

  async function askSelectedAgent() {
    if (!message.trim() || !selectedAgent) return
    const text = message.trim()
    setMessage('')
    const questionId = addQuestion({
      command: 'ask_agent',
      prompt: text,
      targetLabel: agentShortName(selectedAgent.name),
      targetAgentKey: selectedAgent.key,
    })
    await postWarRoom({ command: 'ask_agent', message: text, target_agent_key: selectedAgent.key }, 'ask-agent', questionId)
  }

  async function draftGoal() {
    if (!goal.trim()) return
    await postWarRoom({ command: 'draft_goal', goal: goal.trim() }, 'draft-goal')
  }

  async function approveGoal() {
    if (!goalDraft) return
    const approvedGoalId = goalDraft.goal_id
    const result = await postWarRoom({ command: 'approve_goal', draft: goalDraft }, 'approve-goal')
    if (result?.created_work_items) focusGoal(approvedGoalId)
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

        <header className="mt-5 flex flex-col gap-4 rounded-xl border border-radiant-gold/25 bg-silicon-slate/20 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-radiant-gold">
              <Users size={15} />
              Agent Ops
            </div>
            <h1 className="text-3xl font-bold">Standup Room</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Ask Shaka or the swarm directly, inspect the active board, and turn goals into review-gated Agent Ops work items.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={focusedGoalId ? `/admin/agents/swarm-board?goal=${encodeURIComponent(focusedGoalId)}` : '/admin/agents/swarm-board'} className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/50 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/10">
              <KanbanSquare size={16} />
              Open full Kanban
            </Link>
            <button onClick={startStandup} disabled={busy != null} className="inline-flex items-center gap-2 rounded-lg bg-radiant-gold px-3 py-2 text-sm font-semibold text-obsidian hover:bg-radiant-gold/90 disabled:opacity-60">
              <Play size={16} />
              Start standup
            </button>
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
              selectedAgentKey={selectedAgent?.key ?? selectedAgentKey}
              session={participantSession}
              onSelect={(agent) => {
                setSelectedAgentKey(agent.key)
                setMessage((current) => current || `@${agentShortName(agent.name)} `)
              }}
            />
            <main className="space-y-5">
              {focusedGoal && (
                <GoalSessionPanel
                  goal={focusedGoal}
                  tasks={focusedGoalTasks}
                  onClear={() => focusGoal(null)}
                />
              )}
              <ChatRoom
                transcript={transcript}
                questions={standupQuestions}
                commandTraces={commandTraces}
                message={message}
                onMessageChange={setMessage}
                selectedAgent={selectedAgent}
                busy={busy}
                onAskAll={askAll}
                onAskAgent={askSelectedAgent}
                onQuickPrompt={setMessage}
              />
              <GoalPlanner
                goal={goal}
                goalDraft={goalDraft}
                createdItems={createdItems}
                busy={busy}
                participants={participants}
                onGoalChange={setGoal}
                onDraftGoal={draftGoal}
                onApproveGoal={approveGoal}
                onUpdateTask={updateGoalTask}
                onRemoveTask={removeGoalTask}
              />
            </main>
            <aside className="space-y-5">
              <MetricsPanel organization={organization} />
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
  selectedAgentKey,
  session,
  onSelect,
}: {
  participants: AgentOrgBoardAgent[]
  selectedAgentKey: string
  session: Map<string, ParticipantSessionState>
  onSelect: (agent: AgentOrgBoardAgent) => void
}) {
  return (
    <aside className="agent-ops-card rounded-lg border p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-radiant-gold">Attendance</h2>
        <span className="rounded-full border border-silicon-slate/60 px-2 py-1 text-xs text-muted-foreground">{participants.length}</span>
      </div>
      <div className="space-y-2">
        {participants.map((agent) => {
          const state = session.get(agent.key)
          const statusLabel = state?.responded ? 'Responded' : state?.asked ? 'Asked' : agent.live ? 'Available' : 'Idle'
          return (
            <button
              key={agent.key}
              type="button"
              onClick={() => onSelect(agent)}
              aria-pressed={selectedAgentKey === agent.key}
              className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition ${
                selectedAgentKey === agent.key
                  ? 'border-radiant-gold/60 bg-radiant-gold/10'
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
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${state?.responded ? 'bg-radiant-gold' : agent.live ? 'bg-green-400' : 'bg-silicon-slate'}`} />
            </button>
          )
        })}
      </div>
    </aside>
  )
}

function ChatRoom({
  transcript,
  questions,
  commandTraces,
  message,
  selectedAgent,
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
  selectedAgent?: AgentOrgBoardAgent
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
          <p className="mt-1 text-sm text-muted-foreground">Use @agent targeting or select a participant from attendance.</p>
        </div>
        {selectedAgent && (
          <div className="flex items-center gap-2 rounded-full border border-silicon-slate/60 px-3 py-1 text-xs text-muted-foreground">
            <AgentAvatar agentKey={selectedAgent.key} size="sm" />
            Target: {agentShortName(selectedAgent.name)}
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
          className="min-h-11 flex-1 rounded-lg border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm outline-none focus:border-radiant-gold/70"
          placeholder="Ask about blockers, owners, risk, next steps, or @Shaka for a direct update..."
        />
        <button onClick={onAskAll} disabled={busy != null || !message.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-radiant-gold/50 px-4 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/10 disabled:opacity-50">
          <Send size={16} />
          Ask all
        </button>
        <button onClick={onAskAgent} disabled={busy != null || !message.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-radiant-gold px-4 py-2 text-sm font-semibold text-obsidian hover:bg-radiant-gold/90 disabled:opacity-50">
          <Send size={16} />
          Ask agent
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
  goalDraft,
  createdItems,
  busy,
  participants,
  onGoalChange,
  onDraftGoal,
  onApproveGoal,
  onUpdateTask,
  onRemoveTask,
}: {
  goal: string
  goalDraft: AgentGoalDraft | null
  createdItems: WarRoomResponse['created_work_items']
  busy: string | null
  participants: AgentOrgBoardAgent[]
  onGoalChange: (value: string) => void
  onDraftGoal: () => void
  onApproveGoal: () => void
  onUpdateTask: (taskId: string, patch: Partial<AgentGoalDraft['tasks'][number]>) => void
  onRemoveTask: (taskId: string) => void
}) {
  return (
    <section className="agent-ops-card rounded-lg border p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles size={18} className="text-radiant-gold" />
        <h2 className="text-xl font-semibold">Goal planner</h2>
      </div>
      <div className="flex flex-col gap-2 lg:flex-row">
        <input
          value={goal}
          onChange={(event) => onGoalChange(event.target.value)}
          className="min-h-11 flex-1 rounded-lg border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm outline-none focus:border-radiant-gold/70"
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
            </div>
            <button onClick={onApproveGoal} disabled={busy != null || goalDraft.tasks.length === 0} className="inline-flex items-center justify-center gap-2 rounded-lg bg-radiant-gold px-4 py-2 text-sm font-semibold text-obsidian hover:bg-radiant-gold/90 disabled:opacity-50">
              <CheckCircle2 size={16} />
              Approve goal
            </button>
          </div>
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
                  </div>
                </div>
              </div>
            ))}
            {!goalDraft.tasks.length && (
              <div className="rounded-lg border border-dashed border-silicon-slate/60 p-4 text-sm text-muted-foreground">
                No tasks are selected for creation. Draft the goal again or keep at least one task before approving.
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

function GoalSessionPanel({
  goal,
  tasks,
  onClear,
}: {
  goal: AgentOrgBoardGoalMetric
  tasks: AgentOrgBoardTask[]
  onClear: () => void
}) {
  const orderedTasks = [...tasks].sort((a, b) => (a.goal?.sequence ?? 999) - (b.goal?.sequence ?? 999))
  return (
    <section className="agent-ops-card rounded-lg border border-radiant-gold/35 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-radiant-gold">Goal session</p>
          <h2 className="mt-1 text-xl font-semibold">{goal.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {goal.completed}/{goal.total} complete · {goal.open} open · {goal.blocked} blocked
          </p>
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

function MetricsPanel({ organization }: { organization: AgentOrgBoardSnapshot }) {
  const goals = organization.summary.goals.slice(0, 2)
  const wip = organization.summary.wip.slice(0, 4)
  return (
    <section className="agent-ops-card rounded-lg border p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-radiant-gold">Info radiators</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric label="Active goals" value={organization.summary.active_goals} />
        <Metric label="Blocked" value={organization.summary.blocked_work_items} />
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
  return (
    <div className="rounded-md border border-silicon-slate/50 bg-silicon-slate/15 p-2 text-xs">
      <p className="line-clamp-2 font-medium">{task.title}</p>
      <div className="mt-2 flex flex-wrap gap-1 text-muted-foreground">
        {task.goal && <span className="rounded-full border border-radiant-gold/35 px-2 py-0.5 text-radiant-gold">{task.goal.title}</span>}
        <span>{agentShortName(task.ownerAgentName)}</span>
        <span>{ageHours}h</span>
        <span>{task.status.replace(/_/g, ' ')}</span>
        {task.prUrl && <GitPullRequest size={12} />}
        {task.activeRunId && (
          <Link href={`/admin/agents/runs/${task.activeRunId}`} className="text-radiant-gold hover:underline">
            Trace
          </Link>
        )}
      </div>
      {task.blockerSummary && <p className="mt-1 line-clamp-1 text-red-200">Blocked: {task.blockerSummary}</p>}
      {task.validationSummary && <p className="mt-1 line-clamp-1 text-muted-foreground">Next: {task.validationSummary}</p>}
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
