"""Correct only the post-Scene-1 mobile J01 art: one illustration per frame."""
from pathlib import Path
from PIL import Image
import hashlib, json, subprocess

HERE=Path(__file__).resolve().parent
OUT=HERE/'outputs'
SCENE=HERE.parent/'scene01-contextual-review/outputs/l03-scene01-mobile-single-plate.mp4'
DESKTOP=OUT/'l03-j01-first-half-desktop.mp4'
P02=OUT/'mobile-p02.mp4'
SHA=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def run(args):subprocess.run(args,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
assert SHA(SCENE)=='b689d516ef94bf3caf81d82d2840739e84afc144fe16674fbe31d76144d728fc'
assert SHA(DESKTOP)=='6cbca81b31e146e075d98c8ba3832e181e59af097a1f7cbfa95bade282b33a61'
assert P02.exists()

# The segment boundaries and total frame counts remain those of the first-half edit.
# Each cutaway uses one portrait crop at a time, with the focal point moving at
# narration-aligned beats. No frame stacks overview and detail from the same art.
segments=[
  (36.75,55.64,'priority',[.39,.54]),
  (55.64,74.56,'decision',[.22,.48]),
  (74.56,95.36,'decision',[.50,.75]),
  (95.36,114.80,'options',[.19,.50]),
  (114.80,134.48,'options',[.50,.79]),
  (134.48,153.00,'evidence',[.22,.50]),
  (153.00,174.72,'evidence',[.52,.78]),
  (174.72,196.64,'gap',[.20,.50,.79]),
]
ext={'priority':'.png','decision':'.webp','options':'.png','evidence':'.webp','gap':'.png'}
clips=[]; source_hashes={}
for seg,(start,end,key,centers) in enumerate(segments):
    source=HERE/'source'/f'{key}{ext[key]}'
    source_hashes[key]=SHA(source)
    im=Image.open(source).convert('RGB');w,h=im.size
    cw=round(h*390/844)
    assert cw<w
    frames=round((end-start)*25)
    counts=[frames//len(centers)]*len(centers)
    counts[-1]+=frames-sum(counts)
    for beat,(center,count) in enumerate(zip(centers,counts)):
        left=max(0,min(w-cw,round(w*center-cw/2)))
        plate=im.crop((left,0,left+cw,h)).resize((390,844),Image.Resampling.LANCZOS)
        still=OUT/f'mobile-single-s{seg:02d}-b{beat}.png'
        plate.save(still)
        clip=still.with_suffix('.mp4')
        run(['ffmpeg','-v','error','-y','-loop','1','-framerate','25','-i',str(still),
             '-frames:v',str(count),'-an','-vf','format=yuv420p',
             '-c:v','libx264','-preset','veryfast','-crf','19',str(clip)])
        clips.append((seg,beat,key,center,count,clip))

playlist=OUT/'mobile-single-plate.ffconcat'
files=[SCENE,*[c[-1] for c in clips[:6]],P02,*[c[-1] for c in clips[6:]]]
playlist.write_text('ffconcat version 1.0\n'+''.join(f"file '{p}'\n" for p in files))
video=OUT/'mobile-single-plate-video.mp4'
run(['ffmpeg','-v','error','-y','-safe','0','-f','concat','-i',str(playlist),
     '-map','0:v:0','-c','copy',str(video)])
target=OUT/'l03-j01-first-half-mobile-single-plate.mp4'
# Copy the already-qualified desktop AAC packets byte-for-byte into mobile.
run(['ffmpeg','-v','error','-y','-i',str(video),'-i',str(DESKTOP),
     '-map','0:v:0','-map','1:a:0','-c','copy','-movflags','+faststart','-shortest',str(target)])
receipt={
  'status':'corrected_local_review_only',
  'supersedes':'outputs/l03-j01-first-half-mobile.mp4',
  'corrected_mobile':'outputs/'+target.name,
  'corrected_sha256':SHA(target),
  'approved_scene1_sha256':SHA(SCENE),
  'desktop_audio_source_sha256':SHA(DESKTOP),
  'source_still_sha256':source_hashes,
  'crop_beats':[{'segment':s,'beat':b,'source':k,'center_x_fraction':c,'frames':n} for s,b,k,c,n,_ in clips],
  'description':'One source illustration crop fills each post-Scene-1 cutaway frame; overview and detail never coexist. Native P02 was copied unchanged.',
  'exclusions':'No provider, image or speech generation, spend, learner media change, PR update, commit, merge, deployment, publication or release.'
}
(HERE/'mobile-single-plate-correction-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'sha256':SHA(target),'frames_expected':1475+sum(x[4] for x in clips)+421,'cutaway_beats':len(clips)},indent=2))
