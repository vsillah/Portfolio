"""Encode the 41 browser-captured cards and eight second-frame samples.

Captures are made from the local `/services` review route in the in-app browser.
This creates a captured-state walkthrough, not a continuous screen recording.
"""

import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CAPTURES = ROOT / 'docs/showcase-audit/qa/services/raster-video-mobile'
OUTPUT = ROOT / 'docs/showcase-audit/qa/services/service-gallery-walkthrough.mp4'
SECOND_FRAME_SAMPLES = {1, 2, 4, 6, 7, 16, 20, 29}

images = []
for number in range(1, 42):
    images.append((CAPTURES / f'{number:02d}-hero.png', 1.35))
    if number in SECOND_FRAME_SAMPLES:
        images.append((CAPTURES / f'{number:02d}-artifact.png', 1.9))
assert all(path.is_file() for path, _ in images)

with tempfile.NamedTemporaryFile('w', suffix='.ffconcat', delete=False) as sequence:
    sequence.write('ffconcat version 1.0\n')
    for path, duration in images:
        sequence.write(f"file '{path}'\n")
        sequence.write(f'duration {duration}\n')
    sequence.write(f"file '{images[-1][0]}'\n")
    sequence_path = Path(sequence.name)

try:
    subprocess.run([
        'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
        '-safe', '0', '-f', 'concat', '-i', str(sequence_path),
        '-vf', 'fps=24,scale=780:1688:flags=lanczos,format=yuv420p',
        '-c:v', 'libx264', '-crf', '23', '-preset', 'medium',
        '-movflags', '+faststart', str(OUTPUT),
    ], check=True)
finally:
    sequence_path.unlink(missing_ok=True)

print(OUTPUT)
