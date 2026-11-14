#!/usr/bin/env python3
"""Produce a local-review VTT from provider and on-device word alignment."""

import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = HERE / "whole-lesson-review"
OUT.mkdir(exist_ok=True)
contract = json.loads((HERE / "l04-timing-contract.json").read_text())
pack = json.loads((ROOT / "docs/accelerated-course-modules/narration-production-pack-2026-11-10.json").read_text())
lesson = next(x for x in pack["lessons"] if x["lesson_id"] == "L04")
windows = {x["id"]: x for x in lesson["windows"]}
asr = json.loads((OUT / "native-local-asr.json").read_text())
native_words = [word for segment in asr["segments"] for word in segment["words"]]
canonical_presenter_words = [m.group() for name in ("P01", "P02", "P03", "P04")
                             for m in re.finditer(r"[\w]+(?:['’][\w]+)?", windows[name]["text"])]
if len(native_words) != len(canonical_presenter_words) or any(
    re.sub(r"[^a-z0-9]", "", word["word"].lower()) != re.sub(r"[^a-z0-9]", "", canonical.lower())
    for word, canonical in zip(native_words, canonical_presenter_words)
):
    raise ValueError("Native ASR word sequence differs from canonical presenter text")
native_word_offset = 0
native_silences = json.loads((OUT / "native-waveform-silences.json").read_text())["intervals"]


def native_word_start(word):
    for silence_start, silence_end in native_silences:
        if silence_end - silence_start >= 0.2 and silence_start <= word["start"] < silence_end <= word["end"]:
            return silence_end
    return word["start"]


def stamp(seconds):
    ms = round(seconds * 1000)
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def norm(text):
    return re.sub(r"[^a-z0-9]", "", text.lower())


lines = ["WEBVTT", ""]
receipt = {"schema": "accelerated_l04_optional_captions_v2", "status": "local_review_only_pending_player_qa", "windows": [], "presenter_timing": "On-device native word timestamps matched 175/175 canonical words and shifted from corrected native frame ranges into the lesson timeline; ASR is supporting timing evidence.", "cutaway_timing": "Returned provider word timestamps, shifted into the corrected lesson timeline."}
last_end = 0.0
for segment in contract["segments"]:
    name = segment["id"]
    text = windows[name]["text"]
    spans = list(re.finditer(r"[\w]+(?:['’][\w]+)?", text))
    if len(spans) != segment["word_count"]:
        raise ValueError(f"{name} word count drift")
    if segment["source"]["kind"] == "returned_narration":
        job_id = segment["source"]["job"][1:]
        data = json.loads((HERE / "provider-return" / f"l04-j{job_id}-timings.json").read_text())
        offset = 0 if name in ("C01", "C03") else contract["jobs"][job_id]["split_word_index"]
        tokens = data["original_words"][offset:offset + len(spans)]
        if any(norm(m.group()) != norm(w["text"]) for m, w in zip(spans, tokens)):
            raise ValueError(f"{name} timing text drift")
        start_times = [segment["timeline_start_seconds"] + w["start_time"] - segment["source"]["source_start_seconds"] for w in tokens]
        end_times = [segment["timeline_start_seconds"] + w["end_time"] - segment["source"]["source_start_seconds"] for w in tokens]
        timing_class = "provider_word_aligned"
    else:
        tokens = native_words[native_word_offset:native_word_offset + len(spans)]
        native_word_offset += len(spans)
        source_start = segment["source"]["frame_start"] / 25
        source_end = segment["source"]["frame_end_exclusive"] / 25
        if tokens[0]["start"] < source_start - 0.2 or tokens[-1]["end"] > source_end:
            raise ValueError(f"Native ASR times escape {name} source frame range")
        start_times = [segment["timeline_start_seconds"] + max(source_start, native_word_start(w)) - source_start for w in tokens]
        end_times = [segment["timeline_start_seconds"] + min(source_end, w["end"]) - source_start for w in tokens]
        timing_class = "native_local_word_aligned"
    count = 0
    i = 0
    while i < len(spans):
        j = min(i + 10, len(spans))
        for candidate in range(i + 1, min(i + 12, len(spans)) + 1):
            tail = text[spans[candidate - 1].end():spans[candidate].start() if candidate < len(spans) else len(text)]
            if re.search(r"[.!?;]", tail):
                j = candidate
                break
        else:
            for candidate in range(min(i + 11, len(spans)), i + 5, -1):
                tail = text[spans[candidate - 1].end():spans[candidate].start() if candidate < len(spans) else len(text)]
                if re.search(r"[:,]", tail):
                    j = candidate
                    break
        cue = text[spans[i].start():spans[j].start() if j < len(spans) else len(text)].strip()
        start = max(last_end, segment["timeline_start_seconds"], start_times[i] - 0.06)
        end = min(segment["timeline_end_seconds"], end_times[j - 1] + 0.10)
        if j < len(spans):
            end = min(end, start_times[j] - 0.005)
        if end <= start:
            raise ValueError(f"Invalid cue timing in {name}")
        lines.extend([f"{stamp(start)} --> {stamp(end)}", cue, ""])
        last_end = end
        count += 1
        i = j
    receipt["windows"].append({"id": name, "timing_class": timing_class, "cues": count, "words": len(spans)})

(OUT / "l04-local-review-optional.vtt").write_text("\n".join(lines))
(OUT / "caption-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
if native_word_offset != len(native_words):
    raise ValueError("Native words not consumed exactly once")
print(f"Optional local review captions: {sum(x['cues'] for x in receipt['windows'])} cues")
