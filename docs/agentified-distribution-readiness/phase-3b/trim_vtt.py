"""Cut a VTT window for a contextual QA clip, preserving cue text."""

import re
import sys
from pathlib import Path

source, target, offset, length = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])


def seconds(clock: str) -> float:
    parts = clock.split(':')
    return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])


def clock(value: float) -> str:
    millis = round(value * 1000)
    hours, rem = divmod(millis, 3600000)
    minutes, rem = divmod(rem, 60000)
    sec, ms = divmod(rem, 1000)
    return f'{hours:02d}:{minutes:02d}:{sec:02d}.{ms:03d}'


blocks = []
for block in Path(source).read_text().strip().split('\n\n'):
    lines = block.splitlines()
    timing = next((i for i, line in enumerate(lines) if '-->' in line), None)
    if timing is None:
        continue
    match = re.fullmatch(r'(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})', lines[timing])
    if match is None:
        raise ValueError(f'unexpected cue timing: {lines[timing]}')
    start = max(0, seconds(match[1]) - offset)
    end = min(length, seconds(match[2]) - offset)
    if end <= start:
        continue
    blocks.append(f'{clock(start)} --> {clock(end)}\n' + '\n'.join(lines[timing + 1:]))

Path(target).write_text('WEBVTT\n\n' + '\n\n'.join(blocks) + '\n')
print(f'{len(blocks)} cues retained: {target}')
