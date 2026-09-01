'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ExternalLink,
  Filter,
  Info,
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

type AlertReliabilityState =
  | 'disabled'
  | 'dry_run'
  | 'deduped'
  | 'skipped'
  | 'no_eligible_items'
  | 'sent'
  | 'errored'
  | 'ready'

type AlertReliabilityStatus = {
  state: AlertReliabilityState
  label: string
  summary: string
  deliveryMode: 'disabled' | 'dry_run' | 'live'
  activation: {
    enabled: boolean
    reason: string
  }
  counts: {
    itemCount: number
    sent: number
    deduped: number
    skipped: number
    errors: number
  }
  reasons: string[]
  lastActionableNextStep: string
  nextStep: {
    label: string
    href: string
  }
  lastRun?: {
    id: string
    status: string | null
    at: string | null
    outcome: string
    reason: string | null
  } | null
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

function summarizeVisibleComments(items: SocialCommentInboxItem[]): SocialCommentInboxSummary {
  const next = { ...EMPTY_SUMMARY }
  next.total = items.length
  for (const item of items) {
    next[item.status] += 1
  }
  return next
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

const ALERT_RELIABILITY_CLASS: Record<AlertReliabilityState, string> = {
  disabled: 'border-gray-600 bg-gray-900/65 text-gray-100',
  dry_run: 'border-cyan-500/35 bg-cyan-500/10 text-cyan-100',
  deduped: 'border-blue-500/35 bg-blue-500/10 text-blue-100',
  skipped: 'border-amber-500/35 bg-amber-500/10 text-amber-100',
  no_eligible_items: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
  sent: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100',
  errored: 'border-red-500/40 bg-red-500/10 text-red-100',
  ready: 'border-amber-500/35 bg-amber-500/10 text-amber-100',
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

function formatActionLabel(action: SocialCommentInboxItem['actionHistory'][number]['action']) {
  return action.replace(/_/g, ' ')
}

function formatActionTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Time unavailable'
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function latestAction(
  comment: SocialCommentInboxItem,
  action: SocialCommentInboxItem['actionHistory'][number]['action'],
) {
  return comment.actionHistory.find((item) => item.action === action)
}

function revisionFeedbackText(comment: SocialCommentInboxItem) {
  const rejected = latestAction(comment, 'reject')
  return rejected?.note?.trim() || null
}

function ReplyLifecyclePanel({
  comment,
  draftText,
  isDraftUpdating,
  isRevisionMode,
  isRevisionSubmitting,
}: {
  comment: SocialCommentInboxItem
  draftText: string
  isDraftUpdating: boolean
  isRevisionMode: boolean
  isRevisionSubmitting: boolean
}) {
  const feedback = revisionFeedbackText(comment)
  const revisionEvent = latestAction(comment, 'return_to_review')
  const draftEvent = latestAction(comment, 'draft_response')
  const hasPersistedRevision = Boolean(revisionEvent)
  const hasReviewableDraft = comment.approvalState === 'drafted' && Boolean(draftText)

  let stage = 'Review not started'
  let tone = 'border-gray-600 bg-gray-900/65 text-gray-100'
  let summary = 'No reply feedback or draft update has been recorded for this comment yet.'
  let ownerStatus = 'No owner or agent update is currently tracked for this reply.'
  let nextAction = 'Draft a reply, approve an existing draft, or reject with feedback.'
  let feedbackState = 'No written feedback saved yet.'
  let revisionState = 'No revision has been returned to review yet.'
  let reviewState = 'Waiting for a draft or decision.'

  if (comment.submittedReplyLocked) {
    stage = 'Provider evidence locked'
    tone = 'border-red-500/35 bg-red-500/10 text-red-100'
    summary = 'Submitted provider evidence is authoritative. Portfolio is not changing local review state for this reply.'
    ownerStatus = 'No Amina or owner update is tracked because submitted provider evidence is locked.'
    nextAction = 'Inspect provider evidence or handle any correction outside this local revision workflow.'
    feedbackState = feedback ? `Saved in history: ${feedback}` : 'No new feedback can be recorded from this locked panel.'
    revisionState = 'Revision is locked after provider submission evidence.'
    reviewState = 'Review controls are locked.'
  } else if (isRevisionSubmitting) {
    stage = 'Revision received'
    tone = 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
    summary = 'Portfolio is saving the replacement reply locally and returning it to the review queue.'
    ownerStatus = 'Save in progress. No provider reply is being sent.'
    nextAction = 'Wait for the save to finish, then review the updated draft.'
    feedbackState = feedback ? `Saved in history: ${feedback}` : 'Current revision text will be saved as the replacement draft.'
    revisionState = 'Revision submission is in progress.'
    reviewState = 'Returning to review.'
  } else if (isRevisionMode) {
    stage = 'Revision requested'
    tone = 'border-amber-500/40 bg-amber-500/10 text-amber-100'
    summary = 'The revision box is open locally. Text entered here is not saved until Submit Revision is clicked.'
    ownerStatus = 'No Amina or owner update is currently tracked from this local edit.'
    nextAction = draftText
      ? 'Submit the revision to return the edited reply to review.'
      : 'Enter feedback or replacement reply text before submitting the revision.'
    feedbackState = feedback ? `Saved in history: ${feedback}` : 'Add revision guidance or replacement reply text in the box below.'
    revisionState = 'Revision input is open locally.'
    reviewState = 'Review is paused until the revision is submitted.'
  } else if (comment.approvalState === 'rejected') {
    stage = 'Revision requested'
    tone = 'border-red-500/35 bg-red-500/10 text-red-100'
    summary = 'This reply is rejected and waiting for an operator revision or replacement reply.'
    ownerStatus = 'No Amina or owner update is currently tracked for this reply.'
    nextAction = 'Click Revise Reply, enter the revision, then submit it back to review.'
    feedbackState = feedback ? `Saved in history: ${feedback}` : 'No written feedback was saved with the rejection.'
    revisionState = 'Waiting for revision input.'
    reviewState = 'Review is locked until a revision is submitted.'
  } else if (isDraftUpdating) {
    stage = 'Updating draft'
    tone = 'border-blue-500/35 bg-blue-500/10 text-blue-100'
    summary = 'Portfolio is updating the local draft reply. This does not submit anything to a provider.'
    ownerStatus = 'Draft update is in progress in this browser action.'
    nextAction = 'Wait for the draft to appear, then review it before approval.'
    feedbackState = feedback ? `Saved in history: ${feedback}` : 'No rejection feedback is attached to this draft update.'
    revisionState = draftEvent ? `Previous draft update: ${formatActionTime(draftEvent.at)}` : 'Draft update requested.'
    reviewState = 'Waiting for draft update.'
  } else if (hasPersistedRevision && hasReviewableDraft) {
    stage = 'Ready for review'
    tone = 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
    summary = 'Revision was received and saved as the current draft reply.'
    ownerStatus = 'No Amina or owner update is currently tracked. The reply is ready for operator review.'
    nextAction = 'Review the draft, then approve it, reject it with feedback, or edit it again.'
    feedbackState = feedback ? `Saved in history: ${feedback}` : 'No written rejection feedback is attached to the latest revision.'
    revisionState = `Returned to review: ${formatActionTime(revisionEvent!.at)}`
    reviewState = 'Ready for review.'
  } else if (hasReviewableDraft) {
    stage = 'Ready for review'
    tone = 'border-blue-500/35 bg-blue-500/10 text-blue-100'
    summary = 'A local draft reply is available for review.'
    ownerStatus = 'No Amina or owner update is currently tracked for this reply.'
    nextAction = 'Approve, reject with feedback, edit the draft, or keep waiting if more context is needed.'
    feedbackState = feedback ? `Saved in history: ${feedback}` : 'No rejection feedback is attached to this draft.'
    revisionState = 'No returned revision is recorded yet.'
    reviewState = 'Ready for review.'
  } else if (comment.approvalState === 'approved') {
    stage = 'Approved locally'
    tone = 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
    summary = 'This reply has local approval. Provider submission still requires the separate provider gate.'
    ownerStatus = 'No Amina or owner update is currently tracked for this reply.'
    nextAction = 'Use provider submission only if the separate capability gate is satisfied.'
    feedbackState = feedback ? `Saved in history: ${feedback}` : 'No rejection feedback is attached.'
    revisionState = hasPersistedRevision ? `Returned to review: ${formatActionTime(revisionEvent!.at)}` : 'No returned revision is recorded.'
    reviewState = 'Approved locally.'
  }

  return (
    <div role="region" aria-label={`Reply lifecycle for ${comment.authorDisplayName}`} className={`rounded-lg border p-3 ${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em]">Reply lifecycle</p>
        <span className="rounded-full border border-current/30 px-2 py-0.5 text-[0.7rem] font-semibold uppercase">
          {stage}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5">{summary}</p>
      <div className="mt-3 grid gap-2 text-xs leading-5 md:grid-cols-3">
        <div className="rounded-md border border-current/20 bg-background/50 px-2.5 py-2">
          <p className="font-semibold">Feedback</p>
          <p className="mt-1 opacity-85">{feedbackState}</p>
        </div>
        <div className="rounded-md border border-current/20 bg-background/50 px-2.5 py-2">
          <p className="font-semibold">Revision</p>
          <p className="mt-1 opacity-85">{revisionState}</p>
        </div>
        <div className="rounded-md border border-current/20 bg-background/50 px-2.5 py-2">
          <p className="font-semibold">Review</p>
          <p className="mt-1 opacity-85">{reviewState}</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5">
        <span className="font-semibold">Owner/agent status:</span> {ownerStatus}
      </p>
      <p className="mt-1 text-xs leading-5">
        <span className="font-semibold">Next action:</span> {nextAction}
      </p>
    </div>
  )
}

function canSubmit(comment: SocialCommentInboxItem) {
  return comment.status !== 'responded'
    && comment.approvalState === 'approved'
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
  const [revisionNotes, setRevisionNotes] = useState<Record<string, string>>({})
  const [revisionMode, setRevisionMode] = useState<Record<string, boolean>>({})
  const [commentNotices, setCommentNotices] = useState<Record<string, { type: 'success' | 'error'; text: string }>>({})
  const [unavailable, setUnavailable] = useState<InboxUnavailableState | null>(null)
  const [alertReliability, setAlertReliability] = useState<AlertReliabilityStatus | null>(null)

  const applyCommentPayload = useCallback((
    data: Record<string, unknown>,
    key: 'items' | 'comments',
  ) => {
    const nextComments = Array.isArray(data[key]) ? data[key] as SocialCommentInboxItem[] : []
    setComments(nextComments)
    setSummary(data.summary && typeof data.summary === 'object'
      ? data.summary as SocialCommentInboxSummary
      : summarizeVisibleComments(nextComments))
    setFilteredSummary(data.filteredSummary && typeof data.filteredSummary === 'object'
      ? data.filteredSummary as SocialCommentInboxSummary
      : summarizeVisibleComments(nextComments))
    if (data.alertReliability && typeof data.alertReliability === 'object') {
      setAlertReliability(data.alertReliability as AlertReliabilityStatus)
    }

    const nextDrafts: Record<string, string> = {}
    for (const comment of nextComments) {
      nextDrafts[comment.id] = comment.draftReply ?? ''
    }
    setDrafts(nextDrafts)
    setRevisionNotes((current) => {
      const next = { ...current }
      for (const comment of nextComments) {
        if (next[comment.id] === undefined) next[comment.id] = ''
      }
      return next
    })
  }, [])

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
      applyCommentPayload(data, 'items')
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Failed to load comment inbox' })
    } finally {
      setLoading(false)
    }
  }, [applyCommentPayload, filters])

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
    action: 'draft_response' | 'approve' | 'reject' | 'ignore' | 'submit' | 'return_to_review',
  ) => {
    if (action === 'return_to_review' && comment.submittedReplyLocked) {
      setCommentNotices((current) => ({
        ...current,
        [comment.id]: {
          type: 'error',
          text: comment.submittedReplyLockReason
            || 'Reply already has submitted provider evidence. Local revision is locked.',
        },
      }))
      return
    }
    setActionLoading(`${comment.id}:${action}`)
    setNotice(null)
    setCommentNotices((current) => {
      const next = { ...current }
      delete next[comment.id]
      return next
    })
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
          note: action === 'reject'
            ? revisionNotes[comment.id]?.trim() || 'Rejected from Portfolio reply review.'
            : undefined,
        }),
      })
      const data = await response.json()
      if (!response.ok && response.status !== 409) throw new Error(data.error || data.message || 'Comment action failed')
      setCommentNotices((current) => ({
        ...current,
        [comment.id]: {
          type: response.ok ? 'success' : 'error',
          text: action === 'draft_response' && response.ok
            ? 'Draft response generated in the Draft reply box. Review it before approval.'
            : data.message || (response.ok ? 'Comment action recorded.' : 'Comment action blocked.'),
        },
      }))
      if (action === 'draft_response' && response.ok) {
        setFocusedCommentId(comment.id)
      }
      if (action === 'reject' && response.ok) {
        setRevisionNotes((current) => ({ ...current, [comment.id]: '' }))
      }
      if (action === 'return_to_review' && response.ok) {
        setRevisionMode((current) => ({ ...current, [comment.id]: false }))
      }
      if (data.fixture && Array.isArray(data.comments)) {
        applyCommentPayload(data, 'comments')
      } else {
        await fetchComments()
      }
    } catch (error) {
      setCommentNotices((current) => ({
        ...current,
        [comment.id]: {
          type: 'error',
          text: error instanceof Error ? error.message : 'Comment action failed',
        },
      }))
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

        <section className="mt-5 rounded-lg border border-border bg-card p-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-lg border border-border bg-background px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Visible</p>
                  <p className="mt-0.5 text-xl font-semibold text-foreground">{filteredSummary.total} / {summary.total}</p>
                </div>
                {statusCounts.slice(0, 7).map((status) => {
                  const isActive = filters.status === status.value
                  return (
                    <button
                      type="button"
                      key={status.value}
                      aria-label={isActive
                        ? `Clear ${status.label} comment filter (${status.count})`
                        : `Filter comments to ${status.label} (${status.count})`}
                      aria-pressed={isActive}
                      title={isActive ? 'Click to clear this status filter' : `Filter to ${status.label}`}
                      onClick={() => setFilters((current) => ({ ...current, status: current.status === status.value ? 'all' : status.value }))}
                      className={`min-h-14 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 ${isActive ? STATUS_CLASS[status.value] : 'border-border bg-background text-foreground hover:bg-muted/60'}`}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] opacity-75">{status.label}</p>
                      <p className="mt-0.5 text-lg font-semibold">{status.count}</p>
                    </button>
                  )
                })}
              </div>
            </div>
            {alertReliability && (
              <div className={`rounded-lg border px-3 py-2 ${ALERT_RELIABILITY_CLASS[alertReliability.state]}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <BellRing className="h-4 w-4 shrink-0" />
                  <h2 className="text-sm font-semibold text-current">Alert reliability</h2>
                  <span className="rounded-full border border-current/30 px-2 py-0.5 text-[0.7rem] font-semibold uppercase">
                    {alertReliability.label}
                  </span>
                  <span className="rounded-full border border-current/25 px-2 py-0.5 text-[0.7rem] font-semibold uppercase">
                    {alertReliability.deliveryMode.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-current/80">{alertReliability.summary}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[0.7rem] font-semibold uppercase text-current/75">
                  <span>Items {alertReliability.counts.itemCount}</span>
                  <span>Sent {alertReliability.counts.sent}</span>
                  <span>Errors {alertReliability.counts.errors}</span>
                  <span>Enabled {alertReliability.activation.enabled ? 'Yes' : 'No'}</span>
                </div>
              </div>
            )}
          </div>
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
            const draftText = drafts[comment.id]?.trim() ?? ''
            const isRejected = comment.approvalState === 'rejected'
            const isRevisionMode = revisionMode[comment.id] === true
            const inlineNotice = commentNotices[comment.id]
            const isDraftUpdating = actionLoading === actionKey('draft_response')
            const isRevisionSubmitting = actionLoading === actionKey('return_to_review')
            const submittedReplyLockReason = comment.submittedReplyLockReason
              || 'Reply already has submitted provider evidence. Local revision is locked.'
            const submittedReplyLockReasonId = `${comment.id}-submitted-reply-lock-reason`
            return (
              <article
                key={comment.id}
                id={isFocused ? 'social-comment-review-gate' : undefined}
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
                  </div>
                </div>

                <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
                  <div className="space-y-3">
                    <div className="rounded-lg border border-border bg-background/70 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Original post</p>
                        <Link
                          href={`/admin/social-content/${comment.socialContentId}`}
                          className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
                        >
                          Details
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-foreground">{comment.postLabel}</p>
                      <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">{comment.postExcerpt}</p>
                    </div>
                    <div className="rounded-lg border border-blue-500/35 bg-blue-500/10 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">Inbound comment</p>
                        {comment.providerPermalink && (
                          <a
                            href={comment.providerPermalink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-blue-500/35 px-2.5 py-1.5 text-xs font-semibold text-blue-100 hover:bg-blue-500/15"
                          >
                            Provider
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                      <p className="mt-1 text-xs font-semibold text-blue-100">{comment.authorDisplayName}</p>
                      <p className="mt-2 break-words text-sm leading-6 text-foreground">{comment.body}</p>
                      <p className="mt-2 text-xs leading-5 text-blue-100/85">
                        {comment.classification.label}{comment.classification.reason ? `: ${comment.classification.reason}` : ''}
                      </p>
                    </div>
                    {!isRejected && !comment.submittedReplyLocked && (
                      <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        <span className="flex flex-wrap items-center gap-2">
                          <span>Draft reply</span>
                          {draftText && (
                            <span className="rounded-full border border-blue-500/35 bg-blue-500/10 px-2 py-0.5 text-[0.65rem] font-semibold tracking-normal text-blue-100">
                              Generated response ready for review
                            </span>
                          )}
                          {draftText && (
                            <span className="group relative inline-flex">
                              <button
                                type="button"
                                aria-label="Generated reply guardrail"
                                title="This generated response stays local until approval and provider submission gates pass."
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-blue-500/35 bg-blue-500/10 text-blue-100"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </button>
                              <span className="pointer-events-none absolute left-0 top-7 z-10 hidden w-64 rounded-md border border-blue-500/35 bg-background px-3 py-2 text-xs font-normal normal-case leading-5 tracking-normal text-blue-100 shadow-lg group-hover:block group-focus-within:block">
                                This generated response stays local until approval and provider submission gates pass.
                              </span>
                            </span>
                          )}
                        </span>
                        <textarea
                          value={drafts[comment.id] ?? ''}
                          onChange={(event) => setDrafts((current) => ({ ...current, [comment.id]: event.target.value }))}
                          rows={4}
                          className={`mt-1 w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm leading-6 text-foreground placeholder:text-muted-foreground ${draftText ? 'border-blue-500/50 shadow-[0_0_0_1px_rgba(96,165,250,0.28)]' : 'border-border'}`}
                          placeholder="Draft a reply for review. This does not send externally."
                        />
                      </label>
                    )}
                    {isRejected ? (
                      <div className="rounded-lg border border-red-500/35 bg-red-500/10 p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <XCircle className="h-4 w-4 shrink-0 text-red-200" />
                              <p className="text-sm font-semibold text-red-100">Reply rejected</p>
                              <span className="rounded-full border border-red-500/35 px-2 py-0.5 text-[0.7rem] font-semibold uppercase text-red-100">
                                {comment.submittedReplyLocked ? 'Provider evidence locked' : isRevisionMode ? 'Revision mode' : 'Review locked'}
                              </span>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-red-50/90">
                              {comment.submittedReplyLocked
                                ? submittedReplyLockReason
                                : isRevisionMode
                                  ? 'Edit the reply below, then return it to review. No provider reply is sent from this action.'
                                  : 'Approve, reject, and provider submit stay unavailable for this rejected reply until the draft is revised and returned to review.'}
                            </p>
                          </div>
                          <div className="shrink-0 space-y-2 sm:max-w-[19rem]">
                            <div className="flex flex-wrap gap-2">
                              {comment.submittedReplyLocked ? (
                                <button
                                  type="button"
                                  disabled
                                  aria-describedby={submittedReplyLockReasonId}
                                  title={submittedReplyLockReason}
                                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 opacity-60"
                                >
                                  <ShieldAlert className="h-3.5 w-3.5" />
                                  Revision Locked
                                </button>
                              ) : isRevisionMode ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => runAction(comment, 'return_to_review')}
                                    disabled={actionLoading === actionKey('return_to_review') || !draftText}
                                    className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {isRevisionSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                    Submit Revision
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRevisionMode((current) => ({ ...current, [comment.id]: false }))}
                                    disabled={actionLoading === actionKey('return_to_review')}
                                    className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-gray-600 px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-60"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRevisionMode((current) => ({ ...current, [comment.id]: true }))
                                    setCommentNotices((current) => ({
                                      ...current,
                                      [comment.id]: {
                                        type: 'success',
                                        text: 'Revision mode opened. Edit the reply and return it to review when ready.',
                                      },
                                    }))
                                  }}
                                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  Revise Reply
                                </button>
                              )}
                              <button
                                type="button"
                                disabled
                                title={comment.providerCapability.blocker || comment.providerCapability.recoveryPath}
                                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100 opacity-55"
                              >
                                <Send className="h-3.5 w-3.5" />
                                Submit
                              </button>
                            </div>
                            {comment.submittedReplyLocked ? (
                              <p id={submittedReplyLockReasonId} className="rounded-md border border-red-500/30 bg-background/70 px-2.5 py-2 text-xs leading-5 text-red-100">
                                {submittedReplyLockReason}
                              </p>
                            ) : (
                              <p className="text-xs leading-5 text-red-100/80">
                                {isRevisionMode
                                  ? 'Submit revision reopens the local approval gate only.'
                                  : 'Revise opens the local editor before any review state changes.'}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="mt-3">
                          <ReplyLifecyclePanel
                            comment={comment}
                            draftText={draftText}
                            isDraftUpdating={isDraftUpdating}
                            isRevisionMode={isRevisionMode}
                            isRevisionSubmitting={isRevisionSubmitting}
                          />
                        </div>
                        {isRevisionMode && !comment.submittedReplyLocked ? (
                          <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.14em] text-red-100/85">
                            Revision feedback or replacement reply
                            <textarea
                              value={drafts[comment.id] ?? ''}
                              onChange={(event) => setDrafts((current) => ({ ...current, [comment.id]: event.target.value }))}
                              rows={4}
                              className="mt-1 w-full resize-y rounded-lg border border-red-500/30 bg-background px-3 py-2 text-sm normal-case leading-6 tracking-normal text-foreground placeholder:text-muted-foreground"
                              placeholder="Revise the reply before returning it to review."
                            />
                          </label>
                        ) : null}
                        {inlineNotice ? (
                          <div className={`mt-3 rounded-lg border p-3 text-xs leading-5 ${inlineNotice.type === 'success' ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100' : 'border-red-500/35 bg-red-500/10 text-red-100'}`}>
                            {inlineNotice.text}
                          </div>
                        ) : null}
                      </div>
                    ) : comment.submittedReplyLocked ? (
                      <div className="rounded-lg border border-red-500/35 bg-red-500/10 p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <ShieldAlert className="h-4 w-4 shrink-0 text-red-200" />
                              <p className="text-sm font-semibold text-red-100">Provider evidence locked</p>
                              <span className="rounded-full border border-red-500/35 px-2 py-0.5 text-[0.7rem] font-semibold uppercase text-red-100">
                                Review locked
                              </span>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-red-50/90">
                              Submitted provider evidence is authoritative. Local approve, reject, revise, and submit controls are locked for this reply.
                            </p>
                          </div>
                          <div className="shrink-0 space-y-2 sm:max-w-[19rem]">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled
                                aria-describedby={submittedReplyLockReasonId}
                                title={submittedReplyLockReason}
                                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 opacity-60"
                              >
                                <ShieldAlert className="h-3.5 w-3.5" />
                                Review Locked
                              </button>
                              <button
                                type="button"
                                disabled
                                title={submittedReplyLockReason}
                                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100 opacity-55"
                              >
                                <Send className="h-3.5 w-3.5" />
                                Submit
                              </button>
                            </div>
                            <p id={submittedReplyLockReasonId} className="rounded-md border border-red-500/30 bg-background/70 px-2.5 py-2 text-xs leading-5 text-red-100">
                              {submittedReplyLockReason}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <ReplyLifecyclePanel
                            comment={comment}
                            draftText={draftText}
                            isDraftUpdating={isDraftUpdating}
                            isRevisionMode={isRevisionMode}
                            isRevisionSubmitting={isRevisionSubmitting}
                          />
                        </div>
                        {inlineNotice ? (
                          <div className={`mt-3 rounded-lg border p-3 text-xs leading-5 ${inlineNotice.type === 'success' ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100' : 'border-red-500/35 bg-red-500/10 text-red-100'}`}>
                            {inlineNotice.text}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <ReplyLifecyclePanel
                          comment={comment}
                          draftText={draftText}
                          isDraftUpdating={isDraftUpdating}
                          isRevisionMode={isRevisionMode}
                          isRevisionSubmitting={isRevisionSubmitting}
                        />
                        <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Revision note
                          <textarea
                            value={revisionNotes[comment.id] ?? ''}
                            onChange={(event) => setRevisionNotes((current) => ({ ...current, [comment.id]: event.target.value }))}
                            rows={2}
                            className="mt-1 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case leading-6 tracking-normal text-foreground placeholder:text-muted-foreground"
                            placeholder="What should change if this reply is rejected or sent back?"
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
                            disabled={actionLoading === actionKey('approve') || !draftText}
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
                        {inlineNotice ? (
                          <div className={`rounded-lg border p-3 text-xs leading-5 ${inlineNotice.type === 'success' ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100' : 'border-red-500/35 bg-red-500/10 text-red-100'}`}>
                            {inlineNotice.text}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <aside>
                    <details className="rounded-lg border border-border bg-background/70 p-3">
                      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                        {submitReady ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <ShieldAlert className="h-4 w-4 text-amber-300" />}
                        <span>{submitReady ? 'Provider ready' : 'Provider guardrails'}</span>
                        <span className="rounded-full border border-border px-2 py-0.5 text-[0.7rem] font-semibold uppercase text-muted-foreground">
                          {comment.providerCapability.provider}
                        </span>
                        <span className="rounded-full border border-border px-2 py-0.5 text-[0.7rem] font-semibold uppercase text-muted-foreground">
                          {comment.approvalState.replace(/_/g, ' ')}
                        </span>
                      </summary>
                      <dl className="mt-3 space-y-2 text-sm">
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
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span className="font-semibold text-foreground">{formatActionLabel(event.action)}</span>
                                  <span>{formatActionTime(event.at)}</span>
                                  {event.by && <span>by {event.by}</span>}
                                </div>
                                {event.note && <p className="mt-1 break-words">{event.note}</p>}
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
                    </details>
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
