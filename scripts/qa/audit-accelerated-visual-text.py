#!/usr/bin/env python3
"""Source-bound visual-text audit of current L02-L16 review MP4s."""
import hashlib
import json
import pathlib
import re
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
BASE = pathlib.Path('artifacts/accelerated-visual-parity-2026-11-10')
OUT = BASE / 'visual-text-audit'
SOURCE = pathlib.Path('docs/accelerated-course-modules/visual-production/manifest.json')
COMPOSITES = BASE / 'composite-receipt.json'
FRAMES = BASE / 'scene-receipt.json'
CONCEPTS = pathlib.Path('scripts/qa/accelerated-scene-concepts.tsv')
RENDERER = pathlib.Path('scripts/qa/render-accelerated-visual-parity.py')


def sha(path):
    h = hashlib.sha256()
    with (ROOT / path).open('rb') as file:
        for chunk in iter(lambda: file.read(4 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def read(path):
    return json.loads((ROOT / path).read_text())


def concepts():
    rows = {}
    for raw in (ROOT / CONCEPTS).read_text().splitlines():
        if not raw or raw.startswith('#'):
            continue
        scene_id, layout, *labels = raw.split('|')
        rows[scene_id] = {'layout': layout, 'labels': labels}
    return rows


def seconds(value):
    parts = value.split(':')
    return sum(float(item) * power for item, power in zip(reversed(parts), (1, 60, 3600)))


def cues(path):
    result = []
    text = (ROOT / path).read_text()
    for match in re.finditer(r'(?m)^((?:\d\d:)?\d\d:\d\d\.\d+) --> ((?:\d\d:)?\d\d:\d\d\.\d+)$', text):
        line = text[match.end():].split('\n\n', 1)[0].strip().replace('\n', ' ')
        result.append({'start_seconds': seconds(match.group(1)), 'end_seconds': seconds(match.group(2)),
                       'text': line})
    assert result
    return result


def capture(path, time, dest):
    subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{time:.3f}', '-i', str(ROOT / path),
                    '-frames:v', '1', '-update', '1', '-y', str(dest)], check=True, capture_output=True)


def main():
    manifest, composites, frames, patterns = read(SOURCE), read(COMPOSITES), read(FRAMES), concepts()
    renderer = (ROOT / RENDERER).read_text()
    assert all(label in renderer for label in ('F05 · source note pending', 'F06 · source note pending'))
    assert len(manifest['lessons']) == 16 and frames['scene_count'] == 98
    assert sha(SOURCE) == frames['source_manifest_sha256']
    assert sha(CONCEPTS) == frames['scene_concepts_sha256']
    by_media = {x['lesson_id']: x for x in composites['composites']}
    by_frame = {x['scene_id']: x for x in frames['scenes']}
    OUT.mkdir(parents=True, exist_ok=True)
    rows, captures = [], []
    with tempfile.TemporaryDirectory(prefix='accelerated-visual-audit-') as tmp:
        scratch = pathlib.Path(tmp)
        for lesson in manifest['lessons'][1:]:
            lid = lesson['id']
            media = by_media[lid]
            assert sha(pathlib.Path(media['output_path'])) == media['output_sha256']
            assert sha(pathlib.Path(media['source_path'])) == media['source_sha256']
            assert sha(pathlib.Path(media['caption_path'])) == media['caption_sha256']
            subtitle = cues(pathlib.Path(media['caption_path']))
            for scene in lesson['scenes']:
                source = by_frame[scene['id']]
                assert sha(pathlib.Path(source['frame_path'])) == source['frame_sha256']
                assert sha(pathlib.Path(scene['script_path'])) == scene['script_sha256']
                assert hashlib.sha256(scene['narration'].encode()).hexdigest() == scene['narration_sha256']
                spec = patterns[scene['id']]
                sample = round(scene['start_seconds'] + min(8, scene['duration_seconds']/2), 3)
                image = scratch / f"{scene['id']}.png"
                capture(pathlib.Path(media['output_path']), sample, image)
                captures.append((scene['id'], sample, image))
                active = [x for x in subtitle if x['start_seconds'] < scene['end_seconds'] and x['end_seconds'] > scene['start_seconds']]
                dense = spec['layout'] in ('feedback', 'ledger') or len(spec['labels']) >= 6
                internal = []
                if scene['id'] == 'L05-02':
                    internal = ['F05 · source note pending', 'F06 · source note pending']
                rows.append({'scene_id': scene['id'], 'lesson_id': lid,
                             'source_seconds': [scene['start_seconds'], scene['end_seconds']],
                             'sample_seconds': sample, 'source_script_sha256': scene['script_sha256'],
                             'current_mp4_path': media['output_path'], 'current_mp4_sha256': media['output_sha256'],
                             'current_frame_path': source['frame_path'], 'current_frame_sha256': source['frame_sha256'],
                             'source_vtt_path': media['caption_path'], 'source_vtt_sha256': media['caption_sha256'],
                             'visible_shared_shell': {'lesson_scene_code': f"{lid} / {scene['scene_number']:02d}",
                                                      'learner_artifact_footer': lesson['learner_artifact'],
                                                      'decorative_scene_progress_dots': len(lesson['scenes'])},
                             'layout': spec['layout'], 'concept_labels': spec['labels'],
                             'dense_card_risk': dense, 'internal_copy_in_renderer': internal,
                             'source_vtt_cues_overlapping_scene': len(active),
                             'source_vtt_longest_cue_characters': max((len(x['text']) for x in active), default=0),
                             'caption_competition': 'dense_art_and_shared_footer_need_rendered_caption_review' if dense else 'shared_footer_and_progress_dots_near_caption_band',
                             'review_status': 'source_bound_visual_diagnostic_not_learner_edit'})
        assert len(rows) == 92
        sheets = []
        font = ImageFont.truetype('/System/Library/Fonts/Avenir Next.ttc', 18)
        for page in range(4):
            batch = captures[page*24:(page+1)*24]
            sheet = Image.new('RGB', (1280, 1080), (7, 21, 27))
            draw = ImageDraw.Draw(sheet)
            for i, (scene_id, timestamp, path) in enumerate(batch):
                x, y = (i%4)*320, (i//4)*180
                with Image.open(path) as image:
                    sheet.paste(image.convert('RGB').resize((320, 180)), (x, y))
                draw.rectangle((x+3, y+3, x+120, y+28), fill=(6, 22, 29))
                draw.text((x+9, y+5), f'{scene_id} {timestamp:.1f}s', fill=(255, 255, 255), font=font)
            target = OUT / f'current-mp4-contact-sheet-{page+1:02d}.png'
            sheet.save(ROOT / target)
            sheets.append({'path': str(target), 'sha256': sha(target), 'scene_count': len(batch)})
        critical_stills = []
        for scene_id in ('L05-02', 'L06-02', 'L08-02', 'L16-02'):
            source = next(path for sid, _, path in captures if sid == scene_id)
            target = OUT / f'{scene_id.lower()}-current-frame.png'
            (ROOT / target).write_bytes(source.read_bytes())
            critical_stills.append({'scene_id': scene_id, 'path': str(target), 'sha256': sha(target)})
    result = {'schema_version': 1, 'status': 'review_only_visual_text_diagnostic',
              'source_manifest': {'path': str(SOURCE), 'sha256': sha(SOURCE)},
              'composite_receipt': {'path': str(COMPOSITES), 'sha256': sha(COMPOSITES)},
              'frame_receipt': {'path': str(FRAMES), 'sha256': sha(FRAMES)},
              'scene_concepts': {'path': str(CONCEPTS), 'sha256': sha(CONCEPTS)},
              'source_renderer': {'path': str(RENDERER), 'sha256': sha(RENDERER)},
              'lesson_count': 15, 'scene_count': len(rows),
              'repeated_shared_shell_scene_count': len(rows),
              'dense_card_scene_count': sum(x['dense_card_risk'] for x in rows),
              'internal_copy_scene_count': sum(bool(x['internal_copy_in_renderer']) for x in rows),
              'contact_sheets': sheets, 'critical_stills': critical_stills, 'scenes': rows,
              'caption_safe_geometry': {'frame': [1920,1080], 'content_panel_bottom_y': 815,
                                        'shared_footer_progress_bottom_y': 801,
                                        'intended_caption_band_start_y': 885,
                                        'minimum_vertical_gap_to_caption_band_pixels': 70,
                                        'gap_at_350_pixel_wide_player_pixels': round(70*350/1920,2),
                                        'qualification': 'geometry risk; 1728x962 desktop and 390x844 mobile browser review observed native captions over the existing footer area at 8s in L08-01. Clean-shell candidate removed the competing footer and dots; title and presenter face remained clear. Browser controls cover part of the caption while paused and hovered, so this is a layout check, not final playback qualification.'},
              'excluded_scope': ['L01 prior clean-card proof', 'end-screen parity owned elsewhere',
                                 'canonical or learner media edits', 'final caption synchronization']}
    path = OUT / 'audit.json'
    (ROOT / path).write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    print(f'Wrote {path}: {len(rows)} scenes, {result["dense_card_scene_count"]} dense cards, {result["internal_copy_scene_count"]} internal-copy scenes')


if __name__ == '__main__':
    main()
