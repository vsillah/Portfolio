'use client'

import type { ReactElement } from 'react'
import { Clock, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { formatLastRunLabel } from '@/lib/format-last-run'

export interface HeyGenLastSyncPayload {
  syncedAt: string
  success: boolean
  avatarsSynced: number
  voicesSynced: number
  error: string | null
  hadNewResults: boolean
}

/**
 * Status line for the last HeyGen catalog sync (timestamp, success/partial/fail, row counts).
 */
export default function HeyGenSyncLastRunSummary({
  lastSync,
  className = '',
}: {
  lastSync: HeyGenLastSyncPayload | null
  className?: string
}) {
  if (!lastSync) {
    return (
      <p className={`text-[10px] text-gray-500 ${className}`.trim()}>
        No HeyGen catalog sync recorded yet. Run <strong className="text-gray-400">Sync from HeyGen</strong> once to save a timestamp here.
      </p>
    )
  }

  const at = new Date(lastSync.syncedAt)
  const relative = formatLastRunLabel(at)
  const total = lastSync.avatarsSynced + lastSync.voicesSynced
  const title = at.toLocaleString()

  let statusIcon: ReactElement
  let statusText: string

  if (lastSync.success && lastSync.hadNewResults) {
    statusIcon = <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
    statusText = `Success — wrote ${lastSync.avatarsSynced.toLocaleString()} avatar${lastSync.avatarsSynced !== 1 ? 's' : ''} and ${lastSync.voicesSynced.toLocaleString()} voice${lastSync.voicesSynced !== 1 ? 's' : ''} to the catalog.`
  } else if (lastSync.success && !lastSync.hadNewResults) {
    statusIcon = <CheckCircle className="w-3.5 h-3.5 text-emerald-400/80 shrink-0" />
    statusText =
      'Success — no rows written this run (HeyGen returned empty lists or nothing to upsert). Catalog unchanged.'
  } else if (!lastSync.success && lastSync.hadNewResults) {
    statusIcon = <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
    statusText = `Partial — updated ${lastSync.avatarsSynced.toLocaleString()} avatars / ${lastSync.voicesSynced.toLocaleString()} voices but some errors occurred.`
  } else {
    statusIcon = <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
    statusText = 'Sync failed — no catalog rows were updated.'
  }

  return (
    <div className={`rounded-lg border border-gray-700/80 bg-gray-900/40 px-3 py-2 space-y-1 ${className}`.trim()}>
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-400">
        <span className="flex items-center gap-1 shrink-0" title={title}>
          <Clock className="w-3 h-3 text-gray-500" />
          <span>Last sync {relative ? `${relative} · ` : ''}</span>
          <span className="text-gray-500 font-mono">{at.toLocaleString()}</span>
        </span>
      </div>
      <div className="flex items-start gap-2 text-[10px] text-gray-300">
        {statusIcon}
        <span>{statusText}</span>
      </div>
      {lastSync.error && (
        <p className="text-[10px] text-red-400/90 pl-5 border-l border-red-500/30 ml-0.5">
          {lastSync.error}
        </p>
      )}
      {!lastSync.success && total === 0 && !lastSync.error && (
        <p className="text-[10px] text-gray-500 pl-5">Check API keys and HeyGen account access.</p>
      )}
    </div>
  )
}
