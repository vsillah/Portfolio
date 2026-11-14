#!/usr/bin/env python3
"""Build local, still-only C01 visual review from approved art and synthetic worksheet."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate/c01-visual-still-audit-v13'
ART = ROOT / 'public/showcases/service-prototypes/v2'
MAP = ROOT / 'public/showcases/service-prototypes/accelerated-sam-infographic.png'
BOOK = ROOT / 'public/accelerated_cover_ebook.webp'
HUMAN_ART = OUT / 'sources/acc_trailer_img_4.2.2.png'
HUMAN_ART_DRIVE_PATH = '2. AmaduTown Advisory Solutions/Artifacts /Promotional /Accelerated Building Smarter Products with AI/Final/Trailer/Imgs/acc_trailer_img_4.2.2.png'
SOURCE = ROOT / 'public/accelerated/visual-parity/l01/visual-a70ed876/l01-visual-parity.mp4'
P01 = ROOT / 'artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate/p01-middle-base.png'
FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'
BOLD = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
NAVY = '#102633'
DEEP = '#0b1c26'
GOLD = '#d9ad54'
CREAM = '#f1eadc'
PLATES = {
 'signals':('sam-signals-plate.webp','8554d40fb4e5471c61c7c3e530da80bfa07c7a77ab34afb79eecfb9945985e6c'),
 'alignment':('sam-alignment-plate.webp','82b9fd4429387182e4fab545ecd11a3cd7174794fd9c9b0f9fbda6606b4c72a0'),
 'momentum':('sam-momentum-plate.webp','8b32de9f499e3fdefadcb847ac1032dac27405f74fde844af9c53ae1b4a5d2d3'),
}
BEATS = [
 ('handoff','28.40–31.52','28.5','worksheet','The unanswered decision','What evidence would make that choice responsible?'),
 ('blank_document','31.52–75.00','45.0','worksheet','The unanswered decision','It cannot answer them.'),
 ('meeting_inputs','75.00–90.00','82.0','meeting','Three inputs, one decision','Someone else had a competing story.'),
 ('signal_path','90.00–105.00','97.0','signal_path','Give the signal a path','It helps you record the signal,'),
 ('human_judgment','105.00–145.00','122.0','human_review','People keep the judgment','The judgment still belongs to people'),
 ('safe_test','145.00–149.695','146.7','human_review','Test one option safely','which option you can test safely.'),
 ('speed_room','149.695–153.228','150.5','plate_signals','Speed can create room','Speed can create room to think.'),
 ('speed_noise','153.228–157.558','154.7','plate_signals','Speed can add noise','It can also fill that room with more noise.'),
 ('map_intro','157.558–173.048','166.3','map_only','The workshop map','Momentum.'),
 ('map_signals','173.048–179.398','174.4','plate_signals','Signals','First, take the raw material'),
 ('map_alignment','179.398–184.710','180.2','plate_alignment','Alignment','Then give the people carrying'),
 ('map_momentum','184.710–190.00','185.5','plate_momentum','Momentum','Then build a rhythm that'),
 ('book_chapters','190.00–197.570','192.9','book_only','The printed chapters','chapters as systems, align, and'),
 ('map_signals_detail','197.570–200.230','198.8','plate_signals','Signals','The workshop uses the three labels'),
 ('map_alignment_detail','200.230–204.320','201.4','plate_alignment','Alignment','infographic as a visual guide.'),
 ('map_relationship','204.320–208.350','205.4','map_relationship','Where the paths cross','where those paths cross.'),
 ('book_return','208.350–212.820','209.4','book_only','The printed chapters','replacement for the chapters.'),
 ('signal_side','212.820–225.00','220.0','signal_path','Stay close to the signal','work backward to evidence, and'),
 ('book_human_thread','225.00–230.050','226.3','book_only','A human thread','There is a human thread'),
 ('sam_intro','230.050–235.00','230.12','book_sam','A human thread','Sam, a product manager who'),
]


def sha(path):
 return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def check_sources():
 assert sha(SOURCE)=='a70ed876ccdedd468c1cfa7ea995087683c715fdb97c50bb1d58a58436820725'
 assert sha(P01)=='ae7b6ba63739c8d45ecf9f3edeb4f0b487075ed78032d32059c845156d404071'
 assert sha(MAP)=='13ef37fb39a228c79253538174cd9b3d77f6c7e630e9929dfa99e6cfa97f45c6'
 assert sha(BOOK)=='4a3406389e73fb919ba2c005475a8c707060103cee8b589ac16c8e68e42ab78d'
 assert sha(HUMAN_ART)=='1f3a4163c9467117fd7621d41a72afb5e8a203a8fb6142c5d1dedeca0a23209e'
 for filename,digest in PLATES.values(): assert sha(ART/filename)==digest


def font(size,bold=False): return ImageFont.truetype(BOLD if bold else FONT,size)


def canvas(size,title,caption):
 w,h=size
 image=Image.new('RGB',size,DEEP)
 d=ImageDraw.Draw(image)
 if w>500:
  d.rectangle((0,0,w,710),fill=NAVY)
  d.text((66,30),'ACCELERATED',font=font(25,True),fill=GOLD)
  d.text((66,86),title,font=font(56,True),fill=CREAM)
  d.line((66,164,w-66,164),fill=GOLD,width=3)
  d.rectangle((0,720,w,900),fill=DEEP)
  d.text((w//2,773),caption,font=font(40,True),fill='white',anchor='mm')
  d.rectangle((0,838,w,900),fill='#07131b')
  d.line((24,855,w-24,855),fill='#e7e7e7',width=4)
  d.text((32,866),'Play',font=font(21),fill='white')
 else:
  d.rectangle((0,0,w,656),fill=NAVY)
  d.text((22,27),'ACCELERATED',font=font(17,True),fill=GOLD)
  title_size=23
  while title_size>19 and d.textlength(title,font=font(title_size,True))>w-44:
   title_size-=1
  assert d.textlength(title,font=font(title_size,True))<=w-44,title
  d.text((22,70),title,font=font(title_size,True),fill=CREAM)
  d.line((22,111,w-22,111),fill=GOLD,width=2)
  d.rectangle((0,656,w,844),fill=DEEP)
  # Caption is intentionally above the reserved native control footprint.
  parts=caption.split(' ')
  lines=[];line=''
  for word in parts:
   trial=(line+' '+word).strip()
   if ImageDraw.Draw(image).textlength(trial,font=font(19,True))>w-42 and line:
    lines.append(line);line=word
   else:line=trial
  if line:lines.append(line)
  assert len(lines)<=2,(title,lines)
  for i,line in enumerate(lines):d.text((w//2,681+i*25),line,font=font(19,True),fill='white',anchor='mm')
  d.rectangle((0,771,w,844),fill='#07131b')
  d.line((18,788,w-18,788),fill='#e7e7e7',width=3)
  d.text((20,804),'Play',font=font(16),fill='white')
 return image


def art(image,path,box):
 a=Image.open(path).convert('RGBA')
 a.thumbnail((box[2]-box[0],box[3]-box[1]),Image.Resampling.LANCZOS)
 x=(box[0]+box[2]-a.width)//2;y=(box[1]+box[3]-a.height)//2
 image.paste(a,(x,y),a)
 return [x,y,a.width,a.height]


def worksheet(image,box):
 x0,y0,x1,y1=box;d=ImageDraw.Draw(image);w=x1-x0;h=y1-y0
 d.rounded_rectangle(box,radius=22,fill=CREAM,outline=GOLD,width=5)
 if w>500:
  d.text((x0+int(w*.08),y0+int(h*.13)),'Q3 INNOVATION PLAN',font=font(36,True),fill=NAVY)
 else:
  title_font=font(18,True)
  assert d.textlength('Q3 INNOVATION',font=title_font)<=int(w*.84)
  d.text((x0+int(w*.08),y0+int(h*.10)),'Q3 INNOVATION',font=title_font,fill=NAVY)
  d.text((x0+int(w*.08),y0+int(h*.19)),'PLAN',font=title_font,fill=NAVY)
 d.line((x0+int(w*.08),y0+int(h*.34),x1-int(w*.08),y0+int(h*.34)),fill=GOLD,width=4)
 d.text((x0+int(w*.08),y0+int(h*.51)),'Decision to make',font=font(32 if w>500 else 17,True),fill=NAVY)
 d.line((x0+int(w*.08),y0+int(h*.7),x1-int(w*.08),y0+int(h*.7)),fill='#2b5c69',width=3)


def meeting(image,mobile):
 d=ImageDraw.Draw(image)
 if mobile: boxes=[(30,142,360,267),(30,286,360,411),(30,430,360,555)];fs=23
 else: boxes=[(84,230,438,535),(462,230,816,535),(840,230,1194,535)];fs=35
 for i,(box,label) in enumerate(zip(boxes,['Customer problem','Competing story','Missing number'])):
  d.rounded_rectangle(box,radius=18,fill=CREAM,outline=GOLD,width=4)
  x0,y0,x1,y1=box
  d.ellipse((x0+22,y0+21,x0+53,y0+52),fill=GOLD)
  d.text(((x0+x1)//2,(y0+y1)//2),label,font=font(fs,True),fill=NAVY,anchor='mm')


def render(mode,title,caption,mobile):
 size=(390,844) if mobile else (1280,900)
 image=canvas(size,title,caption)
 if mode=='worksheet':
  worksheet(image,(28,170,362,602) if mobile else (170,210,1110,630))
 elif mode=='meeting': meeting(image,mobile)
 elif mode.startswith('plate_'):
  name=mode[6:];art(image,ART/PLATES[name][0],(58,150,332,615) if mobile else (300,200,980,670))
 elif mode=='human_review':
  box=(24,170,366,585) if mobile else (88,180,1192,685)
  d=ImageDraw.Draw(image)
  d.rounded_rectangle((box[0]-5,box[1]-5,box[2]+5,box[3]+5),radius=12,
                      fill=DEEP,outline=GOLD,width=3)
  art(image,HUMAN_ART,box)
 elif mode in ('signal_path','decision_path'):
  art(image,ART/PLATES['signals'][0],(32,160,178,490) if mobile else (110,210,490,650))
  if mode=='decision_path':
   art(image,ART/PLATES['momentum'][0],(216,176,358,476) if mobile else (800,220,1180,630))
   d=ImageDraw.Draw(image);d.rounded_rectangle((126,520,264,600) if mobile else (500,320,790,520),radius=14,fill=CREAM,outline=GOLD,width=4)
   d.text((195,560) if mobile else (645,420),'Decision',font=font(24 if mobile else 43,True),fill=NAVY,anchor='mm')
  else:
   worksheet(image,(194,235,365,508) if mobile else (560,238,1170,610))
 elif mode in ('book_only','book_sam'):
  art(image,BOOK,(105,145,285,610) if mobile else (440,185,840,680))
  if mode=='book_sam':
   d=ImageDraw.Draw(image)
   box=(135,544,255,595) if mobile else (856,394,1038,466)
   d.rounded_rectangle(box,radius=14,fill=NAVY,outline=GOLD,width=3)
   d.text(((box[0]+box[2])//2,(box[1]+box[3])//2),'Sam',
          font=font(25 if mobile else 37,True),fill=CREAM,anchor='mm')
 elif mode=='map_only':
  art(image,MAP,(26,160,364,610) if mobile else (320,180,960,665))
 elif mode=='map_relationship':
  art(image,MAP,(26,140,364,535) if mobile else (320,185,960,590))
  # A source-pixel inset makes both complete connection labels legible while
  # the complete approved map remains visible above it.
  strip=Image.open(MAP).convert('RGBA').crop((280,420,870,530))
  box=(31,538,359,602) if mobile else (360,602,920,682)
  strip.thumbnail((box[2]-box[0],box[3]-box[1]),Image.Resampling.LANCZOS)
  x=(box[0]+box[2]-strip.width)//2;y=(box[1]+box[3]-strip.height)//2
  image.paste(strip,(x,y),strip)
  ImageDraw.Draw(image).rectangle((x-2,y-2,x+strip.width+2,y+strip.height+2),outline=GOLD,width=2)
 return image


def main():
 check_sources();OUT.mkdir(parents=True,exist_ok=True)
 rows=[]
 for key,window,sample,mode,title,caption in BEATS:
  files={}
  for mobile in (False,True):
   image=render(mode,title,caption,mobile)
   path=OUT/f'{key}-{("390x844" if mobile else "1280x900")}.png'
   image.save(path)
   files[path.name]=sha(path)
  rows.append({'id':key,'source_window_seconds':window,'source_sample_seconds':sample,
               'mode':mode,'title':title,'caption_sample':caption,'stills':files})
 receipt={'status':'local_still_review_only_pending_visual_check',
          'source_commit':'2fb755466cfb201b4257d3495d9be4f001f86421',
          'source_video_sha256':sha(SOURCE),'source_map_sha256':sha(MAP),
          'source_p01_sha256':sha(P01),'approved_plate_sha256':{k:sha(ART/v[0]) for k,v in PLATES.items()},
          'book_cover_sha256':sha(BOOK),'beats':rows,
          'drive_human_art':{'original_path_relative_to_amadutown_drive':HUMAN_ART_DRIVE_PATH,
                             'local_source_copy':'sources/acc_trailer_img_4.2.2.png','sha256':sha(HUMAN_ART),
                             'use':'first-party conceptual illustration of people reviewing evidence; no customer or outcome claim'},
          'unresolved':[],
          'limits':['No video, audio, J01 timing, learner media, or binding changed.',
                    'Control and caption treatments are simulated in stills, not native-player proof.',
                    'Sam is represented by the approved book cover and a text label; no character portrait is implied.']}
 (OUT/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print('built',len(rows)*2,'stills; Sam introduced without a portrait at 230.050s')


if __name__=='__main__': main()
