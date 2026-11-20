#!/usr/bin/env python3
"""Read-only qualification of the exact Agentified lesson bindings.

Run from the Portfolio root: python3 docs/agentified-distribution-readiness/phase-2/verify.py
Requires ffprobe and ffmpeg. It writes only qualification-manifest.json.
"""
import hashlib
import json
import re
import subprocess
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).with_name('qualification-manifest.json')


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def probe(path):
    raw = subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries',
        'format=duration:stream=index,codec_type,codec_name,r_frame_rate,duration,nb_frames',
        '-of', 'json', str(path)], text=True)
    return json.loads(raw)


def pcm_hash(path):
    # Decoding both streams to the same PCM format tests audio identity despite MP4 mux differences.
    p = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-map', '0:a:0',
        '-vn', '-ac', '1', '-ar', '16000', '-f', 'hash', '-hash', 'SHA256', '-'],
        text=True, capture_output=True, check=True)
    return p.stdout.strip().split('=')[-1]


def silence(path):
    p = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(path),
        '-map', '0:a:0', '-af', 'silencedetect=noise=-35dB:d=1.5', '-f', 'null', '-'],
        text=True, capture_output=True, check=True)
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', p.stderr)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', p.stderr)]
    durations = [float(x) for x in re.findall(r'silence_duration: ([\d.]+)', p.stderr)]
    return {'thresholdDb': -35, 'minimumSeconds': 1.5, 'intervalCount': len(starts),
            'longestSeconds': max(durations, default=0),
            'intervalsSeconds': [[round(s, 3), round(e, 3)] for s, e in zip(starts, ends)]}


def words(value):
    return re.findall(r"[a-z0-9]+", value.lower().replace('’', "'"))


def vtt(path, duration, script_path):
    text = path.read_text(encoding='utf-8-sig')
    lines = text.splitlines()
    cues = []
    errors = []
    if not lines or lines[0].strip() != 'WEBVTT':
        errors.append('missing WEBVTT header')
    timing = re.compile(r'(?:(\d{2}):)?(\d{2}):(\d{2})\.(\d{3}) --> (?:(\d{2}):)?(\d{2}):(\d{2})\.(\d{3})')
    def seconds(h, m, s, ms):
        return int(h or 0) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000
    for i, line in enumerate(lines):
        match = timing.fullmatch(line.strip())
        if not match:
            continue
        a = seconds(*match.groups()[:4]); b = seconds(*match.groups()[4:])
        content = []
        for value in lines[i + 1:]:
            if not value.strip():
                break
            content.append(value.strip())
        cues.append((a, b, ' '.join(content)))
        if not content or b <= a or a < 0 or b > duration + .05:
            errors.append(f'cue {len(cues)} empty or outside media')
        if len(cues) > 1 and a < cues[-2][0]:
            errors.append(f'cue {len(cues)} out of start order')
    if '-->' in text and text.count('-->') != len(cues):
        errors.append('unparsed timing line')
    if not cues:
        errors.append('no cues')
    overlap = sum(cues[i][0] < cues[i-1][1] - .01 for i in range(1, len(cues)))
    script = script_path.read_text()
    spoken_rows = re.findall(r'^\|[^|]+\|\s*[“"](.+?)[”"]\s*\|', script, re.M)
    script_words = words(' '.join(spoken_rows))
    caption_words = words(' '.join(c[2] for c in cues))
    matcher = SequenceMatcher(None, script_words, caption_words, autojunk=False)
    return {'sha256': digest(path), 'cueCount': len(cues), 'errors': errors,
            'overlapCount': overlap, 'firstCueStartSeconds': cues[0][0] if cues else None,
            'lastCueEndSeconds': cues[-1][1] if cues else None,
            'firstCueText': cues[0][2] if cues else None,
            'lastCueText': cues[-1][2] if cues else None,
            'textSha256': hashlib.sha256(' '.join(c[2] for c in cues).encode()).hexdigest(),
            'scriptSpokenRowCount': len(spoken_rows), 'scriptWordCount': len(script_words),
            'captionWordCount': len(caption_words), 'scriptCaptionTokenSimilarity': round(matcher.ratio(), 4),
            'scriptCaptionExactTokenMatch': script_words == caption_words}


def main():
    bindings = json.loads((ROOT / 'lib/agentified-illustrated-bindings.json').read_text())
    baseline = json.loads((ROOT / 'docs/agentified-distribution-readiness/manifest.json').read_text())
    receipts = json.loads((ROOT / 'agentified/workshop/presentation-illustration-audit/composite-receipts.json').read_text())
    by_receipt = {x['lesson_id']: x for x in receipts['composites']}
    visual_packets = json.loads((ROOT / 'agentified/workshop/visual-review/packets.json').read_text())
    by_packet = {x['id']: x for x in visual_packets['lessons']}
    end_text = (ROOT / 'lib/agentified-end-screens.ts').read_text()
    result = {'schemaVersion': 1, 'baseCommit': subprocess.check_output(['git','merge-base','HEAD','origin/main'], cwd=ROOT, text=True).strip(),
        'sourceApprovalCommit': bindings['sourceApprovalCommit'], 'correctionBaseCommit': bindings['correctionBaseCommit'],
        'endScreenPatternCommit': re.search(r"AGENTIFIED_END_SCREEN_PATTERN_COMMIT = '([0-9a-f]{40})'", end_text).group(1),
        'bindingReviewState': bindings['correctionReviewState'], 'scope': 'read-only local technical checks; no ASR, human visual review, or distribution rights approval',
        'methods': {'pcm': 'ffmpeg decoded mono 16 kHz SHA-256', 'silence': 'ffmpeg silencedetect -35 dB, 1.5 s; candidates only'}, 'lessons': []}
    for item in baseline['lessons']:
        ident = item['id']; b = bindings['bindings'][ident]; receipt = by_receipt[ident]
        files = {'composite': ('video','compositeSha256'), 'source': ('sourceVideo','sourceSha256'),
            'captions': ('captions','captionsSha256')}
        paths = {name: ROOT / 'public' / b[path_key].lstrip('/') for name, (path_key, _) in files.items()}
        assets = {name: {'path': b[path_key], 'sha256': digest(paths[name]),
                          'matchesBinding': digest(paths[name]) == b[hash_key]}
                  for name, (path_key, hash_key) in files.items()}
        poster = ROOT / 'public' / item['poster'].lstrip('/')
        assets['poster'] = {'path': item['poster'], 'sha256': digest(poster), 'bytes': poster.stat().st_size}
        source_probe = probe(paths['source']); final_probe = probe(paths['composite'])
        final_duration = float(final_probe['format']['duration']); source_duration = float(source_probe['format']['duration'])
        source_pcm = pcm_hash(paths['source']); final_pcm = pcm_hash(paths['composite'])
        source_v = next(x for x in source_probe['streams'] if x['codec_type'] == 'video')
        final_v = next(x for x in final_probe['streams'] if x['codec_type'] == 'video')
        packet = by_packet[ident]
        script_path = ROOT / packet['script_path']
        caption = vtt(paths['captions'], final_duration, script_path)
        end_pattern = rf"{ident}: \{{[^\n]*startSeconds: ([\d.]+), endSeconds: ([\d.]+),[^\n]*videoSha256: '([0-9a-f]{{64}})', captionsSha256: '([0-9a-f]{{64}})'"
        end_match = re.search(end_pattern, end_text)
        end_state = 'absent' if not end_match else ('hash-matched' if list(end_match.groups()[2:]) == [b['compositeSha256'], b['captionsSha256']] else 'hash-drift')
        end_screen = {'state': end_state, 'startSeconds': float(end_match.group(1)) if end_match else None,
            'endSeconds': float(end_match.group(2)) if end_match else None,
            'visibleSeconds': round(float(end_match.group(2)) - float(end_match.group(1)), 3) if end_match else None,
            'videoSha256': end_match.group(3) if end_match else None,
            'captionsSha256': end_match.group(4) if end_match else None}
        needs_correction = (end_state != 'hash-matched' or caption['scriptCaptionTokenSimilarity'] < .95
            or caption['overlapCount'] > 0 or end_screen['visibleSeconds'] < .5)
        result['lessons'].append({'id': ident, 'title': item['title'], 'assets': assets,
            'script': {'path': packet['script_path'], 'sha256': digest(script_path),
                'matchesVisualPacket': digest(script_path) == packet['script_sha256']},
            'visualPacket': {'authority': visual_packets['authority'], 'plateUseCount': len(packet['visuals']),
                'plateUsesApprovedForBoundLessons': all(v.get('rights',{}).get('workshop_redistribution') == 'approved_for_bound_agentified_lesson_uses' for v in packet['visuals'])},
            'transcript': {'bindingSha256': b['transcriptSha256'], 'canonicalArtifactLocated': False, 'equivalence': 'unverified'},
            'media': {'declaredSeconds': b['durationSeconds'], 'encodedSeconds': final_duration,
                'sourceEncodedSeconds': source_duration, 'durationDeltaSeconds': round(final_duration - b['durationSeconds'], 3),
                'sourceVideoCodec': source_v['codec_name'], 'finalVideoCodec': final_v['codec_name'],
                'sourceFrameRate': source_v['r_frame_rate'], 'finalFrameRate': final_v['r_frame_rate'],
                'sourceFrames': source_v.get('nb_frames'), 'finalFrames': final_v.get('nb_frames'),
                'sourcePcmSha256': source_pcm, 'finalPcmSha256': final_pcm, 'decodedAudioIdentical': source_pcm == final_pcm,
                'silence': silence(paths['composite'])},
            'captions': caption, 'compositeReceipt': {'sourceSha256Matches': receipt['source_sha256'] == b['sourceSha256'],
                'outputSha256Matches': receipt['output_sha256'] == b['compositeSha256'],
                'frameRate': receipt['frame_rate'], 'protectedWindows': receipt['protected_windows'],
                'releaseStateInReceipt': receipt['release_state']}, 'endScreen': end_screen,
            'evidenceState': 'Needs correction' if needs_correction else 'Technically present but visually pending',
            'distributionRightsState': 'Needs rights confirmation'})
    OUT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
    print(f'Wrote {OUT}; {len(result["lessons"])} lessons')
    for x in result['lessons']:
        print(x['id'], 'audio=',x['media']['decodedAudioIdentical'], 'durationDelta=',x['media']['durationDeltaSeconds'],
              'captionErrors=',len(x['captions']['errors']), 'end=',x['endScreen']['state'], 'silences=',x['media']['silence']['intervalCount'])


if __name__ == '__main__':
    main()
