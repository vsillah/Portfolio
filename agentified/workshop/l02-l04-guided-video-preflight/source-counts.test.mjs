import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

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
