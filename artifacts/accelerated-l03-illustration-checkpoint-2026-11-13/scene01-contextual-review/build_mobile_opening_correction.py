"""Prepare and render the single-plate phone opening without touching desktop media."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import argparse, hashlib, json, subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = HERE / 'outputs'
PLATE = ROOT / 'artifacts/accelerated-l02-l16-illustration-qualification-2026-11-12/l02-presenter-unified-still-proposal-2026-11-13/source/plates/l02-choice-c03-matte-stills-2026-11-13/plates/choice-options-matte.webp'
NATIVE = Path.home() / 'Projects/Portfolio/artifacts/accelerated-l03-heygen-2026-11-04/accelerated-l03-heygen-native.mp4'
WAV = HERE.parent / 'l03-j01-provider-return/l03-j01-original.wav'
SHA = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
assert SHA(PLATE) == 'a46d70c446b82d64b3674994da9b868625de7db0eb57c5d3b5d6bbcb9d991f26'
assert SHA(NATIVE) == '064e049bfaee6d60d5d811d516dbcdf9c14466602afef9a34e07cbf31c551198'
assert SHA(WAV) == '6d86bdd09509f492724b76f3af256dc50c128e534e052b972a9092f18ca60531'

def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

def prepare():
    # One complete, uncropped illustration. This is the only art treatment in P01.
    plate = Image.open(PLATE).convert('RGB').resize((390, 219), Image.Resampling.LANCZOS)
    im = Image.new('RGB', (390, 844), '#0c2531')
    d = ImageDraw.Draw(im)
    bold = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
    d.text((20, 26), 'AMADUTOWN  /  ACCELERATED', font=ImageFont.truetype(bold, 16), fill='#d8b56f')
    d.text((20, 62), 'A dashboard in the room', font=ImageFont.truetype(bold, 26), fill='#f5ebdd')
    im.paste(plate, (0, 180))
    # Existing native picture fully covers this guide inset during video render.
    still = Image.open(HERE.parent / 'scene01-provider-free/native-p01-18s.png').convert('RGB')
    still = still.resize((390, 219), Image.Resampling.LANCZOS)
    im.paste(still, (0, 470))
    d.rectangle((0, 469, 389, 689), outline='#d8b56f', width=1)
    target = OUT / 'p01-mobile-single-plate-base.png'
    im.save(target)
    print(json.dumps({'prepared_still': str(target), 'sha256': SHA(target), 'presenter_box': [0,470,390,689]}))

def render():
    base = OUT / 'p01-mobile-single-plate-base.png'
    assert base.exists()
    p01 = OUT / 'mobile-p01-single-plate.mp4'
    run(['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', '25', '-i', str(base), '-i', str(NATIVE),
         '-filter_complex', '[1:v]trim=end_frame=557,setpts=PTS-STARTPTS,scale=390:219[p];'
                            '[0:v][p]overlay=0:470:shortest=1,format=yuv420p[v]',
         '-map', '[v]', '-frames:v', '557', '-an', '-r', '25', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', str(p01)])
    playlist = OUT / 'mobile-single-plate.ffconcat'
    parts = [p01, *(OUT / f'mobile-{name}.mp4' for name in ('trade','options','decision'))]
    assert all(p.exists() for p in parts)
    playlist.write_text('ffconcat version 1.0\n' + ''.join(f"file '{p.name}'\n" for p in parts))
    silent = OUT / 'l03-scene01-mobile-single-plate-video.mp4'
    run(['ffmpeg', '-v', 'error', '-y', '-safe', '0', '-f', 'concat', '-i', str(playlist), '-c', 'copy', str(silent)])
    target = OUT / 'l03-scene01-mobile-single-plate.mp4'
    run(['ffmpeg', '-v', 'error', '-y', '-i', str(silent), '-i', str(OUT/'scene01-audio.wav'),
         '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
         '-movflags', '+faststart', '-shortest', str(target)])
    print(json.dumps({'mobile_mp4': str(target), 'sha256': SHA(target), 'source_audio_sha256': SHA(OUT/'scene01-audio.wav')}))

parser = argparse.ArgumentParser()
parser.add_argument('step', choices=['prepare','render'])
args = parser.parse_args()
prepare() if args.step == 'prepare' else render()
