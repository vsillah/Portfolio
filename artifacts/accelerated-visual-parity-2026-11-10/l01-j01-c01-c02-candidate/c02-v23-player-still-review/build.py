#!/usr/bin/env python3
"""One local still-only data-use boundary composition; no media writes."""
import hashlib
import json
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[4]
OUT=Path(__file__).resolve().parent
ART=OUT/'generated-desk-source.png'
VTT=ROOT/'artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate/c01-c02-v18-optional-caption-feasibility/lower-captions.vtt'
SCRIPT=ROOT/'docs/accelerated-course-modules/curriculum/scripts/L01.md'
STORYBOARD=ROOT/'docs/accelerated-course-modules/curriculum/scripts/storyboard-brief.md'
SAM=ROOT/'public/showcases/service-prototypes/accelerated-sam-infographic.png'
SIGNALS=ROOT/'public/showcases/service-prototypes/v2/sam-signals-plate.webp'
ALIGNMENT=ROOT/'public/showcases/service-prototypes/v2/sam-alignment-plate.webp'
MOMENTUM=ROOT/'public/showcases/service-prototypes/v2/sam-momentum-plate.webp'
SOURCE_HASHES={
 ART:'c2df07cb81d6f0e5e3591d9c0f7c97f0fac087a9f4980c899179203fc7267b55',
 VTT:'427376480d444d321513ddc09c226e7896967909d8baa790b1569dd4a79b508b',
 SCRIPT:'b32720889eea843df7aba1e7878033a996b05adbece1eed4db2804257b3095ad',
 STORYBOARD:'d9b6a46def5756831e1788cdf97769347048cc9318e87061dbae7bbf962ca1b6',
 SAM:'13ef37fb39a228c79253538174cd9b3d77f6c7e630e9929dfa99e6cfa97f45c6',
 SIGNALS:'8554d40fb4e5471c61c7c3e530da80bfa07c7a77ab34afb79eecfb9945985e6c',
 ALIGNMENT:'82b9fd4429387182e4fab545ecd11a3cd7174794fd9c9b0f9fbda6606b4c72a0',
 MOMENTUM:'8b32de9f499e3fdefadcb847ac1032dac27405f74fde844af9c53ae1b4a5d2d3',
}
FONT='/System/Library/Fonts/Avenir Next.ttc'
WHITE=(251,246,231)
GOLD=(222,175,81)
BEATS=[('decision',249.0,0),('categories_begin',318.5,2),('restricted_named',320.9,3)]
LABELS=['Public','Approved for this use','Restricted']

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def font(size,bold=True):return ImageFont.truetype(FONT,size,index=2 if bold else 0)

def cue_at(seconds):
 rows=[]
 pattern=r'(?m)^\d+\n(\d\d):(\d\d):(\d\d)\.(\d{3}) --> (\d\d):(\d\d):(\d\d)\.(\d{3}) line:72%\n(.+?)(?=\n\n|\Z)'
 for m in re.finditer(pattern,VTT.read_text(),re.S):
  v=[int(m.group(i)) for i in range(1,9)]
  a=v[0]*3600+v[1]*60+v[2]+v[3]/1000
  b=v[4]*3600+v[5]*60+v[6]+v[7]/1000
  rows.append((a,b,m.group(9)))
 assert len(rows)==175
 return next(t for a,b,t in rows if a<=seconds<b)

def fit(draw,text,face,max_width):
 lines=[];current=''
 for word in text.split():
  trial=(current+' '+word).strip()
  if current and draw.textbbox((0,0),trial,font=face)[2]>max_width:
   lines.append(current);current=word
  else:current=trial
 if current:lines.append(current)
 return lines

def picture(background,width,reveal):
 height=round(width*720/1280)
 pic=background.resize((width,height),Image.Resampling.LANCZOS).convert('RGBA')
 if reveal:
  overlay=Image.new('RGBA',pic.size,(0,0,0,0));d=ImageDraw.Draw(overlay)
  if width==1280:
   d.rectangle((0,0,width,160),fill=(3,21,31,232))
   for i,label in enumerate(LABELS[:reveal]):
    x=36+i*410
    d.line((x,132,x+368,132),fill=GOLD,width=4)
    d.text((x,34),label,font=font(43 if i!=1 else 35),fill=WHITE)
  else:
   d.rounded_rectangle((8,8,237,113),radius=10,fill=(3,21,31,233),outline=GOLD,width=1)
   for i,label in enumerate(LABELS[:reveal]):
    y=13+i*31
    d.ellipse((17,y+7,24,y+14),fill=GOLD)
    d.text((34,y),label,font=font(17),fill=WHITE)
  pic=Image.alpha_composite(pic,overlay)
 return pic.convert('RGB')

def player(pic,seconds,captions,width):
 cap_h=54 if width==352 else 84
 ctl_h=50 if width==352 else 64
 full=Image.new('RGB',(width,pic.height+(cap_h if captions else 0)+ctl_h),(8,24,33))
 full.paste(pic,(0,0));d=ImageDraw.Draw(full)
 y=pic.height
 if captions:
  d.rectangle((0,y,width,y+cap_h),fill=(6,22,30))
  d.line((0,y,width,y),fill=GOLD,width=2)
  face=font(17 if width==352 else 34)
  lines=fit(d,cue_at(seconds),face,width-(24 if width==352 else 80))
  assert len(lines)<=2
  h=23 if width==352 else 43
  for i,line in enumerate(lines):
   box=d.textbbox((0,0),line,font=face)
   d.text(((width-(box[2]-box[0]))//2,y+(cap_h-len(lines)*h)//2+i*h),line,font=face,fill=WHITE)
  y+=cap_h
 d.rectangle((0,y,width,full.height),fill=(4,14,21))
 d.polygon([(16,y+15),(16,y+31),(29,y+23)],fill=WHITE)
 minute,second=divmod(int(seconds),60)
 d.text((42,y+15),f'{minute}:{second:02d} / 5:45',font=font(15 if width==352 else 21),fill=WHITE)
 # Draw audio and fullscreen icons with primitives so no font glyph can disappear.
 speaker_x=width-(78 if width==352 else 116)
 speaker_y=y+23
 d.rectangle((speaker_x,speaker_y-4,speaker_x+5,speaker_y+4),fill=WHITE)
 d.polygon([(speaker_x+5,speaker_y-4),(speaker_x+12,speaker_y-9),(speaker_x+12,speaker_y+9),(speaker_x+5,speaker_y+4)],fill=WHITE)
 d.arc((speaker_x+10,speaker_y-11,speaker_x+25,speaker_y+11),-65,65,fill=WHITE,width=2)
 fs_x=width-(39 if width==352 else 55)
 fs_y=y+14
 for points in (
  [(fs_x+8,fs_y),(fs_x,fs_y),(fs_x,fs_y+8)],
  [(fs_x+17,fs_y),(fs_x+25,fs_y),(fs_x+25,fs_y+8)],
  [(fs_x,fs_y+17),(fs_x,fs_y+25),(fs_x+8,fs_y+25)],
  [(fs_x+25,fs_y+17),(fs_x+25,fs_y+25),(fs_x+17,fs_y+25)],
 ):
  d.line(points,fill=WHITE,width=2)
 d.line((16,full.height-8,width-16,full.height-8),fill=(140,151,154),width=3)
 d.line((16,full.height-8,16+(width-32)*seconds/345,full.height-8),fill=WHITE,width=3)
 return full

def main():
 for path,expected in SOURCE_HASHES.items():
  assert path.is_file() and sha(path)==expected,f'source drift: {path}'
 background=Image.open(ART).convert('RGB')
 assert background.size==(1672,941)
 outputs=[]
 for name,seconds,reveal in BEATS:
  for viewport,width in [('desktop',1280),('390x844',352)]:
   pic=picture(background,width,reveal)
   for captions in (False,True):
    composed=player(pic,seconds,captions,width)
    if viewport=='390x844':
     screen=Image.new('RGB',(390,844),(12,17,22))
     screen.paste(composed,(19,200));composed=screen
    path=OUT/f'{name}-{viewport}-captions-{"on" if captions else "off"}.png'
    composed.save(path,optimize=True)
    outputs.append({'beat':name,'seconds':seconds,'viewport':viewport,'captions':captions,'cue':cue_at(seconds),'path':path.name,'sha256':sha(path)})
 receipt={'status':'local_still_only_uncommitted_generated_art_unapproved',
          'generated_art':{'path':str(ART.relative_to(ROOT)),'sha256':sha(ART),'origin':'built-in imagegen output from this chat; tool did not report a model identifier, approval, or cash/credit receipt','prompt':'Use case: scientific-educational. Asset type: source illustration for an Accelerated course video still, 16:9 landscape composition. A polished, tactile editorial illustration of a product manager\'s desk seen from a slight elevated three-quarter angle: a large paper decision file at left, several blank fictional input cards on the desk, and a laptop or abstract AI tool interface at right. Between desk and tool is a clear luminous gold threshold or gate. One sealed input card remains visibly on the desk, outside the threshold. The scene should communicate that a person decides what may cross into a tool. Deep navy and teal environment, warm gold accents, warm cream paper, premium restrained lighting, sophisticated realistic illustration, coherent perspective, detailed and substantial work surface filling the frame. Leave a clear upper band for later typeset title. Absolutely no legible text, letters, logos, brands, watermarks, personal data, photographs of real people, red warning symbols, three-category labels, fake UI, or tiny floating boxes. Keep the art full frame with no permanently empty bottom band.','claim':'fictional illustration only; no real person, customer record, or live tool state'},
          'source_hashes':{str(p.relative_to(ROOT)):h for p,h in SOURCE_HASHES.items()},
          'timing':{'sam_full_map':'197.53–210.53s, especially paths cross at 204.28–206.06s; unchanged','approved_focus_plates':'173.01–188.13s path explanation; unchanged','data_decision':'248.69s start; source still at 249.0s','category_introduction':'314.637–321.317s; stills at 318.5 and 320.9s'},
          'layout':{'picture':'16:9, no permanent lower band','presenter':'none in these C02 cutaways','controls':'separate mock row outside picture with primitive-drawn play, speaker, and fullscreen icons','captions':'separate optional mock rail, sourced from exact unchanged 175-cue VTT','desktop_picture_px':[1280,720],'mobile_picture_px':[352,198]},
          'labels_added_at_318_5':['Public','Approved for this use'],'labels_added_at_320_9':['Restricted'],
          'outputs':outputs,
          'limits':['Generated art is a review concept, not an approved source or evidence of a real event.','Control and caption rails are geometry mocks, not validated native player pixels.','No video sequence, MP4, VTT, audio, timing, learner binding, PR, provider action, or deployment changed.','Imagegen tool returned no cash or credit receipt; cost effect is unverified.']}
 (OUT/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print('built',len(outputs),'stills')

if __name__=='__main__':main()
