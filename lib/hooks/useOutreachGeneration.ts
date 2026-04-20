'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getCurrentSession } from '@/lib/auth'
import type { EmailTemplateKey } from '@/lib/constants/prompt-keys'

/**
 * Phase 1 hook for the <OutreachGenerationPill /> component.
 *
 * Pure UI state machine over the existing `POST /api/admin/outreach/leads/:id/generate`
 * endpoint (n8n WF-CLG-002). No polling, no status endpoint, no runs table yet.
 *
 * Running state is derived from a local pending flag plus a 25s safety timer. On
 * timer expiry we auto-settle to `idle` and ask the parent to refetch leads so
 * the "Generate Email" button swaps to "View Drafts" once messages_count updates.
 *
 * Phase 2 will add a `templateKey` argument to `start()` and plumb it through to
 * the API route. Phase 3 will replace the timer with real `/status` polling and
 * wire a backend-aware `/cancel` endpoint.
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
}

const SAFETY_TIMEOUT_MS = 25_000
const CANCELLED_DISPLAY_MS = 4_000
const SUCCEEDED_DISPLAY_MS = 3_000

function phaseFor(elapsedMs: number): string {
  if (elapsedMs < 2_000) return 'Queuing…'
  if (elapsedMs < 18_000) return 'Generating…'
  if (elapsedMs < SAFETY_TIMEOUT_MS) return 'Saving draft…'
  return 'Still working…'
}

export function useOutreachGeneration({
  leadId,
  leadName,
  onToast,
  onFallbackAvailable,
  onSettled,
  onFallbackCleared,
}: UseOutreachGenerationOptions): UseOutreachGenerationReturn {
  const [state, setState] = useState<OutreachGenerationState>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [lastTemplateKey, setLastTemplateKey] = useState<EmailTemplateKey | null>(null)

  const startedAtRef = useRef<number | null>(null)
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transientTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (tickTimerRef.current) clearInterval(tickTimerRef.current)
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current)
      if (transientTimerRef.current) clearTimeout(transientTimerRef.current)
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
  }, [])

  const settleToIdle = useCallback(
    (reason: 'timeout' | 'cancel' | 'success') => {
      clearTimers()
      startedAtRef.current = null
      if (!mountedRef.current) return
      setElapsedMs(0)
      if (reason === 'success') {
        setState('succeeded')
        transientTimerRef.current = setTimeout(() => {
          if (!mountedRef.current) return
          setState('idle')
        }, SUCCEEDED_DISPLAY_MS)
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

  const beginRunning = useCallback(() => {
    clearTimers()
    startedAtRef.current = Date.now()
    setElapsedMs(0)
    setState('running')

    tickTimerRef.current = setInterval(() => {
      if (!startedAtRef.current || !mountedRef.current) return
      setElapsedMs(Date.now() - startedAtRef.current)
    }, 250)

    safetyTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return
      onToast?.(`Check the Message Queue for the draft for ${leadName}.`)
      settleToIdle('success')
    }, SAFETY_TIMEOUT_MS)
  }, [clearTimers, leadName, onToast, settleToIdle])

  const performGenerate = useCallback(async (templateKey?: EmailTemplateKey) => {
    const session = await getCurrentSession()
    if (!session) {
      onToast?.('Please sign in to continue.')
      return
    }

    beginRunning()
    if (templateKey) setLastTemplateKey(templateKey)

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

      if (data?.triggered) {
        onFallbackCleared?.()
        onToast?.(`Email generation started for ${leadName}`)
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
      clearTimers()
      startedAtRef.current = null
      setElapsedMs(0)
      setState('failed')
      onFallbackAvailable?.()
      onToast?.(`n8n unavailable for ${leadName} — use Draft in app`)
    }
  }, [
    beginRunning,
    clearTimers,
    leadId,
    leadName,
    onFallbackAvailable,
    onFallbackCleared,
    onToast,
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
      `Stopped watching ${leadName}. The draft may still appear in your Message Queue.`,
    )
    settleToIdle('cancel')
  }, [leadName, onToast, settleToIdle, state])

  return {
    state,
    elapsedMs,
    phaseLabel: phaseFor(elapsedMs),
    lastTemplateKey,
    start,
    cancel,
    retry,
  }
}
