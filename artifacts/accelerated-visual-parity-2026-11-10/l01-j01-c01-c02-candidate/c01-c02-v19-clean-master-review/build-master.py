#!/usr/bin/env python3
"""Build the single source-bound, caption-free L01 local review master."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
BASE = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate'
OUT = Path(__file__).resolve().parent
V13 = BASE / 'c01-c02-v13-playback-review/l01-c01-c02-v13-review.mp4'
V17 = BASE / 'c01-c02-v17-raster-caption-review/l01-c01-c02-v17-four-section-caption-review.mp4'
PLAN = BASE / 'c01-c02-v17-raster-caption-review/caption-plan.json'
VTT = BASE / 'c01-c02-v18-optional-caption-feasibility/lower-captions.vtt'
VIDEO = OUT / 'l01-c01-c02-v19-clean-master-review.mp4'
RECEIPT = OUT / 'render-receipt.json'
SOURCE_COMMIT = 'd5c1afec05215a77638b7bdc4e26e9ebdc72a102'
EXPECTED = {
    V13: 'e900e636b6f63eac2f177f8f585d4e14fcf166b8435af218327939ec5976e518',
    V17: '80a1be496b7b05e1ae7bf6bff2cd00e2410374e6c8abe65e280fe7e4c444d0d1',
    PLAN: 'd917317e98f7dc05590e714097af9faf00a9c09236ce894a18c214ce9138b21e',
    VTT: '427376480d444d321513ddc09c226e7896967909d8baa790b1569dd4a79b508b',
}
AUDIO_HASH = '5bef7336fbd6b0716007208d8481ba8bd896768a8ed3c9b7f206a7e1d859c655'
SEGMENTS = [('P01', 0, 710), ('C01', 710, 5875), ('P02', 5875, 6205), ('C02', 6205, 8625)]


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(4 * 1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def output(args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def probe(path):
    data = json.loads(output(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v:0',
                              '-show_entries', 'format=duration:stream=width,height,r_frame_rate,nb_read_frames',
                              '-of', 'json', str(path)]))
    stream = data['streams'][0]
    return {'duration': float(data['format']['duration']), 'width': stream['width'],
            'height': stream['height'], 'fps': stream['r_frame_rate'],
            'frames': int(stream['nb_read_frames'])}


def audio_hash(path):
    return output(['ffmpeg', '-v', 'error', '-i', str(path), '-map', '0:a:0', '-c:a', 'copy',
                   '-f', 'streamhash', '-hash', 'sha256', '-']).strip().removeprefix('0,a,SHA256=')


def decoded_audio_hash(path):
    return output(['ffmpeg', '-v', 'error', '-i', str(path), '-map', '0:a:0',
                   '-f', 'hash', '-hash', 'sha256', '-']).strip().removeprefix('SHA256=')


def preflight():
    for path, digest in EXPECTED.items():
        assert path.is_file() and sha(path) == digest, f'source drift: {path}'
    assert subprocess.run(['git', '-C', str(ROOT), 'merge-base', '--is-ancestor',
                           SOURCE_COMMIT, 'HEAD']).returncode == 0, 'source commit not in history'
    assert probe(V13) == {'duration': 345.0, 'width': 1280, 'height': 900,
                          'fps': '25/1', 'frames': 8625}
    assert audio_hash(V13) == audio_hash(V17) == AUDIO_HASH
    assert sum(end - start for _, start, end in SEGMENTS) == 8625
    plan = json.loads(PLAN.read_text())
    cues = plan['caption_cues']
    assert len(cues) == plan['caption_cue_count'] == 175
    def stamp(value):
        ms = round(value * 1000)
        return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d}.{ms % 1000:03d}'
    expected_vtt = 'WEBVTT\n\n' + '\n\n'.join(
        f'{i}\n{stamp(cue["start"])} --> {stamp(cue["end"])} line:72%\n{cue["text"]}'
        for i, cue in enumerate(cues, 1)) + '\n'
    assert VTT.read_text() == expected_vtt, 'caption words, times, or position drift'
    assert all(0 <= cue['start'] < cue['end'] <= 345 for cue in cues)
    assert all(a['end'] <= b['start'] for a, b in zip(cues, cues[1:]))
    print('preflight passed: exact sources, 345s/8625 frames, copied AAC, 175 cues', flush=True)


def render():
    preflight()
    assert not VIDEO.exists() and not RECEIPT.exists(), 'one-render output already exists'
    filters = ['[0:v]split=4[s0][s1][s2][s3]']
    for i, (label, start, end) in enumerate(SEGMENTS):
        filt = f'[s{i}]trim=start_frame={start}:end_frame={end},setpts=PTS-STARTPTS,crop=1280:720:0:0'
        if label in ('C01', 'C02'):
            filt += ',scale=1100:619:flags=lanczos,pad=1280:1080:90:110:color=0x0b1c26'
        else:
            filt += ',pad=1280:1080:0:0:color=0x0b1c26'
        filters.append(filt + f',setsar=1[v{i}]')
    filters.append(''.join(f'[v{i}]' for i in range(4)) + 'concat=n=4:v=1:a=0[v]')
    command = ['ffmpeg', '-v', 'error', '-nostdin', '-i', str(V13),
               '-filter_complex', ';'.join(filters), '-map', '[v]', '-map', '0:a:0',
               '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-threads', '4',
               '-pix_fmt', 'yuv420p', '-r', '25', '-c:a', 'copy', '-movflags', '+faststart',
               str(VIDEO)]
    print('starting one local render', flush=True)
    try:
        subprocess.run(command, check=True)
    except Exception as exc:
        raise RuntimeError('single render failed; preserve partial output and stop without retry') from exc
    inspect(write=True)


def inspect(write=False):
    preflight()
    assert VIDEO.is_file(), 'review master missing'
    result = probe(VIDEO)
    assert result == {'duration': 345.0, 'width': 1280, 'height': 1080,
                      'fps': '25/1', 'frames': 8625}, result
    assert audio_hash(VIDEO) == AUDIO_HASH, 'encoded audio stream changed'
    decoded = decoded_audio_hash(V13)
    assert decoded_audio_hash(VIDEO) == decoded, 'decoded audio changed'
    subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-i', str(VIDEO), '-f', 'null', '-'], check=True)
    receipt = {'status': 'local_review_only_clean_master_technical_pass',
               'source_commit': SOURCE_COMMIT,
               'source_hashes': {str(path.relative_to(ROOT)): digest for path, digest in EXPECTED.items()},
               'video_path': str(VIDEO.relative_to(ROOT)), 'video_sha256': sha(VIDEO),
               'video': result, 'encoded_audio_stream_sha256': AUDIO_HASH,
               'decoded_audio_sha256': decoded,
               'sections': [{'id': label, 'start_frame': start, 'end_frame': end}
                            for label, start, end in SEGMENTS],
               'validation': ['full decode', '345.000 seconds', '8625 frames',
                              'encoded and decoded audio identity', '175-cue optional VTT exact parity'],
               'remaining': ['visual and actual-player review', 'speech joins', 'Human QA'],
               'scope': 'caption-free local P01/C01/P02/C02 review master; no learner binding'}
    if write:
        RECEIPT.write_text(json.dumps(receipt, indent=2) + '\n')
    else:
        assert RECEIPT.is_file() and json.loads(RECEIPT.read_text()) == receipt
    print('inspect passed: ' + receipt['video_sha256'], flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['preflight', 'render', 'inspect'])
    {'preflight': preflight, 'render': render, 'inspect': inspect}[parser.parse_args().action]()
