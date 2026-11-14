#!/usr/bin/env python3
"""Build a local, unbound 345s still-composite review from existing L01 sources."""
import hashlib
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
BASE = HERE.parent
ROOT = HERE.parents[3]
V19 = BASE / 'c01-c02-v19-clean-master-review/l01-c01-c02-v19-clean-master-review.mp4'
V23 = BASE / 'c02-v23-player-still-review'
V24 = BASE / 'l01-v24-approved-art-still-review'
V25 = BASE / 'l01-v25-full-lesson-still-board'
VTT = BASE / 'c01-c02-v18-optional-caption-feasibility/lower-captions.vtt'
OUTPUT = HERE / 'l01-345s-unapproved-c02-local-review.mp4'
PICTURES = HERE / 'pictures'
SOURCES = {
    V19: '7002f7d9ffe917294969e24a17d98459f9d700f319fa576f30613c63442a9e3f',
    VTT: '427376480d444d321513ddc09c226e7896967909d8baa790b1569dd4a79b508b',
    V23 / 'generated-desk-source.png': 'c2df07cb81d6f0e5e3591d9c0f7c97f0fac087a9f4980c899179203fc7267b55',
    V25 / 'decision-file-approved-source-crop.png': '3dc3c8501c2c0720cb7a10c775b703539255bad541e9d59e38b2b640399c7792',
}
SEGMENTS = [
    (0.000, 'P01'), (28.400, 'C01-blank'), (75.000, 'C01-inputs'),
    (90.000, 'C01-evidence'), (105.000, 'C01-human'),
    (149.695, 'Signals'), (157.558, 'SAM-orientation'),
    (173.048, 'Signals'), (179.398, 'Alignment'), (184.710, 'Momentum'),
    (190.000, 'Book'), (197.570, 'Signals'), (200.230, 'Alignment'),
    (204.320, 'SAM-crossing'), (208.350, 'Book'), (212.820, 'C01-evidence'),
    (225.000, 'Book'), (235.000, 'P02-Sam'),
    (248.690, 'C02-desk'), (295.977, 'C02-synthetic'),
    (314.637, 'C02-columns'), (316.137, 'C02-enter'),
    (318.357, 'C02-two'), (320.837, 'C02-three'),
    (323.597, 'C02-review'), (331.977, 'C02-handoff'),
]
FONT = '/System/Library/Fonts/Avenir Next.ttc'
CATEGORY_LABELS = ('Public', 'Approved for this use', 'Restricted')
BOUNDARY_STAGES = {
    'C02-columns': (0, False),
    'C02-enter': (0, True),
    'C02-two': (2, True),
    'C02-three': (3, True),
    'C02-review': (3, True),
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


def check():
    for path, digest in SOURCES.items():
        assert path.is_file() and sha(path) == digest, f'source drift: {path}'
    v24 = module(V24/'build.py', 'v24_picture')
    v23 = module(V23/'build.py', 'v23_picture')
    v25 = module(V25/'build_handoff.py', 'v25_handoff')
    # v13 is a legacy playback render checked by v24 but not read by any v26
    # picture path. Keep the v26 package reproducible without that old MP4.
    for key, (path, digest) in v24.SOURCE.items():
        if key == 'v13':
            continue
        assert path.is_file() and sha(path) == digest, f'v24 source drift: {path}'
    for path, digest in v23.SOURCE_HASHES.items():
        assert path.is_file() and sha(path) == digest, f'v23 source drift: {path}'
    assert len([x for x in VTT.read_text().split('\n\n') if '-->' in x]) == 175
    return v24, v23, v25


def boundary_overlay(frame, name):
    """Move a fictional card into a distinct neutral tray, then hold it there."""
    revealed, in_review_tray = BOUNDARY_STAGES[name]
    overlay = Image.new('RGBA', frame.size, (0,0,0,0))
    draw = ImageDraw.Draw(overlay)
    draw.rectangle((0,0,1280,242), fill=(3,21,31,228))
    for i,(x,label) in enumerate(zip((36,446,856), CATEGORY_LABELS)):
        draw.rounded_rectangle((x,16,x+368,116), radius=11, outline=(222,175,81), width=3)
        if i < revealed:
            size = 43 if i != 1 else 35
            face = ImageFont.truetype(FONT,size,index=2)
            box = draw.textbbox((0,0),label,font=face)
            draw.text((x+(368-(box[2]-box[0]))//2,41),label,font=face,fill=(251,246,231))
    # The full-width tray is separate from every category box.
    draw.rounded_rectangle((36,132,1224,223), radius=12, outline=(222,175,81), width=3)
    draw.text((58,157),'Review before use',font=ImageFont.truetype(FONT,42,index=2),fill=(251,246,231))
    card_x,card_y = (598,146) if in_review_tray else (598,427)
    draw.rounded_rectangle((card_x,card_y,card_x+565,card_y+66), radius=12, fill=(234,223,199), outline=(222,175,81), width=3)
    draw.text((card_x+18,card_y+8),'First-week request list',font=ImageFont.truetype(FONT,40,index=2),fill=(23,48,52))
    return Image.alpha_composite(frame.convert('RGBA'),overlay).convert('RGB')


def picture(name, v24, v23, v25):
    if name in ('P01','C01-inputs','C01-evidence','C01-human','Signals','Alignment','Momentum','P02-Sam'):
        return v24.picture(name)[0]
    if name in ('SAM-orientation','SAM-crossing'):
        return v24.picture(name, mobile=True)[0]
    if name == 'C01-blank':
        frame = v24.ground()
        source = v24.picture('P01')[0].crop((45,125,705,635))
        source = source.resize((825,638), Image.Resampling.LANCZOS)
        frame.paste(source, (227,41))
        return frame
    if name == 'Book':
        frame = v24.ground()
        art = Image.open(v24.SOURCE['book'][0]).convert('RGB')
        v24.place(frame, art, (355,10,925,710))
        return frame
    if name.startswith('C02-') and name != 'C02-handoff':
        art = Image.open(V23/'generated-desk-source.png').convert('RGB')
        frame = v23.picture(art, 1280, 0)
        if name == 'C02-synthetic':
            overlay = Image.new('RGBA', frame.size, (0,0,0,0))
            draw = ImageDraw.Draw(overlay)
            draw.rounded_rectangle((38,27,783,108), radius=15, fill=(3,21,31,229), outline=(222,175,81), width=3)
            draw.text((62,43), 'Fictional first-week request list', font=ImageFont.truetype(FONT,39,index=2), fill=(251,246,231))
            frame = Image.alpha_composite(frame.convert('RGBA'),overlay).convert('RGB')
        elif name in BOUNDARY_STAGES:
            frame = boundary_overlay(frame,name)
        return frame
    if name == 'C02-handoff':
        art = Image.open(V25/'decision-file-approved-source-crop.png').convert('RGB')
        return v25.fit_on_navy(art, mobile=True)
    raise AssertionError(name)


def prepare():
    v24,v23,v25 = check()
    PICTURES.mkdir(parents=True,exist_ok=True)
    unique = list(dict.fromkeys(name for _,name in SEGMENTS))
    records = {}
    for name in unique:
        frame = picture(name,v24,v23,v25)
        assert frame.size == (1280,720)
        dest = PICTURES/f'{name}.png'
        frame.save(dest,optimize=True)
        records[name] = {'path':str(dest.relative_to(ROOT)),'sha256':sha(dest)}
    timeline=[]
    starts=[round(t*25) for t,_ in SEGMENTS]+[8625]
    assert starts==sorted(starts) and starts[0]==0 and starts[-1]==8625
    for i,(seconds,name) in enumerate(SEGMENTS):
        frame_start,frame_end=starts[i],starts[i+1]
        timeline.append({'name':name,'spoken_start_seconds':seconds,'frame_start':frame_start,'frame_end':frame_end,'frame_start_seconds':frame_start/25,'frame_end_seconds':frame_end/25,'frame_drift_seconds':round(frame_start/25-seconds,3),'picture_sha256':records[name]['sha256']})
    ffconcat=['ffconcat version 1.0']
    for row in timeline:
        ffconcat.append(f"file '{(PICTURES/(row['name']+'.png')).resolve()}'")
        ffconcat.append(f"duration {(row['frame_end']-row['frame_start'])/25:.3f}")
    ffconcat.append(f"file '{(PICTURES/(timeline[-1]['name']+'.png')).resolve()}'")
    (HERE/'timeline.ffconcat').write_text('\n'.join(ffconcat)+'\n')
    receipt={'status':'prepared_local_unapproved_concept_pending_visual_gate','source_hashes':{str(p.relative_to(ROOT)):d for p,d in SOURCES.items()},'picture_sources':records,'timeline':timeline,'source_v19_audio':'AAC 48 kHz stereo from unchanged 345s v19 review master','optional_vtt':str(VTT.relative_to(ROOT)),'C02_concept_state':'UNAPPROVED CONCEPT; fictional image, not learner source or live data','notes':['C02 desk represents a human choice about what may enter an external tool; no automatic enforcement is claimed.','The fictional first-week request card moves from the desk into a full-width Review before use tray that is visually separate from all three category boxes; it remains there unassigned as category labels appear. Its wording comes from L01 narration and adds no case facts.','The boundary categories use v23 approved-for-this-use wording; the later Decision File image comes from an approved L01 source frame.','SAM overview/crossing uses the approved three-plate mobile reflow for one 16:9 video at desktop and narrow widths.','This is a local still-composite review, not motion-qualified learner media.']}
    (HERE/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print('prepared',len(unique),'pictures and',len(timeline),'timed segments')


def render():
    receipt=json.loads((HERE/'receipt.json').read_text())
    assert receipt['status']=='prepared_local_unapproved_concept_pending_visual_gate'
    for entry in receipt['picture_sources'].values():
        path=ROOT/entry['path'];assert sha(path)==entry['sha256'],path
    command=['ffmpeg','-v','error','-safe','0','-f','concat','-i',str(HERE/'timeline.ffconcat'),'-i',str(V19),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-r','25','-frames:v','8625','-c:a','copy','-movflags','+faststart','-y',str(OUTPUT)]
    subprocess.run(command,check=True)
    receipt['status']='rendered_local_unapproved_concept_pending_qa'
    receipt['render_command']=command
    receipt['output']={'path':str(OUTPUT.relative_to(ROOT)),'sha256':sha(OUTPUT)}
    (HERE/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print('rendered',OUTPUT)


if __name__=='__main__':
    if len(sys.argv)!=2 or sys.argv[1] not in ('prepare','render'):
        raise SystemExit('usage: build.py prepare|render')
    {'prepare':prepare,'render':render}[sys.argv[1]]()
