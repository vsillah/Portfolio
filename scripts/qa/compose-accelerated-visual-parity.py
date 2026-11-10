#!/usr/bin/env python3
"""Replace static teaching cards while copying approved audio/subtitles and presenter pixels."""
from __future__ import annotations

import hashlib
import json
import pathlib
import subprocess
import sys

ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'artifacts/accelerated-visual-parity-2026-11-10'
SCENES=json.loads((OUT/'scene-receipt.json').read_text())['scenes']
SOURCES=json.loads((ROOT/'lib/accelerated-end-screen-bindings.json').read_text())['lessons']
MANIFEST=json.loads((ROOT/'docs/accelerated-course-modules/visual-production/manifest.json').read_text())
VIDEO_OUT=OUT/'composites'
VIDEO_OUT.mkdir(parents=True,exist_ok=True)

def sha(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for chunk in iter(lambda:f.read(4*1024*1024),b''):h.update(chunk)
    return h.hexdigest()

def original_manifest(number):
    if number==1:return ROOT/'docs/accelerated-course-modules/l01-guided-video/approved-composite/composite-manifest.json'
    if number in (2,3):return ROOT/f'docs/accelerated-course-modules/l{number:02d}-native-composite/composite-manifest.json'
    if number==4:return ROOT/'docs/accelerated-course-modules/l04-learner-binding/composite-manifest.json'
    group=(number-1)//4*4+1
    return ROOT/f'artifacts/accelerated-l{group:02d}-l{group+3:02d}-native-composite-2026-11-04/l{number:02d}/composite-manifest.json'

def windows(number):
    record=json.loads(original_manifest(number).read_text())
    total=0;result=[]
    for item in record['timeline']:
        start=item.get('timeline_start_seconds',total)
        end=item.get('timeline_end_seconds',start+item['frames']/25)
        if item.get('kind')=='presenter' or item.get('source') is not None:
            result.append([round(start,3),round(end,3)])
        total=end
    return result,round(total,3)

def presenter_panel(number):
    record=json.loads(original_manifest(number).read_text())
    if number<=4:
        segment=next(item for item in record['timeline'] if item.get('source') is not None)
        x,y=segment['overlay']
        return x,y,record['overlay']['frame_width'],record['overlay']['frame_height']
    p=record['presenter_panel']
    return p['x'],p['y'],p['width'],p['height']

def render(number):
    id=f'L{number:02d}'
    lesson=next(x for x in MANIFEST['lessons'] if x['id']==id)
    source=SOURCES[number-1]
    source_file=ROOT/'public'/source['videoPath'].lstrip('/')
    caption_file=ROOT/'public'/source['captionPath'].lstrip('/')
    assert sha(source_file)==source['videoSha256'],id+' video drift'
    assert sha(caption_file)==source['captionSha256'],id+' captions drift'
    assert len([s for s in SCENES if s['scene_id'].startswith(id)])==len(lesson['scenes'])
    presenter,duration=windows(number)
    assert duration==lesson['runtime_seconds'],(id,duration,lesson['runtime_seconds'])
    rows=[]; presenter_rows=[]
    for scene in lesson['scenes']:
        row=next(s for s in SCENES if s['scene_id']==scene['id'])
        frame=ROOT/row['frame_path']
        assert sha(ROOT/scene['script_path'])==scene['script_sha256'],scene['id']+' script drift'
        assert hashlib.sha256(scene['narration'].encode()).hexdigest()==scene['narration_sha256'],scene['id']+' narration drift'
        assert row['source_script_sha256']==scene['script_sha256'] and sha(frame)==row['frame_sha256'],scene['id']+' frame drift'
        presenter_frame=ROOT/row['presenter_frame_path']
        assert sha(presenter_frame)==row['presenter_frame_sha256'],scene['id']+' presenter frame drift'
        if row.get('segments'):
            assert sum(part['duration_seconds'] for part in row['segments'])==scene['duration_seconds']
            for part in row['segments']:
                segment=ROOT/part['frame_path']
                assert sha(segment)==part['frame_sha256'],scene['id']+' segment drift'
                rows.append(f"file '{segment}'\nduration {part['duration_seconds']:.6f}")
                frame=segment
        else:rows.append(f"file '{frame}'\nduration {scene['duration_seconds']:.6f}")
        presenter_rows.append(f"file '{presenter_frame}'\nduration {scene['duration_seconds']:.6f}")
    rows.append(f"file '{frame}'")
    presenter_rows.append(f"file '{presenter_frame}'")
    listing=VIDEO_OUT/f'{id}-frames.txt'
    listing.write_text('\n'.join(rows)+'\n')
    presenter_listing=VIDEO_OUT/f'{id}-presenter-frames.txt'
    presenter_listing.write_text('\n'.join(presenter_rows)+'\n')
    enable='+'.join(f'between(t,{a},{b})' for a,b in presenter) or '0'
    if number==1:
        # L01 has a differently placed presenter; retain the full approved frame.
        filt=f"[0:v]fps=25,format=yuv420p[art];[2:v]format=yuv420p[original];[art][original]overlay=enable='{enable}':shortest=1,format=yuv420p[v]"
    else:
        # The native presenter occupies the right-hand studio panel. The left
        # teaching card is replaced, including its old production instructions.
        x,y,w,h=presenter_panel(number)
        filt=f"[0:v]fps=25,format=yuv420p[art];[1:v]fps=25,format=yuv420p[presenterArt];[art][presenterArt]overlay=enable='{enable}':shortest=1[base];[2:v]crop={w}:{h}:{x}:{y},format=yuv420p[presenter];[base][presenter]overlay={x}:{y}:enable='{enable}':shortest=1,format=yuv420p[v]"
    output=VIDEO_OUT/f'{id}-visual-review.mp4'
    args=['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(listing),'-f','concat','-safe','0','-i',str(presenter_listing),'-i',str(source_file),'-filter_complex',filt,'-map','[v]','-map','2:a:0','-map','2:s:0','-c:v','libx264','-preset','veryfast','-crf','22','-r','25','-c:a','copy','-c:s','copy','-t',str(duration),'-movflags','+faststart',str(output)]
    subprocess.run(args,check=True)
    return {'lesson_id':id,'source_path':str(source_file.relative_to(ROOT)),'source_sha256':sha(source_file),'caption_path':str(caption_file.relative_to(ROOT)),'caption_sha256':sha(caption_file),'output_path':str(output.relative_to(ROOT)),'output_sha256':sha(output),'duration_seconds':duration,'presenter_windows':presenter,'scene_count':len(lesson['scenes'])}

def main():
    selected=[int(x) for x in sys.argv[1:]] if len(sys.argv)>1 else list(range(1,17))
    receipt_path=OUT/'composite-receipt.json'
    receipt=json.loads(receipt_path.read_text()) if receipt_path.exists() else {'schema_version':1,'composites':[]}
    for number in selected:
        result=render(number)
        receipt['composites']=[r for r in receipt['composites'] if r['lesson_id']!=result['lesson_id']]+[result]
        receipt['composites'].sort(key=lambda r:r['lesson_id'])
        receipt_path.write_text(json.dumps(receipt,indent=2)+'\n')
        print(result['lesson_id'],result['output_sha256'],flush=True)

if __name__=='__main__':main()
