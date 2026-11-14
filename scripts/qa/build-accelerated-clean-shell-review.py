#!/usr/bin/env python3
"""Render review-size clean-shell frames and a source-bound L05 comparison."""
import hashlib
import importlib.util
import json
import pathlib
import re
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont

sys.dont_write_bytecode = True
ROOT = pathlib.Path(__file__).resolve().parents[2]
BASE = pathlib.Path('artifacts/accelerated-visual-parity-2026-11-10')
OUT = BASE / 'clean-shell-review'
MANIFEST = pathlib.Path('docs/accelerated-course-modules/visual-production/manifest.json')
SOURCE_AUDIT = BASE / 'visual-text-audit/audit.json'
COMPOSITES = BASE / 'composite-receipt.json'


def module(name, relative):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


renderer = module('accelerated_clean_renderer', 'scripts/qa/render-accelerated-visual-parity.py')
composer = module('accelerated_clean_composer', 'scripts/qa/compose-accelerated-visual-parity.py')


def sha(path):
    digest = hashlib.sha256()
    with (ROOT / path).open('rb') as source:
        for chunk in iter(lambda: source.read(4 * 1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def run(args):
    subprocess.run(args, capture_output=True, check=True)


def seconds(value):
    parts = value.split(':')
    return sum(float(item) * power for item, power in zip(reversed(parts), (1, 60, 3600)))


def stamp(value):
    whole = int(value)
    return f'{whole // 3600:02d}:{whole // 60 % 60:02d}:{whole % 60:02d}.{round((value - whole) * 1000):03d}'


def caption_excerpt(path, start, end):
    content = (ROOT / path).read_text()
    rows = ['WEBVTT', '']
    for match in re.finditer(r'(?m)^((?:\d\d:)?\d\d:\d\d\.\d+) --> ((?:\d\d:)?\d\d:\d\d\.\d+)$', content):
        a, b = seconds(match.group(1)), seconds(match.group(2))
        if b <= start or a >= end:
            continue
        cue = content[match.end():].split('\n\n', 1)[0].strip()
        rows.extend([f'{stamp(max(a, start) - start)} --> {stamp(min(b, end) - start)}', cue, ''])
    assert len(rows) > 2
    return '\n'.join(rows)


def cue_start(path, phrase):
    content = (ROOT / path).read_text()
    for match in re.finditer(r'(?m)^((?:\d\d:)?\d\d:\d\d\.\d+) --> ((?:\d\d:)?\d\d:\d\d\.\d+)$', content):
        cue = content[match.end():].split('\n\n', 1)[0]
        if phrase.casefold() in cue.casefold():
            return seconds(match.group(1))
    raise AssertionError((path, phrase))


def approved_copy(scene):
    for beat in renderer.CLEAN_DENSE_CARDS.get(scene['id'], []):
        for heading, detail in beat:
            for phrase in (heading, detail):
                if re.fullmatch(r'F\d\d', phrase):
                    number = int(phrase[1:])
                    spoken = f'F zero {"one two three four five six".split()[number - 1]}'
                    assert spoken.casefold() in scene['narration'].casefold(), (scene['id'], phrase)
                else:
                    assert phrase.casefold() in scene['narration'].casefold(), (scene['id'], phrase)
    if scene['id'] == 'L05-03':
        for heading, detail in renderer.CLEAN_NOTE_REVEALS.values():
            spoken = {'F05': 'F zero five', 'F06': 'F zero six'}[heading]
            assert spoken.casefold() in scene['narration'].casefold()
            assert detail.casefold() in scene['narration'].casefold()


def save_preview(image, path):
    image.resize((960, 540), Image.Resampling.LANCZOS).save(ROOT / path, quality=92, optimize=True)
    return {'path': str(path), 'sha256': sha(path)}


def contact_sheet(rows):
    font = ImageFont.truetype('/System/Library/Fonts/Avenir Next.ttc', 17)
    pages = []
    for page in range((len(rows) + 23) // 24):
        sheet = Image.new('RGB', (1280, 1080), (7, 21, 27))
        draw = ImageDraw.Draw(sheet)
        for index, row in enumerate(rows[page * 24:(page + 1) * 24]):
            x, y = (index % 4) * 320, (index // 4) * 180
            with Image.open(ROOT / row['preview']['path']) as image:
                sheet.paste(image.resize((320, 180)), (x, y))
            draw.rectangle((x + 3, y + 3, x + 110, y + 27), fill=(6, 22, 29))
            draw.text((x + 8, y + 5), row['scene_id'], font=font, fill='white')
        target = OUT / f'clean-contact-sheet-{page + 1:02d}.jpg'
        sheet.save(ROOT / target, quality=92, optimize=True)
        pages.append({'path': str(target), 'sha256': sha(target)})
    return pages


def comparison(source, first):
    media = pathlib.Path(source['output_path'])
    caption = pathlib.Path(source['caption_path'])
    start, duration = 112, 12
    assert not any(a < start + duration and b > start for a, b in source['presenter_windows'])
    before = OUT / 'l05-02-before-12s.mp4'
    after = OUT / 'l05-02-clean-12s.mp4'
    joined = OUT / 'l05-02-before-after-24s.mp4'
    run(['ffmpeg', '-v', 'error', '-ss', str(start), '-i', str(ROOT / media), '-t', str(duration),
         '-map', '0:v:0', '-map', '0:a:0', '-vf', 'fps=25,format=yuv420p', '-r', '25',
         '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-c:a', 'aac', '-b:a', '192k',
         '-movflags', '+faststart', '-y', str(ROOT / before)])
    with tempfile.TemporaryDirectory(prefix='l05-clean-review-') as scratch:
        listing = pathlib.Path(scratch) / 'frames.txt'
        listing.write_text(f"file '{ROOT / first}'\nduration 12\nfile '{ROOT / first}'\n")
        run(['ffmpeg', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(listing),
             '-ss', str(start), '-i', str(ROOT / media), '-t', str(duration),
             '-filter_complex', '[0:v]fps=25,format=yuv420p[v]', '-map', '[v]', '-map', '1:a:0',
             '-r', '25', '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
             '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-y', str(ROOT / after)])
        clips = pathlib.Path(scratch) / 'clips.txt'
        clips.write_text(f"file '{ROOT / before}'\nfile '{ROOT / after}'\n")
        run(['ffmpeg', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(clips),
             '-map', '0:v:0', '-map', '0:a:0', '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
             '-r', '25', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-y', str(ROOT / joined)])
    for path in (before, after, joined):
        run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(ROOT / path), '-f', 'null', '-'])
    vtt = OUT / 'l05-02-caption-excerpt.vtt'
    (ROOT / vtt).write_text(caption_excerpt(caption, start, start + duration))
    return {'source_seconds': [start, start + duration],
            'source_media': {'path': str(media), 'sha256': sha(media)},
            'source_vtt': {'path': str(caption), 'sha256': sha(caption)},
            'before': {'path': str(before), 'sha256': sha(before)},
            'after': {'path': str(after), 'sha256': sha(after)},
            'comparison': {'path': str(joined), 'sha256': sha(joined)},
            'caption_excerpt': {'path': str(vtt), 'sha256': sha(vtt)},
            'full_decode': 'passed', 'source_audio': 'copied into both candidates then AAC re-encoded; no generated speech'}


def main():
    manifest = json.loads((ROOT / MANIFEST).read_text())
    audit = json.loads((ROOT / SOURCE_AUDIT).read_text())
    composite = json.loads((ROOT / COMPOSITES).read_text())
    assert audit['scene_count'] == 92 and sha(MANIFEST) == audit['source_manifest']['sha256']
    by_media = {row['lesson_id']: row for row in composite['composites']}
    OUT.mkdir(parents=True, exist_ok=True)
    (ROOT / OUT / 'frames').mkdir(exist_ok=True)
    rows = []
    for lesson in manifest['lessons'][1:]:
        media = by_media[lesson['id']]
        assert sha(pathlib.Path(media['output_path'])) == media['output_sha256']
        assert sha(pathlib.Path(media['source_path'])) == media['source_sha256']
        assert sha(pathlib.Path(media['caption_path'])) == media['caption_sha256']
        for index, scene in enumerate(lesson['scenes']):
            if scene['id'] == 'L16-06':
                continue  # End-screen lane owns this scene.
            assert sha(pathlib.Path(scene['script_path'])) == scene['script_sha256']
            assert hashlib.sha256(scene['narration'].encode()).hexdigest() == scene['narration_sha256']
            approved_copy(scene)
            preview = save_preview(renderer.render(lesson, scene, index, clean=True),
                                   OUT / 'frames' / f"{scene['id']}.jpg")
            variants = []
            if len(renderer.CLEAN_DENSE_CARDS.get(scene['id'], [])) > 1:
                target = OUT / 'frames' / f"{scene['id']}-second.jpg"
                variants.append({'kind': 'second_script_beat', **save_preview(
                    renderer.render(lesson, scene, index, variant='second', clean=True), target)})
            if scene['id'] == 'L05-03':
                caption_path = pathlib.Path(media['caption_path'])
                for note, phrase in [('f05', 'Now read F zero five'), ('f06', 'F zero six says')]:
                    target = OUT / 'frames' / f"{scene['id']}-{note}.jpg"
                    variants.append({'kind': f'scripted_note_reveal:{note}',
                                     'source_start_seconds': cue_start(caption_path, phrase),
                                     **save_preview(renderer.render(lesson, scene, index,
                                                                    variant=note, clean=True), target)})
            for art, _ in renderer.ART_BEATS.get(scene['id'], []):
                if art == 'main':
                    continue
                target = OUT / 'frames' / f"{scene['id']}-{art}.jpg"
                kind = 'approved_source_art' if art in renderer.ART_ASSETS else 'existing_concept_beat'
                variants.append({'kind': f'{kind}:{art}', **save_preview(
                    renderer.render(lesson, scene, index, variant=art, clean=True), target)})
            rows.append({'scene_id': scene['id'], 'lesson_id': lesson['id'],
                         'source_seconds': [scene['start_seconds'], scene['end_seconds']],
                         'script_sha256': scene['script_sha256'],
                         'current_mp4_sha256': media['output_sha256'],
                         'source_vtt_sha256': media['caption_sha256'],
                         'preview': preview, 'variants': variants,
                         'clean_shell': ['scene code removed', 'artifact footer removed', 'progress dots removed'],
                         'dense_treatment': 'focused_script_cards' if scene['id'] in renderer.CLEAN_DENSE_CARDS else
                                            'six_id_cards_retained_after_review' if scene['id'] == 'L05-01' else 'existing_concept'})
    assert len(rows) == 91
    sheets = contact_sheet(rows)
    # Comparison needs full 1920×1080 renderer frames, not 960×540 review thumbnails.
    lesson = next(x for x in manifest['lessons'] if x['id'] == 'L05')
    scene = next(x for x in lesson['scenes'] if x['id'] == 'L05-02')
    first = OUT / 'l05-02-clean-first-full.png'
    second = OUT / 'l05-02-clean-second-full.png'
    renderer.render(lesson, scene, 1, clean=True).save(ROOT / first, optimize=True)
    renderer.render(lesson, scene, 1, variant='second', clean=True).save(ROOT / second, optimize=True)
    compare = comparison(by_media['L05'], first)
    second_starts = {
        'L05-02': cue_start(pathlib.Path(by_media['L05']['caption_path']), 'Add F zero three'),
        'L09-02': cue_start(pathlib.Path(by_media['L09']['caption_path']), 'Fourth, the recommendation'),
        'L05-03-F05': cue_start(pathlib.Path(by_media['L05']['caption_path']), 'Now read F zero five'),
        'L05-03-F06': cue_start(pathlib.Path(by_media['L05']['caption_path']), 'F zero six says'),
    }
    assert second_starts == {'L05-02': 157.674, 'L09-02': 152.664,
                             'L05-03-F05': 252.093, 'L05-03-F06': 273.953}, second_starts
    receipt = {'schema_version': 1, 'status': 'review_only_clean_shell_frames',
               'source_manifest': {'path': str(MANIFEST), 'sha256': sha(MANIFEST)},
               'source_audit': {'path': str(SOURCE_AUDIT), 'sha256': sha(SOURCE_AUDIT)},
               'source_renderer': {'path': 'scripts/qa/render-accelerated-visual-parity.py',
                                   'sha256': sha(pathlib.Path('scripts/qa/render-accelerated-visual-parity.py'))},
               'scene_count': len(rows), 'excluded_scene': 'L16-06',
               'second_beat_source_vtt_starts': second_starts,
               'contact_sheets': sheets, 'scenes': rows,
               'comparison': compare,
               'full_comparison_frames': [{'path': str(path), 'sha256': sha(path)} for path in (first, second)],
               'canonical_media_or_learner_binding_changed': False}
    target = OUT / 'receipt.json'
    (ROOT / target).write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    print(f'Wrote {len(rows)} clean scene previews and {compare["comparison"]["path"]}')


if __name__ == '__main__':
    main()
