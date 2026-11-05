#!/usr/bin/env python3
"""Build source-bound Accelerated lesson posters. Requires Pillow and FFmpeg."""
import hashlib
import json
import subprocess
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/accelerated/posters'
MANIFEST = ROOT / 'docs/qa/accelerated-video-posters/source-map.json'
TITLES = [
    'Build smarter, stay human', 'Prioritize before generating', 'Answer-driven discovery',
    'Build small; keep personas alive', 'From feedback to signal', 'Roadmap to PRD, without drift',
    'Commit to learning', 'Metrics and the ten-part learning plan', 'Map the decision theater',
    'Influence before impact', 'From the shift to a repeatable loop', 'Jobs and synthetic signals',
    'Strategic shifts and future concepts', 'The last mile of influence',
    'Governance and the system that learns', 'What comes next',
]
SHORT = [
    'BUILD SMARTER\nSTAY HUMAN', 'PRIORITIZE\nFIRST', 'ASK BETTER\nQUESTIONS',
    'KEEP PERSONAS\nALIVE', 'FIND THE\nSIGNAL', 'ROADMAP\nTO PRD',
    'COMMIT TO\nLEARNING', 'MEASURE\nWHAT MATTERS', 'MAP THE\nDECISION',
    'INFLUENCE\nBEFORE IMPACT', 'BUILD A\nLEARNING LOOP', 'JOBS +\nSIGNALS',
    'TEST THE\nFUTURE', 'THE LAST MILE\nOF INFLUENCE', 'GOVERN THE\nLEARNING', 'WHAT COMES\nNEXT',
]
ACTS = ['SIGNALS'] * 4 + ['ALIGNMENT'] * 6 + ['MOMENTUM'] * 4 + ['SYNTHESIS'] * 2
COLORS = {'SIGNALS': '#e7b75f', 'ALIGNMENT': '#76c9c7', 'MOMENTUM': '#f29677', 'SYNTHESIS': '#b6adf4'}
ART = {
    'SIGNALS': 'public/showcases/service-prototypes/v2/sam-signals-plate.webp',
    'ALIGNMENT': 'public/showcases/service-prototypes/v2/sam-alignment-plate.webp',
    'MOMENTUM': 'public/showcases/service-prototypes/v2/sam-momentum-plate.webp',
    'SYNTHESIS': 'public/showcases/service-prototypes/accelerated-sam-infographic.png',
}
SPECIAL = {1: 'public/accelerated_cover_ebook.webp', 5: 'public/showcases/accelerated-learning-plan/storyboard-l05.png', 8: 'public/showcases/accelerated-learning-plan/storyboard-l08.png', 11: 'public/showcases/accelerated-learning-plan/storyboard-l11.png', 16: 'public/showcases/accelerated-learning-plan/storyboard-l16.png'}
FONT = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
REG = '/System/Library/Fonts/Supplemental/Arial.ttf'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def frame(path, seconds):
    raw = subprocess.check_output(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-ss', str(seconds), '-i', str(path), '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'])
    return Image.open(BytesIO(raw)).convert('RGB')

def fit(im, box):
    return ImageOps.fit(im, box, method=Image.Resampling.LANCZOS, centering=(0.5, 0.46))

def draw_poster(index):
    lid = f'L{index:02d}'
    videos = list((ROOT / f'public/accelerated/lessons/l{index:02d}').glob('*/*native-composite.mp4'))
    if len(videos) != 1: raise RuntimeError(f'{lid}: expected one exact learner composite, found {len(videos)}')
    video = videos[0]
    video_hash = sha(video)
    expected = video.parent.name.split('-')[-1]
    if video_hash[:8] != expected: raise RuntimeError(f'{lid}: video source hash drift')
    act = ACTS[index-1]
    art = ROOT / SPECIAL.get(index, ART[act])
    if not art.exists(): raise RuntimeError(f'{lid}: missing first-party art')
    seconds = {1: 11, 2: 8.9, 3: 17, 4: 14, 5: 9, 6: 13, 7: 15, 8: 24, 9: 9.8, 10: 17.5, 11: 20, 12: 16, 13: 22, 14: 9.25, 15: 21, 16: 17.25}[index]
    still = frame(video, seconds)
    # Presenter region from the approved composite; L01 uses a small inset and stays art-led.
    face = still.crop((1400, 225, 1870, 590)) if index == 1 else still.crop((990, 165, 1895, 615))
    art_led = index in (1, 4, 8, 12, 16)
    side_right = index % 2 == 1 or art_led
    canvas = Image.new('RGB', (1280, 720), '#09212a')
    d = ImageDraw.Draw(canvas)
    face_box = (678, 62, 1230, 657) if side_right else (50, 62, 602, 657)
    if art_led: face_box = (985, 318, 1225, 657)
    fx0, fy0, fx1, fy1 = face_box
    # ImageOps fit retains the source pixels and identity without face generation or retouching.
    face_im = fit(face, (fx1-fx0, fy1-fy0))
    canvas.paste(face_im, (fx0, fy0))
    d = ImageDraw.Draw(canvas)
    d.rectangle((fx0, fy0, fx1, fy1), outline=COLORS[act], width=5)
    text_x = 58 if side_right else 690
    text_w = 580 if side_right else 535
    d.text((text_x, 58), 'AMADUTOWN  /  ACCELERATED', font=ImageFont.truetype(REG, 24), fill='#f5ede0')
    d.rounded_rectangle((text_x, 116, text_x + 172, 166), radius=10, fill=COLORS[act])
    d.text((text_x + 15, 125), f'LESSON {index:02d}', font=ImageFont.truetype(FONT, 26), fill='#082027')
    d.text((text_x, 189), act, font=ImageFont.truetype(FONT, 25), fill=COLORS[act])
    lines = SHORT[index-1].split('\n')
    size = 60
    while size > 44 and any(d.textbbox((0,0), line, font=ImageFont.truetype(FONT, size))[2] > text_w for line in lines): size -= 2
    title_font = ImageFont.truetype(FONT, size)
    y = 240
    for line in lines:
        d.text((text_x, y), line, font=title_font, fill='#fffaf1', stroke_width=0)
        y += size + 12
    # A small first-party SAM or lesson storyboard proof card anchors each cover to the lesson.
    art_im = Image.open(art).convert('RGB')
    if art_led:
        art_box = (700, 100, 965, 657)
        art_im = fit(art_im, (265, 557))
        canvas.paste(art_im, (700, 100))
        d = ImageDraw.Draw(canvas)
        d.rectangle(art_box, outline=COLORS[act], width=4)
        d.text((text_x, 540), 'BOOK + SAM FRAMEWORK' if index == 1 else 'LESSON ARTIFACT  /  SAM', font=ImageFont.truetype(FONT, 22), fill=COLORS[act])
    else:
        art_box = (text_x, 492, text_x + 166, 646)
        art_im = fit(art_im, (166,154))
        canvas.paste(art_im, (text_x, 492))
        d = ImageDraw.Draw(canvas)
        d.rectangle(art_box, outline=COLORS[act], width=3)
        d.text((text_x + 184, 520), 'THE SAM\nLEARNING PLAN' if index not in SPECIAL else 'LESSON\nARTIFACT', font=ImageFont.truetype(FONT, 23), fill='#fffaf1', spacing=6)
    d.rectangle((50, 680, 1230, 684), fill=COLORS[act])
    output = OUT / f'{lid.lower()}-poster.webp'
    canvas.save(output, 'WEBP', quality=92, method=6)
    return {'lesson': lid, 'title': TITLES[index-1], 'act': act, 'presenterSource': str(video.relative_to(ROOT)), 'presenterSourceSha256': video_hash, 'presenterStillSeconds': seconds, 'presenterSourceKind': 'approved native learner composite', 'samOrBookAsset': str(art.relative_to(ROOT)), 'samOrBookAssetSha256': sha(art), 'output': str(output.relative_to(ROOT)), 'outputSha256': sha(output), 'dimensions': [1280, 720], 'privacyRightsStatus': 'First-party approved learner composite and first-party SAM or lesson artwork; no generated identity', 'visualReview': {'eyesOpen': True, 'mouthState': 'composed or slight smile', 'motionBlur': False, 'duplicatePose': False}}

if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    entries = [draw_poster(i) for i in range(1, 17)]
    MANIFEST.write_text(json.dumps({'schemaVersion': 1, 'posters': entries}, indent=2) + '\n')
    print(f'Built {len(entries)} source-bound posters')
