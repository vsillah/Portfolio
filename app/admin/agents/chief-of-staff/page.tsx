'use client'

import Link from 'next/link'
import { FormEvent, useMemo, useState } from 'react'
import { ArrowLeft, Bot, ExternalLink, Send, ShieldCheck } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'

type ChiefOfStaffActionProposal = {
  label: string
  description: string
  action: string
  approvalType: string | null
  requiresApproval: boolean
  riskLevel: 'low' | 'medium' | 'high'
}

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  runId?: string
  suggestedActions?: string[]
  actionProposals?: ChiefOfStaffActionProposal[]
}

const STARTER_PROMPTS = [
  'What needs my attention today?',
  'Summarize current agent operations risk.',
  'What should the agent organization do next?',
]

export default function ChiefOfStaffAgentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'I can review the current Agent Operations context, call out blockers, and turn your intent into next actions. I am read-only in this first chat version.',
      suggestedActions: STARTER_PROMPTS,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [creatingApproval, setCreatingApproval] = useState<string | null>(null)
  const [approvalLinks, setApprovalLinks] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const history = useMemo(
    () => messages.filter((message) => message.role === 'user' || message.role === 'assistant').slice(-8),
    [messages],
  )

  async function sendMessage(nextMessage?: string) {
    const message = (nextMessage ?? input).trim()
    if (!message || loading) return

    setInput('')
    setError(null)
    setLoading(true)
    setMessages((current) => [...current, { role: 'user', content: message }])

    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')

      const res = await fetch('/api/admin/agents/chief-of-staff/chat', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, history }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: body.reply,
          runId: body.run_id,
          suggestedActions: Array.isArray(body.suggested_actions) ? body.suggested_actions : [],
          actionProposals: Array.isArray(body.action_proposals) ? body.action_proposals : [],
        },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chief of Staff chat failed')
    } finally {
      setLoading(false)
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    sendMessage()
  }

  async function createApprovalCheckpoint(sourceRunId: string | undefined, proposal: ChiefOfStaffActionProposal) {
    if (!sourceRunId || creatingApproval) return

    const key = `${sourceRunId}:${proposal.action}:${proposal.label}`
    setCreatingApproval(key)
    setError(null)

    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')

      const res = await fetch('/api/admin/agents/chief-of-staff/actions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_run_id: sourceRunId,
          proposal,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)

      setApprovalLinks((current) => ({ ...current, [key]: body.run_id }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create approval checkpoint')
    } finally {
      setCreatingApproval(null)
    }
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-background text-foreground p-6 lg:p-8">
        <div className="mx-auto max-w-5xl">
          <Breadcrumbs
            items={[
              { label: 'Admin Dashboard', href: '/admin' },
              { label: 'Agent Operations', href: '/admin/agents' },
              { label: 'Chief of Staff' },
            ]}
          />

          <Link
            href="/admin/agents"
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} />
            Back to Agent Operations
          </Link>

          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-radiant-gold">
                <Bot size={22} />
                <p className="text-sm font-semibold uppercase tracking-wider">Chief of Staff Agent</p>
              </div>
              <h1 className="text-3xl font-bold">Executive Operations Chat</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Ask for priorities, blockers, run status, approval risk, and next actions across Agent Operations.
              </p>
            </div>
            <Link
              href="/admin/agents/runs"
              className="inline-flex w-fit items-center gap-2 rounded-lg border border-silicon-slate/70 bg-background/60 px-3 py-2 text-sm hover:border-radiant-gold/60"
            >
              Runs
              <ExternalLink size={14} />
            </Link>
          </div>

          <section className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20">
            <div className="max-h-[58vh] min-h-[420px] space-y-4 overflow-y-auto p-4 md:p-5">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[82%] rounded-lg border px-4 py-3 ${
                      message.role === 'user'
                        ? 'border-radiant-gold/40 bg-radiant-gold/10'
                        : 'border-silicon-slate/60 bg-background/60'
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                    {message.runId ? (
                      <Link
                        href={`/admin/agents/runs/${message.runId}`}
                        className="mt-3 inline-flex items-center gap-1 text-xs text-radiant-gold hover:underline"
                      >
                        Open trace
                        <ExternalLink size={12} />
                      </Link>
                    ) : null}
                    {message.suggestedActions?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.suggestedActions.map((action) => (
                          <button
                            key={action}
                            type="button"
                            onClick={() => sendMessage(action)}
                            disabled={loading}
                            className="rounded-md border border-silicon-slate/60 bg-black/10 px-2 py-1 text-xs text-muted-foreground hover:border-radiant-gold/60 hover:text-foreground disabled:opacity-60"
                          >
                            {action}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {message.actionProposals?.length ? (
                      <div className="mt-4 space-y-2">
                        {message.actionProposals.map((proposal) => {
                          const key = `${message.runId}:${proposal.action}:${proposal.label}`
                          const approvalRunId = approvalLinks[key]

                          return (
                            <div
                              key={key}
                              className="rounded-lg border border-silicon-slate/60 bg-black/10 p-3"
                            >
                              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold">{proposal.label}</p>
                                    <span className="rounded-full border border-silicon-slate/60 px-2 py-0.5 text-[11px] uppercase text-muted-foreground">
                                      {proposal.riskLevel}
                                    </span>
                                    {proposal.approvalType ? (
                                      <span className="rounded-full border border-radiant-gold/40 bg-radiant-gold/10 px-2 py-0.5 text-[11px] text-radiant-gold">
                                        {proposal.approvalType}
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                    {proposal.description}
                                  </p>
                                </div>
                                {proposal.requiresApproval ? (
                                  approvalRunId ? (
                                    <Link
                                      href={`/admin/agents/runs/${approvalRunId}`}
                                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200 hover:underline"
                                    >
                                      Approval created
                                      <ExternalLink size={12} />
                                    </Link>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => createApprovalCheckpoint(message.runId, proposal)}
                                      disabled={loading || creatingApproval === key}
                                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-radiant-gold/50 bg-radiant-gold/10 px-2 py-1 text-xs text-radiant-gold hover:bg-radiant-gold/15 disabled:opacity-60"
                                    >
                                      <ShieldCheck size={12} />
                                      Create approval
                                    </button>
                                  )
                                ) : null}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              {loading ? (
                <div className="flex justify-start">
                  <div className="rounded-lg border border-silicon-slate/60 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                    Reviewing Agent Operations context...
                  </div>
                </div>
              ) : null}
            </div>

            <form onSubmit={onSubmit} className="border-t border-silicon-slate/70 p-4 md:p-5">
              {error ? <p className="mb-3 text-sm text-red-300">{error}</p> : null}
              <div className="flex flex-col gap-3 md:flex-row">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask what needs attention, what to run next, or what is blocked..."
                  rows={3}
                  className="min-h-[88px] flex-1 resize-none rounded-lg border border-silicon-slate/70 bg-background/80 px-3 py-2 text-sm outline-none focus:border-radiant-gold/70"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-4 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/15 disabled:opacity-60 md:w-32"
                >
                  <Send size={16} />
                  Send
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </ProtectedRoute>
  )
}
