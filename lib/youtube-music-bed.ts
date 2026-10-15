export const YOUTUBE_MUSIC_BED_CONTRACT_VERSION = 'youtube_music_bed_v1' as const

export type YouTubeMusicReceiptStatus = 'approved' | 'passed' | 'complete' | 'pending' | 'blocked' | 'observed'

export type YouTubeMusicReceipt = {
  receipt_id: string
  status: YouTubeMusicReceiptStatus
  input_version: string
}

export type YouTubeMusicBedContract = {
  version: typeof YOUTUBE_MUSIC_BED_CONTRACT_VERSION
  status: 'approved' | 'pending_rights' | 'blocked'
  input_version: string
  track: {
    track_id: string
    title: string
    style_tags: string[]
    instrumental: boolean
    vocals: boolean
    source_reference: string
    staged_path: string
    sha256: string
    duration_seconds: number
    source_receipt: YouTubeMusicReceipt
    rights_receipt: YouTubeMusicReceipt
  }
  timing: {
    source_start_seconds: number
    timeline_start_seconds: number
    timeline_end_seconds: number
    loop: {
      enabled: boolean
      crossfade_seconds: number
      seam_validation_receipt: YouTubeMusicReceipt | null
    }
  }
  mix: {
    target_music_lufs: number
    target_final_lufs: number
    maximum_true_peak_dbfs: number
    speech_ducking: {
      enabled: boolean
      threshold_dbfs: number
      ratio: number
      attack_ms: number
      release_ms: number
      minimum_reduction_db: number
    }
    fade_in_seconds: number
    fade_out_seconds: number
  }
  final_audio_validation: {
    receipt_id: string
    status: YouTubeMusicReceiptStatus
    input_version: string
    output_sha256: string
    baseline_sha256: string
    measured_integrated_lufs: number
    measured_true_peak_dbfs: number
    baseline_dialogue_lufs: number
    mixed_dialogue_lufs: number
    dialogue_lufs_delta: number
    clipping_sample_count: number
    observed_duck_reduction_db: number
    fade_boundary_passed: boolean
    loop_seam_passed: boolean
  } | null
}

export type YouTubeMusicBedReadiness = {
  ready: boolean
  blockers: string[]
}

function unique(values: string[]) {
  return [...new Set(values)]
}

function passed(status: YouTubeMusicReceiptStatus) {
  return status === 'approved' || status === 'passed' || status === 'complete'
}

export function evaluateYouTubeMusicBed(input: {
  musicBed: YouTubeMusicBedContract | null | undefined
  expectedInputVersion: string
  videoDurationSeconds: number
  approvedSourceReceiptIds: string[]
  approvedRightsReceiptIds: string[]
  approvedTrackSha256ById: Record<string, string>
  requireFinalAudioValidation?: boolean
}): YouTubeMusicBedReadiness {
  const value = input.musicBed
  const blockers: string[] = []
  if (!value) return { ready: false, blockers: ['A version-bound YouTube background-music contract is required.'] }

  if (value.version !== YOUTUBE_MUSIC_BED_CONTRACT_VERSION) blockers.push('YouTube background-music contract version is missing or unsupported.')
  if (value.input_version !== input.expectedInputVersion) blockers.push('YouTube background-music contract is stale for the approved content version.')
  if (value.status !== 'approved') blockers.push('Background-music track selection remains blocked until source and rights receipts are approved.')

  const track = value.track
  if (!track.track_id.trim() || !track.title.trim() || !track.source_reference.trim() || !track.staged_path.trim()) {
    blockers.push('Background music requires a stable track identity, source reference, and staged local path.')
  }
  if (!track.sha256.startsWith('sha256:')) blockers.push('Background music requires an exact SHA-256 input binding.')
  const approvedHash = input.approvedTrackSha256ById[track.track_id]
  if (!approvedHash || approvedHash !== track.sha256) blockers.push('Background-music input hash is missing, stale, or unapproved.')
  if (!Number.isFinite(track.duration_seconds) || track.duration_seconds <= 0) blockers.push('Background music requires a positive source duration.')
  const styles = new Set(track.style_tags.map((tag) => tag.toLowerCase().replace(/[^a-z0-9]+/g, '_')))
  if (!styles.has('lo_fi') || !styles.has('jazz') || !styles.has('hip_hop')) blockers.push('Background music must be explicitly classified as lo-fi, jazz, and hip-hop.')
  if (!track.instrumental || track.vocals) blockers.push('Background music must be an instrumental with no vocals.')

  if (!passed(track.source_receipt.status)
    || track.source_receipt.input_version !== value.input_version
    || !input.approvedSourceReceiptIds.includes(track.source_receipt.receipt_id)) {
    blockers.push('Background-music source receipt is missing, stale, or unapproved.')
  }
  if (!passed(track.rights_receipt.status)
    || track.rights_receipt.input_version !== value.input_version
    || !input.approvedRightsReceiptIds.includes(track.rights_receipt.receipt_id)) {
    blockers.push('Background-music rights receipt is missing, stale, or unapproved.')
  }

  const timing = value.timing
  const bedDuration = timing.timeline_end_seconds - timing.timeline_start_seconds
  if (timing.source_start_seconds < 0 || timing.timeline_start_seconds < 0 || bedDuration <= 0 || timing.timeline_end_seconds > input.videoDurationSeconds + 0.02) {
    blockers.push('Background-music start and end timing must stay inside the video timeline.')
  }
  if (!timing.loop.enabled && timing.source_start_seconds + bedDuration > track.duration_seconds + 0.02) {
    blockers.push('A non-looping music bed cannot run beyond the approved source duration.')
  }
  if (timing.loop.enabled) {
    if (timing.loop.crossfade_seconds < 0.5 || !timing.loop.seam_validation_receipt || !passed(timing.loop.seam_validation_receipt.status)
      || timing.loop.seam_validation_receipt.input_version !== value.input_version) {
      blockers.push('Looped music requires a version-bound seam validation receipt and at least a 0.5-second crossfade.')
    }
  } else if (timing.loop.crossfade_seconds !== 0) {
    blockers.push('Non-looping music must not declare a loop crossfade.')
  }

  const mix = value.mix
  if (mix.target_music_lufs > -26 || mix.target_music_lufs < -42) blockers.push('Background-music target loudness must remain between -42 and -26 LUFS.')
  if (mix.target_final_lufs > -14 || mix.target_final_lufs < -24) blockers.push('Final program loudness target must remain between -24 and -14 LUFS.')
  if (mix.maximum_true_peak_dbfs > -1 || mix.maximum_true_peak_dbfs < -6) blockers.push('Final true-peak ceiling must remain between -6 and -1 dBFS.')
  if (!mix.speech_ducking.enabled || mix.speech_ducking.minimum_reduction_db < 10
    || mix.speech_ducking.ratio < 4 || mix.speech_ducking.attack_ms <= 0 || mix.speech_ducking.release_ms < 100) {
    blockers.push('Speech-aware ducking must be enabled with at least 10 dB reduction, 4:1 ratio, positive attack, and 100 ms release.')
  }
  if (mix.fade_in_seconds < 0.5 || mix.fade_out_seconds < 0.5
    || mix.fade_in_seconds + mix.fade_out_seconds >= bedDuration) {
    blockers.push('Music fades must each be at least 0.5 seconds and fit inside the music-bed duration.')
  }

  if (input.requireFinalAudioValidation !== false) {
    const validation = value.final_audio_validation
    if (!validation || !passed(validation.status) || validation.input_version !== value.input_version
      || !validation.receipt_id.trim() || !validation.output_sha256.startsWith('sha256:')
      || !validation.baseline_sha256.startsWith('sha256:')) {
      blockers.push('A passed, version-bound final audio validation receipt is required.')
    } else {
      if (validation.measured_true_peak_dbfs > mix.maximum_true_peak_dbfs || validation.clipping_sample_count !== 0) {
        blockers.push('Final audio validation detected clipping or a true peak above the approved ceiling.')
      }
      if (validation.measured_integrated_lufs > mix.target_final_lufs + 1.5
        || validation.measured_integrated_lufs < mix.target_final_lufs - 3) {
        blockers.push('Final audio loudness falls outside the approved target tolerance.')
      }
      if (Math.abs(validation.dialogue_lufs_delta) > 1.5
        || Math.abs(validation.mixed_dialogue_lufs - validation.baseline_dialogue_lufs) > 1.5) {
        blockers.push('Mixed speech level diverges too far from the no-music master.')
      }
      if (validation.observed_duck_reduction_db < mix.speech_ducking.minimum_reduction_db) {
        blockers.push('Final audio validation did not observe the required speech ducking reduction.')
      }
      if (!validation.fade_boundary_passed) blockers.push('Final audio validation did not pass the music fade boundaries.')
      if (timing.loop.enabled && !validation.loop_seam_passed) blockers.push('Final audio validation did not pass the loop seam boundary.')
    }
  }

  return { ready: unique(blockers).length === 0, blockers: unique(blockers) }
}
