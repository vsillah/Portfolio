#!/usr/bin/env python3
"""Render three review-only PCM presenter cuts where AAC packet cuts clipped words."""
import hashlib
import importlib.util
import json
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
NATIVE = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/native-jump-candidates'
OUT = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/sample-accurate-jump-candidates'
DIAGNOSTICS = NATIVE / 'rejected-boundary-diagnostics.json'
PACK = ROOT / 'docs/accelerated-course-modules/narration-production-pack-2026-11-10.json'
TRIAGE = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/presenter-jump-triage.json'
CUTS = {('L06', 'A01'): 18.08, ('L16', 'A01'): 24.90, ('L16', 'A02'): 184.20}
FADE_SECONDS = 0.04

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('native_jump', ROOT / 'scripts/qa/build-presenter-jump-candidates.py')
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True)


def build(row, pack, triage):
    lid, window = row['lesson_id'], row['presenter_window']
    old = row['rejected_receipt']
    entry = next(x for x in triage['entries'] if (x['lesson_id'], x['presenter_window']) == (lid, window))
    lesson = next(x for x in pack['lessons'] if x['lesson_id'] == lid)
    source = ROOT / old['source_path']
    assert sha(source) == old['source_sha256'] == entry['source_media_sha256']
    start, end = old['source_window_seconds']
    cut, length = CUTS[(lid, window)], end - start
    assert start + 1 < cut < end - 1
    assert round(cut * 48000) / 48000 == cut
    local_cut = cut - start
    base = f'{lid.lower()}-{window.lower()}-tail-pcm'
    candidate = OUT / f'{base}-candidate.mp4'
    comparison = OUT / f'{base}-before-after.mp4'
    receipt_path = OUT / f'{base}-receipt.json'
    with tempfile.TemporaryDirectory(prefix=base + '-') as tmp:
        scratch = pathlib.Path(tmp)
        card = scratch / 'adjacent-source-card.png'
        label = scratch / 'after-label.png'
        before_label = scratch / 'before-label.png'
        run(['ffmpeg', '-v', 'error', '-ss', str(end + 1), '-i', str(source),
             '-frames:v', '1', '-y', str(card)])
        title = f'{lid} {window} · PCM CUT {cut // 60:02.0f}:{cut % 60:05.2f}'
        detail = f'Source {start:.2f}–{end:.2f} s · re-encoded local candidate'
        native.make_label(label, title, detail)
        native.make_label(before_label, title, detail, before=True)
        audio_filter = (f'[0:a]atrim=duration={length:.6f},asetpts=PTS-STARTPTS,'
                        f'aresample=48000,atrim=end={local_cut:.6f},'
                        f'afade=t=out:st={local_cut - FADE_SECONDS:.6f}:d={FADE_SECONDS:.6f},'
                        f'apad=pad_dur={end - cut:.6f},atrim=end={length:.6f}[a]')
        visual_filter = (f'[0:v]trim=duration={length:.6f},setpts=PTS-STARTPTS[base];'
                         f"[base][1:v]overlay=enable='gte(t,{local_cut:.6f})':"
                         'shortest=0:repeatlast=1[card];'
                         '[card][2:v]overlay=shortest=0:repeatlast=1:format=auto,'
                         'format=yuv420p[v]')
        run(['ffmpeg', '-v', 'error', '-ss', f'{start:.6f}', '-i', str(source),
             '-loop', '1', '-i', str(card), '-loop', '1', '-i', str(label),
             '-filter_complex', visual_filter + ';' + audio_filter,
             '-map', '[v]', '-map', '[a]', '-t', f'{length:.6f}', '-r', '25',
             '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
             '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
             '-movflags', '+faststart', '-y', str(candidate)])
        local_start = max(0, local_cut - 3.5)
        local_end = min(length, local_cut + 3.5)
        review_len = local_end - local_start
        run(['ffmpeg', '-v', 'error', '-ss', f'{start + local_start:.6f}', '-i', str(source),
             '-ss', f'{local_start:.6f}', '-i', str(candidate),
             '-loop', '1', '-i', str(before_label),
             '-filter_complex',
             f'[0:v]trim=duration={review_len:.6f},setpts=PTS-STARTPTS[v0raw];'
             '[v0raw][2:v]overlay=shortest=1:repeatlast=1:format=auto[v0];'
             f'[1:v]trim=duration={review_len:.6f},setpts=PTS-STARTPTS[v1];'
             f'[0:a]atrim=duration={review_len:.6f},asetpts=PTS-STARTPTS[a0];'
             f'[1:a]atrim=duration={review_len:.6f},asetpts=PTS-STARTPTS[a1];'
             '[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]',
             '-map', '[v]', '-map', '[a]', '-t', f'{2 * review_len + .1:.6f}',
             '-r', '25', '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
             '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-y', str(comparison)])
        for path in (candidate, comparison):
            run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(path), '-f', 'null', '-'])
        measured_duration = float(native.probe(candidate)['format']['duration'])
        assert abs(measured_duration - length) < .1
        # This segment starts well after the fade. It must contain only codec noise.
        silence = scratch / 'post-cut.wav'
        run(['ffmpeg', '-v', 'error', '-ss', f'{local_cut + .12:.6f}', '-i', str(candidate),
             '-t', f'{max(.4, end - cut - .25):.6f}', '-vn', '-y', str(silence)])
        peak = native.silence_peak(silence)
        assert peak <= -70, (lid, window, peak)
    receipt = {
        'status': 'review_only_pcm_candidate_not_audibly_signed_off',
        'lesson_id': lid, 'presenter_window': window, 'orientation': 'tail',
        'source_path': old['source_path'], 'source_sha256': sha(source),
        'source_window_seconds': [start, end], 'candidate_cut_seconds': cut,
        'cut_sample_index_48000hz': round(local_cut * 48000),
        'fade_start_seconds': round(cut - FADE_SECONDS, 6),
        'fade_duration_seconds': FADE_SECONDS,
        'audio_treatment': 'Decode source AAC to 48 kHz PCM; retain through the sample-accurate cut with a 40 ms final fade; pad the rest with digital silence; encode the entire candidate AAC at 192 kb/s.',
        'audio_reencoded_entire_window': True,
        'source_aac_packets_copied': False,
        'intended_words': old['intended_words'],
        'post_cut_silence_peak_dbfs': peak,
        'candidate_path': str(candidate.relative_to(ROOT)), 'candidate_sha256': sha(candidate),
        'before_after_path': str(comparison.relative_to(ROOT)), 'before_after_sha256': sha(comparison),
        'before_after_source_excerpt_seconds': [start + local_start, start + local_end],
        'candidate_duration_seconds': measured_duration,
        'before_after_duration_seconds': float(native.probe(comparison)['format']['duration']),
        'full_mp4_decode': 'passed', 'voice_generation': False, 'learner_binding': False,
        'residual_uncertainty': 'ASR and waveform timing cannot replace audible first/last-phoneme review; the full lesson and adjacent presenter windows remain unresolved.'
    }
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    return {'lesson_id': lid, 'presenter_window': window,
            'status': 'rendered_pending_full_mp4_asr_and_audible_review',
            'receipt': str(receipt_path.relative_to(ROOT))}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    diagnostics = json.loads(DIAGNOSTICS.read_text())
    assert {(x['lesson_id'], x['presenter_window']) for x in diagnostics['results']} == set(CUTS)
    pack, triage = json.loads(PACK.read_text()), json.loads(TRIAGE.read_text())
    results = [build(row, pack, triage) for row in diagnostics['results']]
    validation = OUT / 'asr-validation.json'
    if validation.exists():
        checked = {(x['lesson_id'], x['presenter_window']): x
                   for x in json.loads(validation.read_text())['results']}
        for result in results:
            receipt = json.loads((ROOT / result['receipt']).read_text())
            row = checked.get((result['lesson_id'], result['presenter_window']))
            if row and row['candidate_sha256'] == receipt['candidate_sha256']:
                result['status'] = ('machine_pass_pending_audible_review'
                                    if row['machine_result'].startswith('passed')
                                    else 'machine_blocked_cut_boundary')
    manifest = {'schema_version': 1, 'status': 'review_only_pcm_reencoded',
                'source_diagnostics_sha256': sha(DIAGNOSTICS), 'source_pack_sha256': sha(PACK),
                'source_triage_sha256': sha(TRIAGE),
                'asr_validation_path': str(validation.relative_to(ROOT)) if validation.exists() else None,
                'results': results, 'rendered_count': len(results),
                'machine_pass_count': sum(x['status'] == 'machine_pass_pending_audible_review' for x in results),
                'audibly_approved_count': 0}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f'Rendered {len(results)} sample-accurate candidates')


if __name__ == '__main__':
    main()
