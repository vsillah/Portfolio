'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  Presentation,
  Sparkles,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import {
  buildPresentationBakeoffPlan,
  type PresentationAudience,
  type PresentationFormat,
  type PresentationBakeoffInput,
  type PresentationCandidate,
} from '@/lib/presentation-bakeoff'

const audienceOptions: { value: PresentationAudience; label: string }[] = [
  { value: 'colleagues', label: 'Colleagues' },
  { value: 'executives', label: 'Executives' },
  { value: 'clients', label: 'Clients' },
  { value: 'workshop_participants', label: 'Workshop participants' },
  { value: 'public_audience', label: 'Public audience' },
]

const formatOptions: { value: PresentationFormat; label: string }[] = [
  { value: 'one_hour_course', label: 'One-hour course' },
  { value: 'sales_presentation', label: 'Sales presentation' },
  { value: 'strategy_workshop', label: 'Strategy workshop' },
  { value: 'internal_update', label: 'Internal update' },
  { value: 'thought_leadership', label: 'Thought leadership' },
]

const defaultInput: PresentationBakeoffInput = {
  title: 'Accelerated',
  thesis: 'AI made artifacts cheaper. Product discipline turns speed into learning.',
  audience: 'colleagues',
  format: 'one_hour_course',
  durationMinutes: 60,
  proofAssets: [
    'Audit tool',
    'Value Evidence Pipeline',
    'Chat Eval',
    'Module Sync',
    'n8n workflow proof',
  ],
  demoRoutes: ['/tools/audit', '/admin/value-evidence', '/admin/chat-eval', '/admin/module-sync'],
  sourceAnchors: ['Stanford AI Index', 'McKinsey State of AI', 'Linux Foundation', 'Gartner agentic AI'],
  brandSystem: 'amadutown',
  needsEditablePptx: true,
  needsLiveDemos: true,
  needsSourceValidation: true,
  needsFacilitatorNotes: true,
}

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function joinLines(value: string[] | undefined): string {
  return (value ?? []).join('\n')
}

export default function PresentationGeneratorPage() {
  return (
    <ProtectedRoute requireAdmin>
      <PresentationGeneratorContent />
    </ProtectedRoute>
  )
}

function PresentationGeneratorContent() {
  const [title, setTitle] = useState(defaultInput.title)
  const [thesis, setThesis] = useState(defaultInput.thesis)
  const [audience, setAudience] = useState<PresentationAudience>(defaultInput.audience)
  const [format, setFormat] = useState<PresentationFormat>(defaultInput.format)
  const [durationMinutes, setDurationMinutes] = useState(String(defaultInput.durationMinutes))
  const [proofAssets, setProofAssets] = useState(joinLines(defaultInput.proofAssets))
  const [demoRoutes, setDemoRoutes] = useState(joinLines(defaultInput.demoRoutes))
  const [sourceAnchors, setSourceAnchors] = useState(joinLines(defaultInput.sourceAnchors))
  const [needsEditablePptx, setNeedsEditablePptx] = useState(Boolean(defaultInput.needsEditablePptx))
  const [needsLiveDemos, setNeedsLiveDemos] = useState(Boolean(defaultInput.needsLiveDemos))
  const [needsSourceValidation, setNeedsSourceValidation] = useState(Boolean(defaultInput.needsSourceValidation))
  const [needsFacilitatorNotes, setNeedsFacilitatorNotes] = useState(Boolean(defaultInput.needsFacilitatorNotes))
  const [copiedTool, setCopiedTool] = useState<string | null>(null)

  const input = useMemo<PresentationBakeoffInput>(() => {
    return {
      title,
      thesis,
      audience,
      format,
      durationMinutes: Number(durationMinutes) || 60,
      proofAssets: splitLines(proofAssets),
      demoRoutes: splitLines(demoRoutes),
      sourceAnchors: splitLines(sourceAnchors),
      brandSystem: 'amadutown',
      needsEditablePptx,
      needsLiveDemos,
      needsSourceValidation,
      needsFacilitatorNotes,
    }
  }, [
    title,
    thesis,
    audience,
    format,
    durationMinutes,
    proofAssets,
    demoRoutes,
    sourceAnchors,
    needsEditablePptx,
    needsLiveDemos,
    needsSourceValidation,
    needsFacilitatorNotes,
  ])

  const plan = useMemo(() => buildPresentationBakeoffPlan(input), [input])

  const copyPrompt = async (candidate: PresentationCandidate) => {
    await navigator.clipboard.writeText(candidate.generationPrompt)
    setCopiedTool(candidate.tool)
    window.setTimeout(() => setCopiedTool(null), 1400)
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <Breadcrumbs items={[{ label: 'Admin', href: '/admin' }, { label: 'Presentation Generator' }]} />

        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-radiant-gold">
              <Presentation size={22} />
              <span className="text-xs font-semibold uppercase tracking-[0.25em]">Presentation System</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
              Generate presentation options before choosing the deck.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              Create one shared brief, then compare Codex/PPTX, Claude Design, and Gamma against the same standards:
              clarity, voice, proof, demos, editability, export quality, and QA.
            </p>
          </div>
          <Link
            href="/admin/reports/gamma"
            className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/40 px-4 py-2 text-sm font-medium text-radiant-gold transition-colors hover:bg-radiant-gold/10"
          >
            Open Gamma generator
            <ExternalLink size={16} />
          </Link>
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <section className="rounded-xl border border-silicon-slate bg-silicon-slate/30 p-5">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
              <ClipboardList size={20} className="text-radiant-gold" />
              Brief
            </h2>
            <p className="mb-5 text-sm text-muted-foreground">
              Start with the same input for every tool. The bake-off is only useful when the candidates are working from the same job.
            </p>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded-lg border border-silicon-slate bg-background px-3 py-2 text-sm outline-none ring-radiant-gold/40 focus:ring-2"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Thesis</span>
                <textarea
                  value={thesis}
                  onChange={(event) => setThesis(event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-silicon-slate bg-background px-3 py-2 text-sm leading-6 outline-none ring-radiant-gold/40 focus:ring-2"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Audience</span>
                  <select
                    value={audience}
                    onChange={(event) => setAudience(event.target.value as PresentationAudience)}
                    className="w-full rounded-lg border border-silicon-slate bg-background px-3 py-2 text-sm outline-none ring-radiant-gold/40 focus:ring-2"
                  >
                    {audienceOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Minutes</span>
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={durationMinutes}
                    onChange={(event) => setDurationMinutes(event.target.value)}
                    className="w-full rounded-lg border border-silicon-slate bg-background px-3 py-2 text-sm outline-none ring-radiant-gold/40 focus:ring-2"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Format</span>
                <select
                  value={format}
                  onChange={(event) => setFormat(event.target.value as PresentationFormat)}
                  className="w-full rounded-lg border border-silicon-slate bg-background px-3 py-2 text-sm outline-none ring-radiant-gold/40 focus:ring-2"
                >
                  {formatOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <TextAreaList
                label="Proof assets"
                value={proofAssets}
                onChange={setProofAssets}
                placeholder="One proof asset per line"
              />
              <TextAreaList
                label="Demo routes"
                value={demoRoutes}
                onChange={setDemoRoutes}
                placeholder="/tools/audit"
              />
              <TextAreaList
                label="Source anchors"
                value={sourceAnchors}
                onChange={setSourceAnchors}
                placeholder="Stanford AI Index"
              />

              <div className="grid gap-2 rounded-lg border border-silicon-slate/70 bg-background/50 p-3">
                <Toggle label="Editable PPTX required" checked={needsEditablePptx} onChange={setNeedsEditablePptx} />
                <Toggle label="Live demos required" checked={needsLiveDemos} onChange={setNeedsLiveDemos} />
                <Toggle label="Market/source validation required" checked={needsSourceValidation} onChange={setNeedsSourceValidation} />
                <Toggle label="Facilitator notes required" checked={needsFacilitatorNotes} onChange={setNeedsFacilitatorNotes} />
              </div>
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-xl border border-radiant-gold/30 bg-radiant-gold/10 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.25em] text-radiant-gold">
                    Recommendation
                  </p>
                  <h2 className="text-2xl font-bold">{plan.recommendedLabel}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{plan.recommendation}</p>
                </div>
                <div className="rounded-lg border border-radiant-gold/40 bg-background px-4 py-3 text-center">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Best score</p>
                  <p className="text-3xl font-bold text-radiant-gold">{plan.candidates[0].totalScore.toFixed(2)}</p>
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              {plan.candidates.map((candidate) => (
                <CandidateCard
                  key={candidate.tool}
                  candidate={candidate}
                  copied={copiedTool === candidate.tool}
                  onCopy={() => void copyPrompt(candidate)}
                />
              ))}
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <ChecklistCard title="Course plan" items={plan.coursePlan} />
              <ChecklistCard title="Demo plan" items={plan.demoPlan} />
              <ChecklistCard title="Source plan" items={plan.sourcePlan} />
              <ChecklistCard title="Presentation-ready QA" items={plan.qaChecklist} />
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

function TextAreaList({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        placeholder={placeholder}
        className="w-full rounded-lg border border-silicon-slate bg-background px-3 py-2 text-sm leading-6 outline-none ring-radiant-gold/40 placeholder:text-muted-foreground/60 focus:ring-2"
      />
    </label>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-silicon-slate accent-radiant-gold"
      />
    </label>
  )
}

function CandidateCard({
  candidate,
  copied,
  onCopy,
}: {
  candidate: PresentationCandidate
  copied: boolean
  onCopy: () => void
}) {
  return (
    <article className="rounded-xl border border-silicon-slate bg-silicon-slate/30 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{candidate.label}</h3>
          <p className="mt-1 text-xs uppercase tracking-wider text-radiant-gold">{candidate.role}</p>
        </div>
        <div className="rounded-lg bg-background px-3 py-2 text-right">
          <p className="text-xs text-muted-foreground">Score</p>
          <p className="text-xl font-bold text-radiant-gold">{candidate.totalScore.toFixed(2)}</p>
        </div>
      </div>
      <p className="mb-2 text-sm text-muted-foreground">{candidate.bestFor}</p>
      <p className="mb-4 text-sm text-muted-foreground/80">
        <span className="font-medium text-foreground">Watch:</span> {candidate.watchOutFor}
      </p>

      <div className="mb-4 space-y-2">
        {candidate.scores.slice(0, 5).map((score) => (
          <div key={score.dimension}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{score.dimension}</span>
              <span className="font-medium">{score.score}/5</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-radiant-gold"
                style={{ width: `${score.score * 20}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onCopy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-silicon-slate bg-background px-3 py-2 text-sm font-medium transition-colors hover:border-radiant-gold/50 hover:text-radiant-gold"
      >
        {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
        {copied ? 'Copied prompt' : 'Copy prompt'}
      </button>
    </article>
  )
}

function ChecklistCard({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-xl border border-silicon-slate bg-silicon-slate/30 p-5">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Sparkles size={18} className="text-radiant-gold" />
        {title}
      </h3>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-sm leading-6 text-muted-foreground">
            <ArrowRight size={15} className="mt-1 shrink-0 text-radiant-gold" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
