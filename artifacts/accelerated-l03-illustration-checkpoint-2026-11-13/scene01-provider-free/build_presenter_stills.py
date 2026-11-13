"""Provider-free Scene 1 P01 layout stills from unchanged native source and existing book-style plate."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageFilter
import hashlib,json,subprocess
P=Path(__file__).parent
ROOT=P.parents[2]
NATIVE=Path.home() / 'Projects/Portfolio/artifacts/accelerated-l03-heygen-2026-11-04/accelerated-l03-heygen-native.mp4'
PLATE=ROOT/'artifacts/accelerated-l02-l16-illustration-qualification-2026-11-12/l02-presenter-unified-still-proposal-2026-11-13/source/plates/l02-choice-c03-matte-stills-2026-11-13/plates/choice-options-matte.webp'
FRAME=P/'native-p01-18s.png'
SHA=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert SHA(NATIVE)=='064e049bfaee6d60d5d811d516dbcdf9c14466602afef9a34e07cbf31c551198'
assert SHA(PLATE)=='a46d70c446b82d64b3674994da9b868625de7db0eb57c5d3b5d6bbcb9d991f26'
if not FRAME.exists():subprocess.run(['ffmpeg','-v','error','-y','-ss','18','-i',str(NATIVE),'-frames:v','1',str(FRAME)],check=True)
source=Image.open(FRAME).convert('RGB');plate=Image.open(PLATE).convert('RGB')
REG='/System/Library/Fonts/Supplemental/Arial.ttf';BOLD='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
CAPTION='You put up the first slide and someone asks, “Is this the best use of engineering time right now?” That is a reasonable question.'
def f(sz,b=False):return ImageFont.truetype(BOLD if b else REG,sz)
def wrap(d,line,ft,maxw):
 out=[];cur=''
 for word in line.split():
  trial=(cur+' '+word).strip()
  if cur and d.textlength(trial,font=ft)>maxw:out.append(cur);cur=word
  else:cur=trial
 if cur:out.append(cur)
 return out
def bg(w,h):
 im=Image.new('RGB',(w,h));px=im.load()
 for y in range(h):
  for x in range(w):
   fx=x/max(1,w-1);fy=y/max(1,h-1)
   px[x,y]=(int(11+8*fx+2*fy),int(34+11*fx-2*fy),int(47+10*fx-3*fy))
 return im.convert('RGBA')
def compose(portrait,caption):
 w,h=(390,844) if portrait else (1920,1080)
 im=bg(w,h);d=ImageDraw.Draw(im,'RGBA')
 if portrait:
  d.text((21,24),'AMADUTOWN  /  ACCELERATED',font=f(16,True),fill='#D8B56F')
  d.text((21,59),'A dashboard in the room',font=f(26,True),fill='#F5EBDD')
  # Complete plate establishes people, dashboard, and three visual choices without a text panel.
  art=plate.resize((390,220),Image.Resampling.LANCZOS)
  im.paste(art,(0,105))
  box=(37,344,353,522)
 else:
  d.text((88,54),'AMADUTOWN  /  ACCELERATED',font=f(28,True),fill='#D8B56F')
  d.text((88,124),'A dashboard in the room',font=f(64,True),fill='#F5EBDD')
  # Organic vignette avoids a second rectangular panel beside the presenter.
  art=plate.resize((1000,563),Image.Resampling.LANCZOS)
  mask=Image.new('L',art.size,0);md=ImageDraw.Draw(mask)
  md.ellipse((10,0,990,563),fill=255)
  mask=mask.filter(ImageFilter.GaussianBlur(64))
  im.paste(art,(15,318),mask)
  box=(1000,300,1810,756)
 x0,y0,x1,y1=box
 vid=source.resize((x1-x0,y1-y0),Image.Resampling.LANCZOS)
 im.paste(vid,(x0,y0))
 d=ImageDraw.Draw(im,'RGBA');d.rectangle((x0-1,y0-1,x1,y1),outline='#D8B56F',width=1 if portrait else 2)
 if caption:
  if portrait:
   ft=f(16);lines=wrap(d,CAPTION,ft,340);top=775-len(lines)*21
   assert top>y1+28,(top,y1)
   d.rounded_rectangle((16,top-8,374,785),radius=8,fill=(3,21,28,232))
   for i,line in enumerate(lines):d.text((25,top+i*21),line,font=ft,fill='#F6F1E9')
  else:
   ft=f(29);lines=wrap(d,CAPTION,ft,1150);top=1000-len(lines)*40
   assert top>y1+40,(top,y1)
   d.rounded_rectangle((344,top-10,1576,1010),radius=10,fill=(3,21,28,226))
   for i,line in enumerate(lines):d.text((380,top+i*40),line,font=ft,fill='#F6F1E9')
 # Control mock is for geometry inspection only; the actual player is still untested.
 if portrait:
  d.rectangle((0,800,390,844),fill=(2,17,24,220));d.line((20,812,370,812),fill='#AAB6B0',width=2)
 else:
  d.rectangle((0,1035,1920,1080),fill=(2,17,24,220));d.line((50,1052,1870,1052),fill='#AAB6B0',width=3)
 out=P/f'p01-{("390x844" if portrait else "desktop")}-{("caption-on" if caption else "clean")}.png'
 im.convert('RGB').save(out)
 actual=Image.open(out).crop((x0+3,y0+3,x1-3,y1-3))
 expected=vid.crop((3,3,vid.width-3,vid.height-3))
 assert actual.tobytes()==expected.tobytes(),'native presenter pixels changed'
 return {'path':out.name,'sha256':SHA(out),'size':[w,h],'native_box':list(box),'caption_lines':len(lines) if caption else 0}
outputs=[compose(p,c) for p in (False,True) for c in (False,True)]
(P/'still-receipt.json').write_text(json.dumps({'status':'provider_free_layout_stills_only','native_source_path':str(NATIVE),'native_source_sha256':SHA(NATIVE),'native_frame_second':18,'native_frame_sha256':SHA(FRAME),'plate_path':str(PLATE),'plate_sha256':SHA(PLATE),'caption_cue_seconds':[11.931,23.861],'caption_text':CAPTION,'outputs':outputs,'limit':'Synthetic caption/control geometry is not actual-player proof; no audio or video render.'},indent=2)+'\n')
print(json.dumps({'outputs':outputs},indent=2))
