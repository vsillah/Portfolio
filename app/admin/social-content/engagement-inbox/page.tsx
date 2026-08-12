'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Filter,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import { PLATFORMS, type SocialPlatform } from '@/lib/social-content'
import {
  SOCIAL_COMMENT_STATUSES,
  type SocialCommentInboxItem,
  type SocialCommentInboxSummary,
  type SocialCommentStatus,
} from '@/lib/social-comment-inbox-ui'

type FilterState = {
  status: SocialCommentStatus | 'all'
  platform: SocialPlatform | 'all'
  campaign: string
  post: string
}

type InboxUnavailableState = {
  message: string
  recovery: string
}

type FocusRecoveryState = {
  commentId: string
  message: string
}

const EMPTY_SUMMARY: SocialCommentInboxSummary = {
  total: 0,
  new: 0,
  needs_qa: 0,
  auto_send_pending: 0,
  lead: 0,
  escalated: 0,
  responded: 0,
  ignored: 0,
}

const STATUS_CLASS: Record<SocialCommentStatus, string> = {
  new: 'border-blue-500/35 bg-blue-500/10 text-blue-100',
  needs_qa: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
  auto_send_pending: 'border-cyan-500/35 bg-cyan-500/10 text-cyan-100',
  lead: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100',
  escalated: 'border-red-500/40 bg-red-500/10 text-red-100',
  responded: 'border-green-500/35 bg-green-500/10 text-green-100',
  ignored: 'border-gray-600 bg-gray-800/70 text-gray-300',
}

const PRIORITY_CLASS: Record<SocialCommentInboxItem['classification']['priority'], string> = {
  low: 'text-gray-400',
  medium: 'text-amber-200',
  high: 'text-red-200',
}

function queryParams() {
  if (typeof window === 'undefined') return new URLSearchParams()
  return new URLSearchParams(window.location.search)
}

function initialFilters(): FilterState {
  const params = queryParams()
  const status = params.get('status')?.replace(/-/g, '_') as FilterState['status'] | null
  const platform = params.get('platform') as FilterState['platform'] | null

  return {
    status: status && (status === 'all' || SOCIAL_COMMENT_STATUSES.some((item) => item.value === status)) ? status : 'all',
    platform: platform && (platform === 'all' || PLATFORMS.some((item) => item.value === platform)) ? platform : 'all',
    campaign: params.get('campaign') || '',
    post: params.get('post') || '',
  }
}

function initialFocusedCommentId() {
  return queryParams().get('comment') || null
}

function statusLabel(status: SocialCommentStatus) {
  return SOCIAL_COMMENT_STATUSES.find((item) => item.value === status)?.label ?? status
}

function platformLabel(platform: SocialPlatform) {
  return PLATFORMS.find((item) => item.value === platform)?.label ?? platform
}

function canSubmit(comment: SocialCommentInboxItem) {
  return comment.approvalState === 'approved'
    && comment.providerCapability.automaticReply
    && comment.providerCapability.verified
    && comment.providerCapability.humanGateSatisfied
}

export default function SocialCommentInboxPage() {
  const commentRefs = useRef<Record<string, HTMLElement | null>>({})
  const [filters, setFilters] = useState<FilterState>(() => initialFilters())
  const [focusedCommentId, setFocusedCommentId] = useState<string | null>(() => initialFocusedCommentId())
  const [focusRecovery, setFocusRecovery] = useState<FocusRecoveryState | null>(null)
  const [comments, setComments] = useState<SocialCommentInboxItem[]>([])
  const [summary, setSummary] = useState<SocialCommentInboxSummary>(EMPTY_SUMMARY)
  const [filteredSummary, setFilteredSummary] = useState<SocialCommentInboxSummary>(EMPTY_SUMMARY)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [unavailable, setUnavailable] = useState<InboxUnavailableState | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const setOrDelete = (key: string, value: string, emptyValue = '') => {
      if (value && value !== emptyValue) params.set(key, value)
      else params.delete(key)
    }

    setOrDelete('status', filters.status, 'all')
    setOrDelete('platform', filters.platform, 'all')
    setOrDelete('campaign', filters.campaign.trim())
    setOrDelete('post', filters.post.trim())
    setOrDelete('comment', focusedCommentId ?? '')

    const nextQuery = params.toString()
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, '', nextUrl)
    }
  }, [filters, focusedCommentId])

  const fetchComments = useCallback(async () => {
    setLoading(true)
    setUnavailable(null)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const params = new URLSearchParams()
      params.set('status', filters.status)
      params.set('platform', filters.platform)
      if (filters.campaign.trim()) params.set('campaign', filters.campaign.trim())
      if (filters.post.trim()) params.set('post', filters.post.trim())

      const response = await fetch(`/api/admin/social-content/engagement/comments?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to load comment inbox')
      setUnavailable(data.unavailable ? {
        message: typeof data.message === 'string' ? data.message : 'Comment inbox storage is unavailable.',
        recovery: typeof data.recovery === 'string' ? data.recovery : 'Apply the comment inbox migration to the bound database before validating populated rows.',
      } : null)
      setComments(Array.isArray(data.items) ? data.items : [])
      setSummary(data.summary ?? EMPTY_SUMMARY)
      setFilteredSummary(data.filteredSummary ?? EMPTY_SUMMARY)
      const nextDrafts: Record<string, string> = {}
      for (const comment of data.items ?? []) {
        nextDrafts[comment.id] = comment.draftReply ?? ''
      }
      setDrafts(nextDrafts)
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Failed to load comment inbox' })
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  useEffect(() => {
    if (loading || unavailable || !focusedCommentId) {
      if (!focusedCommentId) setFocusRecovery(null)
      return
    }

    const focusedComment = comments.find((comment) => (
      comment.id === focusedCommentId || comment.providerCommentId === focusedCommentId
    ))

    if (!focusedComment) {
      setFocusRecovery({
        commentId: focusedCommentId,
        message: 'The linked comment is not visible with the current filters. It may be absent from this environment or filtered out.',
      })
      return
    }

    setFocusRecovery(null)
    const element = commentRefs.current[focusedComment.id]
    if (!element) return

    window.requestAnimationFrame(() => {
      element.scrollIntoView({ block: 'center', behavior: 'smooth' })
      element.focus({ preventScroll: true })
    })
  }, [comments, focusedCommentId, loading, unavailable])

  const clearFilters = useCallback(() => {
    setFilters({ status: 'all', platform: 'all', campaign: '', post: '' })
    setFocusedCommentId(null)
    setFocusRecovery(null)
  }, [])

  const statusCounts = useMemo(() => SOCIAL_COMMENT_STATUSES.map((status) => ({
    ...status,
    count: summary[status.value],
  })), [summary])

  const runAction = async (
    comment: SocialCommentInboxItem,
    action: 'draft_response' | 'approve' | 'reject' | 'ignore' | 'submit',
  ) => {
    setActionLoading(`${comment.id}:${action}`)
    setNotice(null)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const response = await fetch(`/api/admin/social-content/${comment.socialContentId}/engagement/comments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          comment_id: comment.id,
          draft_reply: drafts[comment.id] ?? '',
        }),
      })
      const data = await response.json()
      if (!response.ok && response.status !== 409) throw new Error(data.error || data.message || 'Comment action failed')
      setNotice({
        type: response.ok ? 'success' : 'error',
        text: data.message || (response.ok ? 'Comment action recorded.' : 'Comment action blocked.'),
      })
      await fetchComments()
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Comment action failed' })
    } finally {
      setActionLoading(null)
    }
  }

  const requestRefresh = async () => {
    setActionLoading('refresh')
    setNotice(null)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const targets = Array.from(new Set(comments.map((comment) => comment.socialContentId)))
      if (!targets.length) {
        setNotice({ type: 'success', text: 'No posts are currently visible for a refresh request.' })
        return
      }
      await Promise.all(targets.map((id) => fetch(`/api/admin/social-content/${id}/engagement/comments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'refresh_request' }),
      })))
      setNotice({ type: 'success', text: 'Refresh requested for the visible post set. Provider ingestion remains separate.' })
      await fetchComments()
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Refresh request failed' })
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
        <Breadcrumbs items={[
          { label: 'Admin', href: '/admin' },
          { label: 'Social Content', href: '/admin/social-content' },
          { label: 'Engagement Inbox' },
        ]} />

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">Portfolio operations</p>
            <h1 className="mt-1 text-2xl font-bold text-foreground">Engagement Inbox</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Review imported comments, draft replies, and record approval decisions. Unsupported providers stay visible with the manual recovery path.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/social-content"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              Social Content
            </Link>
            <button
              type="button"
              onClick={requestRefresh}
              disabled={actionLoading === 'refresh'}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-200 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionLoading === 'refresh' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh Request
            </button>
          </div>
        </div>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Total</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{summary.total}</p>
            <p className="mt-1 text-xs text-muted-foreground">{filteredSummary.total} visible after filters</p>
          </div>
          {statusCounts.slice(0, 7).map((status) => (
            <button
              type="button"
              key={status.value}
              onClick={() => setFilters((current) => ({ ...current, status: current.status === status.value ? 'all' : status.value }))}
              className={`rounded-lg border p-4 text-left transition-colors hover:bg-muted/60 ${filters.status === status.value ? STATUS_CLASS[status.value] : 'border-border bg-card text-foreground'}`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-75">{status.label}</p>
              <p className="mt-1 text-2xl font-semibold">{status.count}</p>
            </button>
          ))}
        </section>

        <section className="mt-5 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <SlidersHorizontal className="h-4 w-4 text-amber-300" />
            Filters
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Status
              <select
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as FilterState['status'] }))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground"
              >
                <option value="all">All statuses</option>
                {SOCIAL_COMMENT_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Platform
              <select
                value={filters.platform}
                onChange={(event) => setFilters((current) => ({ ...current, platform: event.target.value as FilterState['platform'] }))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground"
              >
                <option value="all">All platforms</option>
                {PLATFORMS.map((platform) => <option key={platform.value} value={platform.value}>{platform.label}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Campaign
              <input
                value={filters.campaign}
                onChange={(event) => setFilters((current) => ({ ...current, campaign: event.target.value }))}
                placeholder="Campaign ID or label"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground placeholder:text-muted-foreground"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Post
              <input
                value={filters.post}
                onChange={(event) => setFilters((current) => ({ ...current, post: event.target.value }))}
                placeholder="Post ID or text"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground placeholder:text-muted-foreground"
              />
            </label>
          </div>
        </section>

        {notice && (
          <div className={`mt-4 rounded-lg border p-3 text-sm leading-6 ${notice.type === 'success' ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100' : 'border-red-500/35 bg-red-500/10 text-red-100'}`}>
            {notice.text}
          </div>
        )}

        {focusRecovery && !loading && !unavailable && (
          <div className="mt-4 rounded-lg border border-amber-500/35 bg-amber-500/10 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-200" />
                  <h2 className="text-sm font-semibold text-amber-100">Linked comment not visible</h2>
                </div>
                <p className="mt-2 break-words text-sm leading-6 text-amber-50">{focusRecovery.message}</p>
                <p className="mt-1 break-all text-xs leading-5 text-amber-100/80">Comment: {focusRecovery.commentId}</p>
              </div>
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 px-3 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/10"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        <main className="mt-5 space-y-4">
          {loading ? (
            <div className="flex min-h-48 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading comments
            </div>
          ) : unavailable ? (
            <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <ShieldAlert className="h-5 w-5 shrink-0 text-amber-200" />
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-amber-100">Comment inbox unavailable</h2>
                  <p className="mt-2 text-sm leading-6 text-amber-50">{unavailable.message}</p>
                  <p className="mt-2 break-words text-sm leading-6 text-amber-100/85">{unavailable.recovery}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href="/admin/social-content"
                      className="inline-flex min-h-10 items-center justify-center rounded-lg border border-amber-500/40 px-3 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/10"
                    >
                      Social Content
                    </Link>
                    <button
                      type="button"
                      onClick={fetchComments}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/20"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Retry Check
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : comments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
              <Filter className="mx-auto h-8 w-8 text-muted-foreground" />
              <h2 className="mt-3 text-lg font-semibold text-foreground">No comments match these filters</h2>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Clear filters or request a refresh from the provider ingestion lane. Unsupported providers will appear here once their comments are imported.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
              >
                Clear Filters
              </button>
            </div>
          ) : comments.map((comment) => {
            const submitReady = canSubmit(comment)
            const actionKey = (action: string) => `${comment.id}:${action}`
            const isFocused = focusedCommentId === comment.id || focusedCommentId === comment.providerCommentId
            return (
              <article
                key={comment.id}
                ref={(element) => {
                  commentRefs.current[comment.id] = element
                }}
                tabIndex={isFocused ? -1 : undefined}
                aria-label={isFocused ? `Focused comment from ${comment.authorDisplayName}` : undefined}
                className={`rounded-lg border bg-card p-4 shadow-sm outline-none transition-colors ${isFocused ? 'border-amber-400 ring-2 ring-amber-300/60 ring-offset-2 ring-offset-background' : 'border-border'}`}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS[comment.status]}`}>
                        {statusLabel(comment.status)}
                      </span>
                      <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                        {platformLabel(comment.platform)}
                      </span>
                      <span className={`text-xs font-semibold ${PRIORITY_CLASS[comment.classification.priority]}`}>
                        {comment.classification.priority.toUpperCase()} priority
                      </span>
                    </div>
                    <h2 className="mt-3 text-base font-semibold text-foreground">{comment.authorDisplayName}</h2>
                    <p className="mt-2 max-w-4xl break-words text-sm leading-6 text-foreground">{comment.body}</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {comment.classification.label}{comment.classification.reason ? `: ${comment.classification.reason}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link
                      href={`/admin/social-content/${comment.socialContentId}`}
                      className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                    >
                      Open Post
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                    {comment.providerPermalink && (
                      <a
                        href={comment.providerPermalink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                      >
                        Provider
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
                  <div className="space-y-3">
                    <div className="rounded-lg border border-border bg-background/70 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Original post</p>
                      <p className="mt-1 text-sm leading-6 text-foreground">{comment.postLabel}</p>
                      <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">{comment.postExcerpt}</p>
                    </div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Draft reply
                      <textarea
                        value={drafts[comment.id] ?? ''}
                        onChange={(event) => setDrafts((current) => ({ ...current, [comment.id]: event.target.value }))}
                        rows={4}
                        className="mt-1 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-6 text-foreground placeholder:text-muted-foreground"
                        placeholder="Draft a reply for review. This does not send externally."
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => runAction(comment, 'draft_response')}
                        disabled={actionLoading === actionKey('draft_response')}
                        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-100 hover:bg-blue-500/20 disabled:opacity-60"
                      >
                        {actionLoading === actionKey('draft_response') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                        Draft Response
                      </button>
                      <button
                        type="button"
                        onClick={() => runAction(comment, 'approve')}
                        disabled={actionLoading === actionKey('approve') || !(drafts[comment.id] ?? '').trim()}
                        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => runAction(comment, 'reject')}
                        disabled={actionLoading === actionKey('reject')}
                        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 hover:bg-red-500/20 disabled:opacity-60"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => runAction(comment, 'ignore')}
                        disabled={actionLoading === actionKey('ignore')}
                        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-gray-600 px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-60"
                      >
                        Ignore
                      </button>
                      <button
                        type="button"
                        onClick={() => runAction(comment, 'submit')}
                        disabled={actionLoading === actionKey('submit') || !submitReady}
                        title={submitReady ? 'Queue guarded provider submission request' : comment.providerCapability.blocker || comment.providerCapability.recoveryPath}
                        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        {actionLoading === actionKey('submit') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Submit
                      </button>
                    </div>
                  </div>

                  <aside className="rounded-lg border border-border bg-background/70 p-3">
                    <div className="flex items-center gap-2">
                      {submitReady ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <ShieldAlert className="h-4 w-4 text-amber-300" />}
                      <p className="text-sm font-semibold text-foreground">
                        {submitReady ? 'Provider ready' : 'Blocked/manual state'}
                      </p>
                    </div>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Provider</dt>
                        <dd className="mt-1 break-words text-foreground">{comment.providerCapability.provider}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Approval</dt>
                        <dd className="mt-1 text-foreground">{comment.approvalState.replace(/_/g, ' ')}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Recovery path</dt>
                        <dd className="mt-1 text-muted-foreground">{comment.providerCapability.blocker || comment.providerCapability.recoveryPath}</dd>
                      </div>
                    </dl>
                    {comment.actionHistory.length > 0 ? (
                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Action history</p>
                        <ul className="mt-2 space-y-2">
                          {comment.actionHistory.slice(0, 4).map((event, index) => (
                            <li key={`${event.at}-${index}`} className="rounded-md border border-border bg-card px-2.5 py-2 text-xs leading-5 text-muted-foreground">
                              <span className="font-semibold text-foreground">{event.action.replace(/_/g, ' ')}</span>
                              {event.note ? `: ${event.note}` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="mt-4 flex gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        No action history recorded yet.
                      </div>
                    )}
                  </aside>
                </div>
              </article>
            )
          })}
        </main>
      </div>
    </ProtectedRoute>
  )
}
