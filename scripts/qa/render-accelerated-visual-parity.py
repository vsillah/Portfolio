#!/usr/bin/env python3
"""Provider-free, source-bound teaching illustrations for Accelerated L01–L16."""
from __future__ import annotations

import hashlib
import json
import math
import pathlib
import re
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/accelerated-course-modules/visual-production/manifest.json'
OUT = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10'
FRAME_DIR = OUT / 'frames'
PRESENTER_DIR = OUT / 'presenter-frames'
NAVY = '#102832'
DEEP = '#0c202a'
TEAL = '#21505a'
GOLD = '#d5af5b'
GOLD_LIGHT = '#f0d78e'
CREAM = '#eee6d8'
MUTED = '#b8c9c8'
INK = '#15333b'
FONT_SERIF = '/System/Library/Fonts/Supplemental/Georgia.ttf'
FONT_SANS = '/System/Library/Fonts/Avenir Next.ttc'

def font(size: int, serif: bool = False):
    return ImageFont.truetype(FONT_SERIF if serif else FONT_SANS, size)

def short_title(scene: dict) -> str:
    if scene['id'] == 'L12-03':
        return 'ClientQ: a book example'
    return scene['title'].replace('PRD', 'product brief')

def wrap(draw: ImageDraw.ImageDraw, value: str, face, width: int) -> list[str]:
    lines: list[str] = []
    current = ''
    for word in value.split():
        candidate = f'{current} {word}'.strip()
        if current and draw.textbbox((0, 0), candidate, font=face)[2] > width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines

def rounded(draw, box, fill, outline=GOLD, radius=28, width=4):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

def line(draw, points, fill=GOLD, width=11):
    draw.line(points, fill=fill, width=width, joint='curve')

def arrow(draw, x1, y1, x2, y2, color=GOLD):
    line(draw, [(x1,y1),(x2,y2)], color, 9)
    angle=math.atan2(y2-y1,x2-x1)
    for delta in (-.5,.5):
        line(draw, [(x2,y2),(x2-25*math.cos(angle+delta),y2-25*math.sin(angle+delta))],color,8)

def label(draw, text, x, y, size=30, color=CREAM, limit=500):
    face=font(size)
    for i,part in enumerate(wrap(draw,text,face,limit)[:3]):
        draw.text((x,y+i*(size+8)),part,font=face,fill=color)

def concept_specs():
    rows={}
    for raw in (pathlib.Path(__file__).parent/'accelerated-scene-concepts.tsv').read_text().splitlines():
        if not raw or raw.startswith('#'):continue
        scene_id,layout,*labels=raw.split('|')
        assert scene_id not in rows,scene_id
        rows[scene_id]=(layout,labels)
    return rows

CONCEPTS=concept_specs()
ART_BEATS={
    'L01-02':[('sam',15),('signals',15),('main',60)],
    'L01-06':[('main',55),('signals',20),('main',25)],
    'L02-02':[('signals',15),('main',75)],
    'L05-01':[('main',80),('signals',20)],
    'L05-06':[('main',50),('alignment',20),('main',30)],
    'L06-02':[('main',90),('alignment',20)],
    'L07-06':[('main',50),('alignment',20),('main',30)],
    'L08-06':[('main',60),('learning_loop',20),('main',40)],
    'L16-01':[('sam',40),('main',41)],
    'L16-06':[('sam',27),('cover',45)],
}
ART_ASSETS={
    'sam':'public/showcases/service-prototypes/accelerated-sam-infographic.png',
    'signals':'public/showcases/service-prototypes/v2/sam-signals-plate.webp',
    'alignment':'public/showcases/service-prototypes/v2/sam-alignment-plate.webp',
    'momentum':'public/showcases/service-prototypes/v2/sam-momentum-plate.webp',
    'cover':'public/accelerated_cover_ebook.jpg',
}

def concept_text(draw,value,box,size=39,color=CREAM,center=False):
    value=value.replace('→','to').replace('≠','differs from')
    x0,y0,x1,y1=box
    while True:
        face=font(size,True if size>=38 else False)
        rows=wrap(draw,value,face,x1-x0-24)
        line_height=size+10
        widest=max((draw.textbbox((0,0),part,font=face)[2] for part in rows),default=0)
        fits=len(rows)*line_height<=y1-y0-8 and widest<=x1-x0-24
        if fits:break
        if size<=18:raise ValueError(f'Concept copy does not fit: {value!r} in {box}')
        size-=2
    y=y0+max(0,(y1-y0-len(rows)*line_height)//2)
    for part in rows:
        width=draw.textbbox((0,0),part,font=face)[2]
        draw.text((x0+(x1-x0-width)//2 if center else x0+12,y),part,font=face,fill=color)
        y+=line_height

def concept_box(draw,box,value,fill=TEAL,outline=GOLD,size=36,center=True):
    rounded(draw,box,fill,outline,22,5)
    concept_text(draw,value,(box[0]+12,box[1]+10,box[2]-12,box[3]-10),size,CREAM,center)

def source_art(image,name,box):
    art=Image.open(ROOT/ART_ASSETS[name]).convert('RGB')
    art.thumbnail((box[2]-box[0],box[3]-box[1]),Image.Resampling.LANCZOS)
    x=box[0]+(box[2]-box[0]-art.width)//2
    y=box[1]+(box[3]-box[1]-art.height)//2
    image.paste(art,(x,y))

def draw_semantic(d,layout,labels):
    """Large, labeled artifact shapes; no invented measures or customer results."""
    if layout in ('flow','trace','reverse'):
        items=list(reversed(labels)) if layout=='reverse' else labels
        count=len(items);spacing=810/max(1,count-1)
        line(d,[(835,475),(1645,475)],GOLD,8)
        for i,value in enumerate(items):
            x=835+i*spacing
            d.ellipse((x-26,449,x+26,501),fill=GOLD_LIGHT,outline=GOLD,width=5)
            y=245 if i%2==0 else 565
            concept_box(d,(x-125,y,x+125,y+145),value,fill=INK if i==count-1 else TEAL,size=28)
            line(d,[(x,390 if i%2==0 else 500),(x,475 if i%2==0 else 565)],GOLD,5)
        return True
    if layout=='branch':
        concept_box(d,(735,355,1085,555),labels[0],fill=INK,size=34)
        targets=labels[1:4]
        for i,value in enumerate(targets):
            y=225+i*175
            line(d,[(1085,455),(1230,y+68)],GOLD,6)
            concept_box(d,(1230,y,1740,y+135),value,size=31)
        if len(labels)>4:concept_text(d,labels[-1],(1230,745,1740,795),24,GOLD_LIGHT,True)
        return True
    if layout=='timeline':
        line(d,[(745,490),(1730,490)],GOLD,12)
        for i,value in enumerate(labels):
            x=755+i*960/max(1,len(labels)-1)
            d.ellipse((x-32,458,x+32,522),fill=GOLD_LIGHT,outline=INK,width=6)
            y=245 if i%2==0 else 555
            concept_box(d,(x-120,y,x+120,y+135),value,size=27)
            line(d,[(x,380 if i%2==0 else 522),(x,458 if i%2==0 else 555)],GOLD,4)
        return True
    if layout=='loop':
        d.arc((885,220,1610,755),20,350,fill=GOLD,width=18)
        points=[(1240,245),(1600,410),(1460,700),(1020,700),(830,410)]
        for i,value in enumerate(labels[:5]):
            x,y=points[i]
            d.ellipse((x-26,y-26,x+26,y+26),fill=GOLD_LIGHT)
            concept_box(d,(x-105,y-70,x+105,y+70),value,fill=INK if i==4 else TEAL,size=26)
        return True
    if layout=='archive':
        rounded(d,(815,235,1640,745),CREAM,GOLD,26,5)
        rounded(d,(770,270,1595,780),CREAM,GOLD,26,5)
        rounded(d,(730,300,1550,790),CREAM,GOLD,26,5)
        for i,value in enumerate(labels[:4]):
            y=340+i*100
            rounded(d,(765,y,1505,y+76),INK,GOLD,12,3)
            concept_text(d,value,(785,y+4,1485,y+72),29,CREAM,False)
        return True
    if layout in ('matrix','roles'):
        line(d,[(1240,215),(1240,775)],GOLD,9)
        line(d,[(720,495),(1760,495)],GOLD,9)
        for i,value in enumerate(labels[:4]):
            x=740+(i%2)*530;y=230+(i//2)*280
            concept_text(d,value,(x,y,x+470,y+235),34,CREAM,True)
            d.ellipse((x+190,y+155,x+245,y+210),outline=GOLD,width=5)
        return True
    if layout=='measure':
        for i,value in enumerate(labels[:2]):
            x=715+i*535
            rounded(d,(x,215,x+500,625),INK,GOLD,24,4)
            concept_text(d,value,(x+25,235,x+475,320),33,CREAM,True)
            line(d,[(x+70,540),(x+440,540)],MUTED,5)
            line(d,[(x+70,540),(x+70,355)],MUTED,5)
            flat=labels[0].upper().startswith('FLAT')
            points=[(x+85,470),(x+175,468),(x+260,472),(x+350,470),(x+435,471)] if flat else ([(x+85,495),(x+175,445),(x+260,410),(x+350,355),(x+435,345)] if i==0 else [(x+85,485),(x+175,478),(x+260,480),(x+350,474),(x+435,475)])
            line(d,points,GOLD,10)
        if len(labels)>2:concept_box(d,(760,665,1705,765),' / '.join(labels[2:]),size=28)
        return True
    if layout=='handoff':
        for i,value in enumerate(labels[:2]):
            x=815+i*700
            d.ellipse((x-73,255,x+73,401),fill=GOLD_LIGHT,outline=GOLD,width=6)
            d.arc((x-135,345,x+135,665),180,360,fill=GOLD,width=16)
            concept_box(d,(x-180,660,x+180,770),value,size=28)
        line(d,[(945,455),(1370,455)],GOLD,13)
        d.polygon([(1370,455),(1320,425),(1320,485)],fill=GOLD)
        if len(labels)>2:concept_box(d,(1080,270,1260,385),labels[2],fill=INK,size=22)
        return True
    if layout=='correction':
        for i,value in enumerate(labels[:3]):
            x=715+i*355
            rounded(d,(x,275,x+320,660),CREAM if i==1 else TEAL,GOLD,20,5)
            concept_text(d,value,(x+25,345,x+295,545),30,INK if i==1 else CREAM,True)
            if i<2:
                line(d,[(x+320,465),(x+355,465)],GOLD,7)
        line(d,[(760,680),(1010,680)],GOLD,6)
        d.text((810,700),'CHECK SOURCE',font=font(25),fill=GOLD_LIGHT)
        return True
    if layout=='contrast':
        rounded(d,(725,225,1215,755),TEAL,GOLD,28,5)
        rounded(d,(1265,225,1755,755),INK,GOLD,28,5)
        concept_text(d,labels[0],(760,345,1175,585),39,CREAM,True)
        concept_text(d,labels[1],(1300,345,1715,585),39,CREAM,True)
        line(d,[(1240,270),(1240,710)],GOLD,7)
        if len(labels)>2:concept_box(d,(910,660,1570,780),labels[-1],fill=DEEP,size=28)
        return True
    if layout=='focus':
        rounded(d,(720,220,1760,760),TEAL,GOLD,30,5)
        concept_text(d,labels[0],(760,245,1230,365),42,CREAM,False)
        rounded(d,(1040,310,1720,725),INK,GOLD,30,6)
        concept_text(d,labels[1],(1100,350,1660,460),43,CREAM,True)
        rounded(d,(1320,510,1680,675),GOLD_LIGHT,GOLD,24,5)
        concept_text(d,labels[2],(1350,540,1650,640),38,INK,True)
        return True
    if layout=='checkpoint':
        d.ellipse((760,210,935,385),fill=GOLD_LIGHT,outline=GOLD,width=6)
        concept_text(d,labels[0].split()[-1],(780,245,915,350),42,INK,True)
        line(d,[(845,380),(845,735)],GOLD,10)
        for i,value in enumerate(labels[1:]):
            x=915+(i%2)*425;y=225+(i//2)*175
            concept_box(d,(x,y,x+385,y+140),value,size=29)
            line(d,[(845,y+70),(x,y+70)],GOLD,4)
        return True
    if layout=='numbered':
        count=len(labels)
        if count>=6:
            for i,value in enumerate(labels):
                x=725+(i%3)*345;y=255+(i//3)*245
                d.ellipse((x,y-38,x+76,y+38),fill=GOLD_LIGHT,outline=GOLD,width=5)
                d.text((x+24,y-32),str(i+1),font=font(34,True),fill=INK)
                concept_box(d,(x,y+45,x+315,y+200),value,size=28)
            return True
        for i,value in enumerate(labels):
            # Keep both rows above the native caption and control region.
            x=725+i*1030/count;y=420-(i%2)*160
            d.ellipse((x,y-60,x+90,y+30),fill=GOLD_LIGHT,outline=GOLD,width=5)
            d.text((x+27,y-52),str(i+1),font=font(40,True),fill=INK)
            concept_box(d,(x-15,y+45,x+1010/count-15,y+190),value,size=25)
            if i<count-1:line(d,[(x+90,y-15),(x+1030/count,y-15)],GOLD,5)
        return True
    if layout=='sheet':
        rounded(d,(760,205,1715,780),CREAM,GOLD,28,6)
        concept_text(d,labels[0],(810,220,1660,300),38,INK,False)
        line(d,[(810,315),(1660,315)],GOLD,7)
        for i,value in enumerate(labels[1:]):
            y=340+i*345/max(1,len(labels)-1)
            concept_text(d,value,(815,y,1440,y+72),30,INK,False)
            line(d,[(1450,y+52),(1645,y+52)],TEAL,4)
        return True
    if layout=='evidence':
        points=[(1240,265),(850,650),(1630,650)]
        d.line(points+[points[0]],fill=GOLD,width=9)
        for i,value in enumerate(labels[:3]):
            x,y=points[i]
            concept_box(d,(x-175,y-70,x+175,y+70),value,fill=INK if i==2 else TEAL,size=30)
        return True
    return False

def draw_concept(image,scene,variant=None):
    layout,labels=CONCEPTS[scene['id']]
    d=ImageDraw.Draw(image)
    x0,y0,x1,y1=670,165,1810,815
    rounded(d,(x0,y0,x1,y1),DEEP,GOLD,42,6)
    if variant=='learning_loop':
        draw_semantic(d,'loop',['SIGNAL','QUESTION','TEST','REVIEW','DECISION'])
        return
    if variant and layout!='finale':
        source_art(image,variant,(715,188,1360,785))
        concept_box(d,(1390,255,1770,430),variant.upper(),size=38)
        concept_box(d,(1390,470,1770,690),labels[0],size=32)
        return
    if layout=='sam':
        source_art(image,'sam',(710,192,1430,760))
        for i,value in enumerate(labels[:3]):
            concept_box(d,(1460,225+i*170,1780,355+i*170),value,size=31)
        return
    if layout=='finale':
        if variant=='sam':
            source_art(image,'sam',(730,190,1450,770))
            for i,value in enumerate(labels[:3]):
                concept_box(d,(1480,225+i*170,1780,355+i*170),value,size=28)
            return
        if variant=='cover':
            source_art(image,'cover',(1030,185,1510,780))
            for i,value in enumerate(labels[:3]):
                concept_box(d,(735,240+i*170,1000,370+i*170),value,size=25)
            return
        source_art(image,'sam',(690,175,1370,665))
        source_art(image,'cover',(1450,187,1770,655))
        for i,value in enumerate(labels[:3]):
            concept_box(d,(720+i*350,690,1035+i*350,790),value,size=25)
        return
    if draw_semantic(d,layout,labels):return
    if layout=='priority':
        for i in range(15):
            xx=725+(i%5)*205; yy=205+(i//5)*95
            concept_box(d,(xx,yy,xx+170,yy+70),f'{i+1:02d}',size=31)
        concept_box(d,(735,535,1760,755),labels[1]+'  →  '+labels[2],fill=INK,size=45)
        return
    if layout in ('ledger','feedback'):
        headers=labels[1:] if layout=='feedback' else labels
        count=len(headers)
        width=1040/count
        for i,heading in enumerate(headers):
            xx=715+i*width
            concept_box(d,(xx,215,xx+width-13,305),heading,size=25)
        examples=[
            ('F01 · “I clicked begin and could not tell if anything happened.”','begin','confirm action'),
            ('F02 · “I came back later and could not find where I left off.”','return','resume reliably'),
            ('F03 · summary: instructions too long','start','clear guidance'),
            ('F04 · summary: staff explained task','staff help','short instruction'),
            ('F05 · source note pending','—','—'),
            ('F06 · source note pending','—','—'),
        ]
        for row in range(6 if layout=='feedback' and scene['id']=='L05-02' else 3):
            yy=325+row*(70 if layout=='feedback' and scene['id']=='L05-02' else 130)
            row_height=62 if layout=='feedback' and scene['id']=='L05-02' else 106
            for i in range(count):
                xx=715+i*width
                rounded(d,(xx,yy,xx+width-13,yy+row_height),CREAM,GOLD if row==1 else '#78969a',12,3)
                if layout=='feedback' and scene['id']=='L05-02':
                    value=examples[row][i]
                    face=font(17)
                    for j,part in enumerate(wrap(d,value,face,width-25)[:3]):
                        d.text((xx+10,yy+4+j*19),part,font=face,fill=INK)
                elif i==0:
                    value=(f'F{row+1:02d}' if layout=='feedback' else f'OPTION {chr(65+row)}')
                    concept_text(d,value,(xx+8,yy+10,xx+width-22,yy+96),25,INK,True)
                else:
                    line(d,[(xx+25,yy+42),(xx+width-44,yy+42)],TEAL,5)
        return
    if layout in ('matrix','roles'):
        for i,value in enumerate(labels[:4]):
            xx=710+(i%2)*535; yy=200+(i//2)*295
            concept_box(d,(xx,yy,xx+495,yy+255),value,size=34)
        return
    if layout=='inbox':
        for i,value in enumerate(labels[:6]):
            xx=725+(i%3)*350;yy=205+(i//3)*190
            concept_box(d,(xx,yy,xx+305,yy+150),value,size=42)
        concept_box(d,(725,625,1755,775),labels[-1],fill=INK,size=42)
        return
    if layout in ('comparison','branch','cards'):
        count=min(3,len(labels))
        width=1020/count
        for i,value in enumerate(labels[:count]):
            xx=715+i*(width+10)
            concept_box(d,(xx,235,xx+width-25,565),value,fill=INK if i==0 else TEAL,size=37)
        if len(labels)>count:
            concept_box(d,(735,625,1765,765),labels[-1],size=32)
        return
    if layout in ('flow','trace','reverse','timeline','loop','archive'):
        count=len(labels);gap=16;width=(1050-gap*(count-1))/count
        for i,value in enumerate(labels):
            xx=715+i*(width+gap)
            concept_box(d,(xx,300,xx+width,600),value,fill=INK if i==count-1 else TEAL,size=28 if count>=5 else 36)
            if i<count-1 and count<=3:line(d,[(xx+width+2,450),(xx+width+gap-2,450)],GOLD,4)
        if layout=='loop':
            d.arc((795,225,1710,690),5,180,fill=GOLD,width=7)
        return
    if layout in ('boundary','correction','evidence','handoff','contrast','focus','measure'):
        count=min(3,len(labels));width=(1050-20*(count-1))/count
        for i,value in enumerate(labels[:count]):
            xx=715+i*(width+20)
            fill=INK if i==count-1 else TEAL
            concept_box(d,(xx,255,xx+width,620),value,fill=fill,size=31 if count==3 else 40)
        if len(labels)>count:
            concept_box(d,(735,670,1765,775),labels[-1],size=29)
        return
    if layout in ('sheet','checkpoint','numbered','question','decision'):
        if layout=='question' or layout=='decision':
            concept_box(d,(725,215,1755,470),labels[0],fill=INK,size=47)
            remaining=labels[1:]
            for i,value in enumerate(remaining):
                xx=730+i*(1020/len(remaining))
                concept_box(d,(xx,540,xx+1000/len(remaining)-15,755),value,size=32)
            return
        header=labels[0]
        concept_box(d,(725,205,1755,310),header,fill=INK,size=39)
        fields=labels[1:]
        columns=2 if len(fields)>3 else 1
        rows=math.ceil(len(fields)/columns)
        for i,value in enumerate(fields):
            col=i%columns;row=i//columns
            width=(1020-18*(columns-1))/columns
            height=(420-16*(rows-1))/rows
            xx=730+col*(width+18);yy=345+row*(height+16)
            concept_box(d,(xx,yy,xx+width,yy+height),value,size=30)
        return
    raise AssertionError((scene['id'],layout))

def render(lesson, scene, index, presenter=False, variant=None):
    image=Image.new('RGB',(1920,1080),DEEP)
    d=ImageDraw.Draw(image)
    for y in range(0,885):
        ratio=y/885
        d.line([(0,y),(1919,y)],fill=(int(16+17*ratio),int(40+33*ratio),int(50+33*ratio)))
    for x in range(80,1900,110):
        line(d,[(x,70),(x,870)],'#254650',1)
    line(d,[(0,885),(1920,885)],GOLD,5)
    d.text((95,55),'AMADUTOWN  /  ACCELERATED',font=font(29),fill=GOLD_LIGHT)
    d.text((1520,55),f"{lesson['id']}  /  {scene['scene_number']:02d}",font=font(28),fill=MUTED)
    title=short_title(scene)
    face=font(53,True)
    for i,part in enumerate(wrap(d,title,face,500)[:5]):
        d.text((95,185+i*68),part,font=face,fill=CREAM)
    artifact=lesson['learner_artifact'].replace('Decision-file','Decision File').replace('PRD','product brief')
    for j,part in enumerate(wrap(d,artifact,font(27),480)[:3]):
        d.text((100,625+j*35),part,font=font(27),fill=MUTED)
    line(d,[(100,750),(560,750)],GOLD,5)
    for j in range(len(lesson['scenes'])):
        px=115+j*(440/max(1,len(lesson['scenes'])-1))
        d.ellipse((px-13,775,px+13,801),fill=GOLD_LIGHT if j==index else TEAL,outline=GOLD,width=3)
    if not presenter:
        draw_concept(image,scene,variant)
    return image

def main():
    data=json.loads(SOURCE.read_text())
    FRAME_DIR.mkdir(parents=True,exist_ok=True)
    PRESENTER_DIR.mkdir(parents=True,exist_ok=True)
    rows=[]
    assert set(CONCEPTS)=={s['id'] for l in data['lessons'] for s in l['scenes']}
    for lesson in data['lessons']:
        for index,scene in enumerate(lesson['scenes']):
            assert hashlib.sha256((ROOT/scene['script_path']).read_bytes()).hexdigest()==scene['script_sha256'],scene['id']+' script drift'
            assert hashlib.sha256(scene['narration'].encode()).hexdigest()==scene['narration_sha256'],scene['id']+' narration drift'
            title=short_title(scene)
            assert not re.search(r'presenter|storyboard|provider|source script|internal|QA|→|/',title,re.I),scene['id']
            dest=FRAME_DIR / f"{scene['id']}.png"
            render(lesson,scene,index).save(dest,optimize=True)
            presenter_dest=PRESENTER_DIR / f"{scene['id']}.png"
            render(lesson,scene,index,presenter=True).save(presenter_dest,optimize=True)
            entry={'scene_id':scene['id'],'source_script_sha256':scene['script_sha256'],'start_seconds':scene['start_seconds'],'end_seconds':scene['end_seconds'],'visual_layout':CONCEPTS[scene['id']][0],'title':title,'frame_path':str(dest.relative_to(ROOT)),'frame_sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'presenter_frame_path':str(presenter_dest.relative_to(ROOT)),'presenter_frame_sha256':hashlib.sha256(presenter_dest.read_bytes()).hexdigest()}
            if scene['id'] in ART_BEATS:
                entry['segments']=[]
                assert sum(duration for _,duration in ART_BEATS[scene['id']])==scene['duration_seconds']
                for beat,(variant,duration) in enumerate(ART_BEATS[scene['id']]):
                    segment=dest if variant=='main' else FRAME_DIR/f"{scene['id']}-{variant}.png"
                    if variant!='main':render(lesson,scene,index,variant=variant).save(segment,optimize=True)
                    entry['segments'].append({'kind':variant,'duration_seconds':duration,'frame_path':str(segment.relative_to(ROOT)),'frame_sha256':hashlib.sha256(segment.read_bytes()).hexdigest()})
            rows.append(entry)
            print(scene['id'],CONCEPTS[scene['id']][0],dest.stat().st_size)
    receipt={'schema_version':1,'source_manifest_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'scene_concepts_sha256':hashlib.sha256((pathlib.Path(__file__).parent/'accelerated-scene-concepts.tsv').read_bytes()).hexdigest(),'source_art_sha256':{name:hashlib.sha256((ROOT/path).read_bytes()).hexdigest() for name,path in ART_ASSETS.items()},'scene_count':len(rows),'scenes':rows}
    (OUT/'scene-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')

if __name__=='__main__':main()
