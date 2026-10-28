'use client'

import Image from 'next/image'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, FileCheck2, LockKeyhole, Youtube } from 'lucide-react'
import type { ReviewSource, SocialCampaignReviewPacket } from '@/lib/social-campaign-review-assets'

function ReceiptList({ sources }: { sources: ReviewSource[] }) {
  if (!sources.length) return <p className="text-sm text-muted-foreground">No qualifying source is attached.</p>
  return (
    <div className="space-y-2">
      {sources.map((source) => (
        <div key={`${source.receipt}:${source.label}`} className="rounded-lg border border-border bg-background p-3">
          <Link href={source.href} className="text-sm font-semibold text-foreground underline decoration-radiant-gold/60 underline-offset-4">{source.label}</Link>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Supports: {source.supports}</p>
          <p className="text-xs leading-5 text-muted-foreground">Boundary: {source.limitation}</p>
          <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{source.receipt}</p>
        </div>
      ))}
    </div>
  )
}

export default function SocialCampaignReviewPacket({ packet }: { packet: SocialCampaignReviewPacket }) {
  if (packet.kind === 'linkedin_visual') {
    return (
      <section aria-label={`${packet.campaign} review-only visual packet`} className="rounded-xl border border-blue-500/30 bg-card p-4 text-card-foreground shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-200">LinkedIn visual review</p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">{packet.visual.headline}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{packet.practicalValue}</p>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-600/35 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-100">
            <FileCheck2 className="h-3.5 w-3.5" /> Source bound
          </span>
        </div>
        <Image src={packet.visual.publicPath} alt={packet.visual.alt} width={1200} height={1500} className="mt-4 aspect-[4/5] w-full rounded-lg border border-border bg-[#071426] object-contain" priority />
        <p className="mt-3 rounded-lg border border-border bg-muted/35 p-3 text-sm font-semibold text-foreground">{packet.visual.proofLine}</p>
        {packet.jit?.status === 'blocked_stale_jit' ? (
          <div role="status" className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm leading-6 text-foreground">
            <p className="font-semibold">JIT refresh required before a current content decision</p>
            <p>The approved source receipt expired on October 20, 2026. The October 22, 11:30 AM ET target remains review only until source lineage is refreshed and the proposed visual and copy are bound to a new decision.</p>
            <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">Persisted draft version: {packet.jit.contentVersion}</p>
          </div>
        ) : null}
        {packet.jit?.status === 'ready_current_jit' ? (
          <div role="status" className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm leading-6 text-foreground">
            <p className="font-semibold">Current JIT receipt bound</p>
            <p>The approved copy, source lineage, and provider-free visual are bound to this current review version. Human approval remains required before any later release gate.</p>
            <dl className="mt-2 grid gap-1 text-xs text-muted-foreground">
              <div><dt className="inline font-semibold text-foreground">Content version: </dt><dd className="inline break-all font-mono">{packet.jit.contentVersion}</dd></div>
              {packet.jit.receiptId ? <div><dt className="inline font-semibold text-foreground">Receipt: </dt><dd className="inline break-all font-mono">{packet.jit.receiptId}</dd></div> : null}
              <div><dt className="inline font-semibold text-foreground">Fresh through: </dt><dd className="inline">{new Date(packet.jit.expiresAt).toLocaleString()}</dd></div>
            </dl>
          </div>
        ) : null}
        <details className="mt-3 rounded-lg border border-border bg-background p-3">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">Trace every visible claim</summary>
          <div className="mt-3"><ReceiptList sources={packet.sources} /></div>
        </details>
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-slate-500/35 bg-slate-500/10 p-3 text-xs leading-5 text-muted-foreground">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" /> Review-only projection. Provider, upload, platform-draft, scheduling, publishing, credential, migration, production-write, and external-send gates remain closed.
        </p>
      </section>
    )
  }

  const blocked = packet.status === 'blocked_missing_description_evidence'
  const thumbnailEvidence = packet.thumbnailEvidence
  const thumbnailResearch = thumbnailEvidence?.thumbnail?.research_cohort
  const thumbnailDecision = thumbnailResearch?.decision_receipt
  const thumbnailScore = thumbnailEvidence?.thumbnail?.evaluation_receipt?.overall
  return (
    <section aria-label={`${packet.campaign} YouTube packaging packet`} className={`rounded-xl border p-4 text-card-foreground shadow-sm sm:p-5 ${blocked ? 'border-red-500/35 bg-red-500/5' : 'border-emerald-500/30 bg-card'}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] ${blocked ? 'text-red-700 dark:text-red-200' : 'text-emerald-700 dark:text-emerald-200'}`}><Youtube className="h-4 w-4" /> YouTube packaging review</p>
          <h2 className="mt-1 text-xl font-semibold text-foreground">{packet.title}</h2>
        </div>
        <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${blocked ? 'border-red-600/35 bg-red-500/10 text-red-800 dark:text-red-100' : 'border-emerald-600/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100'}`}>
          {blocked ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {blocked ? 'Final video blocked' : 'Approved pair reused'}
        </span>
      </div>

      <section aria-label="Applied script framework" className="mt-4 rounded-lg border border-border bg-background p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Applied script framework</h3>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${packet.scriptTemplate?.ready ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-200' : 'border-amber-500/40 text-amber-800 dark:text-amber-100'}`}>{packet.scriptTemplate?.ready ? 'Receipt ready' : 'Blocked'}</span>
        </div>
        {packet.scriptTemplate?.ready && packet.scriptTemplate.receipt ? (
          <>
            <p className="mt-2 text-sm text-foreground">{packet.scriptTemplate.receipt.template_name} <span className="font-mono text-xs text-muted-foreground">· {packet.scriptTemplate.receipt.library_version}</span></p>
            <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer font-semibold text-foreground">View template receipt and applied beats</summary>
              <dl className="mt-2 space-y-1 break-all"><div>Template ID: {packet.scriptTemplate.receipt.template_id}</div><div>Receipt: {packet.scriptTemplate.receipt.receipt_id}</div><div>Candidate: {packet.scriptTemplate.receipt.candidate_id}</div><div>Content version: {packet.scriptTemplate.receipt.content_version}</div><div>Applied beats: {packet.scriptTemplate.receipt.applied_beat_ids.join(', ')}</div><div>Applied rules: {packet.scriptTemplate.receipt.applied_rule_ids.join(', ')}</div><div>Sources: {packet.scriptTemplate.receipt.source_receipt_ids.join(', ')}</div><div>Source boundary: {packet.scriptTemplate.receipt.source_boundary}</div><div>Originality boundary: {packet.scriptTemplate.receipt.originality_boundary}</div><div>Evaluation: {packet.scriptTemplate.receipt.evaluation.receipt_id}</div><div>Fresh through: {packet.scriptTemplate.receipt.fresh_until}</div></dl>
            </details>
          </>
        ) : (
          <div role="status" className="mt-2 text-sm text-amber-900 dark:text-amber-100">
            <p className="font-semibold">{packet.scriptTemplate?.receipt ? 'Script template receipt blocked' : 'No script template recorded'}</p>
            <p className="mt-1 text-xs leading-5">The description cohort below supports description structure only. It does not establish a named script template.</p>
            {packet.scriptTemplate?.blockers.filter((reason) => reason !== 'No script template recorded').map((reason) => <p key={reason} className="mt-1 text-xs">{reason}</p>)}
            <Link href={`/admin/content/video-generation?social_content_id=${encodeURIComponent(packet.socialContentId)}&review=script-intelligence`} className="mt-2 inline-block rounded-md border border-amber-500/50 px-3 py-2 text-xs font-semibold underline underline-offset-2">Record and evaluate a current script template</Link>
          </div>
        )}
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Video title</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{packet.title}</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Complementary thumbnail teaser</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{packet.thumbnailTeaser}</p>
        </div>
      </div>
      {thumbnailEvidence ? (
        <section aria-label="YouTube thumbnail evidence gate" className={`mt-4 rounded-lg border p-3 ${thumbnailEvidence.ready ? 'border-emerald-500/35 bg-emerald-500/10' : 'border-red-500/40 bg-red-500/10'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Thumbnail evidence: {thumbnailEvidence.ready ? 'Ready' : 'Blocked'}</p>
            <span className="rounded-full border border-current/20 px-2 py-0.5 text-xs font-semibold">
              {thumbnailScore?.score == null ? 'Unscored' : `${thumbnailScore.score}/100`} · {packet.packagingTarget === 'youtube' ? '16:9 long-form' : '9:16 Shorts'}
            </span>
          </div>
          {thumbnailEvidence.ready && packet.thumbnailPath ? (
            <>
              <Image src={packet.thumbnailPath} alt={`Evidence-ready thumbnail reading ${packet.thumbnailTeaser}`} width={1280} height={720} className="mt-3 w-full rounded-lg border border-border bg-black object-contain" />
              <p className="mt-2 break-all rounded-md border border-border bg-background px-3 py-2 font-mono text-[10px] text-muted-foreground">
                Canonical thumbnail receipt: {packet.thumbnailReceipt}
              </p>
              <p className="mt-3 text-sm leading-6 text-foreground">Why selected: {thumbnailResearch?.candidate?.support_reason}</p>
              {thumbnailResearch?.composition ? (
                <section aria-label="YouTube thumbnail composition diversity" className="mt-3 rounded-lg border border-border bg-background p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">Composition decision</p>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${packet.thumbnailDiversity?.ready ? 'border-emerald-500/35 text-emerald-700 dark:text-emerald-200' : 'border-red-500/40 text-red-800 dark:text-red-100'}`}>
                      Batch diversity: {packet.thumbnailDiversity?.ready ? 'Distinct' : 'Blocked'}
                    </span>
                  </div>
                  <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <div><dt className="font-semibold text-foreground">Layout family</dt><dd className="mt-1 text-muted-foreground">{thumbnailResearch.composition.layout_family}</dd></div>
                    <div><dt className="font-semibold text-foreground">Dominant subject</dt><dd className="mt-1 text-muted-foreground">{thumbnailResearch.composition.dominant_subject}</dd></div>
                    <div><dt className="font-semibold text-foreground">Text placement</dt><dd className="mt-1 text-muted-foreground">{thumbnailResearch.composition.text_placement}</dd></div>
                    <div><dt className="font-semibold text-foreground">Batch identity</dt><dd className="mt-1 break-all font-mono text-muted-foreground">{thumbnailResearch.composition.batch_identity}</dd></div>
                  </dl>
                  <p className="mt-3 text-xs font-semibold text-foreground">Focal hierarchy</p>
                  <ol className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">{thumbnailResearch.composition.focal_hierarchy.map((item, index) => <li key={item} className="rounded-full border border-border px-2 py-1">{index + 1}. {item}</li>)}</ol>
                  {packet.thumbnailDiversity?.blockers.map((blocker) => <p key={blocker} className="mt-2 text-xs text-red-800 dark:text-red-100">{blocker}</p>)}
                </section>
              ) : null}
            </>
          ) : (
            <div className="mt-3 space-y-2">
              {thumbnailEvidence.blockers.map((blocker) => <p key={blocker} className="text-sm text-red-900 dark:text-red-100">{blocker}</p>)}
              {thumbnailEvidence.recoveryActions.map((action) => <p key={action} className="rounded-md border border-red-500/25 bg-background/70 p-2 text-xs text-muted-foreground">Recovery: {action}</p>)}
            </div>
          )}
          {thumbnailResearch ? (
            <details className="mt-3 rounded-lg border border-border bg-background p-3" open>
              <summary className="cursor-pointer text-sm font-semibold text-foreground">Cohort examples and selection boundaries</summary>
              {thumbnailDecision ? (
                <section aria-label="Thumbnail decision route" className="mt-3 rounded-lg border border-radiant-gold/30 bg-radiant-gold/5 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">Social Content decision route</p>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${thumbnailDecision.selection.status === 'ready' ? 'border-emerald-500/35 text-emerald-700 dark:text-emerald-200' : 'border-amber-500/35 text-amber-800 dark:text-amber-100'}`}>{thumbnailDecision.selection.status === 'ready' ? 'Receipt-backed Ready' : 'Unscored'}</span>
                  </div>
                  <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <div><dt className="font-semibold text-foreground">Candidate</dt><dd className="mt-1 break-all text-muted-foreground">{thumbnailDecision.candidate_identity.content_id}</dd></div>
                    <div><dt className="font-semibold text-foreground">Live cohort</dt><dd className="mt-1 break-all text-muted-foreground">{thumbnailDecision.live_evidence.cohort_id}</dd></div>
                    <div><dt className="font-semibold text-foreground">Threshold</dt><dd className="mt-1 text-muted-foreground">Normalized score ≥ {thumbnailDecision.live_evidence.outlier_threshold}</dd></div>
                    <div><dt className="font-semibold text-foreground">Selected composition</dt><dd className="mt-1 text-muted-foreground">{thumbnailDecision.selection.selected_composition}</dd></div>
                    <div><dt className="font-semibold text-foreground">Title ↔ thumbnail</dt><dd className="mt-1 text-muted-foreground">{thumbnailDecision.selection.title_thumbnail_relationship.replaceAll('_', ' ')}</dd></div>
                    <div><dt className="font-semibold text-foreground">Product proof</dt><dd className="mt-1 break-all text-muted-foreground">{thumbnailDecision.selection.product_proof_binding}</dd></div>
                    <div><dt className="font-semibold text-foreground">Input version</dt><dd className="mt-1 break-all font-mono text-muted-foreground">{thumbnailDecision.input_version}</dd></div>
                    <div><dt className="font-semibold text-foreground">Output version</dt><dd className="mt-1 break-all font-mono text-muted-foreground">{thumbnailDecision.output_version}</dd></div>
                  </dl>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">{thumbnailDecision.selection.rationale}</p>
                  <ul className="mt-3 grid gap-2 lg:grid-cols-2" aria-label="Live comparison decisions">
                    {thumbnailDecision.live_evidence.comparisons.map((comparison) => (
                      <li key={`${comparison.video_id}:${comparison.decision}`} className="rounded-md border border-border bg-background p-3 text-xs">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <Link href={comparison.source_url} target="_blank" rel="noreferrer" className="font-semibold text-foreground underline decoration-radiant-gold/60 underline-offset-4">{comparison.video_id}</Link>
                          <span className={`rounded-full border px-2 py-0.5 font-semibold ${comparison.outlier_qualified ? 'border-emerald-500/35 text-emerald-700 dark:text-emerald-200' : comparison.decision === 'excluded' ? 'border-amber-500/35 text-amber-800 dark:text-amber-100' : 'border-border text-muted-foreground'}`}>
                            {comparison.decision}{comparison.outlier_qualified ? ' · outlier qualified' : ''}
                          </span>
                        </div>
                        <p className="mt-2 font-semibold text-foreground">Normalized: {comparison.normalized_performance_score ?? 'Unscored'}</p>
                        <p className="mt-1 leading-5 text-muted-foreground">{comparison.decision_reason}</p>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 rounded-md border border-border bg-background p-2 text-xs leading-5 text-muted-foreground">Normalization: {thumbnailDecision.live_evidence.normalization_formula.join(' · ')}</p>
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold text-foreground">User-curated taste signals</p>
                    {thumbnailDecision.user_preference_signals.length ? thumbnailDecision.user_preference_signals.map((signal) => (
                      <div key={`${signal.source_url}:${signal.captured_at}`} className="rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
                        <Link href={signal.source_url} target="_blank" rel="noreferrer" className="font-semibold text-foreground underline decoration-radiant-gold/60 underline-offset-4">Saved playlist · {signal.item_identities.length} captured items</Link>
                        <p className="mt-1">Taste calibration only · performance weight {signal.performance_weight} · {signal.performance_status}</p>
                        <p className="mt-1">Applied: {signal.applied_traits.length ? signal.applied_traits.join(' · ') : 'No preference traits applied.'}</p>
                      </div>
                    )) : <p className="rounded-md border border-border bg-background p-2 text-xs text-muted-foreground">No user-curated preference signal contributed to this selection.</p>}
                  </div>
                </section>
              ) : null}
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {thumbnailResearch.samples.map((sample) => (
                  <article key={sample.video_id} className="rounded-lg border border-border bg-card p-2">
                    {sample.thumbnail_path ? <Image src={sample.thumbnail_path} alt={`Captured public thumbnail for ${sample.title}`} width={640} height={360} className="aspect-video w-full rounded-md border border-border object-cover" /> : null}
                    <Link href={sample.youtube_url} target="_blank" rel="noreferrer" className="mt-2 block text-xs font-semibold text-foreground underline decoration-radiant-gold/60 underline-offset-4">{sample.title}</Link>
                    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{sample.creator} · score {sample.normalized_performance_score ?? 'Unscored'} · channel {sample.channel_relative_ratio ?? 'Unscored'}×</p>
                    <p className="text-[11px] leading-5 text-muted-foreground">Thumbnail text: {sample.thumbnail_text.length ? sample.thumbnail_text.join(' / ') : 'Unreadable'}</p>
                  </article>
                ))}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-emerald-500/25 bg-emerald-500/5 p-3"><p className="text-xs font-semibold text-foreground">Adopted traits</p><ul className="mt-2 space-y-1 text-xs text-muted-foreground">{thumbnailResearch.adopted_traits.map((trait) => <li key={trait}>· {trait}</li>)}</ul></div>
                <div className="rounded-md border border-red-500/25 bg-red-500/5 p-3"><p className="text-xs font-semibold text-foreground">Rejected traits</p><ul className="mt-2 space-y-1 text-xs text-muted-foreground">{thumbnailResearch.rejected_traits.map((trait) => <li key={trait}>· {trait}</li>)}</ul></div>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">{thumbnailResearch.public_outlier_boundary}</p>
            </details>
          ) : null}
        </section>
      ) : packet.thumbnailPath ? (
        <div className="mt-4">
          <Image src={packet.thumbnailPath} alt={`Approved thumbnail reading ${packet.thumbnailTeaser}`} width={1280} height={720} className="w-full rounded-lg border border-border bg-black object-contain" />
          <p className="mt-2 break-all rounded-md border border-border bg-background px-3 py-2 font-mono text-[10px] text-muted-foreground">Canonical thumbnail receipt: {packet.thumbnailReceipt}</p>
        </div>
      ) : null}
      <div className="mt-3 rounded-lg border border-border bg-background p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Thumbnail concept</p>
        <p className="mt-1 text-sm leading-6 text-foreground">{packet.thumbnailConcept}</p>
      </div>
      <div className="mt-3 rounded-lg border border-border bg-background p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Opening hook</p>
        <p className="mt-1 text-sm leading-6 text-foreground">{packet.openingHook}</p>
      </div>

      <section aria-label="YouTube description evidence gate" className={`mt-3 rounded-lg border p-3 ${blocked ? 'border-red-500/40 bg-red-500/10' : 'border-emerald-500/35 bg-emerald-500/10'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Description evidence: {packet.descriptionEvidence.state === 'unscored' ? 'Unscored' : 'Ready'}</p>
          <span className="rounded-full border border-current/20 px-2 py-0.5 text-xs font-semibold">{packet.descriptionEvidence.qualified}/{packet.descriptionEvidence.required} qualifying descriptions</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{packet.descriptionEvidence.requirement}</p>
        {packet.descriptionEvidence.attribution.length ? <div className="mt-3"><ReceiptList sources={packet.descriptionEvidence.attribution} /></div> : (
          <p className="mt-3 rounded-md border border-red-500/30 bg-background/70 p-2 text-xs font-semibold text-red-800 dark:text-red-100">No qualifying description cohort is attached. Internal packet text cannot replace public, attributable evidence.</p>
        )}
      </section>

      <div className="mt-3 overflow-hidden rounded-lg border border-border bg-background">
        <div className="border-b border-border px-3 py-2 text-sm font-semibold text-foreground">Synchronized storyboard and product-proof map</div>
        <div className="divide-y divide-border">
          {packet.storyboard.map((beat) => (
            <div key={beat.time} className="grid gap-1 p-3 sm:grid-cols-[6rem_1fr_1fr] sm:gap-3">
              <p className="text-xs font-semibold text-radiant-gold">{beat.time}</p>
              <p className="text-sm text-foreground">{beat.beat}</p>
              <p className="text-xs leading-5 text-muted-foreground">Proof: {beat.proof}</p>
            </div>
          ))}
        </div>
      </div>

      <details className="mt-3 rounded-lg border border-border bg-background p-3" open>
        <summary className="cursor-pointer text-sm font-semibold text-foreground">Product proof and source boundaries</summary>
        <div className="mt-3"><ReceiptList sources={packet.productProof} /></div>
      </details>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conclusion</p><p className="mt-1 text-sm leading-6 text-foreground">{packet.conclusion}</p></div>
        <div className="rounded-lg border border-border bg-background p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Required spoken CTA</p><p className="mt-1 text-sm leading-6 text-foreground">{packet.spokenCta}</p></div>
      </div>
      <p className="mt-3 flex items-start gap-2 rounded-lg border border-slate-500/35 bg-slate-500/10 p-3 text-xs leading-5 text-muted-foreground"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" /> Review-only packaging. Final generation and every external execution gate remain closed.</p>
    </section>
  )
}
