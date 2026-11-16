#!/usr/bin/env python3
"""Render one receipt-bound local L02 presenter review pair; never retry or overwrite."""
from hashlib import sha256
import json
from pathlib import Path
import shutil
import subprocess
import sys

from PIL import Image, ImageDraw
from build_native_frame_stills import (
    SCENES, SOURCE_ART, VIDEO_BOX,
    background, illustrated_field, motif, tx, GOLD, PAPER, WHITE,
)

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
A=HERE.parent
PRIOR=A/'l02-c01-corrected-paired-local-review-2026-11-13'
NATIVE=ROOT/'docs/accelerated-course-modules/l02-native-composite/accelerated-l02-heygen-native.mp4'
AUDIO=A/'l02-full-corrected-local-review-2026-11-13/work/source-aligned-audio.wav'
CAPTIONS=PRIOR/'l02-optional-captions.vtt'
RECEIPT=HERE/'receipt-v2-native-frame.json'
OUT=HERE/'motion-review-2026-11-13'
WORK=OUT/'work'
ATTEMPT=OUT/'render-attempt.json'
OUTS={'desktop':OUT/'l02-presenter-desktop-review-1920x1080.mp4',
      'portrait':OUT/'l02-presenter-portrait-review-390x844.mp4'}
EXPECTED={
    'still_receipt':'54e4010643f877e290e4c8bbdb1097baffbc9ff705fd9c94f5dfe71d539cdb4a',
    'native':'2beae8254c76a6f8bf168afb8483e83e63c13b621ec3934c81397d3167cd1a3d',
    'audio':'54676d5d74e880828d3397d4650525ad12f873867904013782c6176cd0d65560',
    'captions':'6d1ec9a1b64a1a05aa884a17a5f1e795b16986519c84cfd366e970fdd9dc0803',
    'prior_desktop':'e0713b41a1ec50251df98e4cf6dadb38c4beb370595fa534f0f1af3f2a417d74',
    'prior_portrait':'86cefb8416ec86ee25abcdad5c2e8b68260a99eddaed12d082d95afb8cc89290',
}
SEGMENTS={
    'P01':{'lo':0,'hi':545,'frames':545,'start':0},
    'P02':{'lo':545,'hi':879,'frames':357,'start':2888},
    'P03':{'lo':879,'hi':1276,'frames':397,'start':5930},
    'question-bridge':{'lo':1276,'hi':1356,'frames':80,'start':9561},
    'P04':{'lo':1356,'hi':1690,'frames':334,'start':9641},
}

def digest(path):
    h=sha256()
    with open(path,'rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()

def run(cmd):subprocess.run(cmd,check=True,cwd=ROOT)

def preflight():
    if OUT.exists():raise SystemExit('render folder already exists; no retry or overwrite')
    if digest(RECEIPT)!=EXPECTED['still_receipt']:raise SystemExit('approved still receipt drift')
    r=json.loads(RECEIPT.read_text())
    if r['status']!='still_only_candidate_for_captain_review':raise SystemExit('still receipt status drift')
    if len(r['outputs'])!=20:raise SystemExit('still output count drift')
    for row in r['outputs']:
        p=HERE/row['file']
        if digest(p)!=row['sha256']:raise SystemExit(f'still drift: {p}')
    for name,row in r['source_art'].items():
        if digest(ROOT/row['path'])!=row['sha256']:raise SystemExit(f'plate drift: {name}')
    for path,key in [(NATIVE,'native'),(AUDIO,'audio'),(CAPTIONS,'captions'),
        (PRIOR/'l02-c01-corrected-desktop-review-1920x1080.mp4','prior_desktop'),
        (PRIOR/'l02-c01-corrected-portrait-review-390x844.mp4','prior_portrait')]:
        if digest(path)!=EXPECTED[key]:raise SystemExit(f'source drift: {key}')
    parts={}
    for aspect in OUTS:
        ls=(PRIOR/'work'/aspect/'parts.ffconcat').read_text().splitlines()
        if len(ls)!=71:raise SystemExit(f'prior segment count drift: {aspect}')
        paths=[Path(line.removeprefix("file '").removesuffix("'")) for line in ls]
        if any(not p.exists() for p in paths):raise SystemExit(f'missing prior part: {aspect}')
        for name in SEGMENTS:
            found=[i for i,p in enumerate(paths) if p.stem.endswith('-'+name)]
            if len(found)!=1:raise SystemExit(f'presenter part lookup drift: {aspect}/{name}')
        parts[aspect]=paths
    return r,parts

def backdrop(name,portrait):
    scene=next(row for row in SCENES if row[0]==name)
    _,_,title,subtitle,kind=scene
    im=illustrated_field(name,portrait) if name in SOURCE_ART else background(portrait)
    d=ImageDraw.Draw(im,'RGBA')
    if portrait:
        tx(d,(20,28),'AMADUTOWN  /  ACCELERATED',17,GOLD,True)
        d.line((20,60,370,60),fill=GOLD,width=1)
        tx(d,(20,89),title,30,WHITE,True)
        sub=subtitle if len(subtitle)<=33 else subtitle[:30].rstrip()+'…'
        tx(d,(21,131),sub,18,PAPER)
    else:
        tx(d,(90,62),'AMADUTOWN  /  ACCELERATED',27,GOLD,True)
        d.line((90,104,770,104),fill=GOLD,width=2)
        tx(d,(90,170),title,70,WHITE,True)
        tx(d,(92,265),subtitle,36,PAPER)
    if name not in SOURCE_ART:motif(d,kind,portrait)
    return im.convert('RGB')

def check_backdrop_matches_still(name,aspect,im):
    portrait=aspect=='portrait';w,h=im.size
    clean=Image.open(HERE/'stills-v2-native-frame'/f'{name}-{aspect}-clean.png').convert('RGB')
    x0,y0,x1,y1=VIDEO_BOX[portrait]
    control_top=798 if portrait else 1035
    boxes=[(0,0,w,y0-2),(0,y0-2,x0-2,y1+2),(x1+2,y0-2,w,y1+2),(0,y1+2,w,control_top)]
    for box in boxes:
        if im.crop(box).tobytes()!=clean.crop(box).tobytes():
            raise SystemExit(f'backdrop differs from approved still: {name}/{aspect}/{box}')

def render_part(name,aspect,picture):
    s=SEGMENTS[name];portrait=aspect=='portrait'
    x0,y0,x1,y1=VIDEO_BOX[portrait]
    w,h=(390,844) if portrait else (1920,1080)
    line=1 if portrait else 2
    filt=(f'[0:v]scale={w}:{h},setsar=1[bg];'
          f'[1:v]trim=start_frame={s["lo"]}:end_frame={s["hi"]},setpts=PTS-STARTPTS,'
          f'scale={x1-x0}:{y1-y0},setsar=1[fg];'
          f'[bg][fg]overlay={x0}:{y0}:shortest=0:eof_action=repeat,'
          f'drawbox=x={x0-1}:y={y0-1}:w={x1-x0+2}:h={y1-y0+2}:color=0xDDB04C:t={line},'
          'format=yuv420p[v]')
    part=WORK/aspect/f'{name}.mp4'
    run(['ffmpeg','-v','error','-n','-loop','1','-framerate','25','-i',str(picture),
         '-i',str(NATIVE),'-filter_complex',filt,'-map','[v]','-an',
         '-frames:v',str(s['frames']),'-r','25','-c:v','libx264','-preset','ultrafast',
         '-crf','21','-pix_fmt','yuv420p',str(part)])
    print(f'{aspect} {name}: {s["frames"]} frames',flush=True)
    return part

def render(aspect,prior_parts):
    portrait=aspect=='portrait';wd=WORK/aspect;wd.mkdir(parents=True)
    replacements={}
    for name in SEGMENTS:
        bg=backdrop(name,portrait)
        check_backdrop_matches_still(name,aspect,bg)
        picture=wd/f'{name}-background.png';bg.save(picture,optimize=True)
        replacements[name]=render_part(name,aspect,picture)
    parts=[]
    for p in prior_parts:
        match=next((name for name in SEGMENTS if p.stem.endswith('-'+name)),None)
        parts.append(replacements[match] if match else p)
    listing=wd/'parts.ffconcat'
    listing.write_text(''.join(f"file '{p.resolve()}'\n" for p in parts))
    base=wd/'base.mp4'
    run(['ffmpeg','-v','error','-n','-f','concat','-safe','0','-i',str(listing),'-c','copy',str(base)])
    run(['ffmpeg','-v','error','-n','-i',str(base),'-i',str(AUDIO),'-map','0:v:0','-map','1:a:0',
         '-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-ac','1',
         '-movflags','+faststart','-shortest',str(OUTS[aspect])])
    return {'sha256':digest(OUTS[aspect]),'path':str(OUTS[aspect].relative_to(ROOT)),
            'replaced_parts':{k:digest(v) for k,v in replacements.items()}}

def main():
    r,parts=preflight()
    OUT.mkdir(parents=True)
    data={'status':'IN_PROGRESS_NO_RETRY','approved_still_receipt_sha256':EXPECTED['still_receipt'],
          'source_hashes':EXPECTED,'fps':25,'frames':10090,'seconds':403.6,
          'presenter_segments':SEGMENTS,'outputs':{},
          'excluded':['HeyGen','speech generation','spending','learner media','PR #1270','merge','deployment','publication','release']}
    ATTEMPT.write_text(json.dumps(data,indent=2)+'\n')
    for aspect in OUTS:
        data['outputs'][aspect]=render(aspect,parts[aspect])
        ATTEMPT.write_text(json.dumps(data,indent=2)+'\n')
    shutil.copyfile(CAPTIONS,OUT/'l02-optional-captions.vtt')
    data['status']='RENDERED_UNVERIFIED'
    ATTEMPT.write_text(json.dumps(data,indent=2)+'\n')
    print(json.dumps(data['outputs'],indent=2),flush=True)

if __name__=='__main__':main()
