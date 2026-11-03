#!/usr/bin/env python3
"""Validate the L09–L12 editorial packet without provider calls."""
from pathlib import Path
import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[3]
EPUB = REPO / "accelerated_ebook_leadmagnet.epub"
EPUB_SHA = "1aa0ac5efb94f10e09c939cc8eb4ded7512473bee763e6f1eecdd747cb7db46e"
ORDER = [
    ("L09", 11, ["c017.xhtml", "c018.xhtml"]),
    ("L10", 9, ["c019.xhtml"]),
    ("L11", 10, ["c020.xhtml", "c021.xhtml"]),
    ("L12", 11, ["c022.xhtml", "c023.xhtml"]),
]
WORD = re.compile(r"\b[\w’'-]+\b")
SCENE = re.compile(r"^## Scene (\d+) · (\d\d:\d\d)–(\d\d:\d\d) · (.+)$", re.M)
CITE = re.compile(r"`(c\d{3}\.xhtml)`")
REQUIRED = [
    "## On-screen copy", "## Exercise and handoff", "## Claims and demo ledger",
    "**Pronunciation:**", "**Audio:**", "Blocked future capture",
]
INTERNAL_SPEECH = re.compile(
    r"(?i)provider execution|production notes|qa notes|asset manifest|prompt instructions|"
    r"placeholder|stable asset hash|no provider"
)


def seconds(stamp):
    minute, second = map(int, stamp.split(":"))
    assert second < 60, f"invalid timestamp {stamp}"
    return minute * 60 + second


def norm(value):
    return re.sub(r"\s+", " ", value.casefold().replace('\\"', '"')
                  .replace("’", "'").replace("“", '"').replace("”", '"')).strip()


def source_text():
    assert EPUB.is_file(), f"canonical EPUB unavailable: {EPUB}"
    assert hashlib.sha256(EPUB.read_bytes()).hexdigest() == EPUB_SHA, "canonical EPUB changed"
    with zipfile.ZipFile(EPUB) as archive:
        result = {}
        for name in archive.namelist():
            base = Path(name).name
            if base in {f"c{i:03}.xhtml" for i in range(17, 24)}:
                result[base] = norm(" ".join(ET.fromstring(archive.read(name)).itertext()))
    assert len(result) == 7, f"expected Chapters 14–20; found {list(result)}"
    return result


def main():
    source = source_text()
    manifest = json.loads((ROOT / "manifest-l09-l12.json").read_text())
    assert manifest["base_commit"] == "2546d07bd25c6ec9ee84dd7b19771fb72a0a6c37"
    assert [entry["id"] for entry in manifest["lessons"]] == [row[0] for row in ORDER]
    board = (ROOT / "storyboard-brief-l09-l12.md").read_text()
    notes = (ROOT / "source-notes-l09-l12.md").read_text()
    assert EPUB_SHA in notes and "Book case" in notes
    total_words = total_seconds = 0
    for lesson_id, minutes, files in ORDER:
        content = (ROOT / f"{lesson_id}.md").read_text()
        assert all(item in content for item in REQUIRED), f"{lesson_id}: missing package section"
        assert f"**Target:** {minutes:02}:00" in content
        assert "pause" in content.lower() and "resume" in content.lower()
        assert "private" in content.lower() and "synthetic" in content.lower()
        scenes = list(SCENE.finditer(content))
        assert len(scenes) == 6 and [int(s[1]) for s in scenes] == list(range(1, 7))
        assert seconds(scenes[0][2]) == 0 and seconds(scenes[-1][3]) == minutes * 60
        words, avatar_ids = 0, []
        for index, scene in enumerate(scenes):
            end = scenes[index + 1].start() if index + 1 < 6 else content.index("## On-screen copy")
            block = content[scene.end():end]
            assert seconds(scene[3]) > seconds(scene[2])
            if index:
                assert scene[2] == scenes[index - 1][3], f"{lesson_id}: scene timing gap"
            source_header = block.split("**Avatar:**")[0]
            assert "**Source:**" in source_header
            cites = CITE.findall(source_header)
            assert cites and set(cites) <= set(files), f"{lesson_id} scene {index+1}: invalid citation"
            for heading in re.findall(r"“([^”]+)”", source_header):
                heading = heading.rstrip(",; ")
                assert any(norm(heading) in source[cite] for cite in cites), (
                    f"{lesson_id}: EPUB heading absent: {heading}"
                )
            narration = re.search(r"```narration\n(.*?)\n```", block, re.S)
            assert narration, f"{lesson_id} scene {index+1}: no narration"
            assert not INTERNAL_SPEECH.search(narration[1]), f"{lesson_id}: internal speech"
            count = len(WORD.findall(narration[1]))
            rate = count * 60 / (seconds(scene[3]) - seconds(scene[2]))
            assert 115 <= rate <= 145, f"{lesson_id} scene {index+1}: {rate:.1f} wpm"
            words += count
            avatar_header = block.split("**B-roll:**")[0]
            avatars = re.findall(r"\bA\d\d\b", avatar_header)
            avatar_ids.extend(avatars)
            if avatars:
                window = re.search(r"(\d\d:\d\d)–(\d\d:\d\d)", avatar_header)
                assert window and seconds(scene[2]) <= seconds(window[1]) < seconds(window[2]) <= seconds(scene[3])
            assert "**B-roll:**" in block and "**Delivery:**" in block and "**Visible copy:**" in block
            assert f"| {lesson_id}-{index+1} {scene[2]}–{scene[3]} |" in board
        assert 2 <= len(avatar_ids) <= 4 and len(set(avatar_ids)) == len(avatar_ids)
        entry = next(item for item in manifest["lessons"] if item["id"] == lesson_id)
        assert entry["epub_files"] == files and entry["spoken_words"] == words
        assert entry["runtime_seconds"] == minutes * 60 and entry["readiness"] == "editorial-review"
        assert all((REPO / asset).is_file() for asset in entry["sam_assets"])
        total_words += words
        total_seconds += minutes * 60
        print(f"PASS {lesson_id}: 6 scenes, {words} words, {words/minutes:.1f} wpm, {len(avatar_ids)} avatar segments")
    assert "Power × Interest" in (ROOT / "L09.md").read_text()
    assert "Simulation" in (ROOT / "L12.md").read_text()
    assert total_words == manifest["spoken_words_total"] and total_seconds == manifest["runtime_seconds_total"]
    print(f"PASS packet: 4 lessons, {total_seconds//60} minutes, {total_words} spoken words")


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, OSError, ValueError, ET.ParseError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
