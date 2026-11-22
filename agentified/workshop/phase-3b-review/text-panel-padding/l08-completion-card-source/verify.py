#!/usr/bin/env python3
"""Verify and bind the exact temporary player-head L08 review evidence."""
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
import json
import subprocess

base = Path(__file__).resolve().parent
player = Path('/Users/vambahsillah/.codex/worktrees/l08-clean-presenter-route/Portfolio')
hash_file = lambda p: sha256(p.read_bytes()).hexdigest()
patch = base / 'player-head-7bb6267c9.patch'
assert hash_file(patch) == '302b83e19f14fb9ed31f031c422db44bcd99817dca1dc89f9eafb0efbc544651'

route = json.loads((base / 'route-evidence/route-capture.json').read_text())
assert len(route['results']) == 2
assert all(len(result['checks']) == 10 for result in route['results'])
assert all(result['route'].endswith('rev=7bb6267c9-f709e881-302b83e1') for result in route['results'])
for result in route['results']:
    resting = result['checks'][2]['resting']
    assert resting['video']['visibility'] == 'hidden'
    assert resting['screen']['width'] == resting['stage']['width']
    assert resting['screen']['height'] == resting['stage']['height']
    assert abs(resting['poster']['width'] / resting['poster']['height'] - 16 / 9) < 0.03

poster = player / 'public/agentified/posters/l09-poster.webp'
candidate = player / 'public/agentified/lessons/l08/review-f709e881/L08-caption-free-presenter-candidate.mp4'
vtt = player / 'public/agentified/lessons/l08/continuous-3c5b399f/agentified-l08-continuous-narration-captions.vtt'
assert hash_file(poster) == '65d7112b9e16ed3c9c813a8f9b4c0190a40a1cbe9ec394224636241c23e9fcd5'
assert hash_file(candidate) == 'f709e881f3cf4816c05ac287a3181d50621c1e16df14212c5357890f08baedb0'
assert hash_file(vtt) == '25261c89f43785ba30239c37d1c1e17e9a484614efd20a241e25ab0554c92011'

files = sorted(p for p in base.rglob('*') if p.is_file() and p.name != 'validation-receipt.json')
videos = []
for file in files:
    if file.suffix != '.mp4':
        continue
    probe = subprocess.run(
        ['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
         'stream=width,height,r_frame_rate:format=duration', '-of', 'json', str(file)],
        capture_output=True, text=True, check=True,
    )
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(file), '-f', 'null', '-'],
                   capture_output=True, check=True)
    videos.append({'path': str(file.relative_to(base)), 'sha256': hash_file(file),
                   'probe': json.loads(probe.stdout)})

typecheck_lines = Path('/tmp/l08-completion-tsc.log').read_text().splitlines()
typecheck_errors = [line for line in typecheck_lines if 'error TS' in line]
assert len(typecheck_errors) == 46
assert not any('app/agentified/AgentifiedLessonHero' in line or
               'app/agentified/workshop.module.css' in line for line in typecheck_errors)

receipt = {
    'status': 'validated_review_only_player_patch',
    'recordedAtUtc': datetime.now(timezone.utc).isoformat(),
    'stack': {
        'pr1295PlayerHead': '7bb6267c9fb98172679e161aafa208dfc7a276c3',
        'pr1296SourceHeadBeforeThisCommit': '85f58d80786db0073ecb8630243e3c9bb7ae811d',
        'pr1296State': 'draft',
    },
    'sourceBindings': {
        'L09Poster': {'path': 'public/agentified/posters/l09-poster.webp',
                      'sha256': hash_file(poster), 'dimensions': [1280, 720], 'bytesChanged': False},
        'L08Candidate': {'sha256': hash_file(candidate), 'bytesChanged': False},
        'L08Vtt': {'sha256': hash_file(vtt), 'bytesChanged': False},
    },
    'patch': {
        'path': str(patch.relative_to(base)), 'sha256': hash_file(patch),
        'base': '7bb6267c9fb98172679e161aafa208dfc7a276c3',
        'paths': ['app/agentified/AgentifiedLessonHero.tsx',
                  'app/agentified/AgentifiedLessonHero.test.tsx',
                  'app/agentified/workshop.module.css'],
        'gitApplyCheckCached': 'pass', 'gitApplyCheckReverse': 'pass',
        'productFilesCommittedOnPr1296': False,
    },
    'behavior': {
        'videoMountedAtRest': True, 'videoFrameHiddenAtRest': True,
        'completionFillsMediaViewport': True,
        'desktopRestingControls': 'existing custom rail inside viewfinder',
        'mobileControls': 'existing rail below viewfinder',
        'posterFit': 'full 16:9 contain without cover crop',
        'nextLessonActivation': 'existing footer Next lesson L09 button; card remains noninteractive',
    },
    'geometry': {
        'desktop1280x844': {'stageBefore': [621, 349.3125], 'stageAfter': [621, 349.3125],
                            'screenAfter': [621, 349.3125], 'posterBefore': [296.828125, 84],
                            'posterAfter': [242.859375, 136.609375],
                            'cardAfter': [314.828125, 191.203125]},
        'mobile390x844': {'stageBefore': [292, 164.25], 'stageAfter': [292, 164.25],
                          'screenAfter': [292, 164.25], 'posterBefore': [166.203125, 40],
                          'posterAfter': [166.203125, 93.484375],
                          'cardAfter': [178.203125, 131.484375]},
    },
    'route': {
        'url': 'http://127.0.0.1:3152/agentified/learningplan?lesson=L08&rev=7bb6267c9-f709e881-302b83e1',
        'temporaryWorktree': str(player), 'syntheticGuest': True,
        'checks': route['results'],
        'L16VisualRegressionChecks': ['route-evidence/L16-desktop-regression-check.png',
                                     'route-evidence/L16-mobile-regression-check.png'],
    },
    'validation': {
        'focusedVitest': '29/29 passed',
        'typescriptFull': '46 errors in unrelated repository files; zero in patch paths',
        'gitDiffCheck': 'pass', 'routeMatrix': '20/20 checks passed across desktop and mobile',
        'mp4Decode': 'pass', 'renderedStillsInspected': True,
    },
    'limitations': [
        'PR #1296 contains a source patch artifact, not a durable product binding; captain must apply it after sequencing player PR #1295',
        'Route MP4s are visual-only browser recordings',
        'No production deployment, real learner data, provider call, or human QA in this lane',
    ],
    'mp4s': videos,
    'manifest': [{'path': str(file.relative_to(base)), 'sha256': hash_file(file),
                  'bytes': file.stat().st_size} for file in files],
}
(base / 'validation-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(f"verified {len(files)} files, {len(videos)} MP4s, and both route matrices")
