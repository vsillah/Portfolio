#!/usr/bin/env python3
"""Build unbound L16 route-review media with exact authored scene timing."""

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
BASE = Path(__file__).resolve().parent
TIMING = json.loads((BASE / 'l16-scene-exact-timing-receipt.json').read_text())
COMPOSITES = json.loads((ROOT / 'agentified/workshop/presentation-illustration-audit/composite-receipts.json').read_text())
SOURCE_RECEIPT = next(
    item for group in COMPOSITES.values() if isinstance(group, list)
    for item in group if isinstance(item, dict) and item.get('lesson_id') == 'L16'
)


def build(layout: str, output: Path) -> None:
    source = ROOT / 'public/agentified/lessons/l16/illustrated-4283c8d8/agentified-l16-illustrated-composite.mp4'
    assert SOURCE_RECEIPT['output_sha256'] == '4283c8d8fb7eca85b9b0493aa07ac22901f0155d0742ebc61c0a0744698846fc'
    assert hashlib.sha256(source.read_bytes()).hexdigest() == SOURCE_RECEIPT['output_sha256']
    protected = SOURCE_RECEIPT['protected_windows']
    opening_end, closing_start, countdown_start = protected[0][1], protected[1][0], protected[2][0]
    rows: list[tuple[Path, float, float]] = []
    for scene in SOURCE_RECEIPT['scene_boundaries']:
        scene_id = scene['scene_id']
        number = int(scene_id[-2:])
        start, end = scene['start_seconds'], scene['end_seconds']
        if number == 1:
            start = opening_end
        if number == 7:
            end = countdown_start
        if number == 8:
            end = closing_start
        if number in (4, 5):
            authored = next(item for item in TIMING['scenes'] if item['scene'] == scene_id)
            states = next(item for item in authored['layouts'] if item['layout'] == layout)['states']
            cursor = start
            for index, state in enumerate(states):
                next_cursor = end if index == len(states) - 1 else cursor + state['durationSeconds']
                rows.append((ROOT / state['frame'], cursor, next_cursor))
                cursor = next_cursor
            assert abs(cursor - end) < 0.001
        else:
            rows.append((BASE / 'frames/illustrated' / f'{scene_id}.png', start, end))

    output.parent.mkdir(parents=True, exist_ok=True)
    args = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source)]
    for frame, _, _ in rows:
        assert frame.is_file(), frame
        args += ['-loop', '1', '-framerate', '25', '-i', str(frame)]
    filters = []
    previous = '0:v'
    for index, (_, start, end) in enumerate(rows, 1):
        current = f'v{index}'
        filters.append(f"[{previous}][{index}:v]overlay=enable='gte(t,{start})*lt(t,{end})':shortest=1:format=auto[{current}]")
        previous = current
    filters.append(f'[{previous}]format=yuv420p[v]')
    args += ['-filter_complex', ';'.join(filters), '-map', '[v]', '-map', '0:a?', '-map', '0:s?',
             '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-r', '25',
             '-c:a', 'copy', '-c:s', 'copy', '-t', str(SOURCE_RECEIPT['source_duration_seconds']),
             '-movflags', '+faststart', str(output)]
    subprocess.run(args, check=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('layout', choices=['desktop', 'mobile'])
    parser.add_argument('output', type=Path)
    inputs = parser.parse_args()
    build(inputs.layout, inputs.output)
