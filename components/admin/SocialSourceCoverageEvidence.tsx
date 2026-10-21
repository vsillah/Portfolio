'use client'

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Database,
  ExternalLink,
  GitPullRequest,
  History,
  Newspaper,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { getCurrentSession } from '@/lib/auth'
import AdminMetricCard from '@/components/admin/AdminMetricCard'
import OfficialSignalOperations from '@/components/admin/OfficialSignalOperations'
import type { CoverageSourceKey, ProductLifecycleCoverage, SocialTopicLiveCoverage } from '@/lib/social-topic-source-coverage'
import { SOCIAL_CANDIDATE_PROJECTION_QA_FIXTURE } from '@/lib/social-candidate-projection-qa-contract'

const PRIORITY_PAGE_SIZE = 3
const DIRECTORY_PAGE_SIZE = 5
const CANDIDATE_PAGE_SIZE = 4
const BUTTON_CLASS = 'admin-console-button-secondary min-h-9 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50'
const INPUT_CLASS = 'input-brand min-h-10 w-full bg-background !pl-9 text-foreground placeholder:text-muted-foreground'
const DISCLOSURE_CLASS = 'group rounded-lg border border-border bg-muted/30 text-card-foreground'
const SUMMARY_CLASS = 'flex cursor-pointer list-none items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset'
const TAB_CLASS = 'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background'

type EvidenceTab = 'candidates' | 'run-history' | 'blockers'

const EVIDENCE_TABS: Array<{ id: EvidenceTab; label: string; hash: string }> = [
  { id: 'candidates', label: 'Candidates', hash: '#candidate-inbox' },
  { id: 'run-history', label: 'Run history', hash: '#source-run-history' },
  { id: 'blockers', label: 'Blockers', hash: '#source-blockers' },
]

function tabForHash(hash: string): EvidenceTab {
  return EVIDENCE_TABS.find((tab) => tab.hash === hash)?.id ?? 'candidates'
}

const RECOVERY_LINKS: Record<CoverageSourceKey, { href: string; label: string }> = {
  public_momentum: { href: '/admin/source-protocol', label: 'Open Source Protocol' },
  codex_insights: { href: '/admin/agents/open-brain', label: 'Open approved memory proposals' },
  repository_documents: { href: '/admin/agents/coordination', label: 'Open Agent Ops evidence' },
  github_development: { href: '/admin/agents/coordination', label: 'Open GitHub work evidence' },
  vercel_deployments: { href: '/admin/agents/coordination', label: 'Open deployment evidence' },
  operational_records: { href: '/admin/agents/coordination', label: 'Open operational evidence' },
  meeting_summaries: { href: '/admin/meetings', label: 'Open meeting summaries' },
  owned_media_summaries: { href: '/admin/agents/content-intelligence', label: 'Open Content Intelligence' },
  app_prototypes: { href: '/admin/content/prototypes', label: 'Open app prototypes' },
  public_catalog: { href: '/admin/content/products', label: 'Open product catalog' },
}

function formatDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'No successful scan yet'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(value))
}

function ProductEvidenceRow({ product }: { product: ProductLifecycleCoverage }) {
  return (
    <details className={DISCLOSURE_CLASS} data-testid="coverage-product-row">
      <summary className={SUMMARY_CLASS}>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-foreground">{product.label}</div></div>
        <span className={`rounded-full border px-2 py-1 text-[10px] font-medium capitalize ${product.current_stage ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border bg-muted text-muted-foreground'}`}>
          {product.current_stage?.replace(/_/g, ' ') ?? 'Needs evidence'}
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">{product.receipt_count} receipts</span>
      </summary>
      <div className="border-t border-border px-3 pb-3 pt-3">
        <p className="mb-2 font-mono text-[10px] text-muted-foreground">Internal identity: {product.product_identity}</p>
        {product.stages.length > 0 && <div className="flex flex-wrap gap-1.5">{product.stages.map((stage) => <span key={stage} className="rounded-full border border-accent/30 bg-accent/10 px-2 py-1 text-[10px] capitalize text-accent">{stage.replace(/_/g, ' ')}</span>)}</div>}
        <p className="mt-2 text-xs text-muted-foreground">Latest evidence: {formatDate(product.latest_evidence_at)} · {product.source_groups.length} source groups</p>
        {product.gaps.length > 0 && <ul className="mt-2 space-y-1 text-xs text-foreground">{product.gaps.map((gap) => <li key={gap}><strong className="text-accent">Action needed:</strong> {gap}</li>)}</ul>}
        {product.historical_gaps.length > 0 && <div className="mt-2 text-[10px] text-muted-foreground">Historical evidence gaps: {product.historical_gaps.join(' · ')}</div>}
      </div>
    </details>
  )
}

export default function SocialSourceCoverageEvidence({
  active,
  qaFixture,
}: {
  active: boolean
  qaFixture?: typeof SOCIAL_CANDIDATE_PROJECTION_QA_FIXTURE
}) {
  const [coverage, setCoverage] = useState<SocialTopicLiveCoverage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [priorityQuery, setPriorityQuery] = useState('')
  const [priorityPage, setPriorityPage] = useState(0)
  const [directoryQuery, setDirectoryQuery] = useState('')
  const [directoryPage, setDirectoryPage] = useState(0)
  const [candidateQuery, setCandidateQuery] = useState('')
  const [candidatePage, setCandidatePage] = useState(0)
  const [activeTab, setActiveTab] = useState<EvidenceTab>('candidates')

  const loadCoverage = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Admin session is unavailable.')
      const endpoint = qaFixture
        ? `/api/admin/social-content/source-coverage?qa_fixture=${encodeURIComponent(qaFixture)}`
        : '/api/admin/social-content/source-coverage'
      const response = await fetch(endpoint, {
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
  }, [qaFixture])

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
  const sourceRunHistory = useMemo(() => coverage?.sources
    .toSorted((a, b) => (b.scanned_at || '').localeCompare(a.scanned_at || '') || a.label.localeCompare(b.label)), [coverage])
  const blockedSources = useMemo(() => coverage?.sources.filter((source) => source.status === 'blocked') ?? [], [coverage])
  const reviewBlockerCount = blockedSources.length + (coverage?.trend_work_relevance?.blockers.length ?? 0)
  const candidates = useMemo(() => {
    const query = candidateQuery.trim().toLowerCase()
    return coverage?.trend_work_relevance?.candidates.filter((candidate) => !query || [
      candidate.product_label,
      candidate.triggering_event,
      candidate.content_angle,
      candidate.why_vambah_can_speak,
      candidate.candidate_class,
      ...candidate.topic_identities,
      ...candidate.source_receipt_ids,
    ].some((value) => value.toLowerCase().includes(query))) ?? []
  }, [candidateQuery, coverage])
  const candidatePages = Math.max(1, Math.ceil(candidates.length / CANDIDATE_PAGE_SIZE))
  const visibleCandidates = candidates.slice(candidatePage * CANDIDATE_PAGE_SIZE, (candidatePage + 1) * CANDIDATE_PAGE_SIZE)

  useEffect(() => { setPriorityPage(0) }, [priorityQuery])
  useEffect(() => { setDirectoryPage(0) }, [directoryQuery])
  useEffect(() => { setCandidatePage(0) }, [candidateQuery])
  useEffect(() => { setCandidatePage((page) => Math.min(page, candidatePages - 1)) }, [candidatePages])
  useEffect(() => {
    const syncTabToHash = () => setActiveTab(tabForHash(window.location.hash))
    syncTabToHash()
    window.addEventListener('hashchange', syncTabToHash)
    return () => window.removeEventListener('hashchange', syncTabToHash)
  }, [])

  const handleTabKeyDown = (event: KeyboardEvent<HTMLElement>, currentTab: EvidenceTab) => {
    const currentIndex = EVIDENCE_TABS.findIndex((tab) => tab.id === currentTab)
    let nextIndex = currentIndex
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % EVIDENCE_TABS.length
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + EVIDENCE_TABS.length) % EVIDENCE_TABS.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = EVIDENCE_TABS.length - 1
    else return
    event.preventDefault()
    const nextTab = EVIDENCE_TABS[nextIndex]
    window.location.hash = nextTab.hash
    document.getElementById(`evidence-tab-${nextTab.id}`)?.focus()
  }
  const awaitingInitialRead = active && !coverage && !error

  return (
    <section className="mb-6 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm" aria-labelledby="source-coverage-heading" data-testid="source-coverage-section">
      {!qaFixture && <div className="mb-4"><OfficialSignalOperations active={active} /></div>}
      {qaFixture && (
        <div className="mb-4 rounded-lg border border-accent/50 bg-accent/10 p-3" data-testid="synthetic-candidate-qa-banner">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-foreground">
            <ShieldCheck className="h-4 w-4 text-accent" /> Synthetic QA fixture · preview only · read only
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">No production data, reconciliation, model or provider call, render, upload, scheduling, publishing, external send, or candidate approval is available on this route.</p>
        </div>
      )}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="admin-console-eyebrow mb-2 flex items-center gap-2"><Activity className="h-4 w-4" /> Launch evidence · source coverage</div>
          <h2 id="source-coverage-heading" className="text-lg font-semibold text-foreground">Coverage before candidate creation</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Approved insight, development, deployment, operational, prototype, and public-release receipts are deduplicated into stable product identities. Branches prove development; previews do not prove production; catalog presence proves public release.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${coverage?.status === 'ready' ? 'border-border bg-muted/60 text-foreground' : 'border-accent/40 bg-accent/10 text-foreground'}`}>
            {awaitingInitialRead ? 'Reading' : coverage?.status === 'ready' ? 'Coverage ready' : 'Fail closed'}
          </span>
          <button type="button" onClick={() => void loadCoverage()} disabled={loading} className={`${BUTTON_CLASS} py-1.5`}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {qaFixture ? 'Reload fixture' : 'Refresh'}
          </button>
        </div>
      </div>

      {awaitingInitialRead ? (
        <div className="mt-4 flex min-h-28 items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading approved source receipts…</div>
      ) : error ? (
        <div className="mt-4 rounded-lg border border-accent/40 bg-muted/50 p-4 text-sm text-foreground">
          <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Coverage read is blocked</div>
          <p className="mt-1 text-muted-foreground">{error}</p>
          <p className="mt-2 text-xs text-muted-foreground">Restore the approved projection or collector read path. Candidate creation must remain closed while receipts are unavailable.</p>
        </div>
      ) : coverage ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-accent/30 bg-card p-3" data-testid="mobile-decision-inbox">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.13em] text-foreground">Source coverage review</div>
                <p className="mt-1 text-xs text-muted-foreground">Review lineage and freshness from a phone. No decision here can generate, approve, schedule, publish, or send content.</p>
              </div>
              <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-foreground">Review only</span>
            </div>
            <nav className="mt-3 grid grid-cols-3 gap-2" aria-label="Decision inbox sections" role="tablist">
              {EVIDENCE_TABS.map((tab) => (
                <a
                  key={tab.id}
                  id={`evidence-tab-${tab.id}`}
                  href={tab.hash}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={tab.hash.slice(1)}
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
                  className={`${TAB_CLASS} ${activeTab === tab.id ? 'border-accent bg-accent/15 text-foreground shadow-sm' : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                >
                  {tab.label}
                </a>
              ))}
            </nav>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <AdminMetricCard label="Collectors" value={`${summary.healthy}/${coverage.sources.length}`} icon={CheckCircle2} href="#source-run-history" description="Open run history" testId="collectors-metric" />
            <AdminMetricCard label="Receipts" value={summary.receipts} icon={ShieldCheck} href="#candidate-inbox" description="Review candidate lineage" testId="receipts-metric" />
            <AdminMetricCard label="Products" value={summary.products} icon={Database} href="#candidate-inbox" description="Browse product evidence" testId="products-metric" />
            <AdminMetricCard label="Priority gaps" value={summary.gaps} icon={AlertTriangle} href="#source-blockers" description="Open recovery actions" testId="priority-gaps-metric" />
          </div>

          <div id="candidate-inbox" role="tabpanel" aria-labelledby="evidence-tab-candidates" hidden={activeTab !== 'candidates'} className="scroll-mt-24 rounded-lg border border-border bg-muted/20 p-3" data-testid="trend-work-relevance">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground"><Newspaper className="h-4 w-4 text-accent" /> Trend-to-work and capability relevance</div>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">Approved public momentum is joined by exact product identity or explicit shared theme, then grounded in privacy-safe evidence of firsthand work or an owned capability. Results enter the existing review-only topic backlog; no reconciliation, copy, approval, provider call, draft, render, upload, schedule, post, or external send is created here.</p>
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${coverage.trend_work_relevance?.status === 'ready' ? 'border-accent/40 bg-accent/10 text-foreground' : 'border-border bg-muted text-muted-foreground'}`}>
                {coverage.trend_work_relevance?.candidates.length ?? 0} joined candidates
              </span>
            </div>
            {coverage.trend_work_relevance?.candidates.length ? (
              <>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="relative block flex-1">
                  <span className="sr-only">Search review candidates</span>
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={candidateQuery} onChange={(event) => setCandidateQuery(event.target.value)} placeholder="Search review candidates" className={INPUT_CLASS} />
                </label>
                <button type="button" className={BUTTON_CLASS} disabled={!candidateQuery} onClick={() => setCandidateQuery('')}>Reset candidate search</button>
              </div>
              <div className="mt-3 grid gap-2 lg:grid-cols-2" data-testid="trend-work-candidate-list">
                {visibleCandidates.map((candidate) => (
                  <article key={candidate.candidate_key} className="rounded-lg border border-border bg-card p-3 text-card-foreground" data-testid="trend-work-candidate">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{candidate.product_label}</h3>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <span className="rounded-full border border-border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground">Review only</span>
                        <span className="rounded-full border border-border bg-muted/50 px-2 py-1 text-[10px] text-muted-foreground">{candidate.candidate_class.replace(/_/g, ' ')}</span>
                        <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-1 text-[10px] capitalize text-accent">{candidate.freshness} · score {candidate.priority_score}</span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-foreground">{candidate.triggering_event}</p>
                    {candidate.public_signal && (
                      <div className="mt-2 rounded-md border border-border bg-muted/30 p-2 text-xs leading-5 text-muted-foreground">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full border border-border bg-card px-2 py-0.5 capitalize text-foreground">{candidate.public_signal.sentiment}</span>
                          <span>{candidate.public_signal.signal_kind.replace(/_/g, ' ')}</span>
                          <span>· attention {Math.round(candidate.public_signal.public_attention_score * 100)}%</span>
                          <span>· relevance {Math.round(candidate.public_signal.relevance_score * 100)}%</span>
                        </div>
                        <p className="mt-1">{candidate.public_signal.context_summary}</p>
                        <p className="mt-1 font-mono text-[10px]">Published {formatDate(candidate.public_signal.published_at)} · observed {formatDate(candidate.public_signal.observed_at)} · expires {formatDate(candidate.public_signal.expires_at)}</p>
                        <a className="mt-1 inline-block text-[10px] font-medium text-accent underline-offset-2 hover:underline" href={candidate.public_signal.source_url} target="_blank" rel="noreferrer">View attributable public source</a>
                      </div>
                    )}
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{candidate.why_vambah_can_speak}</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Angle:</strong> {candidate.content_angle}</p>
                    {candidate.confidence && (
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        <strong className="text-foreground">Confidence:</strong> {candidate.confidence.level} ({Math.round(candidate.confidence.score * 100)}%) · {candidate.confidence.basis.join(' · ')}
                      </p>
                    )}
                    {candidate.actionable_next_step && (
                      <p className="mt-2 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Next:</strong> {candidate.actionable_next_step}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {candidate.topic_identities.map((topic) => <span key={topic} className="rounded-full border border-border bg-muted/50 px-2 py-1 text-[10px] text-muted-foreground">{topic.replace(/_/g, ' ')}</span>)}
                    </div>
                    <details className="mt-3 rounded-md border border-border bg-muted/20 text-xs text-muted-foreground">
                      <summary className="cursor-pointer list-none p-2 font-semibold text-foreground">Source lineage · {candidate.source_receipt_ids.length} exact receipts</summary>
                      <div className="space-y-2 border-t border-border p-2" data-testid="candidate-source-lineage">
                        {candidate.receipt_lineage?.length ? candidate.receipt_lineage.map((receipt) => (
                          <div key={receipt.receipt_id} className="rounded border border-border bg-background p-2">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <span className="font-medium text-foreground">{receipt.label} · {receipt.source_group.replace(/_/g, ' ')}</span>
                              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] capitalize">{receipt.privacy_classification.replace(/_/g, ' ')}</span>
                            </div>
                            <p className="mt-1 font-mono text-[10px] break-all">{receipt.receipt_id}</p>
                            <p className="mt-1 text-[10px]">Observed {formatDate(receipt.observed_at)} · approved {formatDate(receipt.approved_at)} · {receipt.lifecycle_stage.replace(/_/g, ' ')}</p>
                            <p className="mt-1 font-mono text-[10px] break-all">Provenance: {receipt.provenance}</p>
                            {receipt.evidence_url ? <a href={receipt.evidence_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-medium text-accent hover:underline">Open source evidence <ExternalLink className="h-3 w-3" /></a> : null}
                          </div>
                        )) : (
                          <ul className="space-y-1 break-all font-mono text-[10px]">
                            {candidate.source_receipt_ids.map((receiptId) => <li key={receiptId}>{receiptId}</li>)}
                          </ul>
                        )}
                        <p className="text-[10px]">Policy: {candidate.receipt_policy?.policy_id ?? candidate.candidate_class} · exact source receipts only.</p>
                      </div>
                    </details>
                  </article>
                ))}
                {visibleCandidates.length === 0 ? <div className="rounded-lg border border-dashed border-border bg-card p-3 text-xs text-muted-foreground">No candidates match this search.</div> : null}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <button type="button" className={BUTTON_CLASS} disabled={candidatePage === 0} onClick={() => setCandidatePage((page) => Math.max(0, page - 1))}>Previous candidates</button>
                <span>Candidate page {candidatePage + 1} of {candidatePages} · {candidates.length} matches</span>
                <button type="button" className={BUTTON_CLASS} disabled={candidatePage + 1 >= candidatePages} onClick={() => setCandidatePage((page) => Math.min(candidatePages - 1, page + 1))}>Next candidates</button>
              </div>
              </>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-border bg-card p-3 text-xs text-muted-foreground">
                <strong className="text-foreground">Join remains closed.</strong>{' '}
                {coverage.trend_work_relevance?.blockers[0] ?? 'Add an approved fresh public-momentum receipt and matching firsthand-work receipt.'}
              </div>
            )}
            {coverage.trend_work_relevance?.blockers.length ? (
              <div className="mt-3 rounded-lg border border-accent/40 bg-accent/10 p-3" data-testid="trend-work-blockers">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground"><AlertTriangle className="h-4 w-4 text-accent" /> Actionable policy blockers</div>
                <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
                  {coverage.trend_work_relevance.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                </ul>
              </div>
            ) : null}
          </div>

          <section id="source-run-history" role="tabpanel" aria-labelledby="evidence-tab-run-history" hidden={activeTab !== 'run-history'} className="scroll-mt-24 rounded-lg border border-border bg-muted/20 p-3" data-testid="source-run-history">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground"><History className="h-4 w-4 text-accent" /> Twice-weekly source review history</div>
                <h3 id="source-run-history-heading" className="mt-1 text-sm font-semibold text-foreground">Latest collector snapshots</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Use these persisted scan timestamps for the twice-weekly decision rhythm. Opening this inbox only reads the latest approved projection; it does not run a collector.</p>
              </div>
              <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">Projection {formatDate(coverage.generated_at)}</span>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {sourceRunHistory?.map((source) => (
                <article key={source.key} className="rounded-lg border border-border bg-card p-3 text-card-foreground">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-semibold text-foreground">{source.label}</h4>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] capitalize ${source.status === 'ready' ? 'border-border bg-muted/40 text-foreground' : 'border-accent/50 bg-accent/10 text-foreground'}`}>{source.status}</span>
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">Scanned {formatDate(source.scanned_at)}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">Last success {formatDate(source.last_successful_scan)} · {source.receipt_count} receipts · {source.product_count} products</p>
                </article>
              ))}
            </div>
          </section>

          <section id="source-blockers" role="tabpanel" aria-labelledby="evidence-tab-blockers" hidden={activeTab !== 'blockers'} className="scroll-mt-24 rounded-lg border border-border bg-muted/20 p-3" data-testid="source-blocker-inbox">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground"><AlertTriangle className="h-4 w-4 text-accent" /> Blockers and recovery</div>
                <h3 id="source-blockers-heading" className="mt-1 text-sm font-semibold text-foreground">Recovery links stay inside approved review surfaces</h3>
              </div>
              <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-medium text-foreground">{reviewBlockerCount} review {reviewBlockerCount === 1 ? 'blocker' : 'blockers'}</span>
            </div>
            {blockedSources.length ? (
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {blockedSources.map((source) => {
                  const recoveryLink = RECOVERY_LINKS[source.key]
                  return <article key={source.key} className="rounded-lg border border-accent/40 bg-card p-3 text-card-foreground">
                    <h4 className="text-xs font-semibold text-foreground">{source.label}</h4>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{source.collector_failure}</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Recovery:</strong> {source.recovery_action}</p>
                    <a href={recoveryLink.href} className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{recoveryLink.label} <ArrowRight className="h-3.5 w-3.5" /></a>
                  </article>
                })}
              </div>
            ) : <p className="mt-3 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">No source collector is blocked. Candidate-level receipt and editorial gates still apply.</p>}
            {coverage.trend_work_relevance?.blockers.length ? <div className="mt-3 break-words rounded-lg border border-accent/40 bg-accent/10 p-3 text-xs text-muted-foreground [overflow-wrap:anywhere]"><strong className="text-foreground">Candidate policy blockers:</strong> {coverage.trend_work_relevance.blockers.join(' · ')} <a href="/admin/source-protocol" className="ml-1 font-medium text-accent hover:underline">Review source policy</a></div> : null}
          </section>

          <div hidden={activeTab !== 'blockers'} className="rounded-lg border border-border bg-muted/30 p-3" data-testid="slack-disabled-specification">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-foreground">Slack mobile review integration specification</span><span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Disabled</span></div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">No Slack connection, credential, notification, interactive decision, or external send is configured. The links above are ordinary Portfolio deep links for authenticated review.</p>
          </div>

          <div hidden={activeTab !== 'candidates'}>
          {coverage.products.length === 0 ? (
            <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-foreground">No product is eligible. Approve a privacy-safe summary with provenance before Shaka creates a candidate.</div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">Priority recurring products</div>
                <span className="text-xs text-muted-foreground">{priorityProducts.length} visible · {coverage.products.filter((product) => product.priority).length} recurring · 3 per page</span>
              </div>
              <label className="relative block">
                <span className="sr-only">Search recurring priority products</span>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={priorityQuery} onChange={(event) => setPriorityQuery(event.target.value)} placeholder="Search recurring priorities" className={INPUT_CLASS} />
              </label>
              <div className="space-y-2" data-testid="priority-coverage-list">
                {visiblePriorityProducts.length > 0 ? visiblePriorityProducts.map((product) => <ProductEvidenceRow key={product.product_identity} product={product} />) : <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">No matching recurring priorities.</div>}
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <button type="button" className={BUTTON_CLASS} disabled={priorityPage === 0} onClick={() => setPriorityPage((page) => Math.max(0, page - 1))}>Previous priorities</button>
                <span>Priority page {priorityPage + 1} of {priorityPages}</span>
                <button type="button" className={BUTTON_CLASS} disabled={priorityPage + 1 >= priorityPages} onClick={() => setPriorityPage((page) => Math.min(priorityPages - 1, page + 1))}>Next priorities</button>
              </div>

              <details className={DISCLOSURE_CLASS}>
                <summary className={SUMMARY_CLASS}>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                  <span className="flex-1 text-sm font-semibold text-foreground">Additional product directory</span>
                  <span className="text-xs text-muted-foreground">{directoryProducts.length} products · 5 per page</span>
                </summary>
                <div className="space-y-3 border-t border-border p-3">
                  <label className="relative block">
                    <span className="sr-only">Search additional products</span>
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input value={directoryQuery} onChange={(event) => setDirectoryQuery(event.target.value)} placeholder="Search product directory" className={INPUT_CLASS} />
                  </label>
                  <div className="space-y-2" data-testid="additional-product-page">
                    {visibleDirectoryProducts.length > 0 ? visibleDirectoryProducts.map((product) => <ProductEvidenceRow key={product.product_identity} product={product} />) : <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">No matching products.</div>}
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <button type="button" className={BUTTON_CLASS} disabled={directoryPage === 0} onClick={() => setDirectoryPage((page) => Math.max(0, page - 1))}>Previous</button>
                    <span>Page {directoryPage + 1} of {directoryPages}</span>
                    <button type="button" className={BUTTON_CLASS} disabled={directoryPage + 1 >= directoryPages} onClick={() => setDirectoryPage((page) => Math.min(directoryPages - 1, page + 1))}>Next</button>
                  </div>
                </div>
              </details>
            </div>
          )}
          </div>

          <details hidden={activeTab !== 'blockers'} className={DISCLOSURE_CLASS}>
            <summary className={SUMMARY_CLASS}><ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" /><div className="flex-1 text-sm font-semibold text-foreground">Collector freshness, failures, and recovery</div><span className="text-xs text-muted-foreground">{coverage.sources.filter((source) => source.status === 'blocked').length} blocked</span></summary>
            <div className="grid gap-2 border-t border-border p-3 md:grid-cols-2 xl:grid-cols-4">
              {coverage.sources.map((source) => <article key={source.key} className={`rounded-lg border bg-card p-3 text-card-foreground ${source.status === 'ready' ? 'border-border' : 'border-accent/50'}`}>
                <div className="flex items-start justify-between gap-2"><h3 className="text-xs font-semibold text-foreground">{source.label}</h3>{source.status === 'ready' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-accent" />}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground"><span className="capitalize">{source.freshness}</span><span>•</span><span>{source.receipt_count} receipts</span><span>•</span><span>{source.product_count} products</span></div>
                <div className="mt-2 flex gap-1.5 text-[10px] text-muted-foreground"><Clock3 className="mt-0.5 h-3 w-3 shrink-0" />Last success {formatDate(source.last_successful_scan)}</div>
                {source.collector_failure && <p className="mt-2 rounded border border-border bg-muted/60 p-2 text-[10px] text-foreground">{source.collector_failure}</p>}
                <p className="mt-2 border-t border-border pt-2 text-[10px] leading-4 text-muted-foreground"><strong className="text-accent">Recovery:</strong> {source.recovery_action}</p>
              </article>)}
            </div>
          </details>

          <details hidden={activeTab !== 'candidates'} className={DISCLOSURE_CLASS}>
            <summary className={SUMMARY_CLASS}><ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" /><ShieldCheck className="h-4 w-4 text-accent" /><span className="flex-1 text-sm font-semibold text-foreground">Privacy and candidate gates</span><GitPullRequest className="h-4 w-4 text-accent" /></summary>
            <ul className="grid gap-1 border-t border-border p-3 text-xs leading-5 text-muted-foreground lg:grid-cols-2">{coverage.boundaries.map((boundary) => <li key={boundary}>• {boundary}</li>)}</ul>
          </details>
        </div>
      ) : null}
    </section>
  )
}
