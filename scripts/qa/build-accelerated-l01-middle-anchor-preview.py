#!/usr/bin/env python3
"""Build still-only L01 middle-anchor layout evidence; never renders learner media."""
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate'
SOURCE = ROOT / 'public/accelerated/visual-parity/l01/visual-a70ed876/l01-visual-parity.mp4'
P01 = OUT / 'p01-reflow-base.png'
P02 = OUT / 'p02-clean-base.png'
ANCHOR = (1136, 348, 672, 384)
FONT_DIR = Path('/System/Library/Fonts/Supplemental')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fill_region(image, source, left, top, right, bottom, sample_left, sample_right):
    pixels = image.load()
    for y in range(top, bottom):
        a = source.getpixel((sample_left, y))
        b = source.getpixel((sample_right, y))
        for x in range(left, right):
            t = (x - left) / (right - left - 1)
            pixels[x, y] = tuple(round(v * (1 - t) + w * t) for v, w in zip(a, b))


def bases():
    p01_source = Image.open(P01).convert('RGB')
    p01 = p01_source.copy()
    fill_region(p01, p01_source, 615, 320, 1550, 850, 600, 1570)
    worksheet = p01_source.crop((620, 325, 1540, 852))
    # Keep the printed heading, field, and complete border. Remove 127px of
    # empty worksheet interior so the bottom edge clears narrow player controls.
    p01.paste(worksheet.crop((0, 0, 920, 280)), (100, 285))
    p01.paste(worksheet.crop((0, 407, 920, 527)), (100, 565))
    p01_path = OUT / 'p01-middle-base.png'
    p01.save(p01_path)

    p02_source = Image.open(P02).convert('RGB')
    p02 = p02_source.copy()
    fill_region(p02, p02_source, 180, 155, 1006, 835, 160, 1050)
    fill_region(p02, p02_source, 1100, 275, 1885, 725, 1080, 1895)
    fill_region(p02, p02_source, 1680, 40, 1865, 100, 1660, 1885)
    art = p02_source.crop((190, 165, 990, 830)).resize((760, 632), Image.Resampling.LANCZOS)
    p02.paste(art, (160, 130))
    draw = ImageDraw.Draw(p02)
    small = ImageFont.truetype(str(FONT_DIR / 'Arial Bold.ttf'), 34)
    title = ImageFont.truetype(str(FONT_DIR / 'Georgia Bold.ttf'), 57)
    sub = ImageFont.truetype(str(FONT_DIR / 'Arial.ttf'), 31)
    draw.text((1136, 155), 'WORKSHOP MAP', font=small, fill='#b88735')
    draw.text((1136, 215), 'Signals · Alignment', font=title, fill='#f5efe6')
    draw.text((1136, 282), 'Momentum', font=title, fill='#f5efe6')
    draw.text((1136, 85), 'Book parts: Systems · Align · Momentum', font=sub, fill='#d9e1e3')
    p02_path = OUT / 'p02-middle-base.png'
    p02.save(p02_path)
    return p01_path, p02_path


def presenter(at, crop_y):
    with tempfile.TemporaryDirectory(prefix='l01-middle-presenter-') as folder:
        path = Path(folder) / 'frame.png'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(at), '-i', str(SOURCE),
                        '-frames:v', '1', '-update', '1', str(path)], check=True)
        frame = Image.open(path).convert('RGB')
        return frame.crop((1420, crop_y, 1868, crop_y + 256)).resize(
            ANCHOR[2:], Image.Resampling.LANCZOS)


def review_still(base, face, label):
    source = Image.open(base).convert('RGB')
    draw = ImageDraw.Draw(source)
    draw.rectangle((ANCHOR[0]-4, ANCHOR[1]-4, ANCHOR[0]+ANCHOR[2]+4,
                    ANCHOR[1]+ANCHOR[3]+4), fill='#d9aa43')
    source.paste(face, ANCHOR[:2])
    scaled = source.resize((1280, 720), Image.Resampling.LANCZOS)
    desktop = Image.new('RGB', (1280, 820), '#0c202a')
    desktop.paste(scaled, (0, 0))
    d = ImageDraw.Draw(desktop)
    # Simulated native-control overlay, deliberately more conservative than the
    # observed Chrome strip; caption space is a distinct 100px band below video.
    d.rectangle((0, 674, 1280, 720), fill='#07141ccc')
    d.rectangle((25, 705, 1255, 708), fill='#f5f5f5')
    d.text((28, 681), 'Play   00:00 / 05:45', font=ImageFont.truetype(str(FONT_DIR / 'Arial.ttf'), 18), fill='white')
    d.text((38, 752), label, font=ImageFont.truetype(str(FONT_DIR / 'Arial Bold.ttf'), 28), fill='white')
    desktop_path = OUT / f'{label}-middle-desktop-controls.png'
    desktop.save(desktop_path)
    mobile = Image.new('RGB', (390, 844), 'black')
    mobile.paste(desktop.resize((390, 250), Image.Resampling.LANCZOS), (0, 297))
    # Chrome keeps a near-constant-height control layer as the video shrinks.
    # Simulate that mobile layer independently instead of scaling desktop UI.
    wash = Image.new('RGBA', mobile.size, (0, 0, 0, 0))
    shade = ImageDraw.Draw(wash)
    for y in range(455, 516):
        shade.line((0, y, 389, y), fill=(0, 0, 0, min(220, (y - 455) * 4)))
    shade.text((19, 478), 'Play  00:00 / 00:12',
               font=ImageFont.truetype(str(FONT_DIR / 'Arial.ttf'), 13), fill=(255, 255, 255, 255))
    shade.rectangle((18, 510, 372, 512), fill=(255, 255, 255, 255))
    mobile = Image.alpha_composite(mobile.convert('RGBA'), wash).convert('RGB')
    mobile_path = OUT / f'{label}-middle-390x844-controls.png'
    mobile.save(mobile_path)
    return desktop_path, mobile_path


def main():
    p01, p02 = bases()
    paths = [p01, p02]
    paths.extend(review_still(p01, presenter(24.4, 260), 'P01'))
    paths.extend(review_still(p02, presenter(240.5, 790), 'P02'))
    receipt = {
        'status': 'still_only_middle_anchor_proposal_render_held',
        'source_video_sha256': sha(SOURCE),
        'agentified_reference': {'source': 'agentified/workshop/l01-continuous-narration/render.mjs',
                                 'also': 'agentified/workshop/l05-l08-native-composite/render.mjs',
                                 'source_1920x1080_xywh': [1048, 326, 768, 432],
                                 'normalized_xywh': [0.5458, 0.3019, 0.4, 0.4],
                                 'observed': 'finished L01 at 5s and 520s, L05 at 5s and 590s, and L08 at 5s show a middle-right presenter'},
        'accelerated_existing_anchor_xywh': [1420, 48, 448, 256],
        'proposed_source_1920x1080_xywh': list(ANCHOR),
        'proposed_normalized_xywh': [0.5917, 0.3222, 0.35, 0.3556],
        'native_presenter_crop_xywh': [1420, 260, 448, 256],
        'native_p02_crop_xywh': [1420, 790, 448, 256],
        'layout': {'P01_worksheet_xywh': [100, 285, 920, 400],
                   'P01_blank_interior_removed_source_px': 127,
                   'P01_worksheet_bottom_to_mobile_control_guard_source_px': 770 - 685,
                   'P02_map_xywh': [160, 130, 760, 632],
                   'P02_title': 'redrawn above presenter; all source wording retained',
                   'P02_book_parts': 'source x=1136,y=85 above workshop title; source wording retained',
                   'presenter_bottom_to_control_guard_source_px': 920 - (ANCHOR[1] + ANCHOR[3]),
                   'map_bottom_to_control_guard_source_px': 920 - 762,
                   'caption_band_review_y_px': [720, 820]},
        'observed_still_review': {
            'desktop': 'P01 worksheet and P02 map occupy the left teaching column; title and presenter occupy the right without overlap. P02 map footer and book-parts line remain above the simulated control strip.',
            '390x844': 'Presenter, main title, map silhouette, worksheet field and full lower border, and map footer remain visible above a simulated Chrome-sized control layer; detailed infographic labels are too small to serve as standalone mobile reading text.',
            'visual_balance': 'P01 card center is near the presenter center; P02 map was lowered to y=130 and its title sits above the middle-right presenter. Neither scene rests wholly at the top.',
            'reading_boundary': 'The narration and large title must carry the one-second message on mobile; map micro-label comprehension remains a later scene-specific illustration gate.'},
        'stills': {path.name: sha(path) for path in paths},
        'limits': ['Controls in stills are simulated; actual Chrome playback needs the single authorized render.',
                   'Presenter is enlarged from a 448x256 native crop; inspect softness at full size.',
                   'No audio, captions, learner media, or binding changed.']
    }
    (OUT / 'middle-anchor-layout-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print('middle-anchor stills:', ', '.join(path.name for path in paths))


if __name__ == '__main__':
    main()
