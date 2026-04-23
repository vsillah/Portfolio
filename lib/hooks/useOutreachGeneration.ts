'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getCurrentSession } from '@/lib/auth'
import type { EmailTemplateKey } from '@/lib/constants/prompt-keys'

/**
 * Phase 1 hook for <OutreachEmailGenerateRow /> (n8n path).
 *
 * Pure UI state machine over the existing `POST /api/admin/outreach/leads/:id/generate`
 * endpoint (n8n WF-CLG-002). While waiting for a `outreach_queue` row, the parent
 * `onSettled` callback should refetch leads in the background.
 *
 * Running state uses a safety timer. When the API reports `queueCountImmediate === 0`
 * after n8n returns 200, we wait longer and refetch periodically — HTTP success does
 * not guarantee a DB row yet. If no draft appears, we surface the in-app fallback.
 *
 * Succeeded (draft detected or immediate queue row) stays visible until a new
 * `start`, `dismissResult`, or `retry` — it does not auto-clear after a few
 * seconds (parent should pass `onSettled` to refetch lead rows and Email — recent).
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
  lastTemplateKey: EmailTemplateKey | null
  start: (templateKey?: EmailTemplateKey) => Promise<void>
  cancel: () => void
  retry: () => Promise<void>
  /** Clears a sticky success state so the main Outreach control returns to idle. */
  dismissResult: () => void
}

const SAFETY_TIMEOUT_MS = 25_000
/** When n8n returns 200 but outreach_queue is still empty, wait before giving up. */
const EXTENDED_DRAFT_WAIT_MS = 75_000
const REFETCH_POLL_MS = 4_000
const CANCELLED_DISPLAY_MS = 4_000

function phaseFor(
  elapsedMs: number,
  extendedDraftWait: boolean,
  awaitingHttpResponse: boolean,
): string {
  if (awaitingHttpResponse) {
    if (elapsedMs < 2_500) return 'Starting…'
    return 'Contacting n8n…'
  }
  const cap = extendedDraftWait ? EXTENDED_DRAFT_WAIT_MS : SAFETY_TIMEOUT_MS
  if (elapsedMs < 2_000) return 'Queuing…'
  if (elapsedMs < (extendedDraftWait ? 40_000 : 18_000)) return 'Generating…'
  if (elapsedMs < cap - 5_000) return 'Saving draft…'
  return 'Still working…'
}

export function useOutreachGeneration({
  leadId,
  leadName,
  messagesCount,
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
  const [lastTemplateKey, setLastTemplateKey] = useState<EmailTemplateKey | null>(null)

  const startedAtRef = useRef<number | null>(null)
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transientTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refetchPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const messagesCountRef = useRef(messagesCount)
  const messagesAtGenerationStartRef = useRef(0)
  const mountedRef = useRef(true)

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

    tickTimerRef.current = setInterval(() => {
      if (!startedAtRef.current || !mountedRef.current) return
      setElapsedMs(Date.now() - startedAtRef.current)
    }, 250)
  }, [clearTimers])

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
        `No draft appeared after waiting. Use Draft in app or check n8n for ${leadName}.`,
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

  const performGenerate = useCallback(async (templateKey?: EmailTemplateKey) => {
    const session = await getCurrentSession()
    if (!session) {
      onToast?.('Please sign in to continue.')
      return
    }

    if (templateKey) setLastTemplateKey(templateKey)

    // Optimistic: a new n8n run is starting — hide the previous "n8n unavailable" UI.
    onFallbackCleared?.()

    startOptimisticRunning()

    try {
      const res = await fetch(`/api/admin/outreach/leads/${leadId}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: templateKey ? JSON.stringify({ templateKey }) : undefined,
      })
      const data = await res.json().catch(() => ({}))
      if (!mountedRef.current) return

      setAwaitingHttpResponse(false)

      const rawQ = (data as { queueCountImmediate?: unknown }).queueCountImmediate
      const queueCountImmediate = typeof rawQ === 'number' ? rawQ : null

      if (data?.triggered) {
        onFallbackCleared?.()
        if (queueCountImmediate !== null && queueCountImmediate > 0) {
          onToast?.(`Draft is ready for ${leadName} — open Email center`)
          settleToIdle('success')
          return
        }
        attachExtendedDraftWaitTimers()
        onToast?.(`n8n accepted this job — waiting for a draft to appear…`)
      } else {
        clearTimers()
        startedAtRef.current = null
        setElapsedMs(0)
        setState('failed')
        onFallbackAvailable?.()
        onToast?.(`n8n unavailable for ${leadName} — use Draft in app`)
      }
    } catch {
      if (!mountedRef.current) return
      setAwaitingHttpResponse(false)
      clearTimers()
      startedAtRef.current = null
      setElapsedMs(0)
      setState('failed')
      onFallbackAvailable?.()
      onToast?.(`n8n unavailable for ${leadName} — use Draft in app`)
    }
  }, [
    attachExtendedDraftWaitTimers,
    clearTimers,
    leadId,
    leadName,
    onFallbackAvailable,
    onFallbackCleared,
    onToast,
    settleToIdle,
    startOptimisticRunning,
  ])

  const start = useCallback(
    async (templateKey?: EmailTemplateKey) => {
      await performGenerate(templateKey)
    },
    [performGenerate],
  )

  const retry = useCallback(async () => {
    await performGenerate(lastTemplateKey ?? undefined)
  }, [performGenerate, lastTemplateKey])

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
    start,
    cancel,
    retry,
    dismissResult,
  }
}
