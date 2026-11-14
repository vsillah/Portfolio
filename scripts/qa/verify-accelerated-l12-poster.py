#!/usr/bin/env python3
"""Verify the bound L12 poster against actual paused browser captures."""

import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageStat


ROOT = Path(__file__).resolve().parents[2]
RECEIPT = ROOT / 'docs/accelerated-course-modules/l09-l16-contextual-binding/l12-poster-receipt.json'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(condition, message):
    if not condition:
        raise SystemExit(f'L12 paused poster: {message}')


def main():
    receipt = json.loads(RECEIPT.read_text())
    manifest = json.loads((ROOT / 'docs/qa/accelerated-video-posters/source-map.json').read_text())['posters'][11]
    end_screen = json.loads((ROOT / 'lib/accelerated-end-screen-bindings.json').read_text())['lessons'][11]
    approval = json.loads((ROOT / 'docs/accelerated-course-modules/l09-l16-contextual-binding/human-qa-receipt.json').read_text())['l12_paused_poster_correction']
    require(approval['status'] == 'human_qa_pending' and approval['receipt_sha256'] == digest(RECEIPT), 'pending Human QA receipt drifted')
    require(receipt['schema'] == 'accelerated_l12_paused_poster_v1' and receipt['status'] == 'human_qa_pending', 'review receipt changed')
    canonical = receipt['canonical_sam']
    require(canonical['sha256'] == 'b7ab226d17f5ae4b421936b0ea541646223f55c0121da328e483941175c39ea3', 'canonical source identity changed')
    require(digest(ROOT / canonical['path']) == canonical['sha256'], 'canonical source drifted')
    require(manifest['kind'] == 'canonical_sam' and manifest['samOrBookAsset'] == canonical['path'], 'poster source is no longer the book plate')
    require(manifest['presenterFrameSource'] == receipt['opening_video']['path'], 'presenter frame source changed')
    require(digest(ROOT / receipt['opening_video']['path']) == receipt['opening_video']['sha256'], 'opening video drifted')
    require(end_screen['posterPath'] == '/' + manifest['output'].removeprefix('public/'), 'end-screen poster binding changed')
    require(end_screen['posterSha256'] == manifest['outputSha256'], 'end-screen poster hash changed')
    for variant, expected_size in [('desktop', [1280, 720]), ('portrait', [390, 844])]:
        item = receipt['variants'][variant]
        poster_path = ROOT / item['poster_path']
        screenshot_path = ROOT / item['screenshot_path']
        require(item['viewport_css'] == expected_size and item['video_paused'] is True and item['video_time_seconds'] == 0, f'{variant} is not a paused 0:00 capture')
        require(digest(poster_path) == item['poster_sha256'], f'{variant} poster drifted')
        require(digest(screenshot_path) == item['screenshot_sha256'], f'{variant} rendered screenshot drifted')
        require(item['poster_sha256'] != receipt['superseded_poster_sha256'], f'{variant} still uses the circular substitute')
        if variant == 'desktop':
            require(item['poster_path'] == manifest['output'] and item['poster_sha256'] == manifest['outputSha256'], 'desktop poster provenance changed')
        else:
            require(item['poster_path'] == manifest['portraitOutput']['path'] and item['poster_sha256'] == manifest['portraitOutput']['sha256'], 'portrait poster provenance changed')
        screenshot = Image.open(screenshot_path).convert('RGB')
        require(list(screenshot.size) == item['screenshot_pixels'], f'{variant} screenshot dimensions changed')
        box = tuple(item['video_box_pixels'])
        require(box[0] >= 0 and box[1] >= 0 and box[2] <= screenshot.width and box[3] <= screenshot.height, f'{variant} video crop is outside the rendered screenshot')
        rendered = screenshot.crop(box)
        poster = Image.open(poster_path).convert('RGB').resize(rendered.size, Image.Resampling.LANCZOS)
        # Browser controls occupy the bottom edge. Compare the visible poster above them.
        upper = (0, 0, rendered.width, round(rendered.height * .75))
        difference = ImageChops.difference(rendered.crop(upper), poster.crop(upper))
        mean = sum(ImageStat.Stat(difference).mean) / 3
        require(mean <= item['max_poster_mean_absolute_rgb'], f'{variant} rendered poster mismatch: mean RGB difference {mean:.2f}')
        playback = item['playback']
        movie = ROOT / playback['path']
        require(digest(movie) == playback['sha256'], f'{variant} browser playback clip drifted')
        probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_name,width,height,r_frame_rate,nb_frames', '-of', 'json', str(movie)]))
        video, audio = probe['streams']
        require(abs(float(probe['format']['duration']) - 9.6) < .02 and video['r_frame_rate'] == '10/1' and int(video['nb_frames']) == 96, f'{variant} playback timeline changed')
        require([video['width'], video['height']] == expected_size and audio['codec_name'] == 'aac', f'{variant} playback streams changed')
        print(f'{variant}: paused screenshot matches canonical poster (mean RGB difference {mean:.2f})')


if __name__ == '__main__':
    main()
