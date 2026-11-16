#!/usr/bin/env python3
"""Derive review-only timed text from the approved local L01 caption plan."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
PARENT = HERE.parent
PLAN = PARENT / 'caption-plan.json'
VIDEO = PARENT / 'l01-c01-c02-v17-four-section-caption-review.mp4'
PLAN_SHA = 'd917317e98f7dc05590e714097af9faf00a9c09236ce894a18c214ce9138b21e'
VIDEO_SHA = '80a1be496b7b05e1ae7bf6bff2cd00e2410374e6c8abe65e280fe7e4c444d0d1'
SOURCE_COMMIT = '3a2df476a96d3106823537c2442a72bd69a95080'
SECTIONS = [('P01', 0, 28.4), ('C01', 28.4, 235), ('P02', 235, 248.2), ('C02', 248.2, 345)]


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(4 * 1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def clock(milliseconds):
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    seconds, millis = divmod(remainder, 1000)
    return f'{hours:02}:{minutes:02}:{seconds:02}.{millis:03}'


def prepare():
    assert sha(PLAN) == PLAN_SHA, 'caption plan drift'
    assert VIDEO.exists(), 'approved local MP4 is required; no public media fallback'
    assert sha(VIDEO) == VIDEO_SHA, 'approved local MP4 drift'
    probe = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate',
        '-of', 'json', str(VIDEO)], text=True))
    image = next(row for row in probe['streams'] if row['codec_type'] == 'video')
    assert abs(float(probe['format']['duration']) - 345) < .01
    assert (image['width'], image['height'], image['r_frame_rate']) == (1280, 900, '25/1')
    source = json.loads(PLAN.read_text())
    cues = source['caption_cues']
    assert len(cues) == source['caption_cue_count'] == 175
    result = []
    for index, cue in enumerate(cues, 1):
        start, end = round(cue['start'] * 1000), round(cue['end'] * 1000)
        assert 0 <= start < end <= 345_000 and '\n' not in cue['text']
        if result:
            assert result[-1]['endMilliseconds'] <= start, f'caption overlap at cue {index}'
        section = next(name for name, left, right in SECTIONS if left * 1000 <= start < right * 1000)
        result.append({'id': index, 'section': section, 'start': clock(start), 'end': clock(end),
                       'startMilliseconds': start, 'endMilliseconds': end, 'text': cue['text']})
    assert [sum(item['section'] == name for item in result) for name, _, _ in SECTIONS] == [18, 102, 8, 47]
    vtt = ('WEBVTT\n\n' + ''.join(f"{cue['id']}\n{cue['start']} --> {cue['end']}\n{cue['text']}\n\n" for cue in result)).rstrip() + '\n'
    transcript = {'status': 'review_only_unbound', 'durationSeconds': 345,
                  'videoSha256': VIDEO_SHA, 'captionPlanSha256': PLAN_SHA, 'cues': result}
    transcript_text = json.dumps(transcript, ensure_ascii=False, indent=2) + '\n'
    receipt = {'status': 'review_only_unbound', 'sourceCommit': SOURCE_COMMIT,
               'approvedLocalVideoSha256': VIDEO_SHA, 'captionPlanSha256': PLAN_SHA,
               'durationSeconds': 345, 'cueCount': 175,
               'sectionCounts': {name: sum(item['section'] == name for item in result) for name, _, _ in SECTIONS},
               'lastCueEnd': result[-1]['end'], 'lastCueText': result[-1]['text'],
               'vttSha256': hashlib.sha256(vtt.encode()).hexdigest(),
               'transcriptSha256': hashlib.sha256(transcript_text.encode()).hexdigest(),
               'rendering': 'MP4 contains always-visible raster captions; prototype has no video caption track or caption on/off control. Timed text is supplied as VTT and synchronized read-along below the video.',
               'limits': ['Cue timing and words are derived from the approved plan; no new human audio-to-text listening pass was performed.',
                          'No learner media or production/player binding changed.',
                          'Accessible playback and assistive-technology behavior require human review.',
                          'Local-only voice-bearing MP4 is not committed or copied into public.']}
    return {'captions.vtt': vtt, 'transcript.json': transcript_text,
            'receipt.json': json.dumps(receipt, ensure_ascii=False, indent=2) + '\n'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=('build', 'check'))
    action = parser.parse_args().action
    outputs = prepare()
    for name, content in outputs.items():
        target = HERE / name
        if action == 'build':
            target.write_text(content)
        else:
            assert target.read_text() == content, f'{name} drift'
    print(f'{action} passed: 175 cues, exact approved local video and plan')


if __name__ == '__main__':
    main()
