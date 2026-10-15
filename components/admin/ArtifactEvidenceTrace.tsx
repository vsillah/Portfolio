'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ExternalLink, FileSearch, ShieldCheck, X } from 'lucide-react'
import { ARTIFACT_EVALUATION_DIMENSIONS, type ArtifactEvaluationDimensionKey } from '@/lib/artifact-evidence-evaluation'
import {
  artifactManifestSnapshot,
  validateArtifactEvidenceManifest,
  type ArtifactEvidenceElement,
  type ArtifactEvidenceManifest,
} from '@/lib/artifact-evidence-manifest'

function compactHash(value: string) {
  return value.length > 28 ? `${value.slice(0, 18)}…${value.slice(-8)}` : value
}

const DIMENSION_LABELS: Record<ArtifactEvaluationDimensionKey, string> = {
  outlier_pattern_fit: 'Outlier-pattern fit',
  source_support: 'Source support',
  core_audience_fit: 'Core-audience fit',
  timeliness: 'Timeliness',
  product_work_evidence_fit: 'Product/work evidence fit',
  originality_repetition_risk: 'Originality / repetition risk',
}

function ElementEvaluationScorecard({ element }: { element: ArtifactEvidenceElement }) {
  const receipt = element.evaluation_receipt
  if (!receipt) return null
  return (
    <section aria-label={`${element.label} numerical evaluation`} className="mt-3 rounded-lg border border-sky-600/30 bg-sky-500/5 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-sky-800 dark:text-sky-200">Numerical evaluation</p>
          <p className="mt-1 text-xs text-muted-foreground">{receipt.weighting_version} · {receipt.version}</p>
        </div>
        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${receipt.overall.score == null ? 'border-amber-600/35 bg-amber-500/10 text-amber-900 dark:text-amber-100' : 'border-emerald-600/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'}`}>
          {receipt.overall.score == null ? 'Unscored · hold' : `${receipt.overall.score}/100 · ${receipt.overall.recommendation}`}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{receipt.overall.rationale}</p>
      <div className="mt-2 flex flex-wrap gap-2">{receipt.overall.source_receipts.map((source) => <Link key={source.receipt_id} href={source.href} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-sky-600/30 px-2 py-1 text-[10px] font-semibold text-sky-900 hover:bg-sky-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-sky-100"><ExternalLink className="h-3 w-3" /> {source.receipt_id}</Link>)}</div>
      <div className="mt-3 space-y-2">
        {ARTIFACT_EVALUATION_DIMENSIONS.map((key) => {
          const dimension = receipt.dimensions[key]
          return (
            <details key={key} className="rounded-md border border-border bg-background p-2.5">
              <summary className="cursor-pointer list-none">
                <span className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-foreground">{DIMENSION_LABELS[key]}</span>
                  <span className={`shrink-0 text-xs font-bold ${dimension.score == null ? 'text-amber-700 dark:text-amber-200' : 'text-foreground'}`}>
                    {dimension.score == null ? 'Unscored' : `${dimension.score}/100`}
                  </span>
                </span>
                <span className="mt-1 block text-[10px] text-muted-foreground">{dimension.basis.replaceAll('_', ' ')} · weight {dimension.weight}% · threshold {dimension.threshold} · {dimension.direction.replaceAll('_', ' ')}</span>
              </summary>
              <div className="mt-2 space-y-2 border-t border-border pt-2 text-[11px] leading-5 text-muted-foreground">
                <p>{dimension.rationale}</p>
                <p>Percentile: <span className="font-medium text-foreground">{dimension.percentile ?? 'Unavailable'}</span> · Rank: <span className="font-medium text-foreground">{dimension.rank ? `${dimension.rank.position} of ${dimension.rank.total}` : 'Unavailable'}</span></p>
                {dimension.deterministic_inputs.length > 0 && (
                  <div><p className="font-semibold text-foreground">Deterministic inputs</p><ul>{dimension.deterministic_inputs.map((input) => <li key={`${input.name}-${input.receipt_id}`}>{input.name}: {input.value} · <span className="font-mono">{input.receipt_id}</span></li>)}</ul></div>
                )}
                {dimension.source_receipts.length > 0 && (
                  <div className="flex flex-wrap gap-2">{dimension.source_receipts.map((source) => <Link key={source.receipt_id} href={source.href} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-sky-600/35 px-2 py-1 font-semibold text-sky-900 hover:bg-sky-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-sky-100"><ExternalLink className="h-3 w-3" /> {source.receipt_id}</Link>)}</div>
                )}
              </div>
            </details>
          )
        })}
      </div>
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <dt>Cohort</dt><dd className="font-medium text-foreground">{receipt.benchmark_cohort.cohort_id ?? 'Unavailable'} · {receipt.benchmark_cohort.status}</dd>
        <dt>Sample</dt><dd className="font-medium text-foreground">{receipt.benchmark_cohort.sample_size ?? 'Unavailable'}</dd>
        <dt>Observed</dt><dd className="font-medium text-foreground">{receipt.benchmark_cohort.observed_from && receipt.benchmark_cohort.observed_to ? `${receipt.benchmark_cohort.observed_from} – ${receipt.benchmark_cohort.observed_to}` : 'Unavailable'}</dd>
        <dt>Fresh until</dt><dd className="font-medium text-foreground">{receipt.benchmark_cohort.fresh_until ?? 'Unavailable'}</dd>
        <dt>Confidence</dt><dd className="font-medium text-foreground">{receipt.overall.confidence_score == null ? 'Unscored' : `${receipt.overall.confidence_score}/100`} · {receipt.overall.confidence_label}</dd>
        <dt>Receipt</dt><dd className="break-all font-mono text-foreground">{receipt.receipt_id}</dd>
      </dl>
    </section>
  )
}

function SourceLineageDetail({ element, number, onClose }: {
  element: ArtifactEvidenceElement
  number: number
  onClose: () => void
}) {
  return (
    <aside aria-label={`Trace ${number} evidence detail`} className="rounded-lg border border-amber-600/35 bg-background p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-800 dark:text-amber-200">Trace {number} · {element.category.replaceAll('_', ' ')}</p>
          <h4 className="mt-1 text-sm font-semibold text-foreground">{element.label}</h4>
        </div>
        <button type="button" aria-label="Close trace detail" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 rounded-md border border-border bg-muted/30 p-2.5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Bounded input</p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">{element.redacted ? '[Private source withheld — approved summary only]' : `“${element.input_excerpt}”`}</p>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <dt>Source</dt><dd className="break-words font-medium text-foreground">{element.source_identity}</dd>
        <dt>Record</dt><dd className="font-medium text-foreground">{element.source_record_type.replaceAll('_', ' ')}</dd>
        <dt>Evidence</dt><dd className="break-all font-mono text-[11px] text-foreground">{element.evidence_receipt_ids.join(' · ') || 'Missing'}</dd>
        <dt>Version</dt><dd className="break-all font-mono text-[11px] text-foreground">{compactHash(element.version_hash)}</dd>
        <dt>Rights/privacy</dt><dd className="font-medium text-foreground">{element.rights_privacy_status} · {element.rights_privacy_receipt_ids.join(' · ') || 'receipt missing'}</dd>
        <dt>Transform</dt><dd className="font-medium text-foreground">{element.transformation_step}</dd>
        <dt>Visibility</dt><dd className="font-medium text-foreground">{element.customer_facing ? 'Customer-facing' : 'Review-only'}{element.redacted ? ' · redacted' : ''}</dd>
      </dl>
      <ElementEvaluationScorecard element={element} />
      {element.authoritative_href ? (
        <Link href={element.authoritative_href} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-600/45 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:bg-amber-300/10 dark:text-amber-100 dark:hover:bg-amber-300/15">
          <ExternalLink className="h-4 w-4" /> Open authoritative evidence
        </Link>
      ) : (
        <p className="mt-3 rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">No raw private source link is exposed. Use the approved review record named above.</p>
      )}
    </aside>
  )
}

function VisualSourceTrace({ manifest, selectedId, onSelect }: {
  manifest: ArtifactEvidenceManifest
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const regions = manifest.elements.filter((element) => element.region)
  return (
    <>
      {regions.map((element) => {
        const number = manifest.elements.findIndex((candidate) => candidate.id === element.id) + 1
        return (
          <button
            key={element.id}
            type="button"
            aria-label={`Trace ${number}: ${element.label}`}
            aria-pressed={selectedId === element.id}
            onClick={() => onSelect(element.id)}
            style={{ left: `${element.region!.x}%`, top: `${element.region!.y}%` }}
            className={`absolute z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-lg transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 ${element.rights_privacy_status === 'passed' ? 'bg-emerald-600' : 'bg-red-600'}`}
          >
            {number}
          </button>
        )
      })}
    </>
  )
}

export default function ArtifactEvidenceTrace({ manifest: rawManifest, currentContentVersion, recordedSnapshot }: {
  manifest: unknown
  currentContentVersion: string
  recordedSnapshot?: { manifest_id?: string; manifest_hash?: string; content_version?: string; evaluation_receipt_version?: string | null; evaluation_receipt_ids?: string[] } | null
}) {
  const validation = useMemo(() => validateArtifactEvidenceManifest(rawManifest, currentContentVersion), [currentContentVersion, rawManifest])
  const manifest = validation.manifest
  const [traceEnabled, setTraceEnabled] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  if (!manifest) return null

  const selected = manifest.elements.find((element) => element.id === selectedId) ?? null
  const currentSnapshot = artifactManifestSnapshot(manifest)
  const recordedMatches = recordedSnapshot
    ? recordedSnapshot.manifest_id === manifest.manifest_id
      && recordedSnapshot.manifest_hash === manifest.manifest_hash
      && recordedSnapshot.evaluation_receipt_version === currentSnapshot?.evaluation_receipt_version
      && JSON.stringify([...(recordedSnapshot.evaluation_receipt_ids ?? [])].sort()) === JSON.stringify(currentSnapshot?.evaluation_receipt_ids ?? [])
    : null

  return (
    <section aria-labelledby="artifact-evidence-heading" data-testid="artifact-evidence-trace" className="min-w-0 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-800 dark:text-amber-200"><FileSearch className="h-4 w-4" /> Artifact evidence</p>
          <h2 id="artifact-evidence-heading" className="mt-1 text-xl font-semibold text-foreground">{manifest.artifact_label}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Inspect what produced this customer-facing artifact without exposing private conversations, internal prompts, secrets, or implementation logic.</p>
        </div>
        <button
          type="button"
          aria-pressed={traceEnabled}
          aria-controls="artifact-evidence-trace-list"
          onClick={() => { setTraceEnabled((value) => !value); setSelectedId(null) }}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-600/45 bg-background px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <FileSearch className="h-4 w-4 text-amber-700 dark:text-amber-300" /> Trace evidence
          <span className="text-xs text-muted-foreground">{traceEnabled ? 'On' : 'Off'}</span>
        </button>
      </div>

      {!validation.ready && (
        <div role="alert" className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-900 dark:text-red-100"><AlertTriangle className="h-4 w-4" /> Evidence gate blocked</p>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-red-900/90 dark:text-red-100/90">{validation.blockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}</ul>
        </div>
      )}

      {recordedSnapshot && (
        <div className={`mt-4 rounded-lg border p-3 text-xs ${recordedMatches ? 'border-emerald-600/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100' : 'border-amber-600/35 bg-amber-500/10 text-amber-950 dark:text-amber-100'}`}>
          <p className="font-semibold">Recorded decision manifest {recordedMatches ? 'matches this artifact' : 'preserved from an earlier content version'}</p>
          <p className="mt-1 break-all font-mono">{recordedSnapshot.manifest_id} · {compactHash(recordedSnapshot.manifest_hash || '')} · {recordedSnapshot.content_version}</p>
          {recordedSnapshot.evaluation_receipt_version && <p className="mt-1 break-all font-mono">{recordedSnapshot.evaluation_receipt_version} · {(recordedSnapshot.evaluation_receipt_ids ?? []).join(' · ') || 'no evaluation receipt ids'}</p>}
        </div>
      )}

      {manifest.preview_url && (
        <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-lg border border-border bg-slate-950" data-testid="artifact-trace-canvas">
          <Image src={manifest.preview_url} alt={manifest.preview_alt} fill sizes="(max-width: 800px) 100vw, 900px" className="object-contain" />
          {traceEnabled && <VisualSourceTrace manifest={manifest} selectedId={selectedId} onSelect={setSelectedId} />}
        </div>
      )}

      {traceEnabled && (
        <div id="artifact-evidence-trace-list" className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-2" aria-label="Artifact trace list">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Trace list</p>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${validation.ready ? 'border-emerald-600/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100' : 'border-red-600/35 bg-red-500/10 text-red-800 dark:text-red-100'}`}>
                {validation.ready ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}{validation.ready ? 'Receipt complete' : 'Fail closed'}
              </span>
            </div>
            {manifest.elements.map((element, index) => (
              <button
                key={element.id}
                type="button"
                onClick={() => setSelectedId(element.id)}
                aria-pressed={selectedId === element.id}
                className={`flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${selectedId === element.id ? 'border-amber-600 bg-amber-50 dark:bg-amber-300/10' : 'border-border bg-background hover:bg-muted'}`}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${element.rights_privacy_status === 'passed' ? 'bg-emerald-600' : 'bg-red-600'}`}>{index + 1}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-foreground">{element.label}</span><span className="block text-[11px] capitalize text-muted-foreground">{element.category.replaceAll('_', ' ')} · {element.customer_facing ? 'customer-facing' : 'review-only'}</span></span>
                {element.evaluation_receipt && <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">{element.evaluation_receipt.overall.score == null ? 'Unscored' : `${element.evaluation_receipt.overall.score}/100`}</span>}
              </button>
            ))}
          </div>
          <div>{selected ? <SourceLineageDetail element={selected} number={manifest.elements.findIndex((element) => element.id === selected.id) + 1} onClose={() => setSelectedId(null)} /> : <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground"><ShieldCheck className="mr-2 h-4 w-4" /> Select a numbered region or trace-list item to inspect its proof.</div>}</div>
        </div>
      )}

      <details className="mt-4 rounded-lg border border-border bg-background p-3 text-xs">
        <summary className="cursor-pointer font-semibold text-foreground">Manifest identity and final output hashes</summary>
        <div className="mt-3 space-y-1 text-muted-foreground">
          <p className="break-all">Manifest: <span className="font-mono text-foreground">{manifest.manifest_id}</span></p>
          <p className="break-all">Hash: <span className="font-mono text-foreground">{manifest.manifest_hash}</span></p>
          {manifest.final_output_hashes.map((entry) => <p key={entry.label} className="break-all">{entry.label}: <span className="font-mono text-foreground">{entry.sha256}</span></p>)}
        </div>
      </details>
    </section>
  )
}
