#!/usr/bin/env python3
"""Build offline, source-bound L02–L04 storyboard packets. No provider calls."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
VISUAL = ROOT / 'docs/accelerated-course-modules/visual-production/manifest.json'
SCRIPT_MANIFEST = ROOT / 'docs/accelerated-course-modules/curriculum/scripts/manifest.json'
ASSETS = {
    'signals': 'public/showcases/service-prototypes/v2/sam-signals-plate.webp',
    'sam_map': 'public/showcases/service-prototypes/accelerated-sam-infographic.png',
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def sentences(text):
    parts = re.split(r'(?<=[.!?])\s+(?=[A-Z“])', text)
    assert ' '.join(parts) == text and all(p.endswith(('.', '?', '!', '.”', '?”', '!”')) for p in parts), text
    return parts


def timed_sentences(scene):
    items = sentences(scene['narration'])
    weights = [len(s.split()) for s in items]
    total = sum(weights)
    elapsed = scene['start_seconds']
    result = []
    for i, (item, weight) in enumerate(zip(items, weights)):
        end = scene['end_seconds'] if i == len(items)-1 else scene['start_seconds'] + scene['duration_seconds'] * sum(weights[:i+1]) / total
        result.append({'start': round(elapsed, 3), 'end': round(end, 3), 'text': item, 'scene': scene['id']})
        elapsed = end
    return result


def tc(seconds):
    seconds = int(round(seconds))
    return f'{seconds//60:02}:{seconds%60:02}'


def srt_tc(seconds):
    ms = int(round(seconds*1000))
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'


def build():
    visual = json.loads(VISUAL.read_text())
    source = json.loads(SCRIPT_MANIFEST.read_text())
    packs = []
    for lesson in visual['lessons'][1:4]:
        lid = lesson['id']
        script_path = ROOT / f'docs/accelerated-course-modules/curriculum/scripts/{lid}.md'
        script_hash = digest(script_path)
        expected = [s['script_sha256'] for s in lesson['scenes']]
        assert all(x == script_hash for x in expected), f'{lid} script drift'
        source_lesson = next(x for x in source['lessons'] if x['id'] == lid)
        narration_blocks = re.findall(r'```narration\n(.*?)\n```', script_path.read_text(), re.S)
        assert len(narration_blocks) == len(lesson['scenes']), f'{lid} scene count drift'
        scenes = []
        cues = []
        segments = []
        assets = {}
        for scene, block in zip(lesson['scenes'], narration_blocks):
            assert block == scene['narration'], f"{scene['id']} narration drift"
            assert digest(script_path) == scene['script_sha256']
            assert hashlib.sha256(block.encode()).hexdigest() == scene['narration_sha256']
            units = timed_sentences(scene)
            cues += units
            avatar = scene['avatar']['window']
            seg = None
            if avatar != 'off.':
                match = re.search(r'(A\d+), (\d\d:\d\d)–(\d\d:\d\d)', avatar)
                assert match, avatar
                aid, start_tc, end_tc = match.groups()
                target_start = int(start_tc[:2])*60+int(start_tc[3:])
                target_end = int(end_tc[:2])*60+int(end_tc[3:])
                final = scene['end_seconds'] == lesson['runtime_seconds']
                if target_start == scene['start_seconds']:
                    chosen_start = scene['start_seconds']
                else:
                    chosen_start = min((u['start'] for u in units), key=lambda t: abs(t-target_start))
                ends = [u['end'] for u in units if u['end'] > chosen_start]
                if final:
                    ends = [e for e in ends if e < scene['end_seconds'] - 4]
                assert ends, f'{scene["id"]} has no sentence-complete handoff'
                chosen_end = min(ends, key=lambda t: abs(t-target_end))
                speech = ' '.join(u['text'] for u in units if u['start'] >= chosen_start - .001 and u['end'] <= chosen_end + .001)
                assert speech and speech.endswith(('.', '?', '!'))
                seg = {'id': aid, 'scene': scene['id'], 'start_seconds': chosen_start, 'end_seconds': chosen_end,
                       'duration_seconds': round(chosen_end-chosen_start, 3), 'narration_text': speech,
                       'handoff_visual': scene['shot']['artifact_behavior'], 'timing_status': 'sentence-bound storyboard estimate; exact recorded audio required'}
                segments.append(seg)
            refs = []
            for ref in scene['asset_refs']:
                assert ref in ASSETS, f'unknown asset {ref}'
                path = ROOT / ASSETS[ref]
                assert path.exists(), f'missing asset {path}'
                assets[ref] = {'path': ASSETS[ref], 'sha256': digest(path), 'status': 'approved existing art; preserve aspect ratio'}
                refs.append(ref)
            scenes.append({'id': scene['id'], 'title': scene['title'], 'start_seconds': scene['start_seconds'],
                           'end_seconds': scene['end_seconds'], 'narration': block, 'narration_sha256': scene['narration_sha256'],
                           'on_screen_copy': scene['on_screen_copy'], 'shot': scene['shot']['composition'],
                           'visual': scene['shot']['artifact_behavior'], 'asset_refs': refs, 'presenter': seg,
                           'accessibility': scene['accessibility'], 'lineage': scene['lineage']})
        assert scenes[0]['start_seconds'] == 0 and scenes[-1]['end_seconds'] == lesson['runtime_seconds']
        assert all(a['end_seconds'] == b['start_seconds'] for a,b in zip(scenes,scenes[1:]))
        srt = '\n\n'.join(f"{i}\n{srt_tc(c['start'])} --> {srt_tc(c['end'])}\n{c['text']}" for i,c in enumerate(cues,1))+'\n'
        (HERE / f'{lid.lower()}-storyboard.srt').write_text(srt)
        pack = {'schema_version': 1, 'status': 'offline-storyboard-only', 'lesson_id': lid, 'title': lesson['title'],
                'runtime_seconds': lesson['runtime_seconds'], 'learner_artifact': lesson['learner_artifact'],
                'source_script': str(script_path.relative_to(ROOT)), 'source_script_sha256': script_hash,
                'source_visual_manifest_sha256': digest(VISUAL), 'source_storyboard_brief_sha256': digest(ROOT / 'docs/accelerated-course-modules/curriculum/scripts/storyboard-brief.md'),
                'book_epub_sha256': digest(ROOT / 'accelerated_ebook_leadmagnet.epub'), 'book_sections': source_lesson['epub_files'],
                'scenes': scenes, 'cues': cues, 'assets': assets, 'exercise': script_path.read_text().split('## Exercise and handoff\n')[1].split('\n## ')[0].strip(),
                'accessibility_plan': {'master': '16:9, 10% edge safety; captions bottom 18%', 'portrait': 'reflow cards into vertical stack; never crop body text', 'reduced_motion': 'static final labeled state for equal reading hold', 'caption_status': 'draft estimated from source narration; retime against final audio', 'transcript': 'exact approved script narration'},
                'audio_ownership': [],
                'provider_request': {'provider': 'HeyGen', 'execution_allowed': False, 'upload_allowed': False, 'voice_generation_allowed': False, 'avatar_generation_allowed': False,
                                     'spend_cap_usd': 0, 'estimated_cost_usd': None, 'cost_status': 'unquoted; obtain binding quote and enforceable cap',
                                     'avatar_identity': None, 'voice_identity': None, 'likeness_rights_receipt': None,
                                     'segments': segments, 'format': {'master': '1920x1080', 'frame_rate': 'match authorized native source'},
                                     'stop_no_retry': ['missing or changed source hash', 'missing avatar/voice rights', 'unbound recorded audio', 'quote absent or above cap', 'privacy concern', 'provider error or unexpected output; inspect before any retry']},
                'production_lock': {'app_locked': True, 'unlock_requires': 'per-lesson final composite, captions, output hashes, privacy/accessibility QA, and separate Human QA approval'}}
        cursor = 0
        for segment in sorted(segments, key=lambda x: x['start_seconds']):
            if segment['start_seconds'] > cursor:
                pack['audio_ownership'].append({'start_seconds': cursor, 'end_seconds': segment['start_seconds'], 'owner': 'approved narration source in final composite; silent in storyboard'})
            pack['audio_ownership'].append({'start_seconds': segment['start_seconds'], 'end_seconds': segment['end_seconds'], 'owner': f"native presenter {segment['id']} if separately authorized; mute matching narration; silent in storyboard"})
            cursor = segment['end_seconds']
        if cursor < lesson['runtime_seconds']:
            pack['audio_ownership'].append({'start_seconds': cursor, 'end_seconds': lesson['runtime_seconds'], 'owner': 'approved narration source in final composite; silent in storyboard'})
        assert pack['audio_ownership'][0]['start_seconds'] == 0
        assert pack['audio_ownership'][-1]['end_seconds'] == lesson['runtime_seconds']
        assert all(a['end_seconds'] == b['start_seconds'] for a,b in zip(pack['audio_ownership'],pack['audio_ownership'][1:]))
        (HERE / f'{lid.lower()}-packet.json').write_text(json.dumps(pack, indent=2, ensure_ascii=False)+'\n')
        (HERE / f'{lid.lower()}-heygen-request.json').write_text(json.dumps(pack['provider_request'] | {'lesson_id': lid, 'source_script_sha256': script_hash}, indent=2, ensure_ascii=False)+'\n')
        (HERE / f'{lid.lower()}-asset-map.json').write_text(json.dumps({'lesson_id': lid, 'source_script_sha256': script_hash, 'book_epub_sha256': pack['book_epub_sha256'], 'book_sections': pack['book_sections'], 'approved_assets': assets, 'synthetic_scenes': {s['id']: s['lineage']['new_synthetic_identity'] for s in scenes}, 'blocked': 'No real customer, Portfolio UI, or provider capture without exact rights and privacy binding'}, indent=2, ensure_ascii=False)+'\n')
        (HERE / f'{lid.lower()}-audio-map.json').write_text(json.dumps({'lesson_id': lid, 'runtime_seconds': lesson['runtime_seconds'], 'segments': pack['audio_ownership'], 'rule': 'One spoken owner at a time; native presenter replaces matching narration audio in final composite'}, indent=2, ensure_ascii=False)+'\n')
        packs.append({'id': lid, 'title': lesson['title'], 'packet': f'{lid.lower()}-packet.json', 'runtime_seconds': lesson['runtime_seconds']})
        print(f'{lid}: {len(scenes)} scenes, {len(segments)} sentence-complete presenter windows, {len(cues)} caption cues')
    (HERE / 'index.json').write_text(json.dumps({'status':'offline-review-only','lessons':packs},indent=2)+'\n')

if __name__ == '__main__':
    build()
