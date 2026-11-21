#!/usr/bin/env node
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import sharp from 'sharp'
import {paddingOverlay} from './padding-overlay.mjs'

const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../../..')
const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex')
const brief=JSON.parse(readFileSync(path.join(root,'agentified/workshop/presentation-illustration-audit/semantic-briefs.json'))).scenes.find(s=>s.scene_id==='L06-01')
const auditScene=JSON.parse(readFileSync(path.join(here,'audit-receipt.json'))).scenes.find(s=>s.sceneId==='L06-01')
const desktop=path.join(here,'frames/illustrated/L06-01.png')
const master=path.join(root,brief.master_source.path)
assert.equal(sha(master),brief.master_source.sha256,'master source drift')
assert.equal(sha(desktop),'9f042b9ec24e1c3a78bc1668775d879d05757aa89e5c4649ee88d18c537b76c1','desktop candidate drift')
const {svg,decisions}=paddingOverlay(brief,auditScene,null,'l06-01-mobile-controls-clear')
const output=path.join(here,'frames/illustrated/L06-01-mobile-controls-clear.png')
const background=await sharp(master).resize(1920,1080,{fit:'cover',position:'centre'}).png().toBuffer()
const frame=await sharp(background).composite([{input:Buffer.from(svg),left:0,top:0}]).png().toBuffer()
writeFileSync(output,frame)
const receipt={schemaVersion:1,status:'rejected_review_only_unbound',sceneId:'L06-01',variant:'mobile_controls_clear',sourcePath:brief.master_source.path,sourceSha256:brief.master_source.sha256,desktopCandidateSha256:sha(desktop),outputPath:path.relative(root,output),outputSha256:sha(output),displayCopy:[brief.headline],paddingDecisions:decisions}
writeFileSync(path.join(here,'l06-01-mobile-controls-clear-candidate.json'),JSON.stringify(receipt,null,2)+'\n')
console.log(JSON.stringify({output:receipt.outputPath,sha256:receipt.outputSha256,panel:decisions[0].box}))
