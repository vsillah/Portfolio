#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export function checkEvidenceTable(readme, batch) {
  const lines = readme.split('\n').filter((line) => /^\| L\d{2} \|/.test(line));
  if (lines.length !== batch.lessons.length) throw new Error(`README evidence row count ${lines.length} != ${batch.lessons.length}`);
  const rows = new Map();
  for (const line of lines) {
    const match = line.match(/^\| (L\d{2}) \| `([a-f0-9]{64})` \| `([a-f0-9]{64})` \| `([a-f0-9]{64})` \|/);
    if (!match) throw new Error(`Malformed README evidence row: ${line.slice(0, 40)}`);
    const [, id, packet, script, candidate] = match;
    if (rows.has(id)) throw new Error(`Duplicate README evidence row: ${id}`);
    rows.set(id, { packet_sha256: packet, script_sha256: script, candidate_sha256: candidate });
  }
  for (const lesson of batch.lessons) {
    const row = rows.get(lesson.lesson_id);
    if (!row) throw new Error(`Missing README evidence row: ${lesson.lesson_id}`);
    for (const field of ['packet_sha256', 'script_sha256', 'candidate_sha256']) {
      if (row[field] !== lesson[field]) throw new Error(`${lesson.lesson_id} README ${field} mismatch: ${row[field]} != ${lesson[field]}`);
    }
  }
  if (!readme.includes(`Batch SHA-256: \`${batch.batch_sha256}\``)) throw new Error('README batch SHA-256 mismatch');
  return rows.size;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const readme = readFileSync(path.join(here, 'README.md'), 'utf8');
  const batch = JSON.parse(readFileSync(path.join(here, 'batch-manifest.json'), 'utf8'));
  const count = checkEvidenceTable(readme, batch);
  if (process.argv.includes('--self-test')) {
    const lesson = batch.lessons.find((item) => item.lesson_id === 'L14');
    if (!lesson) throw new Error('L14 missing from self-test manifest');
    const corrupted = readme.replace(lesson.script_sha256, '0'.repeat(64));
    if (corrupted === readme) throw new Error('Self-test could not locate L14 script SHA-256');
    let rejected = false;
    try { checkEvidenceTable(corrupted, batch); } catch (error) { rejected = /L14 README script_sha256 mismatch/.test(error.message); }
    if (!rejected) throw new Error('README script hash drift was not rejected');
  }
  console.log(`README evidence table: ${count} exact packet/script/candidate bindings pass${process.argv.includes('--self-test') ? '; L14 mutation rejected' : ''}`);
}
