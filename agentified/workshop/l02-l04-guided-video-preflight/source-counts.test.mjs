import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import { assertAuthorizationBinding } from './authorization-binding.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const load = (name) => JSON.parse(readFileSync(path.join(here, name), 'utf8'));

function checkCounts(batch, requests, receipts) {
  for (const lesson of batch.lessons) {
    const request = requests[lesson.lesson_id];
    const receipt = receipts[lesson.lesson_id];
    const inventory = request.source_bindings;
    assert.equal(new Set(inventory.map((item) => item.path)).size, inventory.length, `${lesson.lesson_id} duplicate source path`);
    assert.equal(lesson.source_binding_count, inventory.length, `${lesson.lesson_id} batch count`);
    assert.equal(receipt.source_binding_count, inventory.length, `${lesson.lesson_id} receipt count`);
    assert.match(batch.source_audit, new RegExp(`${lesson.lesson_id} ${inventory.length}(?:,| exact)`));
  }
}

const batch = load('batch-validation-receipt.json');
const requests = Object.fromEntries(batch.lessons.map(({ lesson_id: id }) => [id, load(`${id.toLowerCase()}-request-candidate.json`)]));
const receipts = Object.fromEntries(batch.lessons.map(({ lesson_id: id }) => [id, load(`${id.toLowerCase()}-validation-receipt.json`)]));

test('batch and lesson receipts match each exact source inventory', () => {
  checkCounts(batch, requests, receipts);
  assert.deepEqual(batch.lessons.map((item) => item.source_binding_count), [16, 17, 17]);
});

test('stale lesson count fails closed', () => {
  const stale = structuredClone(receipts);
  stale.L03.source_binding_count = 16;
  assert.throws(() => checkCounts(batch, requests, stale), /L03 receipt count/);
});

test('README authorization binds the derived batch receipt identity', () => {
  assertAuthorizationBinding(readFileSync(path.join(here, 'README.md'), 'utf8'), batch, requests);
});

test('stale README authorization hash fails closed', () => {
  const current = readFileSync(path.join(here, 'README.md'), 'utf8');
  const stale = current.replace(batch.batch_sha256, '753afcd2f8e1acc3b6f63718abd831927d083f01c2203faab91ff0cf428f0782');
  assert.throws(() => assertAuthorizationBinding(stale, batch, requests), /README authorization batch identity is stale/);
});

test('prior green sweater look fails closed in every request and authorization', () => {
  const readme = readFileSync(path.join(here, 'README.md'), 'utf8');
  const oldLook = '329ae68b92d342f6a4362cc656d486a0';
  for (const lesson of batch.lessons) {
    const stale = structuredClone(requests);
    stale[lesson.lesson_id].identity_voice.proposed_look_id = oldLook;
    assert.throws(() => assertAuthorizationBinding(readme, batch, stale), new RegExp(`${lesson.lesson_id} look identity drift`));
  }
  const staleReadme = readme.replace('7275ba9035f94b31ad589dda6532d002', oldLook);
  assert.throws(() => assertAuthorizationBinding(staleReadme, batch, requests), /README selected Gray Sweater look binding missing/);
});
