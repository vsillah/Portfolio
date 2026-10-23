const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const root = path.resolve(__dirname, '../..')
const catalog = JSON.parse(fs.readFileSync(path.join(root,'docs/showcase-audit/services-catalog-2026-10-23.json'),'utf8')).rows
const pairs = [
  ['Website UX Refresh','website-ux-refresh'],
  ['Mobile App Generation','mobile-app-generation'],
  ['RAG Knowledge Base System','rag-knowledge-base'],
  ['Data Migration & Onboarding','data-migration-onboarding'],
  ['Custom API / ERP Integrations','custom-api-erp-integrations'],
  ['Custom Reporting & Analytics Dashboard','custom-reporting-dashboard'],
  ['Shared Analytics Dashboard','shared-analytics-dashboard'],
]
async function verify(){
  if (pairs.length !== 7 || new Set(pairs.map(([title])=>title)).size !== 7) throw new Error('Digital review title coverage changed')
  const dir=path.join(root,'public/showcases/service-digital-review')
  for(const [title,slug] of pairs){
    if(!catalog.some(row=>row.title===title)) throw new Error(`No exact active catalog row: ${title}`)
    const files=['hero','artifact'].map(kind=>path.join(dir,`${slug}-${kind}-review-r1.webp`))
    if(files.some(file=>!fs.existsSync(file))) throw new Error(`Missing frame: ${title}`)
    const [a,b]=files.map(file=>fs.readFileSync(file))
    if(a.equals(b)) throw new Error(`Duplicate pair: ${title}`)
    for(const bytes of [a,b]){
      if(bytes.length<12000) throw new Error(`Suspiciously small frame: ${title}`)
      const meta=await sharp(bytes).metadata()
      if(meta.width!==1200||meta.height!==720||meta.format!=='webp') throw new Error(`Wrong frame geometry: ${title}`)
    }
  }
  const html=fs.readFileSync(path.join(dir,'review.html'),'utf8')
  for(const [,slug] of pairs) if(!html.includes(slug)) throw new Error(`Preview omitted ${slug}`)
  const sheet=path.join(root,'docs/showcase-audit/qa/services/service-digital-review-contact-sheet.png')
  const meta=await sharp(sheet).metadata()
  if(meta.width!==1600||meta.height!==1080) throw new Error('Wrong contact-sheet geometry')
  console.log('Verified 7 exact-title digital review pairs, 14 distinct frames, preview, and contact sheet.')
}
verify().catch(err=>{console.error(err);process.exitCode=1})
