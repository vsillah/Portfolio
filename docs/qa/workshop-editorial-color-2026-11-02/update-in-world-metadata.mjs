import fs from 'node:fs/promises'
import path from 'node:path'
const root=process.cwd(),qa=path.join(root,'docs/qa/services-theme-speaking-visuals')
const map=JSON.parse(await fs.readFile(path.join(root,'docs/qa/workshop-editorial-color-2026-11-02/source-to-service-visual-map.json'),'utf8'))
const filenames=['asset-inventory.json','generation-source-map.json','service-gallery-audit.json','workshop-casting-matrix.json']
const [inventory,sources,audit,matrix]=await Promise.all(filenames.map(async n=>JSON.parse(await fs.readFile(path.join(qa,n),'utf8'))))
const gallery=JSON.parse(await fs.readFile(path.join(root,'lib/service-concept-gallery.json'),'utf8'))
const alts={
  'ai-strategy-half-day:hero':'Illustrative scene: Two workshop participants review printed Full Discovery Loop steps pinned to a board beside a laptop',
  'ai-strategy-half-day:secondary':'Illustrative scene: Two participants discuss full roadmap bet statements on notes beside a laptop',
  'ai-strategy-full-day:hero':'Illustrative scene: A small group maps Decision Theater roles on wall notes and a meeting notebook beside a laptop',
  'ai-strategy-full-day:secondary':'Illustrative scene: Two participants read a Metrics Ladder excerpt on a held worksheet',
  'ai-strategy-recorded:hero':'Illustrative scene: A learner takes notes beside a laptop displaying the original Accelerated Signals, Alignment, Momentum infographic',
  'ai-strategy-recorded:secondary':'Illustrative scene: A learner compares a Learning Plan excerpt on a printed worksheet and laptop display',
  'accelerated-cohort-workshop:hero':'Illustrative scene: Cohort participants discuss the original Accelerated Signals, Alignment, Momentum infographic on a printed worksheet and handheld reference beside a laptop',
  'accelerated-cohort-workshop:secondary':'Illustrative scene: A learner reads a Learning Roadmap excerpt on a laptop and printed worksheet',
  'product-innovation-workshop:hero':'Illustrative scene: Product workshop participants review a Jobs from Noise excerpt on a handheld reference and printed worksheet beside a laptop',
  'product-innovation-workshop:secondary':'Illustrative scene: A product team discusses a held VisionScope and MarketCraft worksheet',
}
const gen='/Users/vambahsillah/.codex/generated_images/01a19edc-d3f7-77b2-8429-ed7f07b738ca/'
const replacements={
  'ai-strategy-half-day:hero':{file:'exec-434775de-8fd5-4c1c-b60a-8069c8c5d330.png',scene:'Two-person board review of pinned discovery notes',setting:'bright meeting room with a dark pinboard',camera:'candid medium-wide side view',facilitationMode:'facilitated discovery review',deliveryContext:'small in-person group'},
  'ai-strategy-full-day:hero':{file:'exec-b966353e-0e7a-4ab4-83b1-817e0120bcbe.png',scene:'Group maps stakeholder roles on wall notes',setting:'windowed meeting room with participant wall notes',camera:'wide eye-level view',facilitationMode:'facilitated stakeholder mapping',deliveryContext:'in-person group'},
  'ai-strategy-full-day:secondary':{file:'exec-603b701c-6c23-4b7f-990d-eeb11379e1c8.png',scene:'Two colleagues review a held printed worksheet',setting:'windowed meeting room',camera:'candid close view',facilitationMode:'worksheet review',deliveryContext:'in-person pair'},
  'accelerated-cohort-workshop:secondary':{file:'exec-70e02c02-0f9f-4c31-8b2f-70b4a813edc0.png',scene:'Learner reviews a roadmap on laptop and paper',setting:'quiet library workspace',camera:'over-the-shoulder medium view',facilitationMode:'self-directed cohort follow-through',deliveryContext:'recorded or remote preparation'},
  'product-innovation-workshop:secondary':{file:'exec-b0e6a889-2f65-492c-a00e-1463dce623a5.png',scene:'Team discusses a printed product narrative',setting:'bright studio table',camera:'candid medium-wide table view',facilitationMode:'group narrative review',deliveryContext:'in-person group'},
}
for(const row of map.frames){
 const key=`${row.slug}:${row.role}`,alt=alts[key],rep=replacements[key]
 const items=[inventory.find(x=>x.slug===row.slug&&x.role===row.role),sources.generated.find(x=>x.slug===row.slug&&x.role===row.role),audit.find(x=>x.slug===row.slug)?.frames.find(x=>x.role===row.role),matrix.assets.find(x=>x.slug===row.slug&&x.role===row.role)]
 if(items.some(x=>!x))throw Error(`Missing ${key}`)
 for(const item of items){if('alt' in item)item.alt=alt;if(rep){if('source' in item)item.source=gen+rep.file;if('path' in item)item.path=gen+rep.file;for(const f of ['scene','setting','camera','facilitationMode','deliveryContext'])if(f in item)item[f]=rep[f]}}
 if(rep)row.photoOrigin={originalGeneratedImage:gen+rep.file,stagedBasePhoto:row.basePhotoPath,syntheticFictionalScene:true}
 for(const binding of Object.values(gallery))for(const frame of binding.frames||[])if(frame.imageUrl===`/showcases/service-photographic/${row.slug}-${row.role}.jpg`)frame.alt=alt
}
await Promise.all(filenames.map((n,i)=>fs.writeFile(path.join(qa,n),JSON.stringify([inventory,sources,audit,matrix][i],null,2)+'\n')))
await fs.writeFile(path.join(root,'lib/service-concept-gallery.json'),JSON.stringify(gallery,null,2)+'\n')
await fs.writeFile(path.join(root,'docs/qa/workshop-editorial-color-2026-11-02/source-to-service-visual-map.json'),JSON.stringify(map,null,2)+'\n')
