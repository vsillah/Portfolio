#!/usr/bin/env python3
"""Bind L04's returned word timings to its canonical presenter windows."""

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
PACK = ROOT / "docs/accelerated-course-modules/narration-production-pack-2026-11-10.json"
SOURCE = ROOT / "artifacts/accelerated-l04-heygen-2026-11-04/accelerated-l04-heygen-native.mp4"
SOURCE_FALLBACK = Path("/Users/vambahsillah/Projects/Portfolio/artifacts/accelerated-l04-heygen-2026-11-04/accelerated-l04-heygen-native.mp4")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def words(text):
    return re.findall(r"[\w]+(?:['’][\w]+)?", text.lower())


def normalized(text):
    return re.sub(r"[^a-z0-9]", "", text.lower())


def phrase_time(items, phrase):
    needle = [normalized(w) for w in words(phrase)]
    haystack = [normalized(w["text"]) for w in items]
    matches = [i for i in range(len(items) - len(needle) + 1) if haystack[i : i + len(needle)] == needle]
    if len(matches) != 1:
        raise ValueError(f"Expected one match for {phrase!r}; got {matches}")
    return matches[0], items[matches[0]]["start_time"]


pack = json.loads(PACK.read_text())
lesson = next(item for item in pack["lessons"] if item["lesson_id"] == "L04")
windows = {item["id"]: item for item in lesson["windows"]}
jobs = {}
for number, names in (("01", ("C01", "C02")), ("02", ("C03", "C04"))):
    stem = OUT / "provider-return" / f"l04-j{number}"
    data = json.loads(stem.with_name(stem.name + "-timings.json").read_text())
    expected = words(" ".join(windows[name]["text"] for name in names))
    actual = data["original_words"]
    if len(expected) != len(actual) or any(normalized(a) != normalized(b["text"]) for a, b in zip(expected, actual)):
        raise ValueError(f"J{number} timing words differ from the canonical narration pack")
    split_index = windows[names[0]]["word_count"]
    previous, following = actual[split_index - 1], actual[split_index]
    if following["start_time"] - previous["end_time"] < 0.4:
        raise ValueError(f"J{number} has no clean split pause")
    # Split in the recorded pause, on a PCM sample boundary. Both sides retain
    # their original speech and the complete recording is represented once.
    sample = 44100
    split = round((previous["end_time"] + following["start_time"]) / 2 * sample) / sample
    jobs[number] = {
        "wav": str(stem.with_name(stem.name + "-original.wav").relative_to(ROOT)),
        "wav_sha256": digest(stem.with_name(stem.name + "-original.wav")),
        "timings": str(stem.with_name(stem.name + "-timings.json").relative_to(ROOT)),
        "timings_sha256": digest(stem.with_name(stem.name + "-timings.json")),
        "duration_seconds": data["duration_seconds"],
        "word_count": len(actual),
        "split_word_index": split_index,
        "split_seconds": split,
        "split_pause_seconds": round(following["start_time"] - previous["end_time"], 3),
    }
    jobs[number]["words"] = actual

native = SOURCE if SOURCE.exists() else SOURCE_FALLBACK
if digest(native) != "cf8f8e78c48a8f4471e0a4bb53b57b4f71f3ad52d30f92cf356482b4d1be9c3e":
    raise ValueError("Native presenter media hash changed")

# The original cuts at frames 643/989/1370 placed canonical presenter words
# in the preceding window. These replacements sit inside measured native
# silence after P01/P02/P03, respectively (see alignment receipt).
presenter_ranges = ((0, 632), (632, 900), (900, 1233), (1233, 1683))

segments = []
cursor = 0.0
for name, frame_range, job_id, piece in (
    ("P01", presenter_ranges[0], None, None),
    ("C01", None, "01", 0),
    ("P02", presenter_ranges[1], None, None),
    ("C02", None, "01", 1),
    ("P03", presenter_ranges[2], None, None),
    ("C03", None, "02", 0),
    ("P04", presenter_ranges[3], None, None),
    ("C04", None, "02", 1),
):
    if frame_range:
        duration = (frame_range[1] - frame_range[0]) / 25
        source = {"kind": "native_presenter", "frame_start": frame_range[0], "frame_end_exclusive": frame_range[1]}
    else:
        job = jobs[job_id]
        start = 0.0 if piece == 0 else job["split_seconds"]
        end = job["split_seconds"] if piece == 0 else job["duration_seconds"]
        duration = end - start
        source = {"kind": "returned_narration", "job": f"J{job_id}", "source_start_seconds": start, "source_end_seconds": end}
    segments.append({"id": name, "timeline_start_seconds": round(cursor, 6), "timeline_end_seconds": round(cursor + duration, 6), "duration_seconds": round(duration, 6), "source": source, "word_count": windows[name]["word_count"]})
    cursor += duration

segment = {item["id"]: item for item in segments}
beats = []
for scene, window, phrase, visual in (
    (1, "C01", "They are hard to test as a single bet", "Q3 plan narrows to one member's first-task moment"),
    (2, "C01", "Now picture the persona deck beside that plan", "Polished portrait meets an undecided first task"),
    (3, "C02", "In the book example she is preparing for a Monday meeting", "Sarah's Monday meeting and trust dilemma, labeled as book case"),
    (4, "C02", "Once the job is visible the build can get smaller", "Three tangible first-task prototypes, guided step provisional"),
    (5, "C03", "If this card is based on a real interview", "Living persona record with observed signal blank"),
    (6, "C03", "Imagine the test happens", "Earlier assumption and hypothetical revised question side by side"),
    (7, "C03", "Pause and finish one living persona card", "Four decision-file pages and learner writing space"),
):
    job = jobs["01" if window in ("C01", "C02") else "02"]
    index, timestamp = phrase_time(job["words"], phrase)
    source_start = segment[window]["source"]["source_start_seconds"]
    beats.append({"scene": scene, "window": window, "phrase": phrase, "provider_word_index": index, "provider_start_seconds": timestamp, "timeline_start_seconds": round(segment[window]["timeline_start_seconds"] + timestamp - source_start, 3), "picture": visual})

result = {
    "schema": "accelerated_l04_local_timing_contract_v1",
    "script_sha256": digest(ROOT / "docs/accelerated-course-modules/curriculum/scripts/L04.md"),
    "narration_pack_sha256": digest(PACK),
    "native_presenter": {"path": str(native), "sha256": digest(native), "fps": 25, "frames": 1683},
    "jobs": {key: {k: v for k, v in job.items() if k != "words"} for key, job in jobs.items()},
    "segments": segments,
    "picture_beats": beats,
    "total_duration_seconds": round(cursor, 6),
    "rules": ["No speed changes or added silence", "Presenter picture and audio come from the same native source", "Cutaways use returned narration once, in order", "Scene changes follow recorded phrase timing", "Captions are optional sidecar, not a permanent picture band"],
}
(OUT / "l04-timing-contract.json").write_text(json.dumps(result, indent=2) + "\n")
print(f"L04 timing contract: {cursor:.3f} seconds; {len(beats)} contextual beats")
for beat in beats:
    print(f"{beat['timeline_start_seconds']:8.3f} scene {beat['scene']}: {beat['phrase']}")
