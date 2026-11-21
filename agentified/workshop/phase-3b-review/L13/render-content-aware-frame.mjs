#!/usr/bin/env node
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import sharp from 'sharp'
const here=path.dirname(fileURLToPath(import.meta.url))
const root=path.resolve(here,'../../../..')
const audit=path.join(root,'agentified/workshop/presentation-illustration-audit')
const brief=JSON.parse(readFileSync(path.join(audit,'semantic-briefs.json'),'utf8')).scenes.find(scene=>scene.scene_id==='L13-03')
assert(brief && brief.treatment==='hold' && brief.headline==='Leave the baseline unknown.')
const source=path.join(root,brief.master_source.path)
const sha=buffer=>createHash('sha256').update(buffer).digest('hex')
assert.equal(sha(readFileSync(source)),brief.master_source.sha256)
const original=path.join(audit,'frames/illustrated/L13-03.png')
const receipt=JSON.parse(readFileSync(path.join(audit,'visual-receipts.json'),'utf8')).frames.find(frame=>frame.scene_id==='L13-03')
assert.equal(sha(readFileSync(original)),receipt.frame_sha256)
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
const lineWrap=(s,max)=>{const words=s.split(/\s+/),lines=[];let line='';for(const word of words){if((line+' '+word).trim().length>max&&line){lines.push(line);line=word}else line=(line+' '+word).trim()}if(line)lines.push(line);return lines}
const text=(s,x,y,size,max=24,color='#fff4df',weight=700)=>lineWrap(s,max).map((line,i)=>`<text x="${x}" y="${y+i*size*1.15}" fill="${color}" font-family="Arial,sans-serif" font-size="${size}" font-weight="${weight}">${esc(line)}</text>`).join('')
const rect=(x,y,w,h,fill,stroke='none',radius=20)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`
const label=(s,x,y,w=520)=>`${rect(x,y-64,w,94,'#0b2635ee','#cba854',16)}${text(s,x+28,y,44,Math.floor(w/25),'#f7ebd5')}`
const progress=id=>{const n=Number(id.slice(-2));return `${rect(80,1020,1760,11,'#24424f','none',6)}${rect(80,1020,Math.round(1760*n/8),11,'#d7ad56','none',6)}`}
const baseOverlay=id=>`<rect width="1920" height="1080" fill="none" stroke="#d6ad56" stroke-width="3"/>${progress(id)}`
const holdBody=(compact)=>{
 const [a]=brief.visible_labels,headline=brief.headline
 const lines=lineWrap(headline,18)
 const height=compact?Math.round(lines.length*66*1.15+100):625
 const baseline=compact?195+50+66:320
 return `${rect(62,195,690,height,'#101f2cf2','#dfad66',24)}${text(headline,108,baseline,66,18)}<circle cx="1370" cy="560" r="170" fill="#092636dc" stroke="#d2a45f" stroke-width="17"/>${text('HOLD',1245,590,72,10,'#f3dfba')}${a?label(a,875,875,520):''}`
}
const overlay=compact=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">${baseOverlay(brief.scene_id)}${holdBody(compact)}</svg>`)
const large=await sharp(source).resize(2592,1458,{fit:'cover',position:'centre'}).png().toBuffer()
const background=await sharp(large).extract({left:336,top:189,width:1920,height:1080}).png().toBuffer()
const render=async compact=>sharp(background).composite([{input:overlay(compact),left:0,top:0}]).png().toBuffer()
const reproduced=await render(false)
assert.equal(sha(reproduced),receipt.frame_sha256,'original source frame did not reproduce byte for byte')
const candidate=await render(true)
const output=path.join(here,'L13-03-content-aware.png')
writeFileSync(output,candidate)
console.log(JSON.stringify({originalFrameSha256:receipt.frame_sha256,candidateFrameSha256:sha(candidate),headline:brief.headline,sourceMasterSha256:brief.master_source.sha256,originalPanel:{x:62,y:195,width:690,height:625},candidatePanel:{x:62,y:195,width:690,height:Math.round(lineWrap(brief.headline,18).length*66*1.15+100)},output}))
