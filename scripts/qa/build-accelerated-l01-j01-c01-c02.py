#!/usr/bin/env python3
"""Source-bound, local-only L01 C01/C02 normal-speed review candidate."""
import argparse
import hashlib
import json
import re
import subprocess
import tempfile
import wave
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = Path('artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate')
SOURCE = Path('public/accelerated/visual-parity/l01/visual-a70ed876/l01-visual-parity.mp4')
P01_BASE = Path('artifacts/accelerated-lesson-pacing-2026-11-10/frames/L01-01-0.png')
WAV = Path('artifacts/accelerated-visual-parity-2026-11-10/narration-pilot/l01-j01-original.wav')
J01_ASR = Path('artifacts/accelerated-visual-parity-2026-11-10/narration-pilot/l01-j01-asr-evidence.json')
NATIVE_ASR = OUT / 'native-presenter-asr-evidence.json'
PACK = Path('docs/accelerated-course-modules/narration-production-pack-2026-11-10.json')
P01_MOVE = Path('artifacts/accelerated-visual-parity-2026-11-10/l01-p01-sentence-move/receipt.json')
EDL = Path('artifacts/accelerated-visual-parity-2026-11-10/full-lesson-timing-decisions.json')
VIDEO = OUT / 'l01-j01-c01-c02-review.mp4'
QA_VIDEO = OUT / 'l01-j01-c01-c02-qa.mp4'
P02_CLEAN = OUT / 'p02-clean-base.png'
P01_REFLOW = OUT / 'p01-reflow-base.png'
FPS = 25
SAMPLE_RATE = 48000
CHANNELS = 2
P01_END = 28.4
P02_MOVE_START = 235.0
P02_MOVE_END = 237.4
P02_RETAIN_END = 247.533333
C02_START = 248.2
END = 345.0
J01_SPLIT = 138.06
MAX_ORDINARY_PAUSE = 2.45
INSET_SOURCE = [1420, 48, 448, 256]
INSET_REVIEW = [round(value * 2 / 3) for value in INSET_SOURCE]


def sha(path):
    h = hashlib.sha256()
    with (ROOT / path).open('rb') as f:
        for block in iter(lambda: f.read(4 * 1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def command(*args):
    result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f'{args[0]} exited {result.returncode}: {result.stderr[-2000:]}')
    return result


def norm(text):
    return re.findall(r'[a-z0-9]+', text.casefold().replace('’', "'"))


def source_check():
    assert sha(SOURCE) == 'a70ed876ccdedd468c1cfa7ea995087683c715fdb97c50bb1d58a58436820725'
    assert (ROOT / P01_BASE).exists()
    assert sha(WAV) == '24ce83730c2112a52fee7e765794c29c771886ad103094ddff53511d33491360'
    pack = json.loads((ROOT / PACK).read_text())['lessons'][0]
    job = next(row for row in pack['speech_jobs'] if row['id'] == 'J01')
    assert job['window_ids'] == ['C01', 'C02'] and job['text_sha256'] == '33e4fced3cde522647ec92a08840b2c56b28becfc86a1f2f11f3d24e4b4d6a4a'
    move = json.loads((ROOT / P01_MOVE).read_text())
    assert move['candidate_timeline'][0]['target_seconds'][1] == P01_END
    assert move['candidate_timeline'][2]['target_seconds'] == [P02_MOVE_START, P02_MOVE_END]
    assert abs(move['candidate_timeline'][3]['target_seconds'][1] - P02_RETAIN_END) < .00001
    native = json.loads((ROOT / NATIVE_ASR).read_text())
    assert native['source_sha256'] == sha(SOURCE)
    asr = json.loads((ROOT / J01_ASR).read_text())
    assert asr['source_sha256'] == sha(WAV)
    assert norm(' '.join(row['text'] for row in asr['segments'])) == norm(job['text'])
    return job, asr, native


def distribute(source_lo, source_hi, target_lo, target_hi, words):
    indexed = [word for word in words if source_lo <= word['start'] < source_hi]
    cuts, gaps = [], []
    for left, right in zip(indexed, indexed[1:]):
        gap = right['start'] - left['end']
        if re.search(r'[.!?]["”]?$', left['text']) and gap >= .16:
            cuts.append(round((left['end'] + right['start']) / 2, 6))
            gaps.append(gap)
    extra = (target_hi - target_lo) - (source_hi - source_lo) - .3
    capacities = [MAX_ORDINARY_PAUSE - gap for gap in gaps]
    assert extra > 0 and sum(capacities) > extra
    low, high = 0.0, max(capacities)
    for _ in range(70):
        mid = (low + high) / 2
        if sum(min(mid, cap) for cap in capacities) < extra:
            low = mid
        else:
            high = mid
    additions = [min(high, cap) for cap in capacities]
    assert abs(sum(additions) - extra) < .0001
    edges = [source_lo, *cuts, source_hi]
    clips = []
    cursor = target_lo + .15
    for index, (left, right) in enumerate(zip(edges, edges[1:])):
        clips.append({'source_seconds': [round(left, 6), round(right, 6)],
                      'target_seconds': [round(cursor, 6), round(cursor + right - left, 6)]})
        cursor += right - left
        if index < len(additions):
            cursor += additions[index]
    assert abs(cursor - (target_hi - .15)) < .001
    timed = []
    for word in indexed:
        segment = sum(cut <= word['start'] for cut in cuts)
        offset = clips[segment]['target_seconds'][0] - clips[segment]['source_seconds'][0]
        timed.append({'start': round(word['start'] + offset, 3),
                      'end': round(word['end'] + offset, 3), 'text': word['text']})
    return {'source_seconds': [source_lo, source_hi], 'target_seconds': [target_lo, target_hi],
            'source_duration_seconds': round(source_hi - source_lo, 6),
            'target_duration_seconds': round(target_hi - target_lo, 6),
            'sentence_pause_count': len(gaps), 'added_pause_seconds': round(extra, 6),
            'max_planned_ordinary_pause_seconds': round(max(a + g for a, g in zip(additions, gaps)), 3),
            'pause_capacity_headroom_seconds': round(sum(capacities) - extra, 3),
            'clips': clips, 'timed_words': timed}


def native_words(native):
    rows = {row['window']: [word for s in row['segments'] for word in s['words']] for row in native['windows']}
    result = []
    for word in rows['P01']:
        if word['start'] < P01_END:
            result.append({'start': word['start'], 'end': word['end'], 'text': word['text']})
        elif P01_END <= word['start'] < 30.8:
            result.append({'start': round(P02_MOVE_START + word['start'] - P01_END, 3),
                           'end': round(P02_MOVE_START + word['end'] - P01_END, 3), 'text': word['text']})
    for word in rows['P02']:
        if word['start'] < 245.2:
            result.append({'start': round(P02_MOVE_END + word['start'] - 235, 3),
                           'end': round(P02_MOVE_END + word['end'] - 235, 3), 'text': word['text']})
    return sorted(result, key=lambda word: word['start'])


def caption_cues(timed_words):
    cues, chunk = [], []
    def flush():
        if chunk:
            copy = ' '.join(word['text'] for word in chunk)
            copy = copy.replace(' 30 seconds', ' thirty seconds').replace(' idea matters.', ' idea matters?')
            cues.append({'start': max(0, chunk[0]['start'] - .04),
                         'end': chunk[-1]['end'] + .08, 'text': copy})
            chunk.clear()
    for word in timed_words:
        candidate = ' '.join([*(item['text'] for item in chunk), word['text']])
        if chunk and (len(chunk) >= 5 or len(candidate) > 34 or word['start'] - chunk[-1]['end'] > .7):
            flush()
        chunk.append(word)
        if re.search(r'[.!?]["”]?$', word['text']):
            flush()
    flush()
    return cues


def stamp(value, comma=False):
    ms = round(value * 1000)
    separator = ',' if comma else '.'
    return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d}{separator}{ms%1000:03d}'


def make_plan():
    job, asr, native = source_check()
    all_words = [word for segment in asr['segments'] for word in segment['words']]
    c01 = distribute(0, J01_SPLIT, P01_END, P02_MOVE_START, all_words)
    c02 = distribute(J01_SPLIT, 209.029161, C02_START, END, all_words)
    assert norm(' '.join(word['text'] for word in c01['timed_words'] + c02['timed_words'])) == norm(job['text'])
    j01_cues = caption_cues(c01['timed_words']) + caption_cues(c02['timed_words'])
    all_cues = sorted(j01_cues + caption_cues(native_words(native)), key=lambda cue: cue['start'])
    for left, right in zip(all_cues, all_cues[1:]):
        left['end'] = min(left['end'], right['start'] - .02)
        assert left['end'] > left['start'] and left['end'] <= right['start'], (left, right)
    assert all(cue['end'] <= END for cue in all_cues)
    plan = {'status': 'anchor_review_only_timing_candidate_failed_pause_check',
            'sources': {str(path): sha(path) for path in (SOURCE, P01_BASE, WAV, J01_ASR, NATIVE_ASR, PACK, P01_MOVE, EDL,
                                                         *([P01_REFLOW] if (ROOT / P01_REFLOW).exists() else []),
                                                         *([P02_CLEAN] if (ROOT / P02_CLEAN).exists() else []))},
            'approved_j01_text_sha256': job['text_sha256'],
            'presenter_inset_anchor': {'source_1920x1080_xywh': INSET_SOURCE,
                                       'review_1280x720_xywh': INSET_REVIEW,
                                       'P01_original_inset_xywh': [1420, 260, 448, 256],
                                       'P02_original_inset_xywh': [1420, 790, 448, 256],
                                       'bottom_control_guard_source_px': 160,
                                       'caption_band_review_y_px': [720, 820],
                                       'source_bottom_clearance_px': 1080 - (INSET_SOURCE[1] + INSET_SOURCE[3]),
                                       'rule': 'same upper-right anchor and size in P01 and P02; slide content reflowed around it; no player-control or caption overlap; presenter-free cutaways use full frame'},
            'normal_speed': True, 'presenter_audio_targets': [
                {'source_seconds': [0, P01_END], 'target_seconds': [0, P01_END]},
                {'source_seconds': [P01_END, 30.8], 'target_seconds': [P02_MOVE_START, P02_MOVE_END]},
                {'source_seconds': [235, 245.133333], 'target_seconds': [P02_MOVE_END, P02_RETAIN_END]}],
            'C01': c01, 'C02': c02, 'caption_cue_count': len(all_cues),
            'caption_cues': all_cues,
            'j01_normalized_word_order_match': True,
            'unrendered': ['C03 and J02', 'P03/P04', 'learner binding']}
    vtt = 'WEBVTT\n\n' + '\n\n'.join(f'{stamp(c["start"])} --> {stamp(c["end"])}\n{c["text"]}' for c in all_cues) + '\n'
    srt = '\n\n'.join(f'{i+1}\n{stamp(c["start"], True)} --> {stamp(c["end"], True)}\n{c["text"]}' for i, c in enumerate(all_cues)) + '\n'
    return plan, vtt, srt


def write_plan(plan, vtt, srt, action):
    values = {'plan.json': json.dumps(plan, ensure_ascii=False, indent=2) + '\n',
              'captions.vtt': vtt, 'captions.srt': srt}
    for name, value in values.items():
        path = ROOT / OUT / name
        if action in ('plan', 'render', 'anchor'):
            path.write_text(value)
        else:
            assert path.read_text() == value, f'{name} differs from current source-bound plan'


def audio_bytes(path, start, end):
    args = ['ffmpeg', '-v', 'error', '-ss', str(start), '-i', str(path), '-t', str(end-start),
            '-vn', '-f', 's16le', '-ac', '2', '-ar', str(SAMPLE_RATE), '-']
    return subprocess.run(args, cwd=ROOT, check=True, capture_output=True).stdout


def place_audio(out, payload, target):
    begin = round(target * SAMPLE_RATE) * CHANNELS * 2
    end = begin + len(payload)
    assert end <= len(out)
    assert not any(out[begin:end]), 'overlapping audio placement'
    out[begin:end] = payload


def write_audio(plan, path):
    raw = bytearray(round(END * SAMPLE_RATE) * CHANNELS * 2)
    for row in plan['presenter_audio_targets']:
        place_audio(raw, audio_bytes(SOURCE, *row['source_seconds']), row['target_seconds'][0])
    for key in ('C01', 'C02'):
        for row in plan[key]['clips']:
            place_audio(raw, audio_bytes(WAV, *row['source_seconds']), row['target_seconds'][0])
    with wave.open(str(path), 'wb') as wav:
        wav.setnchannels(CHANNELS)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(raw)


def video_source_segment(path, start, frames):
    command('ffmpeg', '-v', 'error', '-y', '-ss', str(start), '-i', str(SOURCE), '-an',
            '-vf', 'scale=1280:720:flags=lanczos,fps=25', '-frames:v', str(frames),
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', str(path))


def video_p01_fixed(path):
    command('ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', '25', '-i', str(P01_REFLOW),
            '-ss', '0', '-i', str(SOURCE), '-an',
            '-filter_complex', '[1:v]trim=duration=28.4,setpts=PTS-STARTPTS,crop=448:256:1420:260[inset];'
            f'[0:v][inset]overlay={INSET_SOURCE[0]}:{INSET_SOURCE[1]}:shortest=0,scale=1280:720:flags=lanczos,fps=25[v]',
            '-map', '[v]', '-frames:v', '710', '-c:v', 'libx264', '-preset', 'veryfast',
            '-crf', '20', '-pix_fmt', 'yuv420p', str(path))


def video_still(path, at, frames, temp):
    image = temp / f'{path.stem}.png'
    command('ffmpeg', '-v', 'error', '-y', '-ss', str(at), '-i', str(SOURCE), '-frames:v', '1',
            '-update', '1', str(image))
    command('ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', '25', '-i', str(image),
            '-an', '-vf', 'scale=1280:720:flags=lanczos', '-frames:v', str(frames),
            '-c:v', 'libx264', '-preset', 'veryfast',
            '-crf', '20', '-pix_fmt', 'yuv420p', str(path))


def video_relocated(path):
    command('ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', '25', '-i', str(P02_CLEAN),
            '-ss', str(P01_END), '-i', str(SOURCE), '-an',
            '-filter_complex', '[1:v]trim=duration=2.4,setpts=PTS-STARTPTS,crop=448:256:1420:260[inset];'
            f'[0:v][inset]overlay={INSET_SOURCE[0]}:{INSET_SOURCE[1]}:shortest=0,scale=1280:720:flags=lanczos,fps=25[v]',
            '-map', '[v]', '-frames:v', '60', '-c:v', 'libx264', '-preset', 'veryfast',
            '-crf', '20', '-pix_fmt', 'yuv420p', str(path))


def video_p02_fixed(path, start, frames):
    command('ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', '25', '-i', str(P02_CLEAN),
            '-ss', str(start), '-i', str(SOURCE), '-an',
            '-filter_complex', '[1:v]crop=448:256:1420:790[inset];'
            f'[0:v][inset]overlay={INSET_SOURCE[0]}:{INSET_SOURCE[1]}:shortest=0,scale=1280:720:flags=lanczos,fps=25[v]',
            '-map', '[v]', '-frames:v', str(frames), '-c:v', 'libx264', '-preset', 'veryfast',
            '-crf', '20', '-pix_fmt', 'yuv420p', str(path))


def source_still(at, temp):
    path = temp / f'source-{at}.png'
    command('ffmpeg', '-v', 'error', '-y', '-ss', str(at), '-i', str(SOURCE),
            '-frames:v', '1', '-update', '1', str(path))
    return Image.open(path).convert('RGB')


def clean_p02(image):
    result = image.copy()
    pixels = result.load()
    for y in range(780, 1060):
        left = tuple(sum(image.getpixel((x, y))[c] for x in range(1370, 1400, 5)) // 6 for c in range(3))
        right = tuple(sum(image.getpixel((x, y))[c] for x in range(1890, 1920, 5)) // 6 for c in range(3))
        for x in range(1410, 1881):
            fraction = (x - 1410) / 470
            pixels[x, y] = tuple(round(a * (1 - fraction) + b * fraction)
                                  for a, b in zip(left, right))
    return result


def reflow_p01(image):
    result = image.copy()
    pixels = result.load()
    for y in range(140, 870):
        left = image.getpixel((600, y))
        right = image.getpixel((1860, y))
        for x in range(620, 1830):
            fraction = (x - 620) / 1210
            pixels[x, y] = tuple(round(a * (1 - fraction) + b * fraction)
                                  for a, b in zip(left, right))
    card = image.crop((630, 155, 1810, 830)).resize((920, 527), Image.Resampling.LANCZOS)
    result.paste(card, (620, 325))
    return result


def anchor_still(background, presenter, original_y, cue):
    frame = background.copy()
    frame.paste(presenter.crop((1420, original_y, 1868, original_y + 256)),
                (INSET_SOURCE[0], INSET_SOURCE[1]))
    scaled = frame.resize((1280, 720), Image.Resampling.LANCZOS)
    out = Image.new('RGB', (1280, 820), '#0c202a')
    out.paste(scaled, (0, 0))
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 35)
    ImageDraw.Draw(out).text((640, 767), cue, font=font, fill='white', anchor='mm')
    return out


def render_anchor_review(plan):
    with tempfile.TemporaryDirectory(prefix='l01-anchor-review-') as temp_path:
        temp = Path(temp_path)
        p01 = source_still(5, temp)
        p02 = source_still(240.5, temp)
        p01_reflow = reflow_p01(Image.open(ROOT / P01_BASE).convert('RGB'))
        p01_reflow.save(ROOT / P01_REFLOW)
        p02_clean = clean_p02(p02)
        p02_clean.save(ROOT / P02_CLEAN)
        samples = [('p01', p01_reflow, p01, 260, 5),
                   ('p02', p02_clean, p02, 790, 240.5)]
        for name, background, presenter, crop_y, at in samples:
            cue = next((row['text'] for row in plan['caption_cues']
                        if row['start'] <= at < row['end']), '')
            assert cue, (name, at)
            still = anchor_still(background, presenter, crop_y, cue)
            still.save(ROOT / OUT / f'{name}-anchor-desktop.png')
            still.resize((390, 250), Image.Resampling.LANCZOS).save(
                ROOT / OUT / f'{name}-anchor-mobile.png')
    review = {'status': 'anchor_stills_only_timing_validation_stopped',
              'source_video_sha256': sha(SOURCE), 'p01_source_background_sha256': sha(P01_BASE),
              'p01_reflow_background_sha256': sha(P01_REFLOW),
              'p02_clean_base_sha256': sha(P02_CLEAN),
              'anchor': plan['presenter_inset_anchor'],
              'clearance': {'right_source_px': 1920 - (INSET_SOURCE[0] + INSET_SOURCE[2]),
                            'top_source_px': INSET_SOURCE[1],
                            'below_inset_to_control_guard_source_px': 1080 - 160 - (INSET_SOURCE[1] + INSET_SOURCE[3]),
                            'below_inset_to_caption_band_review_px': 720 - (INSET_REVIEW[1] + INSET_REVIEW[3])},
              'stills': {f'{name}-anchor-{size}.png': sha(OUT / f'{name}-anchor-{size}.png')
                         for name in ('p01', 'p02') for size in ('desktop', 'mobile')},
              'observed_still_review': {'desktop_1280x820': 'P01 card and P02 map/title clear the fixed inset; captions occupy the separate bottom band.',
                                        'mobile_390x250': 'Inset remains fully inside the video image and above the caption band; text legibility and native player controls require later playback review.',
                                        'p01_reflow': 'Q3 card moved below the reserved inset; full card border visible.',
                                        'p02_reflow': 'Original lower-right inset removed from the map slide before placing the presenter above the title.'},
              'limits': ['Stills show 5s P01 and 240.5s P02 only; no full-motion or native-player interaction check.',
                         'C01/C02 candidate failed the ordinary-pause gate and was not rerendered.',
                         'No learner media or binding changed.']}
    if (ROOT / VIDEO).exists():
        review['previous_failed_mp4'] = {'path': str(VIDEO), 'sha256': sha(VIDEO),
                                         'status': 'stale_lower_right_anchor_and_failed_pause_check_do_not_use_for_QA'}
    (ROOT / OUT / 'anchor-review.json').write_text(json.dumps(review, indent=2) + '\n')


def caption_strip(plan, temp):
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 35)
    blank = temp / 'caption-blank.png'
    Image.new('RGB', (1280, 100), '#0c202a').save(blank)
    images = [blank]
    for index, cue in enumerate(plan['caption_cues']):
        image = Image.new('RGB', (1280, 100), '#0c202a')
        draw = ImageDraw.Draw(image)
        draw.text((640, 47), cue['text'], font=font, fill='#ffffff', anchor='mm',
                  stroke_width=1, stroke_fill='#10202a')
        path = temp / f'caption-{index:03}.png'
        image.save(path)
        images.append(path)
    frame_labels = []
    cue_index = 0
    for frame in range(round(END * FPS)):
        at = (frame + .5) / FPS
        while cue_index < len(plan['caption_cues']) and at >= plan['caption_cues'][cue_index]['end']:
            cue_index += 1
        cue = plan['caption_cues'][cue_index] if cue_index < len(plan['caption_cues']) else None
        frame_labels.append(cue_index + 1 if cue and cue['start'] <= at else 0)
    runs = []
    for label in frame_labels:
        if runs and runs[-1][0] == label:
            runs[-1][1] += 1
        else:
            runs.append([label, 1])
    listing = temp / 'caption-list.txt'
    listing.write_text(''.join(f"file '{images[label]}'\nduration {count/FPS:.6f}\n"
                               for label, count in runs) + f"file '{images[runs[-1][0]]}'\n")
    output = temp / 'caption-strip.mp4'
    command('ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(listing),
            '-vf', 'fps=25', '-frames:v', str(round(END * FPS)), '-c:v', 'libx264',
            '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', str(output))
    return output


def render_video(plan):
    with tempfile.TemporaryDirectory(prefix='l01-j01-c01c02-') as temp_path:
        temp = Path(temp_path)
        parts = [
            ('p01_fixed', 0, 710),
            ('still', 31.52, 78),
            ('source', 31.52, 5087),
            ('relocated', 0, 60),
            ('p02_fixed', 235, 253),
            ('still', 248.2, 17),
            ('source', 248.2, 2420),
        ]
        files = []
        for index, (kind, at, frames) in enumerate(parts):
            path = temp / f'{index:02}.mp4'
            if kind == 'source':
                video_source_segment(path, at, frames)
            elif kind == 'p01_fixed':
                video_p01_fixed(path)
            elif kind == 'still':
                video_still(path, at, frames, temp)
            elif kind == 'p02_fixed':
                video_p02_fixed(path, at, frames)
            else:
                video_relocated(path)
            count = int(command('ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0',
                                '-show_entries', 'stream=nb_read_frames', '-of', 'default=nw=1:nk=1', str(path)).stdout.strip())
            assert count == frames, (kind, count, frames)
            files.append(path)
        assert sum(row[2] for row in parts) == 8625
        listing = temp / 'list.txt'
        listing.write_text(''.join(f"file '{path}'\n" for path in files))
        audio = temp / 'full-audio.wav'
        write_audio(plan, audio)
        strip = caption_strip(plan, temp)
        command('ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(listing),
                '-i', str(strip), '-i', str(audio), '-i', str(OUT / 'captions.vtt'),
                '-filter_complex', '[0:v]pad=1280:820:0:0:color=0x0c202a[base];[base][1:v]overlay=0:720:shortest=1[v]',
                '-map', '[v]', '-map', '2:a:0', '-map', '3:0', '-c:v', 'libx264',
                '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-r', '25',
                '-c:a', 'aac', '-b:a', '256k', '-c:s', 'mov_text', '-t', str(END),
                '-movflags', '+faststart', str(VIDEO))
        qa_ranges = [(22, 37), (225, 254), (335, 345)]
        qa_parts = []
        for index, (left, right) in enumerate(qa_ranges):
            path = temp / f'qa-{index}.mp4'
            command('ffmpeg', '-v', 'error', '-y', '-ss', str(left), '-i', str(VIDEO),
                    '-t', str(right-left), '-map', '0:v:0', '-map', '0:a:0',
                    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-c:a', 'aac',
                    '-b:a', '256k', str(path))
            qa_parts.append(path)
        qa_list = temp / 'qa-list.txt'
        qa_list.write_text(''.join(f"file '{path}'\n" for path in qa_parts))
        command('ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(qa_list),
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-c:a', 'aac',
                '-b:a', '256k', '-movflags', '+faststart', str(QA_VIDEO))


def inspect_media(plan):
    streams = json.loads(command('ffprobe', '-v', 'error', '-show_entries',
                                 'format=duration:stream=codec_name,codec_type,width,height,sample_rate,channels,nb_frames',
                                 '-of', 'json', str(VIDEO)).stdout)
    assert abs(float(streams['format']['duration']) - END) < .1
    assert next(row for row in streams['streams'] if row['codec_type'] == 'video')['nb_frames'] == '8625'
    command('ffmpeg', '-v', 'error', '-i', str(VIDEO), '-f', 'null', '-')
    command('ffmpeg', '-v', 'error', '-i', str(QA_VIDEO), '-f', 'null', '-')
    silence = command('ffmpeg', '-hide_banner', '-i', str(VIDEO), '-vn',
                      '-af', 'silencedetect=noise=-40dB:d=0.25', '-f', 'null', '-')
    spans = [(float(a), float(b), float(d)) for a, b, d in re.findall(
        r'silence_start: ([\d.]+).*?silence_end: ([\d.]+) \| silence_duration: ([\d.]+)',
        silence.stderr, re.S)]
    ordinary = [row for row in spans if 28.4 <= row[0] < 235 or 248.2 <= row[0] < 345]
    assert ordinary and max(row[2] for row in ordinary) <= 2.5, max(ordinary, key=lambda row: row[2])
    return {'video': {'path': str(VIDEO), 'sha256': sha(VIDEO), 'duration_seconds': float(streams['format']['duration']),
                      'streams': streams['streams']},
            'qa_video': {'path': str(QA_VIDEO), 'sha256': sha(QA_VIDEO),
                         'scope': '22–37s, 225–254s, and 335–345s stitched for handoff/caption review'},
            'silence_scan': {'threshold_dbfs': -40, 'minimum_seconds': .25,
                             'ordinary_pause_max_seconds': round(max(row[2] for row in ordinary), 3),
                             'ordinary_pauses_over_2_5_seconds': sum(row[2] > 2.5 for row in ordinary),
                             'all_detected_pause_count': len(spans)}}


def receipt_text(plan, media):
    return {'status': 'local_review_only_C01_C02_not_full_L01',
            'plan_sha256': sha(OUT / 'plan.json'), 'source_bindings': plan['sources'],
            'j01_normal_speed': True, 'j01_exact_normalized_word_order': True,
            'presenter_inset_anchor_consistency': {'status': 'fixed_by_composite_geometry; rendered-frame visual check required',
                                                   **plan['presenter_inset_anchor']},
            'C01': {key: plan['C01'][key] for key in ('target_seconds', 'sentence_pause_count', 'added_pause_seconds', 'max_planned_ordinary_pause_seconds', 'pause_capacity_headroom_seconds')},
            'C02': {key: plan['C02'][key] for key in ('target_seconds', 'sentence_pause_count', 'added_pause_seconds', 'max_planned_ordinary_pause_seconds', 'pause_capacity_headroom_seconds')},
            'caption_cue_count': plan['caption_cue_count'], 'captions_vtt_sha256': sha(OUT / 'captions.vtt'),
            'media': media, 'limits': ['C03/J02 and P03/P04 are absent; this ends before 345s and is not full L01.',
                                      'Native presenter video/audio and J01 are re-encoded for review; no speech is regenerated or time-stretched.',
                                      'Human voice-match, full listening, caption readability, and learner workflow remain separate gates.',
                                      'Voice-bearing MP4s stay local because this repository is public and publication rights are not established.']}


def readme(receipt):
    return f'''# L01 J01 C01/C02 local timing candidate

Status: **review only, not full L01**. The [full local MP4](l01-j01-c01-c02-review.mp4) covers 00:00–05:45; the [54-second QA reel](l01-j01-c01-c02-qa.mp4) samples the opening, P02 pivot, and C02 exit. Both voice-bearing files stay local and are ignored by Git because this repository is public. The committed [plan](plan.json), [receipt](receipt.json), [VTT](captions.vtt), and [SRT](captions.srt) bind the review to the original native video, unchanged J01 WAV, approved P01 move, and earlier A02 correction.

C01 starts at 28.40s after the corrected native P01 boundary, then runs to 235s. P02 carries the moved native sentence and retained native audio through 247.533s; C02 runs from 248.20s to 345s. The presenter inset stays at the source **(1420, 48, 448, 256)** rectangle in both P01 and P02, scaled to the same upper-right anchor in the review video. The approved clean Q3 slide and P02 workshop map are recomposed around that rectangle; presenter-free cutaways use the full frame. J01 audio is cut only in sentence-complete pauses and placed at native speed. The loudest-silence scan found a maximum ordinary gap of **{receipt['media']['silence_scan']['ordinary_pause_max_seconds']:.3f}s** at −40 dBFS; no ordinary gap exceeded 2.5s. Captions follow the actual placement and use a separate band below the video image.

The candidate ends before P03. **J02/C03, the rest of L01, learner binding, and release are not included.** The earlier P01 local reel received Vambah's Human QA approval; this complete C01/C02 audio placement has its own pending visual/listening gate. No HeyGen call, new speech, credits, learner media change, merge, or release occurred.

Rebuild locally: `python3 -B scripts/qa/build-accelerated-l01-j01-c01-c02.py render`
Check: `python3 -B scripts/qa/build-accelerated-l01-j01-c01-c02.py check`
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('plan', 'anchor', 'render', 'check'))
    action = parser.parse_args().action
    (ROOT / OUT).mkdir(parents=True, exist_ok=True)
    plan, vtt, srt = make_plan()
    if action == 'anchor':
        render_anchor_review(plan)
        plan, vtt, srt = make_plan()
    write_plan(plan, vtt, srt, action)
    if action in ('plan', 'anchor'):
        print(f'plan: C01 {plan["C01"]["sentence_pause_count"]} sentence pauses, C02 {plan["C02"]["sentence_pause_count"]}; {plan["caption_cue_count"]} captions')
        return
    if action == 'render':
        render_video(plan)
    media = inspect_media(plan)
    receipt = receipt_text(plan, media)
    values = {'receipt.json': json.dumps(receipt, ensure_ascii=False, indent=2) + '\n',
              'README.md': readme(receipt)}
    for name, value in values.items():
        path = ROOT / OUT / name
        if action == 'render':
            path.write_text(value)
        else:
            assert path.read_text() == value, f'{name} differs from source-bound candidate'
    print(f'{action}: {media["video"]["duration_seconds"]:.3f}s, max ordinary pause {media["silence_scan"]["ordinary_pause_max_seconds"]:.3f}s')


if __name__ == '__main__':
    main()
