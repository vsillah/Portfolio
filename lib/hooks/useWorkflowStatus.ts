'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getCurrentSession } from '@/lib/auth'

export interface ExtractionRun {
  id: string
  workflow_id?: string
  triggered_at: string
  completed_at: string | null
  status: 'running' | 'success' | 'failed'
  stages: Record<string, string> | null
  items_inserted: number | null
  error_message: string | null
  meeting_record_id: string | null
  meeting_title: string | null
  stale: boolean
  scope_type: string | null
  scope_id: string | null
  scope_label: string | null
}

export type ExtractionState = 'idle' | 'running' | 'success' | 'failed' | 'stale'

export interface WorkflowStatusConfig {
  apiBase: string
  workflowId?: string
}

const POLL_INTERVAL_MS = 5000
const SUCCESS_DISPLAY_MS = 8000

export function useWorkflowStatus(
  config: WorkflowStatusConfig,
  onQueueRefresh?: () => void,
) {
  const [currentRun, setCurrentRun] = useState<ExtractionRun | null>(null)
  const [recentRuns, setRecentRuns] = useState<ExtractionRun[]>([])
  const [state, setState] = useState<ExtractionState>('idle')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoCollapseRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevStateRef = useRef<ExtractionState>('idle')

  const buildUrl = useCallback((extra?: Record<string, string>) => {
    const params = new URLSearchParams()
    if (config.workflowId) params.set('workflow_id', config.workflowId)
    if (extra) {
      for (const [k, v] of Object.entries(extra)) params.set(k, v)
    }
    const qs = params.toString()
    return qs ? `${config.apiBase}?${qs}` : config.apiBase
  }, [config.apiBase, config.workflowId])

  const [runningCount, setRunningCount] = useState(0)

  const fetchRuns = useCallback(async (activeOnly = false) => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const extra: Record<string, string> = { limit: '10' }
      if (activeOnly) extra.active = 'true'

      const res = await fetch(buildUrl(extra), {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!res.ok) return

      const data = await res.json()
      const runs: ExtractionRun[] = data.runs || []

      setRecentRuns(runs)
      setRunningCount(data.running_count ?? runs.filter(r => r.status === 'running').length)

      const latest = runs[0] || null
      setCurrentRun(latest)

      if (!latest) {
        setState('idle')
      } else if (latest.stale) {
        setState('stale')
      } else if (latest.status === 'running') {
        setState('running')
      } else if (latest.status === 'failed') {
        setState('failed')
      } else if (latest.status === 'success') {
        setState('success')
      } else {
        setState('idle')
      }
    } catch {
      // Silent fail — polling will retry
    }
  }, [buildUrl])

  useEffect(() => {
    fetchRuns()
  }, [fetchRuns])

  useEffect(() => {
    const prev = prevStateRef.current
    prevStateRef.current = state

    if (state === 'running' || state === 'stale') {
      if (!pollRef.current) {
        pollRef.current = setInterval(() => fetchRuns(), POLL_INTERVAL_MS)
      }

      if (!timerRef.current && currentRun) {
        const start = new Date(currentRun.triggered_at).getTime()
        setElapsedMs(Date.now() - start)
        timerRef.current = setInterval(() => {
          setElapsedMs(Date.now() - start)
        }, 1000)
      }
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    if (state === 'success' && prev === 'running') {
      setIsDrawerOpen(true)
      onQueueRefresh?.()

      autoCollapseRef.current = setTimeout(() => {
        setIsDrawerOpen(false)
      }, SUCCESS_DISPLAY_MS)
    }

    if (state === 'failed' && prev === 'running') {
      setIsDrawerOpen(true)
    }

    return () => {
      if (autoCollapseRef.current) {
        clearTimeout(autoCollapseRef.current)
      }
    }
  }, [state, currentRun, fetchRuns, onQueueRefresh])

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
      if (autoCollapseRef.current) clearTimeout(autoCollapseRef.current)
    }
  }, [])

  const toggleDrawer = useCallback(() => {
    setIsDrawerOpen(prev => !prev)
  }, [])

  const toggleHistory = useCallback(() => {
    setIsHistoryOpen(prev => !prev)
  }, [])

  const onTriggerStarted = useCallback((runId?: string) => {
    const optimisticRun: ExtractionRun = {
      id: runId || 'optimistic',
      workflow_id: config.workflowId ?? undefined,
      triggered_at: new Date().toISOString(),
      completed_at: null,
      status: 'running',
      stages: {},
      items_inserted: null,
      error_message: null,
      meeting_record_id: null,
      meeting_title: null,
      stale: false,
      scope_type: null,
      scope_id: null,
      scope_label: null,
    }
    setCurrentRun(optimisticRun)
    setState('running')
    setElapsedMs(0)
  }, [config.workflowId])

  const markRunFailed = useCallback(async (runId: string, reason?: string) => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      await fetch(config.apiBase, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ run_id: runId, reason }),
      })

      fetchRuns()
    } catch {
      // Silent fail
    }
  }, [config.apiBase, fetchRuns])

  return {
    state,
    currentRun,
    recentRuns,
    runningCount,
    elapsedMs,
    isDrawerOpen,
    isHistoryOpen,
    toggleDrawer,
    toggleHistory,
    onTriggerStarted,
    markRunFailed,
    refetch: fetchRuns,
  }
}
