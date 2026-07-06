'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  CircleDollarSign,
  Clipboard,
  FileText,
  Gauge,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  Zap,
} from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import type { ModelUsageLedgerEvent, ModelUsageSnapshot } from '@/lib/model-usage'

type Snapshot = ModelUsageSnapshot & { ok?: boolean }

type DatePreset = '30d' | 'mtd' | 'qtd'
type SourceFileKind = 'codex_session_json' | 'claude_code_session_json' | 'gemini_usage_csv' | 'openai_usage_jsonl' | 'anthropic_usage_jsonl' | 'local_model_json'

const SOURCE_FILE_KIND_OPTIONS: Array<{ key: SourceFileKind; label: string }> = [
  { key: 'codex_session_json', label: 'Codex JSON' },
  { key: 'claude_code_session_json', label: 'Claude Code JSON' },
  { key: 'gemini_usage_csv', label: 'Gemini CSV' },
  { key: 'openai_usage_jsonl', label: 'OpenAI JSONL' },
  { key: 'anthropic_usage_jsonl', label: 'Anthropic JSONL' },
  { key: 'local_model_json', label: 'Local/Open-weight JSON' },
]

const DEFAULT_IMPORT_PACKET = JSON.stringify({
  sourcePackets: [
    {
      kind: 'codex_session',
      sourceId: 'replace-with-session-id',
      occurredAt: '2026-06-06T12:00:00.000Z',
      model: 'gpt-5-codex',
      taskCategory: 'coding',
      clientLabel: 'Portfolio',
      actionLabel: 'Reviewed Codex session import',
      inputTokens: 12000,
      outputTokens: 1800,
      confidence: 'medium',
      sourceMetadata: { source: 'manual-reviewed-import', category: 'implementation' },
    },
    {
      kind: 'local_model_run',
      sourceId: 'replace-with-local-run-id',
      model: 'llama-3.1-8b',
      taskCategory: 'rag',
      inputTokens: 2400,
      outputTokens: 500,
      executionHost: 'mac-mini',
      deploymentTarget: 'local_device',
      sourceMetadata: { runner: 'ollama', environment: 'private-local' },
    },
  ],
  subscriptionAllocations: [
    {
      provider: 'codex',
      runtime: 'any',
      accountLabel: 'Codex subscription',
      monthlyCostUsd: 20,
      periodStart: '2026-06-01T00:00:00.000Z',
      periodEnd: '2026-06-30T23:59:59.999Z',
      allocationBasis: 'token_share',
      confidence: 'medium',
      notes: 'Reviewed flat-rate allocation; no provider account connection.',
    },
  ],
}, null, 2)

const DEFAULT_SOURCE_FILE_TEXT = JSON.stringify({
  session_id: 'replace-with-session-id',
  occurred_at: '2026-06-06T12:00:00.000Z',
  model: 'gpt-5-codex',
  task_category: 'coding',
  usage: {
    input_tokens: 12000,
    output_tokens: 1800,
    cached_tokens: 400,
  },
  operation: 'reviewed_session_import',
}, null, 2)

function dateRange(preset: DatePreset) {
  const now = new Date()
  const to = now.toISOString().slice(0, 10)
  if (preset === 'mtd') return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), to }
  if (preset === 'qtd') {
    const quarter = Math.floor(now.getMonth() / 3)
    return { from: new Date(now.getFullYear(), quarter * 3, 1).toISOString().slice(0, 10), to }
  }
  return { from: new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), to }
}

function numberFormat(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
}

function currency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ModelUsagePage() {
  return (
    <ProtectedRoute requireAdmin>
      <ModelUsageContent />
    </ProtectedRoute>
  )
}

function ModelUsageContent() {
  const [preset, setPreset] = useState<DatePreset>('30d')
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clientFilter, setClientFilter] = useState('all')
  const [taskFilter, setTaskFilter] = useState('all')
  const [modelFilter, setModelFilter] = useState('all')
  const [runtimeFilter, setRuntimeFilter] = useState('all')
  const [confidenceFilter, setConfidenceFilter] = useState('all')
  const [importText, setImportText] = useState(DEFAULT_IMPORT_PACKET)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [sourceFileKind, setSourceFileKind] = useState<SourceFileKind>('codex_session_json')
  const [sourceFileText, setSourceFileText] = useState(DEFAULT_SOURCE_FILE_TEXT)
  const [sourceFileClientLabel, setSourceFileClientLabel] = useState('Portfolio')
  const [sourceFileBatchId, setSourceFileBatchId] = useState('')
  const [sourceFileResult, setSourceFileResult] = useState<string | null>(null)
  const [clientSafeResult, setClientSafeResult] = useState<string | null>(null)

  const fetchSnapshot = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { from, to } = dateRange(preset)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const res = await fetch(`/api/admin/model-usage/summary?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setSnapshot(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load model usage')
      setSnapshot(null)
    } finally {
      setLoading(false)
    }
  }, [preset])

  useEffect(() => {
    fetchSnapshot()
  }, [fetchSnapshot])

  const filteredEvents = useMemo(() => {
    const events = snapshot?.events ?? []
    return events.filter((event) => (
      (clientFilter === 'all' || (event.clientProjectId ?? 'portfolio') === clientFilter) &&
      (taskFilter === 'all' || event.taskCategory === taskFilter) &&
      (modelFilter === 'all' || event.model === modelFilter) &&
      (runtimeFilter === 'all' || event.runtime === runtimeFilter) &&
      (confidenceFilter === 'all' || event.confidence === confidenceFilter)
    ))
  }, [clientFilter, confidenceFilter, modelFilter, runtimeFilter, snapshot?.events, taskFilter])

  const options = useMemo(() => {
    const events = snapshot?.events ?? []
    return {
      clients: uniqueOptions(events.map((event) => ({ key: event.clientProjectId ?? 'portfolio', label: event.clientLabel }))),
      tasks: uniqueOptions(events.map((event) => ({ key: event.taskCategory, label: event.taskCategory.replace(/_/g, ' ') }))),
      models: uniqueOptions(events.map((event) => ({ key: event.model, label: event.model }))),
      runtimes: uniqueOptions(events.map((event) => ({ key: event.runtime, label: event.runtime }))),
      confidences: uniqueOptions(events.map((event) => ({ key: event.confidence, label: event.confidence }))),
    }
  }, [snapshot?.events])

  const submitImportPacket = useCallback(async (dryRun: boolean) => {
    setImporting(true)
    setImportResult(null)
    try {
      const parsed = JSON.parse(importText)
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('Missing admin session')
      const res = await fetch('/api/admin/model-usage/import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...parsed, dryRun }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      if (dryRun) {
        setImportResult(`Dry run passed: ${body.eventCount ?? 0} event(s), ${body.subscriptionAllocationCount ?? 0} allocation row(s). ${(body.warnings ?? []).join(' ')}`)
      } else {
        setImportResult(`Imported ${body.insertedEvents ?? 0} event(s) and ${body.insertedSubscriptionAllocations ?? 0} allocation row(s). ${(body.warnings ?? []).join(' ')}`)
        fetchSnapshot()
      }
    } catch (err) {
      setImportResult(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }, [fetchSnapshot, importText])

  const appendSourceFileImport = useCallback(() => {
    setSourceFileResult(null)
    try {
      const current = JSON.parse(importText || '{}')
      const sourceFile = {
        kind: sourceFileKind,
        text: sourceFileText,
        clientLabel: sourceFileClientLabel || undefined,
        exportBatchId: sourceFileBatchId || undefined,
      }
      setImportText(JSON.stringify({
        ...current,
        sourceFiles: [...(Array.isArray(current.sourceFiles) ? current.sourceFiles : []), sourceFile],
      }, null, 2))
      setSourceFileResult('Source file staged into the reviewed import packet. Run dry run before importing.')
    } catch (err) {
      setSourceFileResult(err instanceof Error ? err.message : 'Could not stage source file import.')
    }
  }, [importText, sourceFileBatchId, sourceFileClientLabel, sourceFileKind, sourceFileText])

  const loadSourceFile = useCallback(async (file: File | null) => {
    if (!file) return
    setSourceFileText(await file.text())
    setSourceFileResult(`Loaded ${file.name} for review.`)
  }, [])

  const copyClientSafeExport = useCallback(async () => {
    if (!snapshot) return
    const safeExport = {
      generatedAt: snapshot.generatedAt,
      window: snapshot.window,
      totals: snapshot.totals,
      byProvider: snapshot.byProvider,
      byModel: snapshot.byModel,
      byRuntime: snapshot.byRuntime,
      byTaskCategory: snapshot.byTaskCategory,
      byClientProject: snapshot.byClientProject,
      recommendations: snapshot.recommendations.map((recommendation) => ({
        id: recommendation.id,
        severity: recommendation.severity,
        title: recommendation.title,
        action: recommendation.action,
        approvalRequired: recommendation.approvalRequired,
      })),
      events: snapshot.clientSafeEvents,
    }
    const text = JSON.stringify(safeExport, null, 2)
    try {
      await navigator.clipboard.writeText(text)
      setClientSafeResult(`Copied client-safe usage export with ${safeExport.events.length} scrubbed event(s).`)
    } catch {
      setClientSafeResult(text)
    }
  }, [snapshot])

  return (
    <div className="agent-ops-page min-h-screen p-5 text-foreground lg:p-7">
      <div className="mx-auto max-w-[1680px]">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Agent Operations', href: '/admin/agents' },
          { label: 'Model Usage' },
        ]} />

        <header className="agent-ops-surface-header mb-5 mt-5 rounded-xl border p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="agent-ops-eyebrow mb-2">
                <BrainCircuit size={16} />
                Agent Ops model accounting
              </div>
              <h1 className="text-3xl font-bold">Model Usage And Token Efficiency</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Token burn, inferred subscription allocation, model comparison, and client/project attribution from the same governed Agent Ops ledger.
              </p>
            </div>
            <div className="agent-ops-header-actions">
              <Link href="/admin/cost-revenue" className="agent-ops-button-muted">
                <CircleDollarSign size={16} />
                Cost & Revenue
              </Link>
              <button onClick={fetchSnapshot} disabled={loading} className="agent-ops-button-secondary disabled:opacity-60">
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Loading model usage...</div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6 text-red-300">
            <p className="font-semibold">Failed to load model usage</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        ) : snapshot ? (
          <div className="space-y-5">
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={Zap} label="Total tokens" value={numberFormat(snapshot.totals.totalTokens)} sub={`${snapshot.totals.eventCount} transactions`} />
              <MetricCard icon={CircleDollarSign} label="Attributed cost" value={currency(snapshot.totals.costUsd)} sub={`${currency(snapshot.totals.allocatedCostUsd)} allocated`} />
              <MetricCard icon={Gauge} label="Tokens per output" value={snapshot.totals.tokensPerAcceptedOutput ? numberFormat(snapshot.totals.tokensPerAcceptedOutput) : 'No outputs'} sub="Accepted-output denominator" />
              <MetricCard icon={Activity} label="Cost per output" value={snapshot.totals.costPerAcceptedOutput ? currency(snapshot.totals.costPerAcceptedOutput) : 'No outputs'} sub="Metered + prorated where available" />
            </section>

            <section className="agent-ops-card rounded-lg border p-4">
              <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <CalendarDays size={16} className="text-radiant-gold" />
                    Token burn calendar
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">GitHub-style daily usage view. Darker cells represent heavier token burn in the selected window.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['30d', 'mtd', 'qtd'] as const).map((item) => (
                    <button
                      key={item}
                      onClick={() => setPreset(item)}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                        preset === item
                          ? 'border-radiant-gold/60 bg-radiant-gold/15 text-radiant-gold'
                          : 'border-silicon-slate/60 bg-background/45 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {item.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-10 gap-2 md:grid-cols-15 xl:grid-cols-30" aria-label="Token burn heatmap">
                {snapshot.heatmap.length > 0 ? snapshot.heatmap.map((day) => (
                  <div
                    key={day.date}
                    title={`${day.date}: ${numberFormat(day.totalTokens)} tokens, ${currency(day.costUsd)}`}
                    className={`aspect-square rounded-[4px] border ${heatmapClass(day.level)}`}
                  />
                )) : (
                  <div className="col-span-full rounded-lg border border-dashed p-5 text-sm text-muted-foreground">No token usage captured in this period.</div>
                )}
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
              <div className="agent-ops-card rounded-lg border p-4">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                  <BarChart3 size={16} className="text-radiant-gold" />
                  Model and task comparison
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <GroupList title="Providers" rows={snapshot.byProvider} />
                  <GroupList title="Models" rows={snapshot.byModel.slice(0, 8)} />
                  <GroupList title="Task categories" rows={snapshot.byTaskCategory} />
                  <GroupList title="Clients / projects" rows={snapshot.byClientProject} />
                </div>
              </div>
              <div className="agent-ops-card rounded-lg border p-4">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck size={16} className="text-radiant-gold" />
                  Efficiency recommendations
                </div>
                <div className="space-y-3">
                  {snapshot.recommendations.length > 0 ? snapshot.recommendations.map((item) => (
                    <div key={item.id} className="rounded-lg border border-silicon-slate/60 bg-background/35 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{item.title}</p>
                        {item.approvalRequired ? <span className="rounded-full border border-amber-400/50 px-2 py-0.5 text-[11px] text-amber-300">Approval</span> : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{item.rationale}</p>
                      <p className="mt-2 text-xs text-foreground/85">{item.action}</p>
                    </div>
                  )) : (
                    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No efficiency recommendations for this window.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="agent-ops-card rounded-lg border p-4">
              <div className="mb-4 flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <BrainCircuit size={16} className="text-radiant-gold" />
                    Reviewed usage import packet
                  </div>
                  <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
                    Import audited source packets, ledger rows, or subscription allocation rules from Codex, Claude Code, Gemini, OpenAI, Anthropic, or local/open-weight model records. Raw prompts, transcripts, secrets, credentials, OAuth, provider writes, and routing changes are blocked from this path.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => submitImportPacket(true)}
                    disabled={importing}
                    className="agent-ops-button-muted disabled:opacity-60"
                  >
                    <ShieldCheck size={16} />
                    Dry run
                  </button>
                  <button
                    type="button"
                    onClick={() => submitImportPacket(false)}
                    disabled={importing}
                    className="agent-ops-button-secondary disabled:opacity-60"
                  >
                    <Activity size={16} />
                    Import reviewed packet
                  </button>
                </div>
              </div>
              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                spellCheck={false}
                className="min-h-[220px] w-full rounded-lg border border-silicon-slate/60 bg-background/80 p-3 font-mono text-xs text-foreground outline-none focus:border-radiant-gold/60"
                aria-label="Model usage import packet JSON"
              />
              {importResult ? (
                <p className="mt-3 rounded-lg border border-silicon-slate/60 bg-background/45 p-3 text-sm text-muted-foreground">
                  {importResult}
                </p>
              ) : null}
              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <div className="rounded-lg border border-silicon-slate/60 bg-background/35 p-3">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <FileText size={16} className="text-radiant-gold" />
                    Reviewed source file
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs text-muted-foreground">
                      Source format
                      <select
                        value={sourceFileKind}
                        onChange={(event) => setSourceFileKind(event.target.value as SourceFileKind)}
                        className="mt-1 w-full rounded-lg border border-silicon-slate/60 bg-background/80 px-3 py-2 text-xs text-foreground"
                      >
                        {SOURCE_FILE_KIND_OPTIONS.map((option) => (
                          <option key={option.key} value={option.key}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-muted-foreground">
                      Client label
                      <input
                        value={sourceFileClientLabel}
                        onChange={(event) => setSourceFileClientLabel(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-silicon-slate/60 bg-background/80 px-3 py-2 text-xs text-foreground"
                      />
                    </label>
                    <label className="text-xs text-muted-foreground sm:col-span-2">
                      Export batch id
                      <input
                        value={sourceFileBatchId}
                        onChange={(event) => setSourceFileBatchId(event.target.value)}
                        placeholder="Optional reviewed export batch id"
                        className="mt-1 w-full rounded-lg border border-silicon-slate/60 bg-background/80 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60"
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <label className="agent-ops-button-muted cursor-pointer">
                      <Upload size={16} />
                      Load file
                      <input
                        type="file"
                        accept=".json,.jsonl,.csv,.txt"
                        className="sr-only"
                        onChange={(event) => loadSourceFile(event.target.files?.[0] ?? null)}
                      />
                    </label>
                    <button type="button" onClick={appendSourceFileImport} className="agent-ops-button-secondary">
                      <FileText size={16} />
                      Stage source file
                    </button>
                  </div>
                </div>
                <div>
                  <textarea
                    value={sourceFileText}
                    onChange={(event) => setSourceFileText(event.target.value)}
                    spellCheck={false}
                    className="min-h-[190px] w-full rounded-lg border border-silicon-slate/60 bg-background/80 p-3 font-mono text-xs text-foreground outline-none focus:border-radiant-gold/60"
                    aria-label="Reviewed source file text"
                  />
                  {sourceFileResult ? (
                    <p className="mt-2 rounded-lg border border-silicon-slate/60 bg-background/45 p-3 text-sm text-muted-foreground">
                      {sourceFileResult}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-silicon-slate/60 bg-background/35 p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Clipboard size={16} className="text-radiant-gold" />
                      Client-safe usage export
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Copies scrubbed transactions, rollups, and advisory recommendations without private trace ids or internal action labels.</p>
                  </div>
                  <button type="button" onClick={copyClientSafeExport} className="agent-ops-button-muted">
                    <Clipboard size={16} />
                    Copy client-safe JSON
                  </button>
                </div>
                {clientSafeResult ? (
                  <pre className="mt-3 max-h-40 overflow-auto rounded-lg border border-silicon-slate/60 bg-background/60 p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                    {clientSafeResult}
                  </pre>
                ) : null}
              </div>
            </section>

            <section className="agent-ops-card rounded-lg border p-4">
              <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <SlidersHorizontal size={16} className="text-radiant-gold" />
                    Transaction audit trail
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Trace token and cost allocation back to specific runs, calls, clients, and actions.</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  <FilterSelect label="Client" value={clientFilter} onChange={setClientFilter} options={options.clients} />
                  <FilterSelect label="Task" value={taskFilter} onChange={setTaskFilter} options={options.tasks} />
                  <FilterSelect label="Model" value={modelFilter} onChange={setModelFilter} options={options.models} />
                  <FilterSelect label="Runtime" value={runtimeFilter} onChange={setRuntimeFilter} options={options.runtimes} />
                  <FilterSelect label="Confidence" value={confidenceFilter} onChange={setConfidenceFilter} options={options.confidences} />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                    <tr className="border-b border-silicon-slate/60">
                      <th className="py-2 pr-4">When</th>
                      <th className="py-2 pr-4">Action</th>
                      <th className="py-2 pr-4">Model</th>
                      <th className="py-2 pr-4">Client</th>
                      <th className="py-2 pr-4 text-right">Tokens</th>
                      <th className="py-2 pr-4 text-right">Cost</th>
                      <th className="py-2 pr-4">Basis</th>
                      <th className="py-2 pr-4">Trace</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.slice(0, 50).map((event) => (
                      <TransactionRow key={event.id} event={event} />
                    ))}
                    {filteredEvents.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-muted-foreground">No transactions match the selected filters.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, sub }: { icon: typeof Zap; label: string; value: string; sub: string }) {
  return (
    <div className="agent-ops-card rounded-lg border p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-radiant-gold/30 bg-radiant-gold/10 text-radiant-gold">
        <Icon size={18} />
      </div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}

function GroupList({ title, rows }: { title: string; rows: Snapshot['byProvider'] }) {
  const max = Math.max(...rows.map((row) => row.totalTokens), 1)
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-2">
        {rows.length > 0 ? rows.map((row) => (
          <div key={row.key}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="truncate capitalize text-foreground/90">{row.label}</span>
              <span className="tabular-nums text-muted-foreground">{numberFormat(row.totalTokens)} tok</span>
            </div>
            <div className="h-2 rounded-full bg-silicon-slate/50">
              <div className="h-2 rounded-full bg-radiant-gold" style={{ width: `${Math.max(4, (row.totalTokens / max) * 100)}%` }} />
            </div>
          </div>
        )) : (
          <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">No rows captured.</p>
        )}
      </div>
    </div>
  )
}

function TransactionRow({ event }: { event: ModelUsageLedgerEvent }) {
  return (
    <tr className="border-b border-silicon-slate/40 align-top">
      <td className="py-3 pr-4 text-muted-foreground">{shortDate(event.occurredAt)}</td>
      <td className="py-3 pr-4">
        <p className="max-w-[280px] truncate font-medium">{event.actionLabel}</p>
        <p className="text-xs capitalize text-muted-foreground">{event.taskCategory.replace(/_/g, ' ')} · {event.runtime}</p>
      </td>
      <td className="py-3 pr-4">
        <p className="font-mono text-xs">{event.model}</p>
        <p className="text-xs capitalize text-muted-foreground">{event.provider.replace(/_/g, ' ')}</p>
      </td>
      <td className="py-3 pr-4">{event.clientLabel}</td>
      <td className="py-3 pr-4 text-right tabular-nums">{numberFormat(event.totalTokens)}</td>
      <td className="py-3 pr-4 text-right tabular-nums text-radiant-gold">{currency(event.costUsd)}</td>
      <td className="py-3 pr-4">
        <span className="rounded-full border border-silicon-slate/60 px-2 py-0.5 text-[11px] capitalize text-muted-foreground">
          {event.costBasis.replace(/_/g, ' ')} · {event.confidence}
        </span>
      </td>
      <td className="py-3 pr-4">
        {event.sourceTrace.href ? (
          <Link href={event.sourceTrace.href} className="inline-flex items-center gap-1 text-xs text-radiant-gold hover:underline">
            Trace
            <ArrowRight size={12} />
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">Imported</span>
        )}
      </td>
    </tr>
  )
}

function FilterSelect({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ key: string; label: string }>
}) {
  return (
    <label className="text-xs text-muted-foreground">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-silicon-slate/60 bg-background/80 px-3 py-2 text-xs capitalize text-foreground"
      >
        <option value="all">All {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.key} value={option.key}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

function uniqueOptions(rows: Array<{ key: string; label: string }>) {
  const map = new Map<string, string>()
  for (const row of rows) map.set(row.key, row.label)
  return [...map.entries()].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label))
}

function heatmapClass(level: number) {
  if (level >= 4) return 'border-radiant-gold/80 bg-radiant-gold'
  if (level === 3) return 'border-radiant-gold/60 bg-radiant-gold/70'
  if (level === 2) return 'border-radiant-gold/40 bg-radiant-gold/40'
  if (level === 1) return 'border-radiant-gold/25 bg-radiant-gold/20'
  return 'border-silicon-slate/60 bg-silicon-slate/25'
}
