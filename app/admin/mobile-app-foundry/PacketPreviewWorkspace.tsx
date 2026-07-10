'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, ClipboardCheck, FileJson, Play, ShieldCheck } from 'lucide-react'
import { getCurrentSession } from '@/lib/auth'

type PreviewMode = 'prototype' | 'commercialization'
type ValidationStatus = 'pending_review' | 'needs_revision' | 'validated'

type PacketPreviewResponse = {
  ok?: boolean
  mode?: string
  markdown?: string
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

function lines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function previewEndpoint(mode: PreviewMode) {
  return `/api/admin/mobile-app-foundry/${mode}-packet`
}

export default function PacketPreviewWorkspace() {
  const [mode, setMode] = useState<PreviewMode>('prototype')
  const [recordJson, setRecordJson] = useState(DEFAULT_RECORD_JSON)
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>('pending_review')
  const [prototypeUrl, setPrototypeUrl] = useState('')
  const [demoEvidence, setDemoEvidence] = useState('')
  const [testerProfile, setTesterProfile] = useState('')
  const [privacyNotes, setPrivacyNotes] = useState('')
  const [result, setResult] = useState<PacketPreviewResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const sideEffectRows = useMemo(() => (
    result?.side_effects && typeof result.side_effects === 'object'
      ? Object.entries(result.side_effects)
      : []
  ), [result])

  async function previewPacket() {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const backlogRecord = JSON.parse(recordJson)
      const session = await getCurrentSession()
      const commercializationInput = mode === 'commercialization'
        ? {
            validation_status: validationStatus,
            prototype_url: prototypeUrl.trim() || null,
            demo_evidence: lines(demoEvidence),
            tester_profile: lines(testerProfile),
            privacy_notes: lines(privacyNotes),
          }
        : undefined

      const response = await fetch(previewEndpoint(mode), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          backlog_record: backlogRecord,
          ...(commercializationInput ? { commercialization_input: commercializationInput } : {}),
        }),
      })
      const body = await response.json().catch(() => ({})) as PacketPreviewResponse
      if (!response.ok) throw new Error(body.error || `Preview failed with ${response.status}`)
      setResult(body)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Preview failed')
    } finally {
      setIsLoading(false)
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
              onChange={(event) => setRecordJson(event.target.value)}
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
        </div>
      </div>
    </section>
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
