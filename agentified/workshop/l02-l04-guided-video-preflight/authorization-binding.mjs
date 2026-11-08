import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export function assertAuthorizationBinding(readme, batch) {
  const { batch_sha256: receiptHash, ...payload } = batch;
  const derivedHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  assert.equal(receiptHash, derivedHash, 'batch receipt identity does not match its payload');

  const authorization = readme.split('## Ready-to-send conditional batch authorization')[1];
  assert.ok(authorization, 'README authorization block missing');
  const hashes = [...authorization.matchAll(/batch SHA-256 `([a-f0-9]{64})`/g)].map((match) => match[1]);
  assert.equal(hashes.length, 1, 'README must bind exactly one batch identity');
  assert.equal(hashes[0], derivedHash, 'README authorization batch identity is stale');
}
