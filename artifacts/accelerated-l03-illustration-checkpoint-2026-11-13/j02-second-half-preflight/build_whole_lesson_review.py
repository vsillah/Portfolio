"""Provider-free contextual L03 local review from recovered, hash-bound inputs."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
import hashlib, json, re, subprocess

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
CHECK=HERE.parent
FIRST=CHECK/'j01-first-half-review/outputs'
NATIVE=Path.home() / 'Projects/Portfolio/artifacts/accelerated-l03-heygen-2026-11-04/accelerated-l03-heygen-native.mp4'
BOUND=ROOT/'public/accelerated/lessons/l03/approved-02b9c3ea/accelerated-l03-native-composite.mp4'
J02=HERE/'l03-j02-original.wav'
WORDS=json.loads((HERE/'l03-j02-provider-word-timestamps-recovered.json').read_text())['words']
PACK=json.loads((ROOT/'docs/accelerated-course-modules/narration-production-pack-2026-11-10.json').read_text())
ASSETS=json.loads((HERE/'asset-map-recovered.json').read_text())
OUT=HERE/'whole-lesson-review';OUT.mkdir(exist_ok=True)
SHA=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def run(args):subprocess.run(args,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
assert SHA(FIRST/'l03-j01-first-half-desktop.mp4')=='6cbca81b31e146e075d98c8ba3832e181e59af097a1f7cbfa95bade282b33a61'
assert SHA(FIRST/'l03-j01-first-half-mobile-options-aligned.mp4')=='2cee5081cc116c0373822b4a91edf38b09de875d6731ea5b719be20d29b03141'
assert SHA(J02)=='4b1b3217ae87e1c74bbb197204bf7a618414e00b9f3dc2bb800439715b7248b3'
assert SHA(NATIVE)=='064e049bfaee6d60d5d811d516dbcdf9c14466602afef9a34e07cbf31c551198'
assert SHA(BOUND)=='02b9c3ea941c22ffaf87b3bc4e4c4612951499af15485e0261910fad6014053a'
for value in ASSETS.values():assert SHA(Path(value['local']))==value['sha256']
lesson=next(x for x in PACK['lessons'] if x['lesson_id']=='L03')
text=next(x['text'] for x in lesson['speech_jobs'] if x['id']=='J02')
assert len(text)==1725 and hashlib.sha256(text.encode()).hexdigest()=='dc20339871d23b789fbe6a29f9cd849d2ce9ac1f5fc917abd931b09fcd426f89'
canonical=text.replace('-',' ').split()
norm=lambda x:re.sub('[^a-z0-9]','',x.lower())
assert len(canonical)==len(WORDS)==302
assert all(norm(a)==norm(b['text']) for a,b in zip(canonical,WORDS))

# Every cut falls inside a measured pause in the returned J02 word timestamps.
cuts=[0,315,555,1243,1577,1981,2345,2457]
indices=[0,39,67,147,188,242,287,302]
for wi,frame in zip(indices[1:-1],cuts[1:-1]):
    cut=frame/25
    assert WORDS[wi-1]['end_time']<cut<WORDS[wi]['start_time'],(wi,cut)
beats=['decision-card','prototype-session','evidence-ledger','learner-pause','clipped-pages','person-behind-evidence','attach-pages']
centers={'decision-card':.50,'prototype-session':.49,'evidence-ledger':.48,'learner-pause':.49,'clipped-pages':.52,'person-behind-evidence':.73,'attach-pages':.53}

def art(key,size):
    im=Image.open(ASSETS[key]['local']).convert('RGB')
    if size=='desktop':return ImageOps.fit(im,(1920,1080),method=Image.Resampling.LANCZOS)
    w,h=im.size;cw=round(h*390/844);left=max(0,min(w-cw,round(w*centers[key]-cw/2)))
    return im.crop((left,0,left+cw,h)).resize((390,844),Image.Resampling.LANCZOS)

def presenter_background(key,size):
    if size=='desktop':
        bg=Image.new('RGB',(1920,1080),'#0c2531')
        scene=Image.open(ASSETS[key]['local']).convert('RGB')
        scene=ImageOps.fit(scene,(920,704),method=Image.Resampling.LANCZOS)
        bg.paste(scene,(40,188));ImageDraw.Draw(bg).rectangle((999,299,1810,756),outline='#d8b56f',width=2)
    else:
        bg=Image.new('RGB',(390,844),'#0c2531')
        scene=Image.open(ASSETS[key]['local']).convert('RGB').resize((390,219),Image.Resampling.LANCZOS)
        bg.paste(scene,(0,180));ImageDraw.Draw(bg).rectangle((0,469,389,689),outline='#d8b56f',width=1)
    return bg

def still_clip(im,path,frames):
    png=path.with_suffix('.png');im.save(png)
    run(['ffmpeg','-v','error','-y','-loop','1','-framerate','25','-i',str(png),'-frames:v',str(frames),'-an','-vf','format=yuv420p','-c:v','libx264','-preset','veryfast','-crf','19',str(path)])

def presenter_clip(size,key,a,b,path):
    png=path.with_suffix('.png');presenter_background(key,size).save(png)
    scale='810:456' if size=='desktop' else '390:219'
    xy='1000:300' if size=='desktop' else '0:470'
    run(['ffmpeg','-v','error','-y','-loop','1','-framerate','25','-i',str(png),'-i',str(NATIVE),
         '-filter_complex',f'[1:v]trim=start_frame={a}:end_frame={b},setpts=PTS-STARTPTS,scale={scale}[p];[0:v][p]overlay={xy}:shortest=1,format=yuv420p[v]',
         '-map','[v]','-frames:v',str(b-a),'-an','-c:v','libx264','-preset','veryfast','-crf','19',str(path)])

for size in ('desktop','mobile'):
    clips=[]
    p=OUT/f'{size}-p03.mp4';presenter_clip(size,'decision-card',978,1260,p);clips.append(p)
    for i,key in enumerate(beats[:6]):
        p=OUT/f'{size}-c03-{i+1:02d}.mp4';still_clip(art(key,size),p,cuts[i+1]-cuts[i]);clips.append(p)
    p=OUT/f'{size}-p04.mp4';presenter_clip(size,'attach-pages',1260,1567,p);clips.append(p)
    p=OUT/f'{size}-c04.mp4';still_clip(art('attach-pages',size),p,cuts[-1]-cuts[-2]);clips.append(p)
    first=FIRST/('l03-j01-first-half-desktop.mp4' if size=='desktop' else 'l03-j01-first-half-mobile-options-aligned.mp4')
    playlist=OUT/f'{size}.ffconcat';playlist.write_text('ffconcat version 1.0\n'+''.join(f"file '{x}'\n" for x in [first,*clips]))
    video=OUT/f'{size}-silent.mp4'
    run(['ffmpeg','-v','error','-y','-safe','0','-f','concat','-i',str(playlist),'-map','0:v:0','-c','copy',str(video)])

# The original native picture source has different audio; retain bound composite
# audio for presenter windows and exact returned J02 PCM for cutaways.
audio=OUT/'whole-lesson-audio.wav'
run(['ffmpeg','-v','error','-y','-i',str(FIRST/'j01-first-half-audio.wav'),'-i',str(BOUND),'-i',str(J02),'-filter_complex',
 '[0:a]atrim=0:235.75,asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[f];'
 '[1:a]atrim=349:360.28,asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[p3];'
 '[2:a]atrim=0:93.8,asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[c3];'
 '[1:a]atrim=513.96:526.24,asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[p4];'
 '[2:a]atrim=start=93.8,asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[c4];'
 '[f][p3][c3][p4][c4]concat=n=5:v=0:a=1[a]',
 '-map','[a]','-c:a','pcm_s16le',str(audio)])
for size in ('desktop','mobile'):
    target=OUT/f'l03-whole-lesson-{size}-local-review.mp4'
    run(['ffmpeg','-v','error','-y','-i',str(OUT/f'{size}-silent.mp4'),'-i',str(audio),
         '-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart',str(target)])

receipt={'status':'rendered_pending_qa','source_commit':'2002dda495dd319dd936fea00a405928bba3302e',
 'input_hashes':{'first_desktop':SHA(FIRST/'l03-j01-first-half-desktop.mp4'),'first_mobile':SHA(FIRST/'l03-j01-first-half-mobile-options-aligned.mp4'),'j02_wav':SHA(J02),'native_picture':SHA(NATIVE),'bound_audio':SHA(BOUND)},
 'j02_boundary_frames':cuts,'j02_boundary_word_indices':indices,
 'native_picture_ranges':{'P03':[978,1260],'P04':[1260,1567]},
 'native_audio_ranges_seconds':{'P03':[349,360.28],'P04':[513.96,526.24]},
 'output_hashes':{p.name:SHA(p) for p in [audio,OUT/'l03-whole-lesson-desktop-local-review.mp4',OUT/'l03-whole-lesson-mobile-local-review.mp4']},
 'excluded_actions':'No provider generation, spend, learner media change, PR update, commit, merge, deployment, publication or release.'}
(OUT/'render-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt['output_hashes'],indent=2))
