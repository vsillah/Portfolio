"""Local, provider-free L03 P01/C01/P02/C02 review. Never writes learner media."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib, json, math, shutil, subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
CHECK = HERE.parent
SCENE = CHECK / 'scene01-contextual-review/outputs'
RETURN = CHECK / 'l03-j01-provider-return'
NATIVE = Path.home() / 'Projects/Portfolio/artifacts/accelerated-l03-heygen-2026-11-04/accelerated-l03-heygen-native.mp4'
BOUND = ROOT / 'public/accelerated/lessons/l03/approved-02b9c3ea/accelerated-l03-native-composite.mp4'
PLATES = ROOT / 'artifacts/accelerated-l02-l16-illustration-qualification-2026-11-12/l02-presenter-unified-still-proposal-2026-11-13/source/plates/l02-choice-c03-matte-stills-2026-11-13/plates'
WAV = RETURN / 'l03-j01-original.wav'
OUT = HERE / 'outputs'; OUT.mkdir(parents=True, exist_ok=True)
ASSETS = HERE / 'source'; ASSETS.mkdir(exist_ok=True)
SHA = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
def run(cmd): subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

assert SHA(WAV) == '6d86bdd09509f492724b76f3af256dc50c128e534e052b972a9092f18ca60531'
assert SHA(NATIVE) == '064e049bfaee6d60d5d811d516dbcdf9c14466602afef9a34e07cbf31c551198'
assert SHA(BOUND) == '02b9c3ea941c22ffaf87b3bc4e4c4612951499af15485e0261910fad6014053a'

sources = {
  'priority': ASSETS / 'priority.png',
  'decision': PLATES / 'decision-record-matte.webp',
  'options': ASSETS / 'options.png',
  'evidence': PLATES / 'evidence-check-matte.webp',
  'gap': ASSETS / 'gap.png',
}
for key, src in sources.items():
    target = ASSETS / f'{key}{src.suffix}'
    assert target.exists() and SHA(src) == SHA(target)
    sources[key] = target

def book_frame(key, size, focus=False):
    src = Image.open(sources[key]).convert('RGB')
    if size == 'desktop':
        if focus:
            w,h=src.size; src=src.crop((int(w*.045),int(h*.045),int(w*.955),int(h*.955)))
        return src.resize((1920,1080),Image.Resampling.LANCZOS)
    canvas=Image.new('RGB',(390,844),'#0c2531')
    full=src.resize((390,219),Image.Resampling.LANCZOS)
    canvas.paste(full,(0,15))
    w,h=src.size
    center=.38 if not focus else .62
    cropw=int(w*.55); x=int(w*center-cropw/2); x=max(0,min(w-cropw,x))
    crop=src.crop((x,0,x+cropw,h)).resize((390,596),Image.Resampling.LANCZOS)
    canvas.paste(crop,(0,248))
    ImageDraw.Draw(canvas).line((0,242,390,242),fill='#d8b56f',width=2)
    return canvas

def presenter_bg(size):
    art=Image.open(sources['options']).convert('RGB')
    if size == 'desktop':
        im=Image.new('RGB',(1920,1080),'#0c2531'); d=ImageDraw.Draw(im)
        font='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
        d.text((88,50),'AMADUTOWN  /  ACCELERATED',font=ImageFont.truetype(font,28),fill='#d8b56f')
        d.text((88,126),'Put the options on the table',font=ImageFont.truetype(font,62),fill='#f5ebdd')
        im.paste(art.resize((1000,563),Image.Resampling.LANCZOS),(15,320))
        d.rectangle((999,299,1810,756),outline='#d8b56f',width=2)
    else:
        im=Image.new('RGB',(390,844),'#0c2531'); d=ImageDraw.Draw(im)
        font='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
        d.text((20,23),'AMADUTOWN  /  ACCELERATED',font=ImageFont.truetype(font,16),fill='#d8b56f')
        d.text((20,61),'Compare the options',font=ImageFont.truetype(font,26),fill='#f5ebdd')
        im.paste(art.resize((390,219),Image.Resampling.LANCZOS),(0,180))
        d.rectangle((0,469,389,690),outline='#d8b56f',width=1)
    return im

def still_clip(frame, name, frames):
    path=OUT/f'{name}.png'; frame.save(path)
    mp4=OUT/f'{name}.mp4'
    if not mp4.exists():
        run(['ffmpeg','-v','error','-y','-loop','1','-framerate','25','-i',str(path),'-frames:v',str(frames),'-an','-vf','format=yuv420p','-c:v','libx264','-preset','veryfast','-crf','19',str(mp4)])
    return mp4

# Timing uses source-word pauses, all rounded to the nearest frame.
# Scene 1 ends after the opening C01 passage at 59.00 video seconds.
segments=[
  (36.75,55.64,'priority'),(55.64,74.56,'decision'),(74.56,95.36,'decision'),
  (95.36,114.80,'options'),(114.80,134.48,'options'),
  (134.48,153.00,'evidence'),(153.00,174.72,'evidence'),(174.72,196.64,'gap')
]
# Native P02 is inserted between C01 and C02; it is not part of the J01 WAV.
assert all(abs(round((b-a)*25)-(b-a)*25)<.51 for a,b,_ in segments)

for size in ('desktop','mobile'):
    scene=SCENE/('l03-scene01-desktop.mp4' if size=='desktop' else 'l03-scene01-mobile-single-plate.mp4')
    assert scene.exists()
    clips=[]
    # First three segments are the rest of C01.
    for i,(a,b,key) in enumerate(segments[:3]):
        clips.append(still_clip(book_frame(key,size,i==2),f'{size}-c01-{i}',round((b-a)*25)))
    pbg=OUT/f'{size}-p02-bg.png'; presenter_bg(size).save(pbg)
    pclip=OUT/f'{size}-p02.mp4'
    scale='810:456' if size=='desktop' else '390:219'
    xy='1000:300' if size=='desktop' else '0:470'
    if not pclip.exists():
        run(['ffmpeg','-v','error','-y','-loop','1','-framerate','25','-i',str(pbg),'-i',str(NATIVE),
          '-filter_complex',f'[1:v]trim=start_frame=557:end_frame=978,setpts=PTS-STARTPTS,scale={scale}[p];[0:v][p]overlay={xy}:shortest=1,format=yuv420p[v]',
          '-map','[v]','-frames:v','421','-an','-c:v','libx264','-preset','veryfast','-crf','19',str(pclip)])
    clips.append(pclip)
    # C02 starts at the exact J01 boundary; first image continues the three-option thought.
    for i,(a,b,key) in enumerate(segments[3:]):
        clips.append(still_clip(book_frame(key,size,i%2==1),f'{size}-c02-{i}',round((b-a)*25)))
    playlist=OUT/f'{size}.ffconcat'
    playlist.write_text('ffconcat version 1.0\n'+f"file '{scene}'\n"+''.join(f"file '{p}'\n" for p in clips))
    video=OUT/f'{size}-video.mp4'
    if not video.exists():
        run(['ffmpeg','-v','error','-y','-safe','0','-f','concat','-i',str(playlist),'-map','0:v:0','-c','copy',str(video)])

audio=OUT/'j01-first-half-audio.wav'
if not audio.exists(): run(['ffmpeg','-v','error','-y','-i',str(BOUND),'-i',str(WAV),'-filter_complex',
  '[0:a]atrim=0:22.28,asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[p1];'
  '[1:a]atrim=0:95.36,asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[c1];'
  '[0:a]atrim=174:190.84,asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[p2];'
  '[1:a]atrim=start=95.36,asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[c2];'
  '[p1][c1][p2][c2]concat=n=4:v=0:a=1[a]','-map','[a]','-c:a','pcm_s16le',str(audio)])
for size in ('desktop','mobile'):
    target=OUT/f'l03-j01-first-half-{size}.mp4'
    if not target.exists():
        run(['ffmpeg','-v','error','-y','-i',str(OUT/f'{size}-video.mp4'),'-i',str(audio),'-map','0:v:0','-map','1:a:0',
          '-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart','-shortest',str(target)])


print({size: SHA(OUT / f'l03-j01-first-half-{size}.mp4') for size in ('desktop','mobile')})
