'use client'

import { useRef, useEffect, useMemo } from 'react'
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
  Play,
} from 'lucide-react'
import type { ExtractionRun, ExtractionState } from '@/lib/hooks/useExtractionStatus'

// ============================================================================
// Pipeline stage definitions — time-based estimation when n8n doesn't report
// ============================================================================

interface PipelineStage {
  key: string
  label: string
  /** Cumulative seconds into the run when this stage typically starts */
  startsAt: number
}

const VEP001_STAGES: PipelineStage[] = [
  { key: 'fetch', label: 'Fetching internal data', startsAt: 0 },
  { key: 'classify', label: 'AI classification', startsAt: 10 },
  { key: 'ingest', label: 'Ingesting evidence', startsAt: 30 },
  { key: 'complete', label: 'Finalizing', startsAt: 50 },
]
const VEP001_TYPICAL_DURATION_S = 60

// VEP-002 scrapes 5 platforms via Apify — runs typically take 7–38 minutes
const VEP002_STAGES: PipelineStage[] = [
  { key: 'scrape', label: 'Scraping platforms', startsAt: 0 },
  { key: 'extract', label: 'Extracting results', startsAt: 600 },
  { key: 'ingest_market', label: 'Ingesting market intel', startsAt: 720 },
  { key: 'classify', label: 'AI classification', startsAt: 780 },
  { key: 'pain_points', label: 'Creating pain points', startsAt: 900 },
  { key: 'complete', label: 'Finalizing', startsAt: 1020 },
]
const VEP002_TYPICAL_DURATION_S = 1200

const DEFAULT_STAGES: PipelineStage[] = [
  { key: 'processing', label: 'Processing', startsAt: 0 },
]
const DEFAULT_TYPICAL_DURATION_S = 120

const VEP002_DURATION_BY_SCOPE: Record<number, number> = {
  5: 180,
  10: 540,
  20: 1200,
}

function getStagesForWorkflow(workflowId?: string, maxResults?: number): { stages: PipelineStage[]; typicalDurationS: number } {
  if (workflowId === 'vep001') return { stages: VEP001_STAGES, typicalDurationS: VEP001_TYPICAL_DURATION_S }
  if (workflowId === 'vep002') {
    const duration = (maxResults && VEP002_DURATION_BY_SCOPE[maxResults]) || VEP002_TYPICAL_DURATION_S
    const scale = duration / VEP002_TYPICAL_DURATION_S
    const scaledStages = VEP002_STAGES.map(s => ({ ...s, startsAt: Math.round(s.startsAt * scale) }))
    return { stages: scaledStages, typicalDurationS: duration }
  }
  return { stages: DEFAULT_STAGES, typicalDurationS: DEFAULT_TYPICAL_DURATION_S }
}

/**
 * Given elapsed time and stage definitions, determine the current stage
 * and an overall progress percentage (0–100, capped at 95 until complete).
 */
function estimateProgress(
  elapsedMs: number,
  stagesDef: PipelineStage[],
  typicalDurationS: number,
  reportedStages: Record<string, string> | null,
): { currentStageLabel: string; progressPct: number } {
  const stageKeys = new Set(stagesDef.map(s => s.key))
  const pipelineStages = reportedStages
    ? Object.fromEntries(Object.entries(reportedStages).filter(([k]) => stageKeys.has(k)))
    : null
  const hasReported = pipelineStages && Object.keys(pipelineStages).length > 0

  if (hasReported) {
    const completedCount = Object.values(pipelineStages!).filter(s => s === 'complete').length
    const lastReportedKey = Object.keys(pipelineStages!).pop()
    const lastReportedStatus = lastReportedKey ? pipelineStages![lastReportedKey] : null
    const stageIdx = stagesDef.findIndex(s => s.key === lastReportedKey)
    const pct = stageIdx >= 0
      ? Math.min(95, Math.round(((stageIdx + (lastReportedStatus === 'complete' ? 1 : 0.5)) / stagesDef.length) * 100))
      : Math.min(95, Math.round((completedCount / stagesDef.length) * 100))
    const label = stageIdx >= 0
      ? (lastReportedStatus === 'complete' && stageIdx + 1 < stagesDef.length
        ? stagesDef[stageIdx + 1].label
        : stagesDef[stageIdx].label)
      : stagesDef[0].label
    return { currentStageLabel: label, progressPct: Math.max(pct, 2) }
  }

  const elapsedS = elapsedMs / 1000
  let currentLabel = stagesDef[0].label
  for (let i = stagesDef.length - 1; i >= 0; i--) {
    if (elapsedS >= stagesDef[i].startsAt) {
      currentLabel = stagesDef[i].label
      break
    }
  }

  // Asymptotic curve: approaches 90% at typicalDuration, never exceeds 95.
  // Formula: 90 * (1 - e^(-2 * t/T))  — fast early, slows down naturally.
  const ratio = elapsedS / typicalDurationS
  const rawPct = 90 * (1 - Math.exp(-2 * ratio))
  const progressPct = Math.max(2, Math.min(95, Math.round(rawPct)))

  return { currentStageLabel: currentLabel, progressPct }
}

// ============================================================================
// Helpers
// ============================================================================

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

// ============================================================================
// Sub-components
// ============================================================================

export interface ScanScopeOption {
  value: number
  label: string
  hint: string
}

export const SCAN_SCOPE_OPTIONS: ScanScopeOption[] = [
  { value: 5, label: 'Quick Scan', hint: '~2-4 min' },
  { value: 10, label: 'Standard Scan', hint: '~7-12 min' },
  { value: 20, label: 'Deep Scan', hint: '~15-30 min' },
]

interface StatusChipProps {
  label?: string
  state: ExtractionState
  currentRun: ExtractionRun | null
  recentRuns: ExtractionRun[]
  elapsedMs: number
  isDrawerOpen: boolean
  isHistoryOpen: boolean
  toggleDrawer: () => void
  toggleHistory: () => void
  markRunFailed: (runId: string, reason?: string) => void
  onRetry?: (maxResults?: number) => void
  drawerFooterAction?: { label: string; onClick: () => void; disabled?: boolean }
  /** When provided, shows a scope dropdown before the Run action (Social pipeline only) */
  scopeSelector?: {
    selected: number
    onChange: (maxResults: number) => void
  }
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

function chipLabel(
  state: ExtractionState,
  run: ExtractionRun | null,
  elapsedMs: number,
  stageLabel?: string,
): string {
  if (!run) return 'No runs yet'

  switch (state) {
    case 'running':
      return stageLabel
        ? `${stageLabel} · ${formatElapsed(elapsedMs)}`
        : `Running… ${formatElapsed(elapsedMs)}`
    case 'stale':
      return `${formatElapsed(elapsedMs)} — may be stuck`
    case 'failed':
      return 'Failed'
    case 'success': {
      const recent = (Date.now() - new Date(run.completed_at || run.triggered_at).getTime()) < 10000
      if (recent) {
        const count = run.items_inserted ?? 0
        return count > 0 ? `${count} item${count !== 1 ? 's' : ''} extracted` : 'No new content'
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

// ============================================================================
// Progress bar component
// ============================================================================

function ScopeDropdown({ selected, onChange }: { selected: number; onChange: (v: number) => void }) {
  return (
    <select
      value={selected}
      onChange={e => onChange(Number(e.target.value))}
      className="text-xs bg-gray-900/80 text-gray-300 border border-gray-700/60 rounded px-2 py-1 focus:outline-none focus:border-amber-500/50 cursor-pointer"
    >
      {SCAN_SCOPE_OPTIONS.map(opt => (
        <option key={opt.value} value={opt.value}>
          {opt.label} ({opt.hint})
        </option>
      ))}
    </select>
  )
}

function PipelineProgressBar({
  progressPct,
  stageLabel,
  stale,
}: {
  progressPct: number
  stageLabel: string
  stale: boolean
}) {
  const barColor = stale ? 'bg-orange-500' : 'bg-amber-500'
  const trackColor = stale ? 'bg-orange-500/10' : 'bg-amber-500/10'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-400">{stageLabel}</span>
        <span className="text-gray-500 tabular-nums">{progressPct}%</span>
      </div>
      <div className={`h-1.5 w-full rounded-full ${trackColor} overflow-hidden`}>
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ============================================================================
// Main component
// ============================================================================

export function ExtractionStatusChip({
  label,
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
  drawerFooterAction,
  scopeSelector,
}: StatusChipProps) {
  const chipRef = useRef<HTMLDivElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  const runMaxResults = (currentRun?.stages as Record<string, unknown> | null)?.scope
    ? ((currentRun!.stages as Record<string, unknown>).scope as { maxResults?: number })?.maxResults
    : undefined

  const { stages: stagesDef, typicalDurationS } = useMemo(
    () => getStagesForWorkflow(currentRun?.workflow_id, runMaxResults),
    [currentRun?.workflow_id, runMaxResults],
  )

  const { currentStageLabel, progressPct } = useMemo(
    () => (state === 'running' || state === 'stale')
      ? estimateProgress(elapsedMs, stagesDef, typicalDurationS, currentRun?.stages ?? null)
      : { currentStageLabel: '', progressPct: 0 },
    [state, elapsedMs, stagesDef, typicalDurationS, currentRun?.stages],
  )

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

  const runningStageLabel = (state === 'running' || state === 'stale') ? currentStageLabel : undefined

  return (
    <div className="relative" ref={chipRef}>
      {/* Chip */}
      <button
        onClick={toggleDrawer}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/80 border border-gray-700/60 hover:border-gray-600 transition-colors text-xs cursor-pointer"
        aria-expanded={isDrawerOpen}
        aria-label={`${label ? label + ' ' : ''}Status: ${chipLabel(state, currentRun, elapsedMs, runningStageLabel)}`}
      >
        <StatusDot state={state} />
        <span className="text-gray-300">
          {label && <span className="text-gray-500 mr-1">{label}</span>}
          {chipLabel(state, currentRun, elapsedMs, runningStageLabel)}
        </span>
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
            className="absolute left-0 top-full mt-2 w-[360px] bg-gray-800/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden"
          >
            {/* Current run detail */}
            {currentRun && (
              <div className="p-4">
                {/* Running */}
                {(state === 'running' || state === 'stale') && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                      <span className="text-sm font-medium text-gray-200">
                        {state === 'stale' ? 'May be stuck' : currentStageLabel}
                      </span>
                      <span className="text-xs text-gray-500 ml-auto tabular-nums">{formatElapsed(elapsedMs)}</span>
                    </div>
                    {currentRun.meeting_title && (
                      <div className="text-xs text-gray-400 mb-3 truncate">{currentRun.meeting_title}</div>
                    )}
                    <PipelineProgressBar
                      progressPct={progressPct}
                      stageLabel={currentStageLabel}
                      stale={state === 'stale'}
                    />
                    {state === 'stale' && (
                      <p className="mt-2 text-xs text-orange-400/80">Running longer than expected — the workflow may have stalled</p>
                    )}
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => markRunFailed(currentRun.id, 'Cancelled by user')}
                        className="text-xs px-2.5 py-1 rounded bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30 transition-colors"
                        title="Stop this run"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Success */}
                {state === 'success' && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-sm font-medium text-gray-200">
                        {(currentRun.items_inserted ?? 0) > 0
                          ? `${currentRun.items_inserted} item${currentRun.items_inserted !== 1 ? 's' : ''} created`
                          : 'No new content'}
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
                      {onRetry && (
                        <div className="ml-auto flex items-center gap-2">
                          {scopeSelector && (
                            <ScopeDropdown selected={scopeSelector.selected} onChange={scopeSelector.onChange} />
                          )}
                          <button
                            onClick={() => onRetry(scopeSelector?.selected)}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-amber-600/20 text-amber-400 border border-amber-600/30 hover:bg-amber-600/30 transition-colors"
                            title="Run again"
                          >
                            <Play className="w-3 h-3" />
                            Run
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Failed */}
                {state === 'failed' && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-sm font-medium text-gray-200">Failed</span>
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
                        <div className="flex items-center gap-2 ml-auto">
                          {scopeSelector && (
                            <ScopeDropdown selected={scopeSelector.selected} onChange={scopeSelector.onChange} />
                          )}
                          <button
                            onClick={() => onRetry(scopeSelector?.selected)}
                            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded bg-blue-600/20 text-blue-400 border border-blue-600/30 hover:bg-blue-600/30 transition-colors"
                            title="Re-run the extraction"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Retry
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Idle — show last run summary */}
                {state === 'idle' && (
                  <div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-sm text-gray-400">
                        Last run {timeAgo(currentRun.completed_at || currentRun.triggered_at)}
                      </span>
                      {currentRun.items_inserted != null && (
                        <span className="text-xs text-gray-500">· {currentRun.items_inserted} items</span>
                      )}
                    </div>
                    {onRetry && (
                      <div className="flex items-center gap-2 mt-2 justify-end">
                        {scopeSelector && (
                          <ScopeDropdown selected={scopeSelector.selected} onChange={scopeSelector.onChange} />
                        )}
                        <button
                          onClick={() => onRetry(scopeSelector?.selected)}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-amber-600/20 text-amber-400 border border-amber-600/30 hover:bg-amber-600/30 transition-colors"
                          title="Run this workflow"
                        >
                          <Play className="w-3 h-3" />
                          Run
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!currentRun && (
              <div className="p-4">
                <p className="text-xs text-gray-500 mb-3">
                  No runs yet. Use Run to start the first sync.
                </p>
                {onRetry && (
                  <div className="flex items-center gap-2">
                    {scopeSelector && (
                      <ScopeDropdown selected={scopeSelector.selected} onChange={scopeSelector.onChange} />
                    )}
                    <button
                      type="button"
                      onClick={() => onRetry(scopeSelector?.selected)}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-amber-600/20 text-amber-400 border border-amber-600/30 hover:bg-amber-600/30 transition-colors font-medium"
                      title="Start a run"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Run
                    </button>
                  </div>
                )}
              </div>
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

            {drawerFooterAction && (
              <div className="border-t border-gray-700/60 px-4 py-2.5 bg-gray-900/40">
                <button
                  type="button"
                  onClick={drawerFooterAction.onClick}
                  disabled={drawerFooterAction.disabled}
                  className="text-xs text-amber-400/90 hover:text-amber-300 underline underline-offset-2 disabled:opacity-40 disabled:pointer-events-none"
                >
                  {drawerFooterAction.label}
                </button>
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

// ============================================================================
// Run History Slide-Over
// ============================================================================

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
