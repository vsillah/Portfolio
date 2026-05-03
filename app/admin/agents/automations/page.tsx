'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  FileText,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import type {
  AutomationBoundary,
  AutomationCategory,
  AutomationContextHealth,
  AutomationRiskLevel,
} from '@/lib/codex-automation-inventory'

type AutomationProfile = {
  id: string
  name: string
  kind: string
  status: string
  schedule: string | null
  model: string | null
  reasoningEffort: string | null
  executionEnvironment: string | null
  cwds: string[]
  createdAt: number | null
  updatedAt: number | null
  category: AutomationCategory
  riskLevel: AutomationRiskLevel
  portfolioRelated: boolean
  sourceFile: string
  controlDocs: string[]
  promptExcerpt: string
  duplicateCandidate: boolean
  managementBoundary: AutomationBoundary
  contextHealth: AutomationContextHealth
  contextGaps: string[]
  contextProfile: {
    purpose: string | null
    operatingRhythm: string | null
    recurringDecisions: string | null
    inputs: string[]
    dependencies: string[]
    frictionPoints: string[]
    authorityBoundary: AutomationBoundary
    expectedOutputs: string[]
    escalationTrigger: string | null
    governingDocs: string[]
  }
}

type AutomationInventoryResponse = {
  available: boolean
  reason?: string
  sourceDirectory: string
  generatedAt: string
  automations: AutomationProfile[]
  hiddenCount: number
  overview: {
    total: number
    active: number
    paused: number
    duplicateCandidates: number
    highRisk: number
    missingContext: number
  }
}

const ALL = 'all'
const CATEGORIES = [ALL, 'Operations', 'Credentials', 'Model Ops', 'Organization', 'Content/Voice', 'Subscriptions', 'Other'] as const
const STATUSES = [ALL, 'ACTIVE', 'PAUSED'] as const
const RISKS = [ALL, 'low', 'medium', 'high'] as const
const CONTEXT_HEALTH = [ALL, 'green', 'yellow', 'red'] as const
const EMPTY_AUTOMATIONS: AutomationProfile[] = []

export default function AgentAutomationsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <AgentAutomationsContent />
    </ProtectedRoute>
  )
}

function AgentAutomationsContent() {
  const [inventory, setInventory] = useState<AutomationInventoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>(ALL)
  const [status, setStatus] = useState<(typeof STATUSES)[number]>(ALL)
  const [risk, setRisk] = useState<(typeof RISKS)[number]>(ALL)
  const [contextHealth, setContextHealth] = useState<(typeof CONTEXT_HEALTH)[number]>(ALL)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const fetchInventory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const res = await fetch('/api/admin/agents/automations', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setInventory(body)
      const first = body.automations?.[0]?.id
      setSelectedId((current) => current || first || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load automation inventory')
      setInventory(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInventory()
  }, [fetchInventory])

  const automations = useMemo(() => inventory?.automations || EMPTY_AUTOMATIONS, [inventory?.automations])
  const filtered = useMemo(() => {
    return automations.filter((automation) => {
      if (category !== ALL && automation.category !== category) return false
      if (status !== ALL && automation.status !== status) return false
      if (risk !== ALL && automation.riskLevel !== risk) return false
      if (contextHealth !== ALL && automation.contextHealth !== contextHealth) return false
      return true
    })
  }, [automations, category, status, risk, contextHealth])

  const selected = automations.find((automation) => automation.id === selectedId) || filtered[0] || null
  const duplicateWarnings = automations.filter((automation) => automation.duplicateCandidate)
  const workspaceWarnings = automations.filter((automation) => !automation.cwds.some((cwd) => cwd.includes('/Projects/Portfolio')))
  const authorityWarnings = automations.filter(
    (automation) => automation.riskLevel === 'high' && automation.contextGaps.includes('missing authority boundary'),
  )
  const docWarnings = automations.filter((automation) => automation.controlDocs.length === 0)

  return (
    <div className="min-h-screen bg-background text-foreground p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Agent Operations', href: '/admin/agents' },
          { label: 'Automation Context' },
        ]} />

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1">Automation Context</h1>
            <p className="text-muted-foreground text-sm max-w-3xl">
              Local-first inventory for Portfolio-related Codex automations, their risk boundaries, and the context agents need before acting.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/agents"
              className="inline-flex items-center gap-2 rounded-lg border border-silicon-slate/70 bg-silicon-slate/30 px-3 py-2 text-sm hover:border-radiant-gold/60"
            >
              <Bot size={16} />
              Agent Operations
            </Link>
            <button
              onClick={fetchInventory}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-radiant-gold/50 bg-radiant-gold/10 px-3 py-2 text-sm text-radiant-gold hover:bg-radiant-gold/15 disabled:opacity-60"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Loading automation inventory...</div>
        ) : error ? (
          <FailureState title="Failed to load automation inventory" message={error} />
        ) : inventory && !inventory.available ? (
          <UnavailableState inventory={inventory} />
        ) : inventory ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
              <MetricCard label="Portfolio automations" value={inventory.overview.total} />
              <MetricCard label="Active" value={inventory.overview.active} tone="green" />
              <MetricCard label="Paused" value={inventory.overview.paused} />
              <MetricCard label="Duplicates" value={inventory.overview.duplicateCandidates} tone={inventory.overview.duplicateCandidates ? 'yellow' : 'slate'} />
              <MetricCard label="High risk" value={inventory.overview.highRisk} tone={inventory.overview.highRisk ? 'red' : 'slate'} />
              <MetricCard label="Missing context" value={inventory.overview.missingContext} tone={inventory.overview.missingContext ? 'yellow' : 'slate'} />
            </div>

            <WarningPanels
              hiddenCount={inventory.hiddenCount}
              duplicateWarnings={duplicateWarnings}
              workspaceWarnings={workspaceWarnings}
              authorityWarnings={authorityWarnings}
              docWarnings={docWarnings}
            />

            <section className="mb-6 rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-4">
              <div className="mb-4 flex items-center gap-2 text-radiant-gold">
                <SlidersHorizontal size={18} />
                <h2 className="font-semibold">Filters</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <FilterSelect label="Category" value={category} values={CATEGORIES} onChange={(value) => setCategory(value as (typeof CATEGORIES)[number])} />
                <FilterSelect label="Status" value={status} values={STATUSES} onChange={(value) => setStatus(value as (typeof STATUSES)[number])} />
                <FilterSelect label="Risk" value={risk} values={RISKS} onChange={(value) => setRisk(value as (typeof RISKS)[number])} />
                <FilterSelect
                  label="Context health"
                  value={contextHealth}
                  values={CONTEXT_HEALTH}
                  onChange={(value) => setContextHealth(value as (typeof CONTEXT_HEALTH)[number])}
                />
              </div>
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-6">
              <AutomationTable automations={filtered} selectedId={selected?.id || null} onSelect={setSelectedId} />
              {selected ? <ContextReadiness automation={selected} /> : null}
            </div>

            <p className="mt-5 text-xs text-muted-foreground">
              Source: {inventory.sourceDirectory}. Generated {formatDateTime(inventory.generatedAt)}. Prompt excerpts are sanitized and truncated.
            </p>
          </>
        ) : null}
      </div>
    </div>
  )
}

function AutomationTable({
  automations,
  selectedId,
  onSelect,
}: {
  automations: AutomationProfile[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (automations.length === 0) {
    return (
      <div className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-8 text-center text-muted-foreground">
        No automations match the current filters.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-silicon-slate/70">
      <table className="w-full text-sm">
        <thead className="bg-silicon-slate/40 text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Automation</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
            <th className="text-left px-4 py-3 font-medium">Schedule</th>
            <th className="text-left px-4 py-3 font-medium">Category</th>
            <th className="text-left px-4 py-3 font-medium">Risk</th>
            <th className="text-left px-4 py-3 font-medium">Context</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-silicon-slate/60">
          {automations.map((automation) => (
            <tr
              key={automation.id}
              className={`cursor-pointer hover:bg-silicon-slate/20 ${selectedId === automation.id ? 'bg-radiant-gold/10' : ''}`}
              onClick={() => onSelect(automation.id)}
            >
              <td className="px-4 py-3">
                <p className="font-medium">{automation.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{automation.id}</p>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{automation.promptExcerpt || 'No prompt excerpt available.'}</p>
              </td>
              <td className="px-4 py-3"><StatusBadge status={automation.status} /></td>
              <td className="px-4 py-3 text-muted-foreground">{formatSchedule(automation.schedule)}</td>
              <td className="px-4 py-3">{automation.category}</td>
              <td className="px-4 py-3"><RiskBadge risk={automation.riskLevel} /></td>
              <td className="px-4 py-3"><ContextBadge health={automation.contextHealth} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ContextReadiness({ automation }: { automation: AutomationProfile }) {
  const profile = automation.contextProfile

  return (
    <aside className="rounded-lg border border-silicon-slate/70 bg-silicon-slate/20 p-5 h-fit">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{automation.name}</h2>
          <p className="mt-1 text-xs text-muted-foreground break-all">{automation.sourceFile}</p>
        </div>
        <ContextBadge health={automation.contextHealth} />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 text-xs">
        <DetailPill label="Boundary" value={automation.managementBoundary} />
        <DetailPill label="Runtime" value={automation.executionEnvironment || 'unknown'} />
        <DetailPill label="Model" value={automation.model || 'unknown'} />
        <DetailPill label="Reasoning" value={automation.reasoningEffort || 'unknown'} />
      </div>

      {automation.contextGaps.length > 0 ? (
        <section className="mb-5 rounded-lg border border-yellow-400/30 bg-yellow-500/10 p-3">
          <div className="mb-2 flex items-center gap-2 text-yellow-200">
            <AlertTriangle size={16} />
            <h3 className="font-medium">Context gaps</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {automation.contextGaps.map((gap) => (
              <span key={gap} className="rounded-full border border-yellow-400/30 bg-black/20 px-2 py-1 text-xs text-yellow-100">
                {gap}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <div className="space-y-4 text-sm">
        <ContextBlock label="Purpose" value={profile.purpose} />
        <ContextBlock label="Operating rhythm" value={profile.operatingRhythm} />
        <ContextBlock label="Recurring decisions" value={profile.recurringDecisions} />
        <ContextList label="Inputs and source paths" values={profile.inputs} />
        <ContextList label="Dependencies" values={profile.dependencies} />
        <ContextList label="Friction points" values={profile.frictionPoints} />
        <ContextList label="Expected outputs" values={profile.expectedOutputs} />
        <ContextBlock label="Escalation trigger" value={profile.escalationTrigger} />
        <ContextList label="Governing docs, skills, and runbooks" values={profile.governingDocs} />
      </div>
    </aside>
  )
}

function WarningPanels({
  hiddenCount,
  duplicateWarnings,
  workspaceWarnings,
  authorityWarnings,
  docWarnings,
}: {
  hiddenCount: number
  duplicateWarnings: AutomationProfile[]
  workspaceWarnings: AutomationProfile[]
  authorityWarnings: AutomationProfile[]
  docWarnings: AutomationProfile[]
}) {
  const warnings = [
    duplicateWarnings.length ? `${duplicateWarnings.length} duplicate or overlapping automation candidate(s)` : null,
    workspaceWarnings.length ? `${workspaceWarnings.length} automation(s) missing the Portfolio workspace path` : null,
    authorityWarnings.length ? `${authorityWarnings.length} high-risk automation(s) missing explicit authority boundaries` : null,
    docWarnings.length ? `${docWarnings.length} automation(s) without governing docs, skills, or runbooks` : null,
    hiddenCount ? `${hiddenCount} non-Portfolio automation(s) hidden by default` : null,
  ].filter(Boolean) as string[]

  if (warnings.length === 0) {
    return (
      <div className="mb-6 rounded-lg border border-green-400/30 bg-green-500/10 p-4 text-sm text-green-100">
        <div className="flex items-center gap-2 font-medium"><CheckCircle2 size={18} /> No automation inventory warnings found.</div>
      </div>
    )
  }

  return (
    <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-3">
      {warnings.map((warning) => (
        <div key={warning} className="rounded-lg border border-yellow-400/30 bg-yellow-500/10 p-4 text-sm text-yellow-100">
          <div className="flex items-center gap-2 font-medium"><AlertTriangle size={18} /> {warning}</div>
        </div>
      ))}
    </div>
  )
}

function MetricCard({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'green' | 'yellow' | 'red' | 'slate' }) {
  const toneClass =
    tone === 'green' ? 'text-green-300' : tone === 'yellow' ? 'text-yellow-300' : tone === 'red' ? 'text-red-300' : 'text-foreground'
  return (
    <div className="rounded-lg border border-silicon-slate/60 bg-silicon-slate/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  values,
  onChange,
}: {
  label: string
  value: string
  values: readonly string[]
  onChange: (value: string) => void
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-silicon-slate/70 bg-background px-3 py-2 text-sm"
      >
        {values.map((option) => (
          <option key={option} value={option}>{option === ALL ? `All ${label.toLowerCase()}` : option}</option>
        ))}
      </select>
    </label>
  )
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === 'ACTIVE'
      ? 'border-green-400/40 bg-green-500/10 text-green-200'
      : status === 'PAUSED'
        ? 'border-yellow-400/40 bg-yellow-500/10 text-yellow-200'
        : 'border-silicon-slate/60 bg-black/20 text-muted-foreground'
  return <span className={`rounded-full border px-2 py-1 text-xs ${className}`}>{status}</span>
}

function RiskBadge({ risk }: { risk: AutomationRiskLevel }) {
  const className =
    risk === 'high'
      ? 'border-red-400/40 bg-red-500/10 text-red-200'
      : risk === 'medium'
        ? 'border-yellow-400/40 bg-yellow-500/10 text-yellow-200'
        : 'border-green-400/40 bg-green-500/10 text-green-200'
  return <span className={`rounded-full border px-2 py-1 text-xs ${className}`}>{risk}</span>
}

function ContextBadge({ health }: { health: AutomationContextHealth }) {
  const icon = health === 'green' ? <CheckCircle2 size={13} /> : health === 'yellow' ? <AlertTriangle size={13} /> : <XCircle size={13} />
  const className =
    health === 'green'
      ? 'border-green-400/40 bg-green-500/10 text-green-200'
      : health === 'yellow'
        ? 'border-yellow-400/40 bg-yellow-500/10 text-yellow-200'
        : 'border-red-400/40 bg-red-500/10 text-red-200'
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${className}`}>{icon}{health}</span>
}

function DetailPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-silicon-slate/50 bg-black/10 p-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  )
}

function ContextBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</h3>
      <p className={value ? 'text-foreground' : 'text-muted-foreground'}>{value || 'Not found in the current automation context.'}</p>
    </section>
  )
}

function ContextList({ label, values }: { label: string; values: string[] }) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</h3>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <span key={value} className="rounded-md border border-silicon-slate/50 bg-black/10 px-2 py-1 text-xs break-all">
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">Not found in the current automation context.</p>
      )}
    </section>
  )
}

function FailureState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-5 text-red-300">
      <div className="flex items-center gap-2 font-medium"><AlertTriangle size={18} /> {title}</div>
      <p className="text-sm mt-1">{message}</p>
    </div>
  )
}

function UnavailableState({ inventory }: { inventory: AutomationInventoryResponse }) {
  return (
    <div className="rounded-lg border border-yellow-400/40 bg-yellow-500/10 p-5 text-yellow-100">
      <div className="mb-2 flex items-center gap-2 font-medium">
        <ShieldAlert size={18} />
        Local automation inventory unavailable
      </div>
      <p className="text-sm">
        {inventory.reason || 'The local Codex automation directory cannot be read from this environment.'}
      </p>
      <p className="mt-3 flex items-center gap-2 text-xs text-yellow-100/80">
        <FileText size={14} />
        Expected source: {inventory.sourceDirectory}
      </p>
    </div>
  )
}

function formatSchedule(schedule: string | null) {
  if (!schedule) return '-'
  return schedule
    .replace('FREQ=', '')
    .replace(/;BY/g, ' · BY')
    .replace(/;INTERVAL=/g, ' · every ')
}

function formatDateTime(value: string | number | null) {
  if (!value) return '-'
  const date = typeof value === 'number' ? new Date(value) : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}
