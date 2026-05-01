'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import {
  TECHNOLOGY_BAKEOFF_PROFILES,
  TECHNOLOGY_BAKEOFF_SURFACES,
  buildTechnologyBakeoffPlan,
  type TechnologyBakeoffPriority,
  type TechnologyBakeoffSurface,
} from '@/lib/technology-bakeoff'

const PRIORITIES: Array<{ value: TechnologyBakeoffPriority; label: string }> = [
  { value: 'quality', label: 'Quality' },
  { value: 'speed', label: 'Speed' },
  { value: 'cost', label: 'Cost' },
  { value: 'reliability', label: 'Reliability' },
  { value: 'governance', label: 'Governance' },
  { value: 'brand_control', label: 'Brand control' },
  { value: 'conversion', label: 'Conversion' },
]

export default function TechnologyBakeoffsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <TechnologyBakeoffsContent />
    </ProtectedRoute>
  )
}

function TechnologyBakeoffsContent() {
  const [surface, setSurface] = useState<TechnologyBakeoffSurface>('media_generation')
  const [priority, setPriority] = useState<TechnologyBakeoffPriority>('reliability')
  const [objective, setObjective] = useState('Choose the best current tool before changing the Portfolio default.')
  const [currentDefault, setCurrentDefault] = useState('')
  const [knownFailure, setKnownFailure] = useState('')
  const [candidateOverrides, setCandidateOverrides] = useState('')

  const plan = useMemo(() => {
    return buildTechnologyBakeoffPlan({
      surface,
      objective,
      priority,
      currentDefault: currentDefault || undefined,
      knownFailure: knownFailure || undefined,
      candidateOverrides: candidateOverrides
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    })
  }, [candidateOverrides, currentDefault, knownFailure, objective, priority, surface])

  const profile = TECHNOLOGY_BAKEOFF_PROFILES[surface]

  return (
    <div className="min-h-screen bg-background text-foreground p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs items={[{ label: 'Admin Dashboard', href: '/admin' }, { label: 'Technology Bakeoffs' }]} />

        <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1">Technology Bakeoffs</h1>
            <p className="text-muted-foreground text-sm max-w-3xl">
              Compare fast-moving tools before Portfolio promotes a new default. V1 creates the scoring plan and
              promotion gate only; it does not call vendors, persist results, or change production settings.
            </p>
          </div>
          <div className="rounded-lg border border-radiant-gold/40 bg-radiant-gold/10 px-4 py-3 text-sm text-radiant-gold">
            Read-only planning mode
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
          <aside className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/25 p-5 h-fit">
            <h2 className="text-lg font-semibold mb-4">Bakeoff Setup</h2>

            <label className="block text-sm font-medium mb-2" htmlFor="surface">
              Surface
            </label>
            <select
              id="surface"
              value={surface}
              onChange={(event) => setSurface(event.target.value as TechnologyBakeoffSurface)}
              className="w-full rounded-lg border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm mb-4"
            >
              {TECHNOLOGY_BAKEOFF_SURFACES.map((item) => (
                <option key={item} value={item}>
                  {TECHNOLOGY_BAKEOFF_PROFILES[item].label}
                </option>
              ))}
            </select>

            <label className="block text-sm font-medium mb-2" htmlFor="objective">
              Decision question
            </label>
            <textarea
              id="objective"
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm mb-4"
            />

            <label className="block text-sm font-medium mb-2" htmlFor="priority">
              Priority
            </label>
            <select
              id="priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as TechnologyBakeoffPriority)}
              className="w-full rounded-lg border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm mb-4"
            >
              {PRIORITIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <label className="block text-sm font-medium mb-2" htmlFor="current-default">
              Current default
            </label>
            <input
              id="current-default"
              value={currentDefault}
              onChange={(event) => setCurrentDefault(event.target.value)}
              placeholder="Optional"
              className="w-full rounded-lg border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm mb-4"
            />

            <label className="block text-sm font-medium mb-2" htmlFor="known-failure">
              Known failure
            </label>
            <input
              id="known-failure"
              value={knownFailure}
              onChange={(event) => setKnownFailure(event.target.value)}
              placeholder="Optional"
              className="w-full rounded-lg border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm mb-4"
            />

            <label className="block text-sm font-medium mb-2" htmlFor="candidate-overrides">
              Extra candidates
            </label>
            <input
              id="candidate-overrides"
              value={candidateOverrides}
              onChange={(event) => setCandidateOverrides(event.target.value)}
              placeholder="Comma separated"
              className="w-full rounded-lg border border-silicon-slate/70 bg-background/70 px-3 py-2 text-sm"
            />
          </aside>

          <main className="space-y-6">
            <section className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/25 p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{profile.adminArea}</p>
                  <h2 className="text-2xl font-semibold mt-1">{plan.surfaceLabel}</h2>
                </div>
                <span className="rounded-full border border-silicon-slate/60 bg-background/50 px-3 py-1 text-xs text-muted-foreground">
                  {plan.specialistSource ? `Specialist: ${plan.specialistSource}` : 'Generic evaluator'}
                </span>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{plan.recommendedAction}</p>
              <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                <Signal label="Decision" value={plan.decision.replaceAll('_', ' ')} />
                <Signal label="Current default" value={plan.currentDefault} />
                <Signal label="Fallback" value={plan.fallback} />
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Panel icon={<ClipboardList size={18} />} title="Benchmark Runbook" items={plan.benchmarkRunbook} />
              <Panel icon={<ShieldCheck size={18} />} title="Promotion Gate" items={plan.promotionGate} />
              <Panel icon={<RotateCcw size={18} />} title="Rollback Plan" items={plan.rollbackPlan} />
              <Panel icon={<CheckCircle2 size={18} />} title="Missing Evidence" items={plan.missingEvidence} />
            </section>

            <section className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/25 p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={18} className="text-radiant-gold" />
                <h2 className="text-lg font-semibold">Scoring Dimensions</h2>
              </div>
              <div className="space-y-3">
                {plan.scores.map((score) => (
                  <div key={score.dimension} className="rounded-lg border border-silicon-slate/60 bg-background/35 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-medium">{score.dimension}</p>
                      <p className="text-sm text-muted-foreground">
                        {score.score}/5 x {Math.round(score.weight * 100)}% = {score.weightedScore.toFixed(2)}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{score.evidence}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/25 p-5">
              <div className="flex items-center gap-2 mb-4">
                <ArrowRight size={18} className="text-radiant-gold" />
                <h2 className="text-lg font-semibold">Candidates</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plan.candidates.map((candidate) => (
                  <div key={candidate.id} className="rounded-lg border border-silicon-slate/60 bg-background/35 p-4">
                    <p className="font-semibold">{candidate.label}</p>
                    <p className="text-xs text-radiant-gold mt-1">{candidate.role}</p>
                    <p className="text-sm text-muted-foreground mt-3">{candidate.bestFor}</p>
                    <p className="text-xs text-muted-foreground mt-3">Watch: {candidate.watchOutFor}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/25 p-5">
              <h2 className="text-lg font-semibold mb-3">Integration Notes</h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {plan.integrationNotes.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-radiant-gold shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 rounded-lg border border-silicon-slate/60 bg-background/35 p-4 text-sm">
                <span className="font-medium">Next step: </span>
                {plan.nextImplementationStep}
              </p>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-silicon-slate/60 bg-background/35 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium capitalize">{value}</p>
    </div>
  )
}

function Panel({ icon, title, items }: { icon: ReactNode; title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/25 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-radiant-gold">{icon}</span>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-radiant-gold shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
