'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock,
  Loader2,
  MinusCircle,
  RotateCw,
  Search,
  SkipForward,
  Square,
  CheckSquare,
  Wand2,
  X,
} from 'lucide-react'

type ReviewStatus = 'pending' | 'reviewed' | 'unsure' | 'skipped'

type SuggestedLabels = {
  scheduling_intent: boolean
  ooo: boolean
  not_interested: boolean
  interested: boolean
  needs_followup: boolean
}

type QueueItem = {
  source_id: string
  source_hash: string
  reply_hash: string
  channel: string | null
  replied_at: string | null
  outreach_status: string | null
  sequence_step: number | null
  redacted_reply: string
  suggested_labels: SuggestedLabels
  review_status: ReviewStatus
  human_scheduling_intent: boolean | null
  notes: string
  reviewed_at: string | null
  existing_review_id: string | null
}

type QueueResponse = {
  available: boolean
  items: QueueItem[]
  summary: {
    target: number
    total_real_replies: number
    reviewed_real: number
    pending: number
    unsure: number
    skipped: number
    remaining_to_gate: number
  }
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  schema?: {
    reviews_table_available: boolean
  }
  reason?: string
}

const STATUS_OPTIONS: Array<{ label: string; value: ReviewStatus | 'all' }> = [
  { label: 'Pending', value: 'pending' },
  { label: 'Reviewed', value: 'reviewed' },
  { label: 'Unsure', value: 'unsure' },
  { label: 'Skipped', value: 'skipped' },
  { label: 'All', value: 'all' },
]

const DECISION_OPTIONS = [
  { label: 'Yes', value: true, icon: Check },
  { label: 'No', value: false, icon: X },
] as const

function formatDate(value: string | null) {
  if (!value) return 'No reply timestamp'
  try {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function labelClass(active: boolean) {
  return active
    ? 'border-radiant-gold/40 bg-radiant-gold/15 text-radiant-gold'
    : 'border-radiant-gold/10 bg-silicon-slate/20 text-muted-foreground'
}

export default function ReplyIntentReviewPage() {
  return (
    <ProtectedRoute requireAdmin>
      <ReplyIntentReviewContent />
    </ProtectedRoute>
  )
}

function ReplyIntentReviewContent() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [summary, setSummary] = useState<QueueResponse['summary'] | null>(null)
  const [pagination, setPagination] = useState<QueueResponse['pagination'] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [status, setStatus] = useState<ReviewStatus | 'all'>('pending')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [schemaReady, setSchemaReady] = useState(true)
  const [selectedForBulk, setSelectedForBulk] = useState<Set<string>>(new Set())
  const [draftIntent, setDraftIntent] = useState<boolean | null>(null)
  const [draftUnsure, setDraftUnsure] = useState(false)
  const [draftNotes, setDraftNotes] = useState('')

  const selectedItem = useMemo(
    () => items.find((item) => item.source_id === selectedId) ?? items[0] ?? null,
    [items, selectedId]
  )

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const session = await getCurrentSession()
      const params = new URLSearchParams({
        status,
        page: String(page),
        limit: '30',
      })
      if (search.trim()) params.set('search', search.trim())

      const response = await fetch(`/api/admin/model-ops/reply-intent-reviews?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      })
      const data = (await response.json()) as QueueResponse | { error?: string }

      if (!response.ok) {
        throw new Error('error' in data && data.error ? data.error : 'Failed to load reply-intent queue')
      }

      const queue = data as QueueResponse
      setItems(queue.items)
      setSummary(queue.summary)
      setPagination(queue.pagination)
      setSchemaReady(Boolean(queue.schema?.reviews_table_available ?? true))
      setSelectedId((current) => (queue.items.some((item) => item.source_id === current) ? current : queue.items[0]?.source_id ?? null))
      setSelectedForBulk((current) => new Set([...current].filter((id) => queue.items.some((item) => item.source_id === id))))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load reply-intent queue')
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  useEffect(() => {
    if (!selectedItem) {
      setDraftIntent(null)
      setDraftUnsure(false)
      setDraftNotes('')
      return
    }
    setDraftIntent(selectedItem.human_scheduling_intent)
    setDraftUnsure(selectedItem.review_status === 'unsure')
    setDraftNotes(selectedItem.notes || '')
  }, [selectedItem])

  const saveReview = useCallback(
    async (reviewStatus: ReviewStatus, schedulingIntent: boolean | null = draftIntent) => {
      if (!selectedItem) return
      setSaving(true)
      setError(null)
      try {
        const session = await getCurrentSession()
        const response = await fetch('/api/admin/model-ops/reply-intent-reviews', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source_id: selectedItem.source_id,
            review_status: reviewStatus,
            human_scheduling_intent: schedulingIntent,
            notes: draftNotes,
          }),
        })

        const body = await response.json()
        if (!response.ok) {
          throw new Error(body?.error || 'Failed to save reply-intent review')
        }

        await fetchQueue()
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Failed to save reply-intent review')
      } finally {
        setSaving(false)
      }
    },
    [draftIntent, draftNotes, fetchQueue, selectedItem]
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.tagName === 'TEXTAREA' || target?.tagName === 'INPUT') return
      if (!selectedItem || saving) return

      if (event.key.toLowerCase() === 'y') {
        event.preventDefault()
        setDraftIntent(true)
        setDraftUnsure(false)
      } else if (event.key.toLowerCase() === 'n') {
        event.preventDefault()
        setDraftIntent(false)
        setDraftUnsure(false)
      } else if (event.key.toLowerCase() === 'u') {
        event.preventDefault()
        setDraftIntent(null)
        setDraftUnsure(true)
      } else if (event.key === 'Enter' && (draftUnsure || typeof draftIntent === 'boolean')) {
        event.preventDefault()
        saveReview(draftUnsure ? 'unsure' : 'reviewed', draftUnsure ? null : draftIntent)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [draftIntent, draftUnsure, saveReview, saving, selectedItem])

  const progressPercent = summary ? Math.min(100, Math.round((summary.reviewed_real / summary.target) * 100)) : 0

  const toggleBulkSelection = (sourceId: string) => {
    setSelectedForBulk((current) => {
      const next = new Set(current)
      if (next.has(sourceId)) next.delete(sourceId)
      else next.add(sourceId)
      return next
    })
  }

  const bulkAcceptSuggested = async () => {
    if (selectedForBulk.size === 0) return
    setBulkSaving(true)
    setError(null)
    try {
      const session = await getCurrentSession()
      const response = await fetch('/api/admin/model-ops/reply-intent-reviews/bulk', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'accept_suggested',
          source_ids: [...selectedForBulk],
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error || 'Failed to apply bulk review')
      setSelectedForBulk(new Set())
      await fetchQueue()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to apply bulk review')
    } finally {
      setBulkSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-radiant-gold/10 px-5 py-4">
        <Breadcrumbs
          items={[
            { label: 'Model Ops', href: '/admin/model-ops/reply-intent-review' },
            { label: 'Reply Intent Review' },
          ]}
        />
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-radiant-gold">Model Ops</p>
            <h1 className="font-heading text-2xl text-foreground">Reply Intent Review</h1>
          </div>
          <div className="grid min-w-[300px] gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Reviewed real examples</span>
              <span className="font-mono text-radiant-gold">
                {summary?.reviewed_real ?? 0}/{summary?.target ?? 200}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-silicon-slate/40">
              <div className="h-full bg-radiant-gold transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-4 flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-950/20 px-3 py-2 text-sm text-red-100">
          <AlertTriangle size={16} className="text-red-300" />
          {error}
        </div>
      )}

      {!schemaReady && (
        <div className="mx-5 mt-4 flex items-center gap-2 rounded-lg border border-radiant-gold/25 bg-radiant-gold/10 px-3 py-2 text-sm text-radiant-gold">
          <AlertTriangle size={16} />
          Review storage is pending migration. The queue can load, but saves require the new Model Ops table.
        </div>
      )}

      <div className="grid min-h-[calc(100vh-145px)] grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)_340px]">
        <aside className="border-r border-radiant-gold/10">
          <div className="space-y-3 border-b border-radiant-gold/10 p-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-2.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                className="w-full rounded-lg border border-radiant-gold/10 bg-silicon-slate/20 py-2 pl-9 pr-3 text-sm outline-none focus:border-radiant-gold/45"
                placeholder="Search reviewed text"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setStatus(option.value)
                    setPage(1)
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${labelClass(status === option.value)}`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={fetchQueue}
              className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/10 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-radiant-gold/30 hover:text-foreground"
            >
              <RotateCw size={14} />
              Refresh
            </button>
          </div>

          <div className="flex items-center justify-between border-b border-radiant-gold/10 px-4 py-3 text-sm">
            <span className="text-muted-foreground">{pagination?.total ?? 0} rows</span>
            <button
              type="button"
              disabled={selectedForBulk.size === 0 || bulkSaving}
              onClick={bulkAcceptSuggested}
              className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/20 px-3 py-1.5 text-radiant-gold disabled:cursor-not-allowed disabled:opacity-45"
            >
              {bulkSaving ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              Accept {selectedForBulk.size || ''}
            </button>
          </div>

          <div className="max-h-[calc(100vh-320px)] overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-radiant-gold" />
              </div>
            ) : items.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">No replies match this view.</div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => {
                  const active = selectedItem?.source_id === item.source_id
                  const checked = selectedForBulk.has(item.source_id)
                  return (
                    <div
                      key={item.source_id}
                      className={`rounded-lg border p-3 transition-colors ${
                        active
                          ? 'border-radiant-gold/40 bg-radiant-gold/10'
                          : 'border-radiant-gold/10 bg-silicon-slate/10 hover:border-radiant-gold/25'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => toggleBulkSelection(item.source_id)}
                          className="mt-0.5 text-radiant-gold"
                          aria-label={checked ? 'Remove from bulk selection' : 'Add to bulk selection'}
                        >
                          {checked ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                        <button type="button" onClick={() => setSelectedId(item.source_id)} className="min-w-0 flex-1 text-left">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs text-muted-foreground">{item.source_hash}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] ${labelClass(item.review_status === 'reviewed')}`}>
                              {item.review_status}
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-3 text-sm text-foreground/88">{item.redacted_reply}</p>
                          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock size={12} />
                            <span>{formatDate(item.replied_at)}</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-radiant-gold/10 p-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-lg border border-radiant-gold/10 p-2 disabled:opacity-35"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-muted-foreground">
              Page {pagination?.page ?? page} of {pagination?.totalPages || 1}
            </span>
            <button
              type="button"
              disabled={!pagination || page >= pagination.totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border border-radiant-gold/10 p-2 disabled:opacity-35"
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </aside>

        <main className="min-w-0 border-r border-radiant-gold/10 p-5">
          {selectedItem ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-radiant-gold/15 bg-silicon-slate/20 px-2 py-1 text-muted-foreground">
                  {selectedItem.channel || 'unknown channel'}
                </span>
                <span className="rounded-full border border-radiant-gold/15 bg-silicon-slate/20 px-2 py-1 text-muted-foreground">
                  {selectedItem.outreach_status || 'unknown status'}
                </span>
                <span className="rounded-full border border-radiant-gold/15 bg-silicon-slate/20 px-2 py-1 text-muted-foreground">
                  Step {selectedItem.sequence_step ?? '-'}
                </span>
              </div>

              <div>
                <h2 className="font-heading text-lg text-foreground">Redacted Reply</h2>
                <p className="mt-1 text-sm text-muted-foreground">{formatDate(selectedItem.replied_at)}</p>
              </div>

              <div className="min-h-[220px] rounded-lg border border-radiant-gold/10 bg-silicon-slate/15 p-5 text-base leading-7 text-foreground/90">
                {selectedItem.redacted_reply}
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-radiant-gold">Signals</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(selectedItem.suggested_labels).map(([key, value]) => (
                    <span key={key} className={`rounded-full border px-3 py-1 text-xs ${labelClass(value)}`}>
                      {key.replaceAll('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Select a reply.</div>
          )}
        </main>

        <section className="p-5">
          <div className="space-y-5">
            <div>
              <h2 className="font-heading text-lg text-foreground">Scheduling Intent</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Decide whether the reply is trying to book, move, or confirm a meeting.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {DECISION_OPTIONS.map(({ label, value, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  disabled={!selectedItem || saving}
                  onClick={() => {
                    setDraftIntent(value)
                    setDraftUnsure(false)
                  }}
                  className={`flex min-h-14 items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition-colors ${
                    draftIntent === value && !draftUnsure
                      ? 'border-radiant-gold/45 bg-radiant-gold/15 text-radiant-gold'
                      : 'border-radiant-gold/10 bg-silicon-slate/20 text-foreground/85 hover:border-radiant-gold/30'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={!selectedItem || saving}
              onClick={() => {
                setDraftUnsure(true)
                setDraftIntent(null)
              }}
              className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition-colors ${
                draftUnsure
                  ? 'border-radiant-gold/45 bg-radiant-gold/15 text-radiant-gold'
                  : 'border-radiant-gold/10 bg-silicon-slate/20 text-foreground/85 hover:border-radiant-gold/30'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <CircleDot size={16} />
              Unsure
            </button>

            <textarea
              value={draftNotes}
              onChange={(event) => setDraftNotes(event.target.value)}
              className="min-h-[120px] w-full rounded-lg border border-radiant-gold/10 bg-silicon-slate/20 p-3 text-sm outline-none focus:border-radiant-gold/45"
              placeholder="Review notes"
            />

            <div className="grid gap-2">
              <button
                type="button"
                disabled={!selectedItem || saving || (!draftUnsure && typeof draftIntent !== 'boolean')}
                onClick={() => saveReview(draftUnsure ? 'unsure' : 'reviewed', draftUnsure ? null : draftIntent)}
                className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-radiant-gold px-4 py-2 text-sm font-semibold text-imperial-navy disabled:cursor-not-allowed disabled:opacity-45"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Save
              </button>
              <button
                type="button"
                disabled={!selectedItem || saving}
                onClick={() => saveReview('skipped', null)}
                className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-radiant-gold/10 bg-silicon-slate/20 px-4 py-2 text-sm text-foreground/85 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <SkipForward size={16} />
                Skip
              </button>
            </div>

            <div className="grid gap-2 rounded-lg border border-radiant-gold/10 bg-silicon-slate/15 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pending</span>
                <span className="font-mono">{summary?.pending ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Unsure</span>
                <span className="font-mono">{summary?.unsure ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Skipped</span>
                <span className="font-mono">{summary?.skipped ?? 0}</span>
              </div>
              <div className="flex items-center justify-between border-t border-radiant-gold/10 pt-2">
                <span className="text-muted-foreground">Gate gap</span>
                <span className="font-mono text-radiant-gold">{summary?.remaining_to_gate ?? 0}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setDraftIntent(selectedItem?.suggested_labels.scheduling_intent ?? null)
                setDraftUnsure(false)
              }}
              disabled={!selectedItem || saving}
              className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-radiant-gold/10 text-sm text-muted-foreground transition-colors hover:border-radiant-gold/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
            >
              <MinusCircle size={16} />
              Use suggestion
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
