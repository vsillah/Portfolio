#!/usr/bin/env python3
"""Render local A02-tail to A03-head sentence moves using existing source audio."""
import hashlib
import importlib.util
import json
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
PACK = ROOT / 'docs/accelerated-course-modules/narration-production-pack-2026-11-10.json'
OUT = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/coordinated-presenter-sequences'
SPECS = {
    'L05': {'cut': 218.46, 'opening': 'Our six notes support a question',
            'following': 'not a verdict'},
    'L06': {'cut': 234.52, 'opening': 'Imagine the team tests the card',
            'following': 'and finds'},
    'L08': {'cut': 256.00, 'opening': 'Before there is any data',
            'following': 'walk the plan'},
}

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('native_jump', ROOT / 'scripts/qa/build-presenter-jump-candidates.py')
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, check=True)


def media_duration(path):
    return float(native.probe(path)['format']['duration'])


def render(lesson, proposal):
    lid = lesson['lesson_id']
    source = ROOT / lesson['native_source']['path']
    assert sha(source) == lesson['native_source']['sha256']
    windows = [w for w in lesson['windows'] if w['kind'] == 'presenter']
    a02, a03 = windows[1:3]
    s2, e2 = a02['native_media_start_seconds'], a02['native_media_end_seconds']
    s3, e3 = a03['native_media_start_seconds'], a03['native_media_end_seconds']
    cut = proposal['cut']
    assert s2 + 2 < cut < e2 - .5 and cut < s3 < e3
    prefix_len, a02_len, a03_len = e2 - cut, e2 - s2, e3 - s3
    stem = lid.lower()
    a02_media = OUT / f'{stem}-a02-retained-review.mp4'
    a03_media = OUT / f'{stem}-a03-restored-review.mp4'
    compare = OUT / f'{stem}-sequence-before-after.mp4'
    with tempfile.TemporaryDirectory(prefix=stem+'-sequence-') as tmp:
        scratch = pathlib.Path(tmp)
        card = scratch / 'c02-end-card.png'
        a02_card = scratch / 'a02-next-card.png'
        a02_label = scratch / 'a02-after-label.png'
        a03_label = scratch / 'a03-after-label.png'
        before_label = scratch / 'before-label.png'
        run(['ffmpeg', '-v', 'error', '-ss', str(s3 - 1), '-i', str(source),
             '-frames:v', '1', '-y', str(card)])
        run(['ffmpeg', '-v', 'error', '-ss', str(e2 + 1), '-i', str(source),
             '-frames:v', '1', '-y', str(a02_card)])
        native.make_label(a02_label, f'{lid} A02 · MOVE SENTENCE OPENING',
                          f'Retain through {cut:.2f} s · local proposal only')
        native.make_label(a03_label, f'{lid} A03 · RESTORED SENTENCE',
                          f'{prefix_len:.2f} s native A02 audio before A03 · local proposal')
        native.make_label(before_label, f'{lid} A02 → A03 · SOURCE ORDER',
                          'C02 cutaway lies between the two presenter windows', before=True)
        a02_filters = (f'[0:v]trim=duration={a02_len:.6f},setpts=PTS-STARTPTS[base];'
                       f"[base][1:v]overlay=enable='gte(t,{cut-s2:.6f})':"
                       'shortest=0:repeatlast=1[card];'
                       '[card][2:v]overlay=shortest=0:repeatlast=1:format=auto,format=yuv420p[v];'
                       f'[0:a]atrim=duration={a02_len:.6f},asetpts=PTS-STARTPTS,'
                       f'aresample=48000,atrim=end={cut-s2:.6f},'
                       f'apad=pad_dur={prefix_len:.6f},atrim=end={a02_len:.6f}[a]')
        run(['ffmpeg', '-v', 'error', '-ss', str(s2), '-i', str(source),
             '-loop', '1', '-i', str(a02_card), '-loop', '1', '-i', str(a02_label),
             '-filter_complex', a02_filters, '-map', '[v]', '-map', '[a]',
             '-t', f'{a02_len:.6f}', '-r', '25', '-c:v', 'libx264',
             '-preset', 'medium', '-crf', '20', '-c:a', 'aac', '-b:a', '192k',
             '-ar', '48000', '-movflags', '+faststart', '-y', str(a02_media)])
        a03_filters = (f'[2:v]trim=duration={prefix_len:.6f},setpts=PTS-STARTPTS[v0];'
                       f'[1:v]trim=duration={a03_len:.6f},setpts=PTS-STARTPTS[v1];'
                       '[v0][v1]concat=n=2:v=1:a=0[vraw];'
                       '[vraw][3:v]overlay=shortest=0:repeatlast=1:format=auto,format=yuv420p[v];'
                       f'[0:a]atrim=duration={prefix_len:.6f},asetpts=PTS-STARTPTS,aresample=48000[a0];'
                       f'[1:a]atrim=duration={a03_len:.6f},asetpts=PTS-STARTPTS,aresample=48000[a1];'
                       '[a0][a1]concat=n=2:v=0:a=1[a]')
        run(['ffmpeg', '-v', 'error', '-ss', f'{cut:.6f}', '-i', str(source),
             '-ss', f'{s3:.6f}', '-i', str(source),
             '-loop', '1', '-i', str(card), '-loop', '1', '-i', str(a03_label),
             '-filter_complex', a03_filters, '-map', '[v]', '-map', '[a]',
             '-t', f'{prefix_len+a03_len:.6f}', '-r', '25', '-c:v', 'libx264',
             '-preset', 'medium', '-crf', '20', '-c:a', 'aac', '-b:a', '192k',
             '-ar', '48000', '-movflags', '+faststart', '-y', str(a03_media)])
        # The four short segments show source A02, source A03, moved A02,
        # restored A03 in that order. The actual C02 cutaway is omitted but
        # explicitly identified by the label and receipt.
        a02_tail_start = max(s2, cut - 3.5)
        a02_tail_len = e2 - a02_tail_start
        a03_head_len = min(5.0, a03_len)
        after_a02_start = a02_tail_start - s2
        after_a03_len = prefix_len + a03_head_len
        run(['ffmpeg', '-v', 'error', '-ss', f'{a02_tail_start:.6f}', '-i', str(source),
             '-ss', f'{s3:.6f}', '-i', str(source),
             '-ss', f'{after_a02_start:.6f}', '-i', str(a02_media),
             '-i', str(a03_media), '-loop', '1', '-i', str(before_label),
             '-filter_complex',
             f'[0:v]trim=duration={a02_tail_len:.6f},setpts=PTS-STARTPTS[v0raw];'
             f'[1:v]trim=duration={a03_head_len:.6f},setpts=PTS-STARTPTS[v1raw];'
             '[v0raw][4:v]overlay=shortest=1:repeatlast=1:format=auto[v0];'
             '[v1raw][4:v]overlay=shortest=1:repeatlast=1:format=auto[v1];'
             f'[2:v]trim=duration={a02_tail_len:.6f},setpts=PTS-STARTPTS[v2];'
             f'[3:v]trim=duration={after_a03_len:.6f},setpts=PTS-STARTPTS[v3];'
             f'[0:a]atrim=duration={a02_tail_len:.6f},asetpts=PTS-STARTPTS[a0];'
             f'[1:a]atrim=duration={a03_head_len:.6f},asetpts=PTS-STARTPTS[a1];'
             f'[2:a]atrim=duration={a02_tail_len:.6f},asetpts=PTS-STARTPTS[a2];'
             f'[3:a]atrim=duration={after_a03_len:.6f},asetpts=PTS-STARTPTS[a3];'
             '[v0][a0][v1][a1][v2][a2][v3][a3]concat=n=4:v=1:a=1[v][a]',
             '-map', '[v]', '-map', '[a]', '-r', '25', '-c:v', 'libx264',
             '-preset', 'fast', '-crf', '22', '-c:a', 'aac', '-b:a', '192k',
             '-movflags', '+faststart', '-y', str(compare)])
        post_cut = scratch / 'a02-post-cut.wav'
        run(['ffmpeg', '-v', 'error', '-ss', f'{cut-s2+.12:.6f}', '-i', str(a02_media),
             '-t', f'{max(.4, prefix_len-.25):.6f}', '-vn', '-y', str(post_cut)])
        post_cut_peak = native.silence_peak(post_cut)
        assert post_cut_peak <= -70, (lid, post_cut_peak)
    for path in (a02_media, a03_media, compare):
        run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(path), '-f', 'null', '-'])
    assert abs(media_duration(a02_media) - a02_len) < .12
    assert abs(media_duration(a03_media) - (prefix_len+a03_len)) < .12
    receipt = {'status': 'review_only_coordinated_sequence_not_timeline_ready',
               'lesson_id': lid, 'source_path': lesson['native_source']['path'],
               'source_sha256': sha(source), 'source_a02_seconds': [s2, e2],
               'source_a03_seconds': [s3, e3], 'split_seconds': cut,
               'split_sample_index_48000hz': round((cut-s2)*48000),
               'moved_source_audio_seconds': [cut, e2],
               'moved_opening_duration_seconds': prefix_len,
               'a02_post_cut_silence_peak_dbfs': post_cut_peak,
               'approved_sentence_opening': proposal['opening'],
               'approved_following_words': proposal['following'],
               'audio_treatment': 'Decode two native source spans to PCM, split A02 at an exact 48 kHz sample boundary, pad A02 with silence, prepend moved source tail to A03, re-encode review audio as AAC. No generated voice.',
               'audio_reencoded': True, 'source_aac_packets_copied': False,
               'c02_cutaway_unmodified': True, 'a03_timeline_expansion_seconds': prefix_len,
               'timing_gate': 'The moved opening consumes additional time immediately before A03. C02/A03 timing must be reviewed before a full-lesson edit; this artifact has no canonical time binding.',
               'a02_candidate_path': str(a02_media.relative_to(ROOT)),
               'a02_candidate_sha256': sha(a02_media),
               'a03_restored_path': str(a03_media.relative_to(ROOT)),
               'a03_restored_sha256': sha(a03_media),
               'before_after_path': str(compare.relative_to(ROOT)),
               'before_after_sha256': sha(compare),
               'a02_candidate_duration_seconds': media_duration(a02_media),
               'a03_restored_duration_seconds': media_duration(a03_media),
               'comparison_duration_seconds': media_duration(compare),
               'full_mp4_decode': 'passed', 'voice_generation': False,
               'learner_binding': False,
               'residual_uncertainty': 'Audible word-boundary review and C02-to-A03 timing fit remain open.'}
    receipt_path = OUT / f'{stem}-receipt.json'
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    return {'lesson_id': lid, 'status': 'rendered_pending_full_mp4_asr_and_audible_review',
            'receipt': str(receipt_path.relative_to(ROOT))}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    pack = json.loads(PACK.read_text())
    results = [render(next(x for x in pack['lessons'] if x['lesson_id'] == lid), proposal)
               for lid, proposal in SPECS.items()]
    validation = OUT / 'asr-validation.json'
    if validation.exists():
        checked = {x['lesson_id']: x for x in json.loads(validation.read_text())['results']}
        for result in results:
            receipt = json.loads((ROOT / result['receipt']).read_text())
            row = checked.get(result['lesson_id'])
            if (row and row['a02_candidate_sha256'] == receipt['a02_candidate_sha256']
                    and row['a03_restored_sha256'] == receipt['a03_restored_sha256']):
                result['status'] = ('machine_pass_pending_audible_and_timing_review'
                                    if row['machine_result'].startswith('passed') else 'machine_blocked')
    manifest = {'schema_version': 1, 'status': 'review_only_not_timeline_ready',
                'source_pack_sha256': sha(PACK), 'rendered_count': len(results),
                'results': results, 'narration_pack_modified': False,
                'learner_media_modified': False,
                'asr_validation_path': str(validation.relative_to(ROOT)) if validation.exists() else None,
                'machine_pass_count': sum(x['status'] == 'machine_pass_pending_audible_and_timing_review' for x in results)}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f'Rendered {len(results)} coordinated local sequence proposals')


if __name__ == '__main__':
    main()
