'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronUp, ExternalLink, FileText, History, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { PipelineProgressBar } from '@/components/admin/ExtractionStatusChip'

export interface GammaDeckHistoryItem {
  id: string
  title: string | null
  status: string
  created_at: string
  gamma_url: string | null
  contact_submissions: { id: number; name: string } | null
}

const GAMMA_DECK_STAGES: { label: string; startsAt: number }[] = [
  { label: 'Sending to Gamma', startsAt: 0 },
  { label: 'Rendering slides', startsAt: 10 },
  { label: 'Finalizing deck', startsAt: 32 },
]

const GAMMA_TYPICAL_DURATION_S = 52

/** Matches `ExtractionStatusChip` recent list (`completedRuns.slice(0, 3)`). */
export const GAMMA_DRAWER_RECENT_RUNS = 3

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return min > 0 ? `${min}:${String(sec).padStart(2, '0')}` : `${sec}s`
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

function estimateGammaDeckProgress(elapsedMs: number): {
  currentStageLabel: string
  progressPct: number
  stepIndex: number
  stepTotal: number
} {
  const stagesDef = GAMMA_DECK_STAGES
  const typicalDurationS = GAMMA_TYPICAL_DURATION_S
  const elapsedS = elapsedMs / 1000
  let currentLabel = stagesDef[0].label
  let stageIdx = 0
  for (let i = stagesDef.length - 1; i >= 0; i--) {
    if (elapsedS >= stagesDef[i].startsAt) {
      currentLabel = stagesDef[i].label
      stageIdx = i
      break
    }
  }
  const nextStart =
    stageIdx + 1 < stagesDef.length ? stagesDef[stageIdx + 1].startsAt : typicalDurationS
  const segStart = stagesDef[stageIdx].startsAt
  const segLen = Math.max(8, nextStart - segStart)
  const t = Math.min(1, Math.max(0, (elapsedS - segStart) / segLen))
  const eased = 1 - Math.exp(-2.8 * t)
  const base = (stageIdx / stagesDef.length) * 88
  const span = (1 / stagesDef.length) * 88
  const progressPct = Math.round(Math.min(94, Math.max(3, base + eased * span * 0.92)))
  return {
    currentStageLabel: currentLabel,
    progressPct,
    stepIndex: stageIdx + 1,
    stepTotal: stagesDef.length,
  }
}

function DeckStatusDot({
  kind,
  pulse,
}: {
  kind: 'success' | 'failed' | 'pending' | 'running'
  pulse?: boolean
}) {
  const color =
    kind === 'success'
      ? 'bg-emerald-400'
      : kind === 'failed'
        ? 'bg-red-400'
        : kind === 'running'
          ? 'bg-amber-400'
          : 'bg-gray-500'
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {pulse && (
        <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${color}`} />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
    </span>
  )
}

function HistoryList({
  reports,
  maxRecent,
  fullReportHistoryHref,
  onNavigateFullHistory,
}: {
  reports: GammaDeckHistoryItem[]
  maxRecent: number
  fullReportHistoryHref: string
  onNavigateFullHistory: () => void
}) {
  const recent = reports.slice(0, maxRecent)
  const total = reports.length

  if (reports.length === 0) {
    return (
      <div>
        <p className="text-xs text-gray-500 px-3 py-4">
          No runs for this template yet. Generate a deck and it will appear here.
        </p>
        <div className="border-t border-gray-700/60 px-3 py-2.5 bg-gray-900/40">
          <a
            href={fullReportHistoryHref}
            onClick={onNavigateFullHistory}
            className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            <History className="w-3 h-3 shrink-0" />
            View full report history below
          </a>
        </div>
      </div>
    )
  }
  return (
    <div>
      <ul className="max-h-56 overflow-y-auto py-1">
        {recent.map((r) => (
          <li
            key={r.id}
            className="px-3 py-2 hover:bg-gray-700/40 flex items-start gap-2 text-xs border-b border-gray-800/50 last:border-0"
          >
            <span
              className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                (r.status || '').toLowerCase() === 'failed' ? 'bg-red-400' : 'bg-emerald-400'
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-gray-200 truncate">{r.title || 'Untitled'}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {new Date(r.created_at).toLocaleString()}
                {r.contact_submissions ? ` · ${r.contact_submissions.name}` : ''}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {r.gamma_url ? (
                  <a
                    href={r.gamma_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-0.5"
                  >
                    Open <ExternalLink className="w-3 h-3" />
                  </a>
                ) : null}
                {r.contact_submissions ? (
                  <Link
                    href={`/admin/contacts/${r.contact_submissions.id}`}
                    className="text-gray-400 hover:text-gray-300"
                  >
                    Contact
                  </Link>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="border-t border-gray-700/60 px-3 py-2.5 bg-gray-900/40">
        <a
          href={fullReportHistoryHref}
          onClick={onNavigateFullHistory}
          className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
          title="Scroll to the full report table (all types) on this page"
        >
          <History className="w-3 h-3 shrink-0" />
          View full report history below
        </a>
        {total > maxRecent ? (
          <p className="text-[10px] text-gray-600 mt-1 pl-[22px]">
            Showing {maxRecent} most recent for this template · {total} total match
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function GammaDeckGenerateRow({
  generating,
  onGenerate,
  templateLabel,
  reportsForTemplate,
  disabled,
  helperTextWhileGenerating,
  fullReportHistoryHref,
  recentRunsLimit = GAMMA_DRAWER_RECENT_RUNS,
  startedAt,
}: {
  generating: boolean
  onGenerate: () => void
  templateLabel: string
  reportsForTemplate: GammaDeckHistoryItem[]
  disabled: boolean
  helperTextWhileGenerating?: string
  /** In-page anchor (e.g. `#gamma-report-history`) for the full Report History table below. */
  fullReportHistoryHref: string
  /** Override default (3) to match other admin “recent” lists. */
  recentRunsLimit?: number
  /**
   * When the generation was started elsewhere (e.g. auto audit_summary on
   * `audit-from-meetings`) and we're tracking its progress from this page,
   * pass the row's `created_at` so the progress estimate and elapsed timer
   * reflect actual wall time instead of restarting from 0 at mount.
   */
  startedAt?: string | Date | null
}) {
  const [elapsedMs, setElapsedMs] = useState(0)
  const startRef = useRef<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const chipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!generating) {
      startRef.current = null
      setElapsedMs(0)
      return
    }
    const fromProvided = startedAt ? new Date(startedAt).getTime() : NaN
    startRef.current = Number.isFinite(fromProvided) ? fromProvided : Date.now()
    const tick = () => {
      if (startRef.current) setElapsedMs(Math.max(0, Date.now() - startRef.current))
    }
    tick()
    const id = window.setInterval(tick, 400)
    return () => window.clearInterval(id)
  }, [generating, startedAt])

  const progress = useMemo(
    () => (generating ? estimateGammaDeckProgress(elapsedMs) : null),
    [generating, elapsedMs],
  )

  const latest = reportsForTemplate[0]

  const latestDotKind = useMemo(() => {
    if (!latest) return 'pending' as const
    const s = (latest.status || '').toLowerCase()
    if (s === 'completed' || s === 'success' || s === 'ready') return 'success' as const
    if (s === 'failed' || s === 'error') return 'failed' as const
    return 'pending' as const
  }, [latest])

  /** One-line summary for the collapsed chip (history folded into Gamma pill). */
  const chipSummary = useMemo(() => {
    if (generating && progress) {
      return `${formatElapsed(elapsedMs)} · ${progress.currentStageLabel}`
    }
    if (!latest) return 'No runs yet'
    const n = reportsForTemplate.length
    return `${n} deck${n !== 1 ? 's' : ''} · ${timeAgo(latest.created_at)}`
  }, [generating, progress, elapsedMs, latest, reportsForTemplate.length])

  useEffect(() => {
    if (!drawerOpen) return
    function onDoc(e: MouseEvent) {
      if (chipRef.current?.contains(e.target as Node)) return
      setDrawerOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [drawerOpen])

  const toggleDrawer = useCallback(() => {
    setDrawerOpen((o) => !o)
  }, [])

  const generateLabel = `Generate ${templateLabel}`

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div
          className={`rounded-lg border transition-all min-w-[min(100%,280px)] flex-1 sm:flex-none ${
            generating
              ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 to-teal-950/30 ring-1 ring-emerald-500/20'
              : 'border-transparent'
          }`}
        >
          <button
            type="button"
            onClick={onGenerate}
            disabled={disabled || generating}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-lg hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                {generateLabel}…
              </>
            ) : (
              <>
                <FileText className="w-5 h-5 shrink-0" />
                {generateLabel}
              </>
            )}
          </button>
          {generating && progress && (
            <div className="px-4 pb-3 pt-0">
              <PipelineProgressBar
                progressPct={progress.progressPct}
                stageLabel={progress.currentStageLabel}
                stale={false}
                barOnly
              />
              <p className="text-[11px] text-emerald-400/85 mt-1.5 tabular-nums" aria-live="polite">
                Step {progress.stepIndex} of {progress.stepTotal}
              </p>
            </div>
          )}
        </div>

        {/* Single pill: Gamma status + milestones; drawer holds full history */}
        <div className="relative" ref={chipRef}>
          <button
            type="button"
            onClick={toggleDrawer}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/80 border border-gray-700/60 hover:border-gray-600 transition-colors text-xs cursor-pointer max-w-[min(100vw-2rem,380px)]"
            aria-expanded={drawerOpen}
            aria-label={`Gamma deck: ${chipSummary}`}
          >
            <DeckStatusDot kind={generating ? 'running' : latestDotKind} pulse={generating} />
            <span className="text-gray-300 text-left min-w-0 flex-1">
              <span className="text-gray-500 mr-1">Gamma</span>
              {progress ? (
                <span className="text-gray-600 mr-1.5 tabular-nums">
                  {progress.stepIndex}/{progress.stepTotal}
                </span>
              ) : null}
              <span className="text-gray-400 break-words">{chipSummary}</span>
            </span>
            {drawerOpen ? (
              <ChevronUp className="w-3 h-3 text-gray-500 shrink-0" />
            ) : (
              <ChevronDown className="w-3 h-3 text-gray-500 shrink-0" />
            )}
          </button>
          <AnimatePresence>
            {drawerOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-full mt-2 w-[min(100vw-2rem,400px)] bg-gray-800/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden"
              >
                <div className="p-4 border-b border-gray-700/80">
                  <p className="text-xs font-medium text-gray-200 mb-1">Template</p>
                  <p className="text-sm text-white">{templateLabel}</p>
                  {generating && progress ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-gray-400">
                        Estimated progress (Gamma does not stream live status).
                      </p>
                      <PipelineProgressBar
                        progressPct={progress.progressPct}
                        stageLabel={progress.currentStageLabel}
                        stale={false}
                      />
                      <p className="text-[11px] text-gray-500 tabular-nums">Elapsed {formatElapsed(elapsedMs)}</p>
                    </div>
                  ) : latest ? (
                    <div className="mt-3 text-xs text-gray-300 space-y-1">
                      <p>
                        <span className="text-gray-500">Latest:</span> {latest.title || 'Untitled'}
                      </p>
                      <p>
                        <span className="text-gray-500">Status:</span> {latest.status}
                      </p>
                      <p>
                        <span className="text-gray-500">When:</span> {new Date(latest.created_at).toLocaleString()}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-gray-500">No completed runs for this template in this list yet.</p>
                  )}
                </div>
                <div className="px-0 pb-1">
                  <div className="px-3 py-2 text-[11px] text-gray-500 uppercase tracking-wide border-b border-gray-700/60 flex items-center justify-between gap-2">
                    <span>
                      Recent runs
                      {reportsForTemplate.length > 0
                        ? ` (${Math.min(recentRunsLimit, reportsForTemplate.length)} of ${reportsForTemplate.length} for this template)`
                        : ''}
                    </span>
                  </div>
                  <HistoryList
                    reports={reportsForTemplate}
                    maxRecent={recentRunsLimit}
                    fullReportHistoryHref={fullReportHistoryHref}
                    onNavigateFullHistory={() => setDrawerOpen(false)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {generating && helperTextWhileGenerating && (
        <p className="text-sm text-gray-400">{helperTextWhileGenerating}</p>
      )}
    </div>
  )
}
