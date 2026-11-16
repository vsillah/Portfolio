#!/usr/bin/env python3
"""Source-only L02 review rebuild; uses no prior masters or segment caches."""
import argparse, hashlib, importlib.util, json, subprocess, sys
from pathlib import Path
from PIL import Image

AP=argparse.ArgumentParser()
AP.add_argument('--repo',type=Path,required=True)
AP.add_argument('--source',type=Path,required=True)
AP.add_argument('--output',type=Path,required=True)
args=AP.parse_args()
root=args.repo.resolve();source=args.source.resolve();out=args.output.resolve()
b=root/'artifacts/accelerated-l02-l16-illustration-qualification-2026-11-12'
pkg=b/'l02-presenter-unified-still-proposal-2026-11-13'
native=root/'docs/accelerated-course-modules/l02-native-composite/accelerated-l02-heygen-native.mp4'
audio=source/'audio/source-aligned-audio.flac'
expected={'desktop':'09b606c4ff15862355b401e260d2aa56ff947dd0eaeeed33ea70217060d7b716','portrait':'492847faf3c7178b18f2812b038a3b4d3d7f7fde48f57fe978dbbf81646f70d3'}

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def module(name,p):
 spec=importlib.util.spec_from_file_location(name,p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
def run(cmd):subprocess.run(cmd,check=True)
def save(p,im):p.parent.mkdir(parents=True,exist_ok=True);im.convert('RGB').save(p,optimize=True)
if out.exists():raise SystemExit('output already exists; no overwrite')
if sha(native)!='2beae8254c76a6f8bf168afb8483e83e63c13b621ec3934c81397d3167cd1a3d':raise SystemExit('native drift')
if not audio.exists():raise SystemExit('missing aligned FLAC')
# Convert compact source plates to the exact decoded pixels expected by the still builders.
for webp in (source/'plates').rglob('*.webp'):
 png=out/'decoded'/webp.relative_to(source/'plates').with_suffix('.png')
 save(png,Image.open(webp))
g=out/'stills';d=out/'decoded'
c1=module('c1',pkg/'c01/build_stills.py');c1.SOURCE=d/'l02-c01-matte-board-wayfinding-stills-v3-2026-11-13/source-art'
c2=module('c2',pkg/'c02/build_stills.py');c2.PLATES=d/'l02-c02-book-style-flat-source-plates-2026-11-13'
c3=module('c3',pkg/'c03/build_stills.py');c3.PLATES=d/'l02-choice-c03-matte-stills-2026-11-13/plates'
three=module('three',pkg/'c01-three-state/build_stills.py')
three.PHOTO=root/'public/showcases/service-photographic'
three.SOURCES={'welcome':three.PHOTO/'ai-email-sequence-templates-hero.jpg','task':three.PHOTO/'client-onboarding-automation-hero.jpg','dashboard':three.PHOTO/'custom-reporting-dashboard-secondary.jpg'}
pre=module('pre',pkg/'preflight/prepare_sources.py')
for name,start,end,kind,label,anchor in c1.STATES:
 for aspect in ('desktop','portrait'):save(g/f'c01/{name}-{aspect}.png',c1.clean(kind,aspect,label))
for kind in c2.COPY:
 for aspect in ('desktop','portrait'):
  im=c2.mobile(kind,False) if aspect=='portrait' else c2.desktop(kind,False)
  save(g/f'c02/{kind}-{aspect}.png',im)
for name,start,end,plate,label,focus,anchor in c3.STATES:
 for aspect in ('desktop','portrait'):save(g/f'c03/{name}-{aspect}.png',c3.render(plate,label,focus,aspect=='portrait',''))
for kind in ('welcome','task','dashboard'):
 for aspect in ('desktop','portrait'):
  mob=aspect=='portrait';im=three.make(kind,mob,False)
  save(g/f'preflight/c01-{kind}-{aspect}.png',pre.clean_legacy(im.convert('RGB'),(390,844) if mob else (1920,1080),774 if mob else 1031))
for kind in c2.COPY:
 for aspect in ('desktop','portrait'):
  mob=aspect=='portrait';im=Image.open(g/f'c02/{kind}-{aspect}.png').convert('RGB')
  save(g/f'preflight/c02-{kind}-{aspect}.png',pre.clean_legacy(im,(390,844) if mob else (1920,1080),805 if mob else 1031))
p=pkg/'render_motion_once.py'
sys.path.insert(0,str(p.parent));presenter=module('presenter',p)
presenter.WORK=out/'segments';presenter.NATIVE=native
presenter.SOURCE_ART['P02']=d/'l02-choice-c03-matte-stills-2026-11-13/plates/book-case-matte.png'
presenter.SOURCE_ART['P03']=d/'l02-choice-c03-matte-stills-2026-11-13/plates/economic-fit-matte.png'
for name in presenter.SEGMENTS:
 for aspect in ('desktop','portrait'):save(g/f'presenter/{name}-{aspect}.png',presenter.backdrop(name,aspect=='portrait'))
# The two C04 clean images are deterministic illustration outputs supplied in the source bundle.
for aspect in ('desktop','portrait'):
 p=source/f'c04/{aspect}.png'
 if not p.exists():raise SystemExit('missing C04 source still')
c01=json.loads((pkg/'c01/cue-map.json').read_text())['states']
c03=json.loads((pkg/'c03/cue-map.json').read_text())['states']
spec=[]
def add(name,n,pic=None):spec.append((name,n,pic))
add('P01',545)
for x in c01:add(x['id'],x['end_frame_exclusive']-x['start_frame'],lambda a,n=x['id']:g/f'c01/{n}-{a}.png')
for name,n in [('welcome',43),('task',37),('dashboard',41)]:add('C01-'+name,n,lambda a,n=name:g/f'preflight/c01-{n}-{a}.png')
add('C01-comparison-return',233,lambda a:g/f'c01/board-question-{a}.png')
add('P02',357)
for name,n in [('customer',320),('company',320),('competition',320),('product',325)]:add('C02-'+name,n,lambda a,n=name:g/f'preflight/c02-{n}-{a}.png')
for x in c03[:5]:add(x['id'],x['end_frame_exclusive']-x['start_frame'],lambda a,n=x['id']:g/f'c03/{n}-{a}.png')
add('P03',397)
for x in c03[5:]:add(x['id'],x['end_frame_exclusive']-x['start_frame'],lambda a,n=x['id']:g/f'c03/{n}-{a}.png')
add('question-bridge',80);add('P04',334);add('C04',115,lambda a:source/f'c04/{a}.png')
if len(spec)!=71 or sum(x[1] for x in spec)!=10090:raise SystemExit('timeline drift')
for aspect in ('desktop','portrait'):
 wd=out/'segments'/aspect;wd.mkdir(parents=True,exist_ok=True);parts=[]
 for i,(name,frames,pic) in enumerate(spec):
  if pic is None:part=presenter.render_part(name,aspect,g/f'presenter/{name}-{aspect}.png')
  else:
   part=wd/f'{i:02d}-{name}.mp4';w,h=(1920,1080) if aspect=='desktop' else (390,844)
   run(['ffmpeg','-v','error','-n','-loop','1','-framerate','25','-i',str(pic(aspect)),'-vf',f'scale={w}:{h},setsar=1,format=yuv420p','-map','0:v','-an','-frames:v',str(frames),'-r','25','-c:v','libx264','-preset','ultrafast','-crf','21','-pix_fmt','yuv420p',str(part)])
  parts.append(part)
 listing=wd/'parts.ffconcat';listing.write_text(''.join(f"file '{x.resolve()}'\n" for x in parts))
 base=wd/'base.mp4';run(['ffmpeg','-v','error','-n','-f','concat','-safe','0','-i',str(listing),'-c','copy',str(base)])
 final=out/f'l02-presenter-{aspect}-review-{"1920x1080" if aspect=="desktop" else "390x844"}.mp4'
 run(['ffmpeg','-v','error','-n','-i',str(base),'-i',str(audio),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-ac','1','-movflags','+faststart','-shortest',str(final)])
 if sha(final)!=expected[aspect]:raise SystemExit('STOP final hash mismatch '+aspect)
 print(aspect,sha(final),'PASS')
