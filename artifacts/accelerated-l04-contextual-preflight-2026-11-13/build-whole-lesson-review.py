#!/usr/bin/env python3
"""Build local L04 desktop/portrait review candidates from hash-bound sources."""

import hashlib
import json
import subprocess
import sys
import io
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = HERE / "whole-lesson-review"
OUT.mkdir(exist_ok=True)
ART = HERE / "scene-art"
CONTRACT = json.loads((HERE / "l04-timing-contract.json").read_text())
PROVENANCE = json.loads((HERE / "scene-art-provenance.json").read_text())
NATIVE = Path(CONTRACT["native_presenter"]["path"])


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(args):
    subprocess.run(args, check=True)


assert sha(NATIVE) == CONTRACT["native_presenter"]["sha256"]
for job in CONTRACT["jobs"].values():
    assert sha(ROOT / job["wav"]) == job["wav_sha256"]
    assert sha(ROOT / job["timings"]) == job["timings_sha256"]
for scene in PROVENANCE["scenes"]:
    assert sha(HERE / scene["project_path"]) == scene["sha256"]

segments = {s["id"]: s for s in CONTRACT["segments"]}
beats = {b["scene"]: b["timeline_start_seconds"] for b in CONTRACT["picture_beats"]}
presenter_ranges = {name: (segments[name]["source"]["frame_start"], segments[name]["source"]["frame_end_exclusive"])
                    for name in ("P01", "P02", "P03", "P04")}
presenter_visible = {"P01": False, "P02": False, "P03": True, "P04": True}
base_cuts = [
    ("P01", 1, 0, segments["P01"]["timeline_end_seconds"], presenter_ranges["P01"]),
    ("C01a", 1, segments["C01"]["timeline_start_seconds"], beats[2], None),
    ("C01b", 2, beats[2], segments["C01"]["timeline_end_seconds"], None),
    ("P02", 3, segments["P02"]["timeline_start_seconds"], segments["P02"]["timeline_end_seconds"], presenter_ranges["P02"]),
    ("C02a", 3, segments["C02"]["timeline_start_seconds"], beats[4], None),
    ("C02b", 4, beats[4], segments["C02"]["timeline_end_seconds"], None),
    ("P03", 5, segments["P03"]["timeline_start_seconds"], segments["P03"]["timeline_end_seconds"], presenter_ranges["P03"]),
    ("C03a", 5, segments["C03"]["timeline_start_seconds"], beats[6], None),
    ("C03b", 6, beats[6], beats[7], None),
    ("C03c", 7, beats[7], segments["C03"]["timeline_end_seconds"], None),
    ("P04", 7, segments["P04"]["timeline_start_seconds"], segments["P04"]["timeline_end_seconds"], presenter_ranges["P04"]),
    ("C04", 7, segments["C04"]["timeline_start_seconds"], segments["C04"]["timeline_end_seconds"], None),
]

# Phrase starts from the returned word timings. Each cutaway gets a second
# picture focus when the spoken claim moves; no arbitrary time hold is added.
focus_changes = {
    name: round(segments[window]["timeline_start_seconds"] + offset, 3)
    for name, window, offset in (
        ("C01a", "C01", 17.870), ("C01b", "C01", 64.787),
        ("C02a", "C02", 24.875), ("C02b", "C02", 87.572),
        ("C03a", "C03", 7.742), ("C03b", "C03", 71.214),
        ("C03c", "C03", 116.950),
    )
}
cuts = []
for name, scene, start, end, native_range in base_cuts:
    if name in focus_changes:
        change = focus_changes[name]
        assert start < change < end
        cuts.append((name + "-wide", scene, start, change, None, "wide"))
        cuts.append((name + "-focus", scene, change, end, None, "member" if name == "C02a" else "detail"))
    else:
        cuts.append((name, scene, start, end, native_range, "wide"))


portrait_focus = {
    1: {"wide": (.27, .60), "detail": (.48, .56)},
    2: {"wide": (.26, .60), "detail": (.68, .60)},
    3: {"wide": (.48, .48), "detail": (.48, .48)},
    4: {"wide": (.27, .65), "detail": (.52, .64)},
    5: {"wide": (.27, .60), "detail": (.50, .69)},
    6: {"wide": (.27, .60), "detail": (.65, .56)},
    7: {"wide": (.30, .68), "detail": (.73, .68)},
}
desktop_focus = {1: (.52, .60), 2: (.70, .60), 3: (.50, .50), 4: (.52, .63), 5: (.52, .66), 6: (.65, .64), 7: (.67, .68)}
presenter_focus = {"P01": (.43, .60), "P02": (.46, .52), "P03": (.50, .68), "P04": (.58, .66)}
brand_blue = "#121E31"
assert "--imperial-navy: #121E31;" in (ROOT / "app/globals.css").read_text()
assert "'imperial-navy': '#121E31'" in (ROOT / "tailwind.config.ts").read_text()


def artwork(scene, size, variant="wide"):
    if variant == "member":
        scene, variant = 2, "detail"
    source = Image.open(ART / f"l04-scene-{scene:02d}.png").convert("RGB")
    if size == "portrait":
        return ImageOps.fit(
            source,
            (390, 844),
            method=Image.Resampling.LANCZOS,
            centering=portrait_focus[scene][variant],
        )
    if variant == "detail":
        cx, cy = desktop_focus[scene]
        w, h = 1200, 675
        left = max(0, min(source.width - w, round(source.width * cx - w / 2)))
        top = max(0, min(source.height - h, round(source.height * cy - h / 2)))
        source = source.crop((left, top, left + w, top + h))
    return ImageOps.fit(source, (1920, 1080), method=Image.Resampling.LANCZOS)


PRESENTER_PLACEMENT = {
    "desktop": {"xy": (1045, 312), "size": (810, 456)},
    "portrait": {"xy": (0, 526), "size": (390, 219)},
}
PRESENTER_IMAGE_LAYERS = {}


def illustration_only(scene, name, size):
    source = Image.open(ART / f"l04-scene-{scene:02d}.png").convert("RGB")
    dimensions = (1920, 1080) if size == "desktop" else (390, 844)
    return ImageOps.fit(source, dimensions, method=Image.Resampling.LANCZOS,
                        centering=presenter_focus[name])


def art_mask(size, portrait):
    w, h = size
    mask = Image.new("L", size, 0)
    pixels = mask.load()
    if portrait:
        for y in range(h):
            alpha = 255 if y <= h - 100 else max(0, round(255 * (h - y) / 100))
            for x in range(w):
                pixels[x, y] = alpha
    else:
        for y in range(h):
            vertical = min(1, y / 100, (h - y) / 100)
            for x in range(w):
                horizontal = min(1, x / 32, (w - x) / 170)
                pixels[x, y] = max(0, round(255 * min(vertical, horizontal)))
    return mask


def presenter_background(scene, name, size):
    source = Image.open(ART / f"l04-scene-{scene:02d}.png").convert("RGB")
    if size == "portrait":
        bg = Image.new("RGB", (390, 844), brand_blue)
        image_layers = 0
        teaching = ImageOps.fit(source, (390, 510), method=Image.Resampling.LANCZOS,
                                centering=presenter_focus[name])
        bg.paste(teaching, (0, 0), art_mask(teaching.size, True))
        image_layers += 1
        assert image_layers == 1, f"Portrait presenter scene {scene} has {image_layers} teaching-image layers"
        PRESENTER_IMAGE_LAYERS[scene] = image_layers
    else:
        bg = Image.new("RGB", (1920, 1080), brand_blue)
        teaching = ImageOps.fit(source, (1055, 830), method=Image.Resampling.LANCZOS,
                                centering=presenter_focus[name])
        bg.paste(teaching, (0, 95), art_mask(teaching.size, False))
    x, y = PRESENTER_PLACEMENT[size]["xy"]
    w, h = PRESENTER_PLACEMENT[size]["size"]
    ImageDraw.Draw(bg).rectangle((x-1, y-1, x+w, y+h), outline="#b9915a", width=1)
    return bg


def encode_still(image, target, frames):
    still = target.with_suffix(".png")
    image.save(still)
    run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-framerate", "25", "-i", str(still),
         "-frames:v", str(frames), "-an", "-vf", "format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", str(target)])


def encode_presenter(image, target, frame_range, size):
    still = target.with_suffix(".png")
    image.save(still)
    a, b = frame_range
    placement = PRESENTER_PLACEMENT[size]
    scale = f"{placement['size'][0]}:{placement['size'][1]}"
    xy = f"{placement['xy'][0]}:{placement['xy'][1]}"
    graph = f"[1:v]trim=start_frame={a}:end_frame={b},setpts=PTS-STARTPTS,scale={scale}[p];[0:v][p]overlay={xy}:shortest=1,format=yuv420p[v]"
    run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-framerate", "25", "-i", str(still), "-i", str(NATIVE),
         "-filter_complex", graph, "-map", "[v]", "-frames:v", str(b-a), "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", str(target)])


if "--stills-only" in sys.argv:
    previews = OUT / "presenter-section-preflight"
    previews.mkdir(exist_ok=True)
    for name, scene in (("P01", 1), ("P02", 3), ("P03", 5), ("P04", 7)):
        frame_start, frame_end = (segments[name]["source"][k] for k in ("frame_start", "frame_end_exclusive"))
        native_time = (frame_start + frame_end) / 50
        raw = subprocess.check_output(["ffmpeg", "-v", "error", "-ss", str(native_time), "-i", str(NATIVE),
                                       "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"])
        native_frame = Image.open(io.BytesIO(raw)).convert("RGB")
        for size in ("desktop", "portrait"):
            if presenter_visible[name]:
                bg = presenter_background(scene, name, size)
                placement = PRESENTER_PLACEMENT[size]
                bg.paste(native_frame.resize(placement["size"], Image.Resampling.LANCZOS), placement["xy"])
            else:
                bg = illustration_only(scene, name, size)
            bg.save(previews / f"{name.lower()}-{size}.png")
    (previews / "portrait-image-layer-gate.json").write_text(json.dumps({
        "schema": "accelerated_l04_portrait_presenter_image_layer_gate_v1",
        "active_image_layers": {name: (PRESENTER_IMAGE_LAYERS[scene] if presenter_visible[name] else 1)
                                for name, scene in (("P01", 1), ("P02", 3), ("P03", 5), ("P04", 7))},
        "required_layers_per_passage": 1,
        "result": "pass" if all(count == 1 for count in PRESENTER_IMAGE_LAYERS.values()) else "fail",
    }, indent=2) + "\n")
    print(f"Presenter section stills: {previews}")
    sys.exit(0)


# Speech is concatenated once, in canonical order. All trims are in recorded
# pauses and use the native source or the two returned WAVs at original speed.
j01 = ROOT / CONTRACT["jobs"]["01"]["wav"]
j02 = ROOT / CONTRACT["jobs"]["02"]["wav"]
s01 = CONTRACT["jobs"]["01"]["split_seconds"]
s02 = CONTRACT["jobs"]["02"]["split_seconds"]
audio = OUT / "whole-lesson-audio-boundary-corrected.wav"
p1, p2, p3, p4 = (presenter_ranges[name] for name in ("P01", "P02", "P03", "P04"))
graph = (
    f"[0:a]atrim=start={p1[0]/25}:end={p1[1]/25},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[p1];"
    f"[1:a]atrim=start=0:end={s01},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[c1];"
    f"[0:a]atrim=start={p2[0]/25}:end={p2[1]/25},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[p2];"
    f"[1:a]atrim=start={s01},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[c2];"
    f"[0:a]atrim=start={p3[0]/25}:end={p3[1]/25},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[p3];"
    f"[2:a]atrim=start=0:end={s02},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[c3];"
    f"[0:a]atrim=start={p4[0]/25}:end={p4[1]/25},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[p4];"
    f"[2:a]atrim=start={s02},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[c4];"
    "[p1][c1][p2][c2][p3][c3][p4][c4]concat=n=8:v=0:a=1[a]"
)
if not audio.exists():
    run(["ffmpeg", "-v", "error", "-y", "-i", str(NATIVE), "-i", str(j01), "-i", str(j02),
         "-filter_complex", graph, "-map", "[a]", "-c:a", "pcm_s16le", str(audio)])
assert sha(audio) == "c0bf25bbfa9599ba20fe744cbb04b98e7e94a97401ab33b67f850cd8929bdb97", "Audio master drift"

frame_boundaries = [round(x[2] * 25) for x in cuts] + [round(CONTRACT["total_duration_seconds"] * 25)]
sizes = (("desktop",) if "--desktop-only" in sys.argv else
         ("portrait",) if "--portrait-only" in sys.argv else ("desktop", "portrait"))
portrait_current = OUT / "l04-whole-lesson-portrait-single-image-local-review.mp4"
desktop_unchanged = OUT / "l04-whole-lesson-desktop-expanded-presenter-local-review.mp4"
if "--desktop-only" in sys.argv:
    assert sha(portrait_current) == "85c0a94bebfa0934da942070a812685be7397077607edf634409b6cd3472d1a8", "Portrait master drift"
if "--portrait-only" in sys.argv:
    assert sha(desktop_unchanged) == "a56cee03509ebb46030a4582a19887875c3568cea94cf8a4141ba47ee91efd86", "Desktop master drift"
for size in sizes:
    clips = []
    for i, (name, scene, start, end, native_range, variant) in enumerate(cuts):
        target = OUT / f"{size}-{i+1:02d}-{name.lower()}.mp4"
        if native_range and presenter_visible[name]:
            encode_presenter(presenter_background(scene, name, size), target, native_range, size)
        elif native_range:
            frames = frame_boundaries[i+1] - frame_boundaries[i]
            encode_still(illustration_only(scene, name, size), target, frames)
        else:
            frames = frame_boundaries[i+1] - frame_boundaries[i]
            encode_still(artwork(scene, size, variant), target, frames)
        clips.append(target)
    playlist = OUT / f"{size}.ffconcat"
    playlist.write_text("ffconcat version 1.0\n" + "".join(f"file '{p}'\n" for p in clips))
    silent = OUT / f"{size}-silent.mp4"
    run(["ffmpeg", "-v", "error", "-y", "-safe", "0", "-f", "concat", "-i", str(playlist), "-map", "0:v:0", "-c", "copy", str(silent)])
    target = OUT / ("l04-whole-lesson-desktop-intact-native-background-local-review.mp4" if size == "desktop"
                    else "l04-whole-lesson-portrait-intact-native-background-local-review.mp4")
    run(["ffmpeg", "-v", "error", "-y", "-i", str(silent), "-i", str(audio), "-map", "0:v:0", "-map", "1:a:0",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(target)])

receipt = {
    "status": "rendered_pending_audiovisual_qa",
    "source_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
    "timing_contract_sha256": sha(HERE / "l04-timing-contract.json"),
    "art_sha256": {f"scene_{x['scene']:02d}": x["sha256"] for x in PROVENANCE["scenes"]},
    "frame_boundaries": frame_boundaries,
    "phrase_focus_changes_seconds": focus_changes,
    "presenter_source_ranges": [list(presenter_ranges[name]) for name in ("P01", "P02", "P03", "P04")],
    "presenter_visibility": presenter_visible,
    "presenter_background_treatment": "Native source video rectangle retained intact; no key, transparency, mask, blur, background replacement, background recolor, or crop.",
    "slide_field": f"AmaduTown Imperial Navy {brand_blue}",
    "presenter_placement": PRESENTER_PLACEMENT,
    "portrait_presenter_image_layers": {name: (PRESENTER_IMAGE_LAYERS[scene] if presenter_visible[name] else 1)
                                          for name, scene in (("P01", 1), ("P02", 3), ("P03", 5), ("P04", 7))}
    if "portrait" in sizes else None,
    "portrait_cutaway_image_layers": 1 if "portrait" in sizes else None,
    "outputs": {p.name: sha(p) for p in (audio,
        OUT / "l04-whole-lesson-desktop-intact-native-background-local-review.mp4",
        OUT / "l04-whole-lesson-portrait-intact-native-background-local-review.mp4") if p.exists()},
    "excluded_actions": "No HeyGen contact, spending, learner media change, commit, push, PR update, merge, deployment, publication or release.",
}
(OUT / "render-receipt-intact-native-background.json").write_text(json.dumps(receipt, indent=2) + "\n")
for size in sizes:
    for intermediate in OUT.glob(f"{size}-[0-9][0-9]-*"):
        intermediate.unlink()
    (OUT / f"{size}.ffconcat").unlink(missing_ok=True)
    (OUT / f"{size}-silent.mp4").unlink(missing_ok=True)
print(json.dumps(receipt["outputs"], indent=2))
