#!/usr/bin/env python3
"""Stage immutable remasters for the learner player and write their binding."""
import hashlib
import json
import pathlib
import shutil

ROOT=pathlib.Path(__file__).resolve().parents[2]
ART=ROOT/'artifacts/accelerated-visual-parity-2026-11-10'
RECEIPT=ART/'composite-receipt.json'
BINDING=ROOT/'lib/accelerated-visual-parity-bindings.json'

def sha(path):
    digest=hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda:stream.read(4*1024*1024),b''):digest.update(chunk)
    return digest.hexdigest()

record=json.loads(RECEIPT.read_text())
scenes=json.loads((ART/'scene-receipt.json').read_text())
assert len(record['composites'])==16 and scenes['scene_count']==98
bindings=[]
for entry in record['composites']:
    source=ROOT/entry['output_path']
    target=ROOT/f"public/accelerated/visual-parity/{entry['lesson_id'].lower()}/visual-{entry['output_sha256'][:8]}/{entry['lesson_id'].lower()}-visual-parity.mp4"
    assert sha(source)==entry['output_sha256'],entry['lesson_id']
    target.parent.mkdir(parents=True,exist_ok=True)
    if source!=target:
        if target.exists():
            assert sha(target)==entry['output_sha256'],entry['lesson_id']+' target collision'
            source.unlink()
        else:shutil.move(source,target)
    entry['output_path']=str(target.relative_to(ROOT))
    bindings.append({
        'lessonId':entry['lesson_id'],
        'videoPath':'/'+str(target.relative_to(ROOT/'public')),
        'videoSha256':entry['output_sha256'],
        'sourceVideoSha256':entry['source_sha256'],
        'captionSha256':entry['caption_sha256'],
        'durationSeconds':entry['duration_seconds'],
        'sceneCount':entry['scene_count'],
    })
RECEIPT.write_text(json.dumps(record,indent=2)+'\n')
BINDING.write_text(json.dumps({'schemaVersion':1,'sceneReceiptSha256':sha(ART/'scene-receipt.json'),'lessons':bindings},indent=2)+'\n')
print('Staged',len(bindings),'lessons and',scenes['scene_count'],'scenes')
