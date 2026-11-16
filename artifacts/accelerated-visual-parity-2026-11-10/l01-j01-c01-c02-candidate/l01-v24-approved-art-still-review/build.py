#!/usr/bin/env python3
"""Source-authored L01 illustration layout stills only; no media mutation."""
import hashlib
import json
import re
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[4]
BASE=ROOT/'artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate'
OUT=Path(__file__).resolve().parent
SOURCE={
 'v13':(BASE/'c01-c02-v13-playback-review/l01-c01-c02-v13-review.mp4','e900e636b6f63eac2f177f8f585d4e14fcf166b8435af218327939ec5976e518'),
 'vtt':(BASE/'c01-c02-v18-optional-caption-feasibility/lower-captions.vtt','427376480d444d321513ddc09c226e7896967909d8baa790b1569dd4a79b508b'),
 'p01_base':(BASE/'p01-middle-base.png','ae7b6ba63739c8d45ecf9f3edeb4f0b487075ed78032d32059c845156d404071'),
 'p01_frame':(BASE/'c01-c02-v20-16x9-still-review/P01-source-1280x720.png','0296f81420b9362b2e8abcbd6acbe38ae7ae66ad9a45f660447e03ae7996aa61'),
 'p02_frame':(BASE/'c01-c02-v20-16x9-still-review/P02-source-1280x720.png','9d4109843cf49e35a1aa102d3ced6cecb6819584790b211b3eb2a26318f3d896'),
 'human_review':(BASE/'c01-visual-still-audit-v13/sources/acc_trailer_img_4.2.2.png','1f3a4163c9467117fd7621d41a72afb5e8a203a8fb6142c5d1dedeca0a23209e'),
 'book':(ROOT/'public/accelerated_cover_ebook.webp','4a3406389e73fb919ba2c005475a8c707060103cee8b589ac16c8e68e42ab78d'),
 'sam':(ROOT/'public/showcases/service-prototypes/accelerated-sam-infographic.png','13ef37fb39a228c79253538174cd9b3d77f6c7e630e9929dfa99e6cfa97f45c6'),
 'signals':(ROOT/'public/showcases/service-prototypes/v2/sam-signals-plate.webp','8554d40fb4e5471c61c7c3e530da80bfa07c7a77ab34afb79eecfb9945985e6c'),
 'alignment':(ROOT/'public/showcases/service-prototypes/v2/sam-alignment-plate.webp','82b9fd4429387182e4fab545ecd11a3cd7174794fd9c9b0f9fbda6606b4c72a0'),
 'momentum':(ROOT/'public/showcases/service-prototypes/v2/sam-momentum-plate.webp','8b32de9f499e3fdefadcb847ac1032dac27405f74fde844af9c53ae1b4a5d2d3'),
}
BEATS=[
 ('P01',5.0,'P01 Q3 plan and decision'),
 ('C01-inputs',82.2,'C01 three competing inputs'),
 ('C01-evidence',97.0,'C01 signal to decision file'),
 ('C01-human',120.0,'C01 human judgment'),
 ('SAM-orientation',160.7,'SAM three-path orientation'),
 ('Signals',174.4,'Signals raw material'),
 ('Alignment',180.9,'Alignment shared direction'),
 ('Momentum',185.9,'Momentum learning rhythm'),
 ('SAM-crossing',205.4,'SAM paths crossing'),
 ('P02-Sam',237.8,'Sam is a teaching story'),
]
FONT='/System/Library/Fonts/Avenir Next.ttc'
GEORGIA='/System/Library/Fonts/Supplemental/Georgia.ttf'
NAVY=(9,30,40);GOLD=(221,173,80);WHITE=(248,243,232)
PRESENTER=[748,216,504,288]

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def font(size,bold=False):return ImageFont.truetype(FONT,size,index=2 if bold else 0)
def preflight():
 for path,expected in SOURCE.values():assert path.is_file() and sha(path)==expected,f'source drift: {path}'

def cue_at(t):
 content=SOURCE['vtt'][0].read_text();rows=[]
 pattern=r'(?m)^\d+\n(\d\d):(\d\d):(\d\d)\.(\d{3}) --> (\d\d):(\d\d):(\d\d)\.(\d{3}) line:72%\n(.+?)(?=\n\n|\Z)'
 for m in re.finditer(pattern,content,re.S):
  v=[int(m.group(i)) for i in range(1,9)]
  a=v[0]*3600+v[1]*60+v[2]+v[3]/1000;b=v[4]*3600+v[5]*60+v[6]+v[7]/1000
  rows.append((a,b,m.group(9)))
 assert len(rows)==175
 return next((text for a,b,text in rows if a<=t<b),'')

def ground():
 im=Image.new('RGB',(1280,720));px=im.load()
 for y in range(720):
  t=y/719
  color=(round(9+15*t),round(30+28*t),round(40+26*t))
  for x in range(1280):px[x,y]=color
 return im

def place(frame,asset,box):
 x1,y1,x2,y2=box;art=asset.copy();art.thumbnail((x2-x1,y2-y1),Image.Resampling.LANCZOS)
 x=x1+(x2-x1-art.width)//2;y=y1+(y2-y1-art.height)//2
 if art.mode=='RGBA':frame.paste(art,(x,y),art)
 else:frame.paste(art,(x,y))
 return [x,y,art.width,art.height]

def presenter(frame,key):
 source=Image.open(SOURCE[key][0]).convert('RGB')
 face=source.crop((756,232,1204,488)).resize((504,288),Image.Resampling.LANCZOS)
 d=ImageDraw.Draw(frame);x,y,w,h=PRESENTER
 d.rectangle((x-4,y-4,x+w+4,y+h+4),fill=GOLD)
 frame.paste(face,(x,y))
 return PRESENTER

def label(frame,text,x=48,y=36,size=46):
 d=ImageDraw.Draw(frame);d.text((x,y),text,font=ImageFont.truetype(GEORGIA,size),fill=WHITE)
 return [x,y,*d.textbbox((x,y),text,font=ImageFont.truetype(GEORGIA,size))[2:]]

def picture(name,mobile=False):
 frame=ground();rects={}
 if name=='P01':
  label(frame,'The blank document',48,28,43)
  d=ImageDraw.Draw(frame)
  d.rounded_rectangle((45,125,705,635),radius=26,fill=(231,222,204),outline=GOLD,width=5)
  d.text((85,158),'Q3 INNOVATION PLAN',font=font(43,True),fill=(28,48,51))
  d.line((83,223,667,223),fill=GOLD,width=4)
  d.text((83,266),'Decision to make',font=font(38,True),fill=(25,51,54))
  d.line((85,338,660,338),fill=(59,105,108),width=4)
  rects['document']=[45,125,660,510]
  rects['presenter']=presenter(frame,'p01_frame')
 elif name=='C01-inputs':
  art=Image.open(SOURCE['human_review'][0]).convert('RGB')
  rects['review_art']=place(frame,art,(0,0,1280,720))
  wash=Image.new('RGBA',(1280,720),(0,0,0,0));d=ImageDraw.Draw(wash)
  d.rectangle((0,0,1280,170),fill=(3,18,27,222))
  for i,copy in enumerate(('Customer problem','Competing story','Missing number')):
   x=50+i*415;d.text((x,49),copy,font=font(38,True),fill=WHITE)
   d.line((x,119,x+360,119),fill=GOLD,width=4)
  frame=Image.alpha_composite(frame.convert('RGBA'),wash).convert('RGB')
  rects['input_words_source']='approved narration at 78.16–87.39s'
 elif name=='C01-evidence':
  rects['signals_art']=place(frame,Image.open(SOURCE['signals'][0]).convert('RGBA'),(50,35,500,700))
  d=ImageDraw.Draw(frame);d.rounded_rectangle((585,125,1220,615),radius=24,fill=(231,222,204),outline=GOLD,width=5)
  d.text((625,170),'Q3 INNOVATION PLAN',font=font(41,True),fill=(28,48,51))
  d.line((625,237,1180,237),fill=GOLD,width=4)
  d.text((625,280),'Decision to make',font=font(37,True),fill=(25,51,54))
  d.line((625,353,1170,353),fill=(59,105,108),width=4)
  rects['decision_art']=[585,125,635,490]
 elif name=='C01-human':
  rects['review_art']=place(frame,Image.open(SOURCE['human_review'][0]).convert('RGB'),(0,0,1280,720))
 elif name in ('SAM-orientation','SAM-crossing'):
  if mobile:
   d=ImageDraw.Draw(frame);heading=ImageFont.truetype(GEORGIA,38)
   for text,x in (('Signals',42),('Alignment',253),('Momentum',520)):
    d.text((x,30),text,font=heading,fill=WHITE)
   for start,tip in ((183,224),(449,490)):
    d.line((start,55,tip-12,55),fill=GOLD,width=5)
    d.polygon(((tip-14,45),(tip,55),(tip-14,65)),fill=GOLD)
   rects['path_heading']={'labels':['Signals','Alignment','Momentum'],'drawn_arrows':[[183,45,224,65],[449,45,490,65]]}
   boxes=[(56,130,380,610),(455,130,800,610),(865,150,1220,590)]
   for key,box in zip(('signals','alignment','momentum'),boxes):
    rects[key]=place(frame,Image.open(SOURCE[key][0]).convert('RGBA'),box)
   rects['mobile_reflow']='complete map unavailable at readable 352px; approved plates and same path relationship'
  else:
   rects['complete_map']=place(frame,Image.open(SOURCE['sam'][0]).convert('RGB'),(245,28,1035,705))
 elif name in ('Signals','Alignment','Momentum'):
  label(frame,name,48,32,48)
  key=name.lower();box=(387,10,893,710) if key!='momentum' else (342,65,938,660)
  rects['art']=place(frame,Image.open(SOURCE[key][0]).convert('RGBA'),box)
 elif name=='P02-Sam':
  rects['book_cover']=place(frame,Image.open(SOURCE['book'][0]).convert('RGB'),(85,18,605,705))
  label(frame,'Sam',620,80,51)
  rects['presenter']=presenter(frame,'p02_frame')
 else:raise AssertionError(name)
 return frame,rects

def wrap(draw,copy,face,width):
 result=[];current=''
 for word in copy.split():
  trial=(current+' '+word).strip()
  if current and draw.textbbox((0,0),trial,font=face)[2]>width:result.append(current);current=word
  else:current=trial
 if current:result.append(current)
 return result

def player(frame,t,width,captions):
 pic=frame.resize((width,round(width*720/1280)),Image.Resampling.LANCZOS)
 cap_h=54 if width==352 else 84;ctl_h=50 if width==352 else 64
 out=Image.new('RGB',(width,pic.height+(cap_h if captions else 0)+ctl_h),(7,24,32));out.paste(pic,(0,0));d=ImageDraw.Draw(out)
 y=pic.height
 if captions:
  d.rectangle((0,y,width,y+cap_h),fill=(7,23,31));d.line((0,y,width,y),fill=GOLD,width=2)
  copy=cue_at(t);face=font(17 if width==352 else 34,True);lines=wrap(d,copy,face,width-(22 if width==352 else 80))
  assert copy and len(lines)<=2,(t,copy,lines)
  step=23 if width==352 else 43
  for i,line in enumerate(lines):
   bounds=d.textbbox((0,0),line,font=face)
   d.text(((width-(bounds[2]-bounds[0]))//2,y+(cap_h-len(lines)*step)//2+i*step),line,font=face,fill=WHITE)
  y+=cap_h
 d.rectangle((0,y,width,out.height),fill=(4,13,20))
 d.polygon([(16,y+15),(16,y+31),(29,y+23)],fill=WHITE)
 m,s=divmod(int(t),60);d.text((42,y+15),f'{m}:{s:02d} / 5:45',font=font(15 if width==352 else 21,True),fill=WHITE)
 x=width-(78 if width==352 else 116);cy=y+23
 d.rectangle((x,cy-4,x+5,cy+4),fill=WHITE);d.polygon([(x+5,cy-4),(x+12,cy-9),(x+12,cy+9),(x+5,cy+4)],fill=WHITE)
 d.arc((x+10,cy-11,x+25,cy+11),-65,65,fill=WHITE,width=2)
 x=width-(39 if width==352 else 55);fy=y+14
 for points in ([(x+8,fy),(x,fy),(x,fy+8)],[(x+17,fy),(x+25,fy),(x+25,fy+8)],[(x,fy+17),(x,fy+25),(x+8,fy+25)],[(x+25,fy+17),(x+25,fy+25),(x+17,fy+25)]):d.line(points,fill=WHITE,width=2)
 d.line((16,out.height-8,width-16,out.height-8),fill=(140,151,154),width=3)
 d.line((16,out.height-8,16+(width-32)*t/345,out.height-8),fill=WHITE,width=3)
 return out

def main():
 preflight();OUT.mkdir(parents=True,exist_ok=True);outputs=[]
 for name,t,meaning in BEATS:
  for vp,width in [('desktop',1280),('390x844',352)]:
   frame,rects=picture(name,mobile=vp!='desktop')
   for captions in (False,True):
    image=player(frame,t,width,captions)
    if vp=='390x844':
     screen=Image.new('RGB',(390,844),(12,17,22));screen.paste(image,(19,200));image=screen
    path=OUT/f'{name}-{vp}-captions-{"on" if captions else "off"}.png';image.save(path,optimize=True)
    outputs.append({'beat':name,'time_seconds':t,'meaning':meaning,'viewport':vp,'captions':captions,'cue':cue_at(t),'path':path.name,'sha256':sha(path),'rects':rects})
 receipt={'status':'local_still_only_uncommitted_pending_visual_review','source_hashes':{key:{'path':str(path.relative_to(ROOT)),'sha256':digest} for key,(path,digest) in SOURCE.items()},'presenter_anchor_1280x720_xywh':PRESENTER,'presenter_frame_occupancy':round(PRESENTER[2]*PRESENTER[3]/(1280*720),6),'picture_px':[1280,720],'mobile_picture_css_px':[352,198],'source_cue_count':175,'outputs':outputs,'unresolved':['C02 data-use boundary 248.69–345s: no approved finished illustration; generated v22/v23 concept remains unapproved and is excluded.'],'limits':['Simulated accessible-control geometry and caption rail, not native player proof.','Mobile SAM reflows the three approved plates instead of shrinking the complete infographic; desktop preserves the complete source map.','No video, VTT, audio, timing, learner binding, PR, provider, or deployment changed.']}
 (OUT/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print('built',len(outputs),'stills')

if __name__=='__main__':main()
