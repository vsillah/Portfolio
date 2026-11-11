#!/usr/bin/env python3
"""Source-bound clean-visual EDL; optionally composite a review-only L05 lesson."""
import hashlib
import importlib.util
import json
import pathlib
import subprocess
import sys
import tempfile

from PIL import Image, ImageChops, ImageStat

sys.dont_write_bytecode = True
ROOT = pathlib.Path(__file__).resolve().parents[2]
BASE = pathlib.Path('artifacts/accelerated-visual-parity-2026-11-10')
OUT = BASE / 'clean-shell-review'
MANIFEST = pathlib.Path('docs/accelerated-course-modules/visual-production/manifest.json')
COMPOSITES = BASE / 'composite-receipt.json'
CLEAN = OUT / 'receipt.json'
FPS = 25


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


renderer = module('accelerated_edl_renderer', 'scripts/qa/render-accelerated-visual-parity.py')
composer = module('accelerated_edl_composer', 'scripts/qa/compose-accelerated-visual-parity.py')


def sha(path):
    digest = hashlib.sha256()
    with (ROOT / path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def run(args):
    return subprocess.run(args, check=True, capture_output=True)


def frames(seconds):
    return round(seconds * FPS)


def duration(frame_count):
    return frame_count / FPS


def scene_beats(scene, starts):
    sid = scene['id']
    start, end = scene['start_seconds'], scene['end_seconds']
    if sid == 'L05-02':
        return [(start, starts['L05-02'], 'main'), (starts['L05-02'], end, 'second')]
    if sid == 'L05-03':
        return [(start, starts['L05-03-F05'], 'main'),
                (starts['L05-03-F05'], starts['L05-03-F06'], 'f05'),
                (starts['L05-03-F06'], end, 'f06')]
    if sid == 'L09-02':
        return [(start, starts['L09-02'], 'main'), (starts['L09-02'], end, 'second')]
    if sid in renderer.ART_BEATS:
        cursor = start
        beats = []
        for kind, seconds in renderer.ART_BEATS[sid]:
            beats.append((cursor, cursor + seconds, kind))
            cursor += seconds
        assert cursor == end, sid
        return beats
    return [(start, end, 'main')]


def preview_for(row, variant):
    if variant == 'main':
        return row['preview']
    options = [entry for entry in row['variants'] if pathlib.Path(entry['path']).stem == f"{row['scene_id']}-{variant}"]
    assert len(options) == 1, (row['scene_id'], variant)
    return options[0]


def make_edl():
    manifest = json.loads((ROOT / MANIFEST).read_text())
    media_receipt = json.loads((ROOT / COMPOSITES).read_text())
    clean = json.loads((ROOT / CLEAN).read_text())
    assert clean['source_manifest']['sha256'] == sha(MANIFEST)
    assert clean['source_renderer']['sha256'] == sha(pathlib.Path(clean['source_renderer']['path']))
    assert clean['scene_count'] == 91
    starts = clean['second_beat_source_vtt_starts']
    assert starts == {'L05-02': 157.674, 'L09-02': 152.664,
                      'L05-03-F05': 252.093, 'L05-03-F06': 273.953}
    clean_by_scene = {row['scene_id']: row for row in clean['scenes']}
    media_by_lesson = {row['lesson_id']: row for row in media_receipt['composites']}
    lessons = []
    for number in range(2, 17):
        lid = f'L{number:02d}'
        lesson = next(row for row in manifest['lessons'] if row['id'] == lid)
        media = media_by_lesson[lid]
        assert sha(pathlib.Path(media['source_path'])) == media['source_sha256']
        assert sha(pathlib.Path(media['caption_path'])) == media['caption_sha256']
        assert sha(pathlib.Path(media['output_path'])) == media['output_sha256']
        presenter, source_duration = composer.windows(number)
        assert source_duration == lesson['runtime_seconds']
        segments = []
        for scene in lesson['scenes']:
            if scene['id'] == 'L16-06':
                continue
            assert sha(pathlib.Path(scene['script_path'])) == scene['script_sha256']
            row = clean_by_scene[scene['id']]
            assert row['script_sha256'] == scene['script_sha256']
            for exact_start, exact_end, variant in scene_beats(scene, starts):
                a, b = frames(exact_start), frames(exact_end)
                assert b > a, (scene['id'], variant)
                preview = preview_for(row, variant)
                assert sha(pathlib.Path(preview['path'])) == preview['sha256']
                segments.append({'scene_id': scene['id'], 'variant': variant,
                                 'source_cue_seconds': [exact_start, exact_end],
                                 'start_frame': a, 'end_frame': b,
                                 'start_seconds': duration(a), 'end_seconds': duration(b),
                                 'start_quantization_ms': round((duration(a) - exact_start) * 1000, 1),
                                 'preview': preview,
                                 'script_sha256': scene['script_sha256'],
                                 'caption_content_qualification': 'cleared_in_390px_product_size_player_excerpt' if
                                                           scene['id'] == 'L05-03' and variant in ('f05', 'f06') else
                                                           'not_yet_browser_qualified'})
        assert segments[0]['start_frame'] == 0
        assert all(left['end_frame'] == right['start_frame'] for left, right in zip(segments, segments[1:]))
        expected_end = frames(lesson['scenes'][-2]['end_seconds'] if number == 16 else lesson['runtime_seconds'])
        assert segments[-1]['end_frame'] == expected_end
        lessons.append({'lesson_id': lid, 'runtime_seconds': lesson['runtime_seconds'],
                        'rendered_body_seconds': duration(expected_end),
                        'full_lesson_renderable': number != 16,
                        'source_native_mp4': {'path': media['source_path'], 'sha256': media['source_sha256']},
                        'source_vtt': {'path': media['caption_path'], 'sha256': media['caption_sha256']},
                        'current_visual_mp4': {'path': media['output_path'], 'sha256': media['output_sha256']},
                        'presenter_windows_seconds': presenter,
                        'presenter_panel': composer.presenter_panel(number),
                        'segments': segments,
                        'audio_treatment': 'copy source native AAC; existing cutaway silence stays silent',
                        'caption_treatment': 'copy source subtitle stream; final voice retiming remains open'})
    return {'schema_version': 1, 'status': 'review_only_clean_visual_edl',
            'source_manifest': {'path': str(MANIFEST), 'sha256': sha(MANIFEST)},
            'source_composite_receipt': {'path': str(COMPOSITES), 'sha256': sha(COMPOSITES)},
            'clean_frame_receipt': {'path': str(CLEAN), 'sha256': sha(CLEAN)},
            'fps': FPS, 'lessons': lessons,
            'caption_safe_observation': {'scope': 'L05-03 F05/F06 excerpt only; other scenes require rendered QA',
                                         'status': 'cleared_in_chrome_localhost_excerpt',
                                         'desktop_viewport': [1696, 962],
                                         'mobile_viewport': [390, 844],
                                         'mobile_video_stage_height': 280,
                                         'player_css_reference': 'app/service-prototypes/[slug]/learning-plan.module.css:115-136'},
            'excluded_scope': ['L01', 'L16-06 end-screen lane', 'final narration generation',
                               'canonical media and learner binding changes']}


def packet_hash(path, stream_type):
    format_name = 'adts' if stream_type == 'a' else 'srt'
    codec = ['-c', 'copy'] if stream_type == 'a' else []
    output = run(['ffmpeg', '-v', 'error', '-i', str(ROOT / path), '-map', f'0:{stream_type}:0',
                  *codec, '-f', format_name, '-']).stdout
    return hashlib.sha256(output).hexdigest()


def still(path, at, target):
    run(['ffmpeg', '-v', 'error', '-ss', str(at), '-i', str(ROOT / path),
         '-frames:v', '1', '-update', '1', '-y', str(target)])


def render_l05(edl):
    lesson = next(row for row in edl['lessons'] if row['lesson_id'] == 'L05')
    manifest = json.loads((ROOT / MANIFEST).read_text())
    source_lesson = next(row for row in manifest['lessons'] if row['id'] == 'L05')
    scenes = {row['id']: (index, row) for index, row in enumerate(source_lesson['scenes'])}
    source = pathlib.Path(lesson['source_native_mp4']['path'])
    output = OUT / 'l05-clean-visual-full-review.mp4'
    with tempfile.TemporaryDirectory(prefix='l05-clean-visual-') as scratch:
        scratch = pathlib.Path(scratch)
        frame_paths = {}
        for segment in lesson['segments']:
            sid, variant = segment['scene_id'], segment['variant']
            index, scene = scenes[sid]
            if (sid, variant) not in frame_paths:
                path = scratch / f'{sid}-{variant}.png'
                renderer.render(source_lesson, scene, index,
                                variant=None if variant == 'main' else variant, clean=True).save(path)
                frame_paths[(sid, variant)] = path
            if (sid, 'presenter') not in frame_paths:
                path = scratch / f'{sid}-presenter.png'
                renderer.render(source_lesson, scene, index, presenter=True, clean=True).save(path)
                frame_paths[(sid, 'presenter')] = path
        for mode in ('concept', 'presenter'):
            lines = []
            for segment in lesson['segments']:
                key = (segment['scene_id'], segment['variant'] if mode == 'concept' else 'presenter')
                path = frame_paths[key]
                lines.extend([f"file '{path}'", f"duration {duration(segment['end_frame'] - segment['start_frame']):.6f}"])
            lines.append(f"file '{path}'")
            (scratch / f'{mode}.txt').write_text('\n'.join(lines) + '\n')
        x, y, w, h = lesson['presenter_panel']
        enable = '+'.join(f'between(t,{a},{b})' for a, b in lesson['presenter_windows_seconds'])
        filt = (f'[0:v]fps=25,format=yuv420p[art];[1:v]fps=25,format=yuv420p[presenterArt];'
                f"[art][presenterArt]overlay=enable='{enable}':shortest=1[base];"
                f'[2:v]crop={w}:{h}:{x}:{y},format=yuv420p[presenter];'
                f"[base][presenter]overlay={x}:{y}:enable='{enable}':shortest=1,format=yuv420p[v]")
        run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(scratch / 'concept.txt'),
             '-f', 'concat', '-safe', '0', '-i', str(scratch / 'presenter.txt'), '-i', str(ROOT / source),
             '-filter_complex', filt, '-map', '[v]', '-map', '2:a:0', '-map', '2:s:0',
             '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-r', '25', '-frames:v', '15000',
             '-c:a', 'copy', '-c:s', 'copy', '-t', '600', '-movflags', '+faststart', str(ROOT / output)])
        run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(ROOT / output), '-f', 'null', '-'])
        probe = json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format',
                                '-of', 'json', str(ROOT / output)]).stdout)
        assert [row['codec_type'] for row in probe['streams']] == ['video', 'audio', 'subtitle']
        assert int(probe['streams'][0]['nb_frames']) == 15000
        assert abs(float(probe['format']['duration']) - 600) < .05
        audio_hash = packet_hash(source, 'a')
        caption_hash = packet_hash(source, 's')
        assert packet_hash(output, 'a') == audio_hash
        assert packet_hash(output, 's') == caption_hash
        x, y, w, h = lesson['presenter_panel']
        presenter_error = {}
        for time in (8, 210, 405, 580):
            native = scratch / f'native-{time}.png'
            revised = scratch / f'revised-{time}.png'
            still(source, time, native)
            still(output, time, revised)
            with Image.open(native) as a, Image.open(revised) as b:
                diff = ImageChops.difference(a.convert('RGB').crop((x, y, x+w, y+h)),
                                             b.convert('RGB').crop((x, y, x+w, y+h)))
                mean = sum(ImageStat.Stat(diff).mean) / 3
            assert mean < 5, (time, mean)
            presenter_error[str(time)] = round(mean, 3)
        samples = []
        for time in (112, 164, 245, 260, 285, 405, 550):
            target = OUT / f'l05-review-{time:03d}s.jpg'
            run(['ffmpeg', '-v', 'error', '-ss', str(time), '-i', str(ROOT / output),
                 '-frames:v', '1', '-vf', 'scale=960:540', '-q:v', '3', '-update', '1', '-y', str(ROOT / target)])
            samples.append({'source_seconds': time, 'path': str(target), 'sha256': sha(target)})
    return {'path': str(output), 'sha256': sha(output), 'duration_seconds': 600,
            'video_frames': 15000, 'full_decode': 'passed',
            'source_audio_aac_packet_sha256': audio_hash,
            'copied_subtitle_srt_sha256': caption_hash,
            'presenter_panel_mean_rgb_error': presenter_error,
            'sample_frames': samples,
            'review_only': True, 'full_lesson_visual_qa': 'not_yet_qualified',
            'source_cutaway_silence_retained': True,
            'canonical_media_or_learner_binding_changed': False}


def main():
    edl = make_edl()
    if '--render-l05' in sys.argv[1:]:
        edl['l05_visual_only_candidate'] = render_l05(edl)
    target = OUT / 'full-lesson-edl.json'
    (ROOT / target).write_text(json.dumps(edl, ensure_ascii=False, indent=2) + '\n')
    print(f'Wrote {target}: {len(edl["lessons"])} lessons; L05 rendered: {"l05_visual_only_candidate" in edl}')


if __name__ == '__main__':
    main()
