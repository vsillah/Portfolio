const fs=require('node:fs')
const path=require('node:path')
const sharp=require('sharp')
const root=path.resolve(__dirname,'../..')
const catalog=JSON.parse(fs.readFileSync(path.join(root,'docs/showcase-audit/services-catalog-2026-10-23.json'),'utf8')).rows
const manifest=JSON.parse(fs.readFileSync(path.join(root,'lib/service-concept-gallery.json'),'utf8'))
const pairs=[
 ['Accelerated Cohort Workshop','accelerated-cohort-workshop'],
 ['Product Innovation Workshop','product-innovation-workshop'],
 ['Speaking Engagement','speaking-engagement'],
 ['Management Consulting','management-consulting'],
 ['AI Strategy Workshop — Half-Day','ai-strategy-half-day'],
 ['AI Strategy Workshop — Full-Day','ai-strategy-full-day'],
 ['1-on-1 AI Coaching','one-on-one-ai-coaching'],
 ['Group AI Coaching','group-ai-coaching'],
 ['Team AI Training — 3-Session Program','team-ai-training-three-session'],
 ['Premium AI Masterclass','premium-ai-masterclass'],
 ['AI Strategy Workshop — Recorded (Self-Paced)','recorded-ai-strategy-workshop'],
 ['Group Implementation Program — 6 Weeks','group-implementation-six-weeks'],
 ['AI Training Library — Recorded Access','ai-training-library'],
]
async function main(){
 if(pairs.length!==13||new Set(pairs.map(([t])=>t)).size!==13)throw Error('Learning coverage changed')
 const directory=path.join(root,'public/showcases/service-learning-review')
 const html=fs.readFileSync(path.join(directory,'review.html'),'utf8')
 for(const [title,slug] of pairs){
   const row=catalog.find(item=>item.title===title)
   if(!row)throw Error(`Missing exact active catalog title: ${title}`)
   if(manifest[row.id]?.frames?.some(frame=>frame.imageUrl.includes('/service-learning-review/')))throw Error(`Review asset activated before Captain pass: ${title}`)
   if(!html.includes(slug))throw Error(`Review page omitted ${slug}`)
   const images=['hero','artifact'].map(kind=>fs.readFileSync(path.join(directory,`${slug}-${kind}-review-r1.webp`)))
   if(images[0].equals(images[1]))throw Error(`Duplicate frames: ${title}`)
   for(const image of images){
     if(image.length<12000)throw Error(`Suspiciously small frame: ${title}`)
     const meta=await sharp(image).metadata()
     if(meta.width!==1200||meta.height!==720||meta.format!=='webp')throw Error(`Wrong frame geometry: ${title}`)
   }
 }
 const sheet=await sharp(path.join(root,'docs/showcase-audit/qa/services/service-learning-review-contact-sheet.png')).metadata()
 if(sheet.width!==1600||sheet.height!==1890)throw Error('Wrong contact sheet geometry')
 if(!html.includes('data-width="1280"')||!html.includes('data-width="768"')||!html.includes('data-width="390"'))throw Error('Responsive review controls missing')
 console.log('Verified 13 exact-title learning review pairs, 26 distinct frames, inactive gallery status, responsive preview, and contact sheet.')
}
main().catch(err=>{console.error(err);process.exitCode=1})
