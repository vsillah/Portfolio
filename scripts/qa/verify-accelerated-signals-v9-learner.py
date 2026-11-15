#!/usr/bin/env python3
"""Verify immutable L01/L02/L05 v9 learner media against approved source identities."""
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BINDING = ROOT / 'lib/accelerated-signals-v9-bindings.json'
RENDER = ROOT / 'artifacts/accelerated-signals-v9-learner-2026-11-15/render-receipt.json'
OUT = ROOT / 'artifacts/accelerated-signals-v9-learner-2026-11-15/media-validation.json'

def sha(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()

def command(*args):
    return subprocess.check_output(args, text=True).strip()

def probe(file):
    return json.loads(command('ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,nb_frames,r_frame_rate', '-of', 'json', str(file)))

def audio_hash(file):
    return command('ffmpeg', '-v', 'error', '-i', str(file), '-map', '0:a:0', '-c', 'copy', '-f', 'hash', '-hash', 'SHA256', '-')

def frame_pts(file):
    return command('ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'frame=best_effort_timestamp_time', '-of', 'csv=p=0', str(file)).splitlines()

def main():
    b = json.loads(BINDING.read_text())
    r = json.loads(RENDER.read_text())
    if b['schema'] != 'accelerated_signals_v9_learner_binding_v1' or set(b['lessons']) != {'L01', 'L02', 'L05'}:
        raise RuntimeError('unexpected lesson binding scope')
    checks = {}
    for lesson, item in b['lessons'].items():
        checks[lesson] = {}
        for aspect, variant in item['variants'].items():
            proof = r['lessons'][lesson][aspect]
            target = ROOT / 'public' / variant['path'].lstrip('/')
            source = ROOT / proof['source_path']
            reel = ROOT / proof['v9_reel_path']
            caption = ROOT / 'public' / item['caption']['path'].lstrip('/')
            poster = ROOT / 'public' / item['poster']['path'].lstrip('/')
            if (variant['path'] != proof['path'] or variant['sha256'] != proof['sha256'] or variant['bytes'] != target.stat().st_size
                    or sha(target) != variant['sha256'] or sha(source) != proof['source_sha256']
                    or sha(reel) != proof['v9_reel_sha256'] or sha(caption) != item['caption']['sha256']
                    or sha(poster) != item['poster']['sha256']):
                raise RuntimeError(f'{lesson} {aspect}: source, caption, poster, or output drift')
            before, after = probe(source), probe(target)
            bv = next(s for s in before['streams'] if s['codec_type'] == 'video')
            av = next(s for s in after['streams'] if s['codec_type'] == 'video')
            if (bv['nb_frames'] != av['nb_frames'] or bv['r_frame_rate'] != av['r_frame_rate'] or
                    abs(float(before['format']['duration']) - float(after['format']['duration'])) > .03 or
                    audio_hash(source) != audio_hash(target) or audio_hash(target) != item['audio_stream_sha256']):
                raise RuntimeError(f'{lesson} {aspect}: audio or timing drift')
            source_pts, output_pts = frame_pts(source), frame_pts(target)
            if source_pts != output_pts:
                raise RuntimeError(f'{lesson} {aspect}: video frame PTS drift')
            checks[lesson][aspect] = {'path': variant['path'], 'sha256': variant['sha256'], 'frames': int(av['nb_frames']), 'duration_seconds': float(after['format']['duration']), 'audio_stream_sha256': item['audio_stream_sha256'], 'caption_sha256': item['caption']['sha256'], 'poster_sha256': item['poster']['sha256'], 'frame_pts_identity': True, 'source_sha256': proof['source_sha256'], 'v9_reel_sha256': proof['v9_reel_sha256']}
            print(f'PASS {lesson} {aspect}: hashes, audio, captions, duration, frame PTS', flush=True)
    OUT.write_text(json.dumps({'schema': 'accelerated_signals_v9_learner_validation_v1', 'binding_sha256': sha(BINDING), 'render_receipt_sha256': sha(RENDER), 'checks': checks}, indent=2) + '\n')

if __name__ == '__main__':
    main()
