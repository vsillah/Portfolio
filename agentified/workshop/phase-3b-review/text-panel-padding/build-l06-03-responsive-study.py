"""Provider-free, unbound raster study of the complete L06-03 Authority ladder."""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
OUT = HERE / "l06-03-responsive-study"
SOURCE = ROOT / "agentified/manuscript/visuals/rendered/publication-plates/figure-ii-1-authority-ladder-publication-plate.png"
SOURCE_SHA = "073e9a29915a5a001b02819aefea65b546cfe45a4b2e4a82ce72df140f84845b"
FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
REGULAR = "/System/Library/Fonts/Supplemental/Arial.ttf"
SIZE = (1920, 1080)
GOLD = "#c99c35"
LIGHT_GOLD = "#f2d36f"
CREAM = "#fff7e8"
TEAL = "#5b9d9b"
RED = "#9e6359"

# Bottom-to-top order and gate relationships are copied from the approved plate.
STAGES = [
    ("Prepare", "draft, summarize, classify", None),
    ("Recommend", "suggest next action with evidence", "Rollback path required"),
    ("Route", "move work to the right human lane", "Human gate required"),
    ("Stage", "prepare external action for review", "Source check required"),
    ("Execute", "only after explicit authority", "Receipt required"),
]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def font(size, bold=True):
    return ImageFont.truetype(FONT if bold else REGULAR, size)


def background():
    base = Image.new("RGB", SIZE, "#071b2a")
    noise = Image.effect_noise(SIZE, 21).convert("L")
    grain = ImageOps.colorize(noise, "#061522", "#244450")
    base = Image.blend(base, grain, 0.10)
    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle((19, 19, 1900, 1060), radius=27, outline=GOLD, width=4)
    draw.rounded_rectangle((29, 29, 1890, 1050), radius=23, outline="#6e5c35", width=2)
    draw.line((80, 1018, 1840, 1018), fill="#24424f", width=11)
    draw.line((80, 1018, 760, 1018), fill="#d7ad56", width=11)
    return base


def plaque(image, box, *, red=False, radius=22, border=GOLD):
    shadow = Image.new("RGBA", SIZE)
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((box[0] + 5, box[1] + 7, box[2] + 5, box[3] + 7), radius=radius, fill=(0, 0, 0, 135))
    image.paste(Image.alpha_composite(image.convert("RGBA"), shadow.filter(ImageFilter.GaussianBlur(11))).convert("RGB"))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(box, radius=radius, fill="#28171c" if red else "#0d2030", outline=border, width=4)
    draw.rounded_rectangle((box[0] + 10, box[1] + 10, box[2] - 10, box[3] - 10), radius=max(4, radius - 9), outline="#796544", width=2)
    return draw


def draw_center(draw, box, value, size, color=CREAM, *, min_size=None, bold=True):
    min_size = min_size or size
    for s in range(size, min_size - 1, -1):
        f = font(s, bold)
        bounds = draw.textbbox((0, 0), value, font=f)
        if bounds[2] - bounds[0] <= box[2] - box[0] - 40:
            break
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    x = (box[0] + box[2] - width) / 2 - bounds[0]
    y = (box[1] + box[3] - height) / 2 - bounds[1]
    draw.text((x, y), value, font=f, fill=color)
    return {"fontPx": s, "glyphPx": [round(x + bounds[0]), round(y + bounds[1]), width, height]}


def assert_padding(box, text):
    x, y, width, height = text["glyphPx"]
    assert x - box[0] >= 28 and y - box[1] >= 28, (box, text)
    assert box[2] - (x + width) >= 28 and box[3] - (y + height) >= 28, (box, text)


def headline(image, title="Source check before action."):
    draw = ImageDraw.Draw(image)
    f = font(70)
    bounds = draw.textbbox((0, 0), title, font=f)
    width, height = bounds[2] - bounds[0], bounds[3] - bounds[1]
    box = (730, 59, 730 + width + 56, 59 + height + 56)
    assert box[2] < 1870 and box[3] < 175
    plaque(image, box, radius=19)
    draw = ImageDraw.Draw(image)
    draw.text((box[0] + 28 - bounds[0], box[1] + 28 - bounds[1]), title, font=f, fill=CREAM)
    return {"boxPx": list(box), "glyphPx": [box[0] + 28, box[1] + 28, width, height], "paddingPx": 28}


def overview(source):
    image = background()
    plate_height = 880
    plate_width = round(source.width * plate_height / source.height)
    plate = source.resize((plate_width, plate_height), Image.Resampling.LANCZOS)
    image.paste(plate, (92, 91))  # Entire approved plate, including its border and output path.
    h = headline(image)
    draw = ImageDraw.Draw(image)
    rows = list(reversed(STAGES))
    panels = []
    for i, (name, detail, gate) in enumerate(rows):
        y = 182 + 162 * i
        stage_box = (730, y, 1386, y + 142)
        plaque(image, stage_box, red=name in ("Stage", "Execute"))
        draw = ImageDraw.Draw(image)
        title_text = draw_center(draw, (758, y + 27, 1358, y + 86), name, 55, LIGHT_GOLD, min_size=49)
        detail_text = draw_center(draw, (758, y + 77, 1358, y + 121), detail, 29, CREAM, min_size=26, bold=False)
        assert_padding(stage_box, title_text)
        assert_padding(stage_box, detail_text)
        gate_box = None
        if gate:
            gate_box = (1411, y + 25, 1850, y + 115)
            plaque(image, gate_box, red=gate in ("Human gate required", "Rollback path required"), radius=17)
            draw = ImageDraw.Draw(image)
            gate_text = draw_center(draw, gate_box, gate, 30, CREAM, min_size=26)
            assert_padding(gate_box, gate_text)
            draw.line((1388, y + 70, 1409, y + 70), fill=GOLD, width=7)
        panels.append({"stage": name, "detail": detail, "gate": gate, "stageBoxPx": list(stage_box), "stageTitle": title_text, "stageDetail": detail_text, "gateBoxPx": list(gate_box) if gate_box else None, "gateText": gate_text if gate else None})
    draw = ImageDraw.Draw(image)
    for i in range(4):
        top = 182 + 162 * i + 142
        bottom = 182 + 162 * (i + 1)
        draw.line((1058, bottom - 2, 1058, top + 10), fill=GOLD, width=9)
        draw.polygon(((1042, top + 16), (1074, top + 16), (1058, top - 9)), fill=GOLD)
        draw.ellipse((1048, bottom - 11, 1068, bottom + 9), fill=TEAL, outline=LIGHT_GOLD, width=3)
    return image, {"headline": h, "platePx": [92, 91, plate_width, plate_height], "panels": panels}


def focus(index, source):
    image = background()
    draw = ImageDraw.Draw(image)
    title = "Authority ladder"
    draw_center(draw, (80, 50, 1840, 120), title, 66, LIGHT_GOLD)
    names = [stage[0] for stage in STAGES]
    for i, name in enumerate(names):
        x = 98 + i * 349
        box = (x, 140, x + 303, 238)
        plaque(image, box, red=i >= 3 and i == index, radius=17, border=LIGHT_GOLD if i == index else "#60717a")
        draw = ImageDraw.Draw(image)
        breadcrumb = draw_center(draw, box, name, 38, CREAM if i == index else "#b4c2c3", min_size=34)
        assert_padding(box, breadcrumb)
        if i < 4:
            draw.line((x + 304, 189, x + 343, 189), fill=GOLD, width=7)
            draw.polygon(((x + 330, 179), (x + 348, 189), (x + 330, 199)), fill=GOLD)
    plate_height = 540
    plate_width = round(source.width * plate_height / source.height)
    plate_x, plate_y = 170, 284
    image.paste(source.resize((plate_width, plate_height), Image.Resampling.LANCZOS), (plate_x, plate_y))
    # The highlight identifies a rung on the intact source plate; no plate pixels are cropped.
    source_rung_y = [4414, 3566, 2720, 1862, 1016][index]
    highlight_y = plate_y + round(source_rung_y * plate_height / source.height)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((plate_x + 115, highlight_y - 15, plate_x + 246, highlight_y + 15), radius=7, outline=LIGHT_GOLD, width=5)
    name, detail, gate = STAGES[index]
    main = (545, 285, 1775, 824)
    plaque(image, main, red=name in ("Stage", "Execute"), radius=33)
    draw = ImageDraw.Draw(image)
    focus_title = draw_center(draw, (600, 328, 1720, 505), name, 126, LIGHT_GOLD, min_size=107)
    focus_detail = draw_center(draw, (600, 505, 1720, 639), detail, 72, CREAM, min_size=55, bold=False)
    assert_padding(main, focus_title)
    assert_padding(main, focus_detail)
    gate_box = None
    if gate:
        gate_box = (640, 662, 1680, 792)
        plaque(image, gate_box, red=gate in ("Human gate required", "Rollback path required"), radius=22)
        draw = ImageDraw.Draw(image)
        gate_text = draw_center(draw, gate_box, gate, 69, CREAM, min_size=57)
        assert_padding(gate_box, gate_text)
    else:
        # The approved plate has no gate at Prepare; keep that field empty.
        draw.line((840, 714, 1480, 714), fill=TEAL, width=8)
    return image, {"stage": name, "detail": detail, "gate": gate, "platePx": [plate_x, plate_y, plate_width, plate_height], "highlightCenterYPx": highlight_y, "stageBoxPx": list(main), "stageTitle": focus_title, "stageDetail": focus_detail, "gateBoxPx": list(gate_box) if gate_box else None, "gateText": gate_text if gate else None}


assert sha(SOURCE) == SOURCE_SHA
source = Image.open(SOURCE).convert("RGB")
assert source.size == (3000, 4700)
OUT.mkdir(parents=True, exist_ok=True)
frames = []
full, geometry = overview(source)
full_path = OUT / "overview-wide.png"
full.save(full_path)
frames.append({"kind": "overview", "path": str(full_path.relative_to(ROOT)), "sha256": sha(full_path), "geometry": geometry})
for index in range(len(STAGES)):
    art, geometry = focus(index, source)
    output = OUT / f"focus-{index + 1:02}-{STAGES[index][0].lower()}.png"
    art.save(output)
    frames.append({"kind": "focused-rung", "path": str(output.relative_to(ROOT)), "sha256": sha(output), "geometry": geometry})

contact = Image.new("RGB", (1170, 438), "#071b2a")
for index, frame in enumerate(frames):
    original = ROOT / frame["path"]
    preview = OUT / f"{original.stem}-mobile-preview.png"
    Image.open(original).convert("RGB").resize((390, 219), Image.Resampling.LANCZOS).save(preview)
    frame["mobilePreviewPath"] = str(preview.relative_to(ROOT))
    frame["mobilePreviewSha256"] = sha(preview)
    contact.paste(Image.open(preview), ((index % 3) * 390, (index // 3) * 219))
contact_path = OUT / "mobile-contact.png"
contact.save(contact_path)

receipt = {
    "status": "review_only_unbound",
    "sourcePath": str(SOURCE.relative_to(ROOT)),
    "sourceSha256": SOURCE_SHA,
    "sourcePx": [3000, 4700],
    "canvasPx": list(SIZE),
    "frameworkOrderBottomToTop": [stage[0] for stage in STAGES],
    "gateByRung": {name: gate for name, _, gate in STAGES if gate},
    "method": "complete approved plate plus provider-free raster recreation of its exact five-rung hierarchy and four gate labels; no source crop or SVG art",
    "frames": frames,
    "mobileContactPath": str(contact_path.relative_to(ROOT)),
    "mobileContactSha256": sha(contact_path),
}
(OUT / "frame-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(f"Rendered {len(frames)} review-only L06-03 raster frames")
