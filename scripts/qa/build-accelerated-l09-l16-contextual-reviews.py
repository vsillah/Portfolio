#!/usr/bin/env python3
"""Build provider-free Accelerated L09-L16 desktop and portrait review masters."""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps, ImageStat


REPO = Path(__file__).resolve().parents[2]
SOURCE = REPO
NARRATION = Path(os.environ.get("ACCELERATED_NARRATION_ROOT", REPO / ".local/accelerated-l09-l16-narration"))
STILLS = REPO / "artifacts/accelerated-overlay-normalization-2026-11-14/l09-l16-still-rebuild"
PACK = REPO / "docs/accelerated-course-modules/narration-production-pack-2026-11-10.json"
TIMING = REPO / "artifacts/accelerated-visual-parity-2026-11-10/full-lesson-timing-decisions.json"
OUT = Path(os.environ.get("ACCELERATED_REVIEW_OUTPUT", REPO / ".local/accelerated-l09-l16-contextual-review"))
FPS = 25
VOICE_ID = "14b592b937744404a4fa7c01aafd7dbe"
PACK_SHA256 = "a0952c90bdea643245e69ef64cee022dc6b670a129c455bec4e57c394de2c245"
L09_J01 = NARRATION / "L09-J01-original.wav"
GOLD = "#D4AF37"
NAVY = "#121E31"
SLATE = "#2C3E50"
CREAM = "#EAECEE"
FONT = Path("/System/Library/Fonts/Avenir Next.ttc")
PLACEMENT = {"desktop": (1136, 348, 672, 384), "portrait": (18, 526, 354, 200)}


def run(args: list[str]) -> None:
    subprocess.run(args, check=True)


def capture(args: list[str]) -> str:
    return subprocess.check_output(args, text=True)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def probe_duration(path: Path) -> float:
    return float(capture(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)]).strip())


def font(size: int, face: int = 0) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT), size, index=face)


def wrap_text(draw: ImageDraw.ImageDraw, value: str, text_font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in value.split():
        trial = f"{current} {word}".strip()
        if current and draw.textlength(trial, font=text_font) > max_width:
            lines.append(current)
            current = word
        else:
            current = trial
    if current:
        lines.append(current)
    return lines


def isolate_motif(source: Image.Image, crop: tuple[int, int, int, int], maximum: tuple[int, int]) -> Image.Image:
    motif = source.crop(crop).convert("RGB")
    corner = Image.new("RGB", motif.size, tuple(round(value) for value in ImageStat.Stat(motif.crop((0, 0, min(36, motif.width), min(36, motif.height)))).mean))
    difference = ImageChops.difference(motif, corner).convert("L")
    mask = difference.point(lambda value: 255 if value > 16 else 0)
    mask = mask.filter(ImageFilter.MaxFilter(21)).filter(ImageFilter.GaussianBlur(2.2))
    rgba = motif.convert("RGBA")
    rgba.putalpha(mask)
    bounds = rgba.getbbox()
    if bounds:
        rgba = rgba.crop(bounds)
    return ImageOps.contain(rgba, maximum, Image.Resampling.LANCZOS)


def presenter_base(point: str, lesson: str, variant: str, art_source: Path, destination: Path) -> None:
    size = (1920, 1080) if variant == "desktop" else (390, 844)
    image = Image.new("RGB", size, NAVY)
    draw = ImageDraw.Draw(image)
    w, h = size
    margin = 48 if variant == "desktop" else 18
    draw.rectangle((0, 0, w, h), fill=NAVY)
    for y in range(h):
        mix = y / max(1, h - 1)
        r = round(18 + (44 - 18) * mix * 0.3)
        g = round(30 + (62 - 30) * mix * 0.3)
        b = round(49 + (80 - 49) * mix * 0.3)
        draw.line((0, y, w, y), fill=(r, g, b))
    draw.rounded_rectangle((margin, margin, w - margin, h - margin), radius=18, outline=GOLD, width=2)
    draw.text((margin + 24, margin + 18), f"ACCELERATED · {lesson}", font=font(18 if variant == "desktop" else 12, 2), fill=GOLD)
    source_art = Image.open(art_source).convert("RGB")
    if variant == "desktop":
        # Reuse the approved high-resolution raster motif, not a simplified redraw.
        motif = isolate_motif(source_art, (1040, 120, 1840, 970), (500, 610))
        motif_position = (590 + (500 - motif.width) // 2, 170 + (610 - motif.height) // 2)
        image.paste(motif, motif_position, motif)

        body_font = font(34, 2)
        lines = wrap_text(draw, point, body_font, 420)
        line_height = 48
        pad_x, pad_y = 24, 18
        plate_w = min(480, max(360, int(max(draw.textlength(line, font=body_font) for line in lines)) + 2 * pad_x))
        plate_h = len(lines) * line_height + 2 * pad_y
        box = (92, 470, 92 + plate_w, 470 + plate_h)
        draw.rounded_rectangle(box, radius=9, fill=(18, 53, 66), outline=GOLD, width=2)
        draw.multiline_text((box[0] + pad_x, box[1] + pad_y - 2), "\n".join(lines), font=body_font, fill=CREAM, spacing=8)
    else:
        motif = isolate_motif(source_art, (38, 112, 352, 555), (292, 310))
        motif_position = ((w - motif.width) // 2, 88 + (310 - motif.height) // 2)
        image.paste(motif, motif_position, motif)

        body_font = font(19, 2)
        lines = wrap_text(draw, point, body_font, 292)
        line_height = 28
        pad_x, pad_y = 16, 13
        plate_h = len(lines) * line_height + 2 * pad_y
        box = (30, 408, 360, 408 + plate_h)
        draw.rounded_rectangle(box, radius=8, fill=(18, 53, 66), outline=GOLD, width=2)
        draw.multiline_text((box[0] + pad_x, box[1] + pad_y - 1), "\n".join(lines), font=body_font, fill=CREAM, spacing=6)
    image.save(destination, quality=95)


def parse_vtt(path: Path) -> list[tuple[float, float, str]]:
    def seconds(value: str) -> float:
        h, m, rest = value.replace(",", ".").split(":")
        return int(h) * 3600 + int(m) * 60 + float(rest)
    cues = []
    blocks = re.split(r"\n\s*\n", path.read_text(encoding="utf-8-sig"))
    for block in blocks:
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        timing_line = next((line for line in lines if "-->" in line), None)
        if not timing_line: continue
        start_text, end_text = [part.strip().split()[0] for part in timing_line.split("-->")]
        index = lines.index(timing_line)
        text = " ".join(lines[index + 1:])
        if text: cues.append((seconds(start_text), seconds(end_text), text))
    return cues


def stamp(value: float) -> str:
    value = max(0.0, value)
    h = int(value // 3600); value -= h * 3600
    m = int(value // 60); value -= m * 60
    return f"{h:02d}:{m:02d}:{value:06.3f}"


def job_paths(lesson: str, job: str) -> tuple[Path, Path | None]:
    if lesson == "L09" and job == "J01": return L09_J01, None
    if lesson == "L09" and job == "J02": return NARRATION / "L09-J02-replacement-original.wav", NARRATION / "L09-J02-replacement-provider-response.json"
    return NARRATION / f"{lesson}-{job}-original.wav", NARRATION / f"{lesson}-{job}-provider-response.json"


def generated_span(lesson: dict, window: dict, jobs: dict[str, dict]) -> tuple[Path, float, float, list[dict] | None]:
    for job in lesson["speech_jobs"]:
        if window["id"] not in job["window_ids"]: continue
        audio, response = job_paths(lesson["lesson_id"], job["id"])
        if lesson["lesson_id"] == "L09" and job["id"] == "J01":
            # Provider timestamps were displayed but not retained. Bind the two approved
            # paragraphs to the nearest waveform-confirmed quiet boundary.
            return (audio, 0.0, 135.959, None) if window["id"] == "C01" else (audio, 136.253, probe_duration(audio), None)
        data = json.loads(response.read_text())
        text = job["text"]
        cursor = 0
        spans: dict[str, tuple[int, int]] = {}
        for window_id in job["window_ids"]:
            candidate = next(item for item in lesson["windows"] if item["id"] == window_id)["text"]
            start = text.find(candidate, cursor)
            if start < 0: raise RuntimeError(f"Cannot bind {lesson['lesson_id']}:{job['id']}:{window_id}")
            spans[window_id] = (start, start + len(candidate))
            cursor = start + len(candidate)
        start_i, end_i = spans[window["id"]]
        chars = data["original_characters"]
        while start_i < end_i and chars[start_i]["text"].isspace(): start_i += 1
        while end_i > start_i and chars[end_i - 1]["text"].isspace(): end_i -= 1
        return audio, float(chars[start_i]["start_time"]), float(chars[end_i - 1]["end_time"]), chars
    raise RuntimeError(f"No job owns {lesson['lesson_id']}:{window['id']}")


def write_audio_part(source: Path, start: float, end: float, destination: Path) -> None:
    run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(source), "-af", f"atrim=start={start:.6f}:end={end:.6f},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo", "-c:a", "pcm_s16le", str(destination)])


def write_still_part(still: Path, frames: int, destination: Path) -> None:
    run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-loop", "1", "-framerate", str(FPS), "-i", str(still), "-frames:v", str(frames), "-an", "-vf", "format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-g", "50", str(destination)])


def write_presenter_part(base: Path, source: Path, source_start: float, frames: int, variant: str, destination: Path) -> None:
    x, y, width, height = PLACEMENT[variant]
    graph = (f"[1:v]crop=934:528:956:169,scale={width}:{height}[p];[0:v][p]overlay={x}:{y}:shortest=1,drawbox=x={x}:y={y}:w={width}:h={height}:color=0xD4AF37:t=2,format=yuv420p[v]")
    run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-loop", "1", "-framerate", str(FPS), "-i", str(base), "-ss", f"{source_start:.6f}", "-i", str(source), "-filter_complex", graph, "-map", "[v]", "-frames:v", str(frames), "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-g", "50", str(destination)])


def concat(parts: list[Path], destination: Path) -> None:
    manifest = destination.with_suffix(".ffconcat")
    manifest.write_text("ffconcat version 1.0\n" + "".join(f"file '{part.as_posix()}'\n" for part in parts))
    run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(manifest), "-c", "copy", str(destination)])


def write_review_html(batch: dict) -> None:
    cards = []
    for lesson_id, record in batch["lessons"].items():
        lower = lesson_id.lower()
        desktop_hash = record["outputs"]["desktop"]["sha256"]
        portrait_hash = record["outputs"]["portrait"]["sha256"]
        cards.append(
            f'<section><h2>{lesson_id}</h2>'
            f'<video controls preload="metadata"><source src="{lower}/{lower}-desktop-contextual-review.mp4?v={desktop_hash}"><track kind="captions" src="{lower}/{lower}-captions.vtt?v={desktop_hash}" srclang="en" label="English"></video>'
            f'<video controls preload="metadata"><source src="{lower}/{lower}-portrait-contextual-review.mp4?v={portrait_hash}"><track kind="captions" src="{lower}/{lower}-captions.vtt?v={portrait_hash}" srclang="en" label="English"></video>'
            '</section>'
        )
    (OUT / "review.html").write_text('<!doctype html><meta charset="utf-8"><style>body{background:#071c25;color:#eaecee;font:16px system-ui;padding:20px}video{max-width:100%;max-height:80vh;display:block;margin:12px 0 28px}</style>' + "".join(cards))


def build() -> None:
    pack = json.loads(PACK.read_text())
    timing = {item["lesson_id"]: item for item in json.loads(TIMING.read_text())["lessons"]}
    still_receipt = json.loads((STILLS / "still-rebuild-receipt.json").read_text())
    OUT.mkdir(exist_ok=True)
    receipt = OUT / "batch-contextual-review-receipt.json"
    lesson_filter = os.environ.get("ACCELERATED_LESSON_FILTER")
    variant_filter = os.environ.get("ACCELERATED_VARIANT_FILTER")
    if (lesson_filter or variant_filter) and receipt.exists():
        batch = json.loads(receipt.read_text())
    else:
        batch = {"schema": "accelerated_l09_l16_contextual_review_v1", "pack_sha256": PACK_SHA256, "voice_id": VOICE_ID, "source_commit": "ee9c32231", "fps": FPS, "lessons": {}, "exclusions": ["provider contact", "spend", "learner media change", "PR update", "merge", "deploy", "publish", "release"]}
    selected = [item for item in pack["lessons"] if item["lesson_id"] in {f"L{i:02d}" for i in range(9, 17)}]
    if lesson_filter:
        selected = [item for item in selected if item["lesson_id"] == lesson_filter]
    for lesson in selected:
        lesson_id, lower = lesson["lesson_id"], lesson["lesson_id"].lower()
        lesson_out = OUT / lower; parts_dir = lesson_out / "parts"; bases_dir = lesson_out / "presenter-bases"
        parts_dir.mkdir(parents=True, exist_ok=True); bases_dir.mkdir(exist_ok=True)
        source = SOURCE / lesson["native_source"]["path"]
        old_vtt = SOURCE / lesson["captions"]["path"]
        old_cues = parse_vtt(old_vtt)
        spans = {item["window"]: item["source_seconds"] for item in timing[lesson_id]["scheduled_native_audio_spans"]}
        windows = lesson["windows"]
        audio_parts, window_records, captions = [], [], []
        sequence_cursor = 0.0
        for index, window in enumerate(windows):
            part = parts_dir / f"audio-{index:02d}-{window['id']}.wav"
            if window["kind"] == "presenter":
                start, end = spans[window["id"]]
                write_audio_part(source, start, end, part)
                for cue_start, cue_end, text in old_cues:
                    overlap_start, overlap_end = max(cue_start, start), min(cue_end, end)
                    if overlap_end > overlap_start:
                        captions.append((sequence_cursor + overlap_start - start, sequence_cursor + overlap_end - start, text))
                audio_source, audio_start, audio_end = source, start, end
            else:
                audio_source, audio_start, audio_end, _ = generated_span(lesson, window, {})
                write_audio_part(audio_source, audio_start, audio_end, part)
                sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", window["text"]) if s.strip()]
                total_chars = sum(len(s) for s in sentences) or 1
                local_cursor = audio_start
                for sentence in sentences:
                    share = (audio_end - audio_start) * len(sentence) / total_chars
                    captions.append((sequence_cursor + local_cursor - audio_start, sequence_cursor + local_cursor - audio_start + share, sentence))
                    local_cursor += share
            duration = probe_duration(part)
            audio_parts.append(part)
            window_records.append({"id": window["id"], "kind": window["kind"], "duration": duration, "sequence_start": sequence_cursor, "sequence_end": sequence_cursor + duration, "audio_source": str(audio_source), "audio_start": audio_start, "audio_end": audio_end})
            sequence_cursor += duration
        audio_master = lesson_out / f"{lower}-contextual-audio.wav"
        concat(audio_parts, audio_master)
        actual_audio_duration = probe_duration(audio_master)
        vtt = lesson_out / f"{lower}-captions.vtt"
        vtt.write_text("WEBVTT\n\n" + "\n\n".join(f"{i + 1}\n{stamp(start)} --> {stamp(end)}\n{text}" for i, (start, end, text) in enumerate(captions)) + "\n")
        existing_outputs = dict(batch.get("lessons", {}).get(lesson_id, {}).get("outputs", {})) if variant_filter else {}
        lesson_record = {"source": str(source), "source_sha256": sha256(source), "audio_master_sha256": sha256(audio_master), "duration": actual_audio_duration, "windows": window_records, "captions": str(vtt), "outputs": existing_outputs}
        state_points = [item["point"] for item in still_receipt["lessons"][lesson_id]["states"] if item["variant"] == "desktop"]
        state_map = [0, 0, 1, 2, 3, 4, 5, 5]
        variants = (variant_filter,) if variant_filter else ("desktop", "portrait")
        for variant in variants:
            picture_parts = []
            frame_cursor = 0
            for index, record in enumerate(window_records):
                end_frame = round(record["sequence_end"] * FPS)
                frames = end_frame - frame_cursor
                state = state_map[index]
                if record["kind"] == "presenter":
                    base = bases_dir / f"{variant}-{index:02d}.jpg"
                    art = STILLS / lower / f"{lower}-{state + 1:02d}-{variant}-clean.jpg"
                    presenter_base(state_points[state], lesson_id, variant, art, base)
                    output = parts_dir / f"{variant}-{index:02d}-presenter.mp4"
                    write_presenter_part(base, source, record["audio_start"], frames, variant, output)
                    picture_parts.append(output)
                else:
                    states = [state]
                    if record["id"] in {"C01", "C02", "C03"} and state < 5: states.append(state + 1)
                    remaining = frames
                    for sub, current_state in enumerate(states):
                        subframes = remaining if sub == len(states) - 1 else frames // len(states)
                        remaining -= subframes
                        still = STILLS / lower / f"{lower}-{current_state + 1:02d}-{variant}-clean.jpg"
                        output = parts_dir / f"{variant}-{index:02d}-{sub:02d}-still.mp4"
                        write_still_part(still, subframes, output)
                        picture_parts.append(output)
                frame_cursor = end_frame
            picture = lesson_out / f"{lower}-{variant}-picture.mp4"
            final = lesson_out / f"{lower}-{variant}-contextual-review.mp4"
            concat(picture_parts, picture)
            run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(picture), "-i", str(audio_master), "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", str(final)])
            run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(final), "-map", "0:v:0", "-f", "null", "-", "-map", "0:a:0", "-f", "null", "-"])
            lesson_record["outputs"][variant] = {"path": str(final), "sha256": sha256(final), "duration": probe_duration(final), "dimensions": [1920, 1080] if variant == "desktop" else [390, 844]}
        batch["lessons"][lesson_id] = lesson_record
        (lesson_out / "receipt.json").write_text(json.dumps(lesson_record, indent=2) + "\n")
        print(json.dumps({"lesson": lesson_id, "duration": actual_audio_duration, "outputs": lesson_record["outputs"]}))
    receipt.write_text(json.dumps(batch, indent=2) + "\n")
    write_review_html(batch)
    print(receipt)


if __name__ == "__main__":
    build()
