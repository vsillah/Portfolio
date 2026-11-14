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


def artwork(scene, size, variant="wide"):
    if variant == "member":
        scene, variant = 2, "detail"
    source = Image.open(ART / f"l04-scene-{scene:02d}.png").convert("RGB")
    if size == "portrait":
        bg = Image.new("RGB", (390, 844), "#efe8d7")
        bg.paste(ImageOps.fit(source, (390, 220), method=Image.Resampling.LANCZOS), (0, 0))
        bg.paste(ImageOps.fit(source, (390, 624), method=Image.Resampling.LANCZOS,
                              centering=portrait_focus[scene][variant]), (0, 220))
        return bg
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


def presenter_background(scene, size):
    source = Image.open(ART / f"l04-scene-{scene:02d}.png").convert("RGB")
    if size == "portrait":
        bg = Image.new("RGB", (390, 844), "#e9dfcb")
        # Keep the complete teaching image, then bring its working detail closer.
        # Both sit above the dedicated native presenter section.
        bg.paste(ImageOps.fit(source, (390, 220), method=Image.Resampling.LANCZOS), (0, 0))
        bg.paste(ImageOps.fit(source, (390, 290), method=Image.Resampling.LANCZOS,
                              centering=portrait_focus[scene]["detail"]), (0, 220))
    else:
        bg = Image.new("RGB", (1920, 1080), "#e9dfcb")
        if scene == 7:
            # Keep all four decision-file pages visible, then bring their
            # working fields close enough to read beside the presenter.
            bg.paste(ImageOps.fit(source, (975, 549), method=Image.Resampling.LANCZOS), (24, 100))
            bg.paste(ImageOps.fit(source, (975, 331), method=Image.Resampling.LANCZOS,
                                  centering=(.5, .85)), (24, 649))
        else:
            teaching = ImageOps.fit(source, (975, 880), method=Image.Resampling.LANCZOS,
                                    centering=desktop_focus[scene])
            bg.paste(teaching, (24, 100))
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
            bg = presenter_background(scene, size)
            placement = PRESENTER_PLACEMENT[size]
            bg.paste(native_frame.resize(placement["size"], Image.Resampling.LANCZOS), placement["xy"])
            bg.save(previews / f"{name.lower()}-{size}.png")
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
sizes = ("desktop",) if "--desktop-only" in sys.argv else ("desktop", "portrait")
portrait_unchanged = OUT / "l04-whole-lesson-portrait-presenter-section-local-review.mp4"
if "--desktop-only" in sys.argv:
    assert sha(portrait_unchanged) == "71fbfdafbcb7c29be9c23de2d5c5f40cc15a7fcbb82adb999ac90653d20635f4", "Portrait master drift"
for size in sizes:
    clips = []
    for i, (name, scene, start, end, native_range, variant) in enumerate(cuts):
        target = OUT / f"{size}-{i+1:02d}-{name.lower()}.mp4"
        if native_range:
            encode_presenter(presenter_background(scene, size), target, native_range, size)
        else:
            frames = frame_boundaries[i+1] - frame_boundaries[i]
            encode_still(artwork(scene, size, variant), target, frames)
        clips.append(target)
    playlist = OUT / f"{size}.ffconcat"
    playlist.write_text("ffconcat version 1.0\n" + "".join(f"file '{p}'\n" for p in clips))
    silent = OUT / f"{size}-silent.mp4"
    run(["ffmpeg", "-v", "error", "-y", "-safe", "0", "-f", "concat", "-i", str(playlist), "-map", "0:v:0", "-c", "copy", str(silent)])
    target = OUT / ("l04-whole-lesson-desktop-expanded-presenter-local-review.mp4" if size == "desktop"
                    else "l04-whole-lesson-portrait-presenter-section-local-review.mp4")
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
    "presenter_placement": PRESENTER_PLACEMENT,
    "outputs": {p.name: sha(p) for p in (audio,
        OUT / "l04-whole-lesson-desktop-expanded-presenter-local-review.mp4",
        portrait_unchanged)},
    "excluded_actions": "No HeyGen contact, spending, learner media change, commit, push, PR update, merge, deployment, publication or release.",
}
(OUT / ("render-receipt-desktop-expanded.json" if "--desktop-only" in sys.argv else "render-receipt-presenter-section.json")).write_text(json.dumps(receipt, indent=2) + "\n")
for size in sizes:
    for intermediate in OUT.glob(f"{size}-[0-9][0-9]-*"):
        intermediate.unlink()
    (OUT / f"{size}.ffconcat").unlink(missing_ok=True)
    (OUT / f"{size}-silent.mp4").unlink(missing_ok=True)
print(json.dumps(receipt["outputs"], indent=2))
