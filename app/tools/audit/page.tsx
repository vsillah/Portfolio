'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AUDIT_CATEGORIES,
  AUDIT_CATEGORY_ORDER,
  categoryFormToPayload,
  formatPayloadLine,
  type AuditCategoryConfig,
  type AuditField,
} from '@/lib/audit-questions'

type Step = 'intro' | 'form' | 'results'

interface AuditState {
  sessionId: string
  auditId: string
}

interface FetchedAudit {
  id: string
  status: string
  businessChallenges?: Record<string, unknown>
  techStack?: Record<string, unknown>
  automationNeeds?: Record<string, unknown>
  aiReadiness?: Record<string, unknown>
  budgetTimeline?: Record<string, unknown>
  decisionMaking?: Record<string, unknown>
  diagnosticSummary?: string
  keyInsights?: string[]
  recommendedActions?: string[]
  urgencyScore?: number | null
  opportunityScore?: number | null
}

/** Score band for color and copy: 0–3 low, 4–6 mid, 7–10 high */
function getScoreBand(score: number): 'low' | 'mid' | 'high' {
  if (score <= 3) return 'low'
  if (score <= 6) return 'mid'
  return 'high'
}

function getScoreStyle(band: 'low' | 'mid' | 'high'): { bg: string; label: string } {
  switch (band) {
    case 'low':
      return { bg: 'bg-red-500/20 border-red-400/60 text-red-200', label: 'Early stage' }
    case 'mid':
      return { bg: 'bg-amber-500/20 border-amber-400/60 text-amber-200', label: 'In progress' }
    case 'high':
      return { bg: 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200', label: 'Strong' }
  }
}

/** One-line definition for the band (UX: label alone is vague) */
function getScoreDefinition(band: 'low' | 'mid' | 'high', scoreType: 'urgency' | 'opportunity'): string {
  if (scoreType === 'urgency') {
    switch (band) {
      case 'low': return "You're at the start of your automation journey; small, focused steps will add up."
      case 'mid': return "You're taking steps; focusing on one or two priorities will help you move faster."
      case 'high': return "You're in a good position to act; the next step is execution and measuring impact."
    }
  }
  switch (band) {
    case 'low': return "Potential is high once you address a few foundations; our Resources can help."
    case 'mid': return "You have room to grow impact by connecting systems and clarifying one key outcome."
    case 'high': return "You're well positioned to capture value; focus on execution and clear metrics."
  }
}

function getUrgencyImprovements(score: number): string[] {
  const band = getScoreBand(score)
  if (band === 'high') return []
  if (band === 'low') {
    return [
      'Clarify who can approve decisions and on what timeline.',
      'Identify one high-pain process to fix first and set a target date.',
    ]
  }
  return [
    'Document your current bottlenecks so you can prioritize automation.',
    'Align stakeholders on a single “must fix” outcome for the next quarter.',
  ]
}

function getOpportunityImprovements(score: number): string[] {
  const band = getScoreBand(score)
  if (band === 'high') return []
  if (band === 'low') {
    return [
      'Map where manual work costs the most time or revenue.',
      'Review our Resources for quick wins (templates, playbooks) that don’t require big budget.',
    ]
  }
  return [
    'Connect your CRM and key tools so automation can use existing data.',
    'Pick one outcome (e.g. faster follow-up, less data entry) and measure baseline before automating.',
  ]
}

/** Heuristic estimated opportunity value from budget + opportunity score (display only) */
function getEstimatedOpportunityValue(
  budgetTimeline?: Record<string, unknown> | null,
  opportunityScore?: number | null
): string | null {
  if (opportunityScore == null) return null
  const range = (budgetTimeline?.budget_range as string) || (budgetTimeline?.budget_flexibility as string)
  const mult = opportunityScore <= 3 ? 0.5 : opportunityScore <= 6 ? 1 : 1.5
  if (range === 'large' || range === 'value_driven') return `$${Math.round(50 * mult)}k–$150k+ potential value`
  if (range === 'medium' || range === 'some_flex') return `$${Math.round(15 * mult)}k–$50k potential value`
  if (range === 'small' || range === 'fixed') return `$${Math.round(5 * mult)}k–$15k potential value`
  return `$${Math.round(10 * mult)}k–$40k potential value (based on your readiness)`
}

/** Horizontal 0–10 spectrum bar with segment colors and gold marker */
function ScoreSpectrumBar({ score, scoreType }: { score: number; scoreType: 'urgency' | 'opportunity' }) {
  const band = getScoreBand(score)
  const style = getScoreStyle(band)
  const label = `${scoreType === 'urgency' ? 'Urgency' : 'Opportunity'} score ${score} out of 10, ${style.label} range`
  return (
    <div className="mt-2" role="img" aria-label={label}>
      <div className="flex items-center justify-between text-xs text-platinum-white/50 mb-0.5">
        <span>0</span>
        <span>10</span>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-platinum-white/10">
        {/* Segment background */}
        <div className="absolute inset-0 flex">
          <div className="w-[30%] bg-red-500/20" />
          <div className="w-[30%] bg-amber-500/20" />
          <div className="w-[40%] bg-emerald-500/20" />
        </div>
        {/* Gold marker at score position */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-radiant-gold rounded-full shadow-md"
          style={{ left: `${(score / 10) * 100}%`, transform: 'translateX(-50%)' }}
        />
      </div>
    </div>
  )
}

/** Build human-readable score driver lines from audit payload (ties score to answers) */
function getScoreDrivers(results: FetchedAudit): { urgency: string[]; opportunity: string[] } {
  const urgency: string[] = []
  const opportunity: string[] = []
  const bt = results.budgetTimeline
  const dm = results.decisionMaking
  const an = results.automationNeeds
  const ar = results.aiReadiness
  const ts = results.techStack

  if (bt) {
    const timeline = formatPayloadLine('budget_timeline', 'timeline', bt.timeline)
    if (timeline) { urgency.push(timeline); opportunity.push(timeline) }
    const range = formatPayloadLine('budget_timeline', 'budget_range', bt.budget_range)
    if (range) opportunity.push(range)
    const flex = formatPayloadLine('budget_timeline', 'budget_flexibility', bt.budget_flexibility)
    if (flex) opportunity.push(flex)
  }
  if (dm) {
    const decisionMaker = formatPayloadLine('decision_making', 'decision_maker', dm.decision_maker)
    if (decisionMaker) { urgency.push(decisionMaker); opportunity.push(decisionMaker) }
    const approval = formatPayloadLine('decision_making', 'approval_process', dm.approval_process)
    if (approval) urgency.push(approval)
  }
  if (an?.priority_areas && Array.isArray(an.priority_areas)) {
    const n = (an.priority_areas as string[]).length
    if (n > 0) opportunity.push(`Priority areas to automate: ${n} selected`)
  }
  if (ar) {
    const dq = formatPayloadLine('ai_readiness', 'data_quality', ar.data_quality)
    if (dq) opportunity.push(dq)
    const tr = formatPayloadLine('ai_readiness', 'team_readiness', ar.team_readiness)
    if (tr) opportunity.push(tr)
  }
  if (ts) {
    const ir = formatPayloadLine('tech_stack', 'integration_readiness', ts.integration_readiness)
    if (ir) opportunity.push(ir)
  }
  return { urgency: urgency.slice(0, 4), opportunity: opportunity.slice(0, 4) }
}

export interface ImprovementArea {
  id: string
  label: string
  reason: string
  nextStepLabel: string
  nextStepUrl: string
}

/** Derive improvement areas from payload + scores; each maps to a specific next step */
function getImprovementAreas(results: FetchedAudit): ImprovementArea[] {
  const areas: ImprovementArea[] = []
  const ts = results.techStack
  const ar = results.aiReadiness
  const dm = results.decisionMaking
  const bt = results.budgetTimeline
  const urgency = results.urgencyScore ?? 5
  const opportunity = results.opportunityScore ?? 5

  if (ts?.integration_readiness === 'not_connected' || ts?.integration_readiness === 'some_apis') {
    areas.push({
      id: 'integration',
      label: 'Integration readiness',
      reason: 'Your tools aren’t fully connected yet. Connecting your CRM and key systems will make automation more effective.',
      nextStepLabel: 'Resources: Get your systems connected',
      nextStepUrl: '/resources',
    })
  }
  if (ar?.data_quality === 'scattered' || ar?.data_quality === 'some_systems') {
    areas.push({
      id: 'data_quality',
      label: 'Data quality',
      reason: 'Your data is in multiple places and not yet connected. Cleaning and structuring it will unlock better automation.',
      nextStepLabel: 'Resources: Get your data in shape',
      nextStepUrl: '/resources',
    })
  }
  if (ar?.team_readiness === 'not_yet' || ar?.team_readiness === 'individual') {
    areas.push({
      id: 'team_readiness',
      label: 'Team readiness',
      reason: 'Getting one champion or a small pilot in place will build confidence and show quick wins.',
      nextStepLabel: 'Resources: Templates and playbooks to get started',
      nextStepUrl: '/resources',
    })
  }
  if ((dm?.approval_process === 'committee' || dm?.approval_process === 'budget_threshold') && getScoreBand(urgency) !== 'high') {
    areas.push({
      id: 'decision_process',
      label: 'Decision process',
      reason: 'Involving stakeholders early and clarifying who can approve what will speed up decisions.',
      nextStepLabel: 'Start a conversation in chat for a tailored plan',
      nextStepUrl: '/',
    })
  }
  if (bt?.timeline === 'exploring' && urgency >= 5) {
    areas.push({
      id: 'timeline',
      label: 'Timeline clarity',
      reason: 'Picking one target date or one “must fix” outcome will help prioritize and move faster.',
      nextStepLabel: 'Resources: Roadmaps and prioritization guides',
      nextStepUrl: '/resources',
    })
  }
  if ((bt?.budget_range === 'none' || bt?.budget_range === 'small') && getScoreBand(opportunity) !== 'low') {
    areas.push({
      id: 'budget',
      label: 'Budget alignment',
      reason: 'Quick wins and templates can show impact without a large budget; we have options to match.',
      nextStepLabel: 'Resources: High-leverage tactics and templates',
      nextStepUrl: '/resources',
    })
  }
  return areas
}

const CATEGORY_KEYS = AUDIT_CATEGORY_ORDER

const STEP_LABELS = [
  'Challenges',
  'Tech stack',
  'Automation',
  'AI readiness',
  'Budget',
  'Decision',
]

/** Results payload keys for each category (same order as STEP_LABELS) */
const RESULTS_CATEGORY_KEYS: (keyof FetchedAudit)[] = [
  'businessChallenges',
  'techStack',
  'automationNeeds',
  'aiReadiness',
  'budgetTimeline',
  'decisionMaking',
]

function getCategoryCaptureStatus(results: FetchedAudit): boolean[] {
  return RESULTS_CATEGORY_KEYS.map((key) => {
    const data = results[key]
    if (data == null || typeof data !== 'object') return false
    return Object.keys(data).length > 0
  })
}

function hasOtherOption(field: AuditField): boolean {
  return !!field.options?.some((o) => o.value === 'other')
}

function getInitialValues(category: AuditCategoryConfig): Record<string, string | string[] | boolean> {
  const out: Record<string, string | string[] | boolean> = {}
  for (const f of category.fields) {
    if (f.type === 'boolean') out[f.key] = false
    else if (f.type === 'multiselect' || f.multiple) {
      out[f.key] = []
      if (f.type === 'multiselect' && hasOtherOption(f)) out[`${f.key}_other`] = ''
    } else {
      out[f.key] = ''
      if (f.type === 'select' && hasOtherOption(f)) out[`${f.key}_other`] = ''
    }
  }
  return out
}

function FieldInput({
  field,
  value,
  onChange,
  valueOther,
  onOtherChange,
}: {
  field: AuditField
  value: string | string[] | boolean
  onChange: (v: string | string[] | boolean) => void
  valueOther?: string
  onOtherChange?: (v: string) => void
}) {
  if (field.type === 'boolean') {
    const v = value === true || value === 'true' || (typeof value === 'string' && value.toLowerCase() === 'yes')
    return (
      <select
        value={v ? 'yes' : 'no'}
        onChange={(e) => onChange(e.target.value === 'yes')}
        className="w-full px-4 py-2 rounded-lg bg-black/40 border border-radiant-gold/40 text-platinum-white focus:border-radiant-gold focus:ring-2 focus:ring-radiant-gold/30 focus:outline-none"
        aria-label={field.label}
      >
        <option value="no">No</option>
        <option value="yes">Yes</option>
      </select>
    )
  }
  if (field.type === 'select' && field.options) {
    const selected = typeof value === 'string' ? value : ''
    const otherSelected = selected === 'other'
    const showOtherInput = field.options.some((o) => o.value === 'other') && otherSelected && onOtherChange
    return (
      <div className="space-y-2">
        <select
          value={selected}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-black/40 border border-radiant-gold/40 text-platinum-white focus:border-radiant-gold focus:ring-2 focus:ring-radiant-gold/30 focus:outline-none"
          aria-label={field.label}
        >
          <option value="">Select…</option>
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {showOtherInput && (
          <div className="rounded-lg border border-radiant-gold/30 bg-black/20 p-3">
            <label className="block text-platinum-white/80 text-sm mb-1">Please specify</label>
            <input
              type="text"
              value={valueOther ?? ''}
              onChange={(e) => onOtherChange(e.target.value)}
              placeholder="Please specify"
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-radiant-gold/40 text-platinum-white placeholder:text-platinum-white/50 focus:border-radiant-gold focus:ring-2 focus:ring-radiant-gold/30 focus:outline-none text-sm"
              aria-label={`Specify other ${field.label.toLowerCase()}`}
            />
          </div>
        )}
      </div>
    )
  }
  if (field.type === 'multiselect' && field.options) {
    const selected = Array.isArray(value) ? (value as string[]) : []
    const hasOther = field.options.some((o) => o.value === 'other')
    const otherSelected = hasOther && selected.includes('other')
    const toggle = (optValue: string) => {
      if (selected.includes(optValue)) {
        onChange(selected.filter((v) => v !== optValue))
      } else {
        onChange([...selected, optValue])
      }
    }
    return (
      <div className="space-y-2 rounded-lg border border-radiant-gold/40 bg-black/20 p-3">
        <p className="text-platinum-white/60 text-xs">Select all that apply</p>
        {field.options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-platinum-white/90">
            <input
              type="checkbox"
              checked={selected.includes(opt.value)}
              onChange={() => toggle(opt.value)}
              className="rounded border-radiant-gold/50 text-radiant-gold focus:ring-radiant-gold"
            />
            <span>{opt.label}</span>
          </label>
        ))}
        {hasOther && otherSelected && onOtherChange && (
          <div className="mt-3 pt-3 border-t border-radiant-gold/30">
            <label className="block text-platinum-white/80 text-sm mb-1">Please specify</label>
            <input
              type="text"
              value={valueOther ?? ''}
              onChange={(e) => onOtherChange(e.target.value)}
              placeholder="Please specify"
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-radiant-gold/40 text-platinum-white placeholder:text-platinum-white/50 focus:border-radiant-gold focus:ring-2 focus:ring-radiant-gold/30 focus:outline-none text-sm"
              aria-label={`Specify other ${field.label.toLowerCase()}`}
            />
          </div>
        )}
      </div>
    )
  }
  if (field.type === 'textarea' || (field.type === 'multiline' && !field.multiple)) {
    return (
      <textarea
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={3}
        className="w-full px-4 py-2 rounded-lg bg-black/40 border border-radiant-gold/40 text-platinum-white placeholder:text-platinum-white/50 focus:border-radiant-gold focus:ring-2 focus:ring-radiant-gold/30 focus:outline-none resize-y"
        aria-label={field.label}
      />
    )
  }
  if (field.type === 'multiline' && field.multiple) {
    const str = Array.isArray(value) ? value.join('\n') : (value as string)
    return (
      <textarea
        value={str}
        onChange={(e) => onChange(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
        placeholder={field.placeholder}
        rows={4}
        className="w-full px-4 py-2 rounded-lg bg-black/40 border border-radiant-gold/40 text-platinum-white placeholder:text-platinum-white/50 focus:border-radiant-gold focus:ring-2 focus:ring-radiant-gold/30 focus:outline-none resize-y"
        aria-label={field.label}
      />
    )
  }
  return (
    <input
      type="text"
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      className="w-full px-4 py-2 rounded-lg bg-black/40 border border-radiant-gold/40 text-platinum-white placeholder:text-platinum-white/50 focus:border-radiant-gold focus:ring-2 focus:ring-radiant-gold/30 focus:outline-none"
      aria-label={field.label}
    />
  )
}

export default function AuditToolPage() {
  const [step, setStep] = useState<Step>('intro')
  const [auditState, setAuditState] = useState<AuditState | null>(null)
  const [categoryIndex, setCategoryIndex] = useState(0)
  const [formValues, setFormValues] = useState<Record<string, string | string[] | boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<FetchedAudit | null>(null)
  /** Persist submitted form values per category so "Back" can restore */
  const [submittedByCategory, setSubmittedByCategory] = useState<Record<string, Record<string, string | string[] | boolean>>>({})
  /** Results: expandable "What your scores mean" drawer (collapsed by default) */
  const [scoreDefinitionsOpen, setScoreDefinitionsOpen] = useState(false)

  const category = AUDIT_CATEGORIES[categoryIndex] as AuditCategoryConfig | undefined
  const isLastCategory = categoryIndex === AUDIT_CATEGORIES.length - 1

  const startAudit = useCallback(async () => {
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/tools/audit/start', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Could not start audit')
        return
      }
      setAuditState({ sessionId: data.sessionId, auditId: data.auditId })
      setCategoryIndex(0)
      setFormValues(getInitialValues(AUDIT_CATEGORIES[0]!))
      setStep('form')
    } catch {
      setError('Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }, [])

  const submitCategory = useCallback(async () => {
    if (!auditState || !category) return
    setError('')
    setSubmitting(true)
    try {
      const payload = categoryFormToPayload(category.id, formValues)
      if (Object.keys(payload).length === 0) {
        setError('Please fill at least one field')
        setSubmitting(false)
        return
      }
      const res = await fetch('/api/tools/audit/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditId: auditState.auditId,
          category: category.id,
          values: formValues,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Could not save')
        setSubmitting(false)
        return
      }
      setSubmittedByCategory((prev) => ({ ...prev, [category.id]: { ...formValues } }))
      if (data.completed) {
        const getRes = await fetch(`/api/chat/diagnostic?auditId=${encodeURIComponent(auditState.auditId)}`)
        const getData = await getRes.json().catch(() => ({}))
        setResults(getData?.audit ?? null)
        setStep('results')
      } else {
        setCategoryIndex((i) => i + 1)
        const nextCat = AUDIT_CATEGORIES[categoryIndex + 1]!
        setFormValues(getInitialValues(nextCat))
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }, [auditState, category, formValues, categoryIndex])

  const updateField = useCallback((key: string, v: string | string[] | boolean) => {
    setFormValues((prev) => ({ ...prev, [key]: v }))
  }, [])

  return (
    <div className="min-h-screen bg-imperial-navy text-platinum-white pt-12 pb-12 px-4">
      <div className="max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          {step === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <h1 className="text-3xl font-bold text-radiant-gold">AI & Automation Audit</h1>
              <p className="text-platinum-white/80">
                This short assessment uses the same structure as our chat-based diagnostic. Answer one section at a time;
                your answers are saved and you can use the results to prioritize next steps or share with your team.
              </p>
              <p className="text-platinum-white/60 text-sm">
                There are 6 sections: Business challenges, Tech stack, Automation needs, AI readiness, Budget & timeline,
                and Decision making.
              </p>
              {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}
              <button
                type="button"
                onClick={startAudit}
                disabled={submitting}
                className="px-6 py-3 rounded-lg bg-radiant-gold text-imperial-navy font-semibold hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-radiant-gold focus:ring-offset-2 focus:ring-offset-imperial-navy disabled:opacity-50"
              >
                {submitting ? 'Starting…' : 'Start audit'}
              </button>
              <p className="text-platinum-white/50 text-sm">
                <Link href="/" className="text-radiant-gold/80 hover:underline">Back to home</Link>
              </p>
            </motion.div>
          )}

          {step === 'form' && category && (
            <motion.div
              key={`form-${category.id}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Visual stepper */}
              <div className="rounded-xl border border-radiant-gold/30 bg-black/20 p-4" role="progressbar" aria-valuenow={categoryIndex + 1} aria-valuemin={1} aria-valuemax={6} aria-label="Audit progress">
                <p className="text-platinum-white/70 text-sm mb-3">Your progress</p>
                <div className="flex items-center justify-between gap-1">
                  {STEP_LABELS.map((label, i) => {
                    const stepNum = i + 1
                    const completed = categoryIndex > i
                    const current = categoryIndex === i
                    return (
                      <div key={i} className="flex flex-1 flex-col items-center">
                        <div
                          className={`
                            flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold
                            ${completed ? 'bg-radiant-gold text-imperial-navy' : ''}
                            ${current ? 'ring-2 ring-radiant-gold ring-offset-2 ring-offset-imperial-navy bg-radiant-gold/20 text-radiant-gold' : ''}
                            ${!completed && !current ? 'bg-platinum-white/10 text-platinum-white/50' : ''}
                          `}
                        >
                          {completed ? '✓' : stepNum}
                        </div>
                        <span className={`mt-1 text-xs ${current ? 'text-radiant-gold font-medium' : completed ? 'text-platinum-white/80' : 'text-platinum-white/50'}`}>
                          {label}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-platinum-white/10">
                  <motion.div
                    className="h-full bg-radiant-gold"
                    initial={false}
                    animate={{ width: `${((categoryIndex + 1) / AUDIT_CATEGORIES.length) * 100}%` }}
                    transition={{ duration: 0.25 }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-radiant-gold">{category.title}</h1>
                <span className="text-platinum-white/60 text-sm">
                  Step {categoryIndex + 1} of {AUDIT_CATEGORIES.length}
                </span>
              </div>
              <p className="text-platinum-white/80">{category.description}</p>
              <div className="space-y-4">
                {category.fields.map((f) => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-platinum-white/80 mb-1">
                      {f.label}
                    </label>
                    <FieldInput
                      field={f}
                      value={formValues[f.key] ?? (f.type === 'boolean' ? false : f.multiple ? [] : '')}
                      onChange={(v) => updateField(f.key, v)}
                      valueOther={hasOtherOption(f) ? (formValues[`${f.key}_other`] as string) ?? '' : undefined}
                      onOtherChange={hasOtherOption(f) ? (v) => updateField(`${f.key}_other`, v) : undefined}
                    />
                  </div>
                ))}
              </div>
              {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}
              <div className="flex gap-3">
                {categoryIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const prevCat = AUDIT_CATEGORIES[categoryIndex - 1]!
                      setCategoryIndex((i) => i - 1)
                      setFormValues(submittedByCategory[prevCat.id] ?? getInitialValues(prevCat))
                      setError('')
                    }}
                    className="px-4 py-2 rounded-lg border border-radiant-gold/40 text-platinum-white hover:bg-radiant-gold/10 focus:outline-none focus:ring-2 focus:ring-radiant-gold/30"
                  >
                    Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={submitCategory}
                  disabled={submitting}
                  className="px-6 py-3 rounded-lg bg-radiant-gold text-imperial-navy font-semibold hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-radiant-gold focus:ring-offset-2 focus:ring-offset-imperial-navy disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : isLastCategory ? 'Finish audit' : 'Next'}
                </button>
              </div>
            </motion.div>
          )}

          {step === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <h1 className="text-3xl font-bold text-radiant-gold">Your audit is complete</h1>
              {results ? (
                <>
                  {/* Capture summary: same 6-step progress indicator as the form; checkmark when that category had responses */}
                  {(() => {
                    const captured = getCategoryCaptureStatus(results)
                    return (
                      <div className="rounded-xl border border-radiant-gold/30 bg-black/20 p-4" aria-label="Inputs captured">
                        <p className="text-platinum-white/70 text-sm mb-3">What we captured</p>
                        <div className="flex items-center justify-between gap-1">
                          {STEP_LABELS.map((label, i) => (
                            <div key={i} className="flex flex-1 flex-col items-center">
                              <div
                                className={`
                                  flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold
                                  ${captured[i] ? 'bg-radiant-gold text-imperial-navy' : 'bg-platinum-white/10 text-platinum-white/50'}
                                `}
                                aria-hidden
                              >
                                {captured[i] ? '✓' : i + 1}
                              </div>
                              <span className={`mt-1 text-xs ${captured[i] ? 'text-platinum-white/80' : 'text-platinum-white/50'}`}>
                                {label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}

                  {/* 1. Score cards */}
                  {(results.urgencyScore != null || results.opportunityScore != null) && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {results.urgencyScore != null && (() => {
                          const band = getScoreBand(results.urgencyScore!)
                          const style = getScoreStyle(band)
                          const definition = getScoreDefinition(band, 'urgency')
                          const tips = getUrgencyImprovements(results.urgencyScore!)
                          return (
                            <div className="rounded-lg border border-platinum-white/20 bg-black/20 p-4">
                              <p className="text-platinum-white/80 text-sm">Urgency score</p>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-2xl font-bold">{results.urgencyScore}/10</span>
                                <span className="text-sm font-medium opacity-90">({style.label})</span>
                              </div>
                              <p className="text-xs opacity-90 mt-1" style={{ lineHeight: 1.35 }}>{definition}</p>
                              <ScoreSpectrumBar score={results.urgencyScore!} scoreType="urgency" />
                              {tips.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-current/20">
                                  <p className="text-xs font-medium opacity-90 mb-1">How to improve</p>
                                  <ul className="list-disc list-inside text-sm space-y-0.5 opacity-90">
                                    {tips.map((t, i) => <li key={i}>{t}</li>)}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                        {results.opportunityScore != null && (() => {
                          const band = getScoreBand(results.opportunityScore!)
                          const style = getScoreStyle(band)
                          const definition = getScoreDefinition(band, 'opportunity')
                          const tips = getOpportunityImprovements(results.opportunityScore!)
                          return (
                            <div className="rounded-lg border border-platinum-white/20 bg-black/20 p-4">
                              <p className="text-platinum-white/80 text-sm">Opportunity score</p>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-2xl font-bold">{results.opportunityScore}/10</span>
                                <span className="text-sm font-medium opacity-90">({style.label})</span>
                              </div>
                              <p className="text-xs opacity-90 mt-1" style={{ lineHeight: 1.35 }}>{definition}</p>
                              <ScoreSpectrumBar score={results.opportunityScore!} scoreType="opportunity" />
                              {tips.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-current/20">
                                  <p className="text-xs font-medium opacity-90 mb-1">How to improve</p>
                                  <ul className="list-disc list-inside text-sm space-y-0.5 opacity-90">
                                    {tips.map((t, i) => <li key={i}>{t}</li>)}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </div>

                      {/* 2. Expandable "What your scores mean" drawer */}
                      <div className="rounded-lg border border-platinum-white/20 bg-black/20 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setScoreDefinitionsOpen((o) => !o)}
                          className="w-full px-4 py-3 flex items-center justify-between text-left text-platinum-white/90 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-radiant-gold/30 rounded-lg"
                          aria-expanded={scoreDefinitionsOpen}
                        >
                          <span className="font-semibold text-platinum-white">What your scores mean</span>
                          <span className="text-platinum-white/60 text-sm" aria-hidden>
                            {scoreDefinitionsOpen ? '▼' : '▶'}
                          </span>
                        </button>
                        {scoreDefinitionsOpen && (
                          <div className="px-4 pb-4 pt-0 border-t border-platinum-white/10">
                            <ul className="list-disc list-inside space-y-1.5 text-platinum-white/90 text-sm mt-3">
                              <li><strong className="text-platinum-white">Urgency (0–10)</strong> — How soon it makes sense to act, based on your timeline, decision process, and pain level.</li>
                              <li><strong className="text-platinum-white">Opportunity (0–10)</strong> — How much impact you could get from acting now, based on budget, priorities, and readiness.</li>
                              <li><strong className="text-platinum-white">Your results</strong> — These scores are based only on the answers you gave in this audit.</li>
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 3. Estimated opportunity value */}
                  {getEstimatedOpportunityValue(results.budgetTimeline, results.opportunityScore) && (
                    <div className="rounded-lg border border-radiant-gold/30 bg-radiant-gold/10 p-4">
                      <p className="text-platinum-white/70 text-sm">Estimated opportunity value</p>
                      <p className="text-xl font-bold text-radiant-gold">
                        {getEstimatedOpportunityValue(results.budgetTimeline, results.opportunityScore)}
                      </p>
                      <p className="text-platinum-white/60 text-xs mt-1">
                        Based on your budget and readiness; actual value depends on implementation and scope.
                      </p>
                    </div>
                  )}

                  {/* 4. Based on your answers */}
                  {(() => {
                    const drivers = getScoreDrivers(results)
                    const hasDrivers = drivers.urgency.length > 0 || drivers.opportunity.length > 0
                    if (!hasDrivers) return null
                    const allLines = [...new Set([...drivers.urgency, ...drivers.opportunity])]
                    return (
                      <div className="rounded-lg border border-platinum-white/20 bg-black/20 p-4">
                        <h2 className="text-platinum-white font-semibold mb-2">Based on your answers</h2>
                        <ul className="list-disc list-inside space-y-1 text-platinum-white/90 text-sm">
                          {allLines.slice(0, 5).map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                        <p className="text-platinum-white/80 text-sm mt-2">
                          {results.urgencyScore != null && results.opportunityScore != null
                            ? `Together, these support your Urgency score of ${results.urgencyScore} and Opportunity score of ${results.opportunityScore}.`
                            : results.urgencyScore != null
                              ? `Together, these support your Urgency score of ${results.urgencyScore}.`
                              : results.opportunityScore != null
                                ? `Together, these support your Opportunity score of ${results.opportunityScore}.`
                                : ''}
                        </p>
                      </div>
                    )
                  })()}

                  {/* 5. Recommended next steps */}
                  {(() => {
                    const areas = getImprovementAreas(results)
                    return (
                      <div>
                        <h2 className="text-lg font-semibold text-platinum-white mb-2">Recommended next steps</h2>
                        {areas.length > 0 ? (
                          <ul className="space-y-3 list-none p-0 m-0">
                            {areas.map((a) => (
                              <li key={a.id} className="rounded-lg border border-radiant-gold/30 bg-radiant-gold/5 p-4">
                                <p className="font-medium text-platinum-white">Improve: {a.label}</p>
                                <p className="text-sm text-platinum-white/80 mt-0.5">{a.reason}</p>
                                <Link
                                  href={a.nextStepUrl}
                                  className="inline-block mt-2 text-sm font-medium text-radiant-gold hover:underline focus:outline-none focus:ring-2 focus:ring-radiant-gold/50"
                                >
                                  {a.nextStepLabel} →
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <ul className="space-y-3 text-platinum-white/90">
                            <li>
                              <Link href="/resources" className="text-radiant-gold font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-radiant-gold/50">
                                Browse Resources →
                              </Link>
                              <span className="text-platinum-white/70"> — Templates, playbooks, and guides.</span>
                            </li>
                            <li>
                              <Link href="/" className="text-radiant-gold font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-radiant-gold/50">
                                Start a conversation in chat →
                              </Link>
                              <span className="text-platinum-white/70"> — Go deeper and get a tailored plan.</span>
                            </li>
                          </ul>
                        )}
                      </div>
                    )
                  })()}

                  <p className="text-platinum-white/60 text-sm">
                    Your responses have been saved. You can start a new audit anytime or head to Resources to find tools that match your goals.
                  </p>
                </>
              ) : (
                <p className="text-platinum-white/80">
                  Your audit has been saved. You can close this page or start another audit.
                </p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep('intro')
                    setAuditState(null)
                    setResults(null)
                    setCategoryIndex(0)
                    setSubmittedByCategory({})
                    setScoreDefinitionsOpen(false)
                    setError('')
                  }}
                  className="px-6 py-3 rounded-lg bg-radiant-gold text-imperial-navy font-semibold hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-radiant-gold focus:ring-offset-2 focus:ring-offset-imperial-navy"
                >
                  Start a new audit
                </button>
                <Link
                  href="/"
                  className="inline-flex items-center px-6 py-3 rounded-lg border border-radiant-gold/40 text-platinum-white hover:bg-radiant-gold/10 focus:outline-none focus:ring-2 focus:ring-radiant-gold/30"
                >
                  Back to home
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
