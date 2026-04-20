'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { getCurrentSession } from '@/lib/auth'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AUDIT_CATEGORIES,
  AUDIT_CATEGORY_ORDER,
  categoryFormToPayload,
  type AuditCategoryConfig,
  type AuditField,
} from '@/lib/audit-questions'
import { getIndustryOptions } from '@/lib/constants/industry'
import SiteThemeCorner from '@/components/SiteThemeCorner'
import LatestAuditBanner from '@/components/audits/LatestAuditBanner'
import AuditReportView from '@/components/audits/AuditReportView'
import { STEP_LABELS, type AuditReportViewModel } from '@/lib/audit-report-view'

type Step = 'intro' | 'context' | 'form' | 'results'

const INDUSTRY_OPTIONS = getIndustryOptions()

interface ContextFormData {
  businessName: string
  websiteUrl: string
  email: string
  industry: string
}

interface AuditState {
  sessionId: string
  auditId: string
}

// Canonical view-model comes from lib/audit-report-view; keep a local alias so
// the rest of this page's code reads the same after extraction.
type FetchedAudit = AuditReportViewModel

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
        className="w-full px-4 py-2 rounded-lg bg-black/40 border border-radiant-gold/40 text-foreground focus:border-radiant-gold focus:ring-2 focus:ring-radiant-gold/30 focus:outline-none"
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
          className="w-full px-4 py-2 rounded-lg bg-black/40 border border-radiant-gold/40 text-foreground focus:border-radiant-gold focus:ring-2 focus:ring-radiant-gold/30 focus:outline-none"
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
            <label className="block text-muted-foreground text-sm mb-1">Please specify</label>
            <input
              type="text"
              value={valueOther ?? ''}
              onChange={(e) => onOtherChange(e.target.value)}
              placeholder="Please specify"
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-radiant-gold/40 text-foreground placeholder:text-muted-foreground/90 focus:border-radiant-gold focus:ring-2 focus:ring-radiant-gold/30 focus:outline-none text-sm"
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
        <p className="text-muted-foreground text-xs">Select all that apply</p>
        {field.options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-foreground/90">
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
            <label className="block text-muted-foreground text-sm mb-1">Please specify</label>
            <input
              type="text"
              value={valueOther ?? ''}
              onChange={(e) => onOtherChange(e.target.value)}
              placeholder="Please specify"
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-radiant-gold/40 text-foreground placeholder:text-muted-foreground/90 focus:border-radiant-gold focus:ring-2 focus:ring-radiant-gold/30 focus:outline-none text-sm"
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
        className="w-full px-4 py-2 rounded-lg bg-black/40 border border-radiant-gold/40 text-foreground placeholder:text-muted-foreground/90 focus:border-radiant-gold focus:ring-2 focus:ring-radiant-gold/30 focus:outline-none resize-y"
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
        className="w-full px-4 py-2 rounded-lg bg-black/40 border border-radiant-gold/40 text-foreground placeholder:text-muted-foreground/90 focus:border-radiant-gold focus:ring-2 focus:ring-radiant-gold/30 focus:outline-none resize-y"
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
      className="w-full px-4 py-2 rounded-lg bg-black/40 border border-radiant-gold/40 text-foreground placeholder:text-muted-foreground/90 focus:border-radiant-gold focus:ring-2 focus:ring-radiant-gold/30 focus:outline-none"
      aria-label={field.label}
    />
  )
}

async function getJsonAuthHeaders(): Promise<HeadersInit> {
  const session = await getCurrentSession()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }
  return headers
}

export default function AuditToolPage() {
  const { user } = useAuth()
  const [step, setStep] = useState<Step>('intro')
  const [auditState, setAuditState] = useState<AuditState | null>(null)
  const [categoryIndex, setCategoryIndex] = useState(0)
  const [formValues, setFormValues] = useState<Record<string, string | string[] | boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<FetchedAudit | null>(null)
  /** Persist submitted form values per category so "Back" can restore */
  const [submittedByCategory, setSubmittedByCategory] = useState<Record<string, Record<string, string | string[] | boolean>>>({})
  /** Step 0: context capture form */
  const [contextForm, setContextForm] = useState<ContextFormData>({
    businessName: '',
    websiteUrl: '',
    email: '',
    industry: '',
  })

  const category = AUDIT_CATEGORIES[categoryIndex] as AuditCategoryConfig | undefined
  const isLastCategory = categoryIndex === AUDIT_CATEGORIES.length - 1

  const startAudit = useCallback(async () => {
    setError('')
    setSubmitting(true)
    try {
      const body: Record<string, string> = {}
      if (contextForm.businessName.trim()) body.businessName = contextForm.businessName.trim()
      if (contextForm.websiteUrl.trim()) body.websiteUrl = contextForm.websiteUrl.trim()
      if (contextForm.email.trim()) body.email = contextForm.email.trim()
      if (contextForm.industry) body.industry = contextForm.industry

      const res = await fetch('/api/tools/audit/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
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
  }, [contextForm])

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
      const headers = await getJsonAuthHeaders()
      const res = await fetch('/api/tools/audit/update', {
        method: 'PUT',
        headers,
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
    <>
      <SiteThemeCorner />
    <div className="min-h-screen bg-background text-foreground pt-12 pb-12 px-4">
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
              <p className="text-muted-foreground">
                This short assessment uses the same structure as our chat-based diagnostic. Answer one section at a time;
                your answers are saved and you can use the results to prioritize next steps or share with your team.
              </p>
              <p className="text-muted-foreground text-sm">
                There are 6 sections: Business challenges, Tech stack, Automation needs, AI readiness, Budget & timeline,
                and Decision making.
              </p>
              {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}
              <button
                type="button"
                onClick={() => setStep('context')}
                className="px-6 py-3 rounded-lg bg-radiant-gold text-imperial-navy font-semibold hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-radiant-gold focus:ring-offset-2 focus:ring-offset-imperial-navy disabled:opacity-50"
              >
                Get started
              </button>
              <p className="text-muted-foreground/90 text-sm">
                <Link href="/" className="text-radiant-gold/80 hover:underline">Back to home</Link>
              </p>
            </motion.div>
          )}

          {step === 'context' && (
            <motion.div
              key="context"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <h1 className="text-3xl font-bold text-radiant-gold">Tell us about your business</h1>
              <p className="text-muted-foreground">
                The more context you provide, the more personalized your report will be.
                All fields are optional &mdash; you can skip ahead and come back later.
              </p>

              <div className="space-y-4">
                <div>
                  <label htmlFor="ctx-name" className="block text-sm font-medium text-muted-foreground mb-1">
                    Business name
                  </label>
                  <input
                    id="ctx-name"
                    type="text"
                    value={contextForm.businessName}
                    onChange={(e) => setContextForm((p) => ({ ...p, businessName: e.target.value }))}
                    placeholder="Acme Corp"
                    className="w-full px-4 py-2 rounded-lg bg-black/40 border border-radiant-gold/40 text-foreground placeholder:text-muted-foreground/90 focus:border-radiant-gold focus:ring-2 focus:ring-radiant-gold/30 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="ctx-url" className="block text-sm font-medium text-muted-foreground mb-1">
                    Website URL
                  </label>
                  <input
                    id="ctx-url"
                    type="url"
                    value={contextForm.websiteUrl}
                    onChange={(e) => setContextForm((p) => ({ ...p, websiteUrl: e.target.value }))}
                    placeholder="https://example.com"
                    className="w-full px-4 py-2 rounded-lg bg-black/40 border border-radiant-gold/40 text-foreground placeholder:text-muted-foreground/90 focus:border-radiant-gold focus:ring-2 focus:ring-radiant-gold/30 focus:outline-none"
                  />
                  <p className="text-muted-foreground/90 text-xs mt-1">
                    We&apos;ll analyze your site to detect your tech stack and tailor recommendations.
                  </p>
                </div>

                <div>
                  <label htmlFor="ctx-email" className="block text-sm font-medium text-muted-foreground mb-1">
                    Email
                  </label>
                  <input
                    id="ctx-email"
                    type="email"
                    value={contextForm.email}
                    onChange={(e) => setContextForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="you@example.com"
                    className="w-full px-4 py-2 rounded-lg bg-black/40 border border-radiant-gold/40 text-foreground placeholder:text-muted-foreground/90 focus:border-radiant-gold focus:ring-2 focus:ring-radiant-gold/30 focus:outline-none"
                  />
                  <p className="text-muted-foreground/90 text-xs mt-1">
                    Required for your personalized strategy report. We won&apos;t spam you.
                  </p>
                  <div className="mt-3">
                    <LatestAuditBanner mode="public" email={contextForm.email} />
                  </div>
                </div>

                <div>
                  <label htmlFor="ctx-industry" className="block text-sm font-medium text-muted-foreground mb-1">
                    Industry
                  </label>
                  <select
                    id="ctx-industry"
                    value={contextForm.industry}
                    onChange={(e) => setContextForm((p) => ({ ...p, industry: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg bg-black/40 border border-radiant-gold/40 text-foreground focus:border-radiant-gold focus:ring-2 focus:ring-radiant-gold/30 focus:outline-none"
                  >
                    <option value="">Select your industry…</option>
                    {INDUSTRY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tier preview hint */}
              {(contextForm.email || contextForm.websiteUrl || contextForm.industry) && (
                <div className="rounded-lg border border-radiant-gold/20 bg-radiant-gold/5 p-3">
                  <p className="text-sm text-muted-foreground">
                    {contextForm.email && contextForm.websiteUrl && contextForm.industry
                      ? '✨ Full Analysis — you\'ll get a personalized report with tech stack analysis, industry benchmarks, and a strategy deck.'
                      : contextForm.email
                        ? '📊 Smart Report — complete your URL and industry for the full analysis.'
                        : '📋 Add your email to unlock the personalized report tier.'}
                  </p>
                </div>
              )}

              {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('intro')}
                  className="px-4 py-2 rounded-lg border border-radiant-gold/40 text-foreground hover:bg-radiant-gold/10 focus:outline-none focus:ring-2 focus:ring-radiant-gold/30"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={startAudit}
                  disabled={submitting}
                  className="px-6 py-3 rounded-lg bg-radiant-gold text-imperial-navy font-semibold hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-radiant-gold focus:ring-offset-2 focus:ring-offset-imperial-navy disabled:opacity-50"
                >
                  {submitting ? 'Starting…' : 'Begin audit'}
                </button>
              </div>
              <p className="text-muted-foreground/90 text-xs">
                All fields are optional. You can skip ahead and still get a basic report.
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
                <p className="text-muted-foreground text-sm mb-3">Your progress</p>
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
                            ${!completed && !current ? 'bg-muted/50 text-muted-foreground/90' : ''}
                          `}
                        >
                          {completed ? '✓' : stepNum}
                        </div>
                        <span className={`mt-1 text-xs ${current ? 'text-radiant-gold font-medium' : completed ? 'text-muted-foreground' : 'text-muted-foreground/90'}`}>
                          {label}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
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
                <span className="text-muted-foreground text-sm">
                  Step {categoryIndex + 1} of {AUDIT_CATEGORIES.length}
                </span>
              </div>
              <p className="text-muted-foreground">{category.description}</p>
              <div className="space-y-4">
                {category.fields.map((f) => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
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
                    className="px-4 py-2 rounded-lg border border-radiant-gold/40 text-foreground hover:bg-radiant-gold/10 focus:outline-none focus:ring-2 focus:ring-radiant-gold/30"
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
              {results ? (
                <AuditReportView
                  report={results}
                  headerVariant="flow"
                  footerSlot={
                    <div className="space-y-3">
                      <p className="text-muted-foreground text-sm">
                        Your responses have been saved. You can start a new audit anytime or head to Resources to find tools that match your goals.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setStep('intro')
                            setAuditState(null)
                            setResults(null)
                            setCategoryIndex(0)
                            setSubmittedByCategory({})
                            setError('')
                            setContextForm({ businessName: '', websiteUrl: '', email: '', industry: '' })
                          }}
                          className="px-6 py-3 rounded-lg bg-radiant-gold text-imperial-navy font-semibold hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-radiant-gold focus:ring-offset-2 focus:ring-offset-imperial-navy"
                        >
                          Start a new audit
                        </button>
                        {user && (
                          <Link
                            href="/purchases#audit"
                            className="inline-flex items-center px-6 py-3 rounded-lg border border-radiant-gold/40 text-foreground hover:bg-radiant-gold/10 focus:outline-none focus:ring-2 focus:ring-radiant-gold/30"
                          >
                            Open My library
                          </Link>
                        )}
                        <Link
                          href="/"
                          className="inline-flex items-center px-6 py-3 rounded-lg border border-radiant-gold/40 text-foreground hover:bg-radiant-gold/10 focus:outline-none focus:ring-2 focus:ring-radiant-gold/30"
                        >
                          Back to home
                        </Link>
                      </div>
                      {user && (
                        <p className="text-muted-foreground text-sm">
                          Your report is saved to{' '}
                          <Link href="/purchases#audit" className="text-radiant-gold/90 hover:underline">
                            My library
                          </Link>{' '}
                          while you&apos;re signed in (same email as your audit helps if you complete it as a guest).
                        </p>
                      )}
                    </div>
                  }
                />
              ) : (
                <>
                  <h1 className="text-3xl font-bold text-radiant-gold">Your audit is complete</h1>
                  <p className="text-muted-foreground">
                    Your audit has been saved. You can close this page or start another audit.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('intro')
                        setAuditState(null)
                        setResults(null)
                        setCategoryIndex(0)
                        setSubmittedByCategory({})
                        setError('')
                        setContextForm({ businessName: '', websiteUrl: '', email: '', industry: '' })
                      }}
                      className="px-6 py-3 rounded-lg bg-radiant-gold text-imperial-navy font-semibold hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-radiant-gold focus:ring-offset-2 focus:ring-offset-imperial-navy"
                    >
                      Start a new audit
                    </button>
                    <Link
                      href="/"
                      className="inline-flex items-center px-6 py-3 rounded-lg border border-radiant-gold/40 text-foreground hover:bg-radiant-gold/10 focus:outline-none focus:ring-2 focus:ring-radiant-gold/30"
                    >
                      Back to home
                    </Link>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
    </>
  )
}
