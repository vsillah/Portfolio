"""Still-only L02 full-field presenter composition probe. No video output."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import hashlib, json, re

ROOT=Path(__file__).parent
PRE=ROOT/'preflight'
OUT=ROOT/'stills'; OUT.mkdir(exist_ok=True)
FONT='/System/Library/Fonts/Avenir Next.ttc'
NAVY=(9,36,47); GOLD=(221,176,76); PAPER=(238,224,192); WHITE=(251,247,233)
SCENES=[
 ('P01',300,'Fifteen priorities', 'The board is full.', 'board'),
 ('P02',700,'Choose the question', 'What is this case answering?', 'question'),
 ('P03',1080,'Follow the value', 'How does the work sustain itself?', 'model'),
 ('question-bridge',1315,'Read the assumption', 'What do we know?', 'assumption'),
 ('P04',1500,'Build the decision file', 'Evidence that changes the room', 'decision'),
]
VTT=Path('artifacts/accelerated-l02-l16-illustration-qualification-2026-11-12/l02-c01-corrected-paired-local-review-2026-11-13/l02-optional-captions.vtt')
SAMPLE_SECONDS={'P01':12,'P02':122,'P03':245,'question-bridge':384,'P04':392}
def cue_at(name):
    t=SAMPLE_SECONDS[name]
    for block in re.split(r'\n\s*\n',VTT.read_text()):
        m=re.search(r'(\d\d):(\d\d):(\d\d)\.(\d+) --> (\d\d):(\d\d):(\d\d)\.(\d+)',block)
        if not m: continue
        v=list(map(int,m.groups()))
        a=v[0]*3600+v[1]*60+v[2]+v[3]/1000
        z=v[4]*3600+v[5]*60+v[6]+v[7]/1000
        if a<=t<z: return ' '.join(block[m.end():].split())
    raise ValueError(f'No caption cue at {t}s')
def font(n,bold=False): return ImageFont.truetype(FONT,n,index=3 if bold else 0)
def tx(d,xy,s,n=34,fill=WHITE,bold=False): d.text(xy,s,font=font(n,bold),fill=fill)
SOURCE_CACHE={}
def recolor(src):
    # Shift the blue studio environment to one continuous AmaduTown navy/teal field.
    im=src.convert('RGB'); data=bytearray(im.tobytes())
    for i in range(0,len(data),3):
        r,g,b=data[i:i+3]; score=min(b-1.2*g,b-1.5*r)
        f=max(0,min(1,(score-3)/55))
        if f:
            lum=.22*r+.55*g+.23*b
            target=(int(5+lum*.11),int(29+lum*.25),int(39+lum*.24))
            for c in range(3): data[i+c]=round(data[i+c]*(1-f)+target[c]*f)
    return Image.frombytes('RGB',im.size,bytes(data))
def base(name,portrait):
    if name not in SOURCE_CACHE:
        SOURCE_CACHE[name]=recolor(Image.open(PRE/f'native-{name}-{next(b for a,b,*_ in SCENES if a==name)}.png'))
    src=SOURCE_CACHE[name]
    if not portrait:
        im=src
        d=ImageDraw.Draw(im,'RGBA')
        # A soft falloff protects teaching contrast without a panel or hard split.
        shade=Image.new('RGBA',im.size,(0,0,0,0)); sd=ImageDraw.Draw(shade)
        for x in range(0,1030,10):
            a=round(175*(1-x/1030)**1.2)
            sd.rectangle((x,0,x+10,1080),fill=(3,25,34,a))
        im=Image.alpha_composite(im.convert('RGBA'),shade)
        return im
    im=Image.new('RGBA',(390,844),NAVY+(255,))
    # Extend the exact top row of this source behind all teaching content.
    # The native frame can therefore begin without a horizontal color seam.
    native=src.resize((650,366),Image.Resampling.LANCZOS).convert('RGBA')
    row=native.crop((137,0,527,1)).resize((390,844))
    im.paste(row,(0,0))
    a=Image.new('L',native.size,255); ad=ImageDraw.Draw(a)
    for y in range(155):
        v=round(255*y/155); ad.line((0,365-y,649,365-y),fill=v)
    native.putalpha(a)
    im.alpha_composite(native,(-137,345))
    return im
def motif(d,kind,p):
    if not p:
        x,y=92,410; unit=1
        if kind=='board':
            for j in range(3):
                for i in range(5):
                    xx=x+i*112; yy=y+j*98
                    d.rounded_rectangle((xx,yy,xx+90,yy+70),radius=6,fill=(226,213,178,225),outline=GOLD,width=2)
                    d.line((xx+17,yy+25,xx+73,yy+25),fill=NAVY,width=4)
                    d.line((xx+17,yy+40,xx+58,yy+40),fill=NAVY,width=3)
            d.line((x+290,y+340,x+520,y+340),fill=GOLD,width=5)
            tx(d,(x,y+360),'Which decision comes first?',30,GOLD,True)
        elif kind=='question':
            for j,(label,sub) in enumerate([('MARKET','Attractive?'),('PRODUCT','Useful?'),('MODEL','Sustainable?')]):
                yy=y+j*126; d.ellipse((x,yy+9,x+55,yy+64),fill=GOLD)
                tx(d,(x+18,yy+17),str(j+1),25,NAVY,True)
                d.line((x+60,yy+36,x+140,yy+36),fill=GOLD,width=3)
                tx(d,(x+155,yy),label,26,GOLD,True); tx(d,(x+155,yy+34),sub,33,WHITE)
        elif kind=='model':
            labs=['CUSTOMER','VALUE','REVENUE','WORK']
            for j,s in enumerate(labs):
                xx=x+(j%2)*330; yy=y+(j//2)*175
                d.rounded_rectangle((xx,yy,xx+270,yy+125),radius=10,fill=(235,222,193,230),outline=GOLD,width=2)
                tx(d,(xx+24,yy+37),s,30,NAVY,True)
            d.line((x+270,y+61,x+330,y+61),fill=GOLD,width=5)
            d.line((x+270,y+235,x+330,y+235),fill=GOLD,width=5)
        elif kind=='assumption':
            d.rounded_rectangle((x,y,x+650,y+335),radius=12,fill=(238,224,192,235),outline=GOLD,width=2)
            tx(d,(x+38,y+24),'ASSUMPTION',27,NAVY,True)
            d.line((x+40,y+91,x+605,y+91),fill=NAVY,width=2)
            tx(d,(x+40,y+120),'KNOWN',32,NAVY,True); tx(d,(x+360,y+120),'HOPED',32,NAVY,True)
            d.line((x+310,y+120,x+310,y+270),fill=GOLD,width=3)
            for yy in (190,230,270):
                d.line((x+40,yy,x+260,yy),fill=(60,91,97),width=3)
                d.line((x+360,yy,x+580,yy),fill=(60,91,97),width=3)
        else:
            d.rounded_rectangle((x,y,x+650,y+340),radius=12,fill=(238,224,192,235),outline=GOLD,width=2)
            tx(d,(x+32,y+28),'DECISION FILE',29,NAVY,True)
            for j,s in enumerate(['Owner','Assumption','Evidence','Next move']):
                yy=y+91+j*56
                d.ellipse((x+38,yy,x+61,yy+23),outline=GOLD,width=3)
                tx(d,(x+85,yy-8),s,27,NAVY)
                d.line((x+330,yy+25,x+590,yy+25),fill=(86,112,112),width=2)
    else:
        # Compact visual grammar reflows into the space above the presenter.
        x,y=22,180
        if kind=='board':
            for j in range(3):
                for i in range(5):
                    xx=x+i*69; yy=y+j*46
                    d.rounded_rectangle((xx,yy,xx+55,yy+34),radius=4,fill=PAPER,outline=GOLD,width=1)
                    d.line((xx+8,yy+12,xx+43,yy+12),fill=NAVY,width=2)
            tx(d,(x,y+158),'15 requests / 1 decision',19,GOLD,True)
        elif kind=='question':
            for j,s in enumerate(['MARKET','PRODUCT','MODEL']):
                xx=x+j*115; d.ellipse((xx,y,xx+46,y+46),fill=GOLD)
                tx(d,(xx+16,y+6),str(j+1),22,NAVY,True)
                tx(d,(xx,y+58),s,17,WHITE,True)
            d.line((x+30,y+116,x+310,y+116),fill=GOLD,width=3)
        elif kind=='model':
            for j,s in enumerate(['CUSTOMER','VALUE','REVENUE','WORK']):
                xx=x+(j%2)*175; yy=y+(j//2)*70
                d.rounded_rectangle((xx,yy,xx+154,yy+52),radius=6,fill=PAPER,outline=GOLD,width=1)
                tx(d,(xx+10,yy+15),s,17,NAVY,True)
        elif kind=='assumption':
            d.rounded_rectangle((x,y,x+344,y+136),radius=7,fill=PAPER,outline=GOLD,width=1)
            tx(d,(x+20,y+18),'KNOWN',20,NAVY,True); tx(d,(x+190,y+18),'HOPED',20,NAVY,True)
            d.line((x+172,y+14,x+172,y+118),fill=GOLD,width=2)
            for yy in (65,90,114):
                d.line((x+20,y+yy,x+145,y+yy),fill=NAVY,width=2)
                d.line((x+190,y+yy,x+318,y+yy),fill=NAVY,width=2)
        else:
            for j,s in enumerate(['OWNER','ASSUMPTION','EVIDENCE','NEXT MOVE']):
                xx=x+(j%2)*175; yy=y+(j//2)*70
                d.rounded_rectangle((xx,yy,xx+154,yy+52),radius=6,fill=PAPER,outline=GOLD,width=1)
                tx(d,(xx+10,yy+15),s,16,NAVY,True)
def render(name,n,title,subtitle,kind,p,caption):
    im=base(name,p); d=ImageDraw.Draw(im,'RGBA')
    if not p:
        tx(d,(90,62),'AMADUTOWN  /  ACCELERATED',27,GOLD,True)
        d.line((90,104,770,104),fill=GOLD,width=2)
        tx(d,(90,170),title,70,WHITE,True)
        tx(d,(92,265),subtitle,36,PAPER)
    else:
        tx(d,(20,28),'AMADUTOWN  /  ACCELERATED',17,GOLD,True)
        d.line((20,60,370,60),fill=GOLD,width=1)
        tx(d,(20,89),title,30,WHITE,True)
        sub=subtitle if len(subtitle)<=33 else subtitle[:30].rstrip()+'…'
        tx(d,(21,131),sub,18,PAPER)
    motif(d,kind,p)
    # One restrained edge line sits outside the presenter, without a card or video rectangle.
    if not p:
        d.line((1780,215,1780,800),fill=GOLD,width=2)
    else:
        d.line((371,385,371,650),fill=GOLD,width=1)
    if caption:
        line=cue_at(name)
        if not p:
            size=28
            words=line.split(); lines=['']
            for word in words:
                trial=(lines[-1]+' '+word).strip()
                if d.textbbox((0,0),trial,font=font(size))[2]>1100: lines.append(word)
                else: lines[-1]=trial
            top=920-38*len(lines)
            d.rounded_rectangle((355,top-10,1570,top+38*len(lines)+10),radius=9,fill=(4,20,27,225))
            for j,s in enumerate(lines):tx(d,(385,top+j*38),s,size,WHITE)
        else:
            size=16
            words=line.split(); lines=['']
            for word in words:
                trial=(lines[-1]+' '+word).strip()
                if d.textbbox((0,0),trial,font=font(size))[2]>332: lines.append(word)
                else: lines[-1]=trial
            top=763-21*len(lines)
            d.rounded_rectangle((16,top-8,374,top+21*len(lines)+8),radius=7,fill=(4,20,27,230))
            for j,s in enumerate(lines):tx(d,(27,top+j*21),s,size,WHITE)
    # Player-safe control reserve is intentional. It is a still proposal, not a player screenshot.
    if not p:
        d.rectangle((0,1035,1920,1080),fill=(2,17,24,215))
        d.line((48,1052,1835,1052),fill=(130,148,147),width=3)
        d.line((48,1052,300,1052),fill=GOLD,width=4)
    else:
        d.rectangle((0,798,390,844),fill=(2,17,24,220))
        d.line((18,812,372,812),fill=(130,148,147),width=2)
        d.line((18,812,75,812),fill=GOLD,width=3)
    path=OUT/f'{name}-{("portrait" if p else "desktop")}-{("caption-on" if caption else "clean")}.png'
    im.convert('RGB').save(path,optimize=True)
    return {'file':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'size':im.size}
def main():
    outputs=[]
    for name,n,title,subtitle,kind in SCENES:
        for p in (False,True):
            for caption in (False,True): outputs.append(render(name,n,title,subtitle,kind,p,caption))
    (ROOT/'receipt.json').write_text(json.dumps({'status':'still_only_candidate','source_frames':[{'scene':a,'frame':b} for a,b,*_ in SCENES],'outputs':outputs,'constraints':['no video render','no learner binding','no timing or audio change','no provider action'],'matte_probe':'rejected blue edge; full field source recolor used instead'},indent=2)+'\n')
if __name__=='__main__': main()
