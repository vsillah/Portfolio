'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AlertTriangle, CheckCircle2, FileCheck2, History, Loader2, LockKeyhole, Play, RotateCcw } from 'lucide-react'
import { getCurrentSession } from '@/lib/auth'
import type { CampaignPreparationCandidate, CampaignPreparationResult, CampaignReviewPackage } from '@/lib/social-campaign-package-preparation'
import type { CampaignLongFormBatch, CampaignLongFormDraftPacket, CampaignLongFormProjection } from '@/lib/social-campaign-long-form-batch'
import type { CampaignVisualBatch, CampaignVisualPlan, CampaignVisualProjection } from '@/lib/social-campaign-visual-plan'
import type { socialCampaignApprovedAdaptationQaProjection } from '@/lib/social-campaign-approved-adaptation-qa-fixture'

type CandidateProjection = { candidate: CampaignPreparationCandidate; evaluation: CampaignPreparationResult }
type Run = {
  id: string
  status: string
  subject_id: string
  subject_label: string
  current_step: string
  metadata: { package?: CampaignReviewPackage; long_form_batch?: CampaignLongFormBatch; visual_batch?: CampaignVisualBatch; attempt_number?: number; retry_count?: number; retry_limit?: number; maximum_attempts?: number }
  outcome?: Record<string, unknown>
  error_message?: string | null
  idempotency_key: string
  created_at: string
  updated_at: string
  completed_at?: string | null
}
type Payload = {
  candidates: CandidateProjection[]
  long_form_inventory: CampaignLongFormProjection[]
  visual_inventory: CampaignVisualProjection[]
  runs: Run[]
  retry_policy: { maximum_attempts_per_input_version: number; retry_limit: number; duplicate_records_allowed: false; source_change_requires_new_input_version: true }
  external_gates: Record<string, false>
  fixture: boolean
  integration_note: string | null
  approved_adaptation_review?: ReturnType<typeof socialCampaignApprovedAdaptationQaProjection> | null
}

type ApprovedAdaptationReview = ReturnType<typeof socialCampaignApprovedAdaptationQaProjection>
type InternalProductionReview = ApprovedAdaptationReview['internal_production_review']
type InternalProductionPacket = InternalProductionReview['packets'][number]

function DescriptionSources({ packet, review }: { packet: InternalProductionPacket; review: InternalProductionReview }) {
  return <details className="mt-2 rounded-md border border-border p-3">
    <summary className="cursor-pointer text-xs font-semibold text-foreground">Inspect description sources and numerical outlier logic</summary>
    <p className="mt-2 break-words text-[11px] leading-5 text-muted-foreground">{review.description_formula} Minimum score {review.minimum_outlier_score}. Full description text is represented by a stable fingerprint and structural observations; open each source to inspect its public wording.</p>
    <div className="mt-3 space-y-2 xl:hidden">
      {packet.description_cohort.sources.map((source) => <article key={source.source_id} className="rounded-md border border-border p-3 text-[11px] leading-5">
        <a href={source.url} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline dark:text-blue-200">{source.title}</a>
        <p className="text-muted-foreground">{source.creator} · {source.published_at.slice(0, 10)}</p>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
          <div><dt className="font-semibold text-foreground">Views</dt><dd>{source.view_count_at_observation.toLocaleString()}</dd></div>
          <div><dt className="font-semibold text-foreground">Score</dt><dd>{source.normalized_performance_score.toFixed(2)}</dd></div>
          <div><dt className="font-semibold text-foreground">Baseline</dt><dd>{source.channel_baseline_median_views.toLocaleString()} ({source.channel_baseline_sample_size})</dd></div>
          <div><dt className="font-semibold text-foreground">Description</dt><dd>{source.qualified ? 'Qualified' : source.exclusion_reason?.replaceAll('_', ' ')}</dd></div>
        </dl>
        <p className="mt-1 text-muted-foreground">{source.description_characters} chars · {source.description_paragraphs} paragraphs</p>
      </article>)}
    </div>
    <div className="mt-3 hidden overflow-x-auto xl:block"><table className="w-full min-w-[660px] text-left text-[11px]"><thead><tr className="border-b border-border"><th className="p-2">Source</th><th className="p-2">Observed views</th><th className="p-2">Baseline</th><th className="p-2">Score</th><th className="p-2">Description</th></tr></thead><tbody>{packet.description_cohort.sources.map((source) => <tr key={source.source_id} className="border-b border-border/60 align-top"><td className="p-2"><a href={source.url} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline dark:text-blue-200">{source.title}</a><span className="block text-muted-foreground">{source.creator} · {source.published_at.slice(0, 10)}</span></td><td className="p-2">{source.view_count_at_observation.toLocaleString()}</td><td className="p-2">{source.channel_baseline_median_views.toLocaleString()} ({source.channel_baseline_sample_size})</td><td className="p-2">{source.normalized_performance_score.toFixed(2)}</td><td className="p-2">{source.qualified ? 'Qualified' : source.exclusion_reason?.replaceAll('_', ' ')}<span className="mt-1 block text-muted-foreground">{source.description_characters} chars · {source.description_paragraphs} paragraphs</span></td></tr>)}</tbody></table></div>
  </details>
}

function sceneTime(value: number) {
  const minutes = Math.floor(value / 60)
  const seconds = Math.round((value % 60) * 10) / 10
  return `${minutes}:${seconds.toFixed(seconds % 1 ? 1 : 0).padStart(seconds < 10 ? 2 : 1, '0')}`
}

type PrimaryThumbnailReview = ApprovedAdaptationReview['primary_thumbnail_reviews'][number]
type ThumbnailReviewAsset = PrimaryThumbnailReview['assets'][number]

function ThumbnailCandidateComparison({ productLabel, assets }: { productLabel: string; assets: ThumbnailReviewAsset[] }) {
  return <div className="mt-3 grid gap-3 md:grid-cols-2" aria-label={`${productLabel} thumbnail candidate comparison`}>
    {assets.map((asset, index) => <article key={asset.asset_id} className={`overflow-hidden rounded-lg border bg-background ${asset.selection_status === 'selected' ? 'border-emerald-500/60 ring-1 ring-emerald-500/20' : asset.selection_status === 'rejected' ? 'border-red-500/50' : 'border-amber-500/40'}`}>
      <div className="relative aspect-video bg-slate-950"><Image src={`${asset.public_path}?v=${asset.sha256.slice(7, 19)}`} alt={`${productLabel} review-only YouTube thumbnail reading ${asset.teaser}`} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" /></div>
      <div className="p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-foreground">{asset.direction ? `Candidate ${String.fromCharCode(65 + index)} · ${asset.direction}` : asset.title}</p><span className="rounded-full bg-violet-500/10 px-2 py-1 text-[10px] font-semibold text-violet-800 dark:text-violet-100">{asset.width}×{asset.height}</span></div>
        {asset.selection_status === 'selected' ? <div className="mt-2 rounded border border-emerald-500/35 bg-emerald-500/10 px-2 py-1.5"><p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-100">Selected · sole final output</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{asset.selection_reason}</p></div> : null}
        {asset.selection_status === 'rejected' ? <div className="mt-2 rounded border border-red-500/35 bg-red-500/10 px-2 py-1.5"><p className="text-[10px] font-bold uppercase tracking-wide text-red-800 dark:text-red-100">Rejected · ineligible for output</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{asset.rejection_reason}</p></div> : null}
        {asset.selection_status === 'pending_human_qa' ? <div className="mt-2 rounded border border-amber-500/35 bg-amber-500/10 px-2 py-1.5"><p className="text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:text-amber-100">Human QA pending · output ineligible</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{asset.selection_reason}</p></div> : null}
        {asset.fixture_label ? <p className="mt-2 rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-[10px] font-semibold text-amber-900 dark:text-amber-100">{asset.fixture_label}</p> : null}
        <p className="mt-1 text-xs text-muted-foreground">Thumbnail: {asset.teaser} · {asset.provider === 'none' ? 'provider none' : 'new image generation'}</p>
        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">Dominant focal point: {asset.focal_subject} AmaduTown shield uses its natural portrait ratio.</p>
        {asset.composition_intent ? <p className="mt-1 text-[10px] leading-4 text-muted-foreground"><strong className="text-foreground">Integrated scene:</strong> {asset.composition_intent}</p> : null}
        {asset.feed_preview_path ? <div className="mt-3 flex items-center gap-3 rounded-md border border-border bg-muted/20 p-2"><div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded bg-slate-950"><Image src={`${asset.feed_preview_path}?v=${asset.feed_preview_sha256?.slice(7, 19) ?? asset.sha256.slice(7, 19)}`} alt={`${asset.teaser} actual-feed-size preview`} fill sizes="128px" className="object-cover" /></div><p className="text-[10px] leading-4 text-muted-foreground"><strong className="block text-foreground">Actual feed size · 320×180</strong>Text remains readable and clear of the hero’s face.</p></div> : null}
        {asset.evidence_trace?.length ? <details className="mt-3 rounded-md border border-border p-2"><summary className="cursor-pointer text-[11px] font-semibold text-foreground">Inspect live-evidence creative decisions</summary><ul className="mt-2 space-y-2">{asset.evidence_trace.map((trace) => <li key={trace.decision_dimension} className="text-[10px] leading-4 text-muted-foreground"><strong className="capitalize text-foreground">{trace.decision_dimension.replaceAll('_', ' ')}:</strong> {trace.rationale}<span className="mt-1 block break-all font-mono text-[9px]">{trace.live_evidence_video_ids.join(' · ')}</span></li>)}</ul></details> : null}
        <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">{asset.asset_id} · {asset.sha256}</p>
      </div>
    </article>)}
  </div>
}

function PrimaryThumbnailReviewDetails({ reviews }: { reviews: ApprovedAdaptationReview['primary_thumbnail_reviews'] }) {
  const selectionsRecorded = reviews.every((review) => review.status === 'ready')
  return <section className={`rounded-lg border p-4 ${selectionsRecorded ? 'border-emerald-500/35 bg-emerald-500/5' : 'border-amber-500/35 bg-amber-500/5'}`} data-testid="primary-thumbnail-reviews" aria-label="Dark Castle Chess and AI Audit Calculator primary thumbnail Human QA">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-base font-semibold text-foreground">Primary campaign hero thumbnails</h3><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">Four exact outputs from four successful, bounded generation jobs. Each campaign preserves one Human-QA-selected final output and one rejected, ineligible alternative.</p></div>
      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${selectionsRecorded ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100' : 'border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-100'}`}>{selectionsRecorded ? '2 campaigns · selections recorded' : '2 campaigns · selection pending'}</span>
    </div>
    <p className="mt-3 rounded-md border border-border bg-background p-2 text-[11px] leading-5 text-muted-foreground"><strong className="text-foreground">Generation boundary:</strong> 4 provider calls · 4 successful jobs · 0 retries · 0 uncertain results · observed separate charge $0. Combined hard ceiling remained strictly below $9. Upload, platform draft, scheduling, publishing, deployment, merge, credentials, migrations, and external sends remain closed.</p>
    <div className="mt-4 space-y-4">
      {reviews.map((review) => {
        const selectionRecorded = review.status === 'ready'
        return <article key={review.campaign_identity} className="rounded-lg border border-border bg-background p-3" data-campaign={review.campaign_identity}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-sm font-semibold text-foreground">{review.product_label} · Human QA choice</h4><p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">Calendar {review.calendar_item_id} · {review.receipt_id}</p></div><span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${selectionRecorded ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100' : 'border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-100'}`}>{selectionRecorded ? 'Human QA selected' : 'Human QA selection pending'}</span></div>
        <ThumbnailCandidateComparison productLabel={review.product_label} assets={review.assets} />
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-border p-3"><h5 className="text-xs font-semibold text-foreground">Product proof</h5><div className="relative mt-2 aspect-video overflow-hidden rounded border border-border bg-slate-950"><Image src={review.hero_evidence.product_proof.public_path} alt={`${review.product_label} owned product proof`} fill sizes="(max-width: 1024px) 100vw, 33vw" className="object-cover" /></div><p className="mt-2 text-[10px] leading-4 text-muted-foreground">{review.hero_evidence.product_proof.role}</p></div>
          <div className="rounded-lg border border-border p-3"><h5 className="text-xs font-semibold text-foreground">Current live topic evidence</h5><p className="mt-2 text-[11px] leading-4 text-muted-foreground">{review.hero_evidence.outlier_evidence.included_video_ids.length} attributable comparisons · {review.hero_evidence.outlier_evidence.qualified_outlier_video_ids.length} qualified outlier{review.hero_evidence.outlier_evidence.qualified_outlier_video_ids.length === 1 ? '' : 's'}.</p><p className="mt-2 text-[10px] leading-4 text-muted-foreground">Observed {review.hero_evidence.outlier_evidence.observed_at}<br />Fresh until {review.hero_evidence.outlier_evidence.fresh_until}</p><details className="mt-2 rounded border border-border p-2"><summary className="cursor-pointer text-[10px] font-semibold text-foreground">Inspect evidence IDs</summary><p className="mt-2 break-all font-mono text-[9px] leading-4 text-muted-foreground">{review.hero_evidence.outlier_evidence.included_video_ids.join(' · ')}</p></details><p className="mt-2 text-[10px] leading-4 text-muted-foreground">Curated playlist: taste calibration only · performance weight 0.</p></div>
          <div className={`rounded-lg border p-3 ${selectionRecorded ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}><h5 className="text-xs font-semibold text-foreground">{selectionRecorded ? 'Decision receipt' : 'Decision gate'}</h5><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{review.selection_decision.decision_logic}</p>{review.blockers.map((blocker) => <p key={blocker} className="mt-2 text-[10px] leading-4 text-amber-900 dark:text-amber-100">{blocker}</p>)}<Link href={`/admin/social-content/${review.calendar_item_id}?step=copy&qa_fixture=social_campaign_review_assets_v1`} className="mt-3 inline-flex text-[10px] font-semibold text-blue-700 underline dark:text-blue-200">Open exact Social Content item</Link>{review.recovery_actions.map((action) => <Link key={action.label} href={action.href} className="ml-3 mt-3 inline-flex text-[10px] font-semibold text-blue-700 underline dark:text-blue-200">{action.label}</Link>)}</div>
        </div>
      </article>})}
    </div>
  </section>
}

function InternalProductionReviewDetails({ review }: { review: InternalProductionReview }) {
  return <section className="rounded-lg border border-border bg-background p-4" aria-label="Approved YouTube campaign internal production review" data-testid="internal-production-review">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-base font-semibold text-foreground">Long-form scripts and production cues</h3><p className="mt-1 text-xs text-muted-foreground">Two version-bound campaign drafts. Description evidence remains a separate fail-closed gate.</p></div>
      <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-900 dark:text-amber-100">Internal review only · no provider actions</span>
    </div>
    <div className="mt-4 space-y-4">
      {review.packets.map((packet) => <article key={packet.campaign_identity} className="min-w-0 overflow-hidden rounded-lg border border-border p-3" data-campaign-production={packet.campaign_identity}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h4 className="text-sm font-semibold text-foreground">{packet.title}</h4><p className="mt-1 text-xs text-muted-foreground">Thumbnail: {packet.thumbnail_teaser} · {packet.script_word_count} words · {packet.expected_duration_seconds / 60} minute cue sheet</p></div><span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-900 dark:text-amber-100">{packet.evaluation.description_status === 'ready' ? 'Description ready' : `Description Unscored · ${packet.evaluation.qualified_description_count}/${packet.evaluation.required_description_count}`}</span></div>
        <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">Calendar {packet.calendar_item_id} · Social Content {packet.social_content_id} · version {packet.content_version}</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          <div className="relative aspect-video overflow-hidden rounded-md bg-slate-950"><Image src={packet.selected_thumbnail_path} alt={`Selected Candidate A thumbnail for ${packet.campaign_identity} reading ${packet.thumbnail_teaser}`} fill sizes="280px" className="object-cover" /></div>
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs leading-5"><strong className="text-foreground">Candidate A only</strong><p className="mt-1 break-all text-muted-foreground">{packet.selected_thumbnail_id} · {packet.selection_receipt_id}</p><p className="mt-2 text-muted-foreground">Candidate B remains rejected: {packet.rejected_thumbnail_id}. {packet.rejection_reason}.</p><p className="mt-2 text-muted-foreground">The video title explains the subject. The thumbnail teaser adds a separate question or tension.</p></div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3"><div className="rounded border border-border p-2 text-xs"><strong className="text-foreground">Outlier description cohort</strong><p className="mt-1 text-muted-foreground">{packet.description_cohort.included_sample_size} topic videos · {packet.evaluation.qualified_description_count} qualifying full description{packet.evaluation.qualified_description_count === 1 ? '' : 's'} · {packet.evaluation.required_description_count} required</p></div><div className="rounded border border-border p-2 text-xs"><strong className="text-foreground">Public observation</strong><p className="mt-1 text-muted-foreground">{packet.description_cohort.observed_at}<br />Fresh through {packet.description_cohort.fresh_until}</p></div><div className="rounded border border-border p-2 text-xs"><strong className="text-foreground">Proof and rights</strong><p className="mt-1 text-muted-foreground">{packet.rights_privacy}</p></div></div>
        <details className="mt-2 rounded border border-border p-2"><summary className="cursor-pointer text-[11px] font-semibold text-foreground">Inspect retention and proof timing</summary><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{packet.retention_plan.first_30_seconds}</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Re-hooks {packet.retention_plan.re_hook_seconds.join('s · ')}s · product proof {packet.retention_plan.proof_placement_seconds.join('s · ')}s · payoff {packet.retention_plan.payoff_seconds}s · conclusion {packet.retention_plan.spoken_conclusion_seconds}s · CTA {packet.retention_plan.spoken_cta_seconds}s</p></details>
        {packet.evaluation.blockers.map((blocker) => <p key={blocker} className="mt-2 rounded border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-900 dark:text-amber-100">{blocker}</p>)}
        <details className="mt-3 rounded-md border border-border p-3"><summary className="cursor-pointer text-xs font-semibold text-foreground">Read the full spoken script and scene cue sheet</summary><ol className="mt-3 space-y-4">{packet.scenes.map((scene) => <li key={scene.scene_id} className="rounded-md border border-border bg-muted/10 p-3"><div className="flex flex-wrap justify-between gap-2"><strong className="text-xs text-foreground">{scene.label}</strong><span className="font-mono text-[10px] text-muted-foreground">{scene.start_seconds}s–{scene.end_seconds}s · {scene.word_count} words</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{scene.narration}</p><details className="mt-3 rounded border border-border p-2"><summary className="cursor-pointer text-[11px] font-semibold text-foreground">Shot, proof and edit cues</summary><div className="mt-2 space-y-1 text-[11px] leading-5 text-muted-foreground"><p><strong className="text-foreground">Shot:</strong> {scene.shot_framing} · {scene.camera_angle}</p><p><strong className="text-foreground">Camera:</strong> {scene.camera_movement}</p><p><strong className="text-foreground">Presenter:</strong> {scene.presenter_staging}</p><p><strong className="text-foreground">B-roll:</strong> {scene.b_roll_cue}</p><p><strong className="text-foreground">Interrupt:</strong> {scene.pattern_interrupt}</p><p><strong className="text-foreground">Transition:</strong> {scene.transition}</p><p><strong className="text-foreground">Continuity:</strong> {scene.continuity}</p><p><strong className="text-foreground">Audio:</strong> {scene.audio_cue}</p><p><strong className="text-foreground">Asset timing:</strong> {scene.asset_timing.lead_in_seconds}s–{scene.asset_timing.lead_out_seconds}s · {scene.asset_timing.proof_hold_seconds}s proof hold</p><p className="break-all"><strong className="text-foreground">Lead visual:</strong> <a href={scene.visual_asset} target="_blank" rel="noreferrer" className="text-blue-700 underline dark:text-blue-200">{scene.visual_asset}</a> · {scene.visual_role}</p><p className="break-all"><strong className="text-foreground">Product proof:</strong> <a href={scene.proof_href} target="_blank" rel="noreferrer" className="text-blue-700 underline dark:text-blue-200">{scene.proof_asset_id}</a> · {scene.source_receipt_id}</p><p className="break-all"><strong className="text-foreground">Cleared by:</strong> {scene.privacy_receipt_id} · {scene.rights_receipt_id}</p></div></details></li>)}</ol></details>
        <DescriptionSources packet={packet} review={review} />
      </article>)}
    </div>
  </section>
}

function ApprovedAdaptationReviewDetails({ review }: { review: ApprovedAdaptationReview }) {
  return (
    <div className="mt-4 space-y-4" data-testid="approved-adaptation-review">
      <PrimaryThumbnailReviewDetails reviews={review.primary_thumbnail_reviews} />
      <InternalProductionReviewDetails review={review.internal_production_review} />
      {review.adaptations.map((adaptation) => (
        <article key={adaptation.adaptation_id} className="rounded-lg border border-border bg-background p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="text-base font-semibold text-foreground">{adaptation.product_label} · YouTube storyboard</h3><p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">Calendar {adaptation.calendar_item_id} · Social Content {adaptation.social_content_id}</p></div>
            <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:text-amber-100">{adaptation.status === 'source_ready_capture_pending' ? 'Source ready · Human QA pending' : 'Human QA re-review required'}</span>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">{adaptation.binding_note}</p>
          <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] leading-5 text-muted-foreground"><strong className="text-foreground">Timing and audio boundary:</strong> {adaptation.timing_audio_note}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <p className="break-all rounded-md border border-border p-2 text-[11px] text-muted-foreground"><strong className="block text-foreground">Current Social Content version</strong>{adaptation.current_content_version}</p>
            <p className="break-all rounded-md border border-border p-2 text-[11px] text-muted-foreground"><strong className="block text-foreground">Approved adaptation input</strong>{adaptation.source_input_version} · {adaptation.adaptation_id}</p>
          </div>
          <section className="mt-4 rounded-lg border border-violet-500/30 bg-violet-500/5 p-3" aria-label={`${adaptation.product_label} review-only asset and storyboard review`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h4 className="text-sm font-semibold text-foreground">Hero-led thumbnail candidates and complete storyboard</h4><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{adaptation.storyboard_review.value_summary}</p></div>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${adaptation.storyboard_review.status === 'ready_for_human_review' ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100' : 'border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-100'}`}>{adaptation.storyboard_review.status === 'ready_for_human_review' ? 'Ready for Human QA' : 'Review direction · blocked'}</span>
            </div>

            {adaptation.storyboard_review.campaign_identity === 'jev'
              ? <ThumbnailCandidateComparison productLabel={adaptation.product_label} assets={adaptation.storyboard_review.assets} />
              : <p className="mt-3 rounded-md border border-border bg-background p-2 text-[11px] leading-5 text-muted-foreground">The exact Dark Castle candidate comparison appears in the primary campaign review above. This section keeps the source-bound storyboard and evidence gates visible without duplicating the review images.</p>}

            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <div className="rounded-lg border border-border bg-background p-3"><h5 className="text-xs font-semibold text-foreground">Exact identity binding</h5><dl className="mt-2 space-y-2 text-[11px] leading-4 text-muted-foreground"><div><dt className="font-semibold text-foreground">Campaign · channel</dt><dd>{adaptation.storyboard_review.campaign_identity} · {adaptation.storyboard_review.channel}</dd></div><div><dt className="font-semibold text-foreground">Calendar · Social Content</dt><dd className="break-all font-mono text-[10px]">{adaptation.storyboard_review.calendar_item_id} · {adaptation.storyboard_review.social_content_id}</dd></div><div><dt className="font-semibold text-foreground">Content · script input</dt><dd className="break-all font-mono text-[10px]">{adaptation.storyboard_review.content_version}<br />{adaptation.storyboard_review.script_input_version}</dd></div><div><dt className="font-semibold text-foreground">Asset receipt</dt><dd className="break-all font-mono text-[10px]">{adaptation.storyboard_review.asset_receipt_id}</dd></div></dl></div>
              {adaptation.storyboard_review.hero_evidence ? <>
                <div className="rounded-lg border border-border bg-background p-3"><h5 className="text-xs font-semibold text-foreground">Hero earns attention · product proof substantiates</h5><div className="relative mt-2 aspect-video overflow-hidden rounded border border-border bg-slate-950"><Image src={adaptation.storyboard_review.hero_evidence.product_proof.public_path} alt={`${adaptation.product_label} product proof kept separate from the thumbnail hero`} fill sizes="(max-width: 1024px) 100vw, 33vw" className="object-cover" /></div><p className="mt-2 text-[10px] leading-4 text-muted-foreground">{adaptation.storyboard_review.hero_evidence.product_proof.role}</p></div>
                <div className="rounded-lg border border-border bg-background p-3"><h5 className="text-xs font-semibold text-foreground">Current topic evidence</h5><p className="mt-2 text-[11px] leading-4 text-muted-foreground">{adaptation.storyboard_review.hero_evidence.outlier_evidence.included_video_ids.length} attributable long-form comparisons · {adaptation.storyboard_review.hero_evidence.outlier_evidence.qualified_outlier_video_ids.length} qualified outlier.</p><p className="mt-2 text-[10px] leading-4 text-muted-foreground">Observed {adaptation.storyboard_review.hero_evidence.outlier_evidence.observed_at}<br />Fresh until {adaptation.storyboard_review.hero_evidence.outlier_evidence.fresh_until}</p><p className="mt-2 text-[10px] leading-4 text-muted-foreground">Curated playlist: taste calibration only · performance weight 0.</p><details className="mt-2 rounded border border-border p-2"><summary className="cursor-pointer text-[10px] font-semibold text-foreground">Hero provenance</summary>{adaptation.storyboard_review.hero_evidence.hero_assets.map((hero) => <p key={hero.asset_id} className="mt-2 text-[10px] leading-4 text-muted-foreground"><strong className="text-foreground">{hero.asset_id}</strong><br />{hero.provenance_note}</p>)}</details></div>
              </> : <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 lg:col-span-2"><h5 className="text-xs font-semibold text-foreground">Campaign-specific hero missing</h5><p className="mt-2 text-[11px] leading-4 text-muted-foreground">This storyboard remains visible, but its thumbnail direction cannot advance without current hero, provenance, crop, rights, privacy, and live outlier evidence.</p></div>}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5" aria-label={`${adaptation.product_label} evidence gates`}>
              {adaptation.storyboard_review.evidence_gates.map((gate) => <article key={gate.key} className={`rounded-md border p-2 ${gate.status === 'passed' ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}><div className="flex items-center justify-between gap-2"><h5 className="text-[11px] font-semibold text-foreground">{gate.label}</h5><span className={`text-[10px] font-semibold uppercase tracking-wide ${gate.status === 'passed' ? 'text-emerald-700 dark:text-emerald-200' : 'text-amber-800 dark:text-amber-100'}`}>{gate.status}</span></div><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{gate.detail}</p>{gate.status !== 'passed' ? <Link href={gate.recovery_href} className="mt-2 inline-flex text-[10px] font-semibold text-blue-700 underline dark:text-blue-200">{gate.recovery_label}</Link> : null}</article>)}
            </div>

            {(['youtube_long_form', 'youtube_shorts'] as const).map((target) => {
              const scenes = adaptation.storyboard_review.scenes.filter((scene) => scene.target === target)
              if (!scenes.length) return null
              return <details key={target} open className="mt-3 rounded-lg border border-border bg-background p-3"><summary className="cursor-pointer text-sm font-semibold text-foreground">{target === 'youtube_long_form' ? 'YouTube long-form' : 'YouTube Shorts'} scene board · {scenes.length} scenes · {sceneTime(scenes.at(-1)?.end_seconds ?? 0)}</summary><ol className="mt-3 space-y-3">{scenes.map((scene) => <li key={scene.scene_id} className="rounded-lg border border-border bg-muted/10 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><h5 className="text-xs font-semibold text-foreground">{scene.scene_id} · {scene.shot.type}</h5><span className="font-mono text-[10px] text-muted-foreground">{sceneTime(scene.start_seconds)}-{sceneTime(scene.end_seconds)} · {scene.duration_seconds}s</span></div><p className="mt-2 text-xs leading-5 text-foreground"><strong>Spoken beat:</strong> {scene.spoken_beat}</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground"><strong className="text-foreground">Customer-facing copy:</strong> {scene.customer_facing_copy.join(' · ')}</p><div className="mt-2 grid gap-2 lg:grid-cols-[180px_minmax(0,1fr)]">{scene.proof[0] ? <div className="relative aspect-video overflow-hidden rounded border border-border bg-slate-950"><Image src={scene.proof[0].href} alt={`${scene.proof[0].label} product proof`} fill sizes="180px" className="object-cover" /></div> : <div className="flex aspect-video items-center justify-center rounded border border-amber-500/30 bg-amber-500/5 px-2 text-center text-[10px] text-muted-foreground">Product proof missing</div>}<div className="text-[10px] leading-4 text-muted-foreground"><p><strong className="text-foreground">Shot / framing:</strong> {scene.shot.framing} · {scene.shot.camera_angle}</p><p><strong className="text-foreground">Camera:</strong> {scene.shot.camera_movement}</p><p><strong className="text-foreground">Avatar / environment:</strong> {scene.avatar_environment_direction}</p><p><strong className="text-foreground">Asset animation:</strong> {scene.asset_animation}</p><p><strong className="text-foreground">Transition:</strong> {scene.transition}</p></div></div><p className="mt-2 text-[10px] leading-4 text-muted-foreground"><strong className="text-foreground">Continuity:</strong> {scene.continuity.join(' ')}</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground"><strong className="text-foreground">B-roll:</strong> {scene.b_roll_cue}</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground"><strong className="text-foreground">Music / ducking:</strong> {scene.music_ducking_note}</p>{scene.asset_reuse_rationale ? <p className="mt-1 text-[10px] leading-4 text-muted-foreground"><strong className="text-foreground">Asset reuse:</strong> {scene.asset_reuse_rationale}</p> : null}{scene.cta_delivery.required ? <p className="mt-2 rounded border border-emerald-500/25 bg-emerald-500/5 p-2 text-[11px] leading-5 text-foreground"><strong>Spoken conclusion and CTA:</strong> {scene.cta_delivery.spoken_line}</p> : null}<p className="mt-2 break-all font-mono text-[9px] leading-4 text-muted-foreground">Campaign {scene.proof_source_binding.campaign_identity} · content {scene.proof_source_binding.content_version} · script {scene.proof_source_binding.script_input_version} · approved scene {scene.proof_source_binding.approved_scene_id} · claims {scene.proof_source_binding.claim_ids.join(', ')} · receipts {scene.proof_source_binding.source_receipt_ids.join(', ')}</p></li>)}</ol></details>
            })}
          </section>
          <section className="mt-4" aria-label={`${adaptation.product_label} distinct title options`}>
            <h4 className="text-sm font-semibold text-foreground">Distinct title options · thumbnail promise kept separate</h4>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">{adaptation.title_options.map((option) => <div key={option.title} className="rounded-md border border-border p-3"><p className="text-xs font-semibold text-foreground">{option.title}</p><p className="mt-1 text-xs text-muted-foreground">Thumbnail promise: {option.promise}</p></div>)}</div>
          </section>
          <section className="mt-4" aria-label={`${adaptation.product_label} format scripts`}>
            <h4 className="text-sm font-semibold text-foreground">Format-specific spoken scripts</h4>
            <div className="mt-2 grid gap-2 lg:grid-cols-2">{adaptation.formats.map((format) => <details key={format.target} className="rounded-md border border-border p-3"><summary className="cursor-pointer text-xs font-semibold text-foreground">{format.target === 'youtube_long_form' ? 'YouTube long form' : 'YouTube Shorts'} · {format.target === 'youtube_shorts' ? `${format.target_duration_seconds}s target` : `${Math.round(format.target_duration_seconds / 60 * 10) / 10} min target`}</summary><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-foreground">{format.full_spoken_script}</p><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{format.adaptation_rationale}</p></details>)}</div>
          </section>
          <details className="mt-4 rounded-md border border-border p-3">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">Source-plan provenance</summary>
            <div className="mt-2 grid gap-2 lg:grid-cols-2">{adaptation.scenes.map((scene) => <article key={scene.scene_id} className="rounded-md border border-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><h5 className="text-xs font-semibold text-foreground">{scene.scene_id} · {scene.target === 'youtube_long_form' ? 'Long form' : 'Shorts'}</h5><span className="text-[10px] text-muted-foreground">{scene.purpose}</span></div><p className="mt-2 text-xs leading-5 text-foreground">{scene.narration}</p><p className="mt-2 text-[11px] text-muted-foreground">On-screen text: {scene.on_screen_text.join(' · ')}</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Motion: {scene.motion_direction}</p>{scene.shots.map((shot) => <div key={shot.shot_id} className="mt-2 rounded border border-violet-500/20 bg-violet-500/5 p-2 text-[10px] leading-4 text-muted-foreground"><strong className="text-foreground">{adaptation.evidence_assets.find((asset) => asset.asset_id === shot.artifact_id)?.label ?? shot.artifact_id}</strong> · {shot.framing} {shot.action}<span className="mt-1 block break-all">Asset reference: {adaptation.evidence_assets.find((asset) => asset.asset_id === shot.artifact_id)?.reference}</span><span className="mt-1 block">Receipt: {shot.source_receipt_ids.join(', ')} · {shot.privacy_boundary}</span></div>)}</article>)}</div>
          </details>
          <details className="mt-4 rounded-md border border-border p-3"><summary className="cursor-pointer text-xs font-semibold text-foreground">Source, rights, privacy, and quality receipts</summary><div className="mt-2 grid gap-2 sm:grid-cols-2">{adaptation.receipts.map((receipt) => <p key={receipt.kind} className="break-all rounded border border-border p-2 text-[10px] text-muted-foreground"><strong className="text-foreground">{receipt.kind} · {receipt.status}</strong><br />{receipt.receipt_id}<br />{receipt.input_version}</p>)}</div><p className="mt-2 text-[10px] text-muted-foreground">Source packet readiness: {adaptation.source_readiness.ready ? 'passed' : 'blocked'} · {adaptation.source_readiness.blockers.join(' ') || 'all required source receipts passed'}</p></details>
        </article>
      ))}
      <section className="rounded-lg border border-amber-500/35 bg-amber-500/5 p-4" aria-label="Blocked upcoming items">
        <h3 className="text-sm font-semibold text-foreground">Blocked upcoming items · exact recovery</h3>
        <div className="mt-2 grid gap-2 lg:grid-cols-3">{review.blocked_items.map((item) => <article key={item.calendar_item_id} className="rounded-md border border-border bg-background p-3"><h4 className="text-xs font-semibold text-foreground">{item.label} · Blocked</h4><p className="mt-2 text-xs leading-5 text-muted-foreground">{item.reason}</p><p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">Calendar {item.calendar_item_id}</p><Link href={item.recovery_href} className="mt-2 inline-flex text-xs font-semibold text-blue-700 underline dark:text-blue-200">{item.recovery_label}</Link></article>)}</div>
      </section>
      <p className="rounded-lg border border-slate-500/35 bg-slate-500/5 p-3 text-xs leading-5 text-muted-foreground">Human QA status: primary thumbnail selections recorded. Other source-adaptation review remains pending. Provider generation, rendering, upload, platform drafts, scheduling, publishing, sends, credentials, spending, migrations, deployment, and merge remain closed.</p>
    </div>
  )
}

function VisualPlanDetails({ plan, projection }: { plan: CampaignVisualPlan; projection: CampaignVisualProjection }) {
  const linkedin = plan.beats.filter((beat) => beat.channel === 'linkedin')
  const thumbnail = plan.thumbnails[0]
  const timed = plan.beats.filter((beat) => beat.channel === 'youtube_long_form' || beat.channel === 'short_form')

  return (
    <article className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 md:col-span-2" data-testid="visual-plan-details">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><h4 className="text-sm font-semibold text-foreground">{plan.product_label} · channel-native visual plan</h4><p className="mt-1 text-xs text-muted-foreground">Bound to {plan.script_packet_id} and content version {plan.content_version}</p></div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${projection.ready ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100' : 'border-slate-500/35 bg-slate-500/10 text-foreground'}`}>{projection.ready ? `Score ${projection.evaluation.overall_score}/100` : `Typography ${projection.evaluation.status === 'unscored' ? 'Unscored' : 'blocked'} · review direction only`}</span>
      </div>

      <section aria-label="Clean customer-facing asset view" className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="relative aspect-[4/5] bg-gradient-to-br from-amber-100 via-white to-sky-100 dark:from-amber-950 dark:via-slate-950 dark:to-sky-950">
            {linkedin[0]?.asset_href ? <Image src={linkedin[0].asset_href} alt={`${plan.product_label} owned gameplay evidence, original capture`} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-contain p-4" /> : null}
          </div>
          <div className="p-3"><p className="text-xs font-semibold text-foreground">Owned product evidence · original capture</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Product pixels are shown without added interface, metrics, labels, or results.</p></div>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-background">
          <div className="relative aspect-video bg-gradient-to-br from-cyan-950 via-slate-950 to-violet-950">
            {thumbnail?.href ? <Image src={thumbnail.href} alt={`${plan.product_label} YouTube thumbnail review direction: ${thumbnail.teaser}`} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" /> : null}
          </div>
          <div className="p-3"><p className="text-xs font-semibold text-foreground">YouTube thumbnail · review direction, not approval-ready</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{thumbnail?.title}</p><p className="mt-1 text-[11px] text-muted-foreground">{thumbnail?.composition}</p><p className="mt-2 text-[11px] leading-5 text-muted-foreground"><strong className="text-foreground">Provisional type treatment:</strong> {thumbnail?.typography.type_system} {thumbnail?.typography.depth_treatment}</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground"><strong className="text-foreground">Text safe area:</strong> {thumbnail?.typography.text_safe_area}</p></div>
        </div>
      </section>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5" aria-label="Visual evaluation dimensions">
        {projection.evaluation.dimensions.map((item) => <div key={item.key} className="rounded-md border border-border bg-background p-2"><div className="flex items-start justify-between gap-2"><strong className="text-[11px] leading-4 text-foreground">{item.label}</strong><span className={`text-xs font-bold ${item.status === 'passed' ? 'text-emerald-700 dark:text-emerald-200' : item.status === 'blocked' ? 'text-amber-800 dark:text-amber-100' : 'text-muted-foreground'}`}>{item.score ?? 'Unscored'}</span></div><p className="mt-1 text-[10px] leading-4 text-muted-foreground">Observed {item.calculation.observed ?? 'Unscored'} / {item.calculation.required ?? 'Unscored'} required {item.calculation.unit}</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{item.calculation.formula}</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{item.explanation}</p></div>)}
      </div>

      <details className="mt-3 rounded-md border border-border bg-background p-3">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">Show field-level source trace and visual decisions</summary>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div><h5 className="text-xs font-semibold text-foreground">Exact source deep links</h5><ul className="mt-2 space-y-2">{plan.exact_sources.map((source) => <li key={source.source_id} className="rounded border border-border p-2 text-xs leading-5"><a href={source.href} className="font-semibold text-blue-700 underline dark:text-blue-200">{source.label}</a><p className="text-muted-foreground">{pretty(source.kind)} · {source.privacy_boundary}</p><p className="break-all font-mono text-[10px] text-muted-foreground">{source.source_id}</p></li>)}</ul></div>
          <div><h5 className="text-xs font-semibold text-foreground">Benchmark logic</h5><p className="mt-2 text-xs leading-5 text-muted-foreground">Playlist similarity {plan.benchmark_logic.playlist_similarity.status === 'scored' ? `${plan.benchmark_logic.playlist_similarity.score}/100` : 'Unscored'} · taste only, zero performance weight.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{plan.benchmark_logic.playlist_similarity.formula}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Live topic score {plan.benchmark_logic.live_topic_score} observed / {plan.benchmark_logic.live_topic_threshold} required · receipt {plan.benchmark_logic.live_topic_outlier_receipt_id}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{plan.benchmark_logic.explanation}</p><h5 className="mt-4 text-xs font-semibold text-foreground">Rejected alternatives</h5><ul className="mt-2 space-y-2">{plan.rejected_alternatives.map((entry) => <li key={entry.alternative} className="rounded border border-border p-2 text-xs leading-5"><strong className="text-foreground">{entry.alternative}</strong><p className="text-muted-foreground">{entry.reason}</p><p className="text-muted-foreground"><strong>Recovery:</strong> {entry.recovery_action}</p></li>)}</ul></div>
        </div>
        <h5 className="mt-4 text-xs font-semibold text-foreground">Script-to-visual storyboard timing</h5>
        <ol className="mt-2 space-y-2">{timed.map((beat) => <li key={beat.beat_id} className="rounded border border-border p-2 text-xs leading-5">
          <div className="flex flex-wrap justify-between gap-2"><strong className="text-foreground">{pretty(beat.channel)} · {beat.copy_section_id}</strong><span className="font-mono text-[10px] text-muted-foreground">{beat.start_seconds}s-{beat.end_seconds}s</span></div>
          <p className="mt-1 text-foreground">{beat.intended_takeaway}</p>
          <p className="mt-1 text-muted-foreground"><strong>Narration:</strong> {beat.copy_excerpt}</p>
          {beat.customer_facing_copy ? <p className="mt-1 text-muted-foreground"><strong>On-screen copy:</strong> {beat.customer_facing_copy}</p> : null}
          <p className="mt-1 text-muted-foreground"><strong>Layout / presenter:</strong> {beat.layout} {beat.presenter_placement}</p>
          <p className="mt-1 break-all text-muted-foreground"><strong>Owned asset:</strong> <a href={beat.asset_href} className="text-blue-700 underline dark:text-blue-200">{beat.asset_href}</a></p>
          <p className="mt-1 text-muted-foreground"><strong>Motion:</strong> {beat.motion} <strong>Transition:</strong> {beat.transition}</p>
          {beat.product_broll_timing ? <p className="mt-1 text-muted-foreground"><strong>Product B-roll / screenshot:</strong> {beat.product_broll_timing.start_seconds}s–{beat.product_broll_timing.end_seconds}s · {beat.product_broll_timing.cue}</p> : <p className="mt-1 text-muted-foreground"><strong>Product B-roll:</strong> none in this scene</p>}
          <p className="mt-1 text-muted-foreground"><strong>Music / ducking:</strong> {beat.music_ducking_cue}</p>
          {beat.spoken_conclusion_or_cta ? <p className="mt-1 rounded bg-emerald-500/10 p-2 text-foreground"><strong>Spoken close / CTA:</strong> {beat.spoken_conclusion_or_cta}</p> : null}
          {beat.storyboard_traceability ? <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">Script {beat.storyboard_traceability.approved_script_segment_id} · source receipts {beat.storyboard_traceability.source_receipt_ids.join(' · ')} · product proof {beat.storyboard_traceability.product_proof_receipt_id} · title/thumbnail {beat.storyboard_traceability.title_thumbnail_receipt_id} · audience {beat.storyboard_traceability.audience_research_receipt_id} ({beat.storyboard_traceability.audience_source_urls.join(' · ')}) · outlier {beat.storyboard_traceability.audience_outlier_receipt_id} · privacy {beat.storyboard_traceability.privacy_receipt_id} · originality {beat.storyboard_traceability.originality_receipt_id} · title: {beat.storyboard_traceability.video_title} · teaser: {beat.storyboard_traceability.thumbnail_teaser}</p> : null}
          {beat.cinematography ? <div className="mt-2 rounded border border-violet-500/25 bg-violet-500/5 p-2 text-muted-foreground"><p><strong className="text-foreground">Shot:</strong> {beat.cinematography.shot_type} · {beat.cinematography.framing} · {beat.cinematography.camera_angle}</p><p><strong className="text-foreground">Camera:</strong> {beat.cinematography.camera_movement} over {beat.cinematography.camera_movement_duration_seconds}s of a {beat.cinematography.shot_duration_seconds}s scene</p><p><strong className="text-foreground">Environment / subject:</strong> {beat.cinematography.environment} {beat.cinematography.subject_position}</p><p><strong className="text-foreground">Product choreography:</strong> {beat.cinematography.product_broll_choreography}</p><p><strong className="text-foreground">Entrance / exit:</strong> {beat.cinematography.entrance_composition} {beat.cinematography.exit_composition}</p><p><strong className="text-foreground">Transition rationale:</strong> {beat.cinematography.transition_rationale}</p><p><strong className="text-foreground">Continuity:</strong> {beat.cinematography.continuity_constraints.join(' ')}</p><p><strong className="text-foreground">Pattern interrupt:</strong> {beat.cinematography.pattern_interrupt_intent}</p></div> : null}
          <div className="mt-2 rounded border border-amber-500/25 bg-amber-500/5 p-2 text-muted-foreground"><p><strong className="text-foreground">Typography:</strong> {beat.typography.type_system} {beat.typography.scale_hierarchy}</p><p><strong className="text-foreground">Treatment:</strong> {beat.typography.color_contrast} {beat.typography.depth_treatment} {beat.typography.shape_interaction}</p><p><strong className="text-foreground">Placement / safe area:</strong> {beat.typography.composition_placement} {beat.typography.text_safe_area}</p><p><strong className="text-foreground">Rationale:</strong> {beat.typography.compositing_rationale}</p></div>
          <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">Sources: {beat.source_ids.join(' · ')}</p>
        </li>)}</ol>
      </details>

      {plan.typography_style_receipt ? <details className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3" open={projection.evaluation.status === 'unscored'}>
        <summary className="cursor-pointer text-sm font-semibold text-foreground">Typography evidence · {plan.typography_style_receipt.deterministic_verdict}</summary>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">Captured {plan.typography_style_receipt.captured_at} · expires {plan.typography_style_receipt.expires_at} · {plan.typography_style_receipt.channel} · {plan.typography_style_receipt.audience}</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{plan.typography_style_receipt.selection_logic}</p>
        <ul className="mt-2 space-y-2">{plan.typography_style_receipt.comparables.map((item) => <li key={item.comparable_id} className="rounded border border-border bg-background p-2 text-xs leading-5"><a href={item.source_url} className="font-semibold text-blue-700 underline dark:text-blue-200">{item.channel}: {item.title}</a><p className="break-all font-mono text-[10px] text-muted-foreground">{item.thumbnail_url}</p><p className="text-muted-foreground">Published {item.published_at} · captured {item.captured_at} · age {item.age_days_at_capture} days · {item.views_at_capture.toLocaleString()} views · {item.likes_display_at_capture}</p><p className="text-muted-foreground"><strong className="text-foreground">Audience fit:</strong> {item.audience_fit}</p><p className="break-all text-muted-foreground"><strong className="text-foreground">Audience sources:</strong> {item.audience_source_urls.map((href, index) => <a key={href} href={href} className="ml-1 text-blue-700 underline dark:text-blue-200">{index + 1}</a>)}</p><p className="text-muted-foreground"><strong className="text-foreground">Topic fit:</strong> {item.topic_fit}</p><p className="text-muted-foreground"><strong className="text-foreground">Observed type:</strong> {item.observed_type_traits.join(' ')}</p><p className="text-muted-foreground"><strong className="text-foreground">Feed-size behavior:</strong> {item.feed_size_behavior}</p></li>)}</ul>
        <div className="mt-3 rounded border border-amber-500/30 bg-background p-2 text-xs leading-5">
          <p className="font-semibold text-foreground">Typography performance: {plan.typography_style_receipt.performance_evidence.status === 'scored' ? 'scored matched-style cohort' : 'Unscored'} · {plan.typography_style_receipt.comparables.filter((item) => item.performance_weight === 0).length} context-only comparables (weight 0)</p>
          <p className="text-muted-foreground">{plan.typography_style_receipt.performance_evidence.limitation}</p>
          <p className="mt-1 text-muted-foreground">Approval requires at least {plan.typography_style_receipt.performance_evidence.required_sample_size} matched-style examples at performance weight 1 and a scored cohort normalized to at least {plan.typography_style_receipt.performance_evidence.normalized_threshold}× the same-channel baseline. Matched-style sample: {plan.typography_style_receipt.performance_evidence.matched_style_sample_size} observed. Normalized cohort result: {plan.typography_style_receipt.performance_evidence.observed_normalized_performance ?? 'not available'}.</p>
          <p className="mt-1 text-muted-foreground">Baseline rule: {plan.typography_style_receipt.performance_evidence.baseline_method}</p>
          <p className="mt-1 font-semibold text-foreground">{plan.typography_style_receipt.performance_evidence.public_research_audit.conclusion}</p>
          <p className="mt-1 text-muted-foreground"><strong className="text-foreground">Recovery / experiment hypothesis:</strong> {plan.typography_style_receipt.recovery_action}</p>
          <h5 className="mt-2 font-semibold text-foreground">Rejected styles</h5>
          <ul className="list-disc pl-5">{plan.typography_style_receipt.rejected_styles.map((item) => <li key={item.style}><strong>{item.style}:</strong> {item.reason}</li>)}</ul>
        </div>
        <details className="mt-2 rounded border border-border bg-background p-2">
          <summary className="cursor-pointer text-xs font-semibold text-foreground">Expanded public channel scan · {plan.typography_style_receipt.performance_evidence.public_research_audit.channels_screened.length} channels · {plan.typography_style_receipt.performance_evidence.public_research_audit.nearest_candidates.length} exact candidate videos</summary>
          <ul className="mt-2 space-y-2 text-xs leading-5 text-muted-foreground">
            {plan.typography_style_receipt.performance_evidence.public_research_audit.channels_screened.map((item) => <li key={item.channel_url} className="rounded border border-border p-2"><a href={item.channel_url} className="font-semibold text-blue-700 underline dark:text-blue-200">{item.channel}</a> · {item.topic_domain} · {item.current_feed_size} · {item.sample_size} sampled{item.eligible_baseline_count != null ? ` · baseline ${item.eligible_baseline_count} eligible; 30-day median ${item.baseline_30_day_median_views?.toLocaleString()} views` : ''}<p><strong className="text-foreground">Baseline:</strong> {item.baseline_disposition}</p><p>{item.exact_search_exhaustion}</p></li>)}
          </ul>
          <ul className="mt-2 space-y-2 text-xs leading-5 text-muted-foreground">
            {plan.typography_style_receipt.performance_evidence.public_research_audit.nearest_candidates.map((item) => <li key={item.source_url} className="rounded border border-border p-2"><a href={item.source_url} className="font-semibold text-blue-700 underline dark:text-blue-200">{item.channel}: {item.title}</a> · {item.published_at} · captured {item.captured_at} · age {item.age_days_at_capture ?? 'n/a'} days · {item.duration_seconds}s · {item.views_at_capture.toLocaleString()} views · promo: {item.promotion_status}<p><a href={item.thumbnail_url} className="underline">Exact thumbnail</a> · {item.observed_thumbnail_type}</p><p>{item.exclusion_reason}</p></li>)}
          </ul>
        </details>
      </details> : null}
    </article>
  )
}

const BLOCKED_VISUAL_PAGE_SIZE = 4

function BlockedVisualBacklog({ entries }: { entries: CampaignVisualProjection[] }) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const normalizedQuery = query.trim().toLowerCase()
  const filtered = useMemo(() => entries.filter((entry) => !normalizedQuery || [
    entry.product_label,
    entry.campaign_identity,
    ...entry.evaluation.blockers.flatMap((item) => [item.code, item.message, item.recovery_label]),
  ].some((value) => value.toLowerCase().includes(normalizedQuery))), [entries, normalizedQuery])
  const pageCount = Math.max(1, Math.ceil(filtered.length / BLOCKED_VISUAL_PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * BLOCKED_VISUAL_PAGE_SIZE, currentPage * BLOCKED_VISUAL_PAGE_SIZE)
  const groups = visible.reduce<Map<string, CampaignVisualProjection[]>>((result, entry) => {
    const key = entry.evaluation.blockers[0]?.code || 'prerequisite_unscored'
    result.set(key, [...(result.get(key) ?? []), entry])
    return result
  }, new Map())

  useEffect(() => { setPage(1) }, [normalizedQuery])
  useEffect(() => { if (page > pageCount) setPage(pageCount) }, [page, pageCount])

  return (
    <section aria-label="Blocked visual candidates" className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <label className="min-w-0 flex-1 text-xs font-semibold text-foreground">Search blocked visual candidates<input aria-label="Search blocked visual candidates" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Product, blocker, or recovery" className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-radiant-gold" /></label>
        <p className="text-xs text-muted-foreground">{filtered.length} match{filtered.length === 1 ? '' : 'es'} · four per page</p>
      </div>
      {!visible.length ? <p className="mt-3 rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">No blocked candidates match this search.</p> : <div className="mt-3 space-y-3">{[...groups.entries()].map(([code, group]) => <section key={code} aria-label={`${pretty(code)} blocked group`} className="rounded-md border border-border bg-background p-2"><h5 className="text-xs font-semibold text-foreground">{pretty(code)} · {group.length} on this page</h5><div className="mt-2 space-y-2">{group.map((entry) => {
        const primary = entry.evaluation.blockers[0]
        return <div key={entry.candidate_id} className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-semibold text-foreground">{entry.product_label} · {entry.state === 'unscored' ? 'Unscored' : 'Blocked'}</p><p className="mt-1 text-xs text-muted-foreground">{entry.evaluation.blockers.length} blocker{entry.evaluation.blockers.length === 1 ? '' : 's'} · numerical scoring withheld</p></div>{primary ? <Link href={primary.recovery_href} className="w-fit text-xs font-semibold text-blue-700 underline dark:text-blue-200">{primary.recovery_label}</Link> : null}</div><details className="mt-2 rounded border border-border bg-background p-2"><summary className="cursor-pointer text-xs font-semibold text-foreground">View {entry.evaluation.blockers.length} exact blocker{entry.evaluation.blockers.length === 1 ? '' : 's'}</summary><ul className="mt-2 space-y-2">{entry.evaluation.blockers.map((item) => <li key={item.code} className="text-xs leading-5 text-muted-foreground"><p><span className="font-mono text-[10px] text-foreground">{item.code}</span> · {item.message}</p><Link href={item.recovery_href} className="font-semibold text-blue-700 underline dark:text-blue-200">{item.recovery_label}</Link></li>)}</ul></details></div>
      })}</div></section>)}</div>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Page {currentPage} of {pageCount}</p><div className="flex gap-2"><button type="button" aria-label="Previous blocked page" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1} className="admin-console-button-secondary disabled:cursor-not-allowed disabled:opacity-50">Previous</button><button type="button" aria-label="Next blocked page" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={currentPage >= pageCount} className="admin-console-button-secondary disabled:cursor-not-allowed disabled:opacity-50">Next</button></div></div>
    </section>
  )
}

function pretty(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function LongFormPacketDetails({ packet }: { packet: CampaignLongFormDraftPacket }) {
  const contract = packet.evaluation_receipt.script_contract

  return (
    <details className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 md:col-span-2">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">{packet.title}</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <p className="rounded-md border border-border bg-background p-2 text-xs text-muted-foreground"><strong className="block text-foreground">Contract</strong>{Math.round(contract.duration_seconds / 60)} min · {contract.word_count} words</p>
        <p className="rounded-md border border-border bg-background p-2 text-xs text-muted-foreground"><strong className="block text-foreground">Delivery</strong>{contract.minimum_word_count}-{contract.maximum_word_count} words · {contract.delivery_words_per_minute} WPM</p>
        <p className="rounded-md border border-border bg-background p-2 text-xs text-muted-foreground"><strong className="block text-foreground">Evaluation</strong>Score {packet.evaluation_receipt.overall_score ?? 'Unscored'} · {packet.evaluation_receipt.dimensions.length} dimensions</p>
        <p className="rounded-md border border-border bg-background p-2 text-xs text-muted-foreground"><strong className="block text-foreground">Evidence gates</strong>Topic {packet.evaluation_receipt.topic_evidence.status} · originality {packet.evaluation_receipt.originality.status}</p>
      </div>
      <ul className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-3" aria-label="Passed long-form dimensions">
        {packet.evaluation_receipt.dimensions.map((dimension) => <li key={dimension.key} className="text-[11px] text-muted-foreground"><CheckCircle2 className="mr-1 inline h-3 w-3 text-emerald-600" />{dimension.label}</li>)}
      </ul>
      <div className="mt-4">
        <h4 className="text-sm font-semibold text-foreground">Full chaptered script</h4>
        <p className="mt-1 text-xs text-muted-foreground">Every spoken beat, owned-evidence cue, and framework change remains inspectable before approval.</p>
        <ol className="mt-3 space-y-3" aria-label="Full chaptered long-form script">
          {packet.beats.map((beat) => (
            <li key={beat.id} className="rounded-md border border-border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h5 className="text-xs font-semibold text-foreground">{pretty(beat.chapter_id ?? beat.role)} · {pretty(beat.role)}</h5>
                <span className="font-mono text-[10px] text-muted-foreground">{beat.start_seconds}s-{beat.end_seconds}s · {beat.id}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{beat.text}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">B-roll:</strong> {beat.broll_cue}</p>
              {beat.pattern_interrupt ? <p className="mt-1 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Pattern interrupt:</strong> {beat.pattern_interrupt}</p> : null}
              {(beat.framework_applications ?? []).length ? <ul className="mt-2 space-y-1" aria-label={`Framework changes for ${beat.id}`}>{beat.framework_applications?.map((application) => <li key={`${application.rule_id}-${application.change}`} className="rounded border border-violet-500/20 bg-violet-500/5 p-2 text-[11px] leading-5 text-muted-foreground"><strong className="text-foreground">{application.source_creators.join(' + ')}:</strong> {application.change}</li>)}</ul> : null}
              {beat.primary_cta ? <p className="mt-2 text-xs leading-5 text-emerald-800 dark:text-emerald-100"><strong>Primary CTA:</strong> {beat.primary_cta.action} · <a href={beat.primary_cta.destination_url} target="_blank" rel="noreferrer" className="underline">{beat.primary_cta.destination_label}</a></p> : null}
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-3 break-all font-mono text-[10px] text-muted-foreground">{packet.packet_id}</p>
    </details>
  )
}

export default function SocialCampaignPackagePreparation({ qaFixture, reviewOnly = false }: { qaFixture?: string; reviewOnly?: boolean }) {
  const [data, setData] = useState<Payload | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [busy, setBusy] = useState(false)
  const [batchBusy, setBatchBusy] = useState(false)
  const [visualBatchBusy, setVisualBatchBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const fixtureQuery = qaFixture ? `?qa_fixture=${encodeURIComponent(qaFixture)}` : ''

  const load = useCallback(async () => {
    setError('')
    try {
      const session = await getCurrentSession()
      if (!session) throw new Error('Sign in with an authorized Portfolio staff account.')
      const response = await fetch(`/api/admin/social-content/campaign-packages${fixtureQuery}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Campaign preparation is unavailable.')
      const normalized = {
        ...payload,
        candidates: Array.isArray(payload.candidates) ? payload.candidates : [],
        long_form_inventory: Array.isArray(payload.long_form_inventory) ? payload.long_form_inventory : [],
        visual_inventory: Array.isArray(payload.visual_inventory) ? payload.visual_inventory : [],
        runs: Array.isArray(payload.runs) ? payload.runs : [],
        external_gates: payload.external_gates && typeof payload.external_gates === 'object' ? payload.external_gates : {},
        retry_policy: payload.retry_policy ?? { maximum_attempts_per_input_version: 2, retry_limit: 1, duplicate_records_allowed: false, source_change_requires_new_input_version: true },
      } as Payload
      setData(normalized)
      setSelectedId((current) => current || normalized.candidates[0]?.candidate.candidate_id || '')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Campaign preparation is unavailable.')
    }
  }, [fixtureQuery])

  useEffect(() => { void load() }, [load])
  const selected = useMemo(() => data?.candidates.find((entry) => entry.candidate.candidate_id === selectedId) ?? null, [data, selectedId])
  const packageRuns = useMemo(() => (data?.runs ?? []).filter((run) => run.subject_id === selectedId), [data, selectedId])
  const latestPackage = packageRuns.find((run) => run.metadata?.package)?.metadata.package ?? null
  const longFormRuns = useMemo(() => (data?.runs ?? []).filter((run) => run.metadata?.long_form_batch), [data])
  const latestLongFormBatch = longFormRuns[0]?.metadata.long_form_batch ?? null
  const visualRuns = useMemo(() => (data?.runs ?? []).filter((run) => run.metadata?.visual_batch), [data])
  const latestVisualBatch = visualRuns[0]?.metadata.visual_batch ?? null

  const prepare = async () => {
    if (!selected) return
    setBusy(true); setError(''); setNotice('')
    try {
      const session = await getCurrentSession()
      if (!session) throw new Error('Sign in with an authorized Portfolio staff account.')
      const response = await fetch(`/api/admin/social-content/campaign-packages${fixtureQuery}`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate_id: selected.candidate.candidate_id }) })
      const payload = await response.json()
      if (!response.ok) {
        if (payload.evaluation) setData((current) => current ? { ...current, candidates: current.candidates.map((entry) => entry.candidate.candidate_id === selectedId ? { ...entry, evaluation: payload.evaluation } : entry) } : current)
        throw new Error(payload.error || 'Candidate remains blocked.')
      }
      setData((current) => current ? { ...current, runs: [payload.run, ...current.runs.filter((run) => run.id !== payload.run.id)] } : current)
      setNotice(payload.duplicate ? 'The existing receipt was returned. No duplicate record was created.' : 'Review package prepared. Approval and advancement remain in the canonical Decision Queue.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Preparation failed. Refresh before a bounded retry.')
    } finally { setBusy(false) }
  }

  const prepareLongFormBatch = async () => {
    setBatchBusy(true); setError(''); setNotice('')
    try {
      const session = await getCurrentSession()
      if (!session) throw new Error('Sign in with an authorized Portfolio staff account.')
      const response = await fetch(`/api/admin/social-content/campaign-packages${fixtureQuery}`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'prepare_long_form_batch' }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Long-form batch preparation failed.')
      setData((current) => current ? { ...current, runs: [payload.run, ...current.runs.filter((run) => run.id !== payload.run.id)] } : current)
      const batch = payload.run?.metadata?.long_form_batch as CampaignLongFormBatch | undefined
      setNotice(payload.duplicate
        ? 'The existing long-form batch receipt was returned. No duplicate drafts were created.'
        : `${batch?.prepared_count ?? 0} long-form script${batch?.prepared_count === 1 ? '' : 's'} prepared for human review; ${batch?.blocked_count ?? 0} blocked; ${batch?.remaining ?? 0} remaining.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Long-form batch preparation failed. Refresh before a bounded retry.')
    } finally { setBatchBusy(false) }
  }

  const prepareVisualBatch = async () => {
    setVisualBatchBusy(true); setError(''); setNotice('')
    try {
      const session = await getCurrentSession()
      if (!session) throw new Error('Sign in with an authorized Portfolio staff account.')
      const response = await fetch(`/api/admin/social-content/campaign-packages${fixtureQuery}`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'prepare_visual_batch' }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Visual batch preparation failed.')
      setData((current) => current ? { ...current, runs: [payload.run, ...current.runs.filter((run) => run.id !== payload.run.id)] } : current)
      const batch = payload.run?.metadata?.visual_batch as CampaignVisualBatch | undefined
      setNotice(payload.duplicate
        ? 'The existing visual batch receipt was returned. No duplicate plan was created.'
        : `${batch?.prepared_count ?? 0} visual plan${batch?.prepared_count === 1 ? '' : 's'} prepared for human review; ${batch?.blocked_count ?? 0} blocked; ${batch?.remaining ?? 0} remaining.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Visual batch preparation failed. Refresh before a bounded retry.')
    } finally { setVisualBatchBusy(false) }
  }

  if (!data && !error) return <section aria-label="Campaign package preparation" className="admin-console-card rounded-xl border p-5"><p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading eligible campaigns…</p></section>

  if (reviewOnly) return (
    <section aria-label="Campaign package preparation" className="admin-console-card rounded-xl border p-4 sm:p-5" data-testid="campaign-package-preparation">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="admin-console-eyebrow mb-2">Social Content · approved-source projection</div><h2 className="text-xl font-semibold text-foreground">Upcoming YouTube campaign review</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Two locally resolved adaptation packets, exact content bindings, and fail-closed recovery for {data?.approved_adaptation_review?.blocked_items.length ?? 0} blocked items. This route is read-only; it prepares no new drafts or external work.</p></div><span className="inline-flex items-center gap-2 rounded-full border border-slate-500/35 bg-slate-500/10 px-3 py-1 text-xs font-semibold text-foreground"><LockKeyhole className="h-3.5 w-3.5" /> External gates closed</span></div>
      {data?.integration_note ? <p className="mt-3 rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 text-xs leading-5 text-muted-foreground">{data.integration_note}</p> : null}
      {error ? <div role="alert" className="mt-3 rounded-lg border border-red-500/35 bg-red-500/10 p-3 text-sm text-red-800 dark:text-red-100">{error} <button type="button" onClick={() => void load()} className="ml-1 underline">Refresh</button></div> : null}
      {data?.approved_adaptation_review ? <ApprovedAdaptationReviewDetails review={data.approved_adaptation_review} /> : null}
    </section>
  )

  return (
    <section aria-label="Campaign package preparation" className="admin-console-card rounded-xl border p-4 sm:p-5" data-testid="campaign-package-preparation">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="admin-console-eyebrow mb-2">Social Content · review-only preparation</div>
          <h2 className="text-xl font-semibold text-foreground">Prepare a complete campaign package</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Select an evidence-backed candidate, resolve exact blockers, then prepare LinkedIn and YouTube assets with durable receipts. Only the canonical Decision Queue can approve or advance the result.</p>
        </div>
        <div className="flex flex-col items-start gap-2 lg:items-end"><span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-500/35 bg-slate-500/10 px-3 py-1 text-xs font-semibold text-foreground"><LockKeyhole className="h-3.5 w-3.5" /> External gates closed</span><div className="flex flex-wrap gap-2 lg:justify-end"><button type="button" onClick={() => void prepareLongFormBatch()} disabled={batchBusy || !(data?.long_form_inventory.length)} className="admin-console-button-primary disabled:cursor-not-allowed disabled:opacity-50">{batchBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{batchBusy ? 'Preparing batch…' : longFormRuns.length ? 'Return existing script batch' : 'Prepare eligible long-form scripts'}</button><button type="button" onClick={() => void prepareVisualBatch()} disabled={visualBatchBusy || !(data?.visual_inventory.length)} className="admin-console-button-primary disabled:cursor-not-allowed disabled:opacity-50">{visualBatchBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{visualBatchBusy ? 'Preparing visuals…' : visualRuns.length ? 'Return existing visual batch' : 'Prepare eligible visual plans'}</button></div></div>
      </div>
      {data?.integration_note ? <p className="mt-3 rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 text-xs leading-5 text-muted-foreground">{data.integration_note}</p> : null}
      {error ? <div role="alert" className="mt-3 rounded-lg border border-red-500/35 bg-red-500/10 p-3 text-sm text-red-800 dark:text-red-100">{error} <button type="button" onClick={() => void load()} className="ml-1 underline">Refresh</button></div> : null}
      {notice ? <p role="status" className="mt-3 rounded-lg border border-emerald-500/35 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-100">{notice}</p> : null}

      <section aria-label="Long-form script batch review" className="mt-4 rounded-lg border border-border bg-background p-3" data-testid="long-form-script-batch">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold text-foreground">Long-form Script Intelligence batch</h3><p className="mt-1 text-xs text-muted-foreground">{data?.long_form_inventory.length ?? 0} total · {data?.long_form_inventory.filter((entry) => entry.ready).length ?? 0} ready · {data?.long_form_inventory.filter((entry) => !entry.ready).length ?? 0} blocked · processed in deterministic chunks of 10</p></div><span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-foreground">Review only</span></div>
        {!latestLongFormBatch ? <p className="mt-3 text-xs leading-5 text-muted-foreground">Long-form draft scripts remain sealed until the bounded batch action validates current source, product proof, live topic evidence, originality, privacy, title/thumbnail distinction, and canonical framework receipts.</p> : <div className="mt-3 space-y-3">
          <p className="text-xs font-semibold text-foreground">{latestLongFormBatch.total} total · {latestLongFormBatch.scanned} scanned · {latestLongFormBatch.prepared_count} prepared · {latestLongFormBatch.blocked_count} blocked · {latestLongFormBatch.deferred_count} deferred · {latestLongFormBatch.remaining} remaining · {latestLongFormBatch.chunks_processed} chunks</p>
          <div className="grid gap-2 md:grid-cols-2">{latestLongFormBatch.prepared.map((packet) => <LongFormPacketDetails key={packet.packet_id} packet={packet} />)}</div>
          {latestLongFormBatch.blocked.length ? <div className="space-y-2">{latestLongFormBatch.blocked.map((entry) => <div key={entry.candidate_id} className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3"><p className="text-sm font-semibold text-foreground">{entry.product_label} · Blocked</p>{entry.blockers.slice(0, 3).map((item) => <p key={item.code} className="mt-1 text-xs leading-5 text-muted-foreground">{item.message} <Link href={item.recovery_href} className="font-semibold text-blue-700 underline dark:text-blue-200">{item.recovery_label}</Link></p>)}</div>)}</div> : null}
        </div>}
      </section>

      <section aria-label="Visual plan batch review" className="mt-4 rounded-lg border border-border bg-background p-3" data-testid="visual-plan-batch">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold text-foreground">Evidence-backed visual management batch</h3><p className="mt-1 text-xs text-muted-foreground">{data?.visual_inventory.length ?? 0} total · {data?.visual_inventory.filter((entry) => entry.ready).length ?? 0} ready · {data?.visual_inventory.filter((entry) => !entry.ready).length ?? 0} blocked · complete deterministic scan</p></div><span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-foreground">Provider none · review only</span></div>
        {!latestVisualBatch ? <p className="mt-3 text-xs leading-5 text-muted-foreground">Visual plans remain sealed until the batch action binds every region to approved copy, exact sources, owned product proof, timing, privacy, originality, and channel-native quality checks.</p> : <div className="mt-3 space-y-3">
          <p className="text-xs font-semibold text-foreground">{latestVisualBatch.total} total · {latestVisualBatch.scanned} scanned · {latestVisualBatch.prepared_count} prepared · {latestVisualBatch.blocked_count} blocked · {latestVisualBatch.remaining} remaining · {latestVisualBatch.chunks_processed} chunks</p>
          <div className="grid gap-3 md:grid-cols-2">{latestVisualBatch.prepared.map((projection) => projection.plan ? <VisualPlanDetails key={projection.plan.plan_id} plan={projection.plan} projection={projection} /> : null)}</div>
          {latestVisualBatch.blocked.some((projection) => projection.plan) ? <div className="grid gap-3 md:grid-cols-2">{latestVisualBatch.blocked.map((projection) => projection.plan ? <VisualPlanDetails key={projection.plan.plan_id} plan={projection.plan} projection={projection} /> : null)}</div> : null}
          {latestVisualBatch.blocked.length ? <BlockedVisualBacklog entries={latestVisualBatch.blocked} /> : null}
        </div>}
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Eligible campaign candidates</h3>
          <div className="mt-2 space-y-2" role="listbox" aria-label="Campaign candidates">
            {(data?.candidates ?? []).map((entry) => {
              const active = entry.candidate.candidate_id === selectedId
              return <button key={entry.candidate.candidate_id} type="button" role="option" aria-selected={active} onClick={() => { setSelectedId(entry.candidate.candidate_id); setError(''); setNotice('') }} className={`w-full rounded-lg border p-3 text-left transition-colors ${active ? 'border-radiant-gold bg-radiant-gold/10' : 'border-border bg-background hover:bg-muted/30'}`}>
                <span className="flex items-start justify-between gap-3"><span><span className="block text-sm font-semibold text-foreground">{entry.candidate.product_label}</span><span className="mt-1 block text-xs text-muted-foreground">LinkedIn + YouTube · {entry.candidate.calendar_item_ids.length} calendar bindings</span></span><span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${entry.evaluation.ready ? 'border-emerald-500/35 text-emerald-700 dark:text-emerald-200' : entry.evaluation.state === 'unscored' ? 'border-slate-500/35 text-muted-foreground' : 'border-amber-500/35 text-amber-800 dark:text-amber-100'}`}>{entry.evaluation.ready ? 'Ready' : entry.evaluation.state === 'unscored' ? 'Unscored' : 'Blocked'}</span></span>
              </button>
            })}
          </div>
        </div>

        {selected ? <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="text-lg font-semibold text-foreground">{selected.candidate.product_label}</h3><p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{selected.candidate.campaign_identity} · {selected.candidate.content_version}</p></div>
            <button type="button" onClick={() => void prepare()} disabled={busy || !selected.evaluation.ready} className="admin-console-button-primary disabled:cursor-not-allowed disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{busy ? 'Preparing…' : packageRuns.some((run) => ['completed', 'running', 'waiting_for_approval', 'queued'].includes(run.status)) ? 'Return existing receipt' : packageRuns.length ? 'Retry preparation' : 'Prepare review package'}</button>
          </div>

          {!selected.evaluation.ready ? <div className="mt-4 rounded-lg border border-amber-500/35 bg-amber-500/10 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><AlertTriangle className="h-4 w-4" /> {selected.evaluation.state === 'unscored' ? 'Unscored evidence' : 'Preparation blocked'}</p>
            <ul className="mt-2 space-y-2">{selected.evaluation.blockers.map((blocker) => <li key={blocker.code} className="rounded-md border border-border bg-background p-2 text-xs leading-5"><p className="text-foreground">{blocker.message}</p><Link href={blocker.recovery_href} className="font-semibold text-blue-700 underline dark:text-blue-200">{blocker.recovery_label}</Link></li>)}</ul>
          </div> : selected.candidate.campaign_identity === 'kicklab' ? <div className="mt-4 rounded-lg border border-amber-500/35 bg-amber-500/10 p-3"><p className="flex items-center gap-2 text-sm font-semibold text-foreground"><AlertTriangle className="h-4 w-4" /> Package inputs pass; thumbnail approval remains Unscored</p><p className="mt-1 text-xs leading-5 text-muted-foreground">The package may be assembled for review, but this does not approve the raster or its provisional type treatment. Typography performance evidence is incomplete; keep the asset in review-only state.</p></div> : <div className="mt-4 rounded-lg border border-emerald-500/35 bg-emerald-500/10 p-3"><p className="flex items-center gap-2 text-sm font-semibold text-foreground"><CheckCircle2 className="h-4 w-4" /> Every prerequisite passed</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Evidence, live outlier threshold, product proof, originality, privacy, version bindings, and thumbnail checks are current.</p></div>}

          {latestPackage ? <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-background p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">LinkedIn package</p><p className="mt-2 text-sm leading-6 text-foreground">{latestPackage.deliverables.linkedin.copy}</p><p className="mt-2 break-all text-xs text-muted-foreground">Visual: {latestPackage.deliverables.linkedin.visual_href}</p></div>
            <div className="rounded-lg border border-border bg-background p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">YouTube package</p><p className="mt-2 text-sm font-semibold text-foreground">{latestPackage.deliverables.youtube.title}</p><p className="mt-1 text-xs text-muted-foreground">Thumbnail teaser: <strong className="text-foreground">{latestPackage.deliverables.youtube.thumbnail_teaser}</strong></p><p className="mt-2 text-xs leading-5 text-muted-foreground">Description, script, {latestPackage.deliverables.youtube.storyboard.length}-beat storyboard, thumbnail, and product-proof binding included.</p></div>
          </div> : <p className="mt-4 rounded-lg border border-border bg-muted/25 p-3 text-sm text-muted-foreground">{selected.evaluation.ready ? 'All inputs are ready. LinkedIn and YouTube deliverables remain sealed until the idempotent preparation run completes.' : 'LinkedIn and YouTube deliverables are withheld until every prerequisite passes.'}</p>}

          <details className="mt-3 rounded-lg border border-border bg-background p-3"><summary className="cursor-pointer text-sm font-semibold text-foreground">Evidence, formulas, and comparison trace</summary><div className="mt-3 space-y-2">{Object.entries(selected.candidate.receipts).map(([name, receipt]) => <div key={name} className="rounded-md border border-border p-2 text-xs"><div className="flex flex-wrap justify-between gap-2"><strong className="text-foreground">{pretty(name)}</strong><span>{String(receipt.observed_value)} observed / {String(receipt.required_value)} required · n={receipt.sample_size ?? '—'}</span></div><p className="mt-1 text-muted-foreground">{receipt.formula ?? 'No formula recorded'} · fresh until {receipt.fresh_until ?? 'not supplied'}</p><p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{receipt.receipt_id}</p></div>)}</div><div className="mt-3 space-y-2">{selected.candidate.source_trace.map((source) => <p key={source.source_id} className="text-xs leading-5"><strong>{source.decision === 'selected' ? 'Selected' : 'Excluded'}:</strong> {source.label} — {source.reason}</p>)}</div><p className="mt-3 text-xs text-muted-foreground">Saved playlist examples: zero performance weight; taste calibration only; Unscored.</p></details>

          <details className="mt-3 rounded-lg border border-border bg-background p-3"><summary className="cursor-pointer text-sm font-semibold text-foreground">Thumbnail v6 pre-Human-QA checklist</summary><ul className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(selected.candidate.thumbnail_checklist).map(([label, passed]) => <li key={label} className="flex items-start gap-2 text-xs leading-5">{passed ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />}{label}</li>)}</ul></details>

          <section aria-label="Preparation run history" className="mt-4 rounded-lg border border-border bg-background p-3"><div className="flex items-center justify-between gap-2"><h4 className="flex items-center gap-2 text-sm font-semibold text-foreground"><History className="h-4 w-4" /> Run history and receipts</h4><span className="text-xs text-muted-foreground">Maximum attempts: {data?.retry_policy.maximum_attempts_per_input_version ?? 2}</span></div>{packageRuns.length ? <ul className="mt-3 space-y-2">{packageRuns.map((run) => <li key={run.id} className="rounded-md border border-border p-2 text-xs"><div className="flex flex-wrap justify-between gap-2"><span className="font-semibold text-foreground">{run.current_step}</span><span>{run.status}</span></div><p className="mt-1 text-muted-foreground">Attempt {run.metadata.attempt_number ?? 1} of {run.metadata.maximum_attempts ?? 2} · Retry {run.metadata.retry_count ?? 0} of {run.metadata.retry_limit ?? 1}</p><p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{run.id} · {run.idempotency_key}</p>{run.metadata.package ? <Link href={run.metadata.package.decision_queue_href} className="mt-2 inline-flex items-center gap-1 font-semibold text-blue-700 underline dark:text-blue-200"><FileCheck2 className="h-3.5 w-3.5" /> Open canonical Decision Queue</Link> : null}</li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">No preparation run yet. Blocked candidates create no package; a failed run permits one immutable retry receipt.</p>}</section>

          {latestPackage ? <p className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs leading-5 text-muted-foreground"><FileCheck2 className="mr-1 inline h-4 w-4" /> Package <span className="font-mono">{latestPackage.package_id}</span> preserves source trace, version bindings, product-proof receipts, selected/excluded comparison logic, and closed external gates.</p> : null}
        </div> : null}
      </div>

      <div className="mt-5 border-t border-border pt-4"><p className="text-xs font-semibold text-foreground">Closed in this workflow</p><div className="mt-2 flex flex-wrap gap-2">{Object.keys(data?.external_gates ?? {}).map((gate) => <span key={gate} className="rounded-full border border-border bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground">{pretty(gate)}</span>)}</div><p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground"><RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0" /> A retry is available only after a visible failure and is capped at two attempts for the same input version. A source change requires a new version; the idempotency key prevents duplicate records.</p></div>
    </section>
  )
}

