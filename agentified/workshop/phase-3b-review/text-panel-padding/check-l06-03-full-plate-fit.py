"""Make optimistic no-crop L06-03 plate fits for the learner video frame."""

import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
SOURCE = ROOT / "agentified/manuscript/visuals/rendered/publication-plates/figure-ii-1-authority-ladder-publication-plate.png"
EXPECTED_SOURCE_SHA256 = "073e9a29915a5a001b02819aefea65b546cfe45a4b2e4a82ce72df140f84845b"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


assert sha(SOURCE) == EXPECTED_SOURCE_SHA256
source = Image.open(SOURCE).convert("RGB")
assert source.size == (3000, 4700)

fits = []
for name, width, height in (("desktop", 1920, 1080), ("mobile-video", 390, 219)):
    # This grants the full frame height to the plate. Real scene copy would reduce it.
    plate_height = height
    plate_width = round(source.width * plate_height / source.height)
    canvas = Image.new("RGB", (width, height), "#071b2a")
    scaled = source.resize((plate_width, plate_height), Image.Resampling.LANCZOS)
    canvas.paste(scaled, ((width - plate_width) // 2, 0))
    output = HERE / f"L06-03-full-plate-fit-{name}.png"
    canvas.save(output)
    fits.append({
        "layout": name,
        "videoPx": [width, height],
        "platePx": [plate_width, plate_height],
        "sourceScale": plate_height / source.height,
        "path": str(output.relative_to(ROOT)),
        "sha256": sha(output),
    })

receipt = {
    "status": "STOP: no-crop source plate is unreadable in the 390x219 learner video",
    "sourcePath": str(SOURCE.relative_to(ROOT)),
    "sourceSha256": EXPECTED_SOURCE_SHA256,
    "sourcePx": list(source.size),
    "method": "optimistic full-frame-height no-crop fit; excludes headline, labels, and 28px panels",
    "fits": fits,
    "reviewOnlyUnbound": True,
}
(HERE / "l06-03-full-plate-fit-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps(receipt))
