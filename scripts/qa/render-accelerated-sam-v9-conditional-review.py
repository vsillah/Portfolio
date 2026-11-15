#!/usr/bin/env python3
"""Render source-bound v9 conditional-copy review media without learner binding."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "artifacts/accelerated-sam-contextual-review-2026-11-14"
STILLS = ROOT / "artifacts/accelerated-sam-overlay-preflight-2026-11-15"
V9 = json.loads((STILLS / "v9-overlay-disposition-receipt.json").read_text())
MANIFEST = json.loads((OUT / "v9-source-manifest.json").read_text())
ORDER = ("L01-03", "L02-02", "L05-01", "L05-03")
COPY_SECONDS = 1.6


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(args: list[str]) -> None:
    subprocess.run(args, check=True)


def render(aspect: str) -> dict:
    portrait = aspect == "mobile"
    audio_item = MANIFEST["accepted_audio"]
    command = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
    filters: list[str] = []
    outputs: list[dict] = []
    next_input = 0
    for index, sid in enumerate(ORDER):
        prior = MANIFEST["scenes"][sid]
        states = []
        if portrait and sid.startswith("L05"):
            states.append(("copy", V9["scenes"][sid][aspect]["separate_copy_state"], COPY_SECONDS))
            states.append(("plate", V9["scenes"][sid][aspect]["after"], 8 - COPY_SECONDS))
        else:
            states.append(("plate", V9["scenes"][sid][aspect]["after"], 8))
        state_indices = []
        for label, item, duration in states:
            expected_still = prior["approved_v9_sequence_mobile"] if label == "copy" else prior["approved_v9_after"][aspect]
            if item["path"] != expected_still["path"] or item["sha256"] != expected_still["sha256"]:
                raise RuntimeError(f"Approved v9 {aspect} {sid} {label} identity drifted")
            still = ROOT / item["path"]
            if sha(still) != item["sha256"]:
                raise RuntimeError(f"v9 still drifted: {still}")
            command += ["-loop", "1", "-framerate", "25", "-t", str(duration), "-i", str(still)]
            filters.append(f"[{next_input}:v]trim=duration={duration},setpts=PTS-STARTPTS,format=yuv420p[state{index}_{label}]")
            state_indices.append(f"[state{index}_{label}]")
            next_input += 1
        if len(state_indices) == 1:
            filters.append(f"{state_indices[0]}null[base{index}]")
        else:
            filters.append("".join(state_indices) + f"concat=n=2:v=1:a=0[base{index}]")
        source = ROOT / prior["source"]
        if sha(source) != prior["source_sha256"]:
            raise RuntimeError(f"Native source drifted: {source}")
        command += ["-ss", str(prior["start_seconds"]), "-t", "8", "-i", str(source)]
        crop = prior["presenter_crop"]
        if crop is None:
            filters.append(f"[base{index}]null[scene{index}]")
        else:
            box = ((55, 470, 335, 630) if sid == "L01-03" else (45, 635, 345, 805)) if portrait else (809, 193, 1231, 434)
            x1, y1, x2, y2 = crop
            bx1, by1, bx2, by2 = box
            filters.append(f"[{next_input}:v]trim=duration=8,setpts=PTS-STARTPTS,crop={x2-x1}:{y2-y1}:{x1}:{y1},scale={bx2-bx1}:{by2-by1}:flags=lanczos[p{index}]")
            filters.append(f"[base{index}][p{index}]overlay={bx1}:{by1}:shortest=1,drawbox=x={bx1}:y={by1}:w={bx2-bx1}:h={by2-by1}:color=0xdbb75d:t=2[scene{index}]")
        next_input += 1
        outputs.append({"scene": sid, "source": prior["source"], "source_sha256": prior["source_sha256"], "start_seconds": prior["start_seconds"], "duration_seconds": 8, "states": [{"type": label, "path": item["path"], "sha256": item["sha256"], "duration_seconds": duration} for label, item, duration in states], "presenter_crop": crop})
    filters.append("".join(f"[scene{i}]" for i in range(4)) + "concat=n=4:v=1:a=0[v]")
    temporary = OUT / f"accelerated-sam-signals-{aspect}-review-v9-conditional-video-only.mp4"
    command += ["-filter_complex", ";".join(filters), "-map", "[v]", "-r", "25", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-g", "25", "-keyint_min", "25", "-sc_threshold", "0", "-x264-params", "open-gop=0", "-force_key_frames", "expr:gte(t,n_forced*1)", "-an", "-movflags", "+faststart", str(temporary)]
    run(command)
    target = OUT / f"accelerated-sam-signals-{aspect}-review-v9-conditional.mp4"
    audio = ROOT / audio_item["path"]
    if sha(audio) != audio_item["sha256"]:
        raise RuntimeError(f"Accepted audio source drifted: {audio}")
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(temporary), "-i", str(audio), "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "copy", "-movflags", "+faststart", str(target)])
    temporary.unlink()
    caption_item = MANIFEST["captions"][aspect]
    vtt = ROOT / caption_item["path"]
    if sha(vtt) != caption_item["sha256"]:
        raise RuntimeError(f"Caption source drifted: {vtt}")
    return {"path": str(target.relative_to(ROOT)), "sha256": sha(target), "scenes": outputs, "accepted_audio_path": audio_item["path"], "accepted_audio_sha256": sha(audio), "captions": {"path": caption_item["path"], "sha256": sha(vtt)}}


def main() -> None:
    receipt = {"schema": "accelerated_sam_v9_conditional_contextual_review", "status": "local_review_only", "source_manifest_sha256": sha(OUT / "v9-source-manifest.json"), "v9_stills_receipt_sha256": sha(STILLS / "v9-overlay-disposition-receipt.json"), "scene_duration_seconds": 8, "mobile_copy_state_seconds": COPY_SECONDS, "duration_seconds": 32, "fps": 25, "frames": 800, "learner_bindings_changed": False, "outputs": {}}
    for aspect in ("desktop", "mobile"):
        receipt["outputs"][aspect] = render(aspect)
    target = OUT / "render-receipt-v9-conditional.json"
    target.write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps({aspect: receipt["outputs"][aspect]["path"] for aspect in receipt["outputs"]}, indent=2))


if __name__ == "__main__":
    main()
