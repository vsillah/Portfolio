"""Verify unbound L09/L13 review candidates against their source map and receipt."""

import hashlib
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[3]
REVIEW = Path(__file__).resolve().parent
receipt = json.loads((REVIEW / 'l09-l13-local-review-preflight.json').read_text())
source_map = ROOT / 'docs/agentified-distribution-readiness/phase-3b/source-map-v1.json'
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
assert sha(source_map) == receipt['sourceMapSha256'] == '6316aa15a232e99019f938ccbaae397e5314f5d4035a626346caad5f6b8aebad'
records = {record['lessonId']: record for record in json.loads(source_map.read_text())['records']}
assert [item['lessonId'] for item in receipt['findings']] == ['L09', 'L13']
assert receipt['status'] == 'review_only_unbound_human_qa_hold'


def verified_asset(asset):
    path = ROOT / asset['path']
    assert sha(path) == asset['sha256'], path
    if 'bytes' in asset:
        assert path.stat().st_size == asset['bytes'], path
    return path


def stream_hash(path, stream):
    return subprocess.check_output([
        'ffmpeg', '-v', 'error', '-i', str(path), '-map', stream,
        '-c', 'copy', '-f', 'hash', '-hash', 'sha256', '-'
    ], text=True).strip()


for item in receipt['findings']:
    record = records[item['lessonId']]
    for key, source_key in [('sourceVideo', 'currentVideo'), ('sourceCaption', 'currentCaption'), ('sourceScript', 'script')]:
        assert item[key] == record[source_key]
        verified_asset(item[key])
    candidate = verified_asset(item['candidateVideo'])
    for clip in item['captionedReviewClips']:
        path = verified_asset(clip)
        meta = json.loads(subprocess.check_output([
            'ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration',
            '-of', 'json', str(path)
        ]))
        video = next(stream for stream in meta['streams'] if stream['codec_type'] == 'video')
        expected = (1280, 720) if 'desktop' in path.name else (390, 844)
        assert (video['width'], video['height']) == expected
        assert abs(float(meta['format']['duration']) - (18 if item['lessonId'] == 'L09' else 16)) < 0.01
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'null', '-'], stdout=subprocess.DEVNULL, check=True)

l09, l13 = receipt['findings']
original_vtt = verified_asset(l09['sourceCaption']).read_text()
changed_vtt = verified_asset(l09['candidateCaption']).read_text()
old = 'Make reject and request-revision as visible as approve.'
assert original_vtt.count(old) == 1
assert changed_vtt == original_vtt.replace(old, 'Make reject and request-revision as visible as approved.')
for stream in ('0:v:0', '0:a:0'):
    assert stream_hash(verified_asset(l09['sourceVideo']), stream) == stream_hash(verified_asset(l09['candidateVideo']), stream)

frame = verified_asset(l13['contentAwareFrame'])
original_frame = ROOT / 'agentified/workshop/presentation-illustration-audit/frames/illustrated/L13-03.png'
assert sha(original_frame) == l13['contentAwareFrame']['originalFrameSha256']
changed = ImageChops.difference(Image.open(original_frame).convert('RGB'), Image.open(frame).convert('RGB')).getbbox()
assert changed == tuple(l13['contentAwareFrame']['changedPixelBounds']), changed
for asset in ('sourceUnknownSample', 'processedUnknownSample'):
    verified_asset(l13[asset])
assert stream_hash(verified_asset(l13['sourceVideo']), '0:s:0') == stream_hash(verified_asset(l13['candidateVideo']), '0:s:0')
meta = json.loads(subprocess.check_output([
    'ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,duration,nb_frames,width,height',
    '-of', 'json', str(verified_asset(l13['candidateVideo']))
]))
video = next(stream for stream in meta['streams'] if stream['codec_type'] == 'video')
audio = next(stream for stream in meta['streams'] if stream['codec_type'] == 'audio')
assert (video['width'], video['height'], video['nb_frames'], video['duration']) == (1920, 1080, '6368', '254.720000')
assert audio['duration'] == '255.243000'
panel = receipt['panelCorrection']
measured = panel['measuredHeadlinePx']
revised = panel['revisedPanelPx']
prior = panel['priorPanelPx']
assert (revised['width'], revised['height']) == (
    measured['width'] + 2 * panel['paddingPx'],
    measured['height'] + 2 * panel['paddingPx'],
)
assert 24 <= panel['paddingPx'] <= 32
assert revised['width'] < prior['width'] and revised['height'] < prior['height']
assert revised['x'] == prior['x'] and revised['y'] == prior['y']
assert panel['headlineLines'] == ['Leave the baseline', 'unknown.']
assert stream_hash(verified_asset(l13['candidateVideo']), '0:a:0') == 'SHA256=' + panel['candidateAudioStreamSha256']
assert stream_hash(verified_asset(l13['candidateVideo']), '0:s:0') == 'SHA256=' + panel['candidateSubtitleStreamSha256']
correction = receipt['reviewCaptionCorrection']
desktop = next(clip for clip in l13['captionedReviewClips'] if 'desktop' in clip['path'])
mobile = next(clip for clip in l13['captionedReviewClips'] if 'mobile' in clip['path'])
assert desktop['sha256'] == correction['correctedDesktopClipSha256']
assert correction['priorDesktopClipSha256'] != correction['correctedDesktopClipSha256']
assert stream_hash(verified_asset(desktop), '0:a:0') == 'SHA256=' + correction['desktopAudioStreamSha256']
assert stream_hash(verified_asset(desktop), '0:s:0') == 'SHA256=' + correction['desktopSubtitleStreamSha256']
assert correction['correctedCaptionBoxMaxPx'][3] < correction['teachingPanelStartsAtYPx']
assert correction['correctedCaptionBoxMaxPx'][3] < correction['baselineLabelYPx'][0]
assert correction['correctedCaptionBoxMaxPx'][3] < correction['nativeControlsBottomZoneStartsAtYPx']
assert correction['mobileCaptionStartsAtYPx'] > correction['mobileVideoEndsAtYPx']
assert mobile['sha256'] == correction['correctedMobileClipSha256']
assert (revised['y'] + revised['height']) * (1280 / 1920) < correction['baselineLabelYPx'][0]
assert revised['y'] * (1280 / 1920) > correction['correctedCaptionBoxMaxPx'][3]
for clip in (desktop, mobile):
    path = verified_asset(clip)
    assert stream_hash(path, '0:a:0') == 'SHA256=' + panel['contextAudioStreamSha256']
    assert stream_hash(path, '0:s:0') == 'SHA256=' + panel['contextSubtitleStreamSha256']
subtitle = subprocess.check_output([
    'ffmpeg', '-v', 'error', '-i', str(verified_asset(desktop)), '-map', '0:s:0', '-f', 'webvtt', '-'
], text=True)
assert '00:00.000 --> 00:06.278' in subtitle
assert "The workbook's AutoResearch Proposal asks for the baseline, experiment configuration, expected impact, touched settings, metric gate, risk, rollback, approval question, and next gate." in subtitle
assert '00:06.747 --> 00:08.838' in subtitle
assert 'Here the baseline is `unknown`, not zero.' in subtitle
print('PASS: source hashes, one-word L09 VTT, L13 frame scope, candidate streams, and four decoded context MP4s')
