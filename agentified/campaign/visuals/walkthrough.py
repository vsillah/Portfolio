"""Make silent desktop/phone scroll walkthroughs from captured local review page."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = ROOT / "public/agentified/campaign-review/2026-11-23"

def make(label, width, height):
    source = Image.open(HERE / f"sources/review-{label}-full.png").convert("RGB")
    if label == "mobile":
        source = source.resize((780, source.height * 2), Image.Resampling.LANCZOS)
    target = OUT / f"review-{label}-walkthrough.mp4"
    fps, seconds = 8, 18
    proc = subprocess.Popen([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "rawvideo",
        "-pixel_format", "rgb24", "-video_size", f"{width}x{height}", "-framerate", str(fps),
        "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "22",
        "-movflags", "+faststart", str(target),
    ], stdin=subprocess.PIPE)
    assert proc.stdin
    max_y = source.height - height
    for i in range(fps * seconds):
        t = i / (fps * seconds - 1)
        # Ease at the beginning and end so the title and evidence remain inspectable.
        eased = t * t * (3 - 2 * t)
        y = round(max_y * eased)
        proc.stdin.write(source.crop((0, y, width, y + height)).tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError(f"FFmpeg failed for {target}")
    return target

def main():
    outputs = [make("desktop", 1728, 956), make("mobile", 780, 1688)]
    manifest_path = OUT / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    for path in outputs:
        manifest["outputs"].append({"path": str(path.relative_to(ROOT)), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "bytes": path.stat().st_size})
    manifest["review_capture"] = {
        "route": "/agentified/campaign-review/2026-11-23/index.html",
        "viewport": {"desktop": "1728x956", "mobile": "390x844"},
        "source": "Chrome full-page screenshots of local review page; silent scroll walkthroughs",
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print("Created", *outputs)

if __name__ == "__main__":
    main()
