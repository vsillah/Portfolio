#!/usr/bin/env python3
"""Trim browser capture marker and encode seek-safe review walkthroughs."""

from pathlib import Path
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "artifacts/accelerated-sam-contextual-review-2026-11-14"
MANIFEST = json.loads((OUT / "v9-source-manifest.json").read_text())


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def marker_end(path: Path) -> float:
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(path), "-vf", "fps=25,scale=1:1:flags=area,format=rgb24", "-f", "rawvideo", "-"])
    pixels = [tuple(raw[index:index + 3]) for index in range(0, len(raw), 3)]
    marker = [index for index, (red, green, blue) in enumerate(pixels) if red > 190 and green < 50 and blue > 190]
    if not marker or len(pixels) - max(marker) - 1 < 800:
        raise RuntimeError(f"Could not locate 32-second playback after marker: {path}")
    return (max(marker) + 1) / 25


def main() -> None:
    receipt = {"schema": "accelerated_sam_v9_conditional_encode", "status": "local_review_only", "source_manifest_sha256": sha(OUT / "v9-source-manifest.json"), "outputs": {}}
    for aspect in ("desktop", "mobile"):
        expected = MANIFEST["approved_walkthroughs"][aspect]
        capture = ROOT / expected["capture_source"]["path"]
        accepted = ROOT / MANIFEST["accepted_audio"]["path"]
        target = OUT / f"accelerated-sam-signals-{aspect}-human-qa-walkthrough-v9-conditional.mp4"
        if sha(capture) != expected["capture_source"]["sha256"] or sha(accepted) != MANIFEST["accepted_audio"]["sha256"]:
            raise RuntimeError(f"Capture or audio source drifted for {aspect}")
        offset = marker_end(capture)
        candidate = OUT / f"accelerated-sam-signals-{aspect}-reprocheck-v9-conditional.mp4"
        subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(capture), "-i", str(accepted), "-filter_complex", f"[0:v]trim=start={offset}:duration=32,setpts=PTS-STARTPTS,fps=25,format=yuv420p[v]", "-map", "[v]", "-map", "1:a:0", "-t", "32", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-g", "25", "-keyint_min", "25", "-sc_threshold", "0", "-x264-params", "open-gop=0", "-force_key_frames", "expr:gte(t,n_forced*1)", "-c:a", "copy", "-movflags", "+faststart", str(candidate)], check=True)
        if sha(candidate) != expected["sha256"]:
            raise RuntimeError(f"Approved {aspect} walkthrough hash changed: {sha(candidate)}")
        candidate.replace(target)
        receipt["outputs"][aspect] = {"capture": str(capture.relative_to(ROOT)), "capture_sha256": sha(capture), "marker_end_seconds": offset, "accepted_audio": str(accepted.relative_to(ROOT)), "accepted_audio_sha256": sha(accepted), "path": str(target.relative_to(ROOT)), "sha256": sha(target)}
    (OUT / "encode-receipt-v9-conditional.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps({aspect: item["path"] for aspect, item in receipt["outputs"].items()}, indent=2))


if __name__ == "__main__":
    main()
