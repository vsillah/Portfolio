#!/usr/bin/env python3
"""Bind approved v9 Signals review frames into full L01/L02/L05 learner media."""
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'artifacts/accelerated-signals-v9-learner-2026-11-15'
SOURCES = {
    'L01': ('public/accelerated/visual-parity/l01/visual-a70ed876/l01-visual-parity.mp4', 'a70ed876ccdedd468c1cfa7ea995087683c715fdb97c50bb1d58a58436820725', 540, 13500, [(0, 240)]),
    'L02': ('public/accelerated/visual-parity/l02/visual-585074b6/l02-visual-parity.mp4', '585074b6db4e73a7b2c61dcf02d6fdcaeaacbf72e33edfed2b2e3a1c82d6850c', 600, 15000, [(1, 100)]),
    'L05': ('public/accelerated/visual-parity/l05/visual-60b0c76b/l05-visual-parity.mp4', '60b0c76bdb34819f2e7dc9585e6a5ce5233c435a481e996eb923af1a2a3005b7', 600, 15000, [(2, 2), (3, 212)]),
}
REELS = {
    'desktop': ('artifacts/accelerated-sam-contextual-review-2026-11-14/accelerated-sam-signals-desktop-review-v9-conditional.mp4', 'c2bb416fb09770113049da171fd257cdbe9ebd44ad4bb53a4ab25270d495552e'),
    'portrait': ('artifacts/accelerated-sam-contextual-review-2026-11-14/accelerated-sam-signals-mobile-review-v9-conditional.mp4', 'af0459bb8fc25d53cc3cb2117e2a210c6174efb75b0ac146221793bb4fdac657'),
}

def sha(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()

def output(*args):
    return subprocess.check_output(args, text=True).strip()

def probe(file):
    return json.loads(output('ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,nb_frames,r_frame_rate', '-of', 'json', str(file)))

def stream_hash(file):
    return output('ffmpeg', '-v', 'error', '-i', str(file), '-map', '0:a:0', '-c', 'copy', '-f', 'hash', '-hash', 'SHA256', '-')

def render(lesson, aspect):
    source_rel, source_hash, duration, frames, scenes = SOURCES[lesson]
    reel_rel, reel_hash = REELS[aspect]
    source, reel = ROOT / source_rel, ROOT / reel_rel
    if sha(source) != source_hash or sha(reel) != reel_hash:
        raise RuntimeError(f'{lesson} {aspect}: source hash drift')
    source_probe = probe(source)
    source_video = next(s for s in source_probe['streams'] if s['codec_type'] == 'video')
    if int(source_video['nb_frames']) != frames or source_video['r_frame_rate'] != '25/1' or abs(float(source_probe['format']['duration']) - duration) > .001:
        raise RuntimeError(f'{lesson} source timing drift')
    base = '[0:v]format=yuv420p[base]' if aspect == 'desktop' else '[0:v]scale=390:219:flags=lanczos,pad=390:844:0:312:color=0x10112c,format=yuv420p[base]'
    filters = [base]
    if len(scenes) > 1:
        filters.append('[1:v]split=' + str(len(scenes)) + ''.join(f'[reel{i}]' for i in range(len(scenes))))
    prior = 'base'
    for i, (index, start) in enumerate(scenes):
        stream = f'reel{i}' if len(scenes) > 1 else '1:v'
        visual = f'visual{i}'
        if aspect == 'desktop':
            filters.append(f'[{stream}]trim=start_frame={index*200}:end_frame={(index+1)*200},setpts=PTS-STARTPTS+{start}/TB,scale=1920:1080:flags=lanczos,format=yuv420p[{visual}]')
        else:
            filters.append(f'[{stream}]trim=start_frame={index*200}:end_frame={(index+1)*200},setpts=PTS-STARTPTS+{start}/TB,format=yuv420p[{visual}]')
        target = 'v' if i == len(scenes)-1 else f'layer{i}'
        filters.append(f"[{prior}][{visual}]overlay=0:0:eof_action=pass:enable='gte(t,{start})*lt(t,{start+8})',format=yuv420p[{target}]")
        prior = target
    OUT.mkdir(parents=True, exist_ok=True)
    building = OUT / f'{lesson.lower()}-{aspect}-building.mp4'
    command = ['ffmpeg', '-y', '-nostdin', '-loglevel', 'error', '-i', str(source), '-i', str(reel), '-filter_complex', ';'.join(filters), '-map', '[v]', '-map', '0:a:0', '-map', '0:s?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-g', '25', '-keyint_min', '25', '-sc_threshold', '0', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-c:s', 'copy', '-frames:v', str(frames), '-movflags', '+faststart', str(building)]
    subprocess.run(command, check=True)
    result_probe = probe(building)
    video = next(s for s in result_probe['streams'] if s['codec_type'] == 'video')
    if int(video['nb_frames']) != frames or video['r_frame_rate'] != '25/1' or abs(float(result_probe['format']['duration']) - duration) > .03:
        raise RuntimeError(f'{lesson} {aspect}: output timing drift: {result_probe}')
    if stream_hash(source) != stream_hash(building):
        raise RuntimeError(f'{lesson} {aspect}: AAC stream changed')
    result_hash = sha(building)
    target = ROOT / f'public/accelerated/signals-v9/{lesson.lower()}/signals-{result_hash[:12]}/{lesson.lower()}-{aspect}.mp4'
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and sha(target) != result_hash:
        raise RuntimeError(f'{lesson} {aspect}: immutable target collision')
    if not target.exists():
        building.replace(target)
    else:
        building.unlink()
    return {'path': '/' + str(target.relative_to(ROOT / 'public')), 'sha256': result_hash, 'bytes': target.stat().st_size, 'source_path': source_rel, 'source_sha256': source_hash, 'v9_reel_path': reel_rel, 'v9_reel_sha256': reel_hash, 'duration_seconds': duration, 'frames': frames, 'audio_stream_sha256': stream_hash(target), 'scene_windows': [{'review_reel_segment': index, 'start_seconds': start, 'end_seconds': start+8} for index,start in scenes]}

def main():
    receipt = {'schema': 'accelerated_signals_v9_full_learner_media_v1', 'base_head': '0e72afd83ca7b574f26034f8c462d6003edccf9c', 'fps': 25, 'mobile_base': 'existing landscape lesson frame centered at native 390px width; approved portrait v9 frame fills the focus windows', 'lessons': {}}
    for lesson in SOURCES:
        receipt['lessons'][lesson] = {}
        for aspect in ('desktop', 'portrait'):
            receipt['lessons'][lesson][aspect] = render(lesson, aspect)
            print(f'{lesson} {aspect}: {receipt["lessons"][lesson][aspect]["sha256"]}', flush=True)
    path = OUT / 'render-receipt.json'
    path.write_text(json.dumps(receipt, indent=2) + '\n')
    print(path)

if __name__ == '__main__':
    main()
