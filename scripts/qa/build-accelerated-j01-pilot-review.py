#!/usr/bin/env python3
"""Build/check a local, source-bound listening receipt for the single L01 J01 pilot."""
import argparse
import difflib
import hashlib
import html
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path('artifacts/accelerated-visual-parity-2026-11-10/narration-pilot')
WAV = OUT / 'l01-j01-original.wav'
ASR = OUT / 'l01-j01-asr-evidence.json'
PACK = Path('docs/accelerated-course-modules/narration-production-pack-2026-11-10.json')
EDL = Path('artifacts/accelerated-visual-parity-2026-11-10/full-lesson-timing-decisions.json')
EXPECTED_WAV_SHA = '24ce83730c2112a52fee7e765794c29c771886ad103094ddff53511d33491360'


def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def normalized(text):
    return re.findall(r'[a-z0-9]+', text.casefold().replace('’', "'"))


def command(*args):
    return subprocess.run(args, cwd=ROOT, check=True, capture_output=True, text=True)


def build():
    assert sha(WAV) == EXPECTED_WAV_SHA, 'original provider WAV changed'
    pack = json.loads((ROOT / PACK).read_text())
    lesson = next(item for item in pack['lessons'] if item['lesson_id'] == 'L01')
    job = next(item for item in lesson['speech_jobs'] if item['id'] == 'J01')
    windows = {item['id']: item for item in lesson['windows']}
    assert job['window_ids'] == ['C01', 'C02']
    assert hashlib.sha256(job['text'].encode()).hexdigest() == job['text_sha256']
    assert job['text'] == windows['C01']['text'] + '\n\n' + windows['C02']['text']
    assert job['character_count'] == 3518
    assert job['text_sha256'] == '33e4fced3cde522647ec92a08840b2c56b28becfc86a1f2f11f3d24e4b4d6a4a'
    evidence = json.loads((ROOT / ASR).read_text())
    assert evidence['source_sha256'] == sha(WAV)
    heard = ' '.join(segment['text'] for segment in evidence['segments'])
    expected_tokens, heard_tokens = normalized(job['text']), normalized(heard)
    assert expected_tokens == heard_tokens, 'ASR word sequence differs from the approved payload'
    words = [word for segment in evidence['segments'] for word in segment['words']]
    first_c02 = next(index for index, word in enumerate(words) if word['text'].casefold() == 'before')
    assert [word['text'].casefold() for word in words[first_c02:first_c02 + 5]] == ['before', 'you', 'try', 'any', 'prompt,']
    assert words[first_c02 - 1]['text'].casefold() == 'work.'
    c01_end, c02_start = words[first_c02 - 1]['end'], words[first_c02]['start']
    boundary = round((c01_end + c02_start) / 2, 3)
    probe = json.loads(command('ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_name,sample_rate,channels,bits_per_sample', '-of', 'json', str(WAV)).stdout)
    duration = float(probe['format']['duration'])
    stream = probe['streams'][0]
    assert stream['codec_name'] == 'pcm_s16le' and stream['sample_rate'] == '44100' and stream['channels'] == 1
    silence = command('ffmpeg', '-hide_banner', '-i', str(WAV), '-af', 'silencedetect=noise=-40dB:d=0.25', '-f', 'null', '-')
    pauses = [float(value) for value in re.findall(r'silence_duration: ([\d.]+)', silence.stderr)]
    planned = [windows['C01']['planned_duration_seconds'], windows['C02']['planned_duration_seconds']]
    actual = [boundary, duration - boundary]
    assert all(planned[index] > actual[index] for index in (0, 1))
    receipt = {
        'status': 'review_only_fit_failed',
        'scope': 'one authorized L01 J01 provider WAV; no retry, stretch, learner media, or binding',
        'source_pack': {'path': str(PACK), 'sha256': sha(PACK)},
        'source_edl': {'path': str(EDL), 'sha256': sha(EDL)},
        'approved_job': {'id': 'L01 J01', 'window_ids': job['window_ids'], 'characters': job['character_count'], 'text_sha256': job['text_sha256']},
        'original_wav': {'path': str(WAV), 'sha256': sha(WAV), 'duration_seconds': duration,
                         'codec': stream['codec_name'], 'sample_rate_hz': int(stream['sample_rate']), 'channels': stream['channels']},
        'provider_report': {'source': 'integration captain report; balance not rechecked in this lane', 'voice_id': '14b592b937744404a4fa7c01aafd7dbe', 'model': 'heygen-voice-1', 'language': 'en', 'credits_debited': 2, 'cash_usd': 0},
        'asr_evidence': {'path': str(ASR), 'sha256': sha(ASR), 'method': evidence['method'],
                         'normalized_approved_tokens': len(expected_tokens), 'normalized_asr_tokens': len(heard_tokens),
                         'exact_normalized_order_match': True, 'segment_count': len(evidence['segments']),
                         'limit': 'ASR is a machine check, not a human listening signoff; punctuation and prosody are not certified.'},
        'window_fit': [
            {'id': sid, 'approved_word_count': windows[sid]['word_count'], 'planned_start_seconds': windows[sid]['planned_start_seconds'],
             'planned_end_seconds': windows[sid]['planned_end_seconds'], 'planned_duration_seconds': planned[index],
             'pilot_audio_start_seconds': 0 if index == 0 else boundary,
             'pilot_audio_end_seconds': boundary if index == 0 else duration,
             'pilot_audio_duration_seconds': round(actual[index], 3),
             'unfilled_window_seconds': round(planned[index] - actual[index], 3),
             'pilot_words_per_minute': round(windows[sid]['word_count'] / actual[index] * 60, 1)}
            for index, sid in enumerate(('C01', 'C02'))],
        'boundary': {'last_c01_word_end_seconds': c01_end, 'first_c02_word_start_seconds': c02_start,
                     'provisional_split_seconds': boundary, 'method': 'midpoint of ASR-timed pause after reactive work and before Before you try any prompt'},
        'silence_scan': {'threshold_dbfs': -40, 'minimum_duration_seconds': 0.25, 'pause_count': len(pauses),
                         'total_pause_seconds': round(sum(pauses), 3), 'longest_pause_seconds': round(max(pauses), 3),
                         'pauses_over_one_second': sum(value > 1 for value in pauses)},
        'total_planned_cutaway_seconds': round(sum(planned), 3),
        'total_pilot_seconds': duration,
        'total_unfilled_seconds': round(sum(planned) - duration, 3),
        'decision': 'Do not place or stretch this J01 WAV into the approved L01 C01/C02 windows. Review pace and the large unfilled spans before any further provider request.',
        'unresolved': ['Human audible pace and voice-match signoff', 'Full L01 source-to-output composite and caption timing', 'Any decision to revise timing, wording, or provider settings'],
    }
    return receipt, job, windows


def segment_files(receipt, action):
    boundary = receipt['boundary']['provisional_split_seconds']
    segments = [
        ('C01', 0, boundary, OUT / 'l01-j01-c01-review.mp3'),
        ('C02', boundary, receipt['total_pilot_seconds'] - boundary, OUT / 'l01-j01-c02-review.mp3'),
    ]
    rows = []
    for sid, start, duration, path in segments:
        if action == 'build':
            command('ffmpeg', '-v', 'error', '-y', '-i', str(WAV), '-ss', str(start), '-t', str(duration),
                    '-ac', '1', '-ar', '44100', '-b:a', '128k', str(path))
        assert (ROOT / path).exists(), f'missing local listening segment {path}'
        rows.append({'window_id': sid, 'path': str(path), 'sha256': sha(path),
                     'origin': 'local MP3 excerpt from unchanged original WAV; playback convenience only'})
    return rows


def page(receipt, windows):
    c01, c02 = receipt['window_fit']
    boundary = receipt['boundary']['provisional_split_seconds']
    return f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>L01 J01 pilot listening review</title>
<style>body{{margin:0;background:#0c202a;color:#eee6d8;font:16px system-ui}}main{{max-width:900px;margin:auto;padding:30px 20px}}h1{{font:40px Georgia;margin:0 0 10px}}h2{{font:27px Georgia}}p{{line-height:1.5}}audio{{width:100%;margin:18px 0}}button{{font:inherit;background:#d9b75e;color:#102832;border:0;border-radius:8px;padding:12px 18px;margin:4px;cursor:pointer}}button:focus-visible{{outline:3px solid white}}.bad{{color:#ffd184}}.card{{border:1px solid #8ba6a4;border-radius:12px;padding:18px;margin:20px 0;background:#15333b}}.muted{{color:#b8c9c8}}details{{margin:20px 0}}summary{{cursor:pointer}}@media(max-width:480px){{h1{{font-size:31px}}main{{padding:20px 14px}}}}</style>
<main><h1>L01 J01 · single pilot</h1><p>Local review only. Original HeyGen WAV, unchanged. The approved payload covers C01 and C02, but its 209.03 seconds leave <strong class="bad">91.25 seconds</strong> of the planned windows unfilled. The C01/C02 buttons use local MP3 excerpts so they work on a static server without range seeking. Playback speed and pitch are unchanged.</p><audio id="pilot" controls preload="metadata" src="l01-j01-original.wav">Your browser does not support WAV playback.</audio><div><button data-file="l01-j01-c01-review.mp3">Play C01</button><button data-file="l01-j01-c02-review.mp3">Play C02</button><button id="whole">Play whole original</button></div><p id="state" aria-live="polite" class="muted">Select a segment or use the audio controls.</p>
<div class="card"><h2>Timing verdict: does not fit</h2><p>C01: {c01['pilot_audio_duration_seconds']:.2f}s speech span in {c01['planned_duration_seconds']:.2f}s allotted; <strong>{c01['unfilled_window_seconds']:.2f}s unfilled</strong> ({c01['pilot_words_per_minute']:.1f} approved words/min).</p><p>C02: {c02['pilot_audio_duration_seconds']:.2f}s speech span in {c02['planned_duration_seconds']:.2f}s allotted; <strong>{c02['unfilled_window_seconds']:.2f}s unfilled</strong> ({c02['pilot_words_per_minute']:.1f} approved words/min).</p><p>The provisional split is {boundary:.2f}s, in the pause after “reactive work” and before “Before you try any prompt.” The local ASR word order matches all 611 normalized approved tokens. Human listening is still required for pace, emphasis, and voice match.</p></div>
<details><summary>Approved C01 text</summary><p>{html.escape(windows['C01']['text'])}</p></details><details><summary>Approved C02 text</summary><p>{html.escape(windows['C02']['text'])}</p></details><p class="muted">Source SHA-256: {receipt['original_wav']['sha256']}. Provider balance and credits are captain-reported, not independently queried here. No learner media, captions, or binding changed.</p></main>
<script>const audio=document.querySelector('#pilot'),state=document.querySelector('#state');document.querySelectorAll('button[data-file]').forEach(button=>button.onclick=()=>{{audio.pause();audio.src=button.dataset.file;audio.load();audio.play().then(()=>state.textContent=`Playing ${{button.textContent}} at normal speed`).catch(e=>state.textContent=`Playback failed: ${{e.message}}`)}});document.querySelector('#whole').onclick=()=>{{audio.pause();audio.src='l01-j01-original.wav';audio.load();audio.play().then(()=>state.textContent='Playing whole original at normal speed').catch(e=>state.textContent=`Playback failed: ${{e.message}}`)}};audio.onerror=()=>state.textContent='Local audio is unavailable in this checkout';</script></html>'''


def readme(receipt):
    return f'''# L01 J01 single-call narration pilot

Status: review only; fit failed. The original WAV is local and unchanged. It and the two local MP3 listening excerpts are intentionally untracked because this lane has no confirmed permission to publish the generated voice file in a GitHub PR. The [local player](review.html) works beside those files; GitHub readers get the source-bound [receipt](receipt.json) and [ASR evidence](l01-j01-asr-evidence.json) without the voice media.

The 3,518-character approved J01 payload (SHA-256 `{receipt['approved_job']['text_sha256']}`) maps to L01 C01 and C02 in the [narration pack](../../../../docs/accelerated-course-modules/narration-production-pack-2026-11-10.json). The 209.029-second mono PCM WAV (SHA-256 `{receipt['original_wav']['sha256']}`) gives C01 about 138.06 seconds and C02 about 70.97 seconds at normal speed. The approved windows allow 203.48 and 96.80 seconds. This leaves 91.25 seconds unfilled in total.

Local faster-whisper `small.en` returned the same 611 normalized tokens in the same order as the approved payload. This is strong machine evidence for wording and order, subject to human listening. The -40 dBFS / 0.25-second silence scan found {receipt['silence_scan']['pause_count']} pauses totaling {receipt['silence_scan']['total_pause_seconds']:.2f} seconds; the longest was {receipt['silence_scan']['longest_pause_seconds']:.2f} seconds, with none over one second. The pace is about {receipt['window_fit'][0]['pilot_words_per_minute']:.1f} approved words/minute in C01 and {receipt['window_fit'][1]['pilot_words_per_minute']:.1f} in C02. No subjective pace or presenter-voice match is claimed here.

Do not stretch, slow, or insert the WAV into the learner video to hide this gap. Reconcile pacing and timing before any further provider call. No new provider request, learner-media edit, caption retime, binding, merge, or release occurred in this lane. The captain reported two HeyGen credits spent and $0 cash for the one authorized call; this lane did not query the provider.

## Rebuild and local playback

```bash
python3 -B scripts/qa/build-accelerated-j01-pilot-review.py build
python3 -B scripts/qa/build-accelerated-j01-pilot-review.py check
python3 -m http.server 8771 --bind 127.0.0.1
```

Open `http://127.0.0.1:8771/artifacts/accelerated-visual-parity-2026-11-10/narration-pilot/review.html` in the local browser with `l01-j01-original.wav` beside it.
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('build', 'check'))
    action = parser.parse_args().action
    receipt, _, windows = build()
    receipt['local_listening_segments'] = segment_files(receipt, action)
    outputs = {'receipt.json': json.dumps(receipt, ensure_ascii=False, indent=2) + '\n',
               'review.html': page(receipt, windows), 'README.md': readme(receipt)}
    for name, value in outputs.items():
        path = ROOT / OUT / name
        if action == 'build':
            path.write_text(value)
        else:
            assert path.read_text() == value, f'{name} differs from the source-bound pilot'
    print(f'{action}: L01 J01 {receipt["total_pilot_seconds"]:.3f}s; {receipt["total_unfilled_seconds"]:.3f}s unfilled; normalized ASR order matched')


if __name__ == '__main__':
    main()
