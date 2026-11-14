"""Build a local L03 Scene 1 review from the one returned J01 WAV."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import hashlib, json, re, subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
PREP = HERE.parent / 'scene01-provider-free'
RETURN = HERE.parent / 'l03-j01-provider-return'
NATIVE = Path.home() / 'Projects/Portfolio/artifacts/accelerated-l03-heygen-2026-11-04/accelerated-l03-heygen-native.mp4'
BOUND = ROOT / 'public/accelerated/lessons/l03/approved-02b9c3ea/accelerated-l03-native-composite.mp4'
PLATE = ROOT / 'artifacts/accelerated-l02-l16-illustration-qualification-2026-11-12/l02-presenter-unified-still-proposal-2026-11-13/source/plates/l02-choice-c03-matte-stills-2026-11-13/plates/choice-options-matte.webp'
WAV = RETURN / 'l03-j01-original.wav'
TIMINGS = RETURN / 'provider-word-timestamps.json'
PACK = ROOT / 'docs/accelerated-course-modules/narration-production-pack-2026-11-10.json'
OUT = HERE / 'outputs'
OUT.mkdir(parents=True, exist_ok=True)
SHA = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
def run(args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

assert SHA(NATIVE) == '064e049bfaee6d60d5d811d516dbcdf9c14466602afef9a34e07cbf31c551198'
assert SHA(BOUND) == '02b9c3ea941c22ffaf87b3bc4e4c4612951499af15485e0261910fad6014053a'
assert SHA(PLATE) == 'a46d70c446b82d64b3674994da9b868625de7db0eb57c5d3b5d6bbcb9d991f26'
assert SHA(WAV) == '6d86bdd09509f492724b76f3af256dc50c128e534e052b972a9092f18ca60531'
pack = json.loads(PACK.read_text())
job = next(j for l in pack['lessons'] if l['lesson_id'] == 'L03' for j in l['speech_jobs'] if j['id'] == 'J01')
assert len(job['text']) == 3395 and hashlib.sha256(job['text'].encode()).hexdigest() == '629deae0d959be5154157dfabdd8a47e45d3b07ffcb25e47ecff13198065d0fb'
prefix = job['text'].split('Open the priority page', 1)[0].strip()
tokens = prefix.split()
norm = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())

# The next J01 sentence starts at 37.108 s. End at a sample-safe pause before it.
NATIVE_END = 22.28
J01_END = 36.75
END = NATIVE_END + J01_END
PHASES = [(0, 13.5, 'trade'), (13.5, 23.6, 'options'), (23.6, J01_END, 'decision')]

def background_from_still(src, target, height):
    im = Image.open(src).convert('RGB')
    d = ImageDraw.Draw(im)
    w = im.width
    # Remove only the old mock control rail; the real player owns controls.
    d.rectangle((0, height - (44 if w == 390 else 45), w, height), fill='#0c2531')
    im.save(target)

background_from_still(PREP / 'p01-desktop-clean.png', OUT / 'p01-desktop-base.png', 1080)
plate = Image.open(PLATE).convert('RGB').resize((1920, 1080), Image.Resampling.LANCZOS)

mobile_p01 = Image.new('RGB', (390, 844), '#0c2531')
mobile_draw = ImageDraw.Draw(mobile_p01)
from PIL import ImageFont
font = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
mobile_draw.text((20, 23), 'AMADUTOWN  /  ACCELERATED', font=ImageFont.truetype(font, 16), fill='#d8b56f')
mobile_draw.text((20, 61), 'A dashboard in the room', font=ImageFont.truetype(font, 26), fill='#f5ebdd')
mobile_p01.paste(plate.resize((390, 219), Image.Resampling.LANCZOS), (0, 105))
mobile_p01.paste(plate.crop((330, 300, 1590, 868)).resize((390, 176), Image.Resampling.LANCZOS), (0, 324))
native_still = Image.open(PREP / 'native-p01-18s.png').convert('RGB').resize((316, 178), Image.Resampling.LANCZOS)
mobile_p01.paste(native_still, (37, 500))
mobile_draw.rectangle((36, 499, 353, 678), outline='#d8b56f', width=1)
mobile_p01.save(OUT / 'p01-mobile-base.png')

def desktop_phase(name):
    if name == 'trade':
        return plate.copy()
    if name == 'options':
        # A restrained camera move keeps the three choice cards together.
        return plate.crop((135, 90, 1785, 1018)).resize((1920, 1080), Image.Resampling.LANCZOS)
    # Return to the whole room rather than implying an outcome for a single card.
    return plate.copy()

def mobile_phase(name):
    im = Image.new('RGB', (390, 844), '#0c2531')
    d = ImageDraw.Draw(im)
    # Keep the entire source plate in view as context through every spoken beat.
    full = plate.resize((390, 219), Image.Resampling.LANCZOS)
    im.paste(full, (0, 15))
    if name == 'trade':
        focus = plate.crop((310, 104, 940, 1067))
    elif name == 'options':
        focus = plate.crop((645, 104, 1275, 1067))
    else:
        focus = plate.crop((890, 104, 1520, 1067))
    # The close view makes the active physical work surface readable on a phone.
    focus = focus.resize((390, 596), Image.Resampling.LANCZOS)
    im.paste(focus, (0, 248))
    d.line((0, 242, 390, 242), fill='#d8b56f', width=2)
    return im

for name in ('trade', 'options', 'decision'):
    desktop_phase(name).save(OUT / f'desktop-{name}.png')
    mobile_phase(name).save(OUT / f'mobile-{name}.png')

def encode_p01(size):
    desktop = size == 'desktop'
    bg = OUT / ('p01-desktop-base.png' if desktop else 'p01-mobile-base.png')
    target = OUT / f'{size}-p01.mp4'
    scale = '810:456' if desktop else '316:178'
    xy = '1000:300' if desktop else '37:500'
    run(['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', '25', '-i', str(bg),
         '-i', str(NATIVE), '-filter_complex', f'[1:v]trim=end_frame=557,setpts=PTS-STARTPTS,scale={scale}[p];[0:v][p]overlay={xy}:shortest=1,format=yuv420p[v]',
         '-map', '[v]', '-frames:v', '557', '-an', '-r', '25', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', str(target)])
    return target

def encode_cutaway(size):
    clips = []
    for start, end, name in PHASES:
        target = OUT / f'{size}-{name}.mp4'
        run(['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', '25', '-i', str(OUT / f'{size}-{name}.png'),
             '-frames:v', str(round((end - start) * 25)), '-an', '-r', '25', '-vf', 'format=yuv420p',
             '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', str(target)])
        clips.append(target)
    return clips

def concat_video(size, clips):
    playlist = OUT / f'{size}.ffconcat'
    playlist.write_text('ffconcat version 1.0\n' + ''.join(f"file '{p.name}'\n" for p in clips))
    target = OUT / f'l03-scene01-{size}-video.mp4'
    run(['ffmpeg', '-v', 'error', '-y', '-safe', '0', '-f', 'concat', '-i', str(playlist), '-c', 'copy', str(target)])
    return target

# Native audio is taken from the exact learner-bound composite. J01 is trimmed
# before the first word of Scene 2, with original WAV retained alongside it.
audio = OUT / 'scene01-audio.wav'
run(['ffmpeg', '-v', 'error', '-y', '-i', str(BOUND), '-i', str(WAV), '-filter_complex',
     f'[0:a]atrim=0:{NATIVE_END},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[n];'
     f'[1:a]atrim=0:{J01_END},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo[j];'
     '[n][j]concat=n=2:v=0:a=1[a]', '-map', '[a]', '-c:a', 'pcm_s16le', str(audio)])

for size in ('desktop', 'mobile'):
    video = concat_video(size, [encode_p01(size), *encode_cutaway(size)])
    target = OUT / f'l03-scene01-{size}.mp4'
    run(['ffmpeg', '-v', 'error', '-y', '-i', str(video), '-i', str(audio), '-map', '0:v:0', '-map', '1:a:0',
         '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', str(target)])


print({size: SHA(OUT / f'l03-scene01-{size}.mp4') for size in ('desktop','mobile')})
