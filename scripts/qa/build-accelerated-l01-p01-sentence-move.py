#!/usr/bin/env python3
"""Build/check a bounded native L01 P01 sentence-move review; no lesson render."""
import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = Path('artifacts/accelerated-visual-parity-2026-11-10/l01-p01-sentence-move')
SOURCE = Path('public/accelerated/visual-parity/l01/visual-a70ed876/l01-visual-parity.mp4')
SOURCE_SHA = 'a70ed876ccdedd468c1cfa7ea995087683c715fdb97c50bb1d58a58436820725'
SCRIPT = Path('docs/accelerated-course-modules/curriculum/scripts/L01.md')
EDL = Path('artifacts/accelerated-visual-parity-2026-11-10/full-lesson-timing-decisions.json')
A02_RECEIPT = Path('artifacts/accelerated-visual-parity-2026-11-10/l01-a02-native-trim-candidate-235-252.json')
REEL = OUT / 'l01-p01-sentence-move-before-after.mp4'
ASR_VALIDATION = OUT / 'asr-validation.json'
P01_CUT = 28.4
MOVED_END = 30.8
A02_CUT = 245.133333


def sha(path):
    h = hashlib.sha256()
    with (ROOT / path).open('rb') as f:
        for chunk in iter(lambda: f.read(4 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def run(*args):
    return subprocess.run(args, cwd=ROOT, check=True, capture_output=True, text=True)


def check_sources():
    assert sha(SOURCE) == SOURCE_SHA
    script = (ROOT / SCRIPT).read_text()
    phrase = 'That story makes the pressure visible.'
    assert script.count(phrase) == 1
    assert script.index('Who will decide which idea matters?') < script.index(phrase) < script.index('It is a teaching story from the book')
    edl = json.loads((ROOT / EDL).read_text())['lessons'][0]
    assert edl['native_edit_actions'][0]['decision'] == 'previously_owner_confirmed_isolated_cut'
    assert abs(edl['scheduled_native_audio_spans'][1]['source_seconds'][1] - A02_CUT) < .00001
    assert json.loads((ROOT / A02_RECEIPT).read_text())['proposed_a02_cut_seconds'] == A02_CUT
    assert 27.98 < P01_CUT < 28.70 and 30.54 < MOVED_END < 31.52
    moved = MOVED_END - P01_CUT
    retained = A02_CUT - 235
    assert moved + retained < 248.2 - 235
    return script, edl


def card(path, title, line):
    im = Image.new('RGB', (1280, 720), '#0c202a')
    draw = ImageDraw.Draw(im)
    bold = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 54)
    small = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 28)
    draw.rounded_rectangle((65, 145, 1215, 575), radius=25, outline='#d6b261', width=3, fill='#15333b')
    draw.text((105, 265), title, font=bold, fill='#f1e9d8')
    draw.text((105, 355), line, font=small, fill='#d6b261')
    im.save(path)


def encode_source(path, start, end):
    run('ffmpeg', '-v', 'error', '-y', '-ss', f'{start:.6f}', '-i', str(SOURCE),
        '-t', f'{end-start:.6f}', '-map', '0:v:0', '-map', '0:a:0',
        '-vf', 'scale=1280:720:flags=lanczos,fps=25', '-af', 'aresample=async=1:first_pts=0',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', str(path))


def encode_relocated(path):
    """Keep the native moving presenter inset over the existing P02 map plate."""
    run('ffmpeg', '-v', 'error', '-y',
        '-ss', '235', '-i', str(SOURCE), '-ss', str(P01_CUT), '-i', str(SOURCE),
        '-t', str(MOVED_END - P01_CUT),
        '-filter_complex',
        '[0:v]trim=duration=2.4,setpts=PTS-STARTPTS[map];'
        '[1:v]trim=duration=2.4,setpts=PTS-STARTPTS,crop=448:256:1420:260[inset];'
        '[map][inset]overlay=1420:790:shortest=1,scale=1280:720:flags=lanczos,fps=25[v];'
        '[1:a]atrim=duration=2.4,asetpts=PTS-STARTPTS,aresample=async=1:first_pts=0[a]',
        '-map', '[v]', '-map', '[a]',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', str(path))


def encode_card(path, image):
    run('ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', '25', '-t', '1.2', '-i', str(image),
        '-f', 'lavfi', '-t', '1.2', '-i', 'anullsrc=r=48000:cl=stereo',
        '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'veryfast',
        '-crf', '19', '-pix_fmt', 'yuv420p', '-r', '25', '-c:a', 'aac', '-b:a', '256k',
        '-ar', '48000', '-ac', '2', '-shortest', str(path))


def render():
    with tempfile.TemporaryDirectory(prefix='l01-p01-move-') as temp:
        temp = Path(temp)
        sequence = [
            ('card', 'BEFORE · OPENING', 'Source 00:25.000–00:31.520; sentence arrives early'),
            ('source', 25.0, 31.52),
            ('card', 'BEFORE · PIVOT', 'Source 03:55.000–04:05.133; next sentence'),
            ('source', 235.0, A02_CUT),
            ('card', 'AFTER · OPENING', 'Source 00:25.000–00:28.400; complete prior sentence'),
            ('source', 25.0, P01_CUT),
            ('card', 'AFTER · PIVOT', 'Moved 00:28.400–00:30.800, then 03:55.000–04:05.133'),
            ('relocated', P01_CUT, MOVED_END),
            ('source', 235.0, A02_CUT),
        ]
        files = []
        for i, part in enumerate(sequence):
            target = temp / f'{i:02}.mp4'
            if part[0] == 'card':
                image = temp / f'{i:02}.png'
                card(image, part[1], part[2])
                encode_card(target, image)
            elif part[0] == 'relocated':
                encode_relocated(target)
            else:
                encode_source(target, part[1], part[2])
            files.append(target)
        listing = temp / 'concat.txt'
        listing.write_text(''.join(f"file '{path}'\n" for path in files))
        run('ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(listing),
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2',
            '-movflags', '+faststart', str(REEL))


def receipt():
    probe = json.loads(run('ffprobe', '-v', 'error', '-show_entries',
                           'format=duration:stream=codec_name,codec_type,sample_rate,channels,width,height',
                           '-of', 'json', str(REEL)).stdout)
    duration = float(probe['format']['duration'])
    assert 36 < duration < 39, duration
    run('ffmpeg', '-v', 'error', '-i', str(REEL), '-f', 'null', '-')
    asr = json.loads((ROOT / ASR_VALIDATION).read_text())
    assert asr['reel_sha256'] == sha(REEL)
    asr_lines = [segment['text'] for segment in asr['segments']]
    assert sum('That story makes the pressure visible.' in text for text in asr_lines) == 2
    assert sum('It is a teaching story from the book' in text for text in asr_lines) == 2
    assert next(i for i, text in enumerate(asr_lines) if 'That story makes the pressure visible.' in text and i > 4) < next(i for i, text in enumerate(asr_lines) if 'It is a teaching story from the book' in text and i > 4)
    return {
        'schema_version': 1,
        'status': 'review_only_native_sentence_move_candidate',
        'source': {'path': str(SOURCE), 'sha256': sha(SOURCE)},
        'approved_script': {'path': str(SCRIPT), 'sha256': sha(SCRIPT)},
        'source_edl': {'path': str(EDL), 'sha256': sha(EDL)},
        'existing_a02_correction': {'path': str(A02_RECEIPT), 'sha256': sha(A02_RECEIPT),
                                     'cut_seconds': A02_CUT, 'scope': 'previously owner-confirmed isolated cut; full lesson unapproved'},
        'word_evidence': {
            'prior_complete_sentence': 'Who will decide which idea matters?',
            'prior_last_word_end_seconds': 27.98,
            'moved_exact_sentence': 'That story makes the pressure visible.',
            'moved_source_words_seconds': [28.70, 30.54],
            'following_sentence': 'It is a teaching story from the book, not a claim about a current customer.',
            'following_source_start_seconds': 235.0,
            'method': 'local small.en word-timed ASR plus source-script ordering; machine evidence, not human listening signoff',
        },
        'cut_points': {'p01_pause_cut_seconds': P01_CUT, 'moved_source_end_seconds': MOVED_END,
                       'silence_before_move_seconds': [28.070, 28.728],
                       'silence_after_move_seconds': [30.627, 31.52]},
        'candidate_timeline': [
            {'kind': 'P01 native', 'target_seconds': [0, P01_CUT], 'source_seconds': [0, P01_CUT]},
            {'kind': 'C01 cutaway and J01', 'target_seconds': [P01_CUT, 235.0], 'status': 'mapping only; not rendered in comparison reel'},
            {'kind': 'P02 moved native sentence', 'target_seconds': [235.0, 235.0 + MOVED_END - P01_CUT],
             'source_seconds': [P01_CUT, MOVED_END]},
            {'kind': 'P02 retained native audio and picture', 'target_seconds': [235.0 + MOVED_END - P01_CUT, 235.0 + MOVED_END - P01_CUT + A02_CUT - 235.0],
             'source_seconds': [235.0, A02_CUT]},
            {'kind': 'P02 transition reserve', 'target_seconds': [A02_CUT + MOVED_END - P01_CUT, 248.2]},
            {'kind': 'C02 cutaway and J01', 'target_seconds': [248.2, 345.0], 'status': 'mapping only; not rendered in comparison reel'},
        ],
        'reel': {'path': str(REEL), 'sha256': sha(REEL), 'duration_seconds': duration,
                 'streams': probe['streams'], 'scope': 'short before/after source snippets; no complete C01 or C02'},
        'encoded_audio_asr_check': {'path': str(ASR_VALIDATION), 'sha256': sha(ASR_VALIDATION),
                                    'status': 'machine_word_order_pass; human listening pending'},
        'limits': [
            'Original native presenter inset pixels and words are reused over a P02 map background; comparison MP4 resizes video and re-encodes H.264/AAC for playback.',
            'No full C01/C02 composite or learner binding was produced.',
            'Human listening must confirm phoneme-safe cut boundaries, visual jump, and native presenter voice continuity.',
            'J01 timing placement and J02/C03 remain separate gates.',
        ],
    }


def readme(data):
    timeline = '\n'.join(f"| {row['kind']} | {row['target_seconds'][0]:.3f}–{row['target_seconds'][1]:.3f}s | {row.get('source_seconds', '—')} |" for row in data['candidate_timeline'])
    return f'''# L01 P01 native sentence move · review only

The [before/after reel](l01-p01-sentence-move-before-after.mp4) compares the current early sentence with a candidate ordering. The exact native sentence “That story makes the pressure visible” is taken from source 28.40–30.80s, including silence before and after its 28.70–30.54s words. The candidate ends P01 at 28.40s, presents C01 next, then puts that native sentence at the start of P02 before the retained P02 speech. It uses the previously owner-confirmed A02 cut at 245.133333s.

| Candidate event | Target time | Native source time |
| --- | --- | --- |
{timeline}

The P02 move leaves **{248.2 - (A02_CUT + MOVED_END - P01_CUT):.3f}s** before C02. The comparison reel omits the long C01 cutaway between its labeled snippets; it is not a full L01 or C01/C02 candidate. The [receipt](receipt.json) binds the source, script, EDL, prior A02 correction, cut points, output hash, and remaining gates. [Encoded-audio ASR evidence](asr-validation.json) found the moved sentence once in the after sequence, followed by P02's next sentence; it does not replace human listening.

The reel uses source presenter video and audio at native speed. During the moved sentence, the exact native opening presenter inset is composited onto the existing P02 map plate; no new talking-head pixels are generated. H.264/AAC is re-encoded for playback. No source word is synthesized or rewritten. Machine word times and full-decode checks support this edit, but a human must listen for any clipped phoneme or awkward visual handoff. No learner-facing media or binding changed, and no provider call, credits, merge, or release occurred.

Rebuild: `python3 -B scripts/qa/build-accelerated-l01-p01-sentence-move.py build`

Check: `python3 -B scripts/qa/build-accelerated-l01-p01-sentence-move.py check`
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('build', 'check'))
    action = parser.parse_args().action
    check_sources()
    if action == 'build':
        (ROOT / OUT).mkdir(parents=True, exist_ok=True)
        render()
    data = receipt()
    outputs = {'receipt.json': json.dumps(data, ensure_ascii=False, indent=2) + '\n',
               'README.md': readme(data)}
    for name, text in outputs.items():
        path = ROOT / OUT / name
        if action == 'build':
            path.write_text(text)
        else:
            assert path.read_text() == text, f'{name} differs from source-bound candidate'
    print(f'{action}: {data["reel"]["duration_seconds"]:.3f}s, P02 reserve {248.2 - (A02_CUT + MOVED_END - P01_CUT):.3f}s')


if __name__ == '__main__':
    main()
