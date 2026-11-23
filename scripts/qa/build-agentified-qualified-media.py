#!/usr/bin/env python3
"""Build the qualified Agentified desktop/mobile lesson media and binding receipt."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PADDING = ROOT / "agentified/workshop/phase-3b-review/text-panel-padding"
COMPOSITES = json.loads((ROOT / "agentified/workshop/presentation-illustration-audit/composite-receipts.json").read_text())["composites"]
OLD = json.loads((ROOT / "lib/agentified-illustrated-bindings.json").read_text())
ELIGIBLE = ["L01", *[f"L{i:02d}" for i in range(5, 17)]]

BASE_OVERRIDES = {
    "L07": PADDING / "l07-01-source-brief/L07-01-source-brief-candidate.mp4",
    "L08": PADDING / "l08-caption-free-presenter/L08-caption-free-presenter-candidate.mp4",
    "L13": ROOT / "agentified/workshop/phase-3b-review/L13/agentified-l13-unknown-content-aware-candidate.mp4",
    "L16": PADDING / "l16-caption-free-presenter/L16-caption-free-presenter-candidate.mp4",
}

SPECIAL = {
    "L06-03": "l06-03-responsive-study",
    "L07-05": "l07-05-route-study",
    "L08-05": "l08-05-receipt-study",
    "L09-02": "l09-02-metrics-study",
    "L09-04": "l09-04-ladder-study",
    "L10-03": "l10-03-ladder-study",
    "L11-02": "l11-02-stack-study",
    "L12-03": "l12-03-receipt-study",
    "L13-02": "l13-02-proposal-study",
    "L14-03": "l14-03-plate-study",
    "L14-04": "l14-04-plate-study",
    "L15-04": "l15-04-trust-study",
    "L16-04": "l16-04-audit-study",
    "L16-05": "l16-05-audit-study",
}

SKIP_OVERLAY = {"L07-01", "L07-08", "L13-03"}


def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def receipt_for(lesson_id: str) -> dict:
    return next(item for item in COMPOSITES if item["lesson_id"] == lesson_id)


def subtract_protected(start: float, end: float, windows: list[list]) -> list[tuple[float, float]]:
    remaining = [(start, end)]
    for protected_start, protected_end, _ in windows:
        next_remaining = []
        for left, right in remaining:
            if protected_end <= left or protected_start >= right:
                next_remaining.append((left, right))
            else:
                if left < protected_start:
                    next_remaining.append((left, protected_start))
                if protected_end < right:
                    next_remaining.append((protected_end, right))
        remaining = next_remaining
    return [(left, right) for left, right in remaining if right - left > 0.001]


def special_states(scene_id: str, layout: str, start: float, end: float) -> list[tuple[Path, float, float]]:
    if scene_id in {"L14-03", "L14-04"}:
        source = json.loads((PADDING / "l14-scene-exact-timing-receipt.json").read_text())
        item = next(row for row in source["scenes"] if row["scene"] == scene_id)
        frames = [item["overviewFrame"], item["focusFrame"]]
        durations = item["routeTimelineSeconds"]
    elif scene_id == "L15-04":
        item = json.loads((PADDING / "l15-scene-exact-timing-receipt.json").read_text())
        frames = [item["overviewFrame"], item["focusFrame"]]
        durations = item["routeTimelineSeconds"]
    elif scene_id in {"L16-04", "L16-05"}:
        source = json.loads((PADDING / "l16-scene-exact-timing-receipt.json").read_text())
        item = next(row for row in source["scenes"] if row["scene"] == scene_id)
        states = next(row for row in item["layouts"] if row["layout"] == layout)["states"]
        frames = [row["frame"] for row in states]
        durations = [row["durationSeconds"] for row in states]
    else:
        source = json.loads((PADDING / SPECIAL[scene_id] / "clip-receipt.json").read_text())
        clip = next(row for row in source["clips"] if row["layout"] == layout)
        frames = [row["frame"] for row in clip["timeline"]]
        durations = [row["durationSeconds"] for row in clip["timeline"]]
    rows = []
    cursor = start
    for index, (frame, duration) in enumerate(zip(frames, durations)):
        next_cursor = end if index == len(frames) - 1 else cursor + duration
        rows.append((ROOT / frame, cursor, next_cursor))
        cursor = next_cursor
    if abs(cursor - end) > 0.002:
        raise RuntimeError(f"{scene_id} {layout} timeline ends at {cursor}, expected {end}")
    return rows


def overlays(lesson_id: str, layout: str) -> list[tuple[Path, float, float]]:
    receipt = receipt_for(lesson_id)
    rows = []
    for scene in receipt["scene_boundaries"]:
        scene_id = scene["scene_id"]
        if scene_id in SKIP_OVERLAY:
            continue
        start, end = scene["start_seconds"], scene["end_seconds"]
        if scene_id in SPECIAL:
            rows.extend(special_states(scene_id, layout, start, end))
            continue
        frame = PADDING / "frames/illustrated" / f"{scene_id}.png"
        if not frame.is_file():
            continue
        for left, right in subtract_protected(start, end, receipt["protected_windows"]):
            rows.append((frame, left, right))
    return rows


def probe(path: Path) -> dict:
    result = subprocess.run([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration:stream=index,codec_type,codec_name,width,height,r_frame_rate",
        "-of", "json", str(path),
    ], check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


def build_one(lesson_id: str, layout: str, force: bool) -> dict:
    receipt = receipt_for(lesson_id)
    base = BASE_OVERRIDES.get(lesson_id, ROOT / "public" / OLD["bindings"][lesson_id]["video"].lstrip("/"))
    expected_base = {
        "L07": "b9016102fc8272f1c51f1fcee9b5f0aafe5c8928988beaf970645e337446a5b4",
        "L08": "f709e881f3cf4816c05ac287a3181d50621c1e16df14212c5357890f08baedb0",
        "L13": "878d262919c6e7f93997c1289aa9f22ff7dee9c8893b329b4920e8ef6d10ec02",
        "L16": "2fcae49deaf43251b8d4f05001401e8f13be1566ff31fbf9a3e069e58108dfc5",
    }.get(lesson_id, receipt["output_sha256"])
    if sha(base) != expected_base:
        raise RuntimeError(f"{lesson_id} source hash drift: {sha(base)} != {expected_base}")
    timeline = overlays(lesson_id, layout)
    out_dir = ROOT / "public/agentified/qualified" / lesson_id.lower()
    out_dir.mkdir(parents=True, exist_ok=True)
    output = out_dir / f"agentified-{lesson_id.lower()}-{layout}.mp4"
    if force or not output.exists():
        args = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(base)]
        for frame, _, _ in timeline:
            if not frame.is_file():
                raise FileNotFoundError(frame)
            args += ["-loop", "1", "-framerate", "25", "-i", str(frame)]
        filters, previous = [], "0:v"
        for index, (_, start, end) in enumerate(timeline, 1):
            current = f"v{index}"
            filters.append(f"[{previous}][{index}:v]overlay=enable='gte(t,{start})*lt(t,{end})':shortest=1:format=auto[{current}]")
            previous = current
        filters.append(f"[{previous}]format=yuv420p[v]")
        args += ["-filter_complex", ";".join(filters), "-map", "[v]", "-map", "0:a?", "-map", "0:s?",
                 "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-r", "25", "-c:a", "copy", "-c:s", "copy",
                 "-t", str(receipt["source_duration_seconds"]), "-movflags", "+faststart", str(output)]
        subprocess.run(args, check=True)
    return {
        "path": "/" + output.relative_to(ROOT / "public").as_posix(),
        "sha256": sha(output),
        "probe": probe(output),
        "sourcePath": str(base.relative_to(ROOT)),
        "sourceSha256": expected_base,
        "overlayCount": len(timeline),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lesson", action="append", choices=ELIGIBLE)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    lessons = args.lesson or ELIGIBLE
    results = {}
    for lesson_id in lessons:
        print(f"Building {lesson_id} desktop", flush=True)
        desktop = build_one(lesson_id, "desktop", args.force)
        if overlays(lesson_id, "desktop") == overlays(lesson_id, "mobile"):
            mobile = dict(desktop)
            print(f"Reused identical {lesson_id} desktop timeline for mobile", flush=True)
        else:
            print(f"Building {lesson_id} mobile", flush=True)
            mobile = build_one(lesson_id, "mobile", args.force)
        results[lesson_id] = {"desktop": desktop, "mobile": mobile}
    receipt_path = ROOT / "agentified/workshop/phase-4-integration/media-build-receipt.json"
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    existing = json.loads(receipt_path.read_text()) if receipt_path.exists() else {"schemaVersion": 1, "lessons": {}}
    existing["lessons"].update(results)
    receipt_path.write_text(json.dumps(existing, indent=2) + "\n")
    if all(lesson_id in existing["lessons"] for lesson_id in ELIGIBLE):
        bindings = {}
        for lesson_id in ELIGIBLE:
            previous = OLD["bindings"][lesson_id]
            caption_source = ROOT / "public" / previous["captions"].lstrip("/")
            if lesson_id == "L09":
                caption_source = ROOT / "agentified/workshop/phase-3b-review/L09/agentified-l09-approved-word-candidate.vtt"
            caption_dir = ROOT / "public/agentified/qualified" / lesson_id.lower()
            caption_dir.mkdir(parents=True, exist_ok=True)
            caption_output = caption_dir / f"agentified-{lesson_id.lower()}-captions.vtt"
            shutil.copy2(caption_source, caption_output)
            built = existing["lessons"][lesson_id]
            bindings[lesson_id] = {
                "video": built["desktop"]["path"],
                "compositeSha256": built["desktop"]["sha256"],
                "portraitVideo": built["mobile"]["path"],
                "portraitSha256": built["mobile"]["sha256"],
                "sourceVideo": previous["sourceVideo"],
                "sourceSha256": previous["sourceSha256"],
                "captions": "/" + caption_output.relative_to(ROOT / "public").as_posix(),
                "captionsSha256": sha(caption_output),
                "sourceCaptions": previous["captions"],
                "sourceCaptionsSha256": previous["captionsSha256"],
                "transcriptSha256": previous["transcriptSha256"],
                "durationSeconds": previous["durationSeconds"],
            }
        manifest = {
            "schemaVersion": 2,
            "qualifiedTree": "9f70b89002603b3100c42d062b064b9386c2f399",
            "captionFreeSourceHead": "92bcc37c1eeb19f275b97fea8e647e9ae7376145",
            "releaseScope": "L01 and L05-L16 only; L02-L04 remain transcript-and-worksheet states because complete qualified lesson audio is unavailable.",
            "correctionReviewState": "captain_qualified_human_qa_pending",
            "bindings": bindings,
        }
        (ROOT / "lib/agentified-qualified-bindings.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(receipt_path)


if __name__ == "__main__":
    main()
