'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getCurrentSession } from '@/lib/auth'
import type {
  EmailTemplateKey,
  LinkedInTemplateKey,
  OutreachChannel,
} from '@/lib/constants/prompt-keys'

export type OutreachTemplateKey = EmailTemplateKey | LinkedInTemplateKey

/**
 * UI state machine over `POST /api/admin/outreach/leads/:id/generate`.
 *
 * The endpoint is now backed by the in-app generator (Phase 1 — Option A): it
 * loads `system_prompts`, runs the curated LLM via `lib/llm-dispatch.ts`, and
 * inserts the draft into `outreach_queue` synchronously. We still attach the
 * "wait for the row" timers because the success signal can come from two
 * places — Realtime (`useRealtimeOutreach` on the parent page) or a
 * `messages_count` bump after a refetch — and HTTP completion is racing both.
 *
 * Channel-aware: callers pass `channel: 'email' | 'linkedin'` to `start`, and
 * `templateKey` may be either an `EmailTemplateKey` or a `LinkedInTemplateKey`.
 *
 * Running copy intentionally avoids "n8n" — the legacy WF-CLG-002 path is
 * deprecated. Names like `n8nStatus` / `last_n8n_outreach_status` survive in
 * the DB column names for now (renamed in a later phase).
 */
export type OutreachGenerationState =
  | 'idle'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export interface UseOutreachGenerationOptions {
  leadId: number
  leadName: string
  /** From lead list; used to detect when a draft row appears while n8n finishes async. */
  messagesCount: number
  /**
   * Authoritative server-side status of the last n8n CLG-002 run. Arrives via
   * the batched `/api/admin/outreach/leads` fetch, which is now kept fresh in
   * real time by the `useRealtimeOutreach` subscription on the parent page.
   * When this flips from `pending` → `success`/`failed` while the hook is in
   * `running`, we trust the server and transition accordingly — **but only
   * after `n8nTriggeredAt` has advanced past the value captured at run start**.
   * Otherwise the previous run's lingering `success` would fake-settle the
   * new run the moment the HTTP trigger completes.
   */
  n8nStatus?: 'pending' | 'success' | 'failed' | null
  /**
   * Paired with `n8nStatus`: the `last_n8n_outreach_triggered_at` timestamp
   * (ISO string). Used as the run-identity key — each click of a template
   * bumps this on the server, so the client can tell "this status belongs to
   * my new run" vs. "this is stale from the previous run."
   */
  n8nTriggeredAt?: string | null
  onToast?: (msg: string) => void
  /** n8n returned triggered:false or threw — parent should reveal "Draft in app" fallback. */
  onFallbackAvailable?: () => void
  /** Auto-settle or cancel — parent should refetch so messages_count updates. */
  onSettled?: () => void
  /** Called on successful retry/start after a previous failure — clear the fallback flag. */
  onFallbackCleared?: () => void
}

export interface UseOutreachGenerationReturn {
  state: OutreachGenerationState
  elapsedMs: number
  phaseLabel: string
  /** Last template the user actually ran with (populated on success trigger). */
  lastTemplateKey: OutreachTemplateKey | null
  /** Last channel used. Defaults to 'email' for back-compat with existing UI. */
  lastChannel: OutreachChannel
  start: (
    templateKey?: OutreachTemplateKey,
    channel?: OutreachChannel,
  ) => Promise<void>
  cancel: () => void
  retry: () => Promise<void>
  /** Clears a sticky success state so the main Outreach control returns to idle. */
  dismissResult: () => void
}

/**
 * When n8n returns 200 but outreach_queue is still empty, wait before giving
 * up. Realtime is now the primary signal (`useRealtimeOutreach` on the parent
 * page pushes status/queue changes within ~1s of completion), so this is a
 * soft safety net for the rare case Realtime drops events or the dashboard was
 * opened mid-run. Anything longer than this falls back to "Draft in app" UX,
 * but the server-side `last_n8n_outreach_status` remains authoritative and
 * the next successful event/refetch re-syncs the UI.
 */
const EXTENDED_DRAFT_WAIT_MS = 8 * 60_000
const REFETCH_POLL_MS = 10_000
const CANCELLED_DISPLAY_MS = 4_000

function phaseFor(
  elapsedMs: number,
  extendedDraftWait: boolean,
  awaitingHttpResponse: boolean,
): string {
  if (awaitingHttpResponse) {
    if (elapsedMs < 2_500) return 'Starting…'
    if (elapsedMs < 8_000) return 'Building prompt…'
    return 'Calling model…'
  }
  if (elapsedMs < 2_000) return 'Queuing…'
  if (elapsedMs < (extendedDraftWait ? 40_000 : 18_000)) return 'Generating…'
  // Past the first minute we stop promising "almost done" — Realtime will
  // resolve the moment the server reports success/failed.
  if (elapsedMs < 90_000) return 'Saving draft…'
  return 'Still working…'
}

export function useOutreachGeneration({
  leadId,
  leadName,
  messagesCount,
  n8nStatus = null,
  n8nTriggeredAt = null,
  onToast,
  onFallbackAvailable,
  onSettled,
  onFallbackCleared,
}: UseOutreachGenerationOptions): UseOutreachGenerationReturn {
  const [state, setState] = useState<OutreachGenerationState>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [extendedDraftWait, setExtendedDraftWait] = useState(false)
  /** True while session + POST /generate are in flight; draft-detection stays off. */
  const [awaitingHttpResponse, setAwaitingHttpResponse] = useState(false)
  const [lastTemplateKey, setLastTemplateKey] = useState<OutreachTemplateKey | null>(null)
  const [lastChannel, setLastChannel] = useState<OutreachChannel>('email')

  const startedAtRef = useRef<number | null>(null)
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transientTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refetchPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const messagesCountRef = useRef(messagesCount)
  const messagesAtGenerationStartRef = useRef(0)
  const mountedRef = useRef(true)
  /**
   * Snapshot of `n8nTriggeredAt` at run start. The server bumps this value on
   * every trigger, so once the incoming prop is different we know the new run
   * has been registered server-side and any subsequent `n8nStatus` value is
   * about **this** run (not the previous one's leftover success / failed).
   */
  const triggeredAtBaselineRef = useRef<string | null>(null)

  messagesCountRef.current = messagesCount

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (tickTimerRef.current) clearInterval(tickTimerRef.current)
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current)
      if (transientTimerRef.current) clearTimeout(transientTimerRef.current)
      if (refetchPollRef.current) clearInterval(refetchPollRef.current)
    }
  }, [])

  const clearTimers = useCallback(() => {
    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current)
      tickTimerRef.current = null
    }
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current)
      safetyTimerRef.current = null
    }
    if (transientTimerRef.current) {
      clearTimeout(transientTimerRef.current)
      transientTimerRef.current = null
    }
    if (refetchPollRef.current) {
      clearInterval(refetchPollRef.current)
      refetchPollRef.current = null
    }
    setExtendedDraftWait(false)
    setAwaitingHttpResponse(false)
  }, [])

  const settleToIdle = useCallback(
    (reason: 'timeout' | 'cancel' | 'success') => {
      clearTimers()
      startedAtRef.current = null
      if (!mountedRef.current) return
      setElapsedMs(0)
      if (reason === 'success') {
        setState('succeeded')
      } else if (reason === 'cancel') {
        setState('cancelled')
        transientTimerRef.current = setTimeout(() => {
          if (!mountedRef.current) return
          setState('idle')
        }, CANCELLED_DISPLAY_MS)
      } else {
        setState('idle')
      }
      onSettled?.()
    },
    [clearTimers, onSettled],
  )

  /** Spinner + elapsed immediately on click; no DB-wait timers yet. */
  const startOptimisticRunning = useCallback(() => {
    clearTimers()
    setAwaitingHttpResponse(true)
    setExtendedDraftWait(false)
    startedAtRef.current = Date.now()
    setElapsedMs(0)
    setState('running')

    // Snapshot the lead's current `last_n8n_outreach_triggered_at` so the
    // server-status effect can ignore stale statuses (e.g. the previous run's
    // `success`) and only act once the server has recorded this new run.
    triggeredAtBaselineRef.current = n8nTriggeredAt ?? null

    tickTimerRef.current = setInterval(() => {
      if (!startedAtRef.current || !mountedRef.current) return
      setElapsedMs(Date.now() - startedAtRef.current)
    }, 250)
  }, [clearTimers, n8nTriggeredAt])

  /** After HTTP 200 + triggered + empty queue: poll refetch and long safety (keeps existing tick + elapsed). */
  const attachExtendedDraftWaitTimers = useCallback(() => {
    messagesAtGenerationStartRef.current = messagesCountRef.current
    setExtendedDraftWait(true)

    refetchPollRef.current = setInterval(() => {
      if (!mountedRef.current) return
      onSettled?.()
    }, REFETCH_POLL_MS)

    safetyTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return
      if (messagesCountRef.current > messagesAtGenerationStartRef.current) {
        onToast?.(`Check Email center for the draft for ${leadName}.`)
        settleToIdle('success')
        return
      }
      onFallbackAvailable?.()
      onToast?.(
        `No draft appeared after waiting. Try the in-app draft for ${leadName}.`,
      )
      clearTimers()
      startedAtRef.current = null
      setElapsedMs(0)
      setState('failed')
      onSettled?.()
    }, EXTENDED_DRAFT_WAIT_MS)
  }, [clearTimers, leadName, onFallbackAvailable, onSettled, onToast, settleToIdle])

  useEffect(() => {
    if (state !== 'running' || !startedAtRef.current || awaitingHttpResponse) return
    if (messagesCount > messagesAtGenerationStartRef.current) {
      onToast?.(`Draft is ready for ${leadName} — open Email center`)
      settleToIdle('success')
    }
  }, [state, messagesCount, awaitingHttpResponse, leadName, onToast, settleToIdle])

  // Authoritative server completion (pushed via Supabase Realtime on the
  // parent page → lead refetch → these props change). We only trust the
  // server's `n8nStatus` once its companion `n8nTriggeredAt` has advanced
  // past the value captured at run start — that's how we know the status
  // belongs to **this** run, not the previous one's leftover success / failed.
  useEffect(() => {
    if (state !== 'running' || !startedAtRef.current || awaitingHttpResponse) return
    // Gate on a fresh triggered_at. Without this, a lead whose previous run
    // succeeded would fake-settle the instant the new run's HTTP trigger
    // completes, before Realtime has a chance to surface the `pending` state.
    if (!n8nTriggeredAt || n8nTriggeredAt === triggeredAtBaselineRef.current) return

    if (n8nStatus === 'success') {
      onToast?.(`Draft is ready for ${leadName} — open Email center`)
      settleToIdle('success')
    } else if (n8nStatus === 'failed') {
      clearTimers()
      startedAtRef.current = null
      setElapsedMs(0)
      setState('failed')
      onFallbackAvailable?.()
      onToast?.(`Generation failed for ${leadName} — try Draft in app`)
      onSettled?.()
    }
  }, [
    state,
    n8nStatus,
    n8nTriggeredAt,
    awaitingHttpResponse,
    clearTimers,
    leadName,
    onFallbackAvailable,
    onSettled,
    onToast,
    settleToIdle,
  ])

  const performGenerate = useCallback(async (
    templateKey?: OutreachTemplateKey,
    channel: OutreachChannel = 'email',
  ) => {
    const session = await getCurrentSession()
    if (!session) {
      onToast?.('Please sign in to continue.')
      return
    }

    if (templateKey) setLastTemplateKey(templateKey)
    setLastChannel(channel)

    // Optimistic: hide any previous "fallback available" UI; a fresh run is starting.
    onFallbackCleared?.()

    startOptimisticRunning()

    const channelLabel = channel === 'linkedin' ? 'LinkedIn' : 'email'

    try {
      const res = await fetch(`/api/admin/outreach/leads/${leadId}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          channel,
          ...(templateKey ? { templateKey } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!mountedRef.current) return

      setAwaitingHttpResponse(false)

      if (data?.triggered) {
        onFallbackCleared?.()
        // The in-app generator inserts the draft synchronously, so the
        // success signal usually arrives within milliseconds via Realtime
        // (last_n8n_outreach_status → 'success' with a fresh triggered_at)
        // or a messages_count bump on the next refetch. We still attach the
        // long safety timer for the rare case Realtime drops events.
        attachExtendedDraftWaitTimers()
        onToast?.(`Generating ${channelLabel} draft for ${leadName}…`)
      } else {
        clearTimers()
        startedAtRef.current = null
        setElapsedMs(0)
        setState('failed')
        onFallbackAvailable?.()
        onToast?.(
          data?.error ||
            `Could not generate the ${channelLabel} draft for ${leadName} — try again.`,
        )
      }
    } catch {
      if (!mountedRef.current) return
      setAwaitingHttpResponse(false)
      clearTimers()
      startedAtRef.current = null
      setElapsedMs(0)
      setState('failed')
      onFallbackAvailable?.()
      onToast?.(
        `Could not reach the generator for ${leadName} — try again.`,
      )
    }
  }, [
    attachExtendedDraftWaitTimers,
    clearTimers,
    leadId,
    leadName,
    onFallbackAvailable,
    onFallbackCleared,
    onToast,
    startOptimisticRunning,
  ])

  const start = useCallback(
    async (templateKey?: OutreachTemplateKey, channel: OutreachChannel = 'email') => {
      await performGenerate(templateKey, channel)
    },
    [performGenerate],
  )

  const retry = useCallback(async () => {
    await performGenerate(lastTemplateKey ?? undefined, lastChannel)
  }, [performGenerate, lastTemplateKey, lastChannel])

  const cancel = useCallback(() => {
    if (state !== 'running') return
    onToast?.(
      `Stopped watching ${leadName}. The draft may still appear in Email center or the message list.`,
    )
    settleToIdle('cancel')
  }, [leadName, onToast, settleToIdle, state])

  const dismissResult = useCallback(() => {
    if (state !== 'succeeded') return
    if (!mountedRef.current) return
    setState('idle')
  }, [state])

  return {
    state,
    elapsedMs,
    phaseLabel: phaseFor(elapsedMs, extendedDraftWait, awaitingHttpResponse),
    lastTemplateKey,
    lastChannel,
    start,
    cancel,
    retry,
    dismissResult,
  }
}
