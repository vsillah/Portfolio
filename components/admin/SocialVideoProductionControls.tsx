'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Film, Gauge, LockKeyhole, Music2, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react'
import type { SocialVideoReviewPackage } from '@/lib/social-video-review-package'
import { evaluateSocialVideoReviewPackage } from '@/lib/social-video-review-package'

type Props = {
  reviewPackage?: SocialVideoReviewPackage | null
  approvedSourceReceiptIds: string[]
  approvedRightsReceiptIds: string[]
}

const baselineUrl = '/review-assets/social-content/jev-youtube-no-music-review.mp4'
const enhancedUrl = '/review-assets/social-content/jev-youtube-motion-review.mp4'
const posterUrl = '/review-assets/social-content/jev-youtube-motion-review.png'
const naturalizedUrl = '/review-assets/social-content/jev-youtube-naturalized-voice-review.mp4'

export default function SocialVideoProductionControls({ reviewPackage, approvedSourceReceiptIds, approvedRightsReceiptIds }: Props) {
  const [musicPreset, setMusicPreset] = useState<'approved' | 'quiet' | 'none'>('approved')
  const [motionPreset, setMotionPreset] = useState<'restrained' | 'reduced'>('restrained')
  const [voicePreset, setVoicePreset] = useState<'original' | 'naturalized'>('original')
  const [preview, setPreview] = useState<'enhanced' | 'baseline'>('enhanced')
  const [showTechnical, setShowTechnical] = useState(false)

  const readiness = useMemo(() => evaluateSocialVideoReviewPackage({
    reviewPackage,
    expectedInputVersion: reviewPackage?.input_version ?? '',
    approvedSourceReceiptIds,
    approvedRightsReceiptIds,
    approvedTrackSha256ById: reviewPackage ? { [reviewPackage.music_bed.track.track_id]: reviewPackage.music_bed.track.sha256 } : {},
  }), [approvedRightsReceiptIds, approvedSourceReceiptIds, reviewPackage])

  if (!reviewPackage) return null
  const dirty = musicPreset !== 'approved' || motionPreset !== 'restrained' || voicePreset !== 'original'
  const renderReady = readiness.ready && !dirty
  const music = reviewPackage.music_bed

  return (
    <section aria-label="Video production controls" className="mt-4 space-y-4 rounded-xl border border-violet-500/30 bg-card p-4 text-card-foreground shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-violet-700 dark:text-violet-200"><Film className="h-4 w-4" /> Video production</p>
          <h3 className="mt-1 text-lg font-semibold text-foreground">Sound and motion review package</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">Choose the approved instrumental treatment and restrained visual motion, compare the bound render, then carry the decision to the canonical queue.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-emerald-600/35 bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-800 dark:text-emerald-100">Version bound</span>
          <span className={`rounded-full border px-2.5 py-1 font-semibold ${dirty ? 'border-amber-600/35 bg-amber-500/10 text-amber-900 dark:text-amber-100' : 'border-violet-600/35 bg-violet-500/10 text-violet-900 dark:text-violet-100'}`}>{dirty ? 'Unrendered changes' : 'Render validated'}</span>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <fieldset className="rounded-lg border border-border bg-muted/25 p-3">
          <legend className="px-1 text-sm font-semibold text-foreground"><Music2 className="mr-2 inline h-4 w-4" />Instrumental</legend>
          <p className="mt-1 text-sm font-semibold text-foreground">{music.track.title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{music.track.style_tags.join(' · ')} · instrumental · no vocals</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Instrumental treatment">
            {([
              ['approved', `Approved · ${music.mix.target_music_lufs} LUFS`],
              ['quiet', 'Quieter · -36 LUFS'],
              ['none', 'No music'],
            ] as const).map(([value, label]) => (
              <button key={value} type="button" role="radio" aria-checked={musicPreset === value} onClick={() => setMusicPreset(value)} className={`min-h-11 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors ${musicPreset === value ? 'border-violet-500 bg-violet-500/10 text-foreground' : 'border-border bg-background text-muted-foreground hover:border-violet-400'}`}>{label}</button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border border-emerald-600/30 bg-emerald-500/10 px-2 py-1 text-emerald-800 dark:text-emerald-100"><ShieldCheck className="mr-1 inline h-3 w-3" />Source passed</span>
            <span className="rounded-full border border-emerald-600/30 bg-emerald-500/10 px-2 py-1 text-emerald-800 dark:text-emerald-100"><ShieldCheck className="mr-1 inline h-3 w-3" />Rights approved</span>
            <span className="rounded-full border border-border bg-background px-2 py-1 text-muted-foreground">Duck ≥ {music.mix.speech_ducking.minimum_reduction_db} dB</span>
            <span className="rounded-full border border-border bg-background px-2 py-1 text-muted-foreground">Fade {music.mix.fade_in_seconds}s / {music.mix.fade_out_seconds}s</span>
            <span className="rounded-full border border-border bg-background px-2 py-1 text-muted-foreground">No loop</span>
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-border bg-muted/25 p-3">
          <legend className="px-1 text-sm font-semibold text-foreground"><Sparkles className="mr-2 inline h-4 w-4" />Motion recipe</legend>
          <p className="mt-1 text-sm font-semibold text-foreground">Restrained editorial focus</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">6 restored native teaching scenes · synchronized presenter composite · original motion retained</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Motion treatment">
            <button type="button" role="radio" aria-checked={motionPreset === 'restrained'} onClick={() => setMotionPreset('restrained')} className={`min-h-11 rounded-lg border px-3 py-2 text-left text-xs font-semibold ${motionPreset === 'restrained' ? 'border-violet-500 bg-violet-500/10 text-foreground' : 'border-border bg-background text-muted-foreground'}`}>Original native motion</button>
            <button type="button" role="radio" aria-checked={motionPreset === 'reduced'} onClick={() => setMotionPreset('reduced')} className={`min-h-11 rounded-lg border px-3 py-2 text-left text-xs font-semibold ${motionPreset === 'reduced' ? 'border-violet-500 bg-violet-500/10 text-foreground' : 'border-border bg-background text-muted-foreground'}`}>Reduced motion · fades only</button>
          </div>
          <button type="button" onClick={() => setShowTechnical((value) => !value)} className="mt-3 min-h-11 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:border-violet-400">{showTechnical ? 'Hide' : 'Show'} cue details</button>
          {showTechnical && <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{reviewPackage.motion_recipe.cues.map((cue) => <li key={cue.cue_id}>{cue.cue_id.replaceAll('-', ' ')} · {cue.scene_role.replaceAll('_', ' ')} · {cue.start_seconds.toFixed(1)}–{cue.end_seconds.toFixed(1)}s · no loop</li>)}</ul>}
        </fieldset>
      </div>

      <fieldset className="rounded-lg border border-border bg-muted/25 p-3">
        <legend className="px-1 text-sm font-semibold text-foreground">Voice treatment</legend>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Original is production-safe. Naturalized is a local, sample-synchronous review reference; no re-record, provider call, pitch shift, or timing edit.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Voice treatment">
          <button type="button" role="radio" aria-checked={voicePreset === 'original'} onClick={() => setVoicePreset('original')} className={`min-h-11 rounded-lg border px-3 py-2 text-left text-xs font-semibold ${voicePreset === 'original' ? 'border-violet-500 bg-violet-500/10' : 'border-border'}`}>Original · approved default</button>
          <button type="button" role="radio" aria-checked={voicePreset === 'naturalized'} onClick={() => setVoicePreset('naturalized')} className={`min-h-11 rounded-lg border px-3 py-2 text-left text-xs font-semibold ${voicePreset === 'naturalized' ? 'border-violet-500 bg-violet-500/10' : 'border-border'}`}>Naturalized · review only</button>
        </div>
      </fieldset>

      {dirty && (
        <div role="status" className="flex flex-col gap-3 rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-950 dark:text-amber-100"><Gauge className="mr-2 inline h-4 w-4" />The saved render no longer matches these controls. Reset to the approved package or create a new version-bound render before decision.</p>
          <button type="button" onClick={() => { setMusicPreset('approved'); setMotionPreset('restrained'); setVoicePreset('original') }} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-700/40 bg-background px-3 py-2 text-sm font-semibold text-amber-950 dark:text-amber-100"><RotateCcw className="h-4 w-4" />Reset approved</button>
        </div>
      )}

      {!readiness.ready && <div role="alert" className="rounded-lg border border-red-500/35 bg-red-500/10 p-3 text-sm text-red-900 dark:text-red-100"><LockKeyhole className="mr-2 inline h-4 w-4" />{readiness.blockers[0]}</div>}

      <div className="rounded-lg border border-border bg-background p-3">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-semibold text-foreground">A/B review</p><p className="text-xs text-muted-foreground">Same approved narration and choreography; A removes music, B adds the rights-cleared moderate narration bed.</p></div>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="A/B video preview">
            <button type="button" onClick={() => setPreview('baseline')} aria-pressed={preview === 'baseline'} className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-semibold ${preview === 'baseline' ? 'border-violet-500 bg-violet-500/10' : 'border-border'}`}>A · No music</button>
            <button type="button" onClick={() => setPreview('enhanced')} aria-pressed={preview === 'enhanced'} className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-semibold ${preview === 'enhanced' ? 'border-violet-500 bg-violet-500/10' : 'border-border'}`}>B · Moderate bed</button>
          </div>
        </div>
        <div className="flex justify-center rounded-lg bg-black p-2"><video key={`${preview}-${voicePreset}`} aria-label={`${preview} ${voicePreset} Jev video preview`} controls playsInline preload="metadata" poster={posterUrl} src={voicePreset === 'naturalized' ? naturalizedUrl : preview === 'enhanced' ? enhancedUrl : baselineUrl} className="aspect-[9/16] max-h-[70vh] w-auto max-w-full rounded-md bg-black object-contain" /></div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/25 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div><p className="text-sm font-semibold text-foreground">Next action</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Review A/B here. A changed preset requires a fresh local render and receipt; external actions remain closed.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled title={renderReady ? 'The repository render is already current.' : 'Blocked until package inputs are valid and match the bound render.'} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"><Film className="h-4 w-4" />{renderReady ? 'Render current' : 'Render blocked'}</button>
          <button type="button" disabled title="Record the decision in the canonical Decision Queue after Human QA." className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"><CheckCircle2 className="h-4 w-4" />Decision pending</button>
        </div>
      </div>
    </section>
  )
}
