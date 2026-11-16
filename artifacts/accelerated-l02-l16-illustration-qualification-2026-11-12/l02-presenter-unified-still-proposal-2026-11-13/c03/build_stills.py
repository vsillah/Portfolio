#!/usr/bin/env python3
"""Build review-only, source-cued L02 Choice/C03 stills. No video output."""
from hashlib import sha256
import json
from pathlib import Path
import re
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageFilter

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
PLATES = OUT / 'plates'
STILLS = OUT / 'stills'
QA = OUT / 'qa'
A = ROOT / 'artifacts/accelerated-l02-l16-illustration-qualification-2026-11-12'
OLD = A / 'l02-full-corrected-local-review-2026-11-13'
FONT = '/System/Library/Fonts/Avenir Next.ttc'
NAVY = (12, 35, 51)
GOLD = (222, 183, 103)
WHITE = (248, 241, 226)
EXPECTED_PLATES = {
    'choice-options': 'de1427795b195ffbe53092cb485443ad331f33523f9f46442a4a510057cc2003',
    'economic-fit': 'ce5026acda4e7f6626fd173ec5700c5a31a9380d76d14a6c6baf84cf697a49e8',
    'evidence-check': 'b79a047b80756e4b3f8e98f4788aa71637c598baab6d5f86eb70a0e2ed18b7e9',
    'small-test': '40f11e0471936eed57567fc70e25d966bcbe6cced3afa2db8ba83287fcc8b716',
    'book-case': '9e9f4117a49f462cf7a91775aba1763569e158d17a3edc42fd131ff50c372438',
    'decision-record': '7bd72d053cc50a37fc7a91c715b4e0281ece87ad7e5caa9d9a775ae014a7a6ad',
}

# Existing macro scene boundaries are immutable. Intermediate states are
# storyboard cues inside those windows, not a changed lesson schedule.
STATES = [
    ('c02-compare',4530,5049,'choice-options','Compare three options',None,'Now put the three options side by side.'),
    ('c02-email',5049,5224,'choice-options','Welcome email','email','On our sample sheet, the welcome email is low effort and easy to undo.'),
    ('c02-task',5224,5452,'choice-options','Guided first task','task','The guided first task could expose whether people need a clearer starting point.'),
    ('c02-dashboard',5452,5739,'choice-options','Staff dashboard','dashboard','The staff dashboard might help the team see where members pause.'),
    ('c02-evidence-question',5739,5930,'choice-options','What evidence changes the ranking?','evidence','You can disagree with my provisional ranking if you can name what evidence changes it.'),
    ('c03-preroll',6327,6446,'economic-fit','',None,''),
    ('c03-opening-base',6446,6457,'economic-fit','',None,''),
    ('c03-value-before-pay',6457,6541,'economic-fit','Value before paying?',None,'whether people need to experience value before paying'),
    ('c03-value-over-time',6541,6598,'economic-fit','Value over time?',None,'whether value accumulates over time'),
    ('c03-free-tier',6598,6656,'economic-fit','Can a free tier work?',None,'whether a free tier is affordable'),
    ('c03-predictable-use',6656,6693,'economic-fit','Predictable use?',None,'whether usage is predictable'),
    ('c03-economic-focus',6693,6927,'economic-fit','Economic fit',None,'Those are decision questions, not a menu that automatically picks your business.'),
    ('c03-who-help',6927,7007,'economic-fit','Who gets help?',None,'who gets help'),
    ('c03-who-pays',7007,7041,'economic-fit','Who pays?',None,'who pays for it'),
    ('c03-book-context',7041,7266,'book-case','The book case',None,'The book includes a B2B analytics case'),
    ('c03-book-structure',7266,7367,'book-case','Structure the case',None,'first structure the case'),
    ('c03-book-economics',7367,7407,'book-case','Consider economic fit',None,'then consider the economic fit'),
    ('c03-evidence-base',7407,7425,'evidence-check','',None,''),
    ('c03-ideas',7425,7488,'evidence-check','Possibilities',None,'An AI brainstorm can offer possibilities.'),
    ('c03-missing-evidence',7488,7596,'evidence-check','Missing evidence',None,'It cannot supply the missing customer and operating evidence'),
    ('c03-small-test',7596,7785,'small-test','Small test',None,'I would choose a small test of the guided first task.'),
    ('c03-consenting-participants',7785,7879,'small-test','A few participants',None,'a few consenting participants'),
    ('c03-helped-begin',7879,7997,'small-test','Did it help them begin?',None,'ask whether it helped them begin'),
    ('c03-email-alternative',7997,8131,'choice-options','Welcome email','email','I would keep the welcome email as an alternative'),
    ('c03-dashboard-hold',8131,8275,'choice-options','Staff dashboard','dashboard','I would hold the staff dashboard'),
    ('c03-test-assumption',8275,8451,'choice-options','Test the starting point','task','test the starting-point assumption'),
    ('c03-choice-open',8451,8499,'decision-record','A choice to challenge',None,'Your decision may go another way.'),
    ('c03-choice-page',8499,8560,'decision-record','Put your choice on the page',None,'Put your choice at the top of the page'),
    ('c03-choice-reason',8560,8724,'decision-record','We choose this because…',None,'We choose this because...'),
    ('c03-choice-alternatives',8724,8892,'decision-record','Two alternatives',None,'record the two alternatives you are setting aside'),
    ('c03-choice-new-evidence',8892,9031,'decision-record','What changes the choice?',None,'When new evidence arrives'),
    ('c03-worksheet',9031,9176,'decision-record','Finish the decision file',None,'Pause here and finish the page.'),
    ('c03-assumption',9176,9561,'decision-record','One assumption to test',None,'one assumption that could overturn your choice'),
]

CAPTION_SAMPLES = {
    'c02': ('c02-task','The guided first task could expose whether people need a clearer starting point.'),
    'c03-preroll': ('c03-preroll',''),
    'c03-opening': ('c03-value-before-pay','whether people need to experience value before paying'),
    'c03-checks': ('c03-who-help','who gets help and who pays for it'),
    'c03-book': ('c03-book-structure','first structure the case, then consider the economic fit'),
    'c03-evidence': ('c03-missing-evidence','missing customer and operating evidence'),
    'c03-test': ('c03-helped-begin','whether it helped them begin'),
    'c03-alternatives': ('c03-dashboard-hold','I would hold the staff dashboard'),
    'c03-choice': ('c03-choice-reason','We choose this because...'),
    'c03-worksheet': ('c03-assumption','one assumption that could overturn your choice'),
}

def digest(path):
    d=sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):d.update(chunk)
    return d.hexdigest()

def font(size,bold=False):
    return ImageFont.truetype(FONT,size,index=0 if bold else 7)

def wrap(draw,text,size,max_width,bold=True):
    f=font(size,bold);out=[];line=''
    for word in text.split():
        trial=(line+' '+word).strip()
        if line and draw.textbbox((0,0),trial,font=f)[2]>max_width:
            out.append(line);line=word
        else:line=trial
    if line:out.append(line)
    return out

def crop_fit(src,box,size):
    return ImageOps.fit(src.crop(box),size,method=Image.Resampling.LANCZOS)

def mobile_art(src,plate,focus):
    w,h=src.size
    if plate=='choice-options' and focus is None:
        # The comparison must retain all three options in portrait. A centered
        # crop of the wide art would silently remove the email and dashboard.
        bg=ImageOps.fit(src,(390,844),method=Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(38)).convert('RGB')
        layers=[((260,0,1410,440),0,230),((270,430,790,750),225,180),
                ((630,430,1120,750),400,180),((990,430,1515,750),575,269)]
        for box,y,height in layers:
            art=crop_fit(src,box,(390,height))
            mask=Image.new('L',(390,height),255);md=ImageDraw.Draw(mask)
            if y:
                for row in range(18):md.line((0,row,390,row),fill=round(row/18*255))
            bg.paste(art,(0,y),mask)
        return bg
    ranges={
      'choice-options':((310,0,1390,560),(240,355,1430,940)),
      'economic-fit':((40,0,970,650),(620,190,1650,940)),
      'evidence-check':((0,0,990,630),(680,180,1670,940)),
      'small-test':((30,0,1010,660),(660,250,1620,940)),
      'book-case':((260,0,1400,600),(240,340,1450,940)),
      'decision-record':((300,0,1430,630),(250,340,1450,940)),
    }
    top,bottom=ranges[plate]
    if plate=='choice-options' and focus:
        bottom={'email':(230,385,840,925),'task':(535,385,1120,925),
                'dashboard':(890,385,1530,925),'evidence':(580,0,1110,515)}[focus]
    bg=ImageOps.fit(src,(390,844),method=Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(38))
    bg=bg.convert('RGB')
    a=crop_fit(src,top,(390,435))
    b=crop_fit(src,bottom,(390,495))
    bg.paste(a,(0,0))
    mask=Image.new('L',(390,495));md=ImageDraw.Draw(mask)
    for y in range(495):md.line((0,y,390,y),fill=min(255,max(0,round((y/95)*255))))
    bg.paste(b,(0,349),mask)
    return bg

def add_label(image,label,mobile=False):
    if not label:return image
    im=image.convert('RGBA');overlay=Image.new('RGBA',im.size);d=ImageDraw.Draw(overlay)
    if mobile:
        size=24;rows=wrap(d,label,size,325)
        if len(rows)>2:raise ValueError('mobile label too long: '+label)
        y=25;box=(15,y,375,y+22+35*len(rows));r=18;tx=29;ty=y+10;leading=35
    else:
        size=48;rows=wrap(d,label,size,1550)
        if len(rows)>1:raise ValueError('desktop label too long: '+label)
        y=42;max_text=max(d.textbbox((0,0),x,font=font(size,True))[2] for x in rows)
        box=(55,y,min(1865,125+max_text),y+88);r=18;tx=85;ty=y+12;leading=60
    d.rounded_rectangle(box,radius=r,fill=(12,35,51,231),outline=(*GOLD,255),width=2)
    for i,row in enumerate(rows):d.text((tx,ty+i*leading),row,font=font(size,True),fill=(*WHITE,255))
    return Image.alpha_composite(im,overlay).convert('RGB')

def add_focus(image,focus,mobile=False):
    if not focus or mobile:return image
    points={'email':(550,650,185),'task':(930,635,190),'dashboard':(1365,640,185),
            'evidence':(930,170,170)}
    x,y,r=points[focus]
    im=image.copy();d=ImageDraw.Draw(im)
    d.ellipse((x-r,y-r,x+r,y+r),outline=GOLD,width=7)
    return im

def add_caption(image,text,mobile=False):
    if not text:return image
    im=image.convert('RGBA');overlay=Image.new('RGBA',im.size);d=ImageDraw.Draw(overlay)
    if mobile:
        size=17;rows=wrap(d,text,size,334,False)
        if len(rows)>3:rows=rows[:3]
        y=683;h=23*len(rows)+14;box=(14,y,376,y+h);tx=24;ty=y+6;leading=23
    else:
        size=28;rows=wrap(d,text,size,1400,False)
        if len(rows)>2:rows=rows[:2]
        h=38*len(rows)+22;y=910-h;box=(230,y,1690,910);tx=254;ty=y+10;leading=38
    d.rounded_rectangle(box,radius=14,fill=(12,35,51,228),outline=(*GOLD,255),width=2)
    for i,row in enumerate(rows):d.text((tx,ty+i*leading),row,font=font(size),fill=(*WHITE,255))
    return Image.alpha_composite(im,overlay).convert('RGB')

def render(plate,label,focus,mobile=False,caption=''):
    src=Image.open(PLATES/f'{plate}-matte.png').convert('RGB')
    if mobile: im=mobile_art(src,plate,focus)
    else:im=ImageOps.fit(src,(1920,1080),method=Image.Resampling.LANCZOS)
    im=add_focus(im,focus,mobile)
    im=add_label(im,label,mobile)
    return add_caption(im,caption,mobile)

def contact(paths,out,columns,width):
    thumbs=[]
    for p in paths:
        im=Image.open(p).convert('RGB');h=round(im.height*width/im.width)
        thumbs.append((p,im.resize((width,h),Image.Resampling.LANCZOS)))
    cell_h=max(im.height for _,im in thumbs)+42
    board=Image.new('RGB',(columns*width,((len(thumbs)+columns-1)//columns)*cell_h),WHITE)
    d=ImageDraw.Draw(board)
    for i,(p,im) in enumerate(thumbs):
        x=(i%columns)*width;y=(i//columns)*cell_h
        board.paste(im,(x,y+32));d.text((x+8,y+8),p.stem,font=font(15),fill=NAVY)
    board.save(out,quality=88)

def main():
    for name,expected in EXPECTED_PLATES.items():
        p=PLATES/f'{name}-matte.png'
        if digest(p)!=expected:raise SystemExit(f'plate drift: {name}')
    manifest=json.loads((OLD/'render-attempt.json').read_text())
    if manifest['fps']!=25 or manifest['frame_count']!=10090:
        raise SystemExit('qualified full-render frame contract drift')
    spans={};at=0
    for seg in manifest['segments']:
        spans[seg['name']]=(at,at+seg['frames']);at+=seg['frames']
    for k,v in {'C02-choice':(4530,5930),'C03-preroll':(6327,6446),
      'C03-opening':(6446,6693),'C03-checks':(6693,7041),
      'C03-book':(7041,7407),'C03-evidence':(7407,7596),
      'C03-test':(7596,7997),'C03-alternatives':(7997,8451),
      'C03-choice':(8451,9031),'C03-worksheet':(9031,9561)}.items():
        if spans[k]!=v:raise SystemExit(f'scene boundary drift: {k}')
    groups=[(4530,5930),(6327,9561)]
    for start,end in groups:
        rows=[x for x in STATES if start<=x[1]<end]
        if rows[0][1]!=start or rows[-1][2]!=end or any(a[2]!=b[1] for a,b in zip(rows,rows[1:])):
            raise SystemExit(f'storyboard cue gap: {start}-{end}')
    def normalized(s):return re.sub(r'[^a-z0-9]+',' ',s.lower()).strip()
    script=normalized((A/'l02-narration-job-pack/l02-narration-job-pack.json').read_text())
    for name,_,_,_,_,_,anchor in STATES:
        if anchor and normalized(anchor) not in script:
            # Some anchors use a short wording from the caption sidecar.
            vtt=normalized((OLD/'l02-full-optional-captions.vtt').read_text())
            if normalized(anchor) not in vtt:
                raise SystemExit(f'speech/source anchor drift: {name}: {anchor}')
    STILLS.mkdir(exist_ok=True);QA.mkdir(exist_ok=True)
    states=[]
    for name,start,end,plate,label,focus,anchor in STATES:
        for view in ('desktop','mobile'):
            mobile=view=='mobile';path=STILLS/f'{name}-{view}-clean.png'
            render(plate,label,focus,mobile).save(path,optimize=True)
        states.append({'id':name,'start_frame':start,'end_frame_exclusive':end,
            'start_seconds':start/25,'end_seconds':end/25,'plate':plate,
            'overlay_label':label,'focus':focus,'source_anchor':anchor})
    caption_paths=[]
    by_name={x[0]:x for x in STATES}
    for group,(name,caption) in CAPTION_SAMPLES.items():
        state=by_name[name]
        for view in ('desktop','mobile'):
            mobile=view=='mobile';path=STILLS/f'{name}-{view}-caption-on.png'
            render(state[3],state[4],state[5],mobile,caption).save(path,optimize=True)
            caption_paths.append(path)
    macro=['c02-compare','c03-preroll','c03-value-before-pay','c03-who-help',
      'c03-book-structure','c03-missing-evidence','c03-helped-begin',
      'c03-dashboard-hold','c03-choice-reason','c03-assumption']
    for view in ('desktop','mobile'):
        clean=[STILLS/f'{name}-{view}-clean.png' for name in macro]
        caption=[p for p in caption_paths if p.name.endswith(f'{view}-caption-on.png')]
        contact(clean,QA/f'{view}-clean-board.jpg',2,640 if view=='desktop' else 260)
        contact(caption,QA/f'{view}-caption-board.jpg',2,640 if view=='desktop' else 260)
    outputs={str(p.relative_to(OUT)):{'sha256':digest(p),'dimensions':list(Image.open(p).size)}
             for p in sorted(STILLS.glob('*.png'))}
    source_map={'source_timeline':str((OLD/'render-attempt.json').relative_to(ROOT)),
        'source_timeline_sha256':digest(OLD/'render-attempt.json'),
        'source_narration':str((A/'l02-narration-job-pack/l02-narration-job-pack.json').relative_to(ROOT)),
        'source_narration_sha256':digest(A/'l02-narration-job-pack/l02-narration-job-pack.json'),
        'j01_provider_word_timing':str((A/'l02-narration-job-pack/l02-j01-provider-words-aede32ab14e6484ca8fb74c9381ce532.json').relative_to(ROOT)),
        'j01_provider_word_timing_sha256':digest(A/'l02-narration-job-pack/l02-j01-provider-words-aede32ab14e6484ca8fb74c9381ce532.json'),
        'j02_local_alignment':str((A/'l02-narration-job-pack/l02-j02-c03-c04-local-alignment-2026-11-12.json').relative_to(ROOT)),
        'j02_local_alignment_sha256':digest(A/'l02-narration-job-pack/l02-j02-c03-c04-local-alignment-2026-11-12.json'),
        'caption_source':str((OLD/'l02-full-optional-captions.vtt').relative_to(ROOT)),
        'caption_source_sha256':digest(OLD/'l02-full-optional-captions.vtt'),
        'plates':{name:{'path':str((PLATES/f'{name}-matte.png').relative_to(ROOT)),
            'sha256':expected} for name,expected in EXPECTED_PLATES.items()},
        'source_boundary':'Synthetic teaching artwork. No observed customer outcome or product-performance claim.'}
    (OUT/'source-map.json').write_text(json.dumps(source_map,indent=2)+'\n')
    (OUT/'cue-map.json').write_text(json.dumps({'fps':25,'states':states,
        'macro_scene_boundaries':{k:list(v) for k,v in spans.items() if k.startswith('C02-choice') or k.startswith('C03-')}},indent=2)+'\n')
    (OUT/'receipt.json').write_text(json.dumps({'status':'STILL_ONLY_CANDIDATE_FOR_CAPTAIN_REVIEW_NO_VIDEO',
      'date':'2026-11-13','states':len(STATES),'clean_stills':len(STATES)*2,
      'caption_on_samples':len(caption_paths),'output_count':len(outputs),
      'image_gen_plates':list(EXPECTED_PLATES),'source_map':'source-map.json','cue_map':'cue-map.json',
      'qa_review':'qa-review.md',
      'prompt_provenance':'prompt-provenance.json','build_script_sha256':digest(Path(__file__)),
      'qa_controls_script_sha256':digest(OUT/'qa_controls.py'),
      'caption_behavior':'Optional, representative overlay only; clean frames use the full artwork with no reserved caption band.',
      'control_exclusion':{'desktop_y_at_or_above':1000,'mobile_y_at_or_above':772},
      'render_eligibility':'NOT_AUTHORIZED','outputs':outputs,
      'excluded':['video render','HeyGen','spend','learner media','PR #1270 update','merge','deploy','publish','release']},indent=2)+'\n')
    print(f'{len(STATES)} states, {len(outputs)} stills; no video')

if __name__=='__main__':main()
