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
const briefPath=path.join(audit,'semantic-briefs.json')
const renderPath=path.join(audit,'render-semantic-visuals.mjs')
const scenes=JSON.parse(readFileSync(briefPath,'utf8')).scenes
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex')
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
const wrap=(s,max)=>{const lines=[];let line='';for(const word of s.split(/\s+/)){if((line+' '+word).trim().length>max&&line){lines.push(line);line=word}else line=(line+' '+word).trim()}if(line)lines.push(line);return lines}
const textSvg=(value,x,y,size,max,color='#ffffff')=>wrap(value,max).map((line,i)=>`<text x="${x}" y="${y+i*size*1.15}" fill="${color}" font-family="Arial,sans-serif" font-size="${size}" font-weight="700">${esc(line)}</text>`).join('')
async function glyphBounds(svg){
 const {data,info}=await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">${svg}</svg>`)).ensureAlpha().raw().toBuffer({resolveWithObject:true})
 let left=info.width,top=info.height,right=0,bottom=0
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*info.channels+3]){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1)}
 assert(right>left&&bottom>top,'empty text render')
 return {x:left,y:top,width:right-left,height:bottom-top}
}
const box=(kind,value,rect,x,y,size,max)=>({kind,text:value,containerPx:rect,textSpec:{x,y,size,max},lines:wrap(value,max)})
const label=(kind,value,x,y,width)=>box(kind,value,{x,y:y-64,width,height:94},x+28,y,44,Math.floor(width/25))
const plateLabel=(kind,value,x,bottom,width=510)=>{
 const lines=wrap(value,18),height=lines.length*55+38
 return {kind,text:value,containerPx:{x,y:bottom-height,width,height},textSpec:{x:x+28,y:bottom-height+63,size:44,max:18,lineHeight:55},lines}
}
function panels(scene){
 const [a,b]=scene.visible_labels,h=scene.headline,id=scene.scene_id,out=[]
 const add=(kind,rect,x,y,size,max)=>out.push(box(kind,h,rect,x,y,size,max))
 const addLabel=(kind,value,x,y,width)=>{if(value)out.push(label(kind,value,x,y,width))}
 const top=()=>add('headline',{x:48,y:38,width:1510,height:180},92,126,64,40)
 switch(scene.treatment){
  case 'master':if(id!=='L01-01'){add('headline',{x:46,y:624,width:1120,height:335},104,758,72,29);addLabel('label-a',a,1160,790,620)}break
  case 'detail':add('headline',{x:44,y:172,width:690,height:700},94,314,67,19);addLabel('label-a',a,1030,920,690);addLabel('label-b',b,1030,800,690);break
  case 'plate':add('headline',{x:44,y:172,width:690,height:700},94,314,67,19);if(a)out.push(plateLabel('label-a',a,755,930));if(b)out.push(plateLabel('label-b',b,1300,930));break
  case 'boundary':add('headline',{x:42,y:700,width:1560,height:265},95,810,68,42);addLabel('label-a',a,940,360,520);addLabel('label-b',b,940,500,520);break
  case 'hold':if(id==='L13-03')return [];add('headline',{x:62,y:195,width:690,height:625},108,320,66,18);addLabel('label-a',a,875,875,520);break
  case 'choice':top();addLabel('label-a',a,115,820,650);addLabel('label-b',b,1150,820,650);break
  case 'compare':top();addLabel('label-a',a,110,910,710);addLabel('label-b',b,1090,910,710);break
  case 'sequence':top();addLabel('label-a',a,95,865,630);addLabel('label-b',b,1190,865,630);break
  case 'handoff':top();addLabel('label-a',a,120,840,650);addLabel('label-b',b,1145,840,650);break
  case 'file':addLabel('label-a',a,140,650,790);addLabel('label-b',b,140,815,790);break
  case 'worksheet':break
  default:throw new Error(`${id}: unknown treatment ${scene.treatment}`)
 }
 return out
}
const records=[]
for(const scene of scenes){
 const source=path.join(root,scene.master_source.path)
 assert.equal(hash(source),scene.master_source.sha256,`${scene.scene_id}: master source drift`)
 const frame=path.join(audit,'frames/illustrated',`${scene.scene_id}.png`)
 const items=[]
 for(const item of panels(scene)){
  let svg
  if(item.textSpec.lineHeight){const {x,y,size,lineHeight}=item.textSpec;svg=item.lines.map((line,i)=>`<text x="${x}" y="${y+i*lineHeight}" fill="#ffffff" font-family="Arial,sans-serif" font-size="${size}" font-weight="700">${esc(line)}</text>`).join('')}
  else{const {x,y,size,max}=item.textSpec;svg=textSvg(item.text,x,y,size,max)}
  const g=await glyphBounds(svg),r=item.containerPx
  const padding={left:g.x-r.x,top:g.y-r.y,right:r.x+r.width-g.x-g.width,bottom:r.y+r.height-g.y-g.height}
  items.push({...item,glyphBoundsPx:g,effectivePaddingPx:padding,disposition:Object.values(padding).some(v=>v<0)?'stop-clipping':Object.values(padding).some(v=>v>48)?'candidate':'retain'})
 }
 const special=scene.scene_id==='L01-01'?'separate-approved-proposal':scene.scene_id==='L13-03'?'already-corrected-unbound':scene.treatment==='worksheet'?'functional-writing-area':null
 records.push({sceneId:scene.scene_id,lessonId:scene.scene_id.slice(0,3),treatment:scene.treatment,sourceMaster:{path:scene.master_source.path,sha256:scene.master_source.sha256},sourceFrame:{path:path.relative(root,frame),sha256:hash(frame)},approvedPlate:!!scene.approved_plate,special,panels:items})
}
const summary={scenes:records.length,panels:records.reduce((n,r)=>n+r.panels.length,0),candidatePanels:records.reduce((n,r)=>n+r.panels.filter(p=>p.disposition==='candidate').length,0),clippingPanels:records.reduce((n,r)=>n+r.panels.filter(p=>p.disposition==='stop-clipping').length,0)}
const receipt={schemaVersion:1,status:'audit-only; no learner media changed',briefSha256:hash(briefPath),rendererSha256:hash(renderPath),
 crossPrCaptionClearance:{pr:1293,head:'c746b96d6076d20f0e605be4ffc7aee7b36b9ddc',scene:'L06-03',
  finding:'At the exact stacked code head, L06-03 desktop captions use an external band below the video; the source learner MP4 and VTT remain unchanged.',
  sourceVideoSha256:'163e01e6eb8f1a014b7155b40063bc2b6fa3546fc6bc4329579775581e6f9ef3',
  sourceCaptionSha256:'018418cc1d4bf2333ed6525f1926b8b052f57677a136976e42c80c8f703c69ba',
  relationship:'read-only qualification dependency; no branch restack or learner binding'},summary,scenes:records}
writeFileSync(path.join(here,'audit-receipt.json'),JSON.stringify(receipt,null,2)+'\n')
console.log(JSON.stringify(summary))
