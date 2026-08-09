'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Link2, UserRound } from 'lucide-react'

type WorkflowSummaryTone = 'green' | 'yellow' | 'red' | 'blue' | 'slate'

export type MobileWorkflowSummaryProps = {
  title: string
  currentState: string
  owner: string
  nextAction: string
  waitingOnYou: string
  blocker?: string | null
  canonicalHref?: string | null
  canonicalLabel?: string
  tone?: WorkflowSummaryTone
}

const toneClasses: Record<WorkflowSummaryTone, string> = {
  green: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100',
  yellow: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
  red: 'border-red-500/40 bg-red-500/10 text-red-100',
  blue: 'border-blue-500/35 bg-blue-500/10 text-blue-100',
  slate: 'border-silicon-slate/70 bg-silicon-slate/20 text-foreground',
}

export default function MobileWorkflowSummary({
  title,
  currentState,
  owner,
  nextAction,
  waitingOnYou,
  blocker,
  canonicalHref,
  canonicalLabel = 'Open canonical view',
  tone = 'slate',
}: MobileWorkflowSummaryProps) {
  return (
    <section
      aria-label={`${title} mobile workflow summary`}
      className="mobile-workflow-summary rounded-xl border border-silicon-slate/70 bg-background/70 p-4 shadow-sm lg:hidden"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Current workflow</p>
          <p className="mt-1 text-base font-semibold text-foreground">{title}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClasses[tone]}`}>
          {currentState}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm">
        <div className="flex gap-3">
          <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Owner</dt>
            <dd className="mt-0.5 text-foreground">{owner}</dd>
          </div>
        </div>
        <div className="flex gap-3">
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next action</dt>
            <dd className="mt-0.5 leading-6 text-foreground">{nextAction}</dd>
          </div>
        </div>
        <div className="flex gap-3">
          {waitingOnYou.toLowerCase().startsWith('yes')
            ? <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />}
          <div className="min-w-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Waiting on you</dt>
            <dd className="mt-0.5 text-foreground">{waitingOnYou}</dd>
          </div>
        </div>
      </dl>

      {blocker ? (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm leading-6 text-red-50">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{blocker}</p>
          </div>
        </div>
      ) : null}

      {canonicalHref ? (
        <Link
          href={canonicalHref}
          className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-radiant-gold/45 bg-radiant-gold/10 px-3 py-2 text-sm font-semibold text-radiant-gold"
        >
          <Link2 className="h-4 w-4" />
          {canonicalLabel}
        </Link>
      ) : null}
    </section>
  )
}
