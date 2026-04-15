'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Crosshair, Search, X, Loader2 } from 'lucide-react'
import { getCurrentSession } from '@/lib/auth'

interface ScopeEntity {
  id: string | number
  label: string
  subtitle?: string
}

export interface SocialIntelTriggerPayload {
  leadId: number
  sources: string[]
  maxResults: number
  scopeType: 'meeting' | 'assessment' | null
  scopeId: string | null
}

interface SocialIntelModalProps {
  leadId: number
  contactSubmissionId: number
  sources: string[]
  onSourcesChange: (next: string[]) => void
  scope: number
  onScopeChange: (next: number) => void
  loading: boolean
  onTrigger: (payload: SocialIntelTriggerPayload) => void
  onClose: () => void
}

export default function SocialIntelModal({
  leadId,
  contactSubmissionId,
  sources,
  onSourcesChange,
  scope,
  onScopeChange,
  loading,
  onTrigger,
  onClose,
}: SocialIntelModalProps) {
  const [scopeType, setScopeType] = useState<'meeting' | 'assessment' | null>(null)
  const [scopeId, setScopeId] = useState<string | null>(null)
  const [scopeLabel, setScopeLabel] = useState<string | null>(null)
  const [scopeEntities, setScopeEntities] = useState<ScopeEntity[]>([])
  const [scopeSearching, setScopeSearching] = useState(false)
  const [scopeQuery, setScopeQuery] = useState('')
  const [scopeDropdownOpen, setScopeDropdownOpen] = useState(false)

  const fetchScopeEntities = useCallback(async (type: string, query: string) => {
    setScopeSearching(true)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return
      const params = new URLSearchParams({
        contact_submission_id: String(contactSubmissionId),
        entity_type: type,
        ...(query && { q: query }),
      })
      const res = await fetch(`/api/admin/value-evidence/scope-entities?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setScopeEntities(data.entities ?? [])
      }
    } finally {
      setScopeSearching(false)
    }
  }, [contactSubmissionId])

  useEffect(() => {
    if (scopeType && !scopeId) {
      const timer = setTimeout(() => fetchScopeEntities(scopeType, scopeQuery), scopeQuery ? 300 : 0)
      return () => clearTimeout(timer)
    }
  }, [scopeType, scopeQuery, scopeId, fetchScopeEntities])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm bg-background border border-silicon-slate rounded-xl shadow-xl p-5"
        >
          <h3 className="text-lg font-semibold text-white mb-3">Social Intel</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Select sources and scope for social listening on this lead.
          </p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {['reddit', 'google_maps', 'linkedin', 'g2', 'capterra'].map((src) => {
              const checked = sources.includes(src)
              const label = src === 'google_maps' ? 'Google Maps' : src.charAt(0).toUpperCase() + src.slice(1)
              return (
                <button
                  key={src}
                  type="button"
                  onClick={() => {
                    const next = checked ? sources.filter(s => s !== src) : [...sources, src]
                    if (next.length > 0) onSourcesChange(next)
                  }}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                    checked
                      ? 'bg-cyan-600/20 text-cyan-300 border-cyan-600/40'
                      : 'bg-gray-900/60 text-gray-500 border-gray-700/50 hover:text-gray-300'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <select
            value={scope}
            onChange={(e) => onScopeChange(Number(e.target.value))}
            className="w-full text-xs bg-gray-900/80 text-gray-300 border border-gray-700/60 rounded px-2 py-1.5 mb-3 focus:outline-none focus:border-cyan-500/50"
          >
            <option value={5}>Quick Scan (~2-4 min)</option>
            <option value={10}>Standard Scan (~7-12 min)</option>
            <option value={20}>Deep Scan (~15-30 min)</option>
          </select>

          {/* Scope picker */}
          <div className="mb-4 space-y-2">
            <button
              type="button"
              onClick={() => {
                if (scopeType) {
                  setScopeType(null)
                  setScopeId(null)
                  setScopeLabel(null)
                } else {
                  setScopeType('meeting')
                }
              }}
              className="text-[11px] text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1.5"
            >
              <Crosshair className="w-3 h-3" />
              {scopeType && scopeLabel
                ? <span className="text-emerald-400">Targeted: {scopeLabel.substring(0, 40)}{scopeLabel.length > 40 ? '...' : ''}</span>
                : 'Scope: Full lead context'
              }
            </button>
            {scopeType && (
              <>
                <div className="flex gap-1.5">
                  {(['meeting', 'assessment'] as const).map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        setScopeType(st)
                        setScopeId(null)
                        setScopeLabel(null)
                        setScopeQuery('')
                      }}
                      className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                        scopeType === st
                          ? 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40'
                          : 'bg-gray-900/60 text-gray-500 border-gray-700/50 hover:text-gray-300'
                      }`}
                    >
                      {st === 'meeting' ? 'Meeting' : 'Assessment'}
                    </button>
                  ))}
                </div>
                {scopeId && scopeLabel ? (
                  <div className="flex items-center gap-1.5 text-[11px] bg-emerald-600/10 text-emerald-300 border border-emerald-600/30 rounded px-2 py-1.5">
                    <Crosshair className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate flex-1">{scopeLabel}</span>
                    <button
                      type="button"
                      onClick={() => { setScopeId(null); setScopeLabel(null) }}
                      className="p-0.5 rounded hover:bg-emerald-600/20 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                    <input
                      type="text"
                      value={scopeQuery}
                      onChange={e => { setScopeQuery(e.target.value); setScopeDropdownOpen(true) }}
                      onFocus={() => setScopeDropdownOpen(true)}
                      placeholder={`Search ${scopeType}s for this lead...`}
                      className="w-full text-[11px] bg-gray-900/80 text-gray-300 border border-gray-700/60 rounded pl-7 pr-2 py-1.5 focus:outline-none focus:border-emerald-500/50 placeholder:text-gray-600"
                    />
                    {scopeSearching && (
                      <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 animate-spin" />
                    )}
                    <AnimatePresence>
                      {scopeDropdownOpen && !scopeId && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.1 }}
                          className="absolute left-0 right-0 top-full mt-1 max-h-[140px] overflow-y-auto bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50"
                        >
                          {scopeEntities.length === 0 && !scopeSearching && (
                            <div className="px-3 py-2 text-[11px] text-gray-500">
                              No {scopeType}s found for this lead
                            </div>
                          )}
                          {scopeEntities.map(entity => (
                            <button
                              key={entity.id}
                              type="button"
                              onClick={() => {
                                setScopeId(String(entity.id))
                                setScopeLabel(entity.label)
                                setScopeDropdownOpen(false)
                                setScopeQuery('')
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-gray-800 transition-colors border-b border-gray-800/50 last:border-0"
                            >
                              <div className="text-[11px] text-gray-300 truncate">{entity.label}</div>
                              {entity.subtitle && (
                                <div className="text-[10px] text-gray-500 truncate">{entity.subtitle}</div>
                              )}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading || sources.length === 0}
              onClick={() => onTrigger({ leadId, sources, maxResults: scope, scopeType, scopeId })}
              className="px-3 py-1.5 text-xs font-medium bg-cyan-600/20 text-cyan-300 border border-cyan-600/40 rounded hover:bg-cyan-600/30 transition-colors disabled:opacity-40"
            >
              {loading ? 'Starting...' : 'Run Social Intel'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
