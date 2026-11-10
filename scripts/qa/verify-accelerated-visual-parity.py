#!/usr/bin/env python3
"""Check exact media timing and copied audio/caption streams for all remasters."""
import hashlib
import importlib.util
import json
import pathlib
import subprocess
from PIL import Image, ImageChops, ImageStat

ROOT=pathlib.Path(__file__).resolve().parents[2]
RECEIPT=json.loads((ROOT/'artifacts/accelerated-visual-parity-2026-11-10/composite-receipt.json').read_text())
SOURCE=json.loads((ROOT/'lib/accelerated-end-screen-bindings.json').read_text())['lessons']
spec=importlib.util.spec_from_file_location('composer',ROOT/'scripts/qa/compose-accelerated-visual-parity.py')
composer=importlib.util.module_from_spec(spec)
spec.loader.exec_module(composer)

def sha(path):
    digest=hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda:stream.read(4*1024*1024),b''):digest.update(chunk)
    return digest.hexdigest()

def probe(path):
    output=subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_type,codec_name,nb_frames,width,height','-of','json',str(path)])
    return json.loads(output)

def stream_hash(path,selector):
    output=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-map',selector,'-c','copy','-f','streamhash','-hash','SHA256','-'])
    return output.decode().splitlines()[-1]

def presenter_sample(path,seconds,panel):
    x,y,w,h=panel
    x-=x%2;y-=y%2;w-=w%2;h-=h%2
    pixels=subprocess.check_output(['ffmpeg','-hide_banner','-loglevel','error','-ss',str(seconds),'-i',str(path),'-frames:v','1','-vf',f'crop={w}:{h}:{x}:{y}','-f','rawvideo','-pix_fmt','rgb24','-'])
    return Image.frombytes('RGB',(w,h),pixels)

assert len(RECEIPT['composites'])==16
for original,entry in zip(SOURCE,RECEIPT['composites']):
    assert original['lessonId']==entry['lesson_id']
    source=ROOT/entry['source_path'];final=ROOT/entry['output_path']
    assert sha(source)==original['videoSha256']==entry['source_sha256']
    assert sha(final)==entry['output_sha256']
    assert sha(ROOT/entry['caption_path'])==original['captionSha256']==entry['caption_sha256']
    left=probe(source);right=probe(final)
    assert abs(float(left['format']['duration'])-float(right['format']['duration']))<=0.04,entry['lesson_id']
    assert abs(float(right['format']['duration'])-entry['duration_seconds'])<=0.04,entry['lesson_id']
    lv=[s for s in left['streams'] if s['codec_type']=='video'][0]
    rv=[s for s in right['streams'] if s['codec_type']=='video'][0]
    assert int(lv['nb_frames'])==int(rv['nb_frames'])==round(entry['duration_seconds']*25),entry['lesson_id']
    assert (lv['width'],lv['height'])==(rv['width'],rv['height'])==(1920,1080)
    for selector in ('0:a:0','0:s:0'):
        assert stream_hash(source,selector)==stream_hash(final,selector),(entry['lesson_id'],selector)
    number=int(entry['lesson_id'][1:])
    panel=(0,0,1920,1080) if number==1 else composer.presenter_panel(number)
    window=entry['presenter_windows'][0]
    sample=(window[0]+window[1])/2
    left_frame=presenter_sample(source,sample,panel)
    right_frame=presenter_sample(final,sample,panel)
    mean_diff=sum(ImageStat.Stat(ImageChops.difference(left_frame,right_frame)).mean)/3
    assert mean_diff<3,(entry['lesson_id'],'presenter pixel drift',mean_diff)
    print(entry['lesson_id'],'frames',rv['nb_frames'],'audio/captions identical','presenter MAE',round(mean_diff,3))
