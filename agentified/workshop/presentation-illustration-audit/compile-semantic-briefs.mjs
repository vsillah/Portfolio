#!/usr/bin/env node
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {briefRows} from './semantic-briefs.mjs'

const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../..')
const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex')
const masters=JSON.parse(readFileSync(path.join(here,'master-assets.json'),'utf8')).assets
const crops={
  'L01-04':[900,350,2200,1500], 'L02-04':[950,300,2100,1500],
  'L03-02':[900,350,2200,1500], 'L04-04':[650,500,2300,1600],
  'L05-04':[100,300,2100,1500], 'L06-03':[450,3050,2200,1500],
  'L07-05':[450,1750,2200,1500], 'L08-05':[900,350,2200,1500],
  'L09-02':[950,300,2100,1500], 'L09-04':[450,1050,2200,1500],
  'L10-03':[450,250,2200,1500], 'L11-02':[1750,250,2100,1500],
  'L12-03':[900,350,2200,1500], 'L13-02':[650,2150,2300,1600],
  'L14-03':[1350,700,2100,1500], 'L14-04':[450,1750,2200,1500],
  'L15-04':[950,300,2100,1500], 'L16-04':[650,2150,2300,1600],
  'L16-05':[500,2000,2200,1500],
}
const scenes=[]
for(let n=1;n<=16;n++){
  const id=`L${String(n).padStart(2,'0')}`,rows=briefRows[id]
  assert.equal(rows?.length,8,`${id}: eight manually authored briefs required`)
  const packetPath=path.join(root,`agentified/workshop/scene-production/packets/${id}.json`)
  const packet=JSON.parse(readFileSync(packetPath,'utf8'))
  const master=n===1?{project_path:'agentified/workshop/presentation-illustration-audit/assets/l01-paper-source-table-v1.png',sha256:sha(path.join(here,'assets/l01-paper-source-table-v1.png')),theme:'source notes feed a brief'}:masters.find(item=>item.lesson_id===id)
  assert(master,`${id}: no approved lesson master`)
  rows.forEach((row,index)=>{
    const fields=row.split('|')
    assert.equal(fields.length,6,`${id}-${index+1}: malformed brief`)
    const [headline,oneSecondRead,visualArtifact,treatment,focus,labelText]=fields
    const scene=packet.scenes[index],labels=labelText.split(';').filter(Boolean)
    assert.equal(scene.id,`${id}-${String(index+1).padStart(2,'0')}`)
    assert(headline&&oneSecondRead&&visualArtifact&&treatment&&focus)
    assert(labels.length<=2,`${scene.id}: at most two visible labels`)
    const approved=scene.approved_visuals[0]||null
    assert.equal(Boolean(approved),treatment==='plate',`${scene.id}: approved plate treatment must match source binding`)
    const crop=approved?crops[scene.id]:null
    if(approved)assert(crop,`${scene.id}: missing curated plate crop`)
    scenes.push({scene_id:scene.id,lesson_title:packet.title,headline,concept:headline.replace(/[.!?]$/,''),one_second_read:oneSecondRead,visual_artifact:visualArtifact,treatment,focus,visible_labels:labels,text_budget:{headline_words:10,labels:2,label_words:4,min_font_px:42},accessibility_description:`${oneSecondRead} Visual: ${visualArtifact}`,master_source:{path:master.project_path,sha256:master.sha256,rights:'original generated project-local illustration'},approved_plate:approved?{path:approved.path,sha256:approved.sha256,crop_source_px:crop,rights:'approved for this exact bound Agentified lesson scene'}:null,continuity:{id:`${id}-operating-artifact`,reason:'The same lesson-specific physical work surface is revisited as its job, evidence, decision, exercise, and Operating File develop.'},packet_sha256:sha(packetPath)})
  })
}
writeFileSync(path.join(here,'semantic-briefs.json'),JSON.stringify({schema_version:1,source_commit:'f0931f3860e042507ee5aba83f220eb57cfd3eb5',scenes},null,2)+'\n')
console.log(`Compiled ${scenes.length} scene-specific visual briefs`)
