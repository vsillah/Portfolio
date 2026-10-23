const fs=require('node:fs')
const path=require('node:path')
const crypto=require('node:crypto')
const sharp=require('sharp')
const root=path.resolve(__dirname,'../..')
const catalog=JSON.parse(fs.readFileSync(path.join(root,'docs/showcase-audit/services-catalog-2026-10-23.json'),'utf8')).rows
const groups={
  continuity:[
    ['Implementation Warranty','implementation-warranty'],['Enterprise SLA','enterprise-sla'],
    ['Priority Support Channel','priority-support-channel'],['Pre-Built Chatbot Template — Self-Install','chatbot-self-install'],
    ['Community Forum Access','community-forum-access'],['30-Day Email Support','thirty-day-email-support'],
    ['60-Day Email Support','sixty-day-email-support']
  ],
  engagement:[
    ['AI Customer Support Chatbot','customer-support-chatbot'],['AI Voice Agent — Inbound','voice-agent-inbound'],
    ['Lead Generation Workflow Agent','lead-generation-workflow'],['Social Media Content Agent','social-media-content-agent'],
    ['Client Onboarding Automation','client-onboarding-automation'],['Inbound Lead Tracking System','inbound-lead-tracking'],
    ['Website Development','website-development'],['AI Email Sequence Builder','ai-email-sequence-builder'],
    ['Lead Tracking Templates','lead-tracking-templates'],['Content Automation Templates','content-automation-templates'],
    ['AI Email Sequence Templates','ai-email-sequence-templates']
  ]
}
const reviewed=new Set([
  'Monthly Advisory Retainer','AI Inbound Lead Chatbot','AI Training Course — Self-Paced',
  'Website UX Refresh','Mobile App Generation','RAG Knowledge Base System','Data Migration & Onboarding',
  'Custom API / ERP Integrations','Custom Reporting & Analytics Dashboard','Shared Analytics Dashboard',
  'Accelerated Cohort Workshop','Product Innovation Workshop','Speaking Engagement','Management Consulting',
  'AI Strategy Workshop — Half-Day','AI Strategy Workshop — Full-Day','1-on-1 AI Coaching','Group AI Coaching',
  'Team AI Training — 3-Session Program','Premium AI Masterclass','AI Strategy Workshop — Recorded (Self-Paced)',
  'Group Implementation Program — 6 Weeks','AI Training Library — Recorded Access'
])
async function verify(){
  const remaining=Object.values(groups).flat().map(([title])=>title)
  const active=catalog.filter(row=>row.is_active).map(row=>row.title)
  if(active.length!==41||remaining.length!==18||new Set(remaining).size!==18) throw new Error('Unexpected service coverage')
  if(active.filter(title=>!reviewed.has(title)).sort().join('|')!==remaining.slice().sort().join('|')) throw new Error('Remaining services do not match active catalog complement')
  const manifest=fs.readFileSync(path.join(root,'lib/service-concept-gallery.json'),'utf8')
  const hashes=new Set()
  for(const [family,offers] of Object.entries(groups)){
    const dir=path.join(root,`public/showcases/service-${family}-review`)
    const html=fs.readFileSync(path.join(dir,'review.html'),'utf8')
    for(const key of ['data-width="1280"','data-width="768"','data-width="390"','aria-pressed','not active in the service gallery']) if(!html.includes(key)) throw new Error(`Missing preview control or boundary: ${family}/${key}`)
    for(const [title,slug] of offers){
      if(!html.includes(title)||!html.includes(slug)) throw new Error(`Preview omits ${title}`)
      if(manifest.includes(`service-${family}-review/`)) throw new Error(`${family} review bound to active gallery`)
      for(const kind of ['hero','artifact']){
        const file=path.join(dir,`${slug}-${kind}-review-r1.webp`)
        const bytes=fs.readFileSync(file)
        if(bytes.length<12000) throw new Error(`Small frame: ${file}`)
        const meta=await sharp(bytes).metadata()
        if(meta.width!==1200||meta.height!==720||meta.format!=='webp') throw new Error(`Frame geometry: ${file}`)
        const hash=crypto.createHash('sha256').update(bytes).digest('hex')
        if(hashes.has(hash)) throw new Error(`Duplicate frame: ${file}`)
        hashes.add(hash)
      }
    }
    const sheet=path.join(root,`docs/showcase-audit/qa/services/service-${family}-review-contact-sheet.png`)
    const meta=await sharp(sheet).metadata()
    if(meta.width!==1600||meta.height!==Math.ceil(offers.length*2/4)*270) throw new Error(`Contact sheet geometry: ${family}`)
  }
  console.log('Verified all 18 remaining active service titles, 36 distinct review frames, inactive gallery status, responsive pages, and both contact sheets.')
}
verify().catch(err=>{console.error(err);process.exitCode=1})
