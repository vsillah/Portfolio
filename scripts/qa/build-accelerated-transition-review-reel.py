#!/usr/bin/env python3
"""Build a bounded native-audio reel for transition review; no new speech."""
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
OUT = BASE / 'native-transition-audit'
REEL = OUT / 'native-transition-review-reel.mp4'
EDL = BASE / 'full-lesson-timing-decisions.json'
AUDIT = OUT / 'full-l01-l16.json'
sys_path = ROOT / 'scripts/qa/build-presenter-priority-reel.py'
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('priority_reel', sys_path)
media = importlib.util.module_from_spec(spec)
spec.loader.exec_module(media)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(args):
    subprocess.run(args, check=True, capture_output=True)


def main():
    edl = json.loads((ROOT / EDL).read_text())
    audit = json.loads((ROOT / AUDIT).read_text())
    assert audit['presenter_window_count'] == 64 and audit['transition_count'] == 111
    by_lesson = {x['lesson_id']: x for x in edl['lessons']}
    cases = [
        ('source', 'L01', 248.20, 'P02→C02 · original source', 'Existing VTT cue 245.06–252.51 crosses this boundary.'),
        ('source', 'L02', 29.76, 'P01→C01 · original source', 'Existing VTT cue 29.48–40.35 crosses this boundary.'),
        ('source', 'L04', 365.24, 'P03→C03 · original source', 'Existing VTT cue 355.56–365.67 crosses this boundary.'),
        ('coordinated', 'L05', 397.58, 'A02→A03 · local joined clip', 'C02 ends 397.58 · zero planned transition reserve.'),
        ('coordinated', 'L06', 437.72, 'A02→A03 · local joined clip', 'C02 ends 437.72 · zero planned transition reserve.'),
        ('coordinated', 'L08', 478.00, 'A02→A03 · local joined clip', 'C02 ends 478.00 · zero planned transition reserve.'),
        ('source', 'L10', 382.20, 'P03→C03 · original source', 'Existing VTT cue crosses; C03 needs 135.4 wpm.'),
        ('source', 'L15', 508.84, 'P03→C03 · original source', 'Existing VTT cue crosses; C03 needs 135.2 wpm.'),
    ]
    OUT.mkdir(parents=True, exist_ok=True)
    entries, chunks = [], []
    cursor = 0.0
    with tempfile.TemporaryDirectory(prefix='accelerated-transition-reel-') as temp:
        temp = pathlib.Path(temp)
        for number, (kind, lid, target, title, note) in enumerate(cases, 1):
            lesson = by_lesson[lid]
            source = ROOT / lesson['source_bindings']['native_source']['path']
            assert sha(source) == lesson['source_bindings']['native_source']['sha256']
            if kind == 'source':
                excerpt_start = target - 3.5
                excerpt = temp / f'clip-{number:02d}.mp4'
                run(['ffmpeg','-v','error','-ss',f'{excerpt_start:.3f}','-i',str(source),'-t','7',
                     '-map','0:v:0','-map','0:a:0','-vf','fps=25,format=yuv420p','-r','25',
                     '-c:v','libx264','-preset','fast','-crf','21','-c:a','aac','-b:a','192k',
                     '-ar','48000','-ac','2','-movflags','+faststart','-y',str(excerpt)])
                source_path = source
                source_start = excerpt_start
            else:
                receipt = json.loads((ROOT / BASE / f'coordinated-presenter-sequences/{lid.lower()}-receipt.json').read_text())
                excerpt = ROOT / receipt['before_after_path']
                assert sha(excerpt) == receipt['before_after_sha256']
                source_path = excerpt
                source_start = 0.0
            card = OUT / f'chapter-{number:02d}.png'
            media.card(card, number, f'{lid} · {title}', 'NATIVE AUDIO REVIEW', note, total=8,
                       comparison_label='SOURCE BOUNDARY' if kind == 'source' else 'ORIGINAL  →  CANDIDATE')
            card_video = temp / f'card-{number:02d}.mp4'
            run(['ffmpeg','-v','error','-loop','1','-framerate','25','-i',str(card),
                 '-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=48000',
                 '-t','2.4','-map','0:v:0','-map','1:a:0','-r','25','-c:v','libx264',
                 '-preset','fast','-crf','21','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k',
                 '-movflags','+faststart','-y',str(card_video)])
            duration = float(media.probe(excerpt)['format']['duration'])
            entries.append({'chapter':number,'lesson_id':lid,'kind':kind,'source_boundary_seconds':target,
                            'chapter_start_seconds':round(cursor,3),'clip_start_seconds':round(cursor+2.4,3),
                            'source_excerpt_start_seconds':round(source_start,3),'source_clip_duration_seconds':duration,
                            'source_path':str(source_path.relative_to(ROOT)) if source_path.is_relative_to(ROOT) else str(source_path),
                            'source_sha256':sha(source_path),'card_path':str(card),
                            'card_sha256':sha(card),'review_note':note,
                            'qualification':'native source audio only; coordinated clips remain local joins, not full-lesson fit'})
            cursor += 2.4 + duration
            chunks.extend([card_video, excerpt])
        listing = temp / 'segments.txt'
        listing.write_text(''.join("file '" + str(p).replace("'", "'\\''") + "'\n" for p in chunks))
        joined = temp / 'joined.mp4'
        run(['ffmpeg','-v','error','-f','concat','-safe','0','-i',str(listing),
             '-map','0:v:0','-map','0:a:0','-c','copy','-y',str(joined)])
        run(['ffmpeg','-v','error','-i',str(joined),'-map','0:v:0','-map','0:a:0',
             '-map_metadata','-1','-map_chapters','-1','-dn','-sn','-vf','fps=25,format=yuv420p',
             '-r','25','-c:v','libx264','-profile:v','high','-level:v','4.1','-preset','medium',
             '-crf','20','-c:a','aac','-b:a','192k','-ar','48000','-ac','2',
             '-movflags','+faststart','-y',str(ROOT / REEL)])
    run(['ffmpeg','-v','error','-xerror','-i',str(ROOT / REEL),'-f','null','-'])
    probe = json.loads(subprocess.run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(ROOT / REEL)],
                                      capture_output=True,text=True,check=True).stdout)
    streams = probe['streams']
    assert len(streams) == 2 and [s['codec_type'] for s in streams] == ['video','audio']
    assert streams[0]['codec_name'] == 'h264' and streams[0]['pix_fmt'] == 'yuv420p'
    assert streams[1]['codec_name'] == 'aac'
    duration = float(probe['format']['duration'])
    assert abs(duration-cursor)<.2
    sheets = {}
    with tempfile.TemporaryDirectory(prefix='transition-reel-stills-') as temp:
        for kind in ('chapter', 'source'):
            canvas = Image.new('RGB',(1280,1440))
            for i, row in enumerate(entries):
                if kind == 'chapter':
                    frame = ROOT / row['card_path']
                else:
                    frame = pathlib.Path(temp) / f'source-{i+1:02d}.png'
                    run(['ffmpeg','-v','error','-ss',f"{row['clip_start_seconds']+.5:.3f}",
                         '-i',str(ROOT/REEL),'-frames:v','1','-update','1','-y',str(frame)])
                with Image.open(frame) as image:
                    canvas.paste(image.resize((640,360)),((i%2)*640,(i//2)*360))
            sheet=OUT/f'{kind}-contact-sheet.png'
            canvas.save(ROOT/sheet)
            sheets[kind] = {'path':str(sheet),'sha256':sha(ROOT/sheet)}
    receipt={'schema_version':1,'status':'review_only_native_transition_excerpt_reel',
             'source_edl':{'path':str(EDL),'sha256':sha(ROOT/EDL)},
             'source_audit':{'path':str(AUDIT),'sha256':sha(ROOT/AUDIT)},
             'reel_path':str(REEL),'reel_sha256':sha(ROOT/REEL),'duration_seconds':duration,
             'chapter_count':len(entries),'chapters':entries,
             'visual_contact_sheets':sheets,
             'full_decode':'passed','video_audio_treatment':'Native source footage and existing local joined clips only; video and audio re-encoded for one browser-compatible H.264/AAC reel. Chapter silence newly encoded. No generated speech.',
             'limits':['Source boundary excerpts show current native media, not a completed lesson edit.',
                       'Coordinated joins omit actual C02 narration; final presenter-matched voice fit remains unverified.',
                       'Source VTT cue spans are listed on cards but captions are not burned into this reel.']}
    path=OUT/'reel-receipt.json'
    (ROOT/path).write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
    print(f'Wrote {REEL}: {duration:.2f}s, {len(entries)} chapters, full decode passed')


if __name__=='__main__':
    main()
