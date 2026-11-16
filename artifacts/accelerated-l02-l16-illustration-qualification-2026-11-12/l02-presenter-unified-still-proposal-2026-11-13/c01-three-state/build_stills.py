#!/usr/bin/env python3
"""Source-bound C01 stills. Review only; no video or learner media."""
from hashlib import sha256
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import json

ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
PHOTO=ROOT/'public/showcases/service-photographic'
SOURCES={
 'welcome':PHOTO/'ai-email-sequence-templates-hero.jpg',
 'task':PHOTO/'client-onboarding-automation-hero.jpg',
 'dashboard':PHOTO/'custom-reporting-dashboard-secondary.jpg',
}
LABELS={
 'welcome':'Rewrite its welcome email.',
 'task':'Add a guided first task.',
 'dashboard':'Build a dashboard for staff.',
}
CAPTIONS={
 'welcome':'Rewrite its welcome email.',
 'task':'Add a guided first task.',
 'dashboard':'Build a dashboard for staff.',
}
INK='#102d35';DEEP='#0c2630';GOLD='#d8b774';CREAM='#f4efe4';PAPER='#fffdf6';MUTED='#95aab0'
FONT='/System/Library/Fonts/Avenir Next.ttc'

def digest(p): return sha256(p.read_bytes()).hexdigest()
def font(size,bold=False): return ImageFont.truetype(FONT,size,index=0 if bold else 7)
def fit(im,box):
 x,y,w,h=box;sw,sh=im.size;scale=max(w/sw,h/sh);nw,nh=round(sw*scale),round(sh*scale)
 im=im.resize((nw,nh),Image.Resampling.LANCZOS)
 return im.crop(((nw-w)//2,(nh-h)//2,(nw+w)//2,(nh+h)//2))
def rr(d,box,r,fill,outline=None,width=1): d.rounded_rectangle(box,r,fill=fill,outline=outline,width=width)
def line(d,xy,fill,width): d.line(xy,fill=fill,width=width,joint='curve')

def ui_email(d,box,k):
 x,y,w,h=box
 # Two message sheets, with the foreground sheet visibly revised.
 rr(d,(x+int(.05*w),y+int(.14*h),x+int(.70*w),y+int(.86*h)),int(.04*w),'#dfe5df')
 for i,f in enumerate([.32,.56,.46,.60]):
  yy=y+int((.34+i*.12)*h);rr(d,(x+int(.12*w),yy,x+int((.12+f)*w),yy+int(.018*h)),int(.01*w),'#a8b8b7')
 rr(d,(x+int(.28*w),y+int(.06*h),x+int(.96*w),y+int(.80*h)),int(.04*w),PAPER,GOLD,max(2,int(.004*w)))
 rr(d,(x+int(.34*w),y+int(.13*h),x+int(.90*w),y+int(.22*h)),int(.02*w),'#e8efeb')
 for i,f in enumerate([.48,.39,.52,.34]):
  yy=y+int((.31+i*.11)*h);rr(d,(x+int(.34*w),yy,x+int((.34+f)*w),yy+int(.02*h)),int(.01*w),'#819da1' if i else GOLD)
 # Gold revision marker stays on the content, with no success claim.
 line(d,[(x+int(.33*w),y+int(.69*h)),(x+int(.70*w),y+int(.69*h))],GOLD,max(3,int(.008*w)))

def ui_task(d,box,k):
 x,y,w,h=box
 # A starting point and a bounded path; no completion checkmarks.
 cx=x+int(.52*w)
 for i in range(3):
  yy=y+int((.12+i*.28)*h);active=i==0
  rr(d,(x+int(.12*w),yy,x+int(.90*w),yy+int(.21*h)),int(.034*w),PAPER if active else '#e3eae6',GOLD if active else '#c4d1cf',max(2,int(.003*w)))
  rr(d,(x+int(.18*w),yy+int(.058*h),x+int(.28*w),yy+int(.154*h)),int(.015*w),GOLD if active else '#b7c7c5')
  rr(d,(x+int(.34*w),yy+int(.075*h),x+int(.72*w),yy+int(.099*h)),int(.01*w),INK if active else '#a0b4b5')
  rr(d,(x+int(.34*w),yy+int(.13*h),x+int(.58*w),yy+int(.15*h)),int(.01*w),'#8da7aa' if active else '#b9c9c8')
  if i<2:
   line(d,[(cx,yy+int(.21*h)),(cx,yy+int(.28*h))],GOLD if active else '#b4c5c2',max(3,int(.006*w)))

def ui_dashboard(d,box,k):
 x,y,w,h=box
 rr(d,(x+int(.05*w),y+int(.06*h),x+int(.95*w),y+int(.93*h)),int(.035*w),PAPER)
 rr(d,(x+int(.05*w),y+int(.06*h),x+int(.95*w),y+int(.18*h)),int(.035*w),INK)
 for i in range(3): rr(d,(x+int((.10+i*.045)*w),y+int(.11*h),x+int((.12+i*.045)*w),y+int(.135*h)),int(.01*w),GOLD)
 for i in range(3):
  yy=y+int((.25+i*.20)*h)
  rr(d,(x+int(.11*w),yy,x+int(.89*w),yy+int(.15*h)),int(.018*w),'#e7eeeb',GOLD if i==0 else None,max(2,int(.003*w)))
  rr(d,(x+int(.15*w),yy+int(.04*h),x+int(.46*w),yy+int(.065*h)),int(.01*w),'#57747a')
  rr(d,(x+int(.15*w),yy+int(.09*h),x+int(.38*w),yy+int(.108*h)),int(.01*w),'#9eb5b6')
  rr(d,(x+int(.72*w),yy+int(.045*h),x+int(.82*w),yy+int(.11*h)),int(.012*w),'#cad8d1')

DRAW={'welcome':ui_email,'task':ui_task,'dashboard':ui_dashboard}

def shadow_card(im,box):
 layer=Image.new('RGBA',im.size);d=ImageDraw.Draw(layer)
 rr(d,(box[0]+8,box[1]+12,box[2]+8,box[3]+12),32,(0,0,0,85))
 layer=layer.filter(ImageFilter.GaussianBlur(21));return Image.alpha_composite(im,layer)

def make(kind,mobile,caption):
 W,H=(390,844) if mobile else (1920,1080)
 im=Image.new('RGBA',(W,H),DEEP)
 photo=Image.open(SOURCES[kind]).convert('RGB')
 if mobile:
  photo_box=(0,0,W,410 if not caption else 365)
  im.paste(fit(photo,(0,0,photo_box[2],photo_box[3])),photo_box)
  panel_top=338 if not caption else 305
  d=ImageDraw.Draw(im)
  rr(d,(0,panel_top,W,H),0,DEEP)
  d.rectangle((0,panel_top,W,panel_top+6),fill=GOLD)
  d.text((22,panel_top+26),LABELS[kind],font=font(18,True),fill=CREAM)
  card=(18,panel_top+82,372,730 if not caption else 655)
  im=shadow_card(im,card);d=ImageDraw.Draw(im)
  rr(d,card,24,'#d7e0d9')
  DRAW[kind](d,(card[0]+4,card[1]+3,card[2]-card[0]-8,card[3]-card[1]-6),kind)
  if caption:
   rr(d,(12,679,378,750),12,'#183841')
   words=CAPTIONS[kind]
   # Two short lines, centered within the optional caption treatment.
   wrap={'welcome':['Rewrite its','welcome email.'],
         'task':['Add a guided','first task.'],
         'dashboard':['Build a dashboard','for staff.']}[kind]
   for i,t in enumerate(wrap):
    bb=d.textbbox((0,0),t,font=font(17,True));d.text(((W-(bb[2]-bb[0]))/2,691+i*25),t,font=font(17,True),fill='white')
  # Native control envelope, visual QA guide only.
  d.rectangle((0,774,W,844),fill='#071b22')
  d.rounded_rectangle((20,804,370,808),2,fill='#87999b')
  d.rounded_rectangle((20,804,100,808),2,fill=GOLD)
  d.ellipse((21,794,31,804),fill='white')
 else:
  left=920
  im.paste(fit(photo,(0,0,left,H)),(0,0))
  d=ImageDraw.Draw(im)
  d.rectangle((left-6,0,left,H),fill=GOLD)
  d.rectangle((left,0,W,H),fill=DEEP)
  d.text((1010,72),LABELS[kind],font=font(34,True),fill=CREAM)
  card=(1000,165 if caption else 205,1835,825 if caption else 925)
  im=shadow_card(im,card);d=ImageDraw.Draw(im)
  rr(d,card,34,'#d7e0d9')
  DRAW[kind](d,(card[0]+10,card[1]+8,card[2]-card[0]-20,card[3]-card[1]-16),kind)
  if caption:
   rr(d,(986,846,1850,935),16,'#183841')
   t=CAPTIONS[kind];bb=d.textbbox((0,0),t,font=font(31,True))
   d.text((1418-(bb[2]-bb[0])/2,867),t,font=font(31,True),fill='white')
  # Control overlay only in caption-on QA state.
  if caption:
   d.rectangle((0,980,W,H),fill='#071b22')
   d.rounded_rectangle((40,1030,1880,1036),3,fill='#87999b')
   d.rounded_rectangle((40,1030,390,1036),3,fill=GOLD)
 return im.convert('RGB')

def main():
 OUT.mkdir(exist_ok=True)
 for kind in SOURCES:
  for mobile in (False,True):
   for caption in (False,True):
    name=f'{kind}-{("mobile-390x844" if mobile else "desktop-1920x1080")}-{("caption-on" if caption else "clean")}.png'
    make(kind,mobile,caption).save(OUT/name,optimize=True)
 sources={str(p.relative_to(ROOT)):{'sha256':digest(p),'dimensions':Image.open(p).size,
  'status':'approved public AmaduTown service-gallery visual; used as conceptual scene context, not customer evidence'} for p in SOURCES.values()}
 (OUT/'source-map.json').write_text(json.dumps({'source_assets':sources,
  'drive_sources_examined_not_reused':['Artifacts /Company Materials/ODI Journey for Systems.png',
  'Artifacts /Client Onboarding /Screenshot_20260131-201922.png',
  'Artifacts /Promotional /Accelerated Building Smarter Products with AI/Final/Accelerated_infographic.png'],
  'why_not_reused':'Their source labels, external workflow, or broad framework do not depict the three synthetic membership-service requests.'},indent=2)+'\n')

if __name__=='__main__':main()
