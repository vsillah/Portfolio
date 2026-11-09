#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../..')
const audit=JSON.parse(readFileSync(path.join(here,'audit-boundaries.json'),'utf8'))
const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex')
const composites=[]
for(let n=1;n<=16;n++){
  const id=`L${String(n).padStart(2,'0')}`
  const sourceRow=audit.rows.find(row=>row.scene_id===`${id}-01`)
  const output=path.join(here,'composites',`${id}-illustrated-review.mp4`)
  if(!existsSync(output))throw new Error(`${id}: composite missing`)
  composites.push({lesson_id:id,source_path:sourceRow.video_path,source_sha256:sourceRow.video_sha256,output_path:path.relative(root,output),output_sha256:sha(output),scene_count:8,release_state:'unbound review candidate'})
}
writeFileSync(path.join(here,'composite-receipts.json'),JSON.stringify({schema_version:1,source_commit:audit.source_commit,composites},null,2)+'\n')
console.log(`Finalized ${composites.length} composite receipts`)
