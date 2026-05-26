'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BookOpenCheck,
  CircleDollarSign,
  Database,
  FileText,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'

type SourceProtocolOverview = {
  available: boolean
  generatedAt: string
  reason?: string
  migration?: string
  summary?: {
    creators: number
    portalAccounts: number
    works: number
    activeGrants: number
    retrievableChunks: number
    answerReceipts: number
    monthlyPayouts: number
    openDisputes: number
    heldPayouts: number
    accruedPayoutUsd: number
  }
  creators?: any[]
  portalAccounts?: any[]
  works?: any[]
  licenseGrants?: any[]
  chunks?: any[]
  receipts?: any[]
  receiptChunks?: any[]
  monthlyPayouts?: any[]
  disputes?: any[]
  modelReviews?: any[]
  bannedBooksCorpus?: {
    generatedAt: string
    scope: string
    licenseModel: string
    sourceSpine: any[]
    swarmAgents: any[]
    outreachPackets: any[]
    sourceIngestionQueue?: {
      generatedAt: string
      mode: string
      policy: string
      sources: any[]
      summary: {
        sourceCount: number
        candidateCount: number
        existingRecordMatches: number
        stageableCandidates: number
        evidenceReviewRequired: number
        blockedFullTextActions: number
      }
      candidates: any[]
      blockedActions: string[]
    }
    summary: {
      stagedRecords: number
      sourceSpineCount: number
      outreachPacketCount: number
      rightsReadyRecords: number
      outreachReadyRecords: number
      activeLicenseRecords: number
      retrievableRecords: number
      blockedRecords: number
    }
    records: any[]
    safeguards: string[]
  }
  bannedBooksEvidenceQa?: {
    generatedAt: string
    reviewer: string
    sourceImportPath: string
    dryRun: boolean
    summary: {
      importRows: number
      decisions: number
      approvedQueueAppends: number
      needsMoreEvidence: number
      rejected: number
      blocked: number
      alreadyQueued: number
    }
    rows: any[]
    queueAppendDrafts: any[]
    blockedActions: string[]
  }
}

type AdminUserOption = {
  id: string
  email: string
  role: string
}

type TabKey = 'bannedBooks' | 'portal' | 'creators' | 'works' | 'grants' | 'chunks' | 'receipts' | 'payouts' | 'reviews'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'bannedBooks', label: 'Banned Books' },
  { key: 'portal', label: 'Portal Access' },
  { key: 'creators', label: 'Creators' },
  { key: 'works', label: 'Works' },
  { key: 'grants', label: 'Grants' },
  { key: 'chunks', label: 'Chunks' },
  { key: 'receipts', label: 'Receipts' },
  { key: 'payouts', label: 'Payouts' },
  { key: 'reviews', label: 'Model Reviews' },
]

export default function SourceProtocolPage() {
  return (
    <ProtectedRoute requireAdmin>
      <SourceProtocolContent />
    </ProtectedRoute>
  )
}

function SourceProtocolContent() {
  const [overview, setOverview] = useState<SourceProtocolOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('bannedBooks')
  const [userSearch, setUserSearch] = useState('')
  const [userOptions, setUserOptions] = useState<AdminUserOption[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedCreatorId, setSelectedCreatorId] = useState('')
  const [portalStatus, setPortalStatus] = useState('active')
  const [canViewEarnings, setCanViewEarnings] = useState(true)
  const [canViewReceipts, setCanViewReceipts] = useState(true)
  const [portalBusy, setPortalBusy] = useState(false)
  const [portalMessage, setPortalMessage] = useState<string | null>(null)

  const loadOverview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const res = await fetch('/api/admin/source-protocol/overview', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setOverview(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load source protocol overview')
      setOverview(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  const searchUsers = useCallback(async () => {
    setPortalMessage(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const params = new URLSearchParams({ page: '1', limit: '10' })
      if (userSearch.trim()) params.set('search', userSearch.trim())
      const res = await fetch(`/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setUserOptions(body.users || [])
    } catch (err) {
      setPortalMessage(err instanceof Error ? err.message : 'Failed to search users')
    }
  }, [userSearch])

  const createPortalAccount = useCallback(async () => {
    setPortalBusy(true)
    setPortalMessage(null)
    try {
      if (!selectedCreatorId || !selectedUserId) throw new Error('Choose both a creator and user')
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const res = await fetch('/api/admin/source-protocol/portal-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          creatorId: selectedCreatorId,
          userId: selectedUserId,
          status: portalStatus,
          canViewEarnings,
          canViewReceipts,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setPortalMessage('Portal account saved.')
      await loadOverview()
    } catch (err) {
      setPortalMessage(err instanceof Error ? err.message : 'Failed to save portal account')
    } finally {
      setPortalBusy(false)
    }
  }, [canViewEarnings, canViewReceipts, loadOverview, portalStatus, selectedCreatorId, selectedUserId])

  const updatePortalAccount = useCallback(async (accountId: string, update: Record<string, unknown>) => {
    setPortalBusy(true)
    setPortalMessage(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const res = await fetch('/api/admin/source-protocol/portal-accounts', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ accountId, ...update }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setPortalMessage('Portal account updated.')
      await loadOverview()
    } catch (err) {
      setPortalMessage(err instanceof Error ? err.message : 'Failed to update portal account')
    } finally {
      setPortalBusy(false)
    }
  }, [loadOverview])

  const summary = overview?.summary
  const hasOpenRightsIssue = Boolean(summary && (summary.openDisputes > 0 || summary.heldPayouts > 0))
  const tabCounts = useMemo(
    () => ({
      creators: overview?.creators?.length ?? 0,
      portal: overview?.portalAccounts?.length ?? 0,
      works: overview?.works?.length ?? 0,
      grants: overview?.licenseGrants?.length ?? 0,
      chunks: overview?.chunks?.length ?? 0,
      receipts: overview?.receipts?.length ?? 0,
      payouts: overview?.monthlyPayouts?.length ?? 0,
      reviews: overview?.modelReviews?.length ?? 0,
      bannedBooks: overview?.bannedBooksCorpus?.summary.stagedRecords ?? 0,
    }),
    [overview]
  )

  return (
    <div className="min-h-screen bg-background text-foreground p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Source Protocol' },
        ]} />

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1">Source Protocol</h1>
            <p className="text-muted-foreground text-sm max-w-3xl">
              Operating view for opt-in creator content, active license grants, cited answer receipts, monthly payout settlement, and creator portal access.
            </p>
          </div>
          <div className="rounded-lg border border-silicon-slate bg-silicon-slate/30 px-4 py-3 text-xs text-muted-foreground">
            Source docs:{' '}
            <span className="font-mono text-foreground">docs/source-respecting-llm-protocol.md</span>
            {' / '}
            <span className="font-mono text-foreground">docs/creator-rights-model-review-monitor.md</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">Loading...</div>
        ) : error ? (
          <Notice tone="red" title="Failed to load source protocol overview" body={error} />
        ) : overview && !overview.available ? (
          <Notice
            tone="amber"
            title="Source protocol schema is not available here"
            body={`${overview.reason ?? 'Apply the migration before live receipts can be shown.'} Migration: ${overview.migration ?? 'source protocol migration'}.`}
          />
        ) : overview && summary ? (
          <>
            <section className="mb-6 rounded-lg border border-silicon-slate bg-silicon-slate/30 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <ShieldCheck size={20} className="text-radiant-gold" />
                    <h2 className="text-xl font-semibold">Protocol stance</h2>
                  </div>
                  <p className="text-sm text-muted-foreground max-w-3xl">
                    Retrieval remains permission-aware. Payouts accrue per answer receipt, then settle monthly to avoid high transaction costs.
                  </p>
                </div>
                <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${hasOpenRightsIssue ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'}`}>
                  {hasOpenRightsIssue ? 'Review needed' : 'No open holds'}
                </div>
              </div>
            </section>

            <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat icon={<Users size={18} />} label="Creators" value={summary.creators} />
              <Stat icon={<Users size={18} />} label="Portal accounts" value={summary.portalAccounts} />
              <Stat icon={<BookOpenCheck size={18} />} label="Works" value={summary.works} />
              <Stat icon={<Database size={18} />} label="Retrievable chunks" value={summary.retrievableChunks} />
              <Stat icon={<FileText size={18} />} label="Answer receipts" value={summary.answerReceipts} />
              <Stat icon={<ShieldCheck size={18} />} label="Active grants" value={summary.activeGrants} />
              <Stat icon={<CircleDollarSign size={18} />} label="Monthly payouts" value={summary.monthlyPayouts} />
              <Stat icon={<AlertTriangle size={18} />} label="Open disputes" value={summary.openDisputes} />
              <Stat icon={<CircleDollarSign size={18} />} label="Accrued payout" value={formatMoney(summary.accruedPayoutUsd)} />
            </section>

            <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Panel title="Current payout model">
                <KeyValue label="Usage calculation" value="Per answer receipt" />
                <KeyValue label="Settlement cadence" value="Monthly" />
                <KeyValue label="Default split" value="60% creators / 25% ops / 15% reserve" />
                <KeyValue label="Held payouts" value={String(summary.heldPayouts)} />
              </Panel>
              <Panel title="Rights controls">
                <KeyValue label="Active grants" value={String(summary.activeGrants)} />
                <KeyValue label="Open disputes" value={String(summary.openDisputes)} />
                <KeyValue label="Review basis" value="License grant inherited by chunk" />
                <KeyValue label="Fine-tuning" value="Disabled unless explicitly granted" />
              </Panel>
              <Panel title="Review loop">
                <KeyValue label="Model reviews shown" value={String(tabCounts.reviews)} />
                <KeyValue label="Promotion policy" value="Quality and license gates" />
                <KeyValue label="Last generated" value={formatDate(overview.generatedAt)} />
                <KeyValue label="Mode" value="Admin visibility and portal access control" />
              </Panel>
            </section>

            <section className="mb-4 flex flex-wrap gap-2">
              {TABS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`rounded-lg border px-3 py-2 text-sm ${tab === item.key ? 'border-radiant-gold bg-radiant-gold/10 text-radiant-gold' : 'border-silicon-slate text-muted-foreground hover:text-foreground'}`}
                >
                  {item.label} <span className="ml-1 font-mono text-xs">{tabCounts[item.key]}</span>
                </button>
              ))}
            </section>

            <section className={tab === 'portal' ? '' : 'overflow-hidden rounded-lg border border-silicon-slate'}>
              {tab === 'portal' && (
                <PortalAccountsPanel
                  creators={overview.creators ?? []}
                  accounts={overview.portalAccounts ?? []}
                  userSearch={userSearch}
                  userOptions={userOptions}
                  selectedCreatorId={selectedCreatorId}
                  selectedUserId={selectedUserId}
                  portalStatus={portalStatus}
                  canViewEarnings={canViewEarnings}
                  canViewReceipts={canViewReceipts}
                  busy={portalBusy}
                  message={portalMessage}
                  onUserSearchChange={setUserSearch}
                  onSearchUsers={searchUsers}
                  onSelectedCreatorChange={setSelectedCreatorId}
                  onSelectedUserChange={setSelectedUserId}
                  onStatusChange={setPortalStatus}
                  onCanViewEarningsChange={setCanViewEarnings}
                  onCanViewReceiptsChange={setCanViewReceipts}
                  onCreate={createPortalAccount}
                  onUpdate={updatePortalAccount}
                />
              )}
              {tab === 'bannedBooks' && (
                <BannedBooksCorpusPanel
                  corpus={overview.bannedBooksCorpus}
                  evidenceQa={overview.bannedBooksEvidenceQa}
                />
              )}
              {tab === 'creators' && <CreatorsTable rows={overview.creators ?? []} />}
              {tab === 'works' && <WorksTable rows={overview.works ?? []} />}
              {tab === 'grants' && <GrantsTable rows={overview.licenseGrants ?? []} />}
              {tab === 'chunks' && <ChunksTable rows={overview.chunks ?? []} />}
              {tab === 'receipts' && <ReceiptsTable receipts={overview.receipts ?? []} chunks={overview.receiptChunks ?? []} />}
              {tab === 'payouts' && <PayoutsTable rows={overview.monthlyPayouts ?? []} disputes={overview.disputes ?? []} />}
              {tab === 'reviews' && <ModelReviewsTable rows={overview.modelReviews ?? []} />}
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}

function Notice({ tone, title, body }: { tone: 'amber' | 'red'; title: string; body: string }) {
  const classes = tone === 'amber'
    ? 'border-amber-500/50 bg-amber-500/10 text-amber-200'
    : 'border-red-500/50 bg-red-500/10 text-red-300'
  return (
    <div className={`rounded-lg border p-6 ${classes}`}>
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm">{body}</p>
    </div>
  )
}

function PortalAccountsPanel({
  creators,
  accounts,
  userSearch,
  userOptions,
  selectedCreatorId,
  selectedUserId,
  portalStatus,
  canViewEarnings,
  canViewReceipts,
  busy,
  message,
  onUserSearchChange,
  onSearchUsers,
  onSelectedCreatorChange,
  onSelectedUserChange,
  onStatusChange,
  onCanViewEarningsChange,
  onCanViewReceiptsChange,
  onCreate,
  onUpdate,
}: {
  creators: any[]
  accounts: any[]
  userSearch: string
  userOptions: AdminUserOption[]
  selectedCreatorId: string
  selectedUserId: string
  portalStatus: string
  canViewEarnings: boolean
  canViewReceipts: boolean
  busy: boolean
  message: string | null
  onUserSearchChange: (value: string) => void
  onSearchUsers: () => void
  onSelectedCreatorChange: (value: string) => void
  onSelectedUserChange: (value: string) => void
  onStatusChange: (value: string) => void
  onCanViewEarningsChange: (value: boolean) => void
  onCanViewReceiptsChange: (value: boolean) => void
  onCreate: () => void
  onUpdate: (accountId: string, update: Record<string, unknown>) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
      <section className="rounded-lg border border-silicon-slate bg-silicon-slate/30 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Users size={20} className="text-radiant-gold" />
          <h2 className="text-lg font-semibold">Link creator access</h2>
        </div>

        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Creator</span>
            <select
              value={selectedCreatorId}
              onChange={(event) => onSelectedCreatorChange(event.target.value)}
              className="w-full rounded-lg border border-silicon-slate bg-background px-3 py-2 text-sm"
            >
              <option value="">Choose a creator</option>
              {creators.map((creator) => (
                <option key={creator.id} value={creator.id}>
                  {creator.protected_identity ? `Protected identity (${shortId(creator.id)})` : creator.display_name}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="mb-1 block text-sm text-muted-foreground">User account</span>
            <div className="flex gap-2">
              <input
                type="search"
                value={userSearch}
                onChange={(event) => onUserSearchChange(event.target.value)}
                placeholder="Search user email"
                className="min-w-0 flex-1 rounded-lg border border-silicon-slate bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={onSearchUsers}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <Search size={16} />
                Search
              </button>
            </div>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Matched user</span>
            <select
              value={selectedUserId}
              onChange={(event) => onSelectedUserChange(event.target.value)}
              className="w-full rounded-lg border border-silicon-slate bg-background px-3 py-2 text-sm"
            >
              <option value="">Choose a user</option>
              {userOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email} ({user.role})
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Initial status</span>
            <select
              value={portalStatus}
              onChange={(event) => onStatusChange(event.target.value)}
              className="w-full rounded-lg border border-silicon-slate bg-background px-3 py-2 text-sm"
            >
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
              <option value="revoked">Revoked</option>
            </select>
          </label>

          <label className="flex items-center justify-between gap-3 rounded-lg border border-silicon-slate px-3 py-2 text-sm">
            <span>Show earnings</span>
            <input
              type="checkbox"
              checked={canViewEarnings}
              onChange={(event) => onCanViewEarningsChange(event.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-silicon-slate px-3 py-2 text-sm">
            <span>Show receipt details</span>
            <input
              type="checkbox"
              checked={canViewReceipts}
              onChange={(event) => onCanViewReceiptsChange(event.target.checked)}
            />
          </label>

          <button
            type="button"
            onClick={onCreate}
            disabled={busy || !selectedCreatorId || !selectedUserId}
            className="w-full rounded-lg border border-radiant-gold bg-radiant-gold/10 px-3 py-2 text-sm font-semibold text-radiant-gold hover:bg-radiant-gold/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Saving...' : 'Save portal link'}
          </button>

          {message && (
            <p className="rounded-lg border border-silicon-slate bg-background/50 px-3 py-2 text-sm text-muted-foreground">
              {message}
            </p>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-silicon-slate">
        <div className="hidden grid-cols-6 gap-4 bg-silicon-slate/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
          <span>Creator</span>
          <span>User</span>
          <span>Status</span>
          <span>Visibility</span>
          <span>Created</span>
          <span>Actions</span>
        </div>
        <div className="divide-y divide-silicon-slate">
          {accounts.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No portal accounts yet.</div>
          ) : accounts.map((account) => (
            <div key={account.id} className="grid grid-cols-1 gap-3 px-4 py-4 text-sm lg:grid-cols-6 lg:gap-4">
              <div className="font-medium">{account.creator_display_name || shortId(account.creator_id)}</div>
              <div className="text-muted-foreground">
                <p>{account.user_email || shortId(account.user_id)}</p>
                <p className="font-mono text-xs">{shortId(account.user_id)}</p>
              </div>
              <div>
                <StatusBadge status={account.status} />
              </div>
              <div className="text-muted-foreground">
                <p>{account.can_view_earnings ? 'Earnings visible' : 'Earnings hidden'}</p>
                <p>{account.can_view_receipts ? 'Receipts visible' : 'Receipts hidden'}</p>
              </div>
              <div className="text-muted-foreground">{formatDate(account.created_at)}</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onUpdate(account.id, { status: account.status === 'active' ? 'suspended' : 'active' })}
                  disabled={busy || account.status === 'revoked'}
                  className="rounded border border-silicon-slate px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  {account.status === 'active' ? 'Suspend' : 'Activate'}
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate(account.id, { status: 'revoked' })}
                  disabled={busy || account.status === 'revoked'}
                  className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-300 disabled:opacity-50"
                >
                  Revoke
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate(account.id, { canViewEarnings: !account.can_view_earnings })}
                  disabled={busy || account.status === 'revoked'}
                  className="rounded border border-silicon-slate px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <RefreshCw size={12} className="inline" /> Earnings
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate(account.id, { canViewReceipts: !account.can_view_receipts })}
                  disabled={busy || account.status === 'revoked'}
                  className="rounded border border-silicon-slate px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <RefreshCw size={12} className="inline" /> Receipts
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function BannedBooksCorpusPanel({
  corpus,
  evidenceQa,
}: {
  corpus: SourceProtocolOverview['bannedBooksCorpus']
  evidenceQa?: SourceProtocolOverview['bannedBooksEvidenceQa']
}) {
  if (!corpus) {
    return (
      <div className="rounded-lg border border-silicon-slate px-4 py-8 text-center text-sm text-muted-foreground">
        No banned-books corpus projection is available.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-silicon-slate bg-silicon-slate/30 p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <BookOpenCheck size={20} className="text-radiant-gold" />
              <h2 className="text-lg font-semibold">Banned Books Rights-Ready Corpus</h2>
            </div>
            <p className="max-w-4xl text-sm text-muted-foreground">{corpus.scope}</p>
            <p className="mt-2 max-w-4xl text-sm text-muted-foreground">{corpus.licenseModel}</p>
          </div>
          <div className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-300">
            Staged only
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
          <Stat icon={<FileText size={18} />} label="Staged" value={corpus.summary.stagedRecords} />
          <Stat icon={<Database size={18} />} label="Sources" value={corpus.summary.sourceSpineCount} />
          <Stat icon={<ShieldCheck size={18} />} label="Rights-ready" value={corpus.summary.rightsReadyRecords} />
          <Stat icon={<Users size={18} />} label="Outreach-ready" value={corpus.summary.outreachReadyRecords} />
          <Stat icon={<CircleDollarSign size={18} />} label="Active licenses" value={corpus.summary.activeLicenseRecords} />
          <Stat icon={<Users size={18} />} label="Packets" value={corpus.summary.outreachPacketCount} />
          <Stat icon={<BookOpenCheck size={18} />} label="Retrievable" value={corpus.summary.retrievableRecords} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Source spine">
          {corpus.sourceSpine.map((source) => (
            <KeyValue key={source.name} label={source.name} value={source.role} />
          ))}
        </Panel>
        <Panel title="Safeguards">
          {corpus.safeguards.map((safeguard, index) => (
            <KeyValue key={safeguard} label={`Gate ${index + 1}`} value={safeguard} />
          ))}
        </Panel>
      </section>

      {corpus.sourceIngestionQueue && (
        <section className="overflow-hidden rounded-lg border border-silicon-slate">
          <div className="bg-silicon-slate/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Source ingestion queue
          </div>
          <div className="grid grid-cols-2 gap-3 border-b border-silicon-slate p-4 lg:grid-cols-6">
            <Stat icon={<Database size={18} />} label="Sources" value={corpus.sourceIngestionQueue.summary.sourceCount} />
            <Stat icon={<Search size={18} />} label="Candidates" value={corpus.sourceIngestionQueue.summary.candidateCount} />
            <Stat icon={<BookOpenCheck size={18} />} label="Matched" value={corpus.sourceIngestionQueue.summary.existingRecordMatches} />
            <Stat icon={<ShieldCheck size={18} />} label="Stageable" value={corpus.sourceIngestionQueue.summary.stageableCandidates} />
            <Stat icon={<AlertTriangle size={18} />} label="Needs QA" value={corpus.sourceIngestionQueue.summary.evidenceReviewRequired} />
            <Stat icon={<AlertTriangle size={18} />} label="Blocked" value={corpus.sourceIngestionQueue.summary.blockedFullTextActions} />
          </div>
          <div className="border-b border-silicon-slate px-4 py-3 text-sm text-muted-foreground">
            {corpus.sourceIngestionQueue.policy}
          </div>
          <div className="divide-y divide-silicon-slate">
            {corpus.sourceIngestionQueue.candidates.map((candidate) => (
              <div key={candidate.externalId} className="grid grid-cols-1 gap-3 px-4 py-4 text-sm lg:grid-cols-5 lg:gap-4">
                <div>
                  <p className="font-medium text-foreground">{candidate.canonicalTitle}</p>
                  <p className="text-muted-foreground">{list(candidate.authors)}</p>
                </div>
                <div className="text-muted-foreground">
                  <p>{candidate.status}</p>
                  <p>{candidate.evidenceQuality}</p>
                </div>
                <div className="text-muted-foreground">
                  <p>{candidate.sourceKey}</p>
                  <p>{candidate.evidenceType}</p>
                </div>
                <div className="text-muted-foreground">
                  <p>Existing: {candidate.existingRecordId ?? 'None'}</p>
                  <p>Draft: {candidate.stagedRecordDraft ? candidate.stagedRecordDraft.id : 'Held'}</p>
                </div>
                <div className="text-muted-foreground">{candidate.nextAction}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {evidenceQa && (
        <section className="overflow-hidden rounded-lg border border-silicon-slate">
          <div className="bg-silicon-slate/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Evidence QA approval queue
          </div>
          <div className="grid grid-cols-2 gap-3 border-b border-silicon-slate p-4 lg:grid-cols-7">
            <Stat icon={<FileText size={18} />} label="Import rows" value={evidenceQa.summary.importRows} />
            <Stat icon={<ShieldCheck size={18} />} label="Decisions" value={evidenceQa.summary.decisions} />
            <Stat icon={<BookOpenCheck size={18} />} label="Approved" value={evidenceQa.summary.approvedQueueAppends} />
            <Stat icon={<AlertTriangle size={18} />} label="Needs evidence" value={evidenceQa.summary.needsMoreEvidence} />
            <Stat icon={<AlertTriangle size={18} />} label="Rejected" value={evidenceQa.summary.rejected} />
            <Stat icon={<AlertTriangle size={18} />} label="Blocked" value={evidenceQa.summary.blocked} />
            <Stat icon={<Database size={18} />} label="Already queued" value={evidenceQa.summary.alreadyQueued} />
          </div>
          <div className="border-b border-silicon-slate px-4 py-3 text-sm text-muted-foreground">
            Reviewer: {evidenceQa.reviewer}. Dry run: {String(evidenceQa.dryRun)}. Source import: {evidenceQa.sourceImportPath}.
          </div>
          <div className="divide-y divide-silicon-slate">
            {evidenceQa.rows.map((row) => (
              <div key={row.externalId} className="grid grid-cols-1 gap-3 px-4 py-4 text-sm lg:grid-cols-5 lg:gap-4">
                <div>
                  <p className="font-medium text-foreground">{row.canonicalTitle}</p>
                  <p className="font-mono text-xs text-muted-foreground">{row.externalId}</p>
                </div>
                <div className="text-muted-foreground">
                  <p>{row.importStatus}</p>
                  <p>{row.decision}</p>
                </div>
                <div className="text-muted-foreground">
                  <p>Approved: {String(row.approved)}</p>
                  <p>Blocked: {String(row.blocked)}</p>
                </div>
                <div className="text-muted-foreground">
                  <p>Draft: {row.queueAppendDraft ? row.queueAppendDraft.externalId : 'None'}</p>
                </div>
                <div className="text-muted-foreground">{row.reason}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-lg border border-silicon-slate">
        <div className="bg-silicon-slate/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          MECE agent lanes
        </div>
        <div className="divide-y divide-silicon-slate">
          {corpus.swarmAgents.map((agent) => (
            <div key={agent.key} className="grid grid-cols-1 gap-3 px-4 py-4 text-sm lg:grid-cols-5 lg:gap-4">
              <div>
                <p className="font-medium text-foreground">{agent.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{agent.key}</p>
              </div>
              <div className="text-muted-foreground">{agent.lane}</div>
              <div className="text-muted-foreground">{agent.output}</div>
              <div className="text-muted-foreground">{agent.boundary}</div>
              <div className="text-muted-foreground">{agent.approvalGate}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-silicon-slate">
        <div className="bg-silicon-slate/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Permission packet templates
        </div>
        <div className="divide-y divide-silicon-slate">
          {corpus.outreachPackets.map((packet) => (
            <div key={packet.key} className="grid grid-cols-1 gap-3 px-4 py-4 text-sm lg:grid-cols-4 lg:gap-4">
              <div>
                <p className="font-medium text-foreground">{packet.subject}</p>
                <p className="font-mono text-xs text-muted-foreground">{packet.key}</p>
              </div>
              <div className="text-muted-foreground">
                <p className="font-medium text-foreground">{packet.audience}</p>
                <p>{packet.purpose}</p>
              </div>
              <div className="text-muted-foreground">
                <p>Ask: {list(packet.permissionAsk)}</p>
                <p className="mt-2">Follow-up days: {list(packet.followUpCadenceDays)}</p>
              </div>
              <div className="text-muted-foreground">
                <p>{packet.approvalGate}</p>
                <p className="mt-2">Guardrails: {list(packet.guardrails)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-silicon-slate">
        <div className="bg-silicon-slate/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Staged rights-ready shortlist
        </div>
        <div className="divide-y divide-silicon-slate">
          {corpus.records.map((record) => (
            <div key={record.id} className="grid grid-cols-1 gap-3 px-4 py-4 text-sm lg:grid-cols-5 lg:gap-4">
              <div>
                <p className="font-medium text-foreground">{record.canonicalTitle}</p>
                <p className="text-muted-foreground">{list(record.authors)}</p>
              </div>
              <div className="text-muted-foreground">
                <p>{record.banStatus}</p>
                <p>{record.jurisdictionContext}</p>
              </div>
              <div className="text-muted-foreground">
                <p>{record.rightsholderCandidate.name}</p>
                <p>{record.rightsholderCandidate.confidence} confidence</p>
              </div>
              <div className="text-muted-foreground">
                <p>Outreach: {record.outreachStatus}</p>
                <p>License: {record.licenseStatus}</p>
                <p>Ingestion: {record.ingestionStatus}</p>
              </div>
              <div className="text-muted-foreground">{record.nextAction}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const classes =
    status === 'active'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
      : status === 'revoked'
        ? 'border-red-500/40 bg-red-500/10 text-red-300'
        : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${classes}`}>{status}</span>
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-silicon-slate bg-silicon-slate/30 p-4">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums text-radiant-gold">{value}</p>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-silicon-slate bg-silicon-slate/30 p-5">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <dl className="space-y-2 text-sm">{children}</dl>
    </div>
  )
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-silicon-slate/70 pb-2 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-mono text-xs text-foreground">{value}</dd>
    </div>
  )
}

function TableFrame({ headers, children, empty }: { headers: string[]; children: React.ReactNode; empty: boolean }) {
  return (
    <>
      <div className="hidden grid-cols-5 gap-4 bg-silicon-slate/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
        {headers.map((header) => <span key={header}>{header}</span>)}
      </div>
      <div className="divide-y divide-silicon-slate">
        {empty ? <div className="px-4 py-8 text-center text-sm text-muted-foreground">No records yet.</div> : children}
      </div>
    </>
  )
}

function CreatorsTable({ rows }: { rows: any[] }) {
  return (
    <TableFrame headers={['Creator', 'Categories', 'Rights holders', 'Verification', 'Created']} empty={rows.length === 0}>
      {rows.map((row) => (
        <Row key={row.id} cells={[
          row.protected_identity ? 'Protected identity' : row.display_name,
          list(row.categories),
          list(row.rights_holder_types),
          row.verification_status,
          formatDate(row.created_at),
        ]} />
      ))}
    </TableFrame>
  )
}

function WorksTable({ rows }: { rows: any[] }) {
  return (
    <TableFrame headers={['Work', 'Rights holder', 'Ban status', 'Review', 'Consent']} empty={rows.length === 0}>
      {rows.map((row) => (
        <Row key={row.id} cells={[
          row.title,
          row.rights_holder_type,
          row.ban_status,
          row.review_status,
          row.community_consent_required ? consentLabel(row.community_consent_verified) : chainLabel(row.chain_of_title_verified),
        ]} />
      ))}
    </TableFrame>
  )
}

function GrantsTable({ rows }: { rows: any[] }) {
  return (
    <TableFrame headers={['Grant', 'Status', 'Allowed uses', 'Blocked topics', 'Expires']} empty={rows.length === 0}>
      {rows.map((row) => (
        <Row key={row.id} cells={[
          shortId(row.id),
          row.status,
          list(row.allowed_uses),
          list(row.blocked_topics),
          row.expires_at ? formatDate(row.expires_at) : 'No expiry',
        ]} />
      ))}
    </TableFrame>
  )
}

function ChunksTable({ rows }: { rows: any[] }) {
  return (
    <TableFrame headers={['Citation', 'Location', 'Retrievable', 'Sensitive topics', 'Created']} empty={rows.length === 0}>
      {rows.map((row) => (
        <Row key={row.id} cells={[
          row.citation_label,
          row.source_location || 'Unspecified',
          row.is_retrievable ? 'Yes' : 'No',
          list(row.sensitive_topics),
          formatDate(row.created_at),
        ]} />
      ))}
    </TableFrame>
  )
}

function ReceiptsTable({ receipts, chunks }: { receipts: any[]; chunks: any[] }) {
  const chunksByReceipt = useMemo(() => {
    return chunks.reduce<Record<string, any[]>>((acc, chunk) => {
      const id = chunk.answer_receipt_id
      acc[id] = [...(acc[id] ?? []), chunk]
      return acc
    }, {})
  }, [chunks])

  return (
    <TableFrame headers={['Receipt', 'Model', 'Cited chunks', 'Creator pool', 'Generated']} empty={receipts.length === 0}>
      {receipts.map((receipt) => {
        const attributed = chunksByReceipt[receipt.id] ?? []
        return (
          <Row key={receipt.id} cells={[
            shortId(receipt.id),
            receipt.model_id,
            `${receipt.cited_chunk_ids?.length ?? 0} cited / ${attributed.length} attributed`,
            formatMoney(receipt.creator_pool_usd),
            formatDate(receipt.generated_at),
          ]} />
        )
      })}
    </TableFrame>
  )
}

function PayoutsTable({ rows, disputes }: { rows: any[]; disputes: any[] }) {
  return (
    <TableFrame headers={['Creator', 'Period', 'Tokens', 'Accrued', 'Status']} empty={rows.length === 0 && disputes.length === 0}>
      {rows.map((row) => (
        <Row key={row.id} cells={[
          shortId(row.creator_external_id),
          row.settlement_period,
          String(row.attributed_token_count ?? 0),
          formatMoney(row.accrued_payout_usd),
          row.hold_reason ? `${row.settlement_status}: ${row.hold_reason}` : row.settlement_status,
        ]} />
      ))}
      {disputes.map((row) => (
        <Row key={row.id} cells={[
          shortId(row.id),
          'Dispute',
          row.dispute_type,
          row.status,
          row.summary,
        ]} />
      ))}
    </TableFrame>
  )
}

function ModelReviewsTable({ rows }: { rows: any[] }) {
  return (
    <TableFrame headers={['Reviewed', 'Incumbent', 'Recommended', 'Recommendation', 'Gates']} empty={rows.length === 0}>
      {rows.map((row) => (
        <Row key={row.id} cells={[
          formatDate(row.reviewed_at),
          row.incumbent_model_id,
          row.recommended_model_id,
          row.recommendation,
          `${row.quality_gate_passed ? 'quality' : 'quality pending'} / ${row.license_governance_gate_passed ? 'license' : 'license pending'}`,
        ]} />
      ))}
    </TableFrame>
  )
}

function Row({ cells }: { cells: string[] }) {
  return (
    <div className="grid grid-cols-1 gap-2 px-4 py-4 text-sm lg:grid-cols-5 lg:gap-4">
      {cells.map((cell, index) => (
        <div key={`${cell}-${index}`} className={index === 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}>
          <span className="break-words">{cell}</span>
        </div>
      ))}
    </div>
  )
}

function list(value: unknown): string {
  return Array.isArray(value) && value.length > 0 ? value.join(', ') : 'None'
}

function shortId(value: string): string {
  if (!value) return 'Unknown'
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value
}

function chainLabel(value: boolean): string {
  return value ? 'Chain verified' : 'Chain pending'
}

function consentLabel(value: boolean): string {
  return value ? 'Consent verified' : 'Consent pending'
}

function formatDate(value: string): string {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function formatMoney(value: unknown): string {
  const amount = Number(value ?? 0)
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 6 }).format(amount)
}
