'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, ClipboardCheck, FileJson, GitPullRequest, Play, ShieldCheck } from 'lucide-react'
import { getCurrentSession } from '@/lib/auth'

type PreviewMode = 'prototype' | 'commercialization'
type ValidationStatus = 'pending_review' | 'needs_revision' | 'validated'
type WorkItemAction = 'preview' | 'create_work_item'

type PacketPreviewResponse = {
  ok?: boolean
  mode?: string
  markdown?: string
  side_effects?: Record<string, unknown>
  error?: string
}

type WorkItemResponse = {
  ok?: boolean
  mode?: string
  work_item_request?: {
    title?: string
    priority?: string
    status?: string
    ownerAgentKey?: string
    idempotencyKey?: string
    objective?: string
  }
  work_items?: Array<{
    id?: string
    title?: string
    status?: string
  }>
  side_effects?: Record<string, unknown>
  error?: string
}

const SAMPLE_BACKLOG_RECORD = {
  id: 'speech-practice-coach',
  title: 'Speech Practice Coach',
  audience: 'People preparing for public speaking moments',
  job_to_be_done: 'Practice a speech, get structured feedback, and track improvement.',
  trend_sources: ['App Store public speaking category'],
  competitors: ['Orai'],
  popularity_score: 88,
  score_breakdown: {
    demand_signal: 25,
    monetization_path: 13,
    builder_fit: 20,
    build_velocity: 10,
    differentiation: 10,
    release_readiness: 10,
  },
  vambah_fit_summary: 'AI workbench utility with a coaching and access lens.',
  prototype_scope: ['speech prompt intake', 'practice scoring'],
  commercialization_path: ['paid coaching companion'],
  risks: ['Avoid employment-outcome claims.'],
  human_gate: 'review_required',
}

const DEFAULT_RECORD_JSON = JSON.stringify(SAMPLE_BACKLOG_RECORD, null, 2)
const WORK_ITEM_CONFIRMATION = 'create_mobile_foundry_work_items'

function lines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function previewEndpoint(mode: PreviewMode) {
  return `/api/admin/mobile-app-foundry/${mode}-packet`
}

function workItemsEndpoint() {
  return '/api/admin/mobile-app-foundry/work-items'
}

function decisionQueueHref(workItemId?: string | null) {
  return workItemId
    ? `/admin/agents/coordination?proposal=${encodeURIComponent(workItemId)}`
    : '/admin/agents/coordination'
}

export default function PacketPreviewWorkspace() {
  const [mode, setMode] = useState<PreviewMode>('prototype')
  const [recordJson, setRecordJson] = useState(DEFAULT_RECORD_JSON)
  const [sourceRunId, setSourceRunId] = useState('')
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>('pending_review')
  const [prototypeUrl, setPrototypeUrl] = useState('')
  const [demoEvidence, setDemoEvidence] = useState('')
  const [testerProfile, setTesterProfile] = useState('')
  const [privacyNotes, setPrivacyNotes] = useState('')
  const [result, setResult] = useState<PacketPreviewResponse | null>(null)
  const [workItemResult, setWorkItemResult] = useState<WorkItemResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [workItemError, setWorkItemError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isWorkItemLoading, setIsWorkItemLoading] = useState(false)

  const sideEffectRows = useMemo(() => (
    result?.side_effects && typeof result.side_effects === 'object'
      ? Object.entries(result.side_effects)
      : []
  ), [result])

  const workItemSideEffectRows = useMemo(() => (
    workItemResult?.side_effects && typeof workItemResult.side_effects === 'object'
      ? Object.entries(workItemResult.side_effects)
      : []
  ), [workItemResult])

  function clearWorkItemProposal() {
    setWorkItemResult(null)
    setWorkItemError(null)
  }

  function updateRecordJson(value: string) {
    setRecordJson(value)
    clearWorkItemProposal()
  }

  function updateSourceRunId(value: string) {
    setSourceRunId(value)
    clearWorkItemProposal()
  }

  async function authedPost<TResponse>(path: string, body: Record<string, unknown>) {
    const session = await getCurrentSession()
    const response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(body),
    })
    const parsed = await response.json().catch(() => ({})) as TResponse & { error?: string }
    if (!response.ok) throw new Error(parsed.error || `Request failed with ${response.status}`)
    return parsed
  }

  async function previewPacket() {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const backlogRecord = JSON.parse(recordJson)
      const commercializationInput = mode === 'commercialization'
        ? {
            validation_status: validationStatus,
            prototype_url: prototypeUrl.trim() || null,
            demo_evidence: lines(demoEvidence),
            tester_profile: lines(testerProfile),
            privacy_notes: lines(privacyNotes),
        }
        : undefined

      const body = await authedPost<PacketPreviewResponse>(previewEndpoint(mode), {
        backlog_record: backlogRecord,
        ...(commercializationInput ? { commercialization_input: commercializationInput } : {}),
      })
      setResult(body)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Preview failed')
    } finally {
      setIsLoading(false)
    }
  }

  async function previewWorkItemProposal(action: WorkItemAction = 'preview') {
    setIsWorkItemLoading(true)
    setWorkItemError(null)

    try {
      const backlogRecord = JSON.parse(recordJson)
      const body = await authedPost<WorkItemResponse>(workItemsEndpoint(), {
        backlog_record: backlogRecord,
        source_run_id: sourceRunId.trim() || null,
        ...(action === 'create_work_item'
          ? {
              action: 'create_work_item',
              confirmation: WORK_ITEM_CONFIRMATION,
            }
          : {}),
      })
      setWorkItemResult(body)
    } catch (caught) {
      setWorkItemError(caught instanceof Error ? caught.message : 'Work item request failed')
    } finally {
      setIsWorkItemLoading(false)
    }
  }

  return (
    <section className="agent-ops-card mt-5 rounded-xl border p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <FileJson className="text-radiant-gold" size={19} />
            <h2 className="text-lg font-semibold text-foreground">Packet Preview Workspace</h2>
          </div>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground">
            Preview prototype and commercialization packets from one backlog record. Work-item creation, repo creation,
            tester outreach, store submission, pricing, and public claims stay outside this workspace.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100">
          <ShieldCheck size={13} />
          Read-only
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="space-y-4">
          <div className="rounded-lg border border-radiant-gold/10 bg-background/35 p-3">
            <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-radiant-gold">Packet lane</p>
            <div className="grid grid-cols-2 gap-2">
              {(['prototype', 'commercialization'] as PreviewMode[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMode(option)}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                    mode === option
                      ? 'border-radiant-gold/45 bg-radiant-gold/15 text-radiant-gold'
                      : 'border-radiant-gold/10 bg-background/35 text-muted-foreground hover:border-radiant-gold/30 hover:text-foreground'
                  }`}
                >
                  {option === 'prototype' ? 'Prototype' : 'Commercialization'}
                </button>
              ))}
            </div>
          </div>

          <label className="block rounded-lg border border-radiant-gold/10 bg-background/35 p-3">
            <span className="mb-2 block text-[10px] uppercase tracking-[0.16em] text-radiant-gold">
              Backlog record JSON
            </span>
            <textarea
              value={recordJson}
              onChange={(event) => updateRecordJson(event.target.value)}
              className="min-h-72 w-full resize-y rounded-lg border border-radiant-gold/10 bg-background/70 p-3 font-mono text-xs leading-5 text-foreground outline-none transition-colors focus:border-radiant-gold/45"
              spellCheck={false}
            />
          </label>

          {mode === 'commercialization' && (
            <div className="grid gap-3 rounded-lg border border-radiant-gold/10 bg-background/35 p-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-[10px] uppercase tracking-[0.16em] text-radiant-gold">
                  Validation status
                </span>
                <select
                  value={validationStatus}
                  onChange={(event) => setValidationStatus(event.target.value as ValidationStatus)}
                  className="w-full rounded-lg border border-radiant-gold/10 bg-background/70 px-3 py-2 text-sm text-foreground outline-none focus:border-radiant-gold/45"
                >
                  <option value="pending_review">Pending review</option>
                  <option value="needs_revision">Needs revision</option>
                  <option value="validated">Validated</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] uppercase tracking-[0.16em] text-radiant-gold">
                  Prototype URL
                </span>
                <input
                  value={prototypeUrl}
                  onChange={(event) => setPrototypeUrl(event.target.value)}
                  className="w-full rounded-lg border border-radiant-gold/10 bg-background/70 px-3 py-2 text-sm text-foreground outline-none focus:border-radiant-gold/45"
                  placeholder="https://..."
                />
              </label>
              <CompactTextarea label="Demo evidence" value={demoEvidence} onChange={setDemoEvidence} />
              <CompactTextarea label="Tester profile" value={testerProfile} onChange={setTesterProfile} />
              <CompactTextarea label="Privacy notes" value={privacyNotes} onChange={setPrivacyNotes} />
            </div>
          )}

          <div className="rounded-lg border border-radiant-gold/10 bg-background/35 p-3">
            <div className="flex items-start gap-3">
              <GitPullRequest className="mt-0.5 text-radiant-gold" size={16} />
              <div>
                <p className="text-sm font-semibold text-foreground">Agent Ops proposal gate</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Preview the proposed Agent Ops work item before creating it. The confirmed action only creates or reuses
                  a proposed work item; build execution still moves through Decision Queue.
                </p>
              </div>
            </div>
            <label className="mt-3 block">
              <span className="mb-2 block text-[10px] uppercase tracking-[0.16em] text-radiant-gold">
                Source run id
              </span>
              <input
                value={sourceRunId}
                onChange={(event) => updateSourceRunId(event.target.value)}
                className="w-full rounded-lg border border-radiant-gold/10 bg-background/70 px-3 py-2 text-sm text-foreground outline-none focus:border-radiant-gold/45"
                placeholder="Optional analyst run id"
              />
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => previewWorkItemProposal('preview')}
                disabled={isWorkItemLoading}
                className="agent-ops-button-muted inline-flex items-center gap-2 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                <GitPullRequest size={15} />
                {isWorkItemLoading ? 'Checking' : 'Preview proposal'}
              </button>
              <button
                type="button"
                onClick={() => previewWorkItemProposal('create_work_item')}
                disabled={isWorkItemLoading || workItemResult?.mode !== 'preview'}
                className="agent-ops-button-primary inline-flex items-center gap-2 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ShieldCheck size={15} />
                Create proposed item
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
              The create button unlocks only after a proposal preview. It sends the required confirmation token for the
              existing approval-backed endpoint.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={previewPacket}
              disabled={isLoading}
              className="agent-ops-button-primary inline-flex items-center gap-2 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Play size={15} />
              {isLoading ? 'Previewing' : 'Preview packet'}
            </button>
            <button
              type="button"
              onClick={() => {
                setRecordJson(DEFAULT_RECORD_JSON)
                setResult(null)
                setError(null)
                clearWorkItemProposal()
              }}
              className="agent-ops-button-muted inline-flex items-center gap-2 px-3 py-2 text-sm"
            >
              <ClipboardCheck size={15} />
              Sample record
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-radiant-gold/10 bg-background/35 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-radiant-gold">Preview result</p>
            <span className="rounded-full border border-radiant-gold/15 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {previewEndpoint(mode)}
            </span>
          </div>

          {error && (
            <div className="mb-3 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm leading-5 text-red-100">
              <AlertTriangle className="mr-2 inline h-4 w-4" />
              {error}
            </div>
          )}

          {result ? (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {sideEffectRows.map(([key, value]) => (
                  <div key={key} className="rounded-lg border border-radiant-gold/10 bg-background/45 p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {key.replaceAll('_', ' ')}
                    </p>
                    <p className="mt-1 break-words text-sm font-semibold text-foreground">{String(value)}</p>
                  </div>
                ))}
              </div>
              <pre className="max-h-[34rem] overflow-auto rounded-lg border border-radiant-gold/10 bg-background/70 p-4 text-xs leading-5 text-foreground">
                {result.markdown || 'No markdown returned.'}
              </pre>
            </div>
          ) : (
            <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed border-radiant-gold/15 p-6 text-center text-sm leading-6 text-muted-foreground">
              Packet markdown and side-effect evidence will appear here.
            </div>
          )}

          <div className="mt-4 rounded-lg border border-radiant-gold/10 bg-background/45 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-radiant-gold">Agent Ops proposal</p>
              <span className="rounded-full border border-radiant-gold/15 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {workItemsEndpoint()}
              </span>
            </div>

            {workItemError && (
              <div className="mb-3 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm leading-5 text-red-100">
                <AlertTriangle className="mr-2 inline h-4 w-4" />
                {workItemError}
              </div>
            )}

            {workItemResult ? (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <MetricCard label="mode" value={workItemResult.mode || 'unknown'} />
                  <MetricCard
                    label="status"
                    value={workItemResult.work_item_request?.status || workItemResult.work_items?.[0]?.status || 'pending'}
                  />
                  <MetricCard label="priority" value={workItemResult.work_item_request?.priority || 'pending'} />
                  <MetricCard label="owner" value={workItemResult.work_item_request?.ownerAgentKey || 'pending'} />
                </div>
                {workItemResult.work_item_request && (
                  <div className="rounded-lg border border-radiant-gold/10 bg-background/55 p-3">
                    <p className="text-sm font-semibold text-foreground">{workItemResult.work_item_request.title}</p>
                    <p className="mt-1 break-words text-[11px] leading-5 text-muted-foreground">
                      {workItemResult.work_item_request.idempotencyKey}
                    </p>
                  </div>
                )}
                {workItemSideEffectRows.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {workItemSideEffectRows.map(([key, value]) => (
                      <MetricCard key={key} label={key.replaceAll('_', ' ')} value={String(value)} />
                    ))}
                  </div>
                )}
                {workItemResult.work_items?.length ? (
                  <div className="space-y-2 rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-3 text-sm leading-5 text-emerald-100">
                    <p className="font-semibold">Proposed Agent Ops work item ready in Decision Queue.</p>
                    <div className="flex flex-wrap gap-2">
                      {workItemResult.work_items.map((item) => (
                        <a
                          key={item.id ?? item.title}
                          href={decisionQueueHref(item.id)}
                          className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-50 transition-colors hover:border-emerald-200/50 hover:bg-emerald-300/15"
                        >
                          {item.id || item.title || 'Open work item'}
                          <ArrowRight size={13} />
                        </a>
                      ))}
                    </div>
                    <p className="text-xs leading-5 text-emerald-50/80">
                      Next step for you is to review or route the proposed item from Agent Ops. Build execution, repo
                      creation, tester outreach, pricing, and store actions remain outside this workspace.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-radiant-gold/15 p-4 text-sm leading-6 text-muted-foreground">
                Preview a proposal to inspect owner, priority, idempotency key, and side-effect boundary before creating a
                proposed work item.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-radiant-gold/10 bg-background/45 p-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

function CompactTextarea({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block md:col-span-1">
      <span className="mb-2 block text-[10px] uppercase tracking-[0.16em] text-radiant-gold">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 w-full resize-y rounded-lg border border-radiant-gold/10 bg-background/70 p-3 text-sm leading-5 text-foreground outline-none focus:border-radiant-gold/45"
        placeholder="One item per line"
      />
    </label>
  )
}
