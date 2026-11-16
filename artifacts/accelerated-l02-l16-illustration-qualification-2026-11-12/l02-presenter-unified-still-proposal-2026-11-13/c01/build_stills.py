#!/usr/bin/env python3
"""Still-only C01 visual correction. No video rendering or existing media writes."""
from hashlib import sha256
import json
from pathlib import Path
import re
from PIL import Image, ImageDraw, ImageFont

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
SOURCE=OUT/'source-art'
PAIRED=OUT.parent/'l02-paired-local-review-2026-11-13'
WORDS=OUT.parent/'l02-narration-job-pack/l02-j01-provider-words-aede32ab14e6484ca8fb74c9381ce532.json'
VTT=PAIRED/'l02-optional-captions.vtt'
FONT='/System/Library/Fonts/Avenir Next.ttc'
NAVY=(12,39,52)
CREAM=(255,248,231)
GOLD=(177,116,37)

# Start frames are rounded from the qualified J01 provider word start + 21.802667 s.
# The inherited macro boundaries remain [545,970), [970,1440), [1440,2534).
STATES=[
 ('board-opening',545,557,'board','?', 'Opening board; before Chapter Two utterance'),
 ('board-chapter',557,608,'board','Chapter Two','Chapter at 22.271667 s'),
 ('board-meeting',608,643,'board','Planning meeting','planning at 24.319667 s'),
 ('board-question',643,813,'board','What the team cannot afford to get wrong?','what at 25.727667 s'),
 ('board-first-minutes',813,970,'board',"The first minutes of a new user's experience",'first at 32.511667 s'),
 ('focus-question',970,991,'focus','What the team cannot afford to get wrong?','carried from board-question'),
 ('focus-step-away',991,1027,'focus','Step away from the list','step at 39.643667 s'),
 ('focus-consequence',1027,1094,'focus','Name the consequence of a wrong choice','name at 41.089667 s'),
 ('focus-decision-file',1094,1297,'focus','Open the decision file','Open at 43.741667 s'),
 ('focus-whose',1297,1376,'focus','Whose experience or business result is at stake?','Whose at 51.861667 s'),
 ('focus-teach',1376,1440,'focus','What would a choice teach you?','What at 55.021667 s'),
 ('wayfinding-opening',1440,1447,'list','','pre-utterance bridge'),
 ('wayfinding-list-fair',1447,1597,'list','A long list can feel fair','A at 57.881667 s'),
 ('wayfinding-first',1597,1648,'list','Which problem to solve first?','which at 63.871667 s'),
 ('wayfinding-why',1648,1685,'list','It cannot tell you why','cannot at 65.921667 s'),
 ('wayfinding-trap',1685,1745,'list','That is the trap','That at 67.411667 s'),
 ('wayfinding-information',1745,1846,'list','More information','More at 69.791667 s'),
 ('wayfinding-untouched',1846,1910,'list','The actual decision untouched','actual at 73.841667 s'),
 ('wayfinding-airport',1910,2032,'wayfinding','Airport signage','airport at 76.401667 s'),
 ('wayfinding-next',2032,2092,'wayfinding','Where to go next','where at 81.301667 s'),
 ('wayfinding-clear',2092,2196,'wayfinding','Make that clear','make at 83.661667 s'),
 ('wayfinding-product',2196,2265,'wayfinding','A product meeting','product at 87.841667 s'),
 ('wayfinding-ideas',2265,2311,'wayfinding','Twenty feature ideas','twenty at 90.601667 s'),
 ('wayfinding-path',2311,2534,'wayfinding','What path is the person trying to find?','what at 92.441667 s'),
]

def digest(p):
    h=sha256()
    with open(p,'rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()

def font(size,bold=True):
    return ImageFont.truetype(FONT,size,index=0 if bold else 7)

def contain_text(draw,text,box,max_size,min_size,fill):
    if not text:return
    l,t,r,b=box;w=r-l;h=b-t
    for size in range(max_size,min_size-1,-1):
        ft=font(size)
        words=text.split();lines=[];line=''
        for word in words:
            candidate=(line+' '+word).strip()
            if draw.textbbox((0,0),candidate,font=ft)[2] <= w:line=candidate
            else:
                if line:lines.append(line)
                line=word
        if line:lines.append(line)
        line_h=int(size*1.15)
        if len(lines)*line_h <= h and all(draw.textbbox((0,0),q,font=ft)[2] <= w for q in lines):break
    total=len(lines)*line_h
    y=t+(h-total)//2
    for line in lines:
        bb=draw.textbbox((0,0),line,font=ft)
        x=l+(w-(bb[2]-bb[0]))//2
        draw.text((x,y),line,font=ft,fill=fill,stroke_width=0)
        y+=line_h

def base(kind,aspect):
    src=SOURCE/f'{"board" if kind in ("board","focus") else kind}-{aspect}.png'
    im=Image.open(src).convert('RGB')
    if kind=='focus' and aspect=='desktop':
        im=im.crop((270,165,1400,801))
    size=(1920,1080) if aspect=='desktop' else (390,844)
    return im.resize(size,Image.Resampling.LANCZOS)

def clean(kind,aspect,label):
    im=base(kind,aspect);d=ImageDraw.Draw(im)
    if kind in ('board','focus'):
        if aspect=='desktop':
            box=(660,414,1260,625) if kind=='board' else (470,300,1450,660)
            mx=65 if kind=='board' else 85
        else:
            box=(36,358,354,488)
            mx=30
        contain_text(d,label,box,mx,18,NAVY)
    else:
        if aspect=='portrait':
            # The generated sign has corner rays; keep text clear of them.
            d.rounded_rectangle((46,37,344,104),radius=17,fill=NAVY)
            box=(58,42,332,100)
        else:
            box=(185,66,1735,226)
        contain_text(d,label,box,72 if aspect=='desktop' else 25,16,CREAM)
    return im

def parse_vtt():
    blocks=[]
    def sec(s):
        h,m,rest=s.split(':');return int(h)*3600+int(m)*60+float(rest)
    for m in re.finditer(r'(\d\d:\d\d:\d\d\.\d+) --> (\d\d:\d\d:\d\d\.\d+)\n([^\n]+(?:\n(?!\n)[^\n]+)*)',VTT.read_text()):
        blocks.append((sec(m.group(1)),sec(m.group(2)),m.group(3).replace('\n',' ')))
    return blocks

def caption_at(t,cues):
    for a,b,text in cues:
        if a<=t<b:return text
    return ''

def caption_layer(im,caption,aspect,controls=False):
    if not caption and not controls:return im
    overlay=Image.new('RGBA',im.size,(0,0,0,0));d=ImageDraw.Draw(overlay)
    w,h=im.size
    if caption:
        top=h-(183 if aspect=='desktop' else 138)
        bottom=h-(66 if aspect=='desktop' else 55)
        d.rounded_rectangle((42 if aspect=='desktop' else 12,top,w-(42 if aspect=='desktop' else 12),bottom),
                            radius=13,fill=(10,23,30,216))
        contain_text(d,caption,(75 if aspect=='desktop' else 21,top+8,w-(75 if aspect=='desktop' else 21),bottom-8),
                     34 if aspect=='desktop' else 18,16,(255,255,255,255))
    if controls:
        y=h-(58 if aspect=='desktop' else 43)
        d.rectangle((0,y,w,h),fill=(0,0,0,185))
        d.polygon([(20,y+14),(20,y+34),(37,y+24)],fill='white')
        d.rectangle((52,y+34,w-20,y+38),fill=(180,180,180,255))
        d.rectangle((52,y+34,w//2,y+38),fill=(255,255,255,255))
    return Image.alpha_composite(im.convert('RGBA'),overlay).convert('RGB')

def main():
    if any((OUT/'stills').glob('*.png')) or (OUT/'receipt.json').exists():
        raise SystemExit('still package already built; refusing overwrite')
    words=json.loads(WORDS.read_text())['original_words']
    if not words or digest(VTT)!='6d1ec9a1b64a1a05aa884a17a5f1e795b16986519c84cfd366e970fdd9dc0803':
        raise SystemExit('qualified transcript/captions drift')
    for a,b in zip(STATES,STATES[1:]):
        if a[2]!=b[1]:raise SystemExit(f'cue gap/overlap: {a[0]} {b[0]}')
    if STATES[0][1]!=545 or STATES[-1][2]!=2534:raise SystemExit('C01 boundaries drift')
    stilldir=OUT/'stills';stilldir.mkdir()
    cues=parse_vtt();manifest=[]
    for id,start,end,kind,label,source_anchor in STATES:
        row={'id':id,'start_frame':start,'end_frame_exclusive':end,'start_seconds':start/25,
             'end_seconds':end/25,'source_anchor':source_anchor,'on_art_text':label,'files':{}}
        for aspect in ('desktop','portrait'):
            image=clean(kind,aspect,label)
            caption=caption_at((start+end)/50,cues)
            versions={'clean':image,'caption-on':caption_layer(image,caption,aspect)}
            if id in ('board-question','wayfinding-airport'):
                versions['control-proof']=caption_layer(image,caption,aspect,controls=True)
            for variant,pic in versions.items():
                # Versioned filename preserves the corrected midpoint caption
                # while the earlier unlinked QA draft remains in this folder.
                filename_variant='caption-on-cue-corrected' if id=='wayfinding-untouched' and variant=='caption-on' else variant
                name=f'{id}-{aspect}-{filename_variant}.png';path=stilldir/name
                pic.save(path,optimize=True)
                row['files'][f'{aspect}-{variant}']={'path':str(path.relative_to(ROOT)),
                                                   'sha256':digest(path),'dimensions':list(pic.size)}
        manifest.append(row)
    (OUT/'cue-map.json').write_text(json.dumps({'fps':25,'qualified_audio_offset_seconds':21.802667,
      'canonical_provider_words':str(WORDS.relative_to(ROOT)),'optional_captions':str(VTT.relative_to(ROOT)),
      'macro_boundaries':{'board-wide':[545,970],'board-focus':[970,1440],'signals':[1440,2534]},
      'states':manifest},indent=2)+'\n')
    sources={x.name:{'path':str(x.relative_to(ROOT)),'sha256':digest(x),'dimensions':list(Image.open(x).size)}
             for x in SOURCE.glob('*.png')}
    (OUT/'source-map.json').write_text(json.dumps({'source_art':sources,
      'generation':'Built-in imagegen; desktop board references old board subject and approved Customer style; desktop wayfinding references Customer style; portrait art recomposed from respective desktop art.',
      'source_old_board':'artifacts/accelerated-l02-l16-illustration-qualification-2026-11-12/l02-01-board-wide.png',
      'source_old_signals':'artifacts/accelerated-l02-l16-illustration-qualification-2026-11-12/l02-02-signals-plate-1920x1080.png',
      'layout_benchmark':'artifacts/accelerated-l02-l16-illustration-qualification-2026-11-12/l02-c02-flat-matte-diverse-stills-2026-11-13/customer-1920x1080-clean.png'},indent=2)+'\n')
    (OUT/'receipt.json').write_text(json.dumps({'status':'STILL_ONLY_CANDIDATE_FOR_CAPTAIN_REVIEW_NO_VIDEO',
      'scene_scope':['C01-board-wide','C01-board-focus','C01-signals','C01-comparison-return visual source only'],
      'cue_states':len(manifest),'clean_stills':len(manifest)*2,'caption_on_stills':len(manifest)*2,
      'control_proofs':4,'source_map':'source-map.json','cue_map':'cue-map.json',
      'render_eligibility':'NOT_AUTHORIZED','master_audio_timing_presenter_boundaries':'UNCHANGED',
      'excluded':['video render','HeyGen','spend','learner media','PR #1270 update','merge','deploy','publish','release']},indent=2)+'\n')
    print(f'{len(manifest)} states; {len(manifest)*4+4} stills; no video')

if __name__=='__main__':main()
