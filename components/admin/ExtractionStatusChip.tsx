'use client'

import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Clock,
  RotateCcw,
  X,
  History,
} from 'lucide-react'
import type { ExtractionRun, ExtractionState } from '@/lib/hooks/useExtractionStatus'

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return min > 0 ? `${min}:${String(sec).padStart(2, '0')}` : `${sec}s`
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return formatElapsed(ms)
}

function timeAgo(date: string): string {
  const ms = Date.now() - new Date(date).getTime()
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  return `${d}d ago`
}

interface StatusChipProps {
  state: ExtractionState
  currentRun: ExtractionRun | null
  recentRuns: ExtractionRun[]
  elapsedMs: number
  isDrawerOpen: boolean
  isHistoryOpen: boolean
  toggleDrawer: () => void
  toggleHistory: () => void
  markRunFailed: (runId: string) => void
  onRetry?: () => void
}

const DOT_COLORS: Record<ExtractionState, string> = {
  idle: 'bg-emerald-400',
  running: 'bg-amber-400',
  success: 'bg-emerald-400',
  failed: 'bg-red-400',
  stale: 'bg-orange-400',
}

function StatusDot({ state }: { state: ExtractionState }) {
  const pulse = state === 'running' || state === 'stale'
  return (
    <span className="relative flex h-2 w-2">
      {pulse && (
        <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${DOT_COLORS[state]}`} />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${DOT_COLORS[state]}`} />
    </span>
  )
}

function chipLabel(state: ExtractionState, run: ExtractionRun | null, elapsedMs: number): string {
  if (!run) return 'No runs yet'

  switch (state) {
    case 'running':
      return `Extracting… ${formatElapsed(elapsedMs)}`
    case 'stale':
      return `Running ${formatElapsed(elapsedMs)} — may be stuck`
    case 'failed':
      return 'Extraction failed'
    case 'success': {
      const recent = (Date.now() - new Date(run.completed_at || run.triggered_at).getTime()) < 10000
      if (recent) {
        const count = run.items_inserted ?? 0
        return count > 0 ? `${count} item${count !== 1 ? 's' : ''} extracted` : 'No new content found'
      }
      const count = run.items_inserted ?? 0
      const label = count > 0 ? `${count} items` : 'Success'
      return `${label} · ${timeAgo(run.completed_at || run.triggered_at)}`
    }
    case 'idle': {
      const ts = run.completed_at || run.triggered_at
      const count = run.items_inserted
      if (count != null && count > 0) {
        return `${count} items · ${timeAgo(ts)}`
      }
      return `Last run ${timeAgo(ts)}`
    }
    default:
      return 'Unknown'
  }
}

function RunRow({ run }: { run: ExtractionRun }) {
  const dotColor = run.status === 'success'
    ? 'bg-emerald-400'
    : run.status === 'failed'
      ? 'bg-red-400'
      : 'bg-amber-400'

  return (
    <div className="flex items-center gap-2.5 py-1.5 text-xs">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
      <span className="text-gray-400 w-[70px] flex-shrink-0">
        {new Date(run.triggered_at).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}{' '}
        {new Date(run.triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
      <span className="text-gray-300 truncate flex-1 min-w-0">
        {run.meeting_title || 'All meetings'}
      </span>
      <span className="text-gray-500 flex-shrink-0">
        {run.items_inserted != null ? `${run.items_inserted} items` : '—'}
      </span>
      <span className="text-gray-600 flex-shrink-0 w-[36px] text-right">
        {formatDuration(run.triggered_at, run.completed_at)}
      </span>
    </div>
  )
}

export function ExtractionStatusChip({
  state,
  currentRun,
  recentRuns,
  elapsedMs,
  isDrawerOpen,
  isHistoryOpen,
  toggleDrawer,
  toggleHistory,
  markRunFailed,
  onRetry,
}: StatusChipProps) {
  const chipRef = useRef<HTMLDivElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isDrawerOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (
        chipRef.current?.contains(e.target as Node) ||
        drawerRef.current?.contains(e.target as Node)
      ) return

      if (state === 'failed' || state === 'stale') return
      if (state === 'running') return

      toggleDrawer()
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isDrawerOpen, state, toggleDrawer])

  const completedRuns = recentRuns.filter(r => r.status !== 'running').slice(0, 3)

  return (
    <div className="relative" ref={chipRef}>
      {/* Chip */}
      <button
        onClick={toggleDrawer}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/80 border border-gray-700/60 hover:border-gray-600 transition-colors text-xs cursor-pointer"
        aria-expanded={isDrawerOpen}
        aria-label={`Extraction status: ${chipLabel(state, currentRun, elapsedMs)}`}
      >
        <StatusDot state={state} />
        <span className="text-gray-300">{chipLabel(state, currentRun, elapsedMs)}</span>
        {isDrawerOpen ? (
          <ChevronUp className="w-3 h-3 text-gray-500" />
        ) : (
          <ChevronDown className="w-3 h-3 text-gray-500" />
        )}
      </button>

      {/* Detail Drawer (overlay) */}
      <AnimatePresence>
        {isDrawerOpen && (
          <motion.div
            ref={drawerRef}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-[360px] bg-gray-800/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden"
          >
            {/* Current run detail */}
            {currentRun && (
              <div className="p-4">
                {/* Running */}
                {(state === 'running' || state === 'stale') && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                      <span className="text-sm font-medium text-gray-200">
                        {state === 'stale' ? 'May be stuck' : 'Extracting…'}
                      </span>
                      <span className="text-xs text-gray-500 ml-auto">{formatElapsed(elapsedMs)}</span>
                    </div>
                    {currentRun.meeting_title && (
                      <div className="text-xs text-gray-400 mb-2 truncate">{currentRun.meeting_title}</div>
                    )}
                    {/* Shimmer bar */}
                    <div className="h-1 w-full rounded-full bg-gray-700 overflow-hidden">
                      <div className={`h-full rounded-full ${state === 'stale' ? 'bg-orange-500/60' : 'bg-amber-500/60'} animate-pulse`} style={{ width: '60%' }} />
                    </div>
                    {state === 'stale' && (
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-orange-400/80">Running longer than expected</span>
                        <button
                          onClick={() => markRunFailed(currentRun.id)}
                          className="text-xs px-2.5 py-1 rounded bg-orange-600/20 text-orange-400 border border-orange-600/30 hover:bg-orange-600/30 transition-colors"
                          title="Mark this run as failed so a new extraction can be started"
                        >
                          Mark failed
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Success */}
                {state === 'success' && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-sm font-medium text-gray-200">
                        {(currentRun.items_inserted ?? 0) > 0
                          ? `${currentRun.items_inserted} item${currentRun.items_inserted !== 1 ? 's' : ''} extracted`
                          : 'No new content found'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {currentRun.meeting_title && (
                        <span className="truncate">{currentRun.meeting_title}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(currentRun.triggered_at, currentRun.completed_at)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Failed */}
                {state === 'failed' && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-sm font-medium text-gray-200">Extraction failed</span>
                      <button
                        onClick={toggleDrawer}
                        className="ml-auto p-0.5 rounded hover:bg-gray-700 transition-colors"
                        title="Dismiss"
                      >
                        <X className="w-3 h-3 text-gray-500" />
                      </button>
                    </div>
                    {currentRun.error_message && (
                      <div className="text-xs text-red-400/80 bg-red-500/10 border border-red-500/20 rounded px-2.5 py-1.5 mb-2 line-clamp-3">
                        {currentRun.error_message}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      {currentRun.meeting_title && (
                        <span className="text-xs text-gray-500 truncate flex-1">{currentRun.meeting_title}</span>
                      )}
                      {onRetry && (
                        <button
                          onClick={onRetry}
                          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded bg-blue-600/20 text-blue-400 border border-blue-600/30 hover:bg-blue-600/30 transition-colors"
                          title="Re-run the extraction"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Idle — show last run summary */}
                {state === 'idle' && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-sm text-gray-400">
                      Last run {timeAgo(currentRun.completed_at || currentRun.triggered_at)}
                    </span>
                    {currentRun.items_inserted != null && (
                      <span className="text-xs text-gray-500">· {currentRun.items_inserted} items</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {!currentRun && (
              <div className="p-4 text-xs text-gray-500">No extraction runs yet.</div>
            )}

            {/* Recent runs */}
            {completedRuns.length > 0 && (
              <div className="border-t border-gray-700/60 px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-gray-600 font-medium">Recent</span>
                  <button
                    onClick={toggleHistory}
                    className="inline-flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                    title="View full extraction history"
                  >
                    <History className="w-3 h-3" />
                    View all
                  </button>
                </div>
                {completedRuns.map(run => (
                  <RunRow key={run.id} run={run} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Run History Slide-Over */}
      <AnimatePresence>
        {isHistoryOpen && <RunHistorySlideOver runs={recentRuns} onClose={toggleHistory} />}
      </AnimatePresence>
    </div>
  )
}

function RunHistorySlideOver({
  runs,
  onClose,
}: {
  runs: ExtractionRun[]
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-[60]"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        ref={panelRef}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 w-[400px] max-w-[90vw] bg-gray-900 border-l border-gray-700 z-[61] overflow-y-auto"
        role="dialog"
        aria-label="Extraction run history"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <h2 className="text-sm font-semibold text-gray-200">Run History</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-800 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-2">
          {runs.length === 0 && (
            <p className="text-xs text-gray-500 py-8 text-center">No extraction runs yet.</p>
          )}

          {runs.map(run => (
            <RunHistoryCard key={run.id} run={run} />
          ))}
        </div>
      </motion.div>
    </>
  )
}

function RunHistoryCard({ run }: { run: ExtractionRun }) {
  const statusIcon = run.status === 'success'
    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
    : run.status === 'failed'
      ? <XCircle className="w-3.5 h-3.5 text-red-400" />
      : run.stale
        ? <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
        : <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />

  const statusLabel = run.status === 'success'
    ? 'Success'
    : run.status === 'failed'
      ? 'Failed'
      : run.stale
        ? 'Stale'
        : 'Running'

  return (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1.5">
        {statusIcon}
        <span className="text-xs font-medium text-gray-300">{statusLabel}</span>
        {run.items_inserted != null && (
          <span className="text-xs text-gray-500">· {run.items_inserted} items</span>
        )}
        {run.completed_at && (
          <span className="text-xs text-gray-600 ml-auto flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDuration(run.triggered_at, run.completed_at)}
          </span>
        )}
      </div>
      <div className="text-xs text-gray-500">
        {new Date(run.triggered_at).toLocaleString([], {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        })}
        {run.meeting_title && (
          <span className="ml-2 text-gray-400">· {run.meeting_title}</span>
        )}
      </div>
      {run.error_message && (
        <div className="mt-1.5 text-xs text-red-400/70 line-clamp-2">
          {run.error_message}
        </div>
      )}
    </div>
  )
}
