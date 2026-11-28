import { describe, expect, it } from 'vitest'
import jevPresenterPackage from '../artifacts/human-qa/artifact-video-review-2026-10-14/inputs/jev-youtube-presenter-package-v2.json'
import {
  evaluateYouTubePresenterPackage,
  type YouTubePresenterPackage,
} from './youtube-presenter-package'
import type { YouTubeMusicBedContract } from './youtube-music-bed'

const inputVersion = 'sha256:jev-content-v2'
const researchIds = ['research_packet:outlier-1']
const sourceIds = ['source:jev:approved']
const claimIds = ['jev-score', 'jev-policy']
const privacyIds = ['privacy:jev:public-safe']
const rightsIds = ['rights:jev:owned-media']
const musicSourceIds = ['source:music:approved']
const musicRightsIds = ['rights:music:approved']
const musicTrackHash = 'sha256:approved-music'

function musicBed(): YouTubeMusicBedContract {
  return {
    version: 'youtube_music_bed_v1', status: 'approved', input_version: inputVersion,
    track: {
      track_id: 'track:lofi-jazz:v1', title: 'Approved instrumental',
      style_tags: ['lo-fi', 'jazz', 'hip-hop'], instrumental: true, vocals: false,
      source_reference: 'drive://approved.wav', staged_path: 'artifacts/audio/approved.wav',
      sha256: musicTrackHash, duration_seconds: 120,
      source_receipt: { receipt_id: musicSourceIds[0], status: 'passed', input_version: inputVersion },
      rights_receipt: { receipt_id: musicRightsIds[0], status: 'approved', input_version: inputVersion },
    },
    timing: { source_start_seconds: 4, timeline_start_seconds: 0, timeline_end_seconds: 20, loop: { enabled: false, crossfade_seconds: 0, seam_validation_receipt: null } },
    mix: {
      preset: 'moderate_narration_bed', target_music_lufs: -28, target_final_lufs: -16, maximum_true_peak_dbfs: -1.5,
      speech_ducking: { enabled: true, threshold_dbfs: -30, ratio: 4, attack_ms: 45, release_ms: 520, minimum_reduction_db: 4, maximum_reduction_db: 8 },
      fade_in_seconds: 1, fade_out_seconds: 1,
    },
    final_audio_validation: {
      receipt_id: 'audio-validation:music:v1', status: 'passed', input_version: inputVersion,
      output_sha256: 'sha256:mixed', baseline_sha256: 'sha256:baseline', measured_integrated_lufs: -16.2,
      measured_true_peak_dbfs: -1.7, baseline_dialogue_lufs: -16.1, mixed_dialogue_lufs: -16.3,
      dialogue_lufs_delta: -0.2, clipping_sample_count: 0, observed_duck_reduction_db: 6.4,
      fade_boundary_passed: true, loop_seam_passed: true,
    },
  }
}

function fixture(): YouTubePresenterPackage {
  const conclusion = 'Governed automation begins when uncertainty is visible enough to route, review, and refuse.'
  const cta = 'Subscribe to the channel for more practical ways to govern AI decisions.'
  return {
    version: 'youtube_presenter_package_v2',
    package_id: 'youtube-presenter:jev:v2',
    target: 'youtube_shorts',
    review_only: true,
    input_version: inputVersion,
    script: {
      template_receipt_id: 'template-run:jev:v2',
      template_receipt_version: 'video_script_template_run_receipt_v2',
      text: `The problem is fluent certainty. Inspect the score. Apply the policy. Keep the human owner visible. Retain the receipt. ${conclusion} ${cta}`,
      sha256: 'sha256:script-v2',
      conclusion,
      channel_cta: cta,
    },
    native_presenter: {
      path: 'native.mp4',
      sha256: 'native-sha',
      provider_job_id: 'provider-job',
      rights_receipt_id: rightsIds[0],
      source_script_sha256: 'sha256:source-script',
    },
    render_contract: {
      width: 1080,
      height: 1920,
      fps: 25,
      background_color: '#10182b',
      brand_logo: { path: 'logo.png', sha256: 'sha256:logo' },
      evidence_assets: [{
        asset_id: 'field-guide', path: 'field-guide.png', sha256: 'sha256:guide', width: 1142, height: 703,
        source_receipt_id: sourceIds[0], rights_receipt_id: rightsIds[0],
      }],
    },
    music_bed: musicBed(),
    timeline: [
      { cue_id: 'presenter-open', layout: 'presenter_primary', start_seconds: 0, end_seconds: 4, spoken_text: 'The problem is fluent certainty.' },
      {
        cue_id: 'score', layout: 'side_evidence', start_seconds: 4, end_seconds: 8, spoken_text: 'Inspect the score.',
        evidence_asset_id: 'field-guide', evidence_region_id: 'score',
        source_crop: { x: 0, y: 0, width: 300, height: 300 },
        presenter_region: { x: 0, y: 200, width: 420, height: 900 }, evidence_region: { x: 460, y: 200, width: 580, height: 900 },
      },
      {
        cue_id: 'policy', layout: 'side_evidence', start_seconds: 8, end_seconds: 12, spoken_text: 'Apply the policy.',
        evidence_asset_id: 'field-guide', evidence_region_id: 'policy',
        source_crop: { x: 300, y: 0, width: 300, height: 300 },
        presenter_region: { x: 0, y: 200, width: 420, height: 900 }, evidence_region: { x: 460, y: 200, width: 580, height: 900 },
      },
      { cue_id: 'conclusion', layout: 'conclusion', start_seconds: 12, end_seconds: 16, spoken_text: conclusion },
      { cue_id: 'cta', layout: 'cta', start_seconds: 16, end_seconds: 20, spoken_text: cta, delivery: 'on_screen_end_card' },
    ],
    packaging: {
      research_receipt_ids: researchIds,
      source_receipt_ids: sourceIds,
      claim_ids: claimIds,
      privacy_receipt_id: privacyIds[0],
      rights_receipt_id: rightsIds[0],
      title_subject_receipt: {
        receipt_id: 'titles:jev:v1', status: 'passed', input_version: inputVersion, subject: 'Who owns the decision after the score?',
        candidates: [
          { candidate_id: 'title-1', title: 'AI gave you a score. Who owns the decision?', promise: 'See the governance layer.', research_receipt_ids: researchIds, source_receipt_ids: sourceIds, claim_ids: claimIds },
          { candidate_id: 'title-2', title: 'A score is not a decision', promise: 'See how Jev routes uncertainty.', research_receipt_ids: researchIds, source_receipt_ids: sourceIds, claim_ids: claimIds },
        ],
      },
      thumbnail_receipt: {
        receipt_id: 'thumbnail:jev:v1', status: 'passed', input_version: inputVersion, path: 'thumbnail.png', sha256: 'sha256:thumb', width: 1280, height: 720,
        headline: 'WHO OWNS THE DECISION?', research_receipt_ids: researchIds, source_receipt_ids: sourceIds, claim_ids: claimIds,
        privacy_receipt_id: privacyIds[0], rights_receipt_id: rightsIds[0],
      },
    },
  }
}

function evaluate(value: YouTubePresenterPackage) {
  return evaluateYouTubePresenterPackage({
    package: value,
    expectedInputVersion: inputVersion,
    approvedResearchReceiptIds: researchIds,
    approvedSourceReceiptIds: sourceIds,
    approvedClaimIds: claimIds,
    approvedPrivacyReceiptIds: privacyIds,
    approvedRightsReceiptIds: rightsIds,
    approvedMusicSourceReceiptIds: musicSourceIds,
    approvedMusicRightsReceiptIds: musicRightsIds,
    approvedMusicTrackSha256ById: { 'track:lofi-jazz:v1': musicTrackHash },
  })
}

describe('youtube-presenter-package', () => {
  it('fails the checked-in Jev package without external approvals and passes with the exact music bindings', () => {
    const value = jevPresenterPackage as YouTubePresenterPackage
    expect(evaluateYouTubePresenterPackage({
      package: value,
      expectedInputVersion: value.input_version,
      approvedResearchReceiptIds: ['research_packet:68dfaed1-b319-4a82-98c0-b9caea34835e'],
      approvedSourceReceiptIds: ['source:jev:approved-composite-20261014'],
      approvedClaimIds: ['jev-typed-probabilities', 'jev-policy-boundary'],
      approvedPrivacyReceiptIds: ['privacy:jev:public-safe-20261014'],
      approvedRightsReceiptIds: ['rights:jev:owned-public-assets-20261014'],
      approvedMusicSourceReceiptIds: [],
      approvedMusicRightsReceiptIds: [],
      approvedMusicTrackSha256ById: {},
    }).blockers).toEqual(expect.arrayContaining([
      'Background-music input hash is missing, stale, or unapproved.',
      'Background-music source receipt is missing, stale, or unapproved.',
      'Background-music rights receipt is missing, stale, or unapproved.',
    ]))
    expect(evaluateYouTubePresenterPackage({
      package: value,
      expectedInputVersion: value.input_version,
      approvedResearchReceiptIds: ['research_packet:68dfaed1-b319-4a82-98c0-b9caea34835e'],
      approvedSourceReceiptIds: ['source:jev:approved-composite-20261014'],
      approvedClaimIds: ['jev-typed-probabilities', 'jev-policy-boundary'],
      approvedPrivacyReceiptIds: ['privacy:jev:public-safe-20261014'],
      approvedRightsReceiptIds: ['rights:jev:owned-public-assets-20261014'],
      approvedMusicSourceReceiptIds: ['source:music:the-stream-v2:20261014'],
      approvedMusicRightsReceiptIds: ['rights:music:the-stream-v2:20261014'],
      approvedMusicTrackSha256ById: {
        'mad-hadda-the-stream-beat-stem-v2': 'sha256:7842628c35c5375cefaffc1b7d9425e354e840f5d46dfab65612d8f86a67158d',
      },
    })).toEqual({ applicable: true, ready: true, blockers: [] })
  })

  it('passes presenter-first composition with separate synchronized evidence, conclusion, titles, and thumbnail', () => {
    expect(evaluate(fixture())).toEqual({ applicable: true, ready: true, blockers: [] })
  })

  it('fails when the presenter is not the primary opening frame', () => {
    const value = fixture()
    value.timeline[0].layout = 'side_evidence'
    expect(evaluate(value).blockers).toContain('YouTube output must open at zero with the approved presenter as the primary frame.')
  })

  it('fails when the presenter overlaps the evidence frame', () => {
    const value = fixture()
    value.timeline[1].presenter_region = { x: 0, y: 200, width: 700, height: 900 }
    expect(evaluate(value).blockers).toContain('Presenter video cannot overlap the screenshot or diagram frame.')
  })

  it('fails on unsynchronized or repeated evidence loops', () => {
    const value = fixture()
    value.timeline[2].start_seconds = 9
    value.timeline[2].evidence_region_id = 'score'
    value.timeline[2].loop = true
    expect(evaluate(value).blockers).toEqual(expect.arrayContaining([
      'Presenter timeline cues must form a synchronized sequence without unbound gaps.',
      'Unsynchronized evidence loops are not allowed.',
      'Evidence regions cannot repeat as an unsynchronized screenshot loop.',
    ]))
  })

  it('fails when the conclusion or bounded channel CTA is missing or out of order', () => {
    const value = fixture()
    value.script.text = 'The problem is fluent certainty. Subscribe to the channel.'
    value.timeline = value.timeline.filter((cue) => cue.layout !== 'conclusion')
    expect(evaluate(value).blockers).toEqual(expect.arrayContaining([
      'The script must contain the substantive conclusion followed by the bounded channel CTA.',
      'The timeline requires the reviewed substantive conclusion.',
    ]))
  })

  it('fails stale, missing, or mismatched title and thumbnail receipt bindings', () => {
    const value = fixture()
    value.packaging.title_subject_receipt.input_version = 'sha256:stale'
    value.packaging.title_subject_receipt.candidates[0].research_receipt_ids = []
    value.packaging.thumbnail_receipt.sha256 = ''
    value.packaging.thumbnail_receipt.rights_receipt_id = 'rights:unknown'
    expect(evaluate(value).blockers).toEqual(expect.arrayContaining([
      'A passed, version-bound subject/title receipt is required.',
      'Every YouTube title candidate must retain the package research, source, and claim bindings.',
      'Thumbnail package requires a customer-facing preview, hash, dimensions, and headline.',
      'Thumbnail package must retain the same research, source, claim, privacy, and rights bindings.',
    ]))
  })

  it('fails closed when the render contract or packaging receipts are missing', () => {
    const value = fixture()
    delete (value as Partial<YouTubePresenterPackage>).render_contract
    delete (value.packaging as Partial<YouTubePresenterPackage['packaging']>).title_subject_receipt
    delete (value.packaging as Partial<YouTubePresenterPackage['packaging']>).thumbnail_receipt
    expect(evaluate(value).blockers).toEqual(expect.arrayContaining([
      'A deterministic YouTube render contract with valid dimensions, frame rate, and background is required.',
      'A passed, version-bound subject/title receipt is required.',
      'A passed, version-bound thumbnail receipt is required.',
    ]))
  })

  it('does not apply the YouTube presenter contract to LinkedIn or non-video content', () => {
    const value = fixture()
    value.target = 'linkedin'
    value.timeline = []
    expect(evaluate(value)).toEqual({ applicable: false, ready: true, blockers: [] })
  })

  it('fails closed when native presenter or evidence receipts are unapproved', () => {
    const value = fixture()
    value.native_presenter.rights_receipt_id = 'rights:unknown'
    value.render_contract.evidence_assets[0].source_receipt_id = 'source:unknown'
    value.render_contract.evidence_assets[0].rights_receipt_id = 'rights:unknown'

    expect(evaluate(value).ready).toBe(false)
    expect(evaluate(value).blockers).toEqual(expect.arrayContaining([
      'Native presenter rights receipt is missing or unapproved.',
      'Evidence asset source receipt is missing or unapproved.',
      'Evidence asset rights receipt is missing or unapproved.',
    ]))
  })

  it('fails when a side-evidence crop is empty or leaves the declared asset', () => {
    const overflow = fixture()
    overflow.timeline[1].source_crop = { x: 900, y: 0, width: 300, height: 300 }
    expect(evaluate(overflow).blockers).toContain('Side-evidence source crops must remain inside the declared evidence asset.')

    const empty = fixture()
    empty.timeline[1].source_crop = { x: 0, y: 0, width: 0, height: 300 }
    expect(evaluate(empty).blockers).toContain('Side-evidence source crops must remain inside the declared evidence asset.')
  })

  it('fails when the presenter-first opening displays evidence', () => {
    const value = fixture()
    value.timeline[0].evidence_asset_id = 'field-guide'
    value.timeline[0].evidence_region_id = 'score'

    const blockers = evaluate(value).blockers
    expect(blockers).toContain('The presenter-first opening cannot display evidence screenshots or diagrams.')
    expect(blockers).not.toContain('YouTube output must open at zero with the approved presenter as the primary frame.')
  })

  it('fails only when presenter cues overlap beyond the timing tolerance', () => {
    const allowed = fixture()
    allowed.timeline[1].start_seconds = 3.98
    expect(evaluate(allowed).blockers).not.toContain('Presenter timeline cues cannot overlap.')

    const overlap = fixture()
    overlap.timeline[1].start_seconds = 3.97
    const blockers = evaluate(overlap).blockers
    expect(blockers).toContain('Presenter timeline cues cannot overlap.')
    expect(blockers).not.toContain('Presenter timeline cues must form a synchronized sequence without unbound gaps.')
  })

  it('allows an on-screen CTA only while the package stays review-only', () => {
    const reviewOnly = fixture()
    const reviewCta = reviewOnly.timeline.find((cue) => cue.cue_id === 'cta')
    if (!reviewCta) throw new Error('fixture missing cta')
    reviewCta.delivery = undefined
    expect(evaluate(reviewOnly).blockers).toContain('Release-ready YouTube output requires a spoken CTA; on-screen-only CTA is allowed only for a review artifact.')
    expect(evaluate(reviewOnly).blockers).not.toContain('This pipeline stage must remain review-only until a separate release approval exists.')

    const onScreenRelease = fixture()
    onScreenRelease.review_only = false
    expect(evaluate(onScreenRelease).blockers).toEqual(expect.arrayContaining([
      'This pipeline stage must remain review-only until a separate release approval exists.',
      'Release-ready YouTube output requires a spoken CTA; on-screen-only CTA is allowed only for a review artifact.',
    ]))

    const spokenRelease = fixture()
    spokenRelease.review_only = false
    const spokenCta = spokenRelease.timeline.find((cue) => cue.cue_id === 'cta')
    if (!spokenCta) throw new Error('fixture missing cta')
    spokenCta.delivery = 'spoken'
    expect(evaluate(spokenRelease).blockers).toEqual([
      'This pipeline stage must remain review-only until a separate release approval exists.',
    ])
  })

  it('fails when side-evidence narration is not in the reviewed script', () => {
    const value = fixture()
    value.timeline[1].spoken_text = 'Invented claim about guaranteed savings.'
    expect(evaluate(value).blockers).toContain('Evidence cue score is not bound to the reviewed script.')
  })

  it('fails when packaging receipt sets do not match the approved bindings', () => {
    const value = fixture()
    const driftedResearch = ['research_packet:other']
    const driftedSource = [...sourceIds, 'source:extra']
    const driftedClaims = ['jev-score']
    value.packaging.research_receipt_ids = driftedResearch
    value.packaging.source_receipt_ids = driftedSource
    value.packaging.claim_ids = driftedClaims
    value.packaging.privacy_receipt_id = 'privacy:unknown'
    value.packaging.rights_receipt_id = 'rights:unknown'
    for (const candidate of value.packaging.title_subject_receipt.candidates) {
      candidate.research_receipt_ids = driftedResearch
      candidate.source_receipt_ids = driftedSource
      candidate.claim_ids = driftedClaims
    }
    const thumbnail = value.packaging.thumbnail_receipt
    thumbnail.research_receipt_ids = driftedResearch
    thumbnail.source_receipt_ids = driftedSource
    thumbnail.claim_ids = driftedClaims
    thumbnail.privacy_receipt_id = 'privacy:unknown'
    thumbnail.rights_receipt_id = 'rights:unknown'

    const blockers = evaluate(value).blockers
    expect(blockers).toEqual(expect.arrayContaining([
      'YouTube packaging research receipts are missing, stale, or mismatched.',
      'YouTube packaging source receipts are missing, stale, or mismatched.',
      'YouTube packaging claim bindings are missing or mismatched.',
      'YouTube packaging privacy receipt is missing or unapproved.',
      'YouTube packaging rights receipt is missing or unapproved.',
    ]))
    expect(blockers).not.toContain('Every YouTube title candidate must retain the package research, source, and claim bindings.')
    expect(blockers).not.toContain('Thumbnail package must retain the same research, source, claim, privacy, and rights bindings.')
  })
})
