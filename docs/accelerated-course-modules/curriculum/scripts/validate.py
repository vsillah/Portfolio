#!/usr/bin/env python3
"""Validate the Phase 2 editorial packet without provider or network calls."""
from pathlib import Path
import json
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parent
EPUB = Path('/Users/vambahsillah/Projects/Portfolio/accelerated_ebook_leadmagnet.epub')
ORDER = [('L01', 9), ('L02', 10), ('L03', 9), ('L04', 10)]
WORD = re.compile(r"\b[\w’'-]+\b")
TIME = re.compile(r'^(\d\d):(\d\d)$')
SCENE = re.compile(r'^## Scene (\d+) · (\d\d:\d\d)–(\d\d:\d\d) · (.+)$', re.M)
SOURCE = re.compile(r'\*\*Source:\*\* (.+?) \*\*Avatar:\*\*', re.S)
CITE = re.compile(r'`(c\d{3}\.xhtml)`')
REQUIRED = ['## On-screen copy', '## Exercise and handoff', '## Claims and demo ledger', '**Pronunciation:**', '**Audio:**']


def seconds(stamp):
    m = TIME.fullmatch(stamp)
    assert m and int(m[2]) < 60, f'Invalid timestamp {stamp}'
    return int(m[1]) * 60 + int(m[2])


def norm(value):
    return re.sub(r'\s+', ' ', value.casefold().replace('\\"', '"').replace('’', "'").replace('“', '"').replace('”', '"')).strip()


def epub_text():
    assert EPUB.is_file(), f'Canonical EPUB unavailable: {EPUB}'
    with zipfile.ZipFile(EPUB) as archive:
        names = archive.namelist()
        texts = {}
        for name in names:
            if re.search(r'c00[2-9]\.xhtml$', name):
                root = ET.fromstring(archive.read(name))
                texts[Path(name).name] = norm(' '.join(root.itertext()))
    assert len(texts) == 8, f'Expected foreword, safety note, and Chapters 1–6; got {list(texts)}'
    return texts


def main():
    source = epub_text()
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    assert [x['id'] for x in manifest['lessons']] == [x[0] for x in ORDER]
    board = (ROOT / 'storyboard-brief.md').read_text()
    total_words = 0
    for lesson_id, minutes in ORDER:
        path = ROOT / f'{lesson_id}.md'
        content = path.read_text()
        assert all(x in content for x in REQUIRED), f'{lesson_id}: missing package section'
        assert f'**Target:** {minutes:02}:00' in content
        scenes = list(SCENE.finditer(content))
        assert len(scenes) in (6, 7), f'{lesson_id}: expected 6–7 scenes'
        assert [int(s[1]) for s in scenes] == list(range(1, len(scenes) + 1))
        assert seconds(scenes[0][2]) == 0 and seconds(scenes[-1][3]) == minutes * 60
        words = 0
        avatar_ids = []
        for index, scene in enumerate(scenes):
            end = scenes[index + 1].start() if index + 1 < len(scenes) else content.index('## On-screen copy')
            block = content[scene.end():end]
            assert seconds(scene[3]) > seconds(scene[2])
            if index:
                assert scene[2] == scenes[index - 1][3], f'{lesson_id}: scene timing gap'
            source_match = SOURCE.search(block)
            assert source_match, f'{lesson_id} scene {index+1}: no source'
            cites = CITE.findall(source_match[1])
            assert cites and all(c in source for c in cites), f'{lesson_id} scene {index+1}: invalid EPUB file citation'
            for heading in re.findall(r'“([^”]+)”', source_match[1]):
                heading = heading.rstrip(',; ')
                if heading not in ('Why This Book Exists',):
                    assert any(norm(heading) in source[c] for c in cites), f'{lesson_id}: heading absent from EPUB: {heading}'
            speech = re.search(r'```narration\n(.*?)\n```', block, re.S)
            assert speech, f'{lesson_id} scene {index+1}: no spoken narration'
            count = len(WORD.findall(speech[1]))
            duration = seconds(scene[3]) - seconds(scene[2])
            rate = count * 60 / duration
            assert 115 <= rate <= 145, f'{lesson_id} scene {index+1}: {rate:.1f} wpm outside band'
            words += count
            avatar_header = block.split('**B-roll:**')[0]
            avatars = re.findall(r'\bA\d\d\b', avatar_header)
            avatar_ids.extend(avatars)
            if avatars:
                window = re.search(r'(\d\d:\d\d)–(\d\d:\d\d)', avatar_header)
                assert window and seconds(scene[2]) <= seconds(window[1]) < seconds(window[2]) <= seconds(scene[3]), f'{lesson_id} scene {index+1}: avatar outside scene'
            assert f'| {lesson_id}-{index+1} {scene[2]}–{scene[3]} |' in board, f'{lesson_id} scene {index+1}: missing or mistimed visual beat'
            assert '**B-roll:**' in block and '**Delivery:**' in block
        assert 2 <= len(avatar_ids) <= 4 and len(avatar_ids) == len(set(avatar_ids)), f'{lesson_id}: avatar count/IDs'
        assert 115 <= words / minutes <= 145, f'{lesson_id}: total spoken rate'
        assert 'pause' in content.lower() and 'resume' in content.lower() and ('restricted' in content.lower() or 'private' in content.lower())
        assert 'Blocked future capture' in content and 'unused' in content.lower()
        entry = next(x for x in manifest['lessons'] if x['id'] == lesson_id)
        assert entry['runtime_seconds'] == minutes * 60 and entry['spoken_words'] == words
        assert entry['readiness'] == 'editorial-review'
        total_words += words
        print(f'PASS {lesson_id}: {len(scenes)} scenes, {words} words, {words/minutes:.1f} wpm, {len(avatar_ids)} avatar segments')
    assert total_words == manifest['spoken_words_total']
    assert 'humanizer' in (ROOT / 'README.md').read_text().lower()
    print(f'PASS packet: 4 lessons, 38 minutes, {total_words} spoken words; EPUB, storyboard, privacy and boundaries checked')


if __name__ == '__main__':
    try:
        main()
    except (AssertionError, OSError, ValueError, ET.ParseError) as exc:
        print(f'FAIL: {exc}', file=sys.stderr)
        sys.exit(1)
