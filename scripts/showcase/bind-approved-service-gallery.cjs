// Bind only the Captain-approved review pairs to exact active service records.
// Current database image URLs remain untouched; changed records fail closed.
const fs=require('node:fs')
const path=require('node:path')
const root=path.resolve(__dirname,'../..')
const catalog=JSON.parse(fs.readFileSync(path.join(root,'docs/showcase-audit/services-catalog-2026-10-23.json'),'utf8')).rows
const manifestPath=path.join(root,'lib/service-concept-gallery.json')
const current=JSON.parse(fs.readFileSync(manifestPath,'utf8'))
const calibrationIds=[
  'd1d32ad7-5cb6-4d6c-8f15-d9ccf24f9e78',
  'a479ce70-4856-4d3f-917b-c37bfff1f0a2',
  'e5c198bd-1276-45ee-abe3-9d9f85e1e3d2',
]
for(const id of calibrationIds) if(!current[id]?.frames || current[id].frames.length!==2) throw new Error(`Approved calibration missing: ${id}`)
const entries=[
  // Digital systems: Julie's first frame is the local KinFlo-built example; its second frame is a proposal.
  ['Website UX Refresh','digital','website-ux-refresh','KinFlo-built Julie’s Family Learning homepage with the learning support headline','KinFlo-built Julie homepage beside an illustrative learner, supporter, and handoff proposal','workflow'],
  ['Mobile App Generation','digital','mobile-app-generation','illustrative mobile service request with a three-step intake','illustrative mobile request preview and human handoff journey','product-in-use'],
  ['RAG Knowledge Base System','digital','rag-knowledge-base','illustrative sourced answer beside approved knowledge documents','illustrative answer review with citation, held source, and human approval state','workflow'],
  ['Data Migration & Onboarding','digital','data-migration-onboarding','illustrative source-to-target field map with a held exception','illustrative migration reconciliation board with source counts and review decision','workflow'],
  ['Custom API / ERP Integrations','digital','custom-api-erp-integrations','illustrative intake event moving through validation toward an ERP','illustrative integration event trace with payload checks and replay hold','workflow'],
  ['Custom Reporting & Analytics Dashboard','digital','custom-reporting-dashboard','illustrative inquiry metric and trend with source access','illustrative reporting dashboard with metric definition, trend, and drill-down','product-in-use'],
  ['Shared Analytics Dashboard','digital','shared-analytics-dashboard','illustrative team scorecard with named measure owners','illustrative shared analytics scorecard and Friday decision cadence','product-in-use'],
  // Learning and facilitation.
  ['Accelerated Cohort Workshop','learning','accelerated-cohort-workshop','illustrative accelerated cohort working session','illustrative cohort work product and next action','product-in-use'],
  ['Product Innovation Workshop','learning','product-innovation-workshop','illustrative product innovation working session','illustrative product opportunity work product','product-in-use'],
  ['Speaking Engagement','learning','speaking-engagement','illustrative speaking stage and audience question','illustrative talk arc and audience handoff','product-in-use'],
  ['Management Consulting','learning','management-consulting','illustrative management consulting decision scene','illustrative consulting decision and ownership work product','product-in-use'],
  ['AI Strategy Workshop — Half-Day','learning','ai-strategy-half-day','illustrative half-day AI strategy working session','illustrative half-day AI strategy output','product-in-use'],
  ['AI Strategy Workshop — Full-Day','learning','ai-strategy-full-day','illustrative full-day AI strategy working session','illustrative full-day AI strategy output','product-in-use'],
  ['1-on-1 AI Coaching','learning','one-on-one-ai-coaching','illustrative individual AI coaching scene','illustrative individual coaching action plan','product-in-use'],
  ['Group AI Coaching','learning','group-ai-coaching','illustrative group coaching question board and peer evidence check','illustrative group coaching work product','product-in-use'],
  ['Team AI Training — 3-Session Program','learning','team-ai-training-three-session','illustrative team AI training session','illustrative three-session team training plan','product-in-use'],
  ['Premium AI Masterclass','learning','premium-ai-masterclass','illustrative AI masterclass build session','illustrative masterclass work product and review','product-in-use'],
  ['AI Strategy Workshop — Recorded (Self-Paced)','learning','recorded-ai-strategy-workshop','illustrative recorded AI strategy workshop poster','illustrative self-paced strategy workbook; no playable recording is bound','course-preview poster'],
  ['Group Implementation Program — 6 Weeks','learning','group-implementation-six-weeks','illustrative six-week group implementation scene','illustrative six-week implementation work plan','product-in-use'],
  ['AI Training Library — Recorded Access','learning','ai-training-library','illustrative AI training library browse view','illustrative training library index; no playable video is bound','course-preview poster'],
  // Continuity and support.
  ['Implementation Warranty','continuity','implementation-warranty','illustrative warranty issue intake with coverage boundary','illustrative warranty coverage register and verification trail','workflow'],
  ['Enterprise SLA','continuity','enterprise-sla','illustrative service desk severity and clock rules','illustrative SLA operating sheet with contract-defined targets','workflow'],
  ['Priority Support Channel','continuity','priority-support-channel','illustrative priority support thread with named owner','illustrative support request and escalation view','workflow'],
  ['Pre-Built Chatbot Template — Self-Install','continuity','chatbot-self-install','illustrative self-install chatbot configuration and fallback','illustrative chatbot setup and test kit','product-in-use'],
  ['Community Forum Access','continuity','community-forum-access','illustrative moderated peer discussion thread','illustrative forum topic map and moderation guide','product-in-use'],
  ['30-Day Email Support','continuity','thirty-day-email-support','illustrative setup question during a 30-day support window','illustrative 30-day email support ledger','product-in-use'],
  ['60-Day Email Support','continuity','sixty-day-email-support','illustrative repeat team question during a 60-day support window','illustrative 60-day adoption follow-through','product-in-use'],
  // Engagement and communication.
  ['AI Customer Support Chatbot','engagement','customer-support-chatbot','illustrative support chatbot conversation with human handoff','illustrative sourced answer and escalation map','workflow'],
  ['AI Voice Agent — Inbound','engagement','voice-agent-inbound','illustrative inbound call console with human transfer rule','illustrative inbound call routing sheet and silence fallback','workflow'],
  ['Lead Generation Workflow Agent','engagement','lead-generation-workflow','illustrative lead intake with transparent fit and review path','illustrative lead qualification and routing map','workflow'],
  ['Social Media Content Agent','engagement','social-media-content-agent','illustrative social post draft held for editorial approval','illustrative content review card with source and publish gate','workflow'],
  ['Client Onboarding Automation','engagement','client-onboarding-automation','illustrative client onboarding status with buyer input pending','illustrative onboarding handoff board with blocked-state rule','workflow'],
  ['Inbound Lead Tracking System','engagement','inbound-lead-tracking','illustrative inquiry queue with sources and next owners','illustrative lead queue and source trace','product-in-use'],
  ['Website Development','engagement','website-development','illustrative website page with service and contact paths','illustrative website build review board with phone and accessibility checks','product-in-use'],
  ['AI Email Sequence Builder','engagement','ai-email-sequence-builder','illustrative email sequence trigger and stop rules','illustrative three-message sequence map with consent exit','workflow'],
  ['Lead Tracking Templates','engagement','lead-tracking-templates','illustrative lead sheet with source, owner, and status rows','illustrative lead tracker workbook columns and review guide','product-in-use'],
  ['Content Automation Templates','engagement','content-automation-templates','illustrative source-backed content brief held before publishing','illustrative content brief, draft, and review template pack','product-in-use'],
  ['AI Email Sequence Templates','engagement','ai-email-sequence-templates','illustrative personalized email template draft held for review','illustrative editable email template pack and consent checks','product-in-use'],
]
if(entries.length!==38||new Set(entries.map(row=>row[0])).size!==38) throw new Error('Approved review coverage changed')
const byTitle=new Map(catalog.map(row=>[row.title,row]))
const manifest={...current}
for(const [title,family,slug,heroDescription,artifactDescription,artifactRole] of entries){
  const row=byTitle.get(title)
  if(!row?.is_active||calibrationIds.includes(row.id)) throw new Error(`Invalid new binding: ${title}`)
  const frame=(kind,description,role,status)=>{
    const imageUrl=`/showcases/service-${family}-review/${slug}-${kind}-review-r1.webp`
    if(!fs.existsSync(path.join(root,'public',imageUrl))) throw new Error(`Missing reviewed frame: ${imageUrl}`)
    return {imageUrl,alt:`${title}: ${description}`,role,status}
  }
  const julie=title==='Website UX Refresh'
  const julieHero='/showcases/service-digital-review/website-ux-refresh-kinflo-built-example-r1.jpg'
  if(julie&&!fs.existsSync(path.join(root,'public',julieHero))) throw new Error('Missing KinFlo-built Julie source capture')
  manifest[row.id]={
    expectedCurrentUrl:row.image_url,
    calibration:'2026-10-23-captain-approved-review',
    frames:[
      julie?{imageUrl:julieHero,alt:`${title}: ${heroDescription}`,role:'hero',status:'built example',label:"Example: Julie's Family Learning"}:frame('hero',heroDescription,'hero','illustrative concept'),
      frame('artifact',artifactDescription,artifactRole,julie?'illustrative proposal':'illustrative concept'),
    ],
  }
}
if(Object.keys(manifest).length!==41) throw new Error('Active gallery coverage must be 41')
for(const id of calibrationIds) if(JSON.stringify(manifest[id])!==JSON.stringify(current[id])) throw new Error(`Calibration changed: ${id}`)
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n')
console.log('Bound 38 Captain-approved review pairs alongside 3 unchanged calibrations, exact-ID and exact-source.')
