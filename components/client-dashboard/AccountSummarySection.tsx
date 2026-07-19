'use client'

import { Briefcase, CheckCircle2, Clock, ExternalLink, FileText, Receipt, TrendingUp } from 'lucide-react'
import type { AccountSummaryData, DashboardDocument, DashboardMilestone, DashboardMilestoneEvidence, TimeTrackingData } from '@/lib/client-dashboard'

interface AccountSummarySectionProps {
  accountSummary: AccountSummaryData | null
  timeTracking: TimeTrackingData
  milestones?: DashboardMilestone[]
  documents?: DashboardDocument[]
}

function formatCurrency(value: number): string {
  if (value === 0) return 'Included'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatBalance(value: number): string {
  if (value === 0) return 'No balance due'
  return formatCurrency(value)
}

function formatCapacity(value: number): string {
  if (value === 0) return 'Contract exhausted'
  return formatCurrency(value)
}

function formatHourlyRate(value: number | null): string {
  if (value == null) return 'Not enough time data'
  return `${formatCurrency(value)}/hr`
}

function formatHours(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return '<1m'
}

function formatDate(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function cleanServiceDescription(description: string): string {
  return description.replace(/^KMB dashboard seed:\s*/i, '')
}

function evidenceHref(evidence: DashboardMilestoneEvidence): string | null {
  const sourceType = (evidence.source_type || '').toLowerCase()
  if (sourceType.includes('read_ai') || sourceType.includes('meeting')) return '#meeting-history'
  if (sourceType.includes('google_drive')) return '#documents'
  return null
}

function documentUrl(document: DashboardDocument): string | null {
  return document.signed_url || document.pdf_url || null
}

function relatedDocuments(title: string, documents: DashboardDocument[]): DashboardDocument[] {
  const normalized = title.toLowerCase()
  const matches = documents.filter((document) => {
    const docTitle = document.title.toLowerCase()
    if (normalized.includes('balance') || normalized.includes('navigation')) {
      return (
        docTitle.includes('template comparison') ||
        docTitle.includes('implementation strategy') ||
        docTitle.includes('working packet') ||
        docTitle.includes('primer')
      )
    }
    if (normalized.includes('giving') || normalized.includes('support')) {
      return (
        docTitle.includes('opportunity') ||
        docTitle.includes('implementation strategy') ||
        docTitle.includes('working packet')
      )
    }
    return docTitle.includes('working packet')
  })

  return matches.slice(0, 3)
}

export default function AccountSummarySection({
  accountSummary,
  timeTracking,
  milestones = [],
  documents = [],
}: AccountSummarySectionProps) {
  if (!accountSummary && (!timeTracking || timeTracking.total_seconds === 0)) return null

  const totalSeconds = timeTracking?.total_seconds || 0
  const totalHours = totalSeconds / 3600
  const contractValue = accountSummary?.contract_value ?? 0
  const effectiveHourlyRate =
    finiteNumber(accountSummary?.effective_hourly_rate) ??
    (contractValue > 0 && totalHours > 0 ? contractValue / totalHours : null)
  const servicesRenderedValue =
    finiteNumber(accountSummary?.services_rendered_value) ??
    (effectiveHourlyRate == null ? 0 : Math.min(contractValue, effectiveHourlyRate * totalHours))
  const remainingContractValue =
    finiteNumber(accountSummary?.remaining_contract_value) ??
    Math.max(0, contractValue - servicesRenderedValue)
  const milestoneEntries = (timeTracking?.by_target || [])
    .filter((entry) => entry.target_type === 'milestone')
    .sort((a, b) => Number(a.target_id) - Number(b.target_id))
  const nextGuidance =
    accountSummary && remainingContractValue === 0
      ? 'The paid contract value is fully allocated to work delivered so far. The next gap-closing work should be scoped as a contract extension or package option.'
      : 'Use the remaining contract capacity before opening a separate package, then scope any new gap-closing work as an extension.'

  return (
    <section id="account-summary" className="rounded-lg border border-radiant-gold/15 bg-silicon-slate/35 p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-radiant-gold">
            <Receipt className="h-4 w-4" />
            Account Summary
          </h3>
          <p className="mt-1 text-xs text-platinum-white/55">
            Paid value, dedicated hours, service value, and remaining contract capacity.
          </p>
        </div>
        {totalSeconds > 0 && (
          <div className="inline-flex items-center gap-1.5 rounded-md border border-radiant-gold/15 bg-imperial-navy/45 px-2.5 py-1 text-xs text-platinum-white/72">
            <Clock className="h-3.5 w-3.5 text-radiant-gold" />
            {formatHours(totalSeconds)} dedicated
          </div>
        )}
      </div>

      {accountSummary && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-radiant-gold/10 bg-imperial-navy/35 p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-platinum-white/42">Contract value</p>
            <p className="mt-1 text-lg font-semibold text-platinum-white">
              {formatCurrency(accountSummary.contract_value)}
            </p>
          </div>
          <div className="rounded-lg border border-radiant-gold/10 bg-imperial-navy/35 p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-platinum-white/42">Paid to date</p>
            <p className="mt-1 text-lg font-semibold text-platinum-white">
              {formatCurrency(accountSummary.paid_to_date)}
            </p>
          </div>
          <div className="rounded-lg border border-radiant-gold/10 bg-imperial-navy/35 p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-platinum-white/42">Services rendered</p>
            <p className="mt-1 text-lg font-semibold text-platinum-white">
              {formatCurrency(servicesRenderedValue)}
            </p>
          </div>
          <div className="rounded-lg border border-radiant-gold/10 bg-imperial-navy/35 p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-platinum-white/42">Remaining capacity</p>
            <p className="mt-1 text-lg font-semibold text-platinum-white">
              {formatCapacity(remainingContractValue)}
            </p>
          </div>
        </div>
      )}

      {accountSummary && (
        <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_1.4fr]">
          <div className="rounded-lg border border-radiant-gold/10 bg-imperial-navy/30 p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-platinum-white/42">Effective rate</p>
            <p className="mt-1 text-sm font-semibold text-platinum-white">
              {formatHourlyRate(effectiveHourlyRate)}
            </p>
          </div>
          <div className="rounded-lg border border-radiant-gold/10 bg-imperial-navy/30 p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-platinum-white/42">Client balance due</p>
            <p className="mt-1 text-sm font-semibold text-platinum-white">
              {formatBalance(accountSummary.balance_due)}
            </p>
          </div>
          <div className="rounded-lg border border-radiant-gold/10 bg-imperial-navy/30 p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-radiant-gold/85">What this means</p>
            <p className="mt-1 text-xs leading-5 text-platinum-white/68">{nextGuidance}</p>
          </div>
        </div>
      )}

      {milestoneEntries.length > 0 && (
        <div className="mb-4 rounded-lg border border-radiant-gold/10 bg-imperial-navy/30 p-3">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-platinum-white/50">
              <TrendingUp className="h-3.5 w-3.5 text-radiant-gold/80" />
              Time investment by milestone
            </p>
            <p className="text-xs text-platinum-white/55">
              {formatHours(totalSeconds)} at {formatHourlyRate(effectiveHourlyRate)}
            </p>
          </div>
          <div className="space-y-3">
            {milestoneEntries.map((entry) => {
              const idx = Number(entry.target_id)
              const title = milestones[idx]?.title || `Milestone ${idx + 1}`
              const evidence = (milestones[idx]?.evidence || []).filter((item) => item.is_client_visible !== false)
              const docs = relatedDocuments(title, documents)
              const descriptions = (entry.descriptions || []).map(cleanServiceDescription)
              const pct = totalSeconds > 0 ? Math.round((entry.total_seconds / totalSeconds) * 100) : 0
              const dollarValue =
                effectiveHourlyRate == null ? null : (entry.total_seconds / 3600) * effectiveHourlyRate
              return (
                <div
                  key={entry.target_id}
                  className="rounded-lg border border-radiant-gold/10 bg-silicon-slate/20 p-3"
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-xs text-platinum-white/78">{title}</span>
                    <span className="shrink-0 text-xs text-platinum-white/55">
                      {formatHours(entry.total_seconds)}
                      {dollarValue != null ? ` · ${formatCurrency(dollarValue)}` : ''}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-imperial-navy/70">
                    <div className="h-full rounded-full bg-radiant-gold/75" style={{ width: `${pct}%` }} />
                  </div>
                  {descriptions.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-platinum-white/42">
                        Work performed
                      </p>
                      <ul className="space-y-1">
                        {descriptions.map((description) => (
                          <li key={description} className="flex gap-2 text-xs leading-5 text-platinum-white/68">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-radiant-gold/75" />
                            <span>{description}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(evidence.length > 0 || docs.length > 0) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {evidence.map((item) => {
                        const label = item.source_label || item.source_type || 'Source record'
                        const href = evidenceHref(item)
                        const className = "inline-flex max-w-full items-center gap-1.5 rounded-md border border-radiant-gold/15 bg-imperial-navy/45 px-2 py-1 text-[10px] font-medium text-platinum-white/64 transition hover:border-radiant-gold/35 hover:text-platinum-white"
                        const content = (
                          <>
                            <Briefcase className="h-3 w-3 shrink-0 text-radiant-gold/70" />
                            <span className="truncate">{label}</span>
                          </>
                        )
                        return href ? (
                          <a key={item.id || label} href={href} className={className}>
                            {content}
                          </a>
                        ) : (
                          <span key={item.id || label} className={className}>
                            {content}
                          </span>
                        )
                      })}
                      {docs.map((document) => {
                        const href = documentUrl(document)
                        if (!href) return null
                        return (
                          <a
                            key={`${title}-${document.id}`}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-radiant-gold/15 bg-radiant-gold/10 px-2 py-1 text-[10px] font-medium text-radiant-gold transition hover:border-radiant-gold/40 hover:bg-radiant-gold/15"
                          >
                            <FileText className="h-3 w-3 shrink-0" />
                            <span className="truncate">{document.title}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {accountSummary?.service_lines.length ? (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-platinum-white/50">
            Contracted services
          </p>
          {accountSummary.service_lines.map((line) => {
            const date = formatDate(line.date)
            return (
              <div key={line.id} className="rounded-lg border border-radiant-gold/10 bg-imperial-navy/30 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-platinum-white/86">{line.label}</p>
                    {line.description && (
                      <p className="mt-1 text-xs leading-5 text-platinum-white/55">{line.description}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <p className="text-sm font-semibold text-gold-light">{formatCurrency(line.amount)}</p>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-platinum-white/40">
                      {line.status}{date ? ` · ${date}` : ''}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

    </section>
  )
}
