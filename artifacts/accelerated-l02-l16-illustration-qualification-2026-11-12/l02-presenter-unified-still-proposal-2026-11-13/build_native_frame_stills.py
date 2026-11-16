"""Still-only Agentified-structure L02 proposal using untouched native presenter frames."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import hashlib, json
from build_stills import ROOT, PRE, SCENES, SAMPLE_SECONDS, cue_at, motif, tx, font, GOLD, PAPER, WHITE

OUT=ROOT/'stills-v2-native-frame'; OUT.mkdir(exist_ok=True)
NAVY=(12,31,45)
VIDEO_BOX={False:(1000,300,1810,756),True:(58,390,374,568)}
BACKGROUND_CACHE={}
ART_ROOT=Path('artifacts/accelerated-l02-l16-illustration-qualification-2026-11-12/l02-choice-c03-matte-stills-2026-11-13/plates')
SOURCE_ART={
    'P02':ART_ROOT/'book-case-matte.png',
    'P03':ART_ROOT/'economic-fit-matte.png',
}

def background(portrait):
    if portrait in BACKGROUND_CACHE:return BACKGROUND_CACHE[portrait].copy()
    w,h=(390,844) if portrait else (1920,1080)
    im=Image.new('RGB',(w,h)); px=im.load()
    # Continuous AmaduTown navy/teal wash beneath content and presenter.
    for y in range(h):
        fy=y/(h-1)
        for x in range(w):
            fx=x/(w-1)
            px[x,y]=(round(10+7*fx+2*fy),round(32+11*fx-2*fy),round(47+10*fx-3*fy))
    d=ImageDraw.Draw(im,'RGBA')
    step=54 if portrait else 118
    for y in range(0,h,step):d.line((0,y,w,y),fill=(226,189,107,13),width=1)
    for x in range(0,w,step):d.line((x,0,x,h),fill=(226,189,107,9),width=1)
    BACKGROUND_CACHE[portrait]=im.convert('RGBA')
    return BACKGROUND_CACHE[portrait].copy()

def wrap(d,line,size,width):
    lines=['']
    for word in line.split():
        trial=(lines[-1]+' '+word).strip()
        if d.textbbox((0,0),trial,font=font(size))[2]>width:lines.append(word)
        else:lines[-1]=trial
    return lines

def illustrated_field(name,portrait):
    canvas=background(portrait)
    source=Image.open(SOURCE_ART[name]).convert('RGB')
    if portrait:
        # A source-faithful crop keeps the people, book, and economic exchange above the video.
        box=(0,0,1200,760) if name=='P02' else (0,0,1150,760)
        art=source.crop(box).resize((390,247 if name=='P02' else 258),Image.Resampling.LANCZOS)
        pos=(0,158)
        blur=27
    else:
        art=source.resize((1050,591),Image.Resampling.LANCZOS)
        pos=(10,330)
        blur=78
    w,h=art.size
    # Organic matte edge avoids turning the source illustration into a left panel.
    mask=Image.new('L',(w,h),0); md=ImageDraw.Draw(mask)
    md.ellipse((18,6,w-18,h-6),fill=255)
    mask=mask.filter(ImageFilter.GaussianBlur(blur))
    canvas.paste(art,pos,mask)
    return canvas

def render(name,frame,title,subtitle,kind,portrait,caption):
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
    source=Image.open(PRE/f'native-{name}-{frame}.png').convert('RGB')
    x0,y0,x1,y1=VIDEO_BOX[portrait]
    video=source.resize((x1-x0,y1-y0),Image.Resampling.LANCZOS)
    im.paste(video,(x0,y0))
    d=ImageDraw.Draw(im,'RGBA')
    # Exactly one thin Agentified-style outline; source blue remains intact.
    d.rectangle((x0-1,y0-1,x1,y1),outline=GOLD,width=1 if portrait else 2)
    if caption:
        line=cue_at(name)
        if portrait:
            lines=wrap(d,line,16,332)
            top=755-21*len(lines)
            d.rounded_rectangle((16,top-8,374,top+21*len(lines)+8),radius=7,fill=(4,20,27,230))
            for j,s in enumerate(lines):tx(d,(27,top+j*21),s,16,WHITE)
        else:
            lines=wrap(d,line,28,1100)
            top=928-38*len(lines)
            d.rounded_rectangle((355,top-10,1570,top+38*len(lines)+10),radius=9,fill=(4,20,27,225))
            for j,s in enumerate(lines):tx(d,(385,top+j*38),s,28,WHITE)
    # Player controls are an overlaid proof band, independent of slide composition.
    if portrait:
        d.rectangle((0,798,390,844),fill=(2,17,24,220))
        d.line((18,812,372,812),fill=(130,148,147),width=2)
        d.line((18,812,75,812),fill=GOLD,width=3)
    else:
        d.rectangle((0,1035,1920,1080),fill=(2,17,24,215))
        d.line((48,1052,1835,1052),fill=(130,148,147),width=3)
        d.line((48,1052,300,1052),fill=GOLD,width=4)
    path=OUT/f'{name}-{("portrait" if portrait else "desktop")}-{("caption-on" if caption else "clean")}.png'
    im.convert('RGB').save(path,optimize=True)
    # Pixel-level check proves the native picture has not been keyed or recolored.
    output=Image.open(path)
    inner=output.crop((x0+3,y0+3,x1-3,y1-3))
    expected=video.crop((3,3,video.width-3,video.height-3))
    if inner.tobytes()!=expected.tobytes():raise AssertionError(f'native frame changed: {path}')
    return {'file':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'size':im.size,'video_box':[x0,y0,x1,y1]}

def main():
    outputs=[]
    for name,frame,title,subtitle,kind in SCENES:
        for portrait in (False,True):
            for caption in (False,True):outputs.append(render(name,frame,title,subtitle,kind,portrait,caption))
    art={name:{'path':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'role':'book-concept matte teaching vignette','source_status':'existing C03 still-only candidate; Captain visual approval pending'} for name,path in SOURCE_ART.items()}
    receipt={'status':'still_only_candidate_for_captain_review','structure':'Agentified native source frame with one thin outline on continuous slide field','source_handling':'unaltered RGB frame resized only; inner picture pixel equality checked','source_frame_numbers':{a:b for a,b,*_ in SCENES},'caption_sample_seconds':SAMPLE_SECONDS,'source_art':art,'native_source':'docs/accelerated-course-modules/l02-native-composite/accelerated-l02-heygen-native.mp4','native_sha256':'2beae8254c76a6f8bf168afb8483e83e63c13b621ec3934c81397d3167cd1a3d','optional_caption_source':'artifacts/accelerated-l02-l16-illustration-qualification-2026-11-12/l02-c01-corrected-paired-local-review-2026-11-13/l02-optional-captions.vtt','optional_caption_sha256':'6d1ec9a1b64a1a05aa884a17a5f1e795b16986519c84cfd366e970fdd9dc0803','visual_gate':'P02/P03 source-art composition candidate; Captain plate/style review and motion verification remain open','outputs':outputs,'excluded':['video rendering','HeyGen','generated images','spending','learner media','commit','PR update','merge','deployment','publication','release']}
    (ROOT/'receipt-v2-native-frame.json').write_text(json.dumps(receipt,indent=2)+'\n')
if __name__=='__main__':main()
