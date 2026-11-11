#!/usr/bin/env python3
"""Build or check a source-bound, scene-by-scene Accelerated illustration audit."""
import argparse
import hashlib
import importlib.util
import json
import subprocess
from collections import Counter
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'artifacts/accelerated-illustration-audit-2026-11-11'
MANIFEST = Path('docs/accelerated-course-modules/visual-production/manifest.json')
CLEAN = Path('artifacts/accelerated-visual-parity-2026-11-10/clean-shell-review/receipt.json')
COMPOSITES = Path('artifacts/accelerated-visual-parity-2026-11-10/composite-receipt.json')
ASSETS = Path('docs/accelerated-course-modules/visual-production/asset-register.json')
SPECIMEN = Path('artifacts/accelerated-illustration-audit-2026-11-11/assets/l02-01-fifteen-priorities-v1.png')
SPECIMEN_SHA = '1f222baf8c0717817b28cafe52bda2b5101e6a05c14014f41d3c2618b7669f33'
NATIVE_FRAMES = OUT / 'native-frames'
NATIVE_SHEETS = [OUT / f'native-contact-sheet-{index:02d}.jpg' for index in range(1, 6)]

spec = importlib.util.spec_from_file_location('accelerated_illustration_renderer', ROOT / 'scripts/qa/render-accelerated-visual-parity.py')
renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)
composer_spec = importlib.util.spec_from_file_location('accelerated_illustration_composer', ROOT / 'scripts/qa/compose-accelerated-visual-parity.py')
composer = importlib.util.module_from_spec(composer_spec)
composer_spec.loader.exec_module(composer)

LESSON_ANCHORS = {
    'L01': 'the open Q3 plan and the approved SAM map',
    'L02': 'a crowded planning board with fifteen competing priorities',
    'L03': 'a dashboard review table with a visible decision owner',
    'L04': 'a persona deck revised against observed behavior',
    'L05': 'six traceable feedback notes and a decision file',
    'L06': 'the first member task, its handoff, and a short product brief',
    'L07': 'a small test path with evidence at each checkpoint',
    'L08': 'a learning plan with measures tied to the first task',
    'L09': 'the quiet conversations behind a decision room',
    'L10': 'one proposal shown to two decision rooms',
    'L11': 'a failed test brought into a shorter review meeting',
    'L12': 'source feedback traced into a job and a validation question',
    'L13': 'a flat metric examined beside its possible causes',
    'L14': 'one proposal tested against cost, objection, and evidence',
    'L15': 'a local improvement carried into another team with context',
    'L16': 'the first decision revisited through the completed file',
}

# L09–L16 have title-only shot fields in the source manifest. These are proposed
# review directions grounded in the corresponding approved narration, not source shots.
TITLE_ONLY_ART_DIRECTION = {
    'L09-01': 'Show a sound recommendation stalled by a staffing question and an absent decision owner; leave the outcome open.',
    'L09-02': 'Build the six-part argument around the fictional first-task card, with the tradeoff and requested decision visible.',
    'L09-03': 'Place decision-maker, influencer, gatekeeper, champion, skeptic, and blocker around the same proposed test.',
    'L09-04': 'Plot four fictional roles on the book\'s power-interest axes; leave their actual interests as questions.',
    'L09-05': 'Move the same test card through operations, front-line, and decision-owner conversations before the meeting.',
    'L09-06': 'Complete one stakeholder map with role, likely question, next conversation, and unverified status.',
    'L10-01': 'Show one proposal arriving as three different burdens for research, finance, and engineering.',
    'L10-02': 'Keep the same first-task claim while three audience lenses reveal workload, cost, and member job.',
    'L10-03': 'Compare a rewritten first-task card with a guided introduction and a deferral as actual options.',
    'L10-04': 'Mark the staff work required for the small test and the task displaced; leave cost unmeasured.',
    'L10-05': 'Put the operations objection on the test plan and visibly shorten or stop the proposed observation.',
    'L10-06': 'Fill the decision brief with owner, evidence, preferred option, alternative, cost, and stop condition.',
    'L11-01': 'Show Sam\'s book-story meeting with the evidence file already prepared and one choice on the table.',
    'L11-02': 'Keep the original hypothesis and preset change trigger beside a failed book-story test result.',
    'L11-03': 'Carry one source-identified first-task note through insight, test, decision, and recorded learning.',
    'L11-04': 'Pause an automated summary at a human review gate, with the original member sentence visible.',
    'L11-05': 'Open a six-week-old decision record to show belief, observation, choice, source links, and owner.',
    'L11-06': 'Draw one real workflow around the same decision file and circle its weakest handoff.',
    'L12-01': 'Spread three fictional member notes on a desk so starting, reminders, and confirmation remain distinct.',
    'L12-02': 'Trace fictional F01 from exact note to context, provisional job, and unanswered validation question.',
    'L12-03': 'Separate book case, fictional exercise, and actual research into three clearly bounded evidence trays.',
    'L12-04': 'Show two simulated reactions beside an empty real-customer evidence slot, with no preference count.',
    'L12-05': 'Turn two simulation questions into an approved observation plan with owner and stop condition.',
    'L12-06': 'Fill a job card and a simulation-question card, then point both toward a real observation.',
    'L13-01': 'Hold a flat, unlabeled-value dashboard beside the unanswered cause question; show no invented result.',
    'L13-02': 'Give the book\'s three business-model options distinct operating consequences, not generic cards.',
    'L13-03': 'Place one fictional shorter-commitment concept test beside its eligibility and decision rule.',
    'L13-04': 'Turn the future concept into a plain announcement with hard questions still visibly open.',
    'L13-05': 'Put one concept sentence before member, staff, and funder perspectives; mark generated objections as simulation.',
    'L13-06': 'Fill two decision-file pages: model alternatives on one, future concept and unanswered objection on the other.',
    'L14-01': 'Show one organized proposal facing separate cost and member-benefit questions in the room.',
    'L14-02': 'Keep one cited evidence note fixed while operations and member-facing versions change emphasis.',
    'L14-03': 'Place possible training, cancellation, and pause work beside the rejected and deferred alternatives.',
    'L14-04': 'Turn each simulated objection into a source-check or live question; keep simulation visibly bounded.',
    'L14-05': 'Show two sixty-second briefs for one decision, each carrying the same source IDs and different audience question.',
    'L14-06': 'Open the decision file to the two briefs, source IDs, unresolved objection, owner, and review date.',
    'L15-01': 'Show a second team receiving a useful template while the first team\'s context stays behind.',
    'L15-02': 'Use one light shared record with job, hypothesis, eligibility, measure, threshold, date, and reviewer.',
    'L15-03': 'Place the five scaling failure modes around the same handoff, showing how each breaks it.',
    'L15-04': 'Keep Sam\'s book-story outcome on one side and the fictional service\'s unverified state on the other.',
    'L15-05': 'Make a past decision recoverable with belief, contrary observation, choice, owner, and reopen condition.',
    'L15-06': 'Show the scale-readiness checklist leading to a decision record with ready, missing, and context-dependent states.',
    'L16-01': 'Reopen the first broad decision beside the completed file that now names evidence, options, and reviewers.',
    'L16-02': 'Show a colleague finding a past decision through cover sheet, source links, test, and recorded choice.',
    'L16-03': 'Place one seven-day action on a calendar with owner, evidence to collect, and a stop rule.',
    'L16-04': 'Keep observed note, interpretation, simulation, and book case in visibly separate source lanes.',
    'L16-05': 'Set a short review table with source links and four possible next states, leaving the result undecided.',
    'L16-06': 'Hand the completed one-week commitment to the separate in-video end-screen treatment.',
}

FAMILY_TREATMENTS = {
    'sheet': 'Show a partly completed document with one specific field being filled; retain readable source and decision context.',
    'archive': 'Show a stack of distinct source, interpretation, and decision records with one traceable item highlighted.',
    'contrast': 'Show two states of the same work surface so the changed evidence or choice is visible before labels are read.',
    'comparison': 'Give each option a concrete artifact or consequence; use labels only to identify the comparison.',
    'correction': 'Depict the original output, a source check, and the corrected artifact as a visible change.',
    'handoff': 'Show the specific artifact changing hands and the next action at the boundary; avoid generic paired silhouettes.',
    'checkpoint': 'Show a real gate on the work path, with current evidence and the allowed next move.',
    'numbered': 'Place each numbered step on the same evolving artifact instead of a freestanding list.',
    'timeline': 'Show the evolving decision file at each time point; keep the line as a guide rather than the entire image.',
    'trace': 'Connect a specific source mark to an interpretation and decision; show the trace on a tangible record.',
    'flow': 'Move a concrete note or artifact through the steps, with a visible changed state at the end.',
    'branch': 'Make the alternatives visible as consequences for the same person or task.',
    'matrix': 'Populate the quadrants with concrete case evidence and one clear choice.',
    'roles': 'Place people around the actual decision artifact; distinguish their authority by action.',
    'measure': 'Show a plausible labeled measure, its source, and the operational question it answers; avoid invented results.',
    'loop': 'Use the same decision file at every stage so the feedback cycle has a visible subject.',
    'boundary': 'Illustrate what crosses the boundary and what must stop, with a source or permission cue.',
    'reverse': 'Reveal the choice first, then trace back to the evidence needed to justify it.',
    'focus': 'Enlarge the one active approved plate or artifact; keep surrounding labels sparse.',
    'evidence': 'Show a source note, a counterexample, and the decision they challenge on one work surface.',
    'priority': 'Make the crowded board and the chosen question visibly different states.',
    'inbox': 'Make six distinct fictional notes traceable to their IDs, then narrow toward the decision.',
    'ledger': 'Show only the rows being discussed, anchored to source IDs and the task underway.',
    'feedback': 'Reveal notes one at a time in narration order, then connect them to a provisional job.',
    'cards': 'Use the cards as artifacts from the case, with a visible relationship or consequence.',
    'decision': 'Place the requested decision in its meeting context; show the missing evidence beside it.',
    'question': 'Make the unanswered question point to a specific decision or source gap.',
    'sam': 'Enlarge the approved SAM art at the active panel and preserve its natural aspect ratio.',
    'finale': 'Preserve the separately owned end-screen treatment and its native-control clearance.',
}

TEXT_FIRST = {'sheet', 'archive', 'contrast', 'comparison', 'correction', 'cards',
              'decision', 'question', 'priority', 'inbox', 'ledger', 'feedback', 'roles', 'matrix'}
REPEATED_SYMBOL = {'handoff', 'checkpoint', 'numbered', 'timeline', 'trace', 'flow',
                   'branch', 'measure', 'loop', 'boundary', 'reverse', 'focus', 'evidence'}
FIRST_WAVE = {'L01-01', 'L02-01', 'L03-01', 'L04-02', 'L05-01', 'L05-02', 'L05-04',
              'L08-01', 'L09-01', 'L12-01', 'L12-03', 'L13-01', 'L15-01', 'L15-04'}


def sha(path):
    digest = hashlib.sha256()
    with (ROOT / path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def cutaway_time(scene, presenter_windows):
    start, end = scene['start_seconds'], scene['end_seconds']
    available = [(start, end)]
    for a, b in presenter_windows:
        next_available = []
        for left, right in available:
            if b <= left or a >= right:
                next_available.append((left, right))
            else:
                if a > left:
                    next_available.append((left, a))
                if b < right:
                    next_available.append((b, right))
        available = next_available
    left, right = max(available, key=lambda interval: interval[1] - interval[0])
    assert right - left >= 3, scene['id']
    return round((left + right) / 2, 2)


def extract_native_frames():
    manifest = json.loads((ROOT / MANIFEST).read_text())
    media = {row['lesson_id']: row for row in json.loads((ROOT / COMPOSITES).read_text())['composites']}
    NATIVE_FRAMES.mkdir(parents=True, exist_ok=True)
    for lesson in manifest['lessons']:
        number = int(lesson['id'][1:])
        presenter, _ = composer.windows(number)
        source = ROOT / media[lesson['id']]['source_path']
        assert sha(Path(media[lesson['id']]['source_path'])) == media[lesson['id']]['source_sha256']
        for scene in lesson['scenes']:
            at = cutaway_time(scene, presenter)
            target = NATIVE_FRAMES / f"{scene['id']}.jpg"
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(at), '-i', str(source),
                            '-frames:v', '1', '-vf', 'scale=960:540', '-q:v', '3',
                            '-update', '1', str(target)], check=True, capture_output=True)


def build_native_contact_sheets():
    scene_ids = [scene['id'] for lesson in json.loads((ROOT / MANIFEST).read_text())['lessons']
                 for scene in lesson['scenes']]
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 17)
    for index, target in enumerate(NATIVE_SHEETS):
        sheet = Image.new('RGB', (1280, 1080), '#0c202a')
        draw = ImageDraw.Draw(sheet)
        for offset, sid in enumerate(scene_ids[index * 24:(index + 1) * 24]):
            x, y = offset % 4 * 320, offset // 4 * 180
            with Image.open(NATIVE_FRAMES / f'{sid}.jpg') as frame:
                sheet.paste(frame.resize((320, 180)), (x, y))
            draw.rectangle((x, y, x + 76, y + 25), fill='#0c202a')
            draw.text((x + 4, y + 3), sid, font=font, fill='#ffffff')
        sheet.save(target, quality=86, subsampling=0)


def prepare():
    manifest = json.loads((ROOT / MANIFEST).read_text())
    clean = json.loads((ROOT / CLEAN).read_text())
    composites = json.loads((ROOT / COMPOSITES).read_text())
    assets = json.loads((ROOT / ASSETS).read_text())
    assert sha(SPECIMEN) == SPECIMEN_SHA
    assert clean['source_manifest']['sha256'] == sha(MANIFEST)
    for asset in assets['assets'].values():
        assert sha(Path(asset['path'])) == asset['sha256'], asset['path']
    previews = {row['scene_id']: row for row in clean['scenes']}
    media = {row['lesson_id']: row for row in composites['composites']}
    rows = []
    title_only_shots = set()
    for lesson in manifest['lessons']:
        lid = lesson['id']
        presenter, _ = composer.windows(int(lid[1:]))
        assert sha(Path(media[lid]['source_path'])) == media[lid]['source_sha256']
        assert sha(Path(media[lid]['output_path'])) == media[lid]['output_sha256']
        for scene in lesson['scenes']:
            sid = scene['id']
            layout, labels = renderer.CONCEPTS[sid]
            if sid.startswith('L01-') or sid == 'L16-06':
                frame = Path(f'artifacts/accelerated-visual-parity-2026-11-10/frames/{sid}.png')
                frame_hash = sha(frame)
                frame_scope = 'current_visual_parity_frame'
            else:
                preview = previews[sid]['preview']
                frame = Path(preview['path'])
                frame_hash = preview['sha256']
                assert sha(frame) == frame_hash
                frame_scope = 'clean_shell_review_frame'
            assert sha(Path(scene['script_path'])) == scene['script_sha256']
            native_frame = Path(f'artifacts/accelerated-illustration-audit-2026-11-11/native-frames/{sid}.jpg')
            native_at = cutaway_time(scene, presenter)
            if layout in TEXT_FIRST:
                finding = 'text_first_template'
                action = 'replace_with_scene_specific_illustration'
            elif layout in REPEATED_SYMBOL:
                finding = 'repeated_abstract_diagram'
                action = 'ground_diagram_in_case_artifact'
            else:
                finding = 'approved_art_or_special_scene'
                action = 'inspect_active_art_beat_and_crop'
            if sid == 'L16-06':
                action = 'separate_end_screen_lane'
            beats = renderer.ART_BEATS.get(sid, [])
            plate_seconds = sum(seconds for kind, seconds in beats if kind in renderer.ART_ASSETS)
            if layout == 'sam' and not beats:
                plate_seconds = scene['end_seconds'] - scene['start_seconds']
            source_shot = scene['shot']['composition']
            title_only = source_shot.strip().rstrip('.').casefold() == scene['title'].strip().rstrip('.').casefold()
            if title_only:
                title_only_shots.add(sid)
            production_brief = TITLE_ONLY_ART_DIRECTION[sid] if title_only else source_shot
            source_conflict = None
            if sid == 'L05-02':
                source_conflict = 'Shot field says F01–F06 in Scene 2; approved narration places F01–F04 here and F05/F06 in Scene 3.'
                production_brief = 'Reveal F01/F02, then F03/F04; move the exact fictional F05/F06 note reveals to Scene 3.'
            wave = ('separate_end_screen' if sid == 'L16-06' else
                    'first_anchor_and_source_safety' if sid in FIRST_WAVE else
                    'text_and_title_only_replacement' if finding == 'text_first_template' or title_only else
                    'diagram_enrichment')
            rows.append({
                'scene_id': sid,
                'lesson_id': lid,
                'source_seconds': [scene['start_seconds'], scene['end_seconds']],
                'title': scene['title'],
                'script_path': scene['script_path'],
                'script_sha256': scene['script_sha256'],
                'frame_path': str(frame),
                'frame_sha256': frame_hash,
                'frame_scope': frame_scope,
                'learner_bound_cutaway_frame_path': str(native_frame),
                'learner_bound_cutaway_frame_sha256': sha(native_frame),
                'learner_bound_sample_seconds': native_at,
                'learner_bound_sample_finding': ('distinct_source_art_or_work_surface' if lid == 'L01'
                                                 else 'recurring_split_screen_sparse_text'),
                'observed_layout': layout,
                'visible_labels': labels,
                'finding': finding,
                'action': action,
                'production_wave': wave,
                'approved_plate_seconds_in_visual_plan': plate_seconds,
                'source_shot': source_shot,
                'source_shot_specificity': 'title_only' if title_only else 'described',
                'source_conflict': source_conflict,
                'production_brief': production_brief,
                'one_second_read_target': scene['title'],
                'illustration_anchor': LESSON_ANCHORS[lid],
                'scene_treatment': FAMILY_TREATMENTS[layout],
                'caption_rule': 'Keep the claim-bearing visual above the mobile caption band; verify in the final player.',
                'review_state': 'audit_only_unbound',
            })
    assert len(rows) == 98 and len({row['scene_id'] for row in rows}) == 98
    assert title_only_shots == set(TITLE_ONLY_ART_DIRECTION)
    counts = Counter(row['finding'] for row in rows)
    waves = Counter(row['production_wave'] for row in rows)
    assert sum(counts.values()) == 98
    return {
        'schema_version': 1,
        'status': 'review_only_scene_illustration_audit',
        'scope': 'L01-L16 learner-bound native cutaway samples and unbound visual parity proposal; no media replaced',
        'source_manifest': {'path': str(MANIFEST), 'sha256': sha(MANIFEST)},
        'source_clean_receipt': {'path': str(CLEAN), 'sha256': sha(CLEAN)},
        'source_composite_receipt': {'path': str(COMPOSITES), 'sha256': sha(COMPOSITES)},
        'source_asset_register': {'path': str(ASSETS), 'sha256': sha(ASSETS)},
        'illustration_specimen': {'scene_id': 'L02-01', 'path': str(SPECIMEN), 'sha256': SPECIMEN_SHA,
                                  'reference_path': assets['assets']['signals']['path'],
                                  'reference_sha256': assets['assets']['signals']['sha256'],
                                  'origin': 'OpenAI built-in image generation with one count-correction edit',
                                  'identity': 'synthetic planning board; fifteen icon notes; no customer evidence',
                                  'status': 'review_only_unbound'},
        'lesson_media': {lid: {'native': {'path': row['source_path'], 'sha256': row['source_sha256']},
                               'visual_proposal': {'path': row['output_path'], 'sha256': row['output_sha256']}}
                         for lid, row in media.items()},
        'finding_counts': dict(sorted(counts.items())),
        'learner_bound_sample_counts': dict(sorted(Counter(row['learner_bound_sample_finding'] for row in rows).items())),
        'native_contact_sheets': [{'path': str(path.relative_to(ROOT)), 'sha256': sha(path.relative_to(ROOT))}
                                  for path in NATIVE_SHEETS],
        'production_wave_counts': dict(sorted(waves.items())),
        'title_only_source_shot_count': len(title_only_shots),
        'scenes': rows,
        'limits': ['One learner-bound cutaway frame per scene plus visual proposal contact sheets; not a full playback pass.',
                   'Approved art beat length does not qualify the rest of its scene.',
                   'No generated illustration, native audio, caption, or learner binding changed.'],
    }


def html():
    return '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Accelerated illustration audit</title>
<style>body{margin:0;background:#0c202a;color:#eee6d8;font:16px system-ui}header{padding:28px max(20px,calc((100vw - 1280px)/2));background:#102832;border-bottom:2px solid #d5af5b}h1{margin:0 0 8px;font:38px Georgia}p{line-height:1.45}main{max-width:1280px;margin:auto;padding:24px}.filters{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px}select{font:inherit;padding:9px;background:#eee6d8;color:#102832}#count{margin:12px 0 22px;color:#d5af5b}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,430px),1fr));gap:18px}.card{border:1px solid #d5af5b;border-radius:14px;overflow:hidden;background:#15333b}.card img{width:100%;aspect-ratio:16/9;object-fit:contain;background:#071920;display:block}.body{padding:16px}.top{display:flex;justify-content:space-between;gap:10px}.tag{color:#d5af5b;font-size:13px;font-weight:700}.body h2{font:23px Georgia;margin:4px 0 10px}.body p{margin:8px 0}.body strong{color:#f0d78e}details{margin-top:10px;color:#b8c9c8}summary{cursor:pointer}.muted{color:#b8c9c8;font-size:14px}@media(max-width:480px){header{padding:20px}h1{font-size:30px}main{padding:14px}}</style>
<header><h1>Accelerated illustration audit</h1><p>98 timed scenes, source-bound. Each card opens with a frame from the learner-bound native video. The unbound visual proposal and source shot are available below it.</p><a style="color:#f0d78e" href="specimen-l02-01.html">Open the first illustrated specimen</a></header><main><div class="filters"><label>Lesson <select id="lesson"><option value="">All lessons</option></select></label><label>Proposal finding <select id="finding"><option value="">All findings</option></select></label></div><div id="count"></div><div id="grid" class="grid"></div></main>
<script>const root='../../';const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let rows=[];const lesson=document.querySelector('#lesson'),finding=document.querySelector('#finding'),grid=document.querySelector('#grid'),count=document.querySelector('#count');function render(){const shown=rows.filter(r=>(!lesson.value||r.lesson_id===lesson.value)&&(!finding.value||r.finding===finding.value));count.textContent=`${shown.length} of ${rows.length} scenes`;grid.innerHTML=shown.map(r=>`<article class="card"><img loading="lazy" src="${root+esc(r.learner_bound_cutaway_frame_path)}" alt="Learner-bound ${esc(r.scene_id)} cutaway at ${r.learner_bound_sample_seconds}s"><div class="body"><div class="top"><span class="tag">${esc(r.scene_id)} · ${r.source_seconds[0]}–${r.source_seconds[1]}s</span><span class="tag">${esc(r.finding.replaceAll('_',' '))}</span></div><h2>${esc(r.title)}</h2><p class="muted">Learner-bound frame at ${r.learner_bound_sample_seconds}s · ${esc(r.learner_bound_sample_finding.replaceAll('_',' '))}</p><details><summary>View unbound visual proposal</summary><img loading="lazy" src="${root+esc(r.frame_path)}" alt="Unbound ${esc(r.scene_id)} visual proposal"></details><p><strong>Proposed illustration:</strong> ${esc(r.production_brief)}</p><details><summary>Source shot${r.source_shot_specificity==='title_only'?' (title only)':''}</summary><p>${esc(r.source_shot)}</p></details><p><strong>Treatment:</strong> ${esc(r.scene_treatment)} Use ${esc(r.illustration_anchor)}.</p>${r.source_conflict?`<p class="tag">Source timing conflict: ${esc(r.source_conflict)}</p>`:''}<p class="muted">${esc(r.action.replaceAll('_',' '))} · ${r.approved_plate_seconds_in_visual_plan}s approved art beat</p></div></article>`).join('')}fetch('scene-audit.json').then(r=>{if(!r.ok)throw Error(r.status);return r.json()}).then(data=>{rows=data.scenes;[...new Set(rows.map(r=>r.lesson_id))].forEach(v=>lesson.add(new Option(v,v)));[...new Set(rows.map(r=>r.finding))].forEach(v=>finding.add(new Option(v.replaceAll('_',' '),v)));render()}).catch(e=>count.textContent=`Audit failed to load: ${e.message}`);lesson.onchange=finding.onchange=render;</script></html>
'''


def specimen_html():
    return '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>L02 illustration specimen</title>
<style>body{margin:0;padding:24px;background:#0c202a;color:#eee6d8;font:16px system-ui}main{max-width:1500px;margin:auto}h1{font:38px Georgia;margin:0 0 8px}p{line-height:1.45}a{color:#f0d78e}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:24px}figure{margin:0}figcaption{padding:10px 0;color:#f0d78e}img,.stage{width:100%;aspect-ratio:16/9;object-fit:cover;display:block}.stage{position:relative;overflow:hidden;background:#0c202a}.stage img{position:absolute;inset:0}.stage .brand{position:absolute;top:5%;left:4%;font-size:clamp(8px,1vw,15px);font-weight:700;color:#f0d78e;letter-spacing:.08em}.stage .title{position:absolute;top:37%;left:4%;width:27%;font:clamp(21px,3.4vw,54px)/1.08 Georgia;color:#eee6d8;text-shadow:0 2px 14px #071920}@media(max-width:800px){.grid{grid-template-columns:1fr}body{padding:14px}.stage .title{font-size:clamp(20px,5vw,40px)}}</style>
<main><h1>L02-01 · Fifteen priorities</h1><p>Review-only illustration specimen. The proposed frame keeps the approved navy, teal, and gold vocabulary and shows a crowded synthetic planning board before the decision. It does not replace a learner video. <a href="review.html">Return to all scenes</a>.</p><div class="grid"><figure><img src="../../artifacts/accelerated-visual-parity-2026-11-10/clean-shell-review/frames/L02-01.jpg" alt="Current sparse priority card"><figcaption>Current clean-shell frame</figcaption></figure><figure><div class="stage"><img src="assets/l02-01-fifteen-priorities-v1.png" alt="Fifteen gold icon notes crowd a dark teal board around one blank decision card"><div class="brand">AMADUTOWN / ACCELERATED</div><div class="title">Fifteen<br>priorities</div></div><figcaption>Illustrated proposal · native presenter and captions still require compositing QA</figcaption></figure></div></main></html>
'''


def readme(data):
    counts = data['finding_counts']
    art_beats = [row for row in data['scenes'] if row['approved_plate_seconds_in_visual_plan']]
    lines = [
        '# Accelerated illustration audit', '',
        'Status: review only. This inspects all 98 timed L01–L16 visual proposal scenes and one cutaway frame per learner-bound native scene against the approved narration and shot descriptions. The native MP4s remain unchanged. [Open the scene gallery](review.html) from a local server; [scene data](scene-audit.json) carries exact hashes and treatments. A first [L02 illustration specimen](specimen-l02-01.html) tests the direction without changing learner media.', '',
        f"The visual-proposal contact-sheet pass found **{counts['text_first_template']} text-first templates**, **{counts['repeated_abstract_diagram']} repeated abstract diagrams**, and **{counts['approved_art_or_special_scene']} approved-art or special scenes**. These are triage findings, not proof that every diagram is wrong. A source-art beat can occupy only part of its scene.", '',
        'The learner-bound midpoint cutaway samples show the recurring beige split-screen, short-heading/list or direct-address treatment in **92 of 98 scenes** (L02–L16); L01 uses more distinct source art and work surfaces. [Contact sheets 1](native-contact-sheet-01.jpg), [2](native-contact-sheet-02.jpg), [3](native-contact-sheet-03.jpg), [4](native-contact-sheet-04.jpg), and [5](native-contact-sheet-05.jpg) show all 98 samples. This is a one-frame-per-scene finding, not a full-video timing or caption judgment.', '',
        "**Production decision:** treat all 92 recurring split-screen scenes as illustration work, then inspect each scene's opening, middle, and closing speaking beats in the finished composite. A sparse title/list beside the presenter does not clear the scene. Record a specific visual claim, its source or synthetic-case boundary, the visible change during the narration, and any deliberate unchanged hold. L01's six distinct midpoint samples also need this temporal pass; the midpoint finding does not qualify their entire scenes. The current L01 pacing candidate remains review-only while this visual gate is open.", '',
        f"Named approved-art beats appear in **{len(art_beats)} scenes** for **{sum(row['approved_plate_seconds_in_visual_plan'] for row in art_beats)} seconds** of the 161-minute plan. Their presence does not clear the surrounding cutaway visuals.", '',
        f"L09–L16 have **{data['title_only_source_shot_count']} title-only shot fields** in the source manifest. The gallery proposes scene-specific directions from their approved narration and labels them as proposals. L05-02 has a source-shot timing conflict: it lists F01–F06 there, while its narration places F05/F06 in Scene 3.", '',
        '## Visual direction', '',
        'Agentified is a useful comparison because its reviewed scenes keep a recognizable work surface while the decision changes. Accelerated should keep its own approved SAM, Signals, Alignment, and Momentum vocabulary: dark navy, teal, warm gold, source notes, decision files, and chapter art. Let the illustration show the situation, the evidence, and the change. Keep labels short and tied to a visible artifact.', '',
        '| Lesson | Persistent illustration anchor |', '| --- | --- |',
    ]
    lines += [f'| {lid} | {anchor} |' for lid, anchor in LESSON_ANCHORS.items()]
    lines += ['', '## Production gate', '',
              'First production wave: L01-01, L02-01, L03-01, L04-02, L05-01/02/04, L08-01, L09-01, L12-01/03, L13-01, and L15-01/04. These establish the physical work surfaces, correct the L05 source boundary, and protect book/fiction/simulation labels. The remaining text and title-only scenes follow before diagram enrichment. L16-06 stays in its separate end-screen lane.', '',
              'Each scene needs a one-second visual read, source-accurate case detail, and a distinct change or reason to hold. Where a worksheet is the subject, show a meaningful field being filled instead of an empty template. Preserve the approved art at its natural ratio and identify the exact narration beat it supports. Audit full-resolution frames and native-caption playback at desktop and mobile widths; a contact sheet cannot establish legibility. L16-06 remains with the separate end-screen lane.', '',
              'The L02 specimen is an original synthetic planning-board illustration generated with the built-in image tool, then edited once to show exactly fifteen notes. Its approved Signals-plate style reference and output hash are recorded in `scene-audit.json`. It is a visual direction test, not evidence of a real meeting or measured result.', '',
              'No learner media, narration, captions, provider state, or bindings changed. The gallery is an internal review surface, not a finished lesson.', '',
              '## Rebuild', '', '```bash',
              'python3 -B scripts/qa/audit-accelerated-illustrations.py build',
              'python3 -B scripts/qa/audit-accelerated-illustrations.py check',
              'python3 -m http.server 8765 --bind 127.0.0.1',
              '```', '',
              'Then open `http://127.0.0.1:8765/artifacts/accelerated-illustration-audit-2026-11-11/review.html`.', '']
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['build', 'check'])
    args = parser.parse_args()
    if args.action == 'build':
        extract_native_frames()
        build_native_contact_sheets()
    data = prepare()
    outputs = {'scene-audit.json': json.dumps(data, ensure_ascii=False, indent=2) + '\n',
               'review.html': html(), 'specimen-l02-01.html': specimen_html(),
               'README.md': readme(data)}
    if args.action == 'build':
        OUT.mkdir(parents=True, exist_ok=True)
        for name, content in outputs.items():
            (OUT / name).write_text(content)
    else:
        for name, content in outputs.items():
            assert (OUT / name).read_text() == content, f'{name} differs from current source-bound audit'
    print(f'{args.action}: {len(data["scenes"])} scenes, {data["finding_counts"]}')


if __name__ == '__main__':
    main()
