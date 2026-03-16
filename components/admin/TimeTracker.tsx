'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Square, Clock } from 'lucide-react'

interface TimeEntry {
  id: string
  target_type: string
  target_id: string
  duration_seconds: number | null
  started_at: string | null
  is_running: boolean
}

interface TimeTrackerProps {
  projectId: string
  targetType: 'milestone' | 'task'
  targetId: string
  accessToken: string
  entries?: TimeEntry[]
  onEntryChange?: () => void
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatTotalHours(seconds: number): string {
  if (seconds === 0) return '0h'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

export default function TimeTracker({
  projectId,
  targetType,
  targetId,
  accessToken,
  entries = [],
  onEntryChange,
}: TimeTrackerProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number | null>(null)

  const myEntries = entries.filter(
    (e) => e.target_type === targetType && e.target_id === targetId
  )

  const totalLogged = myEntries
    .filter((e) => !e.is_running && e.duration_seconds)
    .reduce((sum, e) => sum + (e.duration_seconds || 0), 0)

  const runningEntry = myEntries.find((e) => e.is_running)

  useEffect(() => {
    if (runningEntry) {
      setIsRunning(true)
      setActiveEntryId(runningEntry.id)
      const startedMs = new Date(runningEntry.started_at!).getTime()
      startTimeRef.current = startedMs
      const now = Date.now()
      setElapsed(Math.round((now - startedMs) / 1000))
    } else {
      setIsRunning(false)
      setActiveEntryId(null)
      setElapsed(0)
      startTimeRef.current = null
    }
  }, [runningEntry])

  useEffect(() => {
    if (isRunning && startTimeRef.current) {
      intervalRef.current = setInterval(() => {
        setElapsed(Math.round((Date.now() - startTimeRef.current!) / 1000))
      }, 1000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isRunning])

  const handleStart = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/time-entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          client_project_id: projectId,
          target_type: targetType,
          target_id: targetId,
        }),
      })
      if (res.ok) {
        const { entry } = await res.json()
        setIsRunning(true)
        setActiveEntryId(entry.id)
        startTimeRef.current = new Date(entry.started_at).getTime()
        setElapsed(0)
        onEntryChange?.()
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [projectId, targetType, targetId, accessToken, onEntryChange])

  const handleStop = useCallback(async () => {
    if (!activeEntryId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/time-entries/${activeEntryId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      })
      if (res.ok) {
        setIsRunning(false)
        setActiveEntryId(null)
        setElapsed(0)
        startTimeRef.current = null
        if (intervalRef.current) clearInterval(intervalRef.current)
        onEntryChange?.()
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [activeEntryId, accessToken, onEntryChange])

  return (
    <div className="flex items-center gap-2">
      {totalLogged > 0 && (
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <Clock size={10} />
          {formatTotalHours(totalLogged)}
        </span>
      )}

      {isRunning ? (
        <>
          <span className="text-xs font-mono text-blue-400 tabular-nums min-w-[60px]">
            {formatDuration(elapsed)}
          </span>
          <button
            onClick={handleStop}
            disabled={loading}
            className="p-1.5 rounded-md bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
            title="Stop timer"
          >
            <Square size={12} fill="currentColor" />
          </button>
        </>
      ) : (
        <button
          onClick={handleStart}
          disabled={loading}
          className="p-1.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
          title="Start timer"
        >
          <Play size={12} fill="currentColor" />
        </button>
      )}
    </div>
  )
}
