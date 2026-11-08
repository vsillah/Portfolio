import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export function assertAuthorizationBinding(readme, batch, requests) {
  const { batch_sha256: receiptHash, ...payload } = batch;
  const derivedHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  assert.equal(receiptHash, derivedHash, 'batch receipt identity does not match its payload');

  const authorization = readme.split('## Ready-to-send conditional batch authorization')[1];
  assert.ok(authorization, 'README authorization block missing');
  const hashes = [...authorization.matchAll(/batch SHA-256 `([a-f0-9]{64})`/g)].map((match) => match[1]);
  assert.equal(hashes.length, 1, 'README must bind exactly one batch identity');
  assert.equal(hashes[0], derivedHash, 'README authorization batch identity is stale');
  const grayLookId = '7275ba9035f94b31ad589dda6532d002';
  const grayGroupId = '5796a337512c43bbbdaa77c1cefc295f';
  const voiceId = '14b592b937744404a4fa7c01aafd7dbe';
  const oldGreenLookId = '329ae68b92d342f6a4362cc656d486a0';
  assert.ok(authorization.includes(`Vambah Gray Sweater look \`${grayLookId}\` (avatar group \`${grayGroupId}\`)`), 'README selected Gray Sweater look binding missing');
  assert.ok(authorization.includes(`avatar-native voice \`${voiceId}\``), 'README voice binding changed');
  assert.ok(!authorization.includes(oldGreenLookId), 'README retains prior green sweater look');
  for (const lesson of batch.lessons) {
    const request = requests[lesson.lesson_id];
    assert.ok(request, `${lesson.lesson_id} request missing`);
    assert.equal(request.identity_voice.proposed_look_id, grayLookId, `${lesson.lesson_id} look identity drift`);
    assert.equal(request.identity_voice.proposed_avatar_group_id, grayGroupId, `${lesson.lesson_id} avatar group drift`);
    assert.equal(request.identity_voice.proposed_voice_id, voiceId, `${lesson.lesson_id} voice identity drift`);
    assert.equal(request.identity_voice.status, 'purpose_specific_L02-L04_approval_required', `${lesson.lesson_id} rights status drift`);
    assert.equal(lesson.request_sha256, request.request_sha256, `${lesson.lesson_id} batch request identity drift`);
    assert.ok(authorization.includes(`${lesson.lesson_id} \`${request.request_sha256}\``), `${lesson.lesson_id} README request identity stale`);
  }
}
