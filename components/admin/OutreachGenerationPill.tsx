'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail,
  Loader2,
  X,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  ChevronDown,
  Sparkles,
  ExternalLink,
} from 'lucide-react'
import {
  useOutreachGeneration,
  type OutreachGenerationState,
} from '@/lib/hooks/useOutreachGeneration'
import {
  EMAIL_TEMPLATE_KEYS,
  getPromptDisplayName,
  type EmailTemplateKey,
} from '@/lib/constants/prompt-keys'
import { getCurrentSession } from '@/lib/auth'

type SuggestedReason =
  | 'converted_client'
  | 'proposal_sent'
  | 'meeting_delivered'
  | 'post_meeting'
  | 'has_assets'
  | 'cold'

const REASON_LABELS: Record<SuggestedReason, string> = {
  converted_client: 'converted client — welcome onboarding',
  proposal_sent: 'proposal sent — follow up on delivery',
  meeting_delivered: 'delivery sent — follow up',
  post_meeting: 'post-meeting — keep momentum',
  has_assets: 'assets ready — deliver them',
  cold: 'cold lead — first touch',
}

export interface OutreachGenerationPillLead {
  id: number
  name: string
  messages_count: number
  do_not_contact?: boolean
  removed_at?: string | null
}

export interface OutreachGenerationPillProps {
  lead: OutreachGenerationPillLead
  onToast?: (msg: string) => void
  /** Called when n8n reports unavailable; parent reveals its "Draft in app" fallback. */
  onFallbackAvailable?: () => void
  /** Called after success or cancel; parent should refetch leads. */
  onSettled?: () => void
  /** Called on successful trigger after a prior failure; parent clears its failure set. */
  onFallbackCleared?: () => void
}

const CANCEL_TOOLTIP =
  'Stop waiting — the generation may finish in the background and will appear in your Message Queue.'

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatElapsedSrOnly(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `Elapsed ${total} second${total === 1 ? '' : 's'}`
}

function pillRoleFor(state: OutreachGenerationState): 'status' | 'alert' | undefined {
  if (state === 'succeeded') return 'status'
  if (state === 'failed') return 'alert'
  return undefined
}

export default function OutreachGenerationPill({
  lead,
  onToast,
  onFallbackAvailable,
  onSettled,
  onFallbackCleared,
}: OutreachGenerationPillProps) {
  const { state, elapsedMs, phaseLabel, start, cancel, retry } =
    useOutreachGeneration({
      leadId: lead.id,
      leadName: lead.name,
      onToast,
      onFallbackAvailable,
      onSettled,
      onFallbackCleared,
    })

  const [menuOpen, setMenuOpen] = useState(false)
  const [suggested, setSuggested] = useState<{
    template: EmailTemplateKey
    reason: SuggestedReason
  } | null>(null)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const fetchedRef = useRef(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const disabled = Boolean(lead.do_not_contact || lead.removed_at)
  const elapsedLabel = useMemo(() => formatElapsed(elapsedMs), [elapsedMs])
  const elapsedSr = useMemo(() => formatElapsedSrOnly(elapsedMs), [elapsedMs])

  const fetchSuggested = useCallback(async () => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    setSuggestLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session) return
      const res = await fetch(
        `/api/admin/outreach/leads/${lead.id}/suggested-template`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      )
      if (!res.ok) return
      const data = (await res.json()) as {
        template: EmailTemplateKey
        reason: SuggestedReason
      }
      if (data?.template) setSuggested(data)
    } catch {
      // Non-fatal — the menu still shows all templates.
    } finally {
      setSuggestLoading(false)
    }
  }, [lead.id])

  // Close on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  if (disabled) return null

  if (state === 'idle' && lead.messages_count > 0) {
    return (
      <Link
        href={`/admin/outreach?tab=queue&contact=${lead.id}`}
        className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 shrink-0"
        aria-label={`View email drafts for ${lead.name}`}
      >
        <Mail size={14} />
        View Drafts
      </Link>
    )
  }

  if (state === 'running') {
    return (
      <div
        className="relative overflow-hidden min-w-[180px] max-w-[240px] h-9 px-3 rounded-lg bg-purple-600/90 text-white text-sm font-medium shadow-[0_0_10px_rgba(168,85,247,0.18)] ring-1 ring-purple-400/40 flex items-center gap-1.5 shrink-0"
        role="status"
        aria-live="polite"
        aria-label={`Generating email for ${lead.name}`}
      >
        <Loader2
          size={14}
          className="animate-spin motion-reduce:animate-none shrink-0"
          aria-hidden
        />
        <span
          className="truncate flex-1"
          title={`${phaseLabel} ${elapsedLabel}`}
        >
          {phaseLabel}
        </span>
        <span className="text-[11px] tabular-nums opacity-80 shrink-0" aria-hidden>
          {elapsedLabel}
        </span>
        <span className="sr-only">{elapsedSr}</span>
        <button
          type="button"
          onClick={cancel}
          className="ml-0.5 p-1 -mr-1 rounded hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/40"
          aria-label={`Cancel email generation for ${lead.name}`}
          title={CANCEL_TOOLTIP}
        >
          <X size={14} aria-hidden />
        </button>
        <motion.span
          className="absolute bottom-0 left-0 h-[2px] w-1/3 bg-gradient-to-r from-fuchsia-400 via-purple-200 to-violet-300 motion-reduce:hidden"
          animate={{ x: ['-100%', '340%'] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden
        />
        <span
          className="absolute bottom-0 left-0 h-[2px] w-[40%] bg-purple-200/60 hidden motion-reduce:block"
          aria-hidden
        />
      </div>
    )
  }

  if (state === 'succeeded') {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="succeeded"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          role={pillRoleFor(state)}
          aria-live="polite"
          className="px-3 py-2 h-9 rounded-lg bg-emerald-600/90 text-white text-sm font-medium flex items-center gap-1.5 shrink-0"
        >
          <CheckCircle size={14} aria-hidden />
          <span>Check Message Queue</span>
        </motion.div>
      </AnimatePresence>
    )
  }

  if (state === 'cancelled') {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="cancelled"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          role="status"
          aria-live="polite"
          className="px-3 py-2 h-9 rounded-lg bg-gray-700/80 border border-gray-600 text-gray-200 text-sm font-medium flex items-center gap-1.5 shrink-0"
        >
          <X size={14} aria-hidden />
          <span>Stopped watching</span>
        </motion.div>
      </AnimatePresence>
    )
  }

  if (state === 'failed') {
    return (
      <button
        type="button"
        onClick={retry}
        className="px-3 py-2 h-9 rounded-lg bg-red-900/40 hover:bg-red-900/60 border border-red-700/60 text-red-200 text-sm font-medium flex items-center gap-1.5 shrink-0 focus:outline-none focus:ring-2 focus:ring-red-400/40"
        aria-label={`Retry email generation for ${lead.name}`}
        role="alert"
      >
        <RotateCcw size={14} aria-hidden />
        <span>Retry</span>
        <AlertCircle size={12} className="opacity-70" aria-hidden />
      </button>
    )
  }

  const handlePrimaryClick = () => {
    // Primary body: run with the suggested template if known, else server default.
    void start(suggested?.template)
  }

  const handlePickTemplate = (key: EmailTemplateKey) => {
    setMenuOpen(false)
    void start(key)
  }

  const toggleMenu = () => {
    setMenuOpen((prev) => {
      const next = !prev
      if (next) void fetchSuggested()
      return next
    })
  }

  const contactHref = `/admin/contacts/${lead.id}?focus=compose${
    suggested?.template ? `&template=${suggested.template}` : ''
  }#compose`

  return (
    <div className="relative flex items-center shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={handlePrimaryClick}
        onMouseEnter={() => void fetchSuggested()}
        title={
          suggested
            ? `Generate via n8n — suggested: ${getPromptDisplayName(suggested.template)} (${REASON_LABELS[suggested.reason]})`
            : 'Generate outreach email via n8n (WF-CLG-002)'
        }
        className="px-3 py-2 h-9 rounded-l-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400/60 focus:z-10"
        aria-label={`Generate email for ${lead.name}`}
      >
        <Mail size={14} aria-hidden />
        <span>Generate Email</span>
      </button>
      <button
        type="button"
        onClick={toggleMenu}
        onMouseEnter={() => void fetchSuggested()}
        className="px-1.5 h-9 rounded-r-lg bg-purple-600 hover:bg-purple-500 text-white border-l border-purple-400/40 transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-purple-400/60 focus:z-10"
        aria-label={`Choose template for ${lead.name}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <ChevronDown size={14} aria-hidden />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-20 w-72 rounded-lg bg-silicon-slate-dark/95 backdrop-blur ring-1 ring-white/10 shadow-xl py-1 text-sm"
        >
          <div className="px-3 pt-2 pb-1 text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={11} aria-hidden className="opacity-70" />
            Pick template
            {suggestLoading && (
              <Loader2 size={11} className="animate-spin ml-1 opacity-60" aria-hidden />
            )}
          </div>
          {EMAIL_TEMPLATE_KEYS.map((key) => {
            const isSuggested = suggested?.template === key
            return (
              <button
                key={key}
                type="button"
                role="menuitem"
                onClick={() => handlePickTemplate(key)}
                className="w-full text-left px-3 py-2 text-foreground hover:bg-silicon-slate/60 flex items-center justify-between gap-2"
              >
                <span className="truncate">{getPromptDisplayName(key)}</span>
                {isSuggested && (
                  <span
                    className="shrink-0 text-[10px] font-semibold text-purple-300 bg-purple-500/15 border border-purple-400/30 rounded px-1.5 py-0.5 uppercase tracking-wider"
                    title={`Suggested because: ${REASON_LABELS[suggested.reason]}`}
                  >
                    Suggested
                  </span>
                )}
              </button>
            )
          })}
          <div className="h-px my-1 bg-white/5" />
          <Link
            href={contactHref}
            onClick={() => setMenuOpen(false)}
            role="menuitem"
            className="w-full text-left px-3 py-2 text-foreground/90 hover:bg-silicon-slate/60 flex items-center gap-2"
          >
            <ExternalLink size={12} aria-hidden className="opacity-70" />
            <span className="flex-1">Open in Contact Detail…</span>
          </Link>
        </div>
      )}
    </div>
  )
}
