#!/usr/bin/env python3
"""Source-bound stills for an optional-caption L01 master; never renders video."""
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[4]
BASE = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate'
OUT = Path(__file__).resolve().parent
V13 = BASE / 'c01-c02-v13-playback-review/l01-c01-c02-v13-review.mp4'
V17 = BASE / 'c01-c02-v17-raster-caption-review/l01-c01-c02-v17-four-section-caption-review.mp4'
PLAN = BASE / 'c01-c02-v17-raster-caption-review/caption-plan.json'
VTT = BASE / 'c01-c02-v17-raster-caption-review/always-visible-binding-preview/captions.vtt'
EXPECTED = {
    V13: 'e900e636b6f63eac2f177f8f585d4e14fcf166b8435af218327939ec5976e518',
    V17: '80a1be496b7b05e1ae7bf6bff2cd00e2410374e6c8abe65e280fe7e4c444d0d1',
    PLAN: 'd917317e98f7dc05590e714097af9faf00a9c09236ce894a18c214ce9138b21e',
}
SAMPLES = {'P01': 5.0, 'C01': 174.4, 'P02': 240.05, 'C02': 250.0}
EXPECTED_AUDIO_STREAM = '5bef7336fbd6b0716007208d8481ba8bd896768a8ed3c9b7f206a7e1d859c655'
FONT = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
NAVY = '#0b1c26'


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def check():
    for path, expected in EXPECTED.items():
        assert sha(path) == expected, f'source drift: {path}'
    for path in (V13, V17):
        probe = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-count_frames',
                                           '-select_streams', 'v:0', '-show_entries',
                                           'format=duration:stream=nb_read_frames', '-of', 'json', str(path)],
                                          check=True, capture_output=True, text=True).stdout)
        assert abs(float(probe['format']['duration']) - 345) < .01
        assert int(probe['streams'][0]['nb_read_frames']) == 8625
        audio = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-map', '0:a:0',
                                '-c:a', 'copy', '-f', 'streamhash', '-hash', 'sha256', '-'],
                               check=True, capture_output=True, text=True).stdout.strip()
        assert audio == f'0,a,SHA256={EXPECTED_AUDIO_STREAM}', f'audio drift: {path}'
    plan = json.loads(PLAN.read_text())
    cues = plan['caption_cues']
    assert len(cues) == plan['caption_cue_count'] == 175
    expected_vtt = 'WEBVTT\n\n' + '\n\n'.join(
        f'{index}\n{stamp(cue["start"])} --> {stamp(cue["end"])}\n{cue["text"]}'
        for index, cue in enumerate(cues, 1)
    ) + '\n'
    assert VTT.read_text() == expected_vtt, '175 cue words or times differ from the approved plan'
    assert all(0 <= cue['start'] < cue['end'] <= 345 for cue in cues)
    assert all(a['end'] <= b['start'] for a, b in zip(cues, cues[1:]))
    mobile_font = ImageFont.truetype(FONT, 18)
    assert all(ImageDraw.Draw(Image.new('RGB', (1, 1))).textlength(cue['text'], font=mobile_font) <= 350
               for cue in cues), 'a cue exceeds the mobile one-line allowance'
    return cues


def stamp(seconds):
    milliseconds = round(seconds * 1000)
    return f'{milliseconds // 3600000:02d}:{milliseconds // 60000 % 60:02d}:{milliseconds // 1000 % 60:02d}.{milliseconds % 1000:03d}'


def positioned_vtt(cues):
    return 'WEBVTT\n\n' + '\n\n'.join(
        f'{index}\n{stamp(cue["start"])} --> {stamp(cue["end"])} line:72%\n{cue["text"]}'
        for index, cue in enumerate(cues, 1)
    ) + '\n'


def frame(path, at, target):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(at), '-i', str(path),
                    '-frames:v', '1', '-update', '1', str(target)], check=True)
    return Image.open(target).convert('RGB')


def cue_at(cues, at):
    return next(cue['text'] for cue in cues if cue['start'] <= at < cue['end'])


def clean_master_still(v13, section):
    image = Image.new('RGB', (1280, 1080), NAVY)
    art = v13.crop((0, 0, 1280, 720))
    if section in ('C01', 'C02'):
        art = art.resize((1100, 619), Image.Resampling.LANCZOS)
        image.paste(art, (90, 110))
    else:
        image.paste(art, (0, 0))
    return image


def desktop_mock(clean, caption):
    image = clean.copy()
    draw = ImageDraw.Draw(image)
    draw.text((640, 849), caption, font=ImageFont.truetype(FONT, 42), fill='white', anchor='mm')
    draw.rectangle((0, 1020, 1280, 1080), fill='#06131b')
    draw.line((24, 1035, 1256, 1035), fill='#e7e7e7', width=4)
    return image


def mobile_mock(clean, caption):
    image = Image.new('RGB', (390, 844), '#0c202a')
    draw = ImageDraw.Draw(image)
    video = clean.resize((390, 329), Image.Resampling.LANCZOS)
    image.paste(video, (0, 100))
    draw.text((195, 358), caption, font=ImageFont.truetype(FONT, 18), fill='white', anchor='mm')
    draw.rectangle((0, 389, 390, 429), fill='#06131b')
    draw.line((12, 398, 378, 398), fill='#e7e7e7', width=2)
    return image


def main():
    cues = check()
    (OUT / 'lower-captions.vtt').write_text(positioned_vtt(cues))
    with tempfile.TemporaryDirectory() as temp:
        for section, at in SAMPLES.items():
            v13 = frame(V13, at, Path(temp) / f'{section}.png')
            assert v13.size == (1280, 900), (section, v13.size)
            clean = clean_master_still(v13, section)
            caption = cue_at(cues, at)
            assert ImageDraw.Draw(clean).textlength(caption, font=ImageFont.truetype(FONT, 18)) <= 350
            clean.save(OUT / f'{section}-clean-1280x1080.png')
            desktop_mock(clean, caption).save(OUT / f'{section}-caption-desktop-mock.png')
            mobile_mock(clean, caption).save(OUT / f'{section}-caption-390x844-mock.png')
    receipt = {
        'status': 'review_only_optional_caption_proxy_feasibility',
        'source_mp4_sha256': {str(path.relative_to(ROOT)): digest for path, digest in EXPECTED.items() if path.suffix == '.mp4'},
        'caption_plan_sha256': sha(PLAN),
        'prior_vtt_sha256': sha(VTT),
        'positioned_vtt_sha256': sha(OUT / 'lower-captions.vtt'),
        'audio_stream_sha256': EXPECTED_AUDIO_STREAM,
        'duration_seconds': 345,
        'frames': 8625,
        'caption_cues': len(cues),
        'positioning': 'WebVTT line:72% in a proposed 1280:1080 player box',
        'samples_seconds': SAMPLES,
        'stills_sha256': {path.name: sha(path) for path in sorted(OUT.glob('*.png'))},
        'limits': ['No caption-free MP4 was rendered or tested.',
                   'Static control marks are geometry mocks; native controls were separately inspected in Chrome using the older raster-caption reel.',
                   'The older reel displays baked captions even when its WebVTT track is off.'],
    }
    (OUT / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print('source-bound stills: P01/C01/P02/C02; 175 cues; no video render')


if __name__ == '__main__':
    main()
