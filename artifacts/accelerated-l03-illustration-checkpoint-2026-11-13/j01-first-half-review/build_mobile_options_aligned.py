"""One bounded mobile-only repair after the options still/timing preflight passed."""
from pathlib import Path
from PIL import Image
import hashlib, json, subprocess

HERE=Path(__file__).resolve().parent
OUT=HERE/'outputs'
SCENE=HERE.parent/'scene01-contextual-review/outputs/l03-scene01-mobile-single-plate.mp4'
DESKTOP=OUT/'l03-j01-first-half-desktop.mp4'
P02=OUT/'mobile-p02.mp4'
SOURCE=HERE/'source/options.png'
PREFLIGHT=HERE/'options-timing-preflight/receipt.json'
SHA=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def run(args):subprocess.run(args,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)

pre=json.loads(PREFLIGHT.read_text())
assert pre['status']=='passed_for_one_bounded_mobile_render'
assert SHA(SOURCE)==pre['source_sha256']
assert SHA(SCENE)=='b689d516ef94bf3caf81d82d2840739e84afc144fe16674fbe31d76144d728fc'
assert SHA(DESKTOP)=='6cbca81b31e146e075d98c8ba3832e181e59af097a1f7cbfa95bade282b33a61'

im=Image.open(SOURCE).convert('RGB');w,h=im.size;cw=round(h*390/844)
assert cw<w
beats=[('email',.19,334),('guided',.50,69),('staff',.79,76),('general',.50,7)]
assert sum(n for _,_,n in beats)==486
clips=[]
for name,center,frames in beats:
    left=max(0,min(w-cw,round(w*center-cw/2)))
    still=OUT/f'mobile-options-aligned-{name}.png'
    im.crop((left,0,left+cw,h)).resize((390,844),Image.Resampling.LANCZOS).save(still)
    mp4=still.with_suffix('.mp4')
    run(['ffmpeg','-v','error','-y','-loop','1','-framerate','25','-i',str(still),
         '-frames:v',str(frames),'-an','-vf','format=yuv420p',
         '-c:v','libx264','-preset','veryfast','-crf','19',str(mp4)])
    clips.append(mp4)

prior=lambda s,b:OUT/f'mobile-single-s{s:02d}-b{b}.mp4'
files=[SCENE,*[prior(s,b) for s in range(3) for b in range(2)],P02,*clips,
       *[prior(s,b) for s in range(4,8) for b in range(3 if s==7 else 2)]]
assert all(p.exists() for p in files)
playlist=OUT/'mobile-options-aligned.ffconcat'
playlist.write_text('ffconcat version 1.0\n'+''.join(f"file '{p}'\n" for p in files))
video=OUT/'mobile-options-aligned-video.mp4'
run(['ffmpeg','-v','error','-y','-safe','0','-f','concat','-i',str(playlist),
     '-map','0:v:0','-c','copy',str(video)])
target=OUT/'l03-j01-first-half-mobile-options-aligned.mp4'
run(['ffmpeg','-v','error','-y','-i',str(video),'-i',str(DESKTOP),
     '-map','0:v:0','-map','1:a:0','-c','copy','-movflags','+faststart',str(target)])
receipt={'status':'rendered_pending_player_qa','target':'outputs/'+target.name,
 'sha256':SHA(target),'preflight_sha256':SHA(PREFLIGHT),
 'approved_scene1_sha256':SHA(SCENE),'desktop_sha256':SHA(DESKTOP),
 'source_options_sha256':SHA(SOURCE),
 'reused_segments':[str(p) for p in files if p not in clips],
 'new_option_beats':[{'name':n,'center_x_fraction':c,'frames':f,'image_sha256':SHA(OUT/f'mobile-options-aligned-{n}.png')} for n,c,f in beats],
 'superseded':['outputs/l03-j01-first-half-mobile.mp4','outputs/l03-j01-first-half-mobile-single-plate.mp4'],
 'exclusions':'No provider, image/speech generation, spend, learner binding, PR update, commit, merge, deployment, publication or release.'}
(HERE/'mobile-options-aligned-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'path':str(target),'sha256':SHA(target)},indent=2))
