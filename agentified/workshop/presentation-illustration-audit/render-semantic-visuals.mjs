#!/usr/bin/env node
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import sharp from 'sharp'

const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../..')
const briefs=JSON.parse(readFileSync(path.join(here,'semantic-briefs.json'),'utf8')).scenes
const cropSafety=JSON.parse(readFileSync(path.join(here,'crop-safety.json'),'utf8'))
const safetyById=new Map(cropSafety.scenes.map(scene=>[scene.scene_id,scene]))
assert.equal(safetyById.size,cropSafety.scenes.length,'duplicate crop-safety scene')
assert.equal(safetyById.size,briefs.filter(scene=>scene.approved_plate).length,'every approved plate needs crop safety')
const plateOnly=process.argv.includes('--plate-only')
const existing=plateOnly?new Map(JSON.parse(readFileSync(path.join(here,'visual-receipts.json'),'utf8')).frames.map(frame=>[frame.scene_id,frame])):new Map()
const out=path.join(here,'frames/illustrated');mkdirSync(out,{recursive:true})
const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex')
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
const lineWrap=(s,max)=>{const words=s.split(/\s+/),lines=[];let line='';for(const word of words){if((line+' '+word).trim().length>max&&line){lines.push(line);line=word}else line=(line+' '+word).trim()}if(line)lines.push(line);return lines}
const text=(s,x,y,size,max=24,color='#fff4df',weight=700)=>lineWrap(s,max).map((line,i)=>`<text x="${x}" y="${y+i*size*1.15}" fill="${color}" font-family="Arial,sans-serif" font-size="${size}" font-weight="${weight}">${esc(line)}</text>`).join('')
const rect=(x,y,w,h,fill,stroke='none',radius=20)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`
const label=(s,x,y,w=520)=>`${rect(x,y-64,w,94,'#0b2635ee','#cba854',16)}${text(s,x+28,y,44,Math.floor(w/25),'#f7ebd5')}`
const plateLabel=(s,x,bottom,w=510)=>{const lines=lineWrap(s,18),h=lines.length*55+38;return `${rect(x,bottom-h,w,h,'#0b2635','#cba854',16)}${lines.map((line,i)=>`<text x="${x+28}" y="${bottom-h+63+i*55}" fill="#f7ebd5" font-family="Arial,sans-serif" font-size="44" font-weight="700">${esc(line)}</text>`).join('')}`}
function plateEdgeMask(scene){
  const [x,y,w,h]=cropSafety.rendered_plate_px,[left,top,right,bottom]=scene.insets_px,f=cropSafety.feather_px
  assert(left+right+2*f<w&&top+bottom+2*f<h,`${scene.scene_id}: crop safety leaves no core`)
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><defs><linearGradient id="left"><stop stop-color="#071b2a"/><stop offset="1" stop-color="#071b2a" stop-opacity="0"/></linearGradient><linearGradient id="right"><stop stop-color="#071b2a" stop-opacity="0"/><stop offset="1" stop-color="#071b2a"/></linearGradient><linearGradient id="top" x2="0" y2="1"><stop stop-color="#071b2a"/><stop offset="1" stop-color="#071b2a" stop-opacity="0"/></linearGradient><linearGradient id="bottom" x2="0" y2="1"><stop stop-color="#071b2a" stop-opacity="0"/><stop offset="1" stop-color="#071b2a"/></linearGradient></defs><rect x="${x}" y="${y}" width="${left}" height="${h}" fill="#071b2a"/><rect x="${x+left}" y="${y}" width="${f}" height="${h}" fill="url(#left)"/><rect x="${x+w-right-f}" y="${y}" width="${f}" height="${h}" fill="url(#right)"/><rect x="${x+w-right}" y="${y}" width="${right}" height="${h}" fill="#071b2a"/><rect x="${x}" y="${y}" width="${w}" height="${top}" fill="#071b2a"/><rect x="${x}" y="${y+top}" width="${w}" height="${f}" fill="url(#top)"/><rect x="${x}" y="${y+h-bottom-f}" width="${w}" height="${f}" fill="url(#bottom)"/><rect x="${x}" y="${y+h-bottom}" width="${w}" height="${bottom}" fill="#071b2a"/></svg>`)
}
const progress=id=>{const n=Number(id.slice(-2));return `${rect(80,1020,1760,11,'#24424f','none',6)}${rect(80,1020,Math.round(1760*n/8),11,'#d7ad56','none',6)}`}
const baseOverlay=(id)=>`<rect width="1920" height="1080" fill="none" stroke="#d6ad56" stroke-width="3"/>${progress(id)}`
const topBand=(headline)=>`${rect(48,38,1510,180,'#071b2ae8','none',18)}${text(headline,92,126,64,40)}`
const leftPanel=(headline)=>`${rect(44,172,690,700,'#071b2af2','#d6ad56',22)}${text(headline,94,314,67,19)}`
const bottomPanel=(headline)=>`${rect(42,700,1560,265,'#071b2af0','#d6ad56',22)}${text(headline,95,810,68,42)}`
const focusPos={full:{position:'centre',scale:1},left:{position:'left',scale:1.35},center:{position:'centre',scale:1.35},right:{position:'right',scale:1.35},top:{position:'north',scale:1.35},middle:{position:'centre',scale:1.5},bottom:{position:'south',scale:1.35}}
async function photo(file,focus){const spec=focusPos[focus]||focusPos.full;if(spec.scale===1)return sharp(file).resize(1920,1080,{fit:'cover',position:spec.position}).png().toBuffer();const w=Math.round(1920*spec.scale),h=Math.round(1080*spec.scale);const large=await sharp(file).resize(w,h,{fit:'cover',position:spec.position}).png().toBuffer();const x=spec.position==='left'?0:spec.position==='right'?w-1920:Math.round((w-1920)/2);const y=spec.position==='north'?0:spec.position==='south'?h-1080:Math.round((h-1080)/2);return sharp(large).extract({left:x,top:y,width:1920,height:1080}).png().toBuffer()}
function overlay(brief){
  const [a,b]=brief.visible_labels,headline=brief.headline
  let body=''
  switch(brief.treatment){
    case 'master':body=`${rect(46,624,1120,335,'#071b2aeb','#d6ad56',22)}${text(headline,104,758,72,29)}${a?label(a,1160,790,620):''}`;break
    case 'detail':body=`${leftPanel(headline)}${a?label(a,1030,920,690):''}${b?label(b,1030,800,690):''}`;break
    case 'boundary':body=`${bottomPanel(headline)}<path d="M1550 240V880" stroke="#d2a45f" stroke-width="18" stroke-linecap="round"/>${a?label(a,940,360,520):''}${b?label(b,940,500,520):''}`;break
    case 'hold':body=`${rect(62,195,690,625,'#101f2cf2','#dfad66',24)}${text(headline,108,320,66,18)}<circle cx="1370" cy="560" r="170" fill="#092636dc" stroke="#d2a45f" stroke-width="17"/>${text('HOLD',1245,590,72,10,'#f3dfba')}${a?label(a,875,875,520):''}`;break
    case 'choice':body=`${topBand(headline)}${a?label(a,115,820,650):''}${b?label(b,1150,820,650):''}`;break
    case 'compare':body=`${topBand(headline)}<path d="M960 250V960" stroke="#d8b261" stroke-width="10"/>${a?label(a,110,910,710):''}${b?label(b,1090,910,710):''}`;break
    case 'sequence':body=`${topBand(headline)}<circle cx="565" cy="550" r="112" fill="none" stroke="#d6ae59" stroke-width="12"/><circle cx="1030" cy="550" r="112" fill="none" stroke="#d6ae59" stroke-width="12"/><circle cx="1495" cy="550" r="112" fill="none" stroke="#d6ae59" stroke-width="12"/>${a?label(a,95,865,630):''}${b?label(b,1190,865,630):''}`;break
    case 'handoff':body=`${topBand(headline)}${a?label(a,120,840,650):''}${b?label(b,1145,840,650):''}<path d="M760 876H1130" stroke="#d6ae59" stroke-width="9" stroke-linecap="round"/>`;break
    case 'worksheet':body=`${rect(525,105,1260,850,'#f3e7cf','#c59f55',18)}${text(headline,615,235,66,33,'#17303b')}<path d="M615 295H1695" stroke="#d4ad61" stroke-width="6"/>${a?text(a,650,430,52,21,'#17303b'):''}${rect(635,465,1060,145,'#e3e8df','#b9c5c0',12)}${b?text(b,650,705,52,21,'#17303b'):''}${rect(635,742,1060,145,'#e3e8df','#b9c5c0',12)}`;break
    case 'file':body=brief.scene_id.endsWith('-08')
      ? `${rect(70,135,930,820,'#f0e1c4','#d6ad56',18)}${rect(125,197,820,105,'#d9b663','none',8)}${text('OPERATING FILE',165,266,48,23,'#17303b')}${text(headline,140,390,58,20,'#17303b')}${a?label(a,140,650,790):''}${b?label(b,140,815,790):''}`
      : `${rect(615,135,1120,820,'#f0e1c4','#d6ad56',18)}${rect(680,197,990,105,'#d9b663','none',8)}${text('OPERATING FILE',720,266,48,28,'#17303b')}${text(headline,695,390,62,28,'#17303b')}${a?label(a,730,570,860):''}${b?label(b,730,735,860):''}`;break
    case 'plate':body=`${leftPanel(headline)}${a?plateLabel(a,755,930):''}${b?plateLabel(b,1300,930):''}`;break
    default:throw new Error(`${brief.scene_id}: unknown treatment ${brief.treatment}`)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">${baseOverlay(brief.scene_id)}${body}</svg>`
}
const receipts=[]
for(const brief of briefs){
  if(plateOnly&&!brief.approved_plate){const prior=existing.get(brief.scene_id);assert(prior,`${brief.scene_id}: no prior unmodified frame`);receipts.push(prior);continue}
  const output=path.join(out,`${brief.scene_id}.png`),master=path.join(root,brief.master_source.path)
  assert.equal(sha(master),brief.master_source.sha256,`${brief.scene_id}: master source changed`)
  let background,sourcePath=brief.master_source.path,sourceSha=brief.master_source.sha256,renderedPlate=null
  if(brief.scene_id==='L01-01'){
    const original=path.join(here,'frames/l01-01-corrected-proposal.png')
    background=readFileSync(original)
  }else if(brief.approved_plate){
    const safety=safetyById.get(brief.scene_id);assert(safety,`${brief.scene_id}: missing crop-safety receipt`)
    const source=path.join(root,brief.approved_plate.path),[left,top,width,height]=brief.approved_plate.crop_source_px
    assert.equal(sha(source),brief.approved_plate.sha256,`${brief.scene_id}: approved plate changed`)
    const m=await sharp(source).metadata();assert(left>=0&&top>=0&&left+width<=m.width&&top+height<=m.height)
    const crop=await sharp(source).extract({left,top,width,height}).resize(1280,850,{fit:'cover'}).png().toBuffer()
    const mask=plateEdgeMask(safety)
    background=await sharp({create:{width:1920,height:1080,channels:3,background:'#071b2a'}}).composite([{input:crop,left:600,top:130},{input:mask,left:0,top:0}]).png().toBuffer()
    sourcePath=brief.approved_plate.path;sourceSha=brief.approved_plate.sha256;renderedPlate={x:600,y:130,width:1280,height:850,source_crop_px:brief.approved_plate.crop_source_px,crop_safety:{insets_px:safety.insets_px,feather_px:cropSafety.feather_px,focus:safety.focus,edge_risk:safety.edge_risk,mask_sha256:createHash('sha256').update(mask).digest('hex')}}
  }else{
    background=await photo(master,brief.focus)
    if(brief.treatment==='compare'){
      const left=await photo(master,'left'),right=await photo(master,'right')
      background=await sharp({create:{width:1920,height:1080,channels:3,background:'#071b2a'}}).composite([{input:await sharp(left).extract({left:0,top:0,width:960,height:1080}).png().toBuffer(),left:0,top:0},{input:await sharp(right).extract({left:960,top:0,width:960,height:1080}).png().toBuffer(),left:960,top:0}]).png().toBuffer()
    }
    if(brief.treatment==='worksheet'||brief.treatment==='file')background=await sharp(background).modulate({brightness:.55,saturation:.7}).png().toBuffer()
  }
  const final=brief.scene_id==='L01-01'?background:await sharp(background).composite([{input:Buffer.from(overlay(brief)),left:0,top:0}]).png().toBuffer()
  writeFileSync(output,final)
  receipts.push({scene_id:brief.scene_id,frame_path:path.relative(root,output),frame_sha256:sha(output),visual_family:`${brief.continuity.id}:${brief.treatment}:${brief.focus}`,source_path:sourcePath,source_sha256:sourceSha,source_rights:brief.approved_plate?brief.approved_plate.rights:brief.master_source.rights,approved_plate_rendered_px:renderedPlate,display_copy:brief.scene_id==='L01-01'?['A suggestion needs a source.','Harbor Learning Circle']:[brief.headline,...brief.visible_labels],accessibility_text:brief.accessibility_description,continuity:brief.continuity,one_second_read:brief.one_second_read,brief_sha256:createHash('sha256').update(JSON.stringify(brief)).digest('hex')})
}
writeFileSync(path.join(here,'visual-receipts.json'),JSON.stringify({schema_version:2,source_commit:'f0931f3860e042507ee5aba83f220eb57cfd3eb5',frames:receipts},null,2)+'\n')
console.log(`Rendered ${plateOnly?briefs.filter(scene=>scene.approved_plate).length:receipts.length} concept-bound scene visuals`)
