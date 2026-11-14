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
    focus_background = p02.copy()
    art = p02_source.crop((190, 165, 990, 830)).resize((530, 440), Image.Resampling.LANCZOS)
    p02.paste(art, (275, 320))
    p02_path = OUT / 'p02-middle-base.png'
    p02.save(p02_path)
    # Use only enlarged crops from the owned SAM plate. The opening whole-map
    # view preserves context; the three native headings then become readable.
    focus_crops = {
        'signals': (230, 250, 450, 400),
        'alignment': (480, 250, 700, 400),
        'momentum': (725, 250, 945, 400),
    }
    for name, box in focus_crops.items():
        focused = focus_background.copy()
        focused.paste(p02_source.crop(box).resize((600, 409), Image.Resampling.LANCZOS), (240, 335))
        focused.save(OUT / f'p02-focus-{name}-base.png')
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
    for name in ('signals', 'alignment', 'momentum'):
        paths.extend(review_still(OUT / f'p02-focus-{name}-base.png',
                                  presenter(240.5, 790), f'P02-{name}'))
    receipt = {
        'status': 'still_only_middle_anchor_proposal_render_held',
        'source_video_sha256': sha(SOURCE),
        'agentified_reference': {'source': 'agentified/workshop/l01-continuous-narration/render.mjs',
                                 'also': 'agentified/workshop/l05-l08-native-composite/render.mjs',
                                 'source_1920x1080_xywh': [1048, 326, 768, 432],
                                 'normalized_xywh': [0.5458, 0.3019, 0.4, 0.4],
                                 'observed': 'finished L01 at 5s and 520s, L05 at 5s and 590s, and L08 at 5s show a middle-right presenter'},
        'agentified_text_hierarchy_reference': [
            {'source': 'public/agentified/lessons/l01/continuous-10f9ea26/agentified-l01-continuous-narration-composite.mp4',
             'sha256': '10f9ea26a7cd270610c497122cac90bed090995d9f14a0b01c137f89dfe7ae14',
             'sample_seconds': [5, 40, 250], 'finding': 'one teaching sentence beside presenter; cutaway adds owner context and operating-file artifact; timed exercise uses one number and instruction'},
            {'source': 'agentified/workshop/l05-l08-native-composite/agentified-l05-native-composite.mp4',
             'sha256': '5dfd073aa0b22fa724cd13ebdb7b43799b1ffe3db5a20ee1d72babba1438d4d1',
             'sample_seconds': [5, 90, 100], 'finding': 'one main point and short context; 100s two-line workflow headline above text card is a density caution'},
            {'source': 'public/agentified/lessons/l08/continuous-3c5b399f/agentified-l08-continuous-narration-composite.mp4',
             'sha256': '3c5b399f0dbebc9cddb8de3cd15cd06a8eda92a5ff5d3add1c11e5a4df5a9648',
             'sample_seconds': [5, 90], 'finding': 'headline hierarchy is clear, but text-led cutaway alone does not qualify Accelerated illustration'}],
        'accelerated_existing_anchor_xywh': [1420, 48, 448, 256],
        'proposed_source_1920x1080_xywh': list(ANCHOR),
        'proposed_normalized_xywh': [0.5917, 0.3222, 0.35, 0.3556],
        'native_presenter_crop_xywh': [1420, 260, 448, 256],
        'native_p02_crop_xywh': [1420, 790, 448, 256],
        'layout': {'P01_worksheet_xywh': [100, 285, 920, 400],
                   'P01_blank_interior_removed_source_px': 127,
                   'P01_worksheet_bottom_to_mobile_control_guard_source_px': 770 - 685,
                   'P02_map_xywh': [275, 320, 530, 440],
                   'P02_focus_source_crops_xyxy': {'signals': [230, 250, 450, 400],
                                                   'alignment': [480, 250, 700, 400],
                                                   'momentum': [725, 250, 945, 400]},
                   'P02_focus_destination_xywh': [240, 335, 600, 409],
                   'P02_presenter_centerline_y': ANCHOR[1] + ANCHOR[3] / 2,
                   'P02_map_centerline_y': 320 + 440 / 2,
                   'P02_focus_centerline_y': 335 + 409 / 2,
                   'P02_focus_optical_offset_y': -0.5,
                   'P02_overlays_removed': ['WORKSHOP MAP', 'Signals · Alignment · Momentum',
                                            'Book parts: Systems · Align · Momentum'],
                   'P02_source_art_text': 'preserved inside the original map crop',
                   'presenter_bottom_to_control_guard_source_px': 920 - (ANCHOR[1] + ANCHOR[3]),
                   'map_bottom_to_control_guard_source_px': 920 - 760,
                   'focus_bottom_to_control_guard_source_px': 920 - 744,
                   'caption_band_review_y_px': [720, 820]},
        'observed_still_review': {
            'desktop': 'P02 whole map centerline y=540 matches fixed presenter centerline; each focused crop centerline y=539.5. No duplicate heading overlay; source map footer clears simulated controls.',
            '390x844': 'Focused source-art headings require actual-player readability review; simulated controls only establish preliminary clearance.',
            'visual_balance': 'P02 art and middle-right presenter share the same vertical centerline; P01 remains a separate pacing-review work surface.',
            'P01_teaching_idea': 'The blank decision field makes the named blank document visible; full scene illustration remains open.',
            'reading_boundary': 'Whole-map micro-labels failed the prior 390px gate; enlarged native source-art headings require a single short-reel check before any readiness claim.'},
        'stills': {path.name: sha(path) for path in paths},
        'limits': ['Controls in stills are simulated; actual Chrome playback needs the single authorized render.',
                   'Presenter is enlarged from a 448x256 native crop; inspect softness at full size.',
                   'No audio, captions, learner media, or binding changed.']
    }
    (OUT / 'middle-anchor-layout-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print('middle-anchor stills:', ', '.join(path.name for path in paths))


if __name__ == '__main__':
    main()
