"""Extract script narration and compare its normalized words with a bound VTT."""

import re
import unicodedata

HEADER = '| Spoken narration — read in full |'
EXPECTED_COUNTS = {
    'L01': 589, 'L05': 527, 'L06': 554, 'L07': 538, 'L08': 529,
    'L09': 582, 'L10': 571, 'L11': 574, 'L12': 578, 'L13': 523,
    'L14': 506, 'L15': 555, 'L16': 581,
}


def script_narration(script: str) -> str:
    lines = script.splitlines()
    headers = [index for index, line in enumerate(lines) if HEADER in line]
    if len(headers) != 1:
        raise ValueError(f'expected one narration table, found {len(headers)}')
    rows = []
    for line in lines[headers[0] + 2:]:
        if not line.startswith('|'):
            break
        cells = [cell.strip() for cell in line.strip().strip('|').split('|')]
        if len(cells) != 3 or not cells[1].startswith('“') or not cells[1].endswith('”'):
            raise ValueError(f'invalid narration row: {line[:80]}')
        rows.append(cells[1][1:-1])
    if len(rows) != 8:
        raise ValueError(f'expected eight narration rows, found {len(rows)}')
    return '\n\n'.join(rows) + '\n'


def caption_text(vtt: str) -> str:
    if not vtt.startswith('WEBVTT'):
        raise ValueError('missing WEBVTT header')
    cues = []
    for block in re.split(r'\n\s*\n', vtt):
        if '-->' not in block:
            continue
        lines = block.splitlines()
        timing = next((index for index, line in enumerate(lines) if '-->' in line), None)
        if timing is None or timing == len(lines) - 1:
            raise ValueError('empty caption cue')
        cues.append(' '.join(lines[timing + 1:]))
    if not cues:
        raise ValueError('no caption cues')
    return ' '.join(cues)


def normalized_words(text: str) -> list[str]:
    text = unicodedata.normalize('NFKC', text).translate(str.maketrans({
        '’': "'", '‘': "'", '“': '"', '”': '"',
    })).casefold()
    return re.findall(r"[a-z0-9]+(?:'[a-z0-9]+)?", text)


def assert_word_match(lesson_id: str, transcript: str, vtt: str) -> int:
    actual = normalized_words(transcript)
    captions = normalized_words(caption_text(vtt))
    expected = EXPECTED_COUNTS[lesson_id]
    if len(actual) != expected or actual != captions:
        mismatch = next((i for i, pair in enumerate(zip(actual, captions)) if pair[0] != pair[1]), None)
        raise ValueError(f'{lesson_id} transcript/VTT word mismatch: transcript={len(actual)}, VTT={len(captions)}, expected={expected}, firstMismatch={mismatch}')
    return expected
