'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Database,
  GitPullRequest,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { getCurrentSession } from '@/lib/auth'
import type { ProductLifecycleCoverage, SocialTopicLiveCoverage } from '@/lib/social-topic-source-coverage'

const PRIORITY_PAGE_SIZE = 3
const DIRECTORY_PAGE_SIZE = 5

function formatDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'No successful scan yet'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(value))
}

function ProductEvidenceRow({ product }: { product: ProductLifecycleCoverage }) {
  return (
    <details className="group rounded-lg border border-silicon-slate bg-imperial-navy/30" data-testid="coverage-product-row">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-foreground">{product.label}</div></div>
        <span className={`rounded-full border px-2 py-1 text-[10px] font-medium capitalize ${product.current_stage ? 'border-radiant-gold/30 bg-radiant-gold/10 text-radiant-gold' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>
          {product.current_stage?.replace(/_/g, ' ') ?? 'Needs evidence'}
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">{product.receipt_count} receipts</span>
      </summary>
      <div className="border-t border-silicon-slate px-3 pb-3 pt-3">
        <p className="mb-2 font-mono text-[10px] text-muted-foreground">Internal identity: {product.product_identity}</p>
        {product.stages.length > 0 && <div className="flex flex-wrap gap-1.5">{product.stages.map((stage) => <span key={stage} className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] capitalize text-emerald-200">{stage.replace(/_/g, ' ')}</span>)}</div>}
        <p className="mt-2 text-xs text-muted-foreground">Latest evidence: {formatDate(product.latest_evidence_at)} · {product.source_groups.length} source groups</p>
        {product.gaps.length > 0 && <ul className="mt-2 space-y-1 text-xs text-amber-200">{product.gaps.map((gap) => <li key={gap}>Action needed: {gap}</li>)}</ul>}
        {product.historical_gaps.length > 0 && <div className="mt-2 text-[10px] text-muted-foreground">Historical evidence gaps: {product.historical_gaps.join(' · ')}</div>}
      </div>
    </details>
  )
}

export default function SocialSourceCoverageEvidence({ active }: { active: boolean }) {
  const [coverage, setCoverage] = useState<SocialTopicLiveCoverage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [priorityQuery, setPriorityQuery] = useState('')
  const [priorityPage, setPriorityPage] = useState(0)
  const [directoryQuery, setDirectoryQuery] = useState('')
  const [directoryPage, setDirectoryPage] = useState(0)

  const loadCoverage = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Admin session is unavailable.')
      const response = await fetch('/api/admin/social-content/source-coverage', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Coverage read failed.')
      setCoverage(payload.coverage)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Coverage read failed.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (active && !coverage && !loading && !error) void loadCoverage()
  }, [active, coverage, error, loadCoverage, loading])

  const summary = useMemo(() => ({
    healthy: coverage?.sources.filter((source) => source.status === 'ready').length ?? 0,
    receipts: coverage?.receipts.length ?? 0,
    products: coverage?.products.filter((product) => product.receipt_count > 0).length ?? 0,
    gaps: coverage?.gaps.length ?? 0,
  }), [coverage])
  const priorityProducts = useMemo(() => {
    const query = priorityQuery.trim().toLowerCase()
    return coverage?.products.filter((product) => product.priority)
      .filter((product) => !query || product.label.toLowerCase().includes(query) || product.product_identity.toLowerCase().includes(query)) ?? []
  }, [coverage, priorityQuery])
  const priorityPages = Math.max(1, Math.ceil(priorityProducts.length / PRIORITY_PAGE_SIZE))
  const visiblePriorityProducts = priorityProducts.slice(priorityPage * PRIORITY_PAGE_SIZE, (priorityPage + 1) * PRIORITY_PAGE_SIZE)
  const directoryProducts = useMemo(() => {
    const query = directoryQuery.trim().toLowerCase()
    return coverage?.products.filter((product) => !product.priority)
      .filter((product) => !query || product.label.toLowerCase().includes(query) || product.product_identity.toLowerCase().includes(query)) ?? []
  }, [coverage, directoryQuery])
  const directoryPages = Math.max(1, Math.ceil(directoryProducts.length / DIRECTORY_PAGE_SIZE))
  const visibleDirectoryProducts = directoryProducts.slice(directoryPage * DIRECTORY_PAGE_SIZE, (directoryPage + 1) * DIRECTORY_PAGE_SIZE)

  useEffect(() => { setPriorityPage(0) }, [priorityQuery])
  useEffect(() => { setDirectoryPage(0) }, [directoryQuery])
  const awaitingInitialRead = active && !coverage && !error

  return (
    <section className="admin-console-card mb-6 rounded-lg border p-4" aria-labelledby="source-coverage-heading">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="admin-console-eyebrow mb-2 flex items-center gap-2"><Activity className="h-4 w-4" /> Launch evidence · source coverage</div>
          <h2 id="source-coverage-heading" className="text-lg font-semibold text-foreground">Coverage before candidate creation</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Approved insight, development, deployment, operational, prototype, and public-release receipts are deduplicated into stable product identities. Branches prove development; previews do not prove production; catalog presence proves public release.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${coverage?.status === 'ready' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>
            {awaitingInitialRead ? 'Reading' : coverage?.status === 'ready' ? 'Coverage ready' : 'Fail closed'}
          </span>
          <button type="button" onClick={() => void loadCoverage()} disabled={loading} className="admin-console-button-secondary min-h-9 px-3 py-1.5 disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
          </button>
        </div>
      </div>

      {awaitingInitialRead ? (
        <div className="mt-4 flex min-h-28 items-center justify-center gap-2 rounded-lg border border-silicon-slate bg-imperial-navy/35 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading approved source receipts…</div>
      ) : error ? (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
          <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Coverage read is blocked</div>
          <p className="mt-1 text-red-100/80">{error}</p>
          <p className="mt-2 text-xs text-red-100/70">Restore the approved projection or collector read path. Candidate creation must remain closed while receipts are unavailable.</p>
        </div>
      ) : coverage ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {[
              { label: 'Collectors', value: `${summary.healthy}/${coverage.sources.length}`, icon: CheckCircle2 },
              { label: 'Receipts', value: summary.receipts, icon: ShieldCheck },
              { label: 'Products', value: summary.products, icon: Database },
              { label: 'Priority gaps', value: summary.gaps, icon: AlertTriangle },
            ].map((item) => <div key={item.label} className="rounded-lg border border-silicon-slate bg-imperial-navy/35 p-3"><div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground"><item.icon className="h-3.5 w-3.5 text-radiant-gold" />{item.label}</div><div className="mt-1 text-lg font-semibold text-foreground">{item.value}</div></div>)}
          </div>

          {coverage.products.length === 0 ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">No product is eligible. Approve a privacy-safe summary with provenance before Shaka creates a candidate.</div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">Priority recurring products</div>
                <span className="text-xs text-muted-foreground">{priorityProducts.length} visible · {coverage.products.filter((product) => product.priority).length} recurring · 3 per page</span>
              </div>
              <label className="relative block">
                <span className="sr-only">Search recurring priority products</span>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={priorityQuery} onChange={(event) => setPriorityQuery(event.target.value)} placeholder="Search recurring priorities" className="admin-console-input min-h-10 w-full pl-9" />
              </label>
              <div className="space-y-2" data-testid="priority-coverage-list">
                {visiblePriorityProducts.length > 0 ? visiblePriorityProducts.map((product) => <ProductEvidenceRow key={product.product_identity} product={product} />) : <div className="rounded-lg border border-dashed border-silicon-slate p-4 text-sm text-muted-foreground">No matching recurring priorities.</div>}
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <button type="button" className="admin-console-button-secondary min-h-9 px-3" disabled={priorityPage === 0} onClick={() => setPriorityPage((page) => Math.max(0, page - 1))}>Previous priorities</button>
                <span>Priority page {priorityPage + 1} of {priorityPages}</span>
                <button type="button" className="admin-console-button-secondary min-h-9 px-3" disabled={priorityPage + 1 >= priorityPages} onClick={() => setPriorityPage((page) => Math.min(priorityPages - 1, page + 1))}>Next priorities</button>
              </div>

              <details className="group rounded-lg border border-silicon-slate bg-imperial-navy/20">
                <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                  <span className="flex-1 text-sm font-semibold text-foreground">Additional product directory</span>
                  <span className="text-xs text-muted-foreground">{directoryProducts.length} products · 5 per page</span>
                </summary>
                <div className="space-y-3 border-t border-silicon-slate p-3">
                  <label className="relative block">
                    <span className="sr-only">Search additional products</span>
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input value={directoryQuery} onChange={(event) => setDirectoryQuery(event.target.value)} placeholder="Search product directory" className="admin-console-input min-h-10 w-full pl-9" />
                  </label>
                  <div className="space-y-2" data-testid="additional-product-page">
                    {visibleDirectoryProducts.length > 0 ? visibleDirectoryProducts.map((product) => <ProductEvidenceRow key={product.product_identity} product={product} />) : <div className="rounded-lg border border-dashed border-silicon-slate p-4 text-sm text-muted-foreground">No matching products.</div>}
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <button type="button" className="admin-console-button-secondary min-h-9 px-3" disabled={directoryPage === 0} onClick={() => setDirectoryPage((page) => Math.max(0, page - 1))}>Previous</button>
                    <span>Page {directoryPage + 1} of {directoryPages}</span>
                    <button type="button" className="admin-console-button-secondary min-h-9 px-3" disabled={directoryPage + 1 >= directoryPages} onClick={() => setDirectoryPage((page) => Math.min(directoryPages - 1, page + 1))}>Next</button>
                  </div>
                </div>
              </details>
            </div>
          )}

          <details className="group rounded-lg border border-silicon-slate bg-imperial-navy/30">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-3"><ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" /><div className="flex-1 text-sm font-semibold text-foreground">Collector freshness, failures, and recovery</div><span className="text-xs text-muted-foreground">{coverage.sources.filter((source) => source.status === 'blocked').length} blocked</span></summary>
            <div className="grid gap-2 border-t border-silicon-slate p-3 md:grid-cols-2 xl:grid-cols-4">
              {coverage.sources.map((source) => <article key={source.key} className={`rounded-lg border p-3 ${source.status === 'ready' ? 'border-emerald-500/20 bg-emerald-500/[0.05]' : 'border-red-500/25 bg-red-500/[0.07]'}`}>
                <div className="flex items-start justify-between gap-2"><h3 className="text-xs font-semibold text-foreground">{source.label}</h3>{source.status === 'ready' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-red-300" />}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground"><span className="capitalize">{source.freshness}</span><span>•</span><span>{source.receipt_count} receipts</span><span>•</span><span>{source.product_count} products</span></div>
                <div className="mt-2 flex gap-1.5 text-[10px] text-muted-foreground"><Clock3 className="mt-0.5 h-3 w-3 shrink-0" />Last success {formatDate(source.last_successful_scan)}</div>
                {source.collector_failure && <p className="mt-2 rounded bg-red-950/30 p-2 text-[10px] text-red-100">{source.collector_failure}</p>}
                <p className="mt-2 border-t border-white/10 pt-2 text-[10px] leading-4 text-muted-foreground"><strong className="text-radiant-gold">Recovery:</strong> {source.recovery_action}</p>
              </article>)}
            </div>
          </details>

          <details className="group rounded-lg border border-sky-400/20 bg-sky-400/[0.05]">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-3"><ChevronDown className="h-4 w-4 text-sky-200 transition-transform group-open:rotate-180" /><ShieldCheck className="h-4 w-4 text-sky-200" /><span className="flex-1 text-sm font-semibold text-sky-50">Privacy and candidate gates</span><GitPullRequest className="h-4 w-4 text-sky-200" /></summary>
            <ul className="grid gap-1 border-t border-sky-400/15 p-3 text-xs leading-5 text-sky-50/75 lg:grid-cols-2">{coverage.boundaries.map((boundary) => <li key={boundary}>• {boundary}</li>)}</ul>
          </details>
        </div>
      ) : null}
    </section>
  )
}
