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
  const [goalDraft, setGoalDraft] = useState<AgentGoalDraft | null>(null)
  const [createdItems, setCreatedItems] = useState<WarRoomResponse['created_work_items']>(null)
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

  const participants = useMemo(() => {
    const agents = organization?.agents ?? []
    return agents.filter((agent) => agent.status !== 'planned').slice(0, 12)
  }, [organization?.agents])
  const selectedAgent = participants.find((agent) => agent.key === selectedAgentKey) ?? participants[0]

  async function postWarRoom(payload: Record<string, unknown>, loadingKey: string) {
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
      if (body.created_work_items) {
        setCreatedItems(body.created_work_items)
        await fetchBoard()
      }
      return body
    } catch (err) {
      setError(err instanceof Error ? err.message : 'War Room command failed')
      return null
    } finally {
      setBusy(null)
    }
  }

  async function startStandup() {
    await postWarRoom({ command: 'standup' }, 'standup')
  }

  async function askAll() {
    if (!message.trim()) return
    const text = message.trim()
    setMessage('')
    await postWarRoom({ command: 'discuss', message: text }, 'ask-all')
  }

  async function askSelectedAgent() {
    if (!message.trim() || !selectedAgent) return
    const text = message.trim()
    setMessage('')
    await postWarRoom({ command: 'ask_agent', message: text, target_agent_key: selectedAgent.key }, 'ask-agent')
  }

  async function draftGoal() {
    if (!goal.trim()) return
    await postWarRoom({ command: 'draft_goal', goal: goal.trim() }, 'draft-goal')
  }

  async function approveGoal() {
    if (!goalDraft) return
    await postWarRoom({ command: 'approve_goal', draft: goalDraft }, 'approve-goal')
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
            <Link href="/admin/agents/swarm-board" className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/50 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/10">
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
              onSelect={(agent) => {
                setSelectedAgentKey(agent.key)
                setMessage((current) => current || `@${agent.name.split(' - ')[0]} `)
              }}
            />
            <main className="space-y-5">
              <ChatRoom
                transcript={transcript}
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
                onGoalChange={setGoal}
                onDraftGoal={draftGoal}
                onApproveGoal={approveGoal}
              />
            </main>
            <aside className="space-y-5">
              <MetricsPanel organization={organization} />
              <MiniKanban lanes={organization.lanes} />
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
  onSelect,
}: {
  participants: AgentOrgBoardAgent[]
  selectedAgentKey: string
  onSelect: (agent: AgentOrgBoardAgent) => void
}) {
  return (
    <aside className="agent-ops-card rounded-lg border p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-radiant-gold">Attendance</h2>
        <span className="rounded-full border border-silicon-slate/60 px-2 py-1 text-xs text-muted-foreground">{participants.length}</span>
      </div>
      <div className="space-y-2">
        {participants.map((agent) => (
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
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{agent.name.split(' - ')[0]}</span>
              <span className="block truncate text-xs text-muted-foreground">{agent.podName}</span>
            </span>
            <span aria-hidden="true" className={`ml-auto h-2 w-2 rounded-full ${agent.live ? 'bg-green-400' : 'bg-silicon-slate'}`} />
          </button>
        ))}
      </div>
    </aside>
  )
}

function ChatRoom({
  transcript,
  message,
  selectedAgent,
  busy,
  onMessageChange,
  onAskAll,
  onAskAgent,
  onQuickPrompt,
}: {
  transcript: AgentWarRoomMessage[]
  message: string
  selectedAgent?: AgentOrgBoardAgent
  busy: string | null
  onMessageChange: (value: string) => void
  onAskAll: () => void
  onAskAgent: () => void
  onQuickPrompt: (value: string) => void
}) {
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
            Target: {selectedAgent.name.split(' - ')[0]}
          </div>
        )}
      </div>

      <div className="max-h-[360px] space-y-3 overflow-y-auto rounded-lg border border-silicon-slate/60 bg-background/50 p-3">
        {transcript.map((entry) => (
          <div key={entry.id} className={`flex gap-3 ${entry.role === 'user' ? 'justify-end' : ''}`}>
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
  onGoalChange,
  onDraftGoal,
  onApproveGoal,
}: {
  goal: string
  goalDraft: AgentGoalDraft | null
  createdItems: WarRoomResponse['created_work_items']
  busy: string | null
  onGoalChange: (value: string) => void
  onDraftGoal: () => void
  onApproveGoal: () => void
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
            <button onClick={onApproveGoal} disabled={busy != null} className="inline-flex items-center justify-center gap-2 rounded-lg bg-radiant-gold px-4 py-2 text-sm font-semibold text-obsidian hover:bg-radiant-gold/90 disabled:opacity-50">
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
                    <p className="font-semibold">{task.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{task.objective}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-silicon-slate/60 px-2 py-1">Owner: {task.owner_agent_key}</span>
                      <span className="rounded-full border border-silicon-slate/60 px-2 py-1">Priority: {task.priority}</span>
                      <span className="rounded-full border border-silicon-slate/60 px-2 py-1">Weight: {task.goal_progress_weight}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {createdItems && (
        <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-100">
          Created {createdItems.children.length} child work item(s) under {createdItems.parent.title}.
        </div>
      )}
    </section>
  )
}

function MetricsPanel({ organization }: { organization: AgentOrgBoardSnapshot }) {
  const goals = organization.summary.goals.slice(0, 2)
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
    </div>
  )
}

function MiniKanban({ lanes }: { lanes: AgentOrgBoardLane[] }) {
  const visible = lanes.filter((lane) => lane.tasks.length > 0).slice(0, 3)
  return (
    <section className="agent-ops-card rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-radiant-gold">Kanban preview</h2>
        <Link href="/admin/agents/swarm-board" className="text-xs text-radiant-gold hover:underline">Open board</Link>
      </div>
      <div className="space-y-3">
        {(visible.length ? visible : lanes.slice(0, 3)).map((lane) => (
          <div key={lane.key} className="rounded-lg border border-silicon-slate/60 bg-background/50 p-3">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold">{lane.label}</span>
              <span className="text-muted-foreground">{lane.tasks.length}</span>
            </div>
            <div className="space-y-2">
              {lane.tasks.slice(0, 2).map((task) => <MiniTask key={task.id} task={task} />)}
              {!lane.tasks.length && <p className="text-xs text-muted-foreground">No active cards.</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function MiniTask({ task }: { task: AgentOrgBoardTask }) {
  return (
    <div className="rounded-md border border-silicon-slate/50 bg-silicon-slate/15 p-2 text-xs">
      <p className="line-clamp-2 font-medium">{task.title}</p>
      <div className="mt-2 flex flex-wrap gap-1 text-muted-foreground">
        {task.goal && <span className="rounded-full border border-radiant-gold/35 px-2 py-0.5 text-radiant-gold">{task.goal.title}</span>}
        <span>{task.status.replace(/_/g, ' ')}</span>
        {task.prUrl && <GitPullRequest size={12} />}
      </div>
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
