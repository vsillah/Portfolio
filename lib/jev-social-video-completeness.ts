export type JevCompletenessContract = {
  status: string
  artifact_id: string
  input_version: string
  canvas: { fps: number; frame_count: number }
  native_scene_bindings: Array<{ timeline_start_seconds: number; timeline_end_seconds: number }>
  visual_ownership: { max_concurrent_teaching_assets: number; frame_by_frame_validation: boolean }
  story: { cta_requires_spoken_track: boolean; cta_requires_semantic_transcript_match: boolean; approved_cta_text: string; cta_semantic_transcript_present: boolean; subscribe_cta_window: [number, number] }
  accepted_exceptions: Array<{ artifact_id: string; input_version: string; rule_id: 'script.semantic_spoken_cta'; accepted_by_user: true; visual_cta_present: true; weakens_future_default: false }>
}

export type JevAudioGate = {
  cta_requires_spoken_track: boolean
  cta_spoken_track_passed: boolean
  cta_semantic_transcript_present: boolean
  cta_voice_integrated_lufs: number
  cta_window_seconds: [number, number]
}

export function evaluateJevCompleteness(contract: JevCompletenessContract, audio: JevAudioGate) {
  const blockers: string[] = []
  let observedMax = 0
  for (let frame = 0; frame < contract.canvas.frame_count; frame += 1) {
    const second = frame / contract.canvas.fps
    const active = contract.native_scene_bindings.filter((scene) => second >= scene.timeline_start_seconds && second < scene.timeline_end_seconds).length
    observedMax = Math.max(observedMax, active)
  }
  if (!contract.visual_ownership.frame_by_frame_validation || contract.visual_ownership.max_concurrent_teaching_assets !== 1 || observedMax > 1) blockers.push('At most one teaching asset may be visible in every frame.')
  const sameWindow = contract.story.subscribe_cta_window[0] === audio.cta_window_seconds[0] && contract.story.subscribe_cta_window[1] === audio.cta_window_seconds[1]
  const semanticMatch = contract.story.cta_requires_semantic_transcript_match && contract.story.cta_semantic_transcript_present && audio.cta_semantic_transcript_present
  const acceptedException = contract.accepted_exceptions.some((entry) => entry.artifact_id === contract.artifact_id && entry.input_version === contract.input_version && entry.rule_id === 'script.semantic_spoken_cta' && entry.accepted_by_user && entry.visual_cta_present && entry.weakens_future_default === false)
  const acceptedStatus = contract.status === 'passed' || (contract.status === 'passed_with_accepted_artifact_exception' && acceptedException)
  if (!acceptedStatus || !contract.story.cta_requires_spoken_track || !audio.cta_requires_spoken_track || ((!audio.cta_spoken_track_passed || !semanticMatch) && !acceptedException) || audio.cta_voice_integrated_lufs <= -35 || !sameWindow) blockers.push(`CTA transcript must contain the exact approved line: ${contract.story.approved_cta_text}`)
  return { ready: blockers.length === 0, blockers, observedMaxConcurrentTeachingAssets: observedMax }
}
