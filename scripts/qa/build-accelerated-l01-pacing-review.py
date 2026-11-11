#!/usr/bin/env python3
"""Local L01 proof: quieter cards and continuous provisional teaching audio.

No learner binding is changed. The system voice proves timing only; the native
presenter video and audio remain the source of truth in their recorded windows.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import pathlib
import re
import subprocess
from io import BytesIO

from PIL import Image, ImageChops, ImageStat

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "artifacts/accelerated-lesson-pacing-2026-11-10"
SOURCE = ROOT / "public/accelerated/visual-parity/l01/visual-a70ed876/l01-visual-parity.mp4"
VTT = ROOT / "public/accelerated/lessons/l01/approved-ee09bf72/l01-approved-captions.vtt"
MANIFEST = ROOT / "docs/accelerated-course-modules/visual-production/manifest.json"
RECEIPT = ROOT / "artifacts/accelerated-visual-parity-2026-11-10/composite-receipt.json"
VOICE = "Samantha"
VOICE_RATES = (100, 113, 87)
WINDOWS = [(31.52, 235.0), (248.2, 345.0), (358.96, 515.0)]
PRESENTER = [(0.0, 31.52), (235.0, 248.2), (345.0, 358.96), (515.0, 529.48)]
REVIEW_END = 529.48  # Cut the unmarked silent end-card tail; source stays 540s.


def run(*args, capture=False):
    result = subprocess.run(args, check=True, text=True, capture_output=capture)
    return result.stdout if capture else None


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def duration(path):
    return float(run("ffprobe", "-v", "error", "-show_entries", "format=duration",
                     "-of", "default=noprint_wrappers=1:nokey=1", str(path), capture=True).strip())


def seconds(stamp):
    pieces = stamp.replace(",", ".").split(":")
    if len(pieces) == 2:
        return int(pieces[0]) * 60 + float(pieces[1])
    return int(pieces[0]) * 3600 + int(pieces[1]) * 60 + float(pieces[2])


def stamp(value):
    milli = round(value * 1000)
    return f"{milli//3600000:02d}:{milli//60000%60:02d}:{milli//1000%60:02d}.{milli%1000:03d}"


def cues():
    result = []
    for block in VTT.read_text().split("\n\n"):
        lines = block.strip().splitlines()
        if not lines or "-->" not in lines[0]:
            continue
        a, b = lines[0].split(" --> ")
        result.append({"start": seconds(a), "end": seconds(b),
                       "text": " ".join(lines[1:]).strip()})
    return result


def load_renderer():
    file = ROOT / "scripts/qa/render-accelerated-visual-parity.py"
    spec = importlib.util.spec_from_file_location("accelerated_frames", file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def make_frames():
    lesson = json.loads(MANIFEST.read_text())["lessons"][0]
    renderer = load_renderer()
    frames = OUT / "frames"
    frames.mkdir(parents=True, exist_ok=True)
    listing = []
    for index, scene in enumerate(lesson["scenes"]):
        # Keep the same source-bound art beats as the existing visual render.
        beats = ([('main', 45), ('decision', 30)] if scene['id'] == 'L01-01'
                 else renderer.ART_BEATS.get(scene["id"], [("main", scene["duration_seconds"])]) )
        for beat, (variant, length) in enumerate(beats):
            image = renderer.render(lesson, scene, index,
                                    variant=None if variant == "main" else variant,
                                    clean=True)
            path = frames / f"{scene['id']}-{beat}.png"
            image.save(path, optimize=True)
            listing.append(f"file '{path}'\nduration {length:.6f}")
    listing.append(f"file '{path}'")
    path = OUT / "clean-frames.txt"
    path.write_text("\n".join(listing) + "\n")
    return path


def make_voice_and_captions():
    source_cues = cues()
    narration = []
    caption_cues = []
    for a, b in PRESENTER:
        for cue in source_cues:
            start, end = max(a, cue['start']), min(b, cue['end'])
            if end <= start:
                continue
            copy = cue.copy()
            copy['start'], copy['end'] = start, end
            if a == 0 and cue['start'] < 31.52 < cue['end']:
                copy['text'] = 'confident looking answer.'
            caption_cues.append(copy)
    for index, (start, end) in enumerate(WINDOWS, 1):
        selected = [cue.copy() for cue in source_cues
                    if start <= (cue["start"] + cue["end"]) / 2 < end]
        if index == 1:
            # Presenter completes the previous phrase before the first cutaway.
            selected[0]["text"] = re.sub(r"^.*?Now what\?", "Now what?", selected[0]["text"])
        text = " ".join(cue["text"] for cue in selected)
        aiff = OUT / f"teaching-{index}.aiff"
        run("say", "-v", VOICE, "-r", str(VOICE_RATES[index-1]), "-o", str(aiff), text)
        raw_length = duration(aiff)
        target = end - start - 0.4
        tempo = raw_length / target
        if not 0.5 <= tempo <= 2:
            raise ValueError(f"Teaching window {index} requires extreme time stretch: {tempo:.2f}")
        weights = [max(1, len(cue["text"].split())) for cue in selected]
        total = sum(weights)
        cursor = start + 0.2
        for cue, weight in zip(selected, weights):
            finish = cursor + target * weight / total
            caption_cues.append({"start": cursor, "end": finish, "text": cue["text"]})
            cursor = finish
        narration.append({"window": [start, end], "source": str(aiff.relative_to(ROOT)),
                          "source_seconds": raw_length, "tempo": tempo,
                          "voice_rate": VOICE_RATES[index-1],
                          "word_count": total})
    caption_cues.sort(key=lambda cue: cue["start"])
    vtt = OUT / "l01-continuous-review.vtt"
    vtt.write_text("WEBVTT\n\n" + "\n".join(
        f"{stamp(cue['start'])} --> {stamp(cue['end'])}\n{cue['text']}\n"
        for cue in caption_cues))
    return narration, vtt


def make_video(listing, narration, vtt):
    final = OUT / "l01-continuous-review.mp4"
    # Overlay clean cards on the source only when the presenter is off screen.
    present = "+".join(f"between(t,{a},{b})" for a, b in PRESENTER)
    filters = [
        f"[1:v][0:v]overlay=enable='not({present})':shortest=1,format=yuv420p[v]",
        "[1:a]aformat=sample_rates=48000:channel_layouts=stereo[base]",
    ]
    voice_labels = []
    inputs = []
    for index, row in enumerate(narration, 2):
        inputs += ["-i", str(ROOT / row["source"])]
        delay = round((row["window"][0] + 0.2) * 1000)
        label = f"voice{index}"
        filters.append(f"[{index}:a]atempo={row['tempo']:.8f},"
                       f"aformat=sample_rates=48000:channel_layouts=stereo,"
                       f"adelay={delay}|{delay}[{label}]")
        voice_labels.append(f"[{label}]")
    filters.append(f"[base]{''.join(voice_labels)}"
                   f"amix=inputs={len(voice_labels)+1}:duration=first:normalize=0,"
                   "alimiter=limit=0.95[a]")
    run("ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "concat", "-safe", "0", "-i", str(listing), "-i", str(SOURCE),
        *inputs, "-i", str(vtt), "-filter_complex", ";".join(filters),
        "-map", "[v]", "-map", "[a]", "-map", f"{2+len(narration)}:0",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-r", "25",
        "-c:a", "aac", "-b:a", "192k", "-c:s", "mov_text",
        "-t", str(REVIEW_END), "-movflags", "+faststart", str(final))
    return final


def validate(path):
    run("ffmpeg", "-v", "error", "-i", str(path), "-f", "null", "-")
    probe = json.loads(run("ffprobe", "-v", "error", "-show_streams",
                           "-show_format", "-of", "json", str(path), capture=True))
    video = next(stream for stream in probe["streams"] if stream["codec_type"] == "video")
    if video["nb_frames"] != "13237" or abs(float(probe["format"]["duration"]) - REVIEW_END) > 0.05:
        raise ValueError("Frame count or duration changed")
    report = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
                             "-af", "silencedetect=noise=-38dB:d=2",
                             "-f", "null", "-"], capture_output=True, text=True, check=True).stderr
    gaps = []
    starts = [float(v) for v in re.findall(r"silence_start:\s*([0-9.]+)", report)]
    ends = [float(v) for v in re.findall(r"silence_end:\s*([0-9.]+)", report)]
    for i, start in enumerate(starts):
        end = ends[i] if i < len(ends) else REVIEW_END
        if end - start > 2:
            gaps.append([round(start, 3), round(end, 3)])
    if gaps:
        raise ValueError(f"Unmarked silence over 2 seconds: {gaps}")
    presenter_error = {}
    for sample in (10, 240, 350, 520):
        images = []
        for file in (SOURCE, path):
            frame = subprocess.check_output(["ffmpeg", "-v", "error", "-ss", str(sample),
                                             "-i", str(file), "-frames:v", "1",
                                             "-f", "image2pipe", "-vcodec", "png", "-"])
            images.append(Image.open(BytesIO(frame)).convert("RGB"))
        mean_error = sum(ImageStat.Stat(ImageChops.difference(*images)).mean) / 3
        if mean_error >= 2:
            raise ValueError(f"Presenter frame changed at {sample}s: {mean_error:.2f}")
        presenter_error[str(sample)] = round(mean_error, 3)
    caption_rows = []
    for block in (OUT / "l01-continuous-review.vtt").read_text().split("\n\n"):
        first = block.strip().splitlines()[:1]
        if first and "-->" in first[0]:
            a, b = first[0].split(" --> ")
            caption_rows.append((seconds(a), seconds(b)))
    if any(caption_rows[i+1][0] - caption_rows[i][1] > 2 or
           caption_rows[i][1] - caption_rows[i+1][0] > 0.1
           for i in range(len(caption_rows)-1)):
        raise ValueError("Caption gap or overlap exceeds tolerance")
    return {"video_frames": int(video["nb_frames"]), "duration_seconds": REVIEW_END,
            "unmarked_silence_over_2_seconds": gaps,
            "presenter_frame_mean_absolute_error": presenter_error,
            "caption_cues": len(caption_rows)}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    receipt = next(x for x in json.loads(RECEIPT.read_text())["composites"]
                   if x["lesson_id"] == "L01")
    if sha(SOURCE) != receipt["output_sha256"]:
        raise ValueError("Visual-parity source hash drift")
    listing = make_frames()
    narration, vtt = make_voice_and_captions()
    final = make_video(listing, narration, vtt)
    checks = validate(final)
    result = {"status": "local_review_only", "voice": f"{VOICE} (provisional system voice)",
              "source_path": str(SOURCE.relative_to(ROOT)), "source_sha256": sha(SOURCE),
              "manifest_sha256": sha(MANIFEST), "caption_source_sha256": sha(VTT),
              "presenter_windows": PRESENTER, "teaching_narration": narration,
              "caption_path": str(vtt.relative_to(ROOT)), "caption_sha256": sha(vtt),
              "output_path": str(final.relative_to(ROOT)), "output_sha256": sha(final),
              "validation": checks}
    (OUT / "review-receipt.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"output": result["output_path"], "validation": checks}, indent=2))


if __name__ == "__main__":
    main()
