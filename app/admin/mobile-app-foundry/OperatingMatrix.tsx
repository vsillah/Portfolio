'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, ExternalLink, Terminal } from 'lucide-react'
import Pagination from '@/components/admin/Pagination'

export type MobileFoundryOperationRow = {
  phase: string
  title: string
  owner: string
  mode: string
  summary: string
  command: string | null
  endpoint: string | null
  status: string
  statusTone: 'ready' | 'pending' | 'review'
  statusDetail: string
  gateHref: string
  gateLabel: string
  authorization: string
  gate: string
}

const PAGE_SIZE = 3

export default function OperatingMatrix({ rows }: { rows: MobileFoundryOperationRow[] }) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const visibleRows = useMemo(
    () => rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [rows, safePage],
  )

  return (
    <section className="agent-ops-card mt-5 rounded-xl border p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Terminal className="text-radiant-gold" size={19} />
          <h2 className="text-lg font-semibold text-foreground">Operating Matrix</h2>
        </div>
        <p className="hidden text-xs leading-5 text-muted-foreground sm:block">
          Paginated and collapsed so this page does not become a second backlog.
        </p>
      </div>

      <div className="divide-y divide-radiant-gold/10">
        {visibleRows.map((row) => (
          <article key={row.phase} className="py-4 first:pt-0 last:pb-0">
            <div className="grid gap-3 lg:grid-cols-[3rem_minmax(0,1fr)_10rem_8rem_11rem_11rem] lg:items-start">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-radiant-gold/20 bg-radiant-gold/10 font-heading text-sm text-radiant-gold">
                {row.phase}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{row.title}</h3>
                  <span className="rounded-full border border-radiant-gold/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-radiant-gold/80">
                    {row.mode}
                  </span>
                </div>
                <p className="mt-1 hidden text-xs leading-5 text-muted-foreground sm:block">{row.summary}</p>
                <p className="mt-2 hidden text-xs leading-5 text-muted-foreground sm:block">
                  <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-radiant-gold" />
                  {row.gate}
                </p>
              </div>
              <div>
                <StatusChip tone={row.statusTone} label={row.status} />
                <p className="mt-2 hidden text-xs leading-5 text-muted-foreground lg:block">{row.statusDetail}</p>
              </div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{row.owner}</p>
              <Link
                href={row.gateHref}
                className="inline-flex items-center justify-between gap-2 rounded-lg border border-radiant-gold/10 bg-background/35 px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-radiant-gold/30 hover:bg-radiant-gold/5"
              >
                {row.gateLabel}
                <ExternalLink className="h-3.5 w-3.5 text-radiant-gold" />
              </Link>
              <details className="group rounded-lg border border-radiant-gold/10 bg-background/35 p-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold text-foreground">
                  Run details
                  <ArrowRight className="h-4 w-4 text-radiant-gold transition-transform group-open:rotate-90" />
                </summary>
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-radiant-gold">How to authorize</p>
                    <p className="text-xs leading-5 text-muted-foreground">{row.authorization}</p>
                  </div>
                  {row.command && (
                    <div>
                      <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-radiant-gold">Command</p>
                      <p className="break-all font-mono text-[11px] leading-5 text-muted-foreground">{row.command}</p>
                    </div>
                  )}
                  {row.endpoint && (
                    <div>
                      <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-radiant-gold">Endpoint</p>
                      <p className="break-all font-mono text-[11px] leading-5 text-muted-foreground">{row.endpoint}</p>
                    </div>
                  )}
                </div>
              </details>
            </div>
          </article>
        ))}
      </div>

      <Pagination
        page={safePage}
        totalPages={totalPages}
        total={rows.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </section>
  )
}

function StatusChip({ tone, label }: { tone: MobileFoundryOperationRow['statusTone']; label: string }) {
  const toneClass = {
    ready: 'border-cyan-400/35 bg-cyan-500/10 text-cyan-100',
    pending: 'border-yellow-400/40 bg-yellow-500/10 text-yellow-100',
    review: 'border-radiant-gold/35 bg-radiant-gold/10 text-radiant-gold',
  }[tone]

  return (
    <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass}`}>
      {label}
    </span>
  )
}
