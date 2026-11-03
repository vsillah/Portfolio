#!/usr/bin/env python3
"""Check the editorial package's chapter coverage and lesson contract."""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
crosswalk = (ROOT / "book-crosswalk.md").read_text()
outline = (ROOT / "video-workshop-outline.md").read_text()
production = (ROOT / "production-and-provenance.md").read_text()
section_index = (ROOT / "epub-section-index.md").read_text()

rows = re.findall(r"^\| Chapter (\d+): ([^|]+) \| ([^|]+) \| (L\d\d) \|", crosswalk, re.M)
numbers = [int(row[0]) for row in rows]
assert numbers == list(range(1, 27)), f"Expected Chapters 1–26 once and in order; got {numbers}"
allowed = {"Core lesson", "Supporting lesson", "Exercise", "Reference", "Deliberately deferred"}
assert all(row[2].strip() in allowed for row in rows), "Unknown chapter disposition"
assert "| Foreword |" in crosswalk and "| A Critical Note on Data Safety |" in crosswalk

modules = re.findall(r"^## Module (\d+) —", outline, re.M)
assert modules == [str(n) for n in range(1, 9)], f"Expected eight ordered modules; got {modules}"
lesson_matches = list(re.finditer(r"^### (L\d\d) · .+ — (\d+) min$", outline, re.M))
ids = [match.group(1) for match in lesson_matches]
assert ids == [f"L{n:02}" for n in range(1, 17)], f"Expected L01–L16; got {ids}"
minutes = [int(match.group(2)) for match in lesson_matches]
assert all(8 <= n <= 12 for n in minutes), f"Unexpected lesson runtime: {minutes}"
assert sum(minutes) == 161, f"Recorded total is {sum(minutes)}, not 161"

fields = (
    "Learner promise", "Book source", "Key concepts", "Spoken arc",
    "Exercise/reflection", "Required artifact", "Proposed visual treatment",
    "AmaduTown proof/demo",
)
for index, match in enumerate(lesson_matches):
    end = lesson_matches[index + 1].start() if index + 1 < len(lesson_matches) else outline.index("## Assembly for a facilitated cohort")
    body = outline[match.end():end]
    missing = [field for field in fields if not re.search(rf"^- \*\*{re.escape(field)}:\*\* .+", body, re.M)]
    assert not missing, f"{match.group(1)} lacks {missing}"

assert set(row[3] for row in rows).issubset(set(ids)), "Crosswalk points to an absent lesson"
assert len(re.findall(r"^## Chapter \d+: .+ \(`c\d{3}\.xhtml`\)$", section_index, re.M)) == 26
assert len(re.findall(r"^- .+", section_index, re.M)) == 206
for required in ("Signals / Alignment / Momentum map", "Native composite fallback", "Source/provenance register", "Editorial decision log"):
    assert required.lower() in production.lower(), f"Missing production section: {required}"

print(f"PASS: {len(rows)} chapters, 206 section labels, {len(ids)} lessons, {len(modules)} modules, {sum(minutes)} recorded minutes")
