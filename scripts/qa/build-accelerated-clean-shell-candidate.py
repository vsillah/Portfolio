#!/usr/bin/env python3
"""Build an L08 presenter before/after proof of the repeated shell cleanup."""
import hashlib
import importlib.util
import json
import pathlib
import subprocess
import sys
import tempfile

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
BASE = pathlib.Path('artifacts/accelerated-visual-parity-2026-11-10')
OUT = BASE / 'visual-text-audit'
MANIFEST = pathlib.Path('docs/accelerated-course-modules/visual-production/manifest.json')
COMPOSITES = BASE / 'composite-receipt.json'
AUDIT = OUT / 'audit.json'
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('render_accelerated', ROOT / 'scripts/qa/render-accelerated-visual-parity.py')
renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)
spec = importlib.util.spec_from_file_location('compose_accelerated', ROOT / 'scripts/qa/compose-accelerated-visual-parity.py')
composer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(composer)


def sha(path):
    h=hashlib.sha256()
    with (ROOT/path).open('rb') as file:
        for chunk in iter(lambda:file.read(4*1024*1024),b''):h.update(chunk)
    return h.hexdigest()


def run(args):
    subprocess.run(args,check=True,capture_output=True)


def probe(path):
    return json.loads(subprocess.run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(ROOT/path)],
                                     capture_output=True,text=True,check=True).stdout)


def main():
    manifest=json.loads((ROOT/MANIFEST).read_text())
    composite=json.loads((ROOT/COMPOSITES).read_text())
    audit=json.loads((ROOT/AUDIT).read_text())
    assert audit['scene_count']==92 and audit['repeated_shared_shell_scene_count']==92
    lesson=next(x for x in manifest['lessons'] if x['id']=='L08')
    scene=lesson['scenes'][0]
    media=next(x for x in composite['composites'] if x['lesson_id']=='L08')
    assert scene['id']=='L08-01' and scene['start_seconds']==0
    assert sha(pathlib.Path(media['output_path']))==media['output_sha256']
    assert sha(pathlib.Path(media['source_path']))==media['source_sha256']
    assert sha(pathlib.Path(scene['script_path']))==scene['script_sha256']
    assert hashlib.sha256(scene['narration'].encode()).hexdigest()==scene['narration_sha256']
    OUT.mkdir(parents=True,exist_ok=True)
    clean=OUT/'l08-01-clean-presenter-frame.png'
    renderer.render(lesson,scene,0,presenter=True,clean=True).save(ROOT/clean)
    before=OUT/'l08-01-before-12s.mp4'
    after=OUT/'l08-01-clean-shell-12s.mp4'
    comparison=OUT/'l08-01-clean-shell-before-after.mp4'
    run(['ffmpeg','-v','error','-i',str(ROOT/media['output_path']),'-t','12',
         '-map','0:v:0','-map','0:a:0','-vf','fps=25,format=yuv420p','-r','25',
         '-c:v','libx264','-preset','fast','-crf','20','-c:a','aac','-b:a','192k',
         '-ar','48000','-ac','2','-movflags','+faststart','-y',str(ROOT/before)])
    x,y,w,h=composer.presenter_panel(8)
    assert (x,y,w,h)==(936,160,976,549)
    filt=(f'[0:v]fps=25,format=yuv420p[background];'
          f'[1:v]crop={w}:{h}:{x}:{y},fps=25,format=yuv420p[presenter];'
          f'[background][presenter]overlay={x}:{y}:shortest=1,format=yuv420p[v]')
    run(['ffmpeg','-v','error','-loop','1','-framerate','25','-i',str(ROOT/clean),
         '-i',str(ROOT/media['source_path']),'-filter_complex',filt,
         '-map','[v]','-map','1:a:0','-t','12','-r','25',
         '-c:v','libx264','-preset','fast','-crf','20','-c:a','aac','-b:a','192k',
         '-ar','48000','-ac','2','-movflags','+faststart','-y',str(ROOT/after)])
    with tempfile.TemporaryDirectory(prefix='clean-shell-compare-') as temp:
        temp=pathlib.Path(temp)
        listing=temp/'clips.txt'
        listing.write_text(f"file '{ROOT/before}'\nfile '{ROOT/after}'\n")
        run(['ffmpeg','-v','error','-f','concat','-safe','0','-i',str(listing),
             '-map','0:v:0','-map','0:a:0','-map_metadata','-1','-map_chapters','-1',
             '-vf','fps=25,format=yuv420p','-r','25','-c:v','libx264',
             '-profile:v','high','-level:v','4.1','-preset','medium','-crf','20',
             '-c:a','aac','-b:a','192k','-ar','48000','-ac','2',
             '-movflags','+faststart','-y',str(ROOT/comparison)])
    for file in (before,after,comparison):
        run(['ffmpeg','-v','error','-xerror','-i',str(ROOT/file),'-f','null','-'])
    info=probe(comparison)
    assert len(info['streams'])==2 and [x['codec_type'] for x in info['streams']]==['video','audio']
    assert abs(float(info['format']['duration'])-24)<.12
    stills={}
    for kind,file in [('before',before),('after',after)]:
        path=OUT/f'l08-01-{kind}-08s.png'
        run(['ffmpeg','-v','error','-ss','8','-i',str(ROOT/file),'-frames:v','1','-update','1','-y',str(ROOT/path)])
        stills[kind]={'path':str(path),'sha256':sha(path)}
    # The right-hand native presenter pixels should survive the local overlay and only video re-encoding.
    with Image.open(ROOT/stills['before']['path']) as a, Image.open(ROOT/stills['after']['path']) as b:
        a=a.convert('RGB').crop((x,y,x+w,y+h));b=b.convert('RGB').crop((x,y,x+w,y+h))
        from PIL import ImageChops, ImageStat
        mean=sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3
    assert mean < 3.0, mean
    receipt={'schema_version':1,'status':'review_only_repeated_shell_candidate',
             'source_manifest':{'path':str(MANIFEST),'sha256':sha(MANIFEST)},
             'source_composite_receipt':{'path':str(COMPOSITES),'sha256':sha(COMPOSITES)},
             'source_visual_audit':{'path':str(AUDIT),'sha256':sha(AUDIT)},
             'scene_id':'L08-01','source_script_sha256':scene['script_sha256'],
             'source_native_path':media['source_path'],'source_native_sha256':media['source_sha256'],
             'source_visual_path':media['output_path'],'source_visual_sha256':media['output_sha256'],
             'source_caption_path':media['caption_path'],'source_caption_sha256':media['caption_sha256'],
             'clean_presenter_frame':{'path':str(clean),'sha256':sha(clean)},
             'before':{'path':str(before),'sha256':sha(before),'duration_seconds':12},
             'candidate':{'path':str(after),'sha256':sha(after),'duration_seconds':12},
             'comparison':{'path':str(comparison),'sha256':sha(comparison),'before_seconds':[0,12],
                           'after_seconds':[12,24],'duration_seconds':float(info['format']['duration'])},
             'stills':stills,'native_presenter_panel':[x,y,w,h],
             'native_presenter_pixel_mean_rgb_error_after_reencoding':round(mean,3),
             'removed_visible_shell':['L08 / 01 scene code','repeated learner-artifact footer','decorative progress dots'],
             'retained_visible_copy':{'title':renderer.short_title(scene),'source':'approved scene title; no new learner-facing words'},
             'audio_treatment':'Native presenter speech only; AAC re-encoded in local comparison. No voice generation.',
             'full_mp4_decode':'passed','canonical_media_or_learner_binding_changed':False,
             'remaining_gate':'Final caption layout and full-lesson timing require the actual narration mix.'}
    output=OUT/'l08-01-clean-shell-receipt.json'
    (ROOT/output).write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
    print(f'Wrote {comparison}: {info["format"]["duration"]}s; presenter pixel mean RGB error {mean:.3f}')


if __name__=='__main__':main()
