#!/usr/bin/env python3
"""Compose diversity-corrected flat matte Accelerated C02 plates into stills only."""
from pathlib import Path
from hashlib import sha256
import json
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance, ImageOps

ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
PLATES=OUT.parent/'l02-c02-book-style-flat-source-plates-2026-11-13'
SCRIPT=OUT.parent/'l02-narration-job-pack/l02-narration-job-pack.json'
FONT='/System/Library/Fonts/Avenir Next.ttc'
NAVY=(12,35,51);PAPER=(248,241,226);GOLD='#deb767';BRONZE='#9b6f2c';CREAM='#f7eee0';MUTED='#c7c1b6';SLATE='#3c5867'
COPY={
 'customer':('Customer','Which request responds to a real, urgent job?','The staff dashboard may leave the member’s first step untouched.'),
 'company':('Company','What can this team actually deliver and maintain?','The welcome email may be easy to ship.'),
 'competition':('Competition','How is the need handled now?','The current alternative may be a spreadsheet or another person.'),
 'product':('Product','What is the smallest offer that could show value?','The guided task might help people begin but could add burden.'),
}
SCALE=2
def digest(p):return sha256(p.read_bytes()).hexdigest()
def font(size,bold=False):return ImageFont.truetype(FONT,size*SCALE,index=0 if bold else 7)
def tx(d,t,x,y,size,fill=CREAM,bold=False,stroke=0):
 d.text((x*SCALE,y*SCALE),t,font=font(size,bold),fill=fill,stroke_width=stroke*SCALE,stroke_fill='#060919')
def wrap(d,t,size,width,bold=False):
 f=font(size,bold);rows=[];line=''
 for word in t.split():
  candidate=(line+' '+word).strip()
  if line and d.textbbox((0,0),candidate,font=f)[2]>width*SCALE:rows.append(line);line=word
  else:line=candidate
 if line:rows.append(line)
 return rows
def lines(d,t,x,y,size,width,leading,fill=CREAM,bold=False,max_lines=4,stroke=0):
 rows=wrap(d,t,size,width,bold)
 if len(rows)>max_lines:raise ValueError('copy overflow '+t)
 for i,row in enumerate(rows):tx(d,row,x,y+i*leading,size,fill,bold,stroke)
 return len(rows)
def rr(d,box,r,fill):d.rounded_rectangle(tuple(int(v*SCALE) for v in box),radius=r*SCALE,fill=fill)
def plate(kind):
 name=f'{kind}-flat-matte.png' if kind=='product' else f'{kind}-flat-matte-diverse.png'
 return Image.open(PLATES/name).convert('RGB')
def place_crop(canvas,source,source_box,dest_box,feather=14):
 x1,y1,x2,y2=dest_box;w,h=(x2-x1)*SCALE,(y2-y1)*SCALE
 art=ImageOps.fit(source.crop(source_box),(w,h),method=Image.Resampling.LANCZOS)
 if feather:
  mask=Image.new('L',(w,h));md=ImageDraw.Draw(mask)
  inset=feather*SCALE
  md.rectangle((inset,inset,w-inset,h-inset),fill=255)
  mask=mask.filter(ImageFilter.GaussianBlur(feather*SCALE*.62))
  canvas.paste(art,(x1*SCALE,y1*SCALE),mask)
 else:canvas.paste(art,(x1*SCALE,y1*SCALE))

def desktop(kind,caption):
 W,H=1920,1080;light=kind=='customer';im=Image.new('RGB',(W*SCALE,H*SCALE),PAPER if light else NAVY)
 source=plate(kind)
 # Full source plate is preserved at near-native size; typography lives in its own left rail.
 art=source.resize((1570*SCALE,884*SCALE),Image.Resampling.LANCZOS)
 im.paste(art,(350*SCALE,46*SCALE))
 d=ImageDraw.Draw(im)
 accent=BRONZE if light else GOLD;body=SLATE if light else CREAM;secondary=SLATE if light else MUTED
 d.rectangle((330*SCALE,46*SCALE,337*SCALE,930*SCALE),fill=accent)
 tx(d,'ACCELERATED',38,58,16,accent,True)
 tx(d,'THE FOUR Cs',38,85,15,secondary,True)
 title,question,case=COPY[kind]
 fs=37 if kind=='competition' else 47
 tx(d,title.upper(),38,195,fs,body,True)
 d.rectangle((38*SCALE,270*SCALE,298*SCALE,273*SCALE),fill=accent)
 tx(d,'THE QUESTION',38,316,15,accent,True)
 n=lines(d,question,38,359,29,270,41,body,True,5)
 cy=max(590,359+n*41+56)
 tx(d,'CASE OBSERVATION',38,cy,15,accent,True)
 lines(d,case,38,cy+39,22,270,32,secondary,False,5)
 if caption:
  # Caption is added only in this state, over existing navy side-rail space.
  cap=wrap(d,question,20,270,True)
  yy=892-len(cap)*28
  for row in cap:tx(d,row,38,yy,20,body,True,0 if light else 1);yy+=28
 # The narrow player guide is independent of optional captions.
 d.rectangle((0,1031*SCALE,W*SCALE,H*SCALE),fill='#06091b')
 d.rounded_rectangle((25*SCALE,1054*SCALE,1895*SCALE,1058*SCALE),radius=2*SCALE,fill='#736f79')
 d.rounded_rectangle((25*SCALE,1054*SCALE,375*SCALE,1058*SCALE),radius=2*SCALE,fill=GOLD)
 d.polygon([(26*SCALE,1038*SCALE),(26*SCALE,1050*SCALE),(36*SCALE,1044*SCALE)],fill=CREAM)
 return im.resize((W,H),Image.Resampling.LANCZOS)

def mobile_reflow(im,source,kind):
 # Underlay carries the source plate texture into the caption area, so clean frames
 # have no dedicated empty caption strip. Foreground crops enlarge the key symbols.
 under=ImageOps.fit(source,(390*SCALE,600*SCALE),method=Image.Resampling.LANCZOS)
 under=under.filter(ImageFilter.GaussianBlur(86*SCALE))
 under=ImageEnhance.Brightness(under).enhance(.98 if kind=='customer' else .34)
 im.paste(under,(0,193*SCALE))
 if kind=='customer':
  for sb,db in [((255,0,650,325),(8,207,132,375)),((645,0,1035,325),(133,207,257,375)),((1030,0,1435,325),(258,207,382,375)),
                ((75,295,455,655),(10,383,166,604)),((575,245,1190,770),(156,378,382,619)),((650,690,1035,925),(125,596,270,706))]:place_crop(im,source,sb,db)
 elif kind=='company':
  for sb,db in [((300,0,670,350),(9,208,132,380)),((650,0,1020,350),(133,208,257,380)),((1000,0,1380,350),(258,208,382,380)),
                ((275,350,670,655),(8,381,191,578)),((1000,350,1410,655),(199,381,382,578)),((355,660,1330,940),(35,548,355,708))]:place_crop(im,source,sb,db)
 elif kind=='competition':
  for sb,db in [((590,0,1090,455),(83,204,307,447)),((160,420,690,880),(7,428,192,703)),((980,420,1510,880),(198,428,383,703))]:place_crop(im,source,sb,db)
 elif kind=='product':
  for sb,db in [((640,0,1030,295),(122,203,268,361)),((500,235,1180,790),(72,346,318,610)),
                ((145,220,585,625),(7,500,188,708)),((1080,220,1520,625),(202,500,383,708))]:place_crop(im,source,sb,db)

def mobile(kind,caption):
 W,H=390,844;light=kind=='customer';im=Image.new('RGB',(W*SCALE,H*SCALE),PAPER if light else NAVY);d=ImageDraw.Draw(im)
 accent=BRONZE if light else GOLD;body=SLATE if light else CREAM;secondary=SLATE if light else MUTED
 title,question,case=COPY[kind]
 tx(d,'ACCELERATED  /  THE FOUR Cs',18,12,11,accent,True)
 tx(d,title.upper(),18,31,33 if kind=='competition' else 37,body,True)
 qy=83;qn=lines(d,question,18,qy,18,354,24,body,True,3)
 cy=qy+qn*24+5;lines(d,case,18,cy,12,354,17,secondary,False,3)
 d.rectangle((18*SCALE,187*SCALE,372*SCALE,190*SCALE),fill=accent)
 source=plate(kind);mobile_reflow(im,source,kind)
 d=ImageDraw.Draw(im)
 if caption:
  # Text-only overlay on the artwork's dark lower texture; no opaque card or band.
  rows=wrap(d,question,16,350,True)
  yy=710
  for row in rows:tx(d,row,20,yy,16,body,True,0 if light else 2);yy+=21
 d.rectangle((0,805*SCALE,W*SCALE,H*SCALE),fill='#06091b')
 d.rounded_rectangle((18*SCALE,824*SCALE,372*SCALE,828*SCALE),radius=2*SCALE,fill='#736f79')
 d.rounded_rectangle((18*SCALE,824*SCALE,100*SCALE,828*SCALE),radius=2*SCALE,fill=GOLD)
 d.polygon([(19*SCALE,808*SCALE),(19*SCALE,821*SCALE),(30*SCALE,814*SCALE)],fill=CREAM)
 return im.resize((W,H),Image.Resampling.LANCZOS)

def main():
 OUT.mkdir(parents=True,exist_ok=True)
 script=SCRIPT.read_text().lower()
 anchors={'customer':"staff dashboard may improve visibility for employees while leaving the member's first step untouched",
 'company':'the welcome email may be easy to ship','competition':'even if the alternative is a spreadsheet or another person',
 'product':'the guided task might help people begin, but it could add burden'}
 for kind,(_,q,_) in COPY.items():
  qa='how is the need handled now,' if kind=='competition' else q.lower()
  if qa not in script or anchors[kind] not in script:raise ValueError('source copy drift: '+kind)
 for kind in COPY:
  for state in ('clean','caption-on'):
   desktop(kind,state=='caption-on').save(OUT/f'{kind}-1920x1080-{state}.png',optimize=True)
   mobile(kind,state=='caption-on').save(OUT/f'{kind}-390x844-{state}.png',optimize=True)
 for state in ('clean','caption-on'):
  desk=Image.new('RGB',(1920,1080),NAVY);mob=Image.new('RGB',(1560,844),NAVY)
  for i,kind in enumerate(COPY):
   src=Image.open(OUT/f'{kind}-1920x1080-{state}.png');desk.paste(src.resize((960,540),Image.Resampling.LANCZOS),((i%2)*960,(i//2)*540))
   mob.paste(Image.open(OUT/f'{kind}-390x844-{state}.png'),(i*390,0))
  desk.save(OUT/f'desktop-board-{state}.png',optimize=True);mob.save(OUT/f'mobile-board-{state}.png',optimize=True)
 outputs={p.name:{'sha256':digest(p),'dimensions':list(Image.open(p).size)} for p in sorted(OUT.glob('*.png'))}
 if len(outputs)!=20:raise RuntimeError('expected 20 PNGs')
 (OUT/'receipt.json').write_text(json.dumps({'status':'STILL_ONLY_READY_FOR_CAPTAIN_REVIEW_NO_VIDEO','supersedes':'l02-c02-flat-matte-stills-2026-11-13 held pending diversity correction','source_map':'source-map.json','qa_review':'qa-review.md','scene_order':list(COPY),'selected_source_plates':{k:(f'{k}-flat-matte-diverse.png' if k!='product' else 'product-flat-matte.png') for k in COPY},'caption_behavior':'Text-only overlay on existing imagery; no reserved band when clean. Timed caption/player behavior untested.','render_eligibility':'NOT_YET_AUTHORIZED','outputs':outputs,'excluded':['video render','HeyGen','spend','learner media','PR #1270 update','merge','deploy','publish','release']},indent=2)+'\n')

if __name__=='__main__':main()
