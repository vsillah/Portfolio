'use client'

/**
 * Shared rich audit report view.
 *
 * Single source of truth for rendering a completed diagnostic audit. Used by:
 *  - `app/tools/audit/page.tsx` on `step === 'results'` (immediately after
 *    finishing the audit)
 *  - `app/tools/audit/report/[auditId]/page.tsx` (persistent permalink)
 *
 * Design notes:
 *  - Purely presentational. Consumers pass a `report: AuditReportViewModel`
 *    (the camelCase shape returned by `/api/chat/diagnostic`).
 *  - Drawer open/close state is owned internally — it's local UI, not app state.
 *  - No `AnimatePresence` / `motion` wrappers; the flow page handles its own
 *    step transitions at the parent level.
 *  - Auth-gated UI (PDF buttons, "Open My library", etc.) lives in `footerSlot`
 *    so the component itself stays auth-agnostic.
 */

import Link from 'next/link'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { getIndustryDisplayName } from '@/lib/constants/industry'
import {
  getCategoryCaptureStatus,
  getEstimatedOpportunityValue,
  getImprovementAreas,
  getScoreBand,
  getScoreDefinition,
  getScoreDrivers,
  getScoreStyle,
  getOpportunityImprovements,
  getUrgencyImprovements,
  STEP_LABELS,
  type AuditReportViewModel,
  type ScoreType,
} from '@/lib/audit-report-view'

// ---------------------------------------------------------------------------
// ScoreSpectrumBar — 0–10 horizontal segment bar with a gold marker
// ---------------------------------------------------------------------------

function ScoreSpectrumBar({ score, scoreType }: { score: number; scoreType: ScoreType }) {
  const band = getScoreBand(score)
  const style = getScoreStyle(band)
  const label = `${scoreType === 'urgency' ? 'Urgency' : 'Opportunity'} score ${score} out of 10, ${style.label} range`
  return (
    <div className="mt-2" role="img" aria-label={label}>
      <div className="flex items-center justify-between text-xs text-muted-foreground/90 mb-0.5">
        <span>0</span>
        <span>10</span>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted/50">
        <div className="absolute inset-0 flex">
          <div className="w-[30%] bg-red-500/20" />
          <div className="w-[30%] bg-amber-500/20" />
          <div className="w-[40%] bg-emerald-500/20" />
        </div>
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-radiant-gold rounded-full shadow-md"
          style={{ left: `${(score / 10) * 100}%`, transform: 'translateX(-50%)' }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tier badge (unified across variants)
// ---------------------------------------------------------------------------

function tierDisplay(tier: string | null | undefined): { label: string; classes: string } | null {
  switch (tier) {
    case 'platinum':
      return { label: 'Strategy Package', classes: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200' }
    case 'gold':
      return { label: 'Full Analysis', classes: 'bg-yellow-500/20 border-yellow-400/40 text-yellow-200' }
    case 'silver':
      return { label: 'Smart Report', classes: 'bg-slate-400/20 border-slate-300/40 text-slate-200' }
    case 'bronze':
      return { label: 'Basic Report', classes: 'bg-amber-700/20 border-amber-600/40 text-amber-300' }
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Score card (reused for both urgency and opportunity)
// ---------------------------------------------------------------------------

function ScoreCard({ score, scoreType }: { score: number; scoreType: ScoreType }) {
  const band = getScoreBand(score)
  const style = getScoreStyle(band)
  const definition = getScoreDefinition(band, scoreType)
  const tips = scoreType === 'urgency' ? getUrgencyImprovements(score) : getOpportunityImprovements(score)
  const heading = scoreType === 'urgency' ? 'Urgency score' : 'Opportunity score'
  return (
    <div className="rounded-lg border border-foreground/20 bg-black/20 p-4">
      <p className="text-muted-foreground text-sm">{heading}</p>
      <div className="flex flex-wrap items-center gap-2 mt-1">
        <span className="text-2xl font-bold">{score}/10</span>
        <span className="text-sm font-medium opacity-90">({style.label})</span>
      </div>
      <p className="text-xs opacity-90 mt-1" style={{ lineHeight: 1.35 }}>{definition}</p>
      <ScoreSpectrumBar score={score} scoreType={scoreType} />
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
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export type AuditReportViewProps = {
  report: AuditReportViewModel
  /**
   * - `flow`: header reads "Audit Complete" (post-completion celebration).
   * - `permalink`: header reads "Audit Report" (persistent/shareable surface).
   */
  headerVariant?: 'flow' | 'permalink'
  /** Default true. Shows the 6-step "What we captured" indicator. */
  showCaptureSummary?: boolean
  /**
   * Optional content rendered below the report sections — typical uses:
   *   - PDF button (permalink)
   *   - Start-new-audit / My library / Back to home actions (flow)
   * Kept outside the view so auth-gated UI stays at the page level.
   */
  footerSlot?: ReactNode
}

export default function AuditReportView({
  report,
  headerVariant = 'permalink',
  showCaptureSummary = true,
  footerSlot,
}: AuditReportViewProps) {
  const [scoreDefinitionsOpen, setScoreDefinitionsOpen] = useState(false)

  const headerCompleteLabel = headerVariant === 'flow' ? 'Audit Complete' : 'Audit Report'
  const headerFallback = headerVariant === 'flow' ? 'Your audit is complete' : 'Your Audit Report'
  const tier = tierDisplay(report.reportTier)
  const industryLabel = report.industrySlug ? getIndustryDisplayName(report.industrySlug) : null
  const captured = showCaptureSummary ? getCategoryCaptureStatus(report) : null
  const estimatedValue = getEstimatedOpportunityValue(report.budgetTimeline, report.opportunityScore)
  const drivers = getScoreDrivers(report)
  const driverLines = Array.from(new Set([...drivers.urgency, ...drivers.opportunity]))
  const hasDrivers = driverLines.length > 0
  const improvementAreas = getImprovementAreas(report)
  const enriched = report.enrichedTechStack
  const hasEnrichedTech = !!(enriched?.technologies && enriched.technologies.length > 0)

  return (
    <div className="space-y-6">
      {/* Header: title, optional industry, tier badge */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-radiant-gold">
            {report.businessName ? `${report.businessName} — ${headerCompleteLabel}` : headerFallback}
          </h1>
          {industryLabel && (
            <p className="text-muted-foreground text-sm mt-1">{industryLabel}</p>
          )}
        </div>
        {tier && (
          <span className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${tier.classes}`}>
            {tier.label}
          </span>
        )}
      </div>

      {/* What we captured */}
      {captured && (
        <div className="rounded-xl border border-radiant-gold/30 bg-black/20 p-4" aria-label="Inputs captured">
          <p className="text-muted-foreground text-sm mb-3">What we captured</p>
          <div className="flex items-center justify-between gap-1">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex flex-1 flex-col items-center">
                <div
                  className={`
                    flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold
                    ${captured[i] ? 'bg-radiant-gold text-imperial-navy' : 'bg-muted/50 text-muted-foreground/90'}
                  `}
                  aria-hidden
                >
                  {captured[i] ? '✓' : i + 1}
                </div>
                <span className={`mt-1 text-xs ${captured[i] ? 'text-muted-foreground' : 'text-muted-foreground/90'}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Score cards + "What your scores mean" drawer */}
      {(report.urgencyScore != null || report.opportunityScore != null) && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {report.urgencyScore != null && (
              <ScoreCard score={report.urgencyScore} scoreType="urgency" />
            )}
            {report.opportunityScore != null && (
              <ScoreCard score={report.opportunityScore} scoreType="opportunity" />
            )}
          </div>

          <div className="rounded-lg border border-foreground/20 bg-black/20 overflow-hidden">
            <button
              type="button"
              onClick={() => setScoreDefinitionsOpen((o) => !o)}
              className="w-full px-4 py-3 flex items-center justify-between text-left text-foreground/90 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-radiant-gold/30 rounded-lg"
              aria-expanded={scoreDefinitionsOpen}
            >
              <span className="font-semibold text-foreground">What your scores mean</span>
              <span className="text-muted-foreground text-sm" aria-hidden>
                {scoreDefinitionsOpen ? '▼' : '▶'}
              </span>
            </button>
            {scoreDefinitionsOpen && (
              <div className="px-4 pb-4 pt-0 border-t border-foreground/10">
                <ul className="list-disc list-inside space-y-1.5 text-foreground/90 text-sm mt-3">
                  <li><strong className="text-foreground">Urgency (0–10)</strong> — How soon it makes sense to act, based on your timeline, decision process, and pain level.</li>
                  <li><strong className="text-foreground">Opportunity (0–10)</strong> — How much impact you could get from acting now, based on budget, priorities, and readiness.</li>
                  <li><strong className="text-foreground">Your results</strong> — These scores are based only on the answers you gave in this audit.</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Estimated opportunity value (shows when budget + opportunity score combine to a band) */}
      {estimatedValue && (
        <div className="rounded-lg border border-radiant-gold/30 bg-radiant-gold/10 p-4">
          <p className="text-muted-foreground text-sm">Estimated opportunity value</p>
          <p className="text-xl font-bold text-radiant-gold">{estimatedValue}</p>
          <p className="text-muted-foreground text-xs mt-1">
            Based on your budget and readiness; actual value depends on implementation and scope.
          </p>
        </div>
      )}

      {/* AI-generated summary (when present) */}
      {report.diagnosticSummary && (
        <div className="rounded-lg border border-foreground/20 bg-black/20 p-4">
          <h2 className="font-semibold text-foreground mb-2">Summary</h2>
          <p className="text-sm text-muted-foreground">{report.diagnosticSummary}</p>
        </div>
      )}

      {/* AI key insights (when present) */}
      {report.keyInsights && report.keyInsights.length > 0 && (
        <div className="rounded-lg border border-foreground/20 bg-black/20 p-4">
          <h2 className="font-semibold text-foreground mb-2">Key Insights</h2>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            {report.keyInsights.map((insight, i) => (
              <li key={i}>{insight}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Based on your answers — score drivers */}
      {hasDrivers && (
        <div className="rounded-lg border border-foreground/20 bg-black/20 p-4">
          <h2 className="text-foreground font-semibold mb-2">Based on your answers</h2>
          <ul className="list-disc list-inside space-y-1 text-foreground/90 text-sm">
            {driverLines.slice(0, 5).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <p className="text-muted-foreground text-sm mt-2">
            {report.urgencyScore != null && report.opportunityScore != null
              ? `Together, these support your Urgency score of ${report.urgencyScore} and Opportunity score of ${report.opportunityScore}.`
              : report.urgencyScore != null
                ? `Together, these support your Urgency score of ${report.urgencyScore}.`
                : report.opportunityScore != null
                  ? `Together, these support your Opportunity score of ${report.opportunityScore}.`
                  : ''}
          </p>
        </div>
      )}

      {/* Recommended next steps */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-2">Recommended next steps</h2>
        {improvementAreas.length > 0 ? (
          <ul className="space-y-3 list-none p-0 m-0">
            {improvementAreas.map((a) => (
              <li key={a.id} className="rounded-lg border border-radiant-gold/30 bg-radiant-gold/5 p-4">
                <p className="font-medium text-foreground">Improve: {a.label}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{a.reason}</p>
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
          <ul className="space-y-3 text-foreground/90">
            <li>
              <Link href="/resources" className="text-radiant-gold font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-radiant-gold/50">
                Browse Resources →
              </Link>
              <span className="text-muted-foreground"> — Templates, playbooks, and guides.</span>
            </li>
            <li>
              <Link href="/" className="text-radiant-gold font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-radiant-gold/50">
                Start a conversation in chat →
              </Link>
              <span className="text-muted-foreground"> — Go deeper and get a tailored plan.</span>
            </li>
          </ul>
        )}
      </div>

      {/* Tech Stack Analysis (Gold tier — when BuiltWith enrichment is available) */}
      {hasEnrichedTech && enriched && (
        <div className="rounded-lg border border-radiant-gold/30 bg-black/20 p-4">
          <h2 className="text-lg font-semibold text-foreground mb-2">Tech Stack Analysis</h2>
          <p className="text-muted-foreground text-sm mb-3">
            We detected the following technologies on{' '}
            <span className="text-radiant-gold">{enriched.domain || report.websiteUrl}</span>:
          </p>
          {enriched.byTag && Object.keys(enriched.byTag).length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(enriched.byTag).slice(0, 8).map(([tag, tools]) => (
                <div key={tag} className="rounded-md bg-muted/40 p-2">
                  <p className="text-xs font-medium text-radiant-gold/80">{tag}</p>
                  <p className="text-sm text-foreground/90">{(tools as string[]).join(', ')}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {enriched.technologies!.slice(0, 12).map((tech) => (
                <span key={tech.name} className="inline-block rounded-full bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
                  {tech.name}
                </span>
              ))}
              {enriched.technologies!.length > 12 && (
                <span className="inline-block rounded-full bg-muted/40 px-3 py-1 text-xs text-muted-foreground/90">
                  +{enriched.technologies!.length - 12} more
                </span>
              )}
            </div>
          )}

          {/* Cross-reference with self-reported stack */}
          {typeof report.techStack?.crm === 'string' && report.techStack.crm && (
            <div className="mt-3 pt-3 border-t border-foreground/10">
              <p className="text-xs text-muted-foreground">
                You reported using <span className="text-muted-foreground">{report.techStack.crm}</span> as your CRM
                {typeof report.techStack.marketing === 'string' && report.techStack.marketing
                  ? ` and ${report.techStack.marketing} for marketing`
                  : ''}.
                {enriched.byTag?.['Analytics'] ? ' We also detected analytics tools on your site.' : ''}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Locked sections — unlock prompts for upgradeable tiers */}
      {!hasEnrichedTech && !report.websiteUrl && (
        <LockedPrompt
          title="Tech Stack Analysis"
          body="Add your website URL to unlock a comparison of your detected tech stack vs. what you reported."
        />
      )}

      {!report.websiteUrl && (
        <LockedPrompt
          title="Website Visual Analysis"
          body="Add your website URL and industry to unlock an annotated analysis of your site with specific improvement recommendations."
        />
      )}

      {(!report.contactEmail || !report.websiteUrl || !report.industrySlug) && (
        <LockedPrompt
          title="Personalized Strategy Deck"
          body="Complete your audit with email, website URL, and industry to unlock a downloadable strategy deck tailored to your business."
        />
      )}

      {footerSlot && <div>{footerSlot}</div>}
    </div>
  )
}

function LockedPrompt({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-foreground/20 bg-black/10 p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl opacity-60" aria-hidden>🔒</span>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{body}</p>
        </div>
      </div>
    </div>
  )
}
