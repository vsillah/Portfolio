import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import packetJson from '@/artifacts/human-qa/artifact-video-review-2026-10-14/inputs/jev-social-video-review-package-v1.json'
import { evaluateSocialVideoReviewPackage, type SocialVideoReviewPackage } from './social-video-review-package'

const packet = () => structuredClone(packetJson) as SocialVideoReviewPackage
const evaluate = (value: SocialVideoReviewPackage) => evaluateSocialVideoReviewPackage({
  reviewPackage: value,
  expectedInputVersion: packetJson.input_version,
  approvedSourceReceiptIds: ['source:jev:approved-composite-20261014', 'source:music:the-stream-v2:20261014'],
  approvedRightsReceiptIds: ['rights:jev:owned-public-assets-20261014', 'rights:music:the-stream-v2:20261014'],
  approvedTrackSha256ById: { 'mad-hadda-the-stream-beat-stem-v2': packetJson.music_bed.track.sha256 },
})

describe('social-video-review-package', () => {
  it('accepts the version-bound Jev music and motion review package', () => {
    expect(evaluate(packet())).toEqual({ ready: true, blockers: [] })
  })

  it('fails closed for stale inputs and an invalidated render', () => {
    const value = packet()
    value.input_version = 'sha256:stale'
    value.outputs.render_input_version = 'sha256:older'
    expect(evaluate(value).blockers).toEqual(expect.arrayContaining([
      'Social video review package is stale for the approved content version.',
      'A passed version-bound render receipt and enhanced-output hash are required.',
    ]))
  })

  it('fails closed for missing source and rights evidence', () => {
    const value = packet()
    value.source_assets[0].source_receipt_id = ''
    value.source_assets[0].rights_receipt_id = ''
    value.music_bed.track.rights_receipt.status = 'pending'
    expect(evaluate(value).blockers).toEqual(expect.arrayContaining([
      'A motion asset source receipt is missing or unapproved.',
      'A motion asset rights receipt is missing or unapproved.',
      'Background-music rights receipt is missing, stale, or unapproved.',
    ]))
  })

  it('fails unsafe, overlapping, looping, or unbound motion', () => {
    const value = packet()
    value.motion_recipe.cues[0].scale_to = 1.4
    value.motion_recipe.cues[0].safe_area.left = 8
    value.motion_recipe.cues[0].asset_id = 'missing'
    value.motion_recipe.cues[1].start_seconds = value.motion_recipe.cues[0].end_seconds - 1
    ;(value.motion_recipe.cues[0] as { loop: boolean }).loop = true
    expect(evaluate(value).blockers).toEqual(expect.arrayContaining([
      'Motion cue exceeds the restrained scale or pan envelope.',
      'Motion cue violates the 48-pixel title-safe area.',
      'A motion cue references an unbound visual asset.',
      'Motion cues must be ordered, non-overlapping, and contained by the video timeline.',
      'Social review motion must not loop.',
    ]))
  })

  it('requires a reduced-motion recipe and restrained transition timing', () => {
    const value = packet()
    value.motion_recipe.reduced_motion_recipe_id = ''
    value.motion_recipe.cues[0].transition_frames = 2
    expect(evaluate(value).blockers).toEqual(expect.arrayContaining([
      'Motion requires a named restrained preset and an explicit reduced-motion alternative.',
      'Motion transition duration must remain inside the approved matched-move transition range.',
    ]))
  })

  it('fails closed when choreography, scene roles, or moderate ducking drift', () => {
    const value = packet()
    value.motion_recipe.layout_preset.presenter_min_width_px = 300
    value.motion_recipe.transition_policy.hard_cuts = true as false
    value.motion_recipe.cues[1].scene_role = 'asset_detail'
    value.music_bed.mix.speech_ducking.maximum_reduction_db = 14
    expect(evaluate(value).blockers).toEqual(expect.arrayContaining([
      'Motion requires the full-height presenter/asset choreography preset with safe padding and readable panel geometry.',
      'Motion transitions require restrained matched movement, crossfades, positional continuity, and no hard cuts.',
      'Motion cue does not provide the required readable evidence area for its scene role.',
      'Speech-aware ducking must use the moderate narration preset: 4–9 dB reduction, 3:1–8:1 ratio, 20–100 ms attack, and 200–800 ms release.',
    ]))
  })

  it('fails unsynchronized cue identities, timeline gaps, unsafe crops, and text occlusion', () => {
    const value = packet()
    value.script_cues[0].cue_id = 'different-script-cue'
    value.motion_recipe.cues[1].start_seconds += 0.2
    value.motion_recipe.cues[2].source_crop!.width = 900
    value.motion_recipe.cues[3].text_box = { ...value.motion_recipe.cues[3].evidence_region! }
    value.motion_recipe.cues[4].text_box!.x = 12
    expect(evaluate(value).blockers).toEqual(expect.arrayContaining([
      'Motion cues are not synchronized to stable script cue identities and timing.',
      'Motion cue timeline contains an unbound gap.',
      'Motion cue crop is missing or outside the bound source asset.',
      'Motion cue text occludes the evidence region.',
      'Motion cue text leaves the declared title-safe area.',
    ]))
  })

  it('binds the fixture to the actual rendered output bytes', () => {
    const bytes = readFileSync(packetJson.outputs.enhanced_path)
    expect(`sha256:${createHash('sha256').update(bytes).digest('hex')}`).toBe(packetJson.outputs.enhanced_sha256)
  })

  it('fails closed for thin asset coverage or unsafe vocal provenance', () => {
    const value = packet()
    value.asset_coverage.minimum_distinct_views = 9
    value.vocal_treatment.timing_edits_applied = true as false
    value.vocal_treatment.provider_calls = 1 as 0
    expect(evaluate(value).blockers).toEqual(expect.arrayContaining([
      'Asset coverage does not meet the version-bound diversity floor.',
      'Vocal treatment must remain local-only, sample-synchronous, original-default, and inside the lip-sync tolerance.',
    ]))
  })

  it('fails closed when prior animation is flattened or semantic motion is unbound', () => {
    const value = packet()
    value.motion_provenance.native_motion_preserved = false
    value.motion_provenance.flattening_reason = ''
    value.motion_provenance.cue_bindings = value.motion_provenance.cue_bindings.slice(1)
    expect(evaluate(value).blockers).toEqual(expect.arrayContaining([
      'An animated source cannot be flattened without an explicit reason.',
      'Every evidence cue requires a source-bound internal-motion contract.',
    ]))
  })

  it('fails closed when an approved prior scene disappears without an omission receipt', () => {
    const value = packet()
    value.motion_provenance.scene_inventory[0].disposition = 'omitted'
    expect(evaluate(value).blockers).toContain('Approved prior scenes must be restored or carry a version-bound omission receipt.')
  })
})
