"""Bind L05-02..08 review frames to exact sources and caption clearance."""

import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
CODE_HEAD = '46b2c166ec012a06b8e0a458d6c189c5911f4a03'
PADDING_BASE = 'd047960edcf58bc2c75b3a944fe22a5d8ad25bb4'
CAPTION_RECEIPT = 'agentified/workshop/l05-caption-clearance-review/receipt.json'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

subprocess.run(['git', 'merge-base', '--is-ancestor', PADDING_BASE, 'HEAD'], cwd=ROOT, check=True)
caption_raw = subprocess.check_output(['git', 'show', f'{CODE_HEAD}:{CAPTION_RECEIPT}'], cwd=ROOT)
caption = json.loads(caption_raw)
assert caption['candidateCommit'] == PADDING_BASE
assert len(caption['learner']) == 242 and len(caption['candidate']) == 6
source = next(r for r in json.loads((ROOT / 'docs/agentified-distribution-readiness/phase-3b/source-map-v1.json').read_text())['records'] if r['lessonId'] == 'L05')
assert sha(ROOT / source['currentVideo']['path']) == source['currentVideo']['sha256'] == caption['source']['videoHash']
assert sha(ROOT / source['currentCaption']['path']) == source['currentCaption']['sha256'] == caption['source']['captionsHash']

scenes = []
for number in range(2, 9):
    scene = f'L05-{number:02}'
    candidate = json.loads((HERE / f'candidate-receipt-{scene}.json').read_text())
    assert candidate['selectedScenes'] == [scene] and len(candidate['frames']) == 1
    frame = candidate['frames'][0]
    original = ROOT / 'agentified/workshop/presentation-illustration-audit/frames/illustrated' / f'{scene}.png'
    revised = ROOT / frame['frame_path']
    assert sha(original) == frame['original_frame_sha256']
    assert sha(revised) == frame['frame_sha256']
    assert sha(ROOT / frame['source_path']) == frame['source_sha256']
    a, b = Image.open(original).convert('RGB'), Image.open(revised).convert('RGB')
    assert a.size == b.size == (1920, 1080)
    mask = Image.new('L', a.size)
    draw = ImageDraw.Draw(mask)
    for decision in frame['padding_decisions']:
        assert decision['action'] in ('fitted', 'retained')
        if decision['action'] == 'fitted':
            assert decision['paddingPx'] == 28
            for box in (decision['old'], decision['box']):
                draw.rectangle((box['x']-4, box['y']-4, box['x']+box['width']+4, box['y']+box['height']+4), fill=255)
    assert ImageChops.difference(a, Image.composite(a, b, mask)).getbbox() is None, f'{scene}: pixels outside panel unions changed'
    if number == 7:
        assert sha(original) == sha(revised), 'protected worksheet changed'
    states = [r for r in caption['learner'] if str(r.get('label', '')).startswith(scene)]
    assert len(states) >= 6, f'{scene}: missing caption route states'
    for width in (1280, 390):
        size_on = {r.get('size') for r in states if r['width'] == width and str(r.get('label', '')).endswith('-on')}
        assert size_on == {'S', 'M', 'L'}, f'{scene} {width}: missing size states'
        for state in states:
            if state['width'] == width and state.get('bandTop') is not None:
                assert state['bandTop'] >= state['videoBottom'] + 8
                assert state['controls'] is True
    clips = []
    for layout in ('desktop', 'mobile'):
        clip = HERE / 'checks/lesson-order' / f'{scene}-{layout}.mp4'
        vtt = clip.with_suffix('.vtt')
        assert clip.exists() and vtt.exists()
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(clip), '-f', 'null', '-'], check=True, stdout=subprocess.DEVNULL)
        clips.append({'layout': layout, 'path': str(clip.relative_to(ROOT)), 'sha256': sha(clip), 'vttSha256': sha(vtt)})
    scenes.append({'scene': scene, 'frame': frame['frame_path'], 'frameSha256': frame['frame_sha256'], 'fittedPanels': sum(d['action']=='fitted' for d in frame['padding_decisions']), 'captionStates': len(states), 'clips': clips})

receipt = {'status': 'review-only checkpoint; unbound', 'paddingBase': PADDING_BASE, 'captionHead': CODE_HEAD, 'captionReceipt': CAPTION_RECEIPT, 'captionReceiptSha256': hashlib.sha256(caption_raw).hexdigest(), 'sourceVideoSha256': source['currentVideo']['sha256'], 'sourceCaptionSha256': source['currentCaption']['sha256'], 'scenes': scenes}
(HERE / 'l05-resume-checkpoint-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(f'PASS {len(scenes)} L05 scenes, {sum(s["fittedPanels"] for s in scenes)} fitted panels, {sum(s["captionStates"] for s in scenes)} caption states, {sum(len(s["clips"]) for s in scenes)} decoded clips')
