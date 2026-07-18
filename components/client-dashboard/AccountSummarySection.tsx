'use client'

import { Briefcase, CheckCircle2, Clock, Receipt } from 'lucide-react'
import type { AccountSummaryData, TimeTrackingData } from '@/lib/client-dashboard'

interface AccountSummarySectionProps {
  accountSummary: AccountSummaryData | null
  timeTracking: TimeTrackingData
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

export default function AccountSummarySection({
  accountSummary,
  timeTracking,
}: AccountSummarySectionProps) {
  if (!accountSummary && (!timeTracking || timeTracking.total_seconds === 0)) return null

  const serviceDescriptions = (timeTracking?.by_target || [])
    .flatMap((entry) => entry.descriptions || [])
    .filter(Boolean)

  return (
    <section id="account-summary" className="rounded-lg border border-radiant-gold/15 bg-silicon-slate/35 p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-radiant-gold">
            <Receipt className="h-4 w-4" />
            Account Summary
          </h3>
          <p className="mt-1 text-xs text-platinum-white/55">
            Contract value, paid balance, and services rendered to date.
          </p>
        </div>
        {timeTracking?.total_seconds > 0 && (
          <div className="inline-flex items-center gap-1.5 rounded-md border border-radiant-gold/15 bg-imperial-navy/45 px-2.5 py-1 text-xs text-platinum-white/72">
            <Clock className="h-3.5 w-3.5 text-radiant-gold" />
            {formatHours(timeTracking.total_seconds)} logged
          </div>
        )}
      </div>

      {accountSummary && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
            <p className="text-[10px] uppercase tracking-[0.16em] text-platinum-white/42">Balance</p>
            <p className="mt-1 text-lg font-semibold text-platinum-white">
              {formatBalance(accountSummary.balance_due)}
            </p>
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

      {serviceDescriptions.length > 0 && (
        <div className="rounded-lg border border-radiant-gold/10 bg-imperial-navy/30 p-3">
          <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-platinum-white/50">
            <Briefcase className="h-3.5 w-3.5 text-radiant-gold/80" />
            Services rendered
          </p>
          <ul className="space-y-2">
            {serviceDescriptions.map((description) => (
              <li key={description} className="flex gap-2 text-xs leading-5 text-platinum-white/68">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-radiant-gold/75" />
                <span>{description.replace(/^KMB dashboard seed:\s*/i, '')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
