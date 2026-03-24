'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Globe, Mail, Building2, Sparkles } from 'lucide-react'
import { getIndustryOptions } from '@/lib/constants/industry'

const INDUSTRY_OPTIONS = getIndustryOptions()

interface DiagnosticContextPanelProps {
  auditId: string
  /** Show when diagnostic is in progress or just completed */
  visible: boolean
  onSaved?: () => void
}

/**
 * Collapsible inline panel that appears in the chat during/after a diagnostic.
 * Captures website URL, email, and industry to upgrade the report tier.
 */
export function DiagnosticContextPanel({ auditId, visible, onSaved }: DiagnosticContextPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [email, setEmail] = useState('')
  const [industry, setIndustry] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const hasAnyInput = websiteUrl.trim() || email.trim() || industry

  const handleSave = useCallback(async () => {
    if (!hasAnyInput || saving) return
    setSaving(true)
    try {
      const body: Record<string, string> = { auditId }
      if (websiteUrl.trim()) body.websiteUrl = websiteUrl.trim()
      if (email.trim()) body.email = email.trim()
      if (industry) body.industry = industry

      const res = await fetch('/api/tools/audit/context', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        setSaved(true)
        onSaved?.()
      }
    } catch {
      // Silently fail — non-critical enhancement
    } finally {
      setSaving(false)
    }
  }, [auditId, websiteUrl, email, industry, hasAnyInput, saving, onSaved])

  if (!visible || dismissed) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="mx-2 mb-2"
      >
        <div className="rounded-lg border border-radiant-gold/30 bg-radiant-gold/5 overflow-hidden">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-radiant-gold/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-radiant-gold" />
              <span className="text-xs font-medium text-platinum-white/90">
                {saved ? 'Context saved — your report will be upgraded' : 'Upgrade your report'}
              </span>
            </div>
            {expanded ? <ChevronUp size={14} className="text-platinum-white/50" /> : <ChevronDown size={14} className="text-platinum-white/50" />}
          </button>

          {expanded && !saved && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-3 pb-3 space-y-2"
            >
              <p className="text-xs text-platinum-white/60">
                Add your business details to get a richer, more personalized report.
              </p>

              <div className="flex items-center gap-2">
                <Globe size={12} className="text-platinum-white/40 shrink-0" />
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="Website URL"
                  className="flex-1 px-2 py-1 text-xs rounded bg-black/40 border border-platinum-white/20 text-platinum-white placeholder:text-platinum-white/40 focus:border-radiant-gold/50 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <Mail size={12} className="text-platinum-white/40 shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="flex-1 px-2 py-1 text-xs rounded bg-black/40 border border-platinum-white/20 text-platinum-white placeholder:text-platinum-white/40 focus:border-radiant-gold/50 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <Building2 size={12} className="text-platinum-white/40 shrink-0" />
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="flex-1 px-2 py-1 text-xs rounded bg-black/40 border border-platinum-white/20 text-platinum-white focus:border-radiant-gold/50 focus:outline-none"
                >
                  <option value="">Industry…</option>
                  {INDUSTRY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setDismissed(true)}
                  className="text-xs text-platinum-white/40 hover:text-platinum-white/60"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!hasAnyInput || saving}
                  className="px-3 py-1 text-xs rounded bg-radiant-gold text-imperial-navy font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
