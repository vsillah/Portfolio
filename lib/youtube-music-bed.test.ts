import { describe, expect, it } from 'vitest'
import {
  evaluateYouTubeMusicBed,
  type YouTubeMusicBedContract,
} from './youtube-music-bed'

const inputVersion = 'sha256:content-v2'
const trackHash = 'sha256:approved-track'
const sourceReceiptId = 'source:music:approved'
const rightsReceiptId = 'rights:music:approved'

function fixture(): YouTubeMusicBedContract {
  return {
    version: 'youtube_music_bed_v1',
    status: 'approved',
    input_version: inputVersion,
    track: {
      track_id: 'track:lofi-jazz-bed:v1',
      title: 'Approved instrumental bed',
      style_tags: ['lo-fi', 'jazz', 'hip-hop'],
      instrumental: true,
      vocals: false,
      source_reference: 'drive://approved-source.wav',
      staged_path: 'artifacts/audio/approved-source.wav',
      sha256: trackHash,
      duration_seconds: 120,
      source_receipt: { receipt_id: sourceReceiptId, status: 'passed', input_version: inputVersion },
      rights_receipt: { receipt_id: rightsReceiptId, status: 'approved', input_version: inputVersion },
    },
    timing: {
      source_start_seconds: 8,
      timeline_start_seconds: 0,
      timeline_end_seconds: 71.28,
      loop: { enabled: false, crossfade_seconds: 0, seam_validation_receipt: null },
    },
    mix: {
      target_music_lufs: -32,
      target_final_lufs: -16,
      maximum_true_peak_dbfs: -1.5,
      speech_ducking: {
        enabled: true,
        threshold_dbfs: -30,
        ratio: 8,
        attack_ms: 35,
        release_ms: 420,
        minimum_reduction_db: 12,
      },
      fade_in_seconds: 1.5,
      fade_out_seconds: 2,
    },
    final_audio_validation: {
      receipt_id: 'audio-validation:jev:v1',
      status: 'passed',
      input_version: inputVersion,
      output_sha256: 'sha256:mixed-output',
      baseline_sha256: 'sha256:no-music-master',
      measured_integrated_lufs: -16.4,
      measured_true_peak_dbfs: -1.7,
      baseline_dialogue_lufs: -16.2,
      mixed_dialogue_lufs: -16.5,
      dialogue_lufs_delta: -0.3,
      clipping_sample_count: 0,
      observed_duck_reduction_db: 13.1,
      fade_boundary_passed: true,
      loop_seam_passed: true,
    },
  }
}

function evaluate(value: YouTubeMusicBedContract, requireFinalAudioValidation = true) {
  return evaluateYouTubeMusicBed({
    musicBed: value,
    expectedInputVersion: inputVersion,
    videoDurationSeconds: 71.28,
    approvedSourceReceiptIds: [sourceReceiptId],
    approvedRightsReceiptIds: [rightsReceiptId],
    approvedTrackSha256ById: { [value.track.track_id]: trackHash },
    requireFinalAudioValidation,
  })
}

describe('youtube-music-bed', () => {
  it('passes a rights-cleared, restrained, ducked, validated instrumental bed', () => {
    expect(evaluate(fixture())).toEqual({ ready: true, blockers: [] })
  })

  it('fails closed for missing or unapproved source and rights receipts', () => {
    const value = fixture()
    value.track.source_receipt.status = 'observed'
    value.track.rights_receipt.status = 'pending'
    expect(evaluate(value).blockers).toEqual(expect.arrayContaining([
      'Background-music source receipt is missing, stale, or unapproved.',
      'Background-music rights receipt is missing, stale, or unapproved.',
    ]))
  })

  it('fails a stale or unapproved track hash', () => {
    const value = fixture()
    value.track.sha256 = 'sha256:stale'
    expect(evaluate(value).blockers).toContain('Background-music input hash is missing, stale, or unapproved.')
  })

  it('fails excessive music level or an unsafe true-peak ceiling', () => {
    const value = fixture()
    value.mix.target_music_lufs = -20
    value.mix.maximum_true_peak_dbfs = -0.2
    expect(evaluate(value).blockers).toEqual(expect.arrayContaining([
      'Background-music target loudness must remain between -42 and -26 LUFS.',
      'Final true-peak ceiling must remain between -6 and -1 dBFS.',
    ]))
  })

  it('fails when speech ducking is absent or too weak', () => {
    const value = fixture()
    value.mix.speech_ducking.enabled = false
    value.mix.speech_ducking.minimum_reduction_db = 4
    expect(evaluate(value).blockers).toContain('Speech-aware ducking must be enabled with at least 10 dB reduction, 4:1 ratio, positive attack, and 100 ms release.')
  })

  it('fails bad fade and loop seam boundaries', () => {
    const value = fixture()
    value.mix.fade_in_seconds = 0
    value.timing.loop = { enabled: true, crossfade_seconds: 0.1, seam_validation_receipt: null }
    expect(evaluate(value).blockers).toEqual(expect.arrayContaining([
      'Looped music requires a version-bound seam validation receipt and at least a 0.5-second crossfade.',
      'Music fades must each be at least 0.5 seconds and fit inside the music-bed duration.',
    ]))
  })

  it('fails when final audio validation is absent', () => {
    const value = fixture()
    value.final_audio_validation = null
    expect(evaluate(value).blockers).toContain('A passed, version-bound final audio validation receipt is required.')
    expect(evaluate(value, false)).toEqual({ ready: true, blockers: [] })
  })

  it('fails clipping, dialogue drift, weak observed ducking, and bad fades in the rendered file', () => {
    const value = fixture()
    value.final_audio_validation = {
      ...value.final_audio_validation!,
      measured_true_peak_dbfs: -0.4,
      clipping_sample_count: 6,
      mixed_dialogue_lufs: -12,
      dialogue_lufs_delta: 4.2,
      observed_duck_reduction_db: 3,
      fade_boundary_passed: false,
    }
    expect(evaluate(value).blockers).toEqual(expect.arrayContaining([
      'Final audio validation detected clipping or a true peak above the approved ceiling.',
      'Mixed speech level diverges too far from the no-music master.',
      'Final audio validation did not observe the required speech ducking reduction.',
      'Final audio validation did not pass the music fade boundaries.',
    ]))
  })
})
