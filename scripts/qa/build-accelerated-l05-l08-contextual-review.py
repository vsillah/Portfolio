#!/usr/bin/env python3
"""Build provider-free L05-L08 desktop and portrait contextual review masters."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import shutil
import subprocess
import tempfile
import textwrap
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
STILLS = ROOT / "artifacts/accelerated-overlay-normalization-2026-11-14/l05-l08-still-rebuild"
OUT = ROOT / "artifacts/accelerated-overlay-normalization-2026-11-14/l05-l08-contextual-review"
APPROVED_RECEIPT_SHA256 = "a8d61cb7f58bb9f7864484c2ee352b7180ab507790e0a15c0936d3a0caa0b669"
FPS = 25
FONT = Path("/System/Library/Fonts/Avenir Next.ttc")
GOLD = "#d8ac52"
BLUE = "#0b2d3a"
BLUE_2 = "#123f50"
CREAM = "#f7eedc"
PRESENTER_PLACEMENT = {
    "desktop": (1136, 348, 672, 384),
    "portrait": (0, 526, 390, 220),
}


LESSONS: dict[str, dict[str, Any]] = {
    "l05": {
        "source": ROOT / "public/accelerated/lessons/l05/approved-bd1e53b5/accelerated-l05-native-composite.mp4",
        "captions": ROOT / "public/accelerated/lessons/l05/approved-bd1e53b5/l05-captions.vtt",
        "duration": 600,
        "presenter_frames": [(0, 482), (5001, 5500), (10001, 10359), (14349, 14625)],
    },
    "l06": {
        "source": ROOT / "public/accelerated/lessons/l06/approved-16167226/accelerated-l06-native-composite.mp4",
        "captions": ROOT / "public/accelerated/lessons/l06/approved-16167226/l06-captions.vtt",
        "duration": 660,
        "presenter_frames": [(0, 524), (5501, 5921), (11001, 11336), (15772, 16153)],
    },
    "l07": {
        "source": ROOT / "public/accelerated/lessons/l07/approved-6e3e00a0/accelerated-l07-native-composite.mp4",
        "captions": ROOT / "public/accelerated/lessons/l07/approved-6e3e00a0/l07-captions.vtt",
        "duration": 600,
        "presenter_frames": [(0, 451), (5001, 5365), (10001, 10299), (14250, 14649)],
    },
    "l08": {
        "source": ROOT / "public/accelerated/lessons/l08/approved-1b6c9da2/accelerated-l08-native-composite.mp4",
        "captions": ROOT / "public/accelerated/lessons/l08/approved-1b6c9da2/l08-captions.vtt",
        "duration": 720,
        "presenter_frames": [(0, 714), (6001, 6451), (12001, 12385), (17125, 17571)],
    },
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(args: list[str]) -> None:
    subprocess.run(args, check=True)


def probe(path: Path) -> dict[str, Any]:
    return json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)
    ]))


def load_still_module():
    path = ROOT / "scripts/qa/build-accelerated-l05-l08-visual-system-stills.py"
    spec = importlib.util.spec_from_file_location("accelerated_l05_l08_stills", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def scene_index(frame: int, duration_frames: int) -> int:
    return min(5, int(frame // (duration_frames / 6)))


def segments(config: dict[str, Any]) -> list[dict[str, Any]]:
    duration_frames = int(config["duration"]) * FPS
    boundaries = {0, duration_frames}
    for index in range(1, 6):
        boundaries.add(round(duration_frames * index / 6))
    for start, end in config["presenter_frames"]:
        boundaries.update((start, end))
    ordered = sorted(boundaries)
    result: list[dict[str, Any]] = []
    for start, end in zip(ordered, ordered[1:]):
        midpoint = (start + end) / 2
        presenter = any(left <= midpoint < right for left, right in config["presenter_frames"])
        result.append({
            "start_frame": start,
            "end_frame": end,
            "start_seconds": round(start / FPS, 3),
            "end_seconds": round(end / FPS, 3),
            "frames": end - start,
            "scene": scene_index(start, duration_frames),
            "presenter": presenter,
        })
    assert sum(item["frames"] for item in result) == duration_frames
    return result


def presenter_base(module, scene: dict[str, Any], variant: str, destination: Path) -> None:
    size = (1920, 1080) if variant == "desktop" else (390, 844)
    portrait = variant == "portrait"
    frame = Image.new("RGBA", size, BLUE)
    draw = ImageDraw.Draw(frame, "RGBA")
    w, h = size

    # One continuous AmaduTown field surrounds a distinct native-video section.
    # No teaching illustration is composited beneath the presenter-safe zone.
    for y in range(h):
        alpha = round(42 * y / max(1, h - 1))
        draw.line((0, y, w, y), fill=(18, 63, 80, alpha))
    margin = 18 if portrait else 54
    draw.rounded_rectangle((margin, margin, w - margin, h - margin), radius=18, outline=GOLD, width=2)
    draw.line((margin + 28, margin + 58, w - margin - 28, margin + 58), fill=GOLD, width=2)

    temp_plate = destination.with_suffix(".plate.png")
    module.teaching_plate(frame, scene["point"], portrait, temp_plate)
    temp_plate.unlink(missing_ok=True)

    if portrait:
        content_box = (28, 130, 362, 486)
        title_font = module.font(29, 2)
        node_font = module.font(17, 0)
        title_lines = textwrap.wrap(scene["title"], width=20)
        title = "\n".join(title_lines[:3])
        draw.multiline_text((32, 128), title, font=title_font, fill=CREAM, spacing=5)
        title_height = draw.multiline_textbbox((32, 128), title, font=title_font, spacing=5)[3] - 128
        top = min(275, 148 + title_height)
        available = 486 - top
        gap = 8
        node_h = min(58, max(38, (available - gap * (len(scene["nodes"]) - 1)) // len(scene["nodes"])))
        for index, label in enumerate(scene["nodes"]):
            y1 = top + index * (node_h + gap)
            y2 = y1 + node_h
            draw.rounded_rectangle((32, y1, 358, y2), radius=6, fill=(16, 47, 60, 230), outline=GOLD, width=2)
            draw.text((46, y1 + (node_h - 19) // 2), label, font=node_font, fill=CREAM)
    else:
        title_font = module.font(58, 2)
        node_font = module.font(28, 0)
        title = "\n".join(textwrap.wrap(scene["title"], width=28)[:3])
        draw.multiline_text((100, 205), title, font=title_font, fill=CREAM, spacing=9)
        title_box = draw.multiline_textbbox((100, 205), title, font=title_font, spacing=9)
        top = max(470, title_box[3] + 50)
        for index, label in enumerate(scene["nodes"]):
            y1 = top + index * 86
            y2 = y1 + 64
            draw.rounded_rectangle((100, y1, 980, y2), radius=8, fill=(16, 47, 60, 230), outline=GOLD, width=2)
            draw.text((126, y1 + 15), label, font=node_font, fill=CREAM)

    frame.convert("RGB").save(destination)


def encode_still(path: Path, frames: int, destination: Path) -> None:
    run([
        "ffmpeg", "-nostdin", "-v", "error", "-y", "-loop", "1", "-framerate", str(FPS),
        "-i", str(path), "-frames:v", str(frames), "-an", "-vf", "format=yuv420p",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-g", "50", str(destination),
    ])


def encode_presenter(base: Path, source: Path, start_frame: int, frames: int, variant: str, destination: Path) -> None:
    placement = PRESENTER_PLACEMENT[variant]
    x, y, width, height = placement
    graph = (
        f"[1:v]setpts=PTS-STARTPTS,crop=934:528:956:169,scale={width}:{height}[p];"
        f"[0:v][p]overlay={x}:{y}:shortest=1,"
        f"drawbox=x={x}:y={y}:w={width}:h={height}:color={GOLD}:t=2,format=yuv420p[v]"
    )
    run([
        "ffmpeg", "-nostdin", "-v", "error", "-y", "-loop", "1", "-framerate", str(FPS),
        "-i", str(base), "-ss", f"{start_frame / FPS:.6f}", "-i", str(source), "-filter_complex", graph,
        "-map", "[v]", "-frames:v", str(frames), "-an", "-c:v", "libx264", "-preset", "veryfast",
        "-crf", "20", "-g", "50", str(destination),
    ])


def concat_picture(parts: list[Path], destination: Path) -> None:
    manifest = destination.with_suffix(".ffconcat")
    manifest.write_text("ffconcat version 1.0\n" + "".join(f"file '{part.as_posix()}'\n" for part in parts), encoding="utf-8")
    run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(manifest), "-c", "copy", str(destination)])


def mux_audio(picture: Path, source: Path, destination: Path) -> None:
    run([
        "ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(picture), "-i", str(source),
        "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "copy", "-movflags", "+faststart", str(destination),
    ])


def audio_payload_hash(path: Path, destination: Path) -> str:
    run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(path), "-map", "0:a:0", "-c:a", "copy", "-f", "adts", str(destination)])
    return sha256(destination)


def contact_sheet(video: Path, times: list[int], destination: Path, portrait: bool) -> None:
    frames: list[Image.Image] = []
    with tempfile.TemporaryDirectory() as temp:
        for index, second in enumerate(times):
            path = Path(temp) / f"{index:02d}.jpg"
            run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", str(second), "-i", str(video), "-frames:v", "1", str(path)])
            frames.append(Image.open(path).convert("RGB"))
    thumb_w = 260 if portrait else 480
    thumbs = [image.resize((thumb_w, round(image.height * thumb_w / image.width)), Image.Resampling.LANCZOS) for image in frames]
    columns = 4 if portrait else 2
    label_h = 34
    cell_h = max(image.height for image in thumbs) + label_h
    rows = (len(thumbs) + columns - 1) // columns
    sheet = Image.new("RGB", (thumb_w * columns, cell_h * rows), "#0b2d3a")
    draw = ImageDraw.Draw(sheet)
    label_font = ImageFont.truetype(str(FONT), 17, index=0)
    for index, (thumb, second) in enumerate(zip(thumbs, times)):
        x = (index % columns) * thumb_w
        y = (index // columns) * cell_h
        sheet.paste(thumb, (x, y))
        draw.text((x + 8, y + thumb.height + 7), f"{second // 60:02d}:{second % 60:02d}", font=label_font, fill="#f7eedc")
    sheet.save(destination, quality=92)


def write_player() -> None:
    cards = []
    for lesson in LESSONS:
        for variant in ("desktop", "portrait"):
            cards.append(f"""
<section><h2>{lesson.upper()} · {variant}</h2>
<video controls preload="metadata"><source src="{lesson}/{lesson}-{variant}-contextual-review.mp4" type="video/mp4">
<track kind="captions" src="{lesson}/{lesson}-captions.vtt" srclang="en" label="English"></video></section>""")
    (OUT / "review-player.html").write_text("""<!doctype html><meta charset="utf-8"><title>Accelerated L05–L08 review</title>
<style>body{margin:0;background:#071c25;color:#f7eedc;font:16px system-ui;padding:24px}main{display:grid;gap:28px}section{border-top:1px solid #d8ac52;padding-top:12px}video{display:block;max-width:100%;max-height:78vh;background:#000}</style><main>""" + "".join(cards) + "</main>", encoding="utf-8")


def build_presenter_preflight(module) -> tuple[Path, dict[str, Any]]:
    preflight = OUT / "presenter-composition-preflight"
    preflight.mkdir(parents=True, exist_ok=True)
    receipt: dict[str, Any] = {
        "schema": "accelerated_l05_l08_presenter_composition_preflight_v1",
        "rule": "native presenter source region and teaching content use distinct, non-overlapping bounds",
        "presenter_placements": PRESENTER_PLACEMENT,
        "illustration_under_presenter": False,
        "lessons": {},
    }
    for lesson, config in LESSONS.items():
        lesson_key = lesson.upper()
        scenes = module.SCENES[lesson_key]
        lesson_dir = preflight / lesson
        lesson_dir.mkdir(exist_ok=True)
        duration_frames = int(config["duration"]) * FPS
        intervals_by_scene = {
            scene_index(start, duration_frames): (start, end)
            for start, end in config["presenter_frames"]
        }
        active_scenes = sorted(intervals_by_scene)
        lesson_receipt: dict[str, Any] = {"active_scene_indexes": active_scenes, "stills": {}}
        for variant in ("desktop", "portrait"):
            paths: list[Path] = []
            for scene_index_value in active_scenes:
                scene = scenes[scene_index_value]
                destination = lesson_dir / f"{variant}-scene-{scene_index_value + 1:02d}.png"
                presenter_base(module, scene, variant, destination)
                preview = lesson_dir / f"{variant}-scene-{scene_index_value + 1:02d}-with-presenter.png"
                start, end = intervals_by_scene[scene_index_value]
                with tempfile.TemporaryDirectory() as temp:
                    source_frame = Path(temp) / "presenter.png"
                    run([
                        "ffmpeg", "-nostdin", "-v", "error", "-y",
                        "-ss", f"{((start + end) / 2) / FPS:.6f}", "-i", str(config["source"]),
                        "-frames:v", "1", str(source_frame),
                    ])
                    native = Image.open(source_frame).convert("RGB").crop((956, 169, 1890, 697))
                x, y, width, height = PRESENTER_PLACEMENT[variant]
                native = native.resize((width, height), Image.Resampling.LANCZOS)
                composite = Image.open(destination).convert("RGB")
                composite.paste(native, (x, y))
                preview_draw = ImageDraw.Draw(composite)
                preview_draw.rectangle((x, y, x + width - 1, y + height - 1), outline=GOLD, width=2)
                composite.save(preview)
                paths.append(preview)
            contact = lesson_dir / f"{variant}-presenter-safe-contact.jpg"
            module.contact_sheet(paths, contact, variant == "portrait")
            lesson_receipt["stills"][variant] = {
                "files": [{"path": str(path.relative_to(ROOT)), "sha256": sha256(path)} for path in paths],
                "contact": str(contact.relative_to(ROOT)),
                "contact_sha256": sha256(contact),
            }
        receipt["lessons"][lesson_key] = lesson_receipt
    receipt_path = preflight / "presenter-composition-preflight-receipt.json"
    receipt_path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    return receipt_path, receipt


def main(preflight_only: bool = False) -> None:
    receipt_path = STILLS / "still-rebuild-receipt.json"
    if sha256(receipt_path) != APPROVED_RECEIPT_SHA256:
        raise SystemExit("Approved L05-L08 still receipt drifted; refusing to render")
    still_receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    module = load_still_module()
    OUT.mkdir(parents=True, exist_ok=True)
    preflight_receipt_path, preflight_receipt = build_presenter_preflight(module)
    if preflight_only:
        print(preflight_receipt_path)
        return
    receipt: dict[str, Any] = {
        "schema": "accelerated_l05_l08_contextual_review_v1",
        "approved_still_receipt": str(receipt_path.relative_to(ROOT)),
        "approved_still_receipt_sha256": APPROVED_RECEIPT_SHA256,
        "fps": FPS,
        "audio_policy": "source AAC packet payload copied without decoding or retiming",
        "caption_policy": "byte-identical optional WebVTT sidecar; default off in review player",
        "presenter_policy": "retain only measured native-video frame runs; exclude legacy placeholder frames from nominal presenter windows",
        "presenter_composition_preflight": str(preflight_receipt_path.relative_to(ROOT)),
        "presenter_composition_preflight_sha256": sha256(preflight_receipt_path),
        "presenter_placements": preflight_receipt["presenter_placements"],
        "lessons": {},
        "excluded": ["provider contact", "speech generation", "spend", "learner-media change", "PR update", "merge", "deploy", "publish", "release"],
    }
    for lesson, config in LESSONS.items():
        lesson_out = OUT / lesson
        parts_dir = lesson_out / "parts"
        lesson_out.mkdir(exist_ok=True)
        parts_dir.mkdir(exist_ok=True)
        source = Path(config["source"])
        captions = Path(config["captions"])
        metadata = probe(source)
        if abs(float(metadata["format"]["duration"]) - config["duration"]) > 0.02:
            raise SystemExit(f"{lesson} source duration drift")
        lesson_key = lesson.upper()
        scenes = module.SCENES[lesson_key]
        timeline = segments(config)
        copied_vtt = lesson_out / f"{lesson}-captions.vtt"
        shutil.copy2(captions, copied_vtt)
        lesson_receipt: dict[str, Any] = {
            "source": str(source.relative_to(ROOT)), "source_sha256": sha256(source),
            "captions": str(captions.relative_to(ROOT)), "captions_sha256": sha256(captions),
            "qualified_presenter_frame_ranges": config["presenter_frames"],
            "timeline": timeline, "outputs": {},
        }
        for variant in ("desktop", "portrait"):
            parts: list[Path] = []
            bases: dict[int, Path] = {}
            for idx, segment in enumerate(timeline):
                scene = scenes[segment["scene"]]
                part = parts_dir / f"{variant}-{idx:02d}.mp4"
                parts.append(part)
                if segment["presenter"]:
                    base = bases.get(segment["scene"])
                    if base is None:
                        base = OUT / "presenter-composition-preflight" / lesson / f"{variant}-scene-{segment['scene'] + 1:02d}.png"
                        if not base.exists():
                            raise SystemExit(f"Missing presenter composition preflight still {base}")
                        bases[segment["scene"]] = base
                    encode_presenter(base, source, segment["start_frame"], segment["frames"], variant, part)
                else:
                    still = STILLS / lesson / f"{scene['id']}-{variant}-clean.png"
                    if not still.exists():
                        raise SystemExit(f"Missing approved still {still}")
                    encode_still(still, segment["frames"], part)
            picture = lesson_out / f"{lesson}-{variant}-picture.mp4"
            final = lesson_out / f"{lesson}-{variant}-contextual-review.mp4"
            concat_picture(parts, picture)
            mux_audio(picture, source, final)
            run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(final), "-f", "null", "-"])
            final_probe = probe(final)
            measured = float(final_probe["format"]["duration"])
            if abs(measured - config["duration"]) > 0.05:
                raise SystemExit(f"{lesson} {variant} duration mismatch: {measured}")
            with tempfile.TemporaryDirectory() as temp:
                source_audio = audio_payload_hash(source, Path(temp) / "source.aac")
                final_audio = audio_payload_hash(final, Path(temp) / "final.aac")
            if source_audio != final_audio:
                raise SystemExit(f"{lesson} {variant} audio payload mismatch")
            scene_len = config["duration"] // 6
            first_presenter_mid = round(sum(config["presenter_frames"][0]) / (2 * FPS))
            final_presenter_mid = round(sum(config["presenter_frames"][-1]) / (2 * FPS))
            contact_times = list(
                dict.fromkeys(
                    [first_presenter_mid]
                    + [int(scene_len * i + min(40, scene_len - 2)) for i in range(6)]
                    + [final_presenter_mid]
                )
            )
            contact = lesson_out / f"{lesson}-{variant}-contact.jpg"
            contact_sheet(final, contact_times, contact, variant == "portrait")
            lesson_receipt["outputs"][variant] = {
                "path": str(final.relative_to(ROOT)), "sha256": sha256(final),
                "duration": measured, "dimensions": (1920, 1080) if variant == "desktop" else (390, 844),
                "audio_payload_sha256": final_audio,
                "contact": str(contact.relative_to(ROOT)), "contact_sha256": sha256(contact),
            }
        receipt["lessons"][lesson_key] = lesson_receipt
    write_player()
    receipt_path = OUT / "contextual-review-receipt.json"
    receipt_path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(receipt_path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preflight-only", action="store_true")
    args = parser.parse_args()
    main(preflight_only=args.preflight_only)
