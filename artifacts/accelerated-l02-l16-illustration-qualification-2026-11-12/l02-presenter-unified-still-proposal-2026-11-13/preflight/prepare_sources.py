#!/usr/bin/env python3
"""Prepare clean deterministic desktop/portrait sources for a paired review render."""
from hashlib import sha256
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageFilter

ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
PRE=OUT/'preflight'
A=ROOT/'artifacts/accelerated-l02-l16-illustration-qualification-2026-11-12'
OLD=A/'l02-full-corrected-local-review-2026-11-13'
C01=A/'l02-c01-three-state-still-correction-2026-11-13'
C02=A/'l02-c02-flat-matte-diverse-stills-2026-11-13'
SOURCES={
 'board-wide':A/'l02-01-board-wide.png',
 'board-focus':A/'l02-01-board-focus.png',
 'signals':A/'l02-02-signals-plate-1920x1080.png',
 'presenter-background':OLD/'presenter-clean-book.png',
}
NAVY=(12,35,51);PAPER=(248,241,226);GOLD=(216,183,116)

def h(p):return sha256(p.read_bytes()).hexdigest()
def fit(src,box,size):return ImageOps.fit(src.crop(box),size,method=Image.Resampling.LANCZOS)

def board_wide(src):
    bg=ImageOps.fit(src,(390,844),method=Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(35))
    full=src.resize((390,219),Image.Resampling.LANCZOS)
    bg.paste(full,(0,0))
    focus=fit(src,(545,135,1550,1010),(390,625))
    bg.paste(focus,(0,219))
    return bg

def board_focus(src):
    bg=Image.new('RGB',(390,844),NAVY)
    upper=fit(src,(170,0,1750,290),(390,208))
    lower=fit(src,(500,180,1490,1060),(390,636))
    bg.paste(upper,(0,0));bg.paste(lower,(0,208))
    return bg

def signals(src):
    return fit(src,(650,0,1270,1080),(390,844))

def clean_legacy(src,size,cut_y):
    # Only the documented faux-control strip is removed. No live player
    # control is drawn into the encoded picture.
    return src.crop((0,0,size[0],cut_y)).resize(size,Image.Resampling.LANCZOS)

def presenter_background(src):
    im=Image.new('RGB',(390,844),PAPER)
    d=ImageDraw.Draw(im)
    d.rectangle((0,0,390,12),fill=GOLD)
    cover=fit(src,(195,104,682,811),(188,259))
    im.paste(cover,(101,18))
    d.rectangle((0,279,390,844),fill=NAVY)
    d.rectangle((0,279,390,283),fill=GOLD)
    # Native footage is composited at y=294..754. The lower area remains
    # genuine background so native controls can occupy the final 72 pixels.
    return im

def main():
    PRE.mkdir(exist_ok=True)
    out={}
    def save(name,im,source):
        p=PRE/f'{name}.png';im.save(p,optimize=True)
        out[name]={'path':str(p.relative_to(ROOT)),'sha256':h(p),
            'dimensions':list(im.size),'derived_from':str(source.relative_to(ROOT)),
            'source_sha256':h(source)}
    for name,p in SOURCES.items():
        src=Image.open(p).convert('RGB')
        if name=='board-wide':save('board-wide-portrait',board_wide(src),p)
        elif name=='board-focus':save('board-focus-portrait',board_focus(src),p)
        elif name=='signals':save('signals-portrait',signals(src),p)
        else:save('presenter-background-portrait',presenter_background(src),p)
    for key in ('welcome','task','dashboard'):
        p=C01/f'{key}-desktop-1920x1080-clean.png';src=Image.open(p).convert('RGB')
        save(f'c01-{key}-desktop-clean',clean_legacy(src,(1920,1080),1031),p)
        p=C01/f'{key}-mobile-390x844-clean.png';src=Image.open(p).convert('RGB')
        save(f'c01-{key}-portrait-clean',clean_legacy(src,(390,844),774),p)
    for key in ('customer','company','competition','product'):
        p=C02/f'{key}-1920x1080-clean.png';src=Image.open(p).convert('RGB')
        save(f'c02-{key}-desktop-clean',clean_legacy(src,(1920,1080),1031),p)
        p=C02/f'{key}-390x844-clean.png';src=Image.open(p).convert('RGB')
        save(f'c02-{key}-portrait-clean',clean_legacy(src,(390,844),805),p)
    (PRE/'source-map.json').write_text(json.dumps({'status':'PREFLIGHT_ONLY_NO_VIDEO',
        'method':'Deterministic crop, fit, and native-player mock strip exclusion from approved prior stills; no new semantic art.',
        'outputs':out},indent=2)+'\n')
    print(f'{len(out)} prepared stills; no video')

if __name__=='__main__':main()
