// Provider-free AmaduTown service calibration. Run from the repository root:
// node scripts/showcase/render-service-calibration.cjs
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('@playwright/test')
const sharp = require('sharp')

const root = path.resolve(__dirname, '../..')
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'docs/showcase-audit/services-catalog-2026-10-23.json'))).rows
const imageDir = path.join(root, 'public/showcases/service-calibration')
const qaDir = path.join(root, 'docs/showcase-audit/qa/services')
fs.mkdirSync(imageDir, { recursive: true })
fs.mkdirSync(qaDir, { recursive: true })
const logo = fs.readFileSync(path.join(root, 'public/amadutown-logo-upscaled.png')).toString('base64')
const receptionist = fs.readFileSync(path.join(imageDir, 'sources/chatbot-receptionist-source.png')).toString('base64')
const roundtable = fs.readFileSync(path.join(imageDir, 'sources/training-roundtable-source.png')).toString('base64')
const inter = fs.readFileSync(path.join(root, 'public/fonts/inter-latin-variable.ttf')).toString('base64')
const logoTag = (className='shield') => `<img class="${className}" src="data:image/png;base64,${logo}" alt="AmaduTown shield">`

const css = `
@font-face{font-family:Inter;src:url(data:font/ttf;base64,${inter}) format('truetype');font-weight:100 900}
*{box-sizing:border-box}html,body{margin:0;width:1200px;height:720px;overflow:hidden}body{font-family:Inter,Arial,sans-serif;color:#EAECEE}
.frame{position:relative;width:1200px;height:720px;overflow:hidden;background:#121E31}.frame *{position:relative}
.serif{font-family:Georgia,'Times New Roman',serif;font-weight:400;letter-spacing:-.045em}
.shield{display:block;width:auto;height:82px;object-fit:contain}.brandline{display:flex;align-items:center;gap:17px}.brandline span{font-size:17px;letter-spacing:.17em;font-weight:700;text-transform:uppercase;line-height:1.45}
.eyebrow{font-size:15px;letter-spacing:.22em;font-weight:800;text-transform:uppercase}.gold{color:#D4AF37}.rule{height:2px;background:#D4AF37}
.footer{position:absolute!important;left:52px;right:52px;bottom:30px;display:flex;justify-content:space-between;font-size:12px;letter-spacing:.13em;text-transform:uppercase;opacity:.78;z-index:10}
.footer.dark{color:#2C3E50}

.advisory-cover{background:radial-gradient(circle at 76% 45%,#39485b 0,#121E31 46%,#0d1726 100%);padding:45px 58px}
.advisory-cover .brandline{margin-bottom:90px}.advisory-cover .kicker{color:#D4AF37;margin-bottom:18px}
.advisory-cover h1{font-size:76px;line-height:1.03;width:710px;margin:0 0 26px}.advisory-cover p{font-size:23px;line-height:1.4;width:550px;margin:0;color:#d7dce4}
.advisory-cover .goldrail{position:absolute;left:56px;bottom:105px;width:425px;height:3px;background:#D4AF37}
.advisory-cover .paper{position:absolute;right:48px;top:143px;width:348px;height:455px;transform:rotate(7deg);background:#f4f1e9;color:#121E31;padding:32px;box-shadow:0 25px 50px #0008;border-top:9px solid #D4AF37}
.advisory-cover .paper small{font-size:11px;letter-spacing:.18em;font-weight:800}.advisory-cover .paper h2{font-family:Georgia,serif;font-size:37px;line-height:1.05;margin:35px 0 20px}.advisory-cover .paper p{font-size:16px;line-height:1.4;width:auto;color:#2C3E50;margin:0}.advisory-cover .paper .paper-rule{height:1px;background:#c6b98f;margin:26px 0}.advisory-cover .paper b{display:block;font-size:12px;letter-spacing:.11em;margin-top:18px}.advisory-cover .paper .fill{font-size:15px;margin-top:10px}

.advisory-brief{background:#f2efe7;color:#121E31;padding:40px 54px}.advisory-brief:before{content:'';position:absolute;left:0;top:0;bottom:0;width:23px;background:#D4AF37}.advisory-brief .top{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #121E31;padding-bottom:20px}.advisory-brief .top .shield{height:64px}.advisory-brief .top .brandline span{font-size:13px}.advisory-brief h1{font-size:64px;line-height:1;margin:36px 0 10px}.advisory-brief .dek{font-size:21px;line-height:1.35;width:870px;margin:0 0 24px;color:#3f4d5d}.advisory-brief .brief-grid{display:grid;grid-template-columns:310px 1fr;gap:22px;margin-top:26px}.advisory-brief .brief-grid>div{border-top:3px solid #D4AF37;padding-top:17px}.advisory-brief .brief-grid small{display:block;font-size:13px;letter-spacing:.14em;font-weight:800;text-transform:uppercase;color:#7a6025;margin-bottom:12px}.advisory-brief .brief-grid p{font-size:22px;line-height:1.3;margin:0}.advisory-brief .brief-grid .decision{font-family:Georgia,serif;font-size:31px;letter-spacing:-.025em;line-height:1.12}.advisory-brief .next{margin-top:32px;display:flex;gap:30px;align-items:center;background:#121E31;color:#f6f3e9;padding:17px 22px;font-size:17px}.advisory-brief .next b{color:#D4AF37;letter-spacing:.08em;text-transform:uppercase;font-size:13px;white-space:nowrap}

 .lead-cover{background:#101b2c;color:#f4f2ed}
.lead-cover .scene-photo{position:absolute;left:0;top:0;width:715px;height:720px;object-fit:cover;object-position:31% center}
.lead-cover .scene-shade{position:absolute;left:0;top:0;width:715px;height:720px;background:linear-gradient(90deg,#101b2c00 78%,#101b2c 100%)}
.lead-cover .panel{position:absolute;right:0;top:0;width:505px;height:720px;padding:40px 48px 42px;background:linear-gradient(125deg,#17283f,#0d1829)}
.lead-cover .brandline .shield{height:64px}.lead-cover .brandline span{font-size:12px}
.lead-cover .eyebrow{color:#D4AF37;margin:65px 0 18px}
.lead-cover h1{font-size:58px;line-height:1.03;margin:0 0 26px;letter-spacing:-.05em}
.lead-cover p{font-size:20px;line-height:1.38;color:#dce0e3;margin:0}
.lead-cover .deliver{margin-top:25px;padding-top:20px;border-top:2px solid #D4AF37;font-size:15px;line-height:1.38;letter-spacing:.03em;color:#f2cf67}
.lead-cover .footer{left:760px;right:45px;bottom:22px;font-size:11px}

.lead-workspace{background:#e8ecee;color:#121E31}
.lead-workspace .nav{position:absolute;left:0;top:0;bottom:0;width:230px;background:#121E31;color:#e9edf1;padding:28px 22px}
.lead-workspace .nav .shield{height:58px}.lead-workspace .nav .brandline{gap:9px}.lead-workspace .nav .brandline span{font-size:9px;letter-spacing:.12em}
.lead-workspace .nav h2{font-family:Georgia,serif;font-size:28px;line-height:1.05;margin:67px 0 19px}
.lead-workspace .nav .nav-item{padding:13px 10px;border-left:3px solid transparent;font-size:15px;color:#bdc7d2}
.lead-workspace .nav .nav-item.active{background:#283b53;border-color:#D4AF37;color:white}
.lead-workspace .nav .nav-note{position:absolute;bottom:34px;left:26px;right:24px;font-size:13px;line-height:1.4;color:#bdc7d2}
.lead-workspace .area{position:absolute;left:230px;right:0;top:0;bottom:0;padding:27px 36px}
.lead-workspace .top{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #b7c0c7;padding-bottom:14px}
.lead-workspace .top h1{font-family:Georgia,serif;font-size:42px;line-height:1;margin:0 0 0 118px}
.lead-workspace .top small{color:#72591f;font-size:12px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}
.lead-workspace .steps{display:flex;align-items:center;gap:9px;margin:20px 0 23px}
.lead-workspace .steps span{background:#d5dce1;color:#2c3e50;padding:9px 12px;font-size:13px;font-weight:800;white-space:nowrap}
.lead-workspace .steps span.active{background:#D4AF37;color:#121E31}
.lead-workspace .steps i{height:2px;width:16px;background:#9ca8b2}
.lead-workspace .panes{display:grid;grid-template-columns:1.05fr .95fr;gap:23px}
.lead-workspace .pane{background:#f8f7f2;border:1px solid #cbd1d3;min-height:430px;box-shadow:0 10px 20px #121e3112}
.lead-workspace .pane-head{background:#e8e8e1;border-bottom:1px solid #c6cccd;padding:14px 19px;display:flex;justify-content:space-between;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.lead-workspace .pane-head em{font-style:normal;color:#806115}
.lead-workspace .chat{padding:19px}.lead-workspace .bubble{padding:13px 16px;font-size:18px;line-height:1.32;max-width:94%;margin-bottom:14px;border-radius:10px}
.lead-workspace .bubble.visitor{background:#e4e8e9}.lead-workspace .bubble.bot{background:#17283f;color:#f5f2e8;margin-left:auto}
.lead-workspace .chat .field-label{font-size:11px;letter-spacing:.12em;font-weight:800;color:#806115;margin:14px 0 5px}
.lead-workspace .chat .field{font-size:17px;border-bottom:1px solid #adb8bf;padding-bottom:8px}
.lead-workspace .summary{padding:18px 20px}.lead-workspace .summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px 17px}
.lead-workspace .summary-grid div{min-height:56px}.lead-workspace .summary b{display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#806115;margin-bottom:7px}.lead-workspace .summary span{font-size:17px;line-height:1.24}
.lead-workspace .handoff-rule{background:#121E31;color:white;margin-top:16px;padding:14px 16px;font-size:16px;line-height:1.3;border-left:5px solid #D4AF37}
.lead-workspace .followup{margin-top:14px;font-size:14px;line-height:1.28;color:#394c5b}
.lead-workspace .footnote{position:absolute;left:36px;right:36px;bottom:17px;border-top:1px solid #b7c0c7;padding-top:9px;font-size:12px;color:#536475;letter-spacing:.04em}

.course-cover{background:#121E31;color:#f3f2eb}
.course-cover .scene-photo{position:absolute;right:0;top:0;width:690px;height:720px;object-fit:cover;object-position:49% center}
.course-cover .scene-shade{position:absolute;right:0;top:0;width:690px;height:720px;background:linear-gradient(90deg,#121E31 0%,#121E3100 18%)}
.course-cover .panel{position:absolute;left:0;top:0;width:545px;height:720px;padding:40px 52px;background:linear-gradient(120deg,#17283f,#0d1829)}
.course-cover .brandline .shield{height:64px}.course-cover .brandline span{font-size:12px}
.course-cover .eyebrow{margin:66px 0 18px}
.course-cover h1{font-size:60px;line-height:1.03;margin:0 0 23px}
.course-cover p{font-size:20px;line-height:1.38;color:#dfe3e7;margin:0}
.course-cover .deliver{margin-top:28px;padding-top:19px;border-top:2px solid #D4AF37;color:#f2cf67;font-size:16px;line-height:1.35}
.course-cover .footer{left:52px;right:700px;bottom:20px;font-size:11px}

.course-platform{background:#e9ecee;color:#121E31}
.course-platform .side{position:absolute;left:0;top:0;bottom:0;width:290px;background:#121E31;color:#f0f0ea;padding:28px 22px}
.course-platform .side .shield{height:57px}.course-platform .side .brandline span{font-size:10px}.course-platform .side .brandline{gap:10px}
.course-platform .side h2{font-family:Georgia,serif;font-size:30px;line-height:1.07;margin:47px 0 8px}.course-platform .side .sub{color:#c7d2dc;font-size:13px;margin-bottom:24px}
.course-platform .module{padding:12px 11px;border-left:3px solid transparent;font-size:16px;line-height:1.22;color:#d3dce4}
.course-platform .module b{display:block;color:#D4AF37;font-size:11px;letter-spacing:.12em;margin-bottom:4px}
.course-platform .module.active{background:#2b4059;border-color:#D4AF37;color:white}
.course-platform .side .side-note{position:absolute;bottom:32px;left:25px;right:25px;color:#c7d2dc;font-size:12px;line-height:1.35}
.course-platform .area{position:absolute;left:290px;right:0;top:0;bottom:0;padding:27px 33px}
.course-platform .top{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #aebbc3;padding-bottom:13px}
.course-platform .top h1{font-family:Georgia,serif;font-size:41px;line-height:1;margin:0 0 0 205px}
.course-platform .top small{color:#806115;font-size:12px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}
.course-platform .progress{display:flex;align-items:center;gap:13px;margin:17px 0 19px;font-size:14px;font-weight:700}
.course-platform .progress .bar{width:230px;height:9px;background:#c7cdd0}.course-platform .progress .bar i{display:block;width:50%;height:100%;background:#D4AF37}
.course-platform .course-grid{display:grid;grid-template-columns:1.35fr .85fr;gap:21px}
.course-platform .video{height:365px;background:#16273c;color:#f4f1e7;overflow:hidden}
.course-platform .video img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 33%;opacity:.75}
.course-platform .video .video-shade{position:absolute;inset:0;background:linear-gradient(0deg,#101a2af2,#101a2a08 62%)}
.course-platform .video .video-label{position:absolute;left:22px;top:18px;background:#121E31d9;padding:8px 11px;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
.course-platform .video .video-title{position:absolute;left:22px;right:25px;bottom:44px;font-family:Georgia,serif;font-size:34px;line-height:1.04}
.course-platform .video .video-note{position:absolute;left:22px;bottom:15px;font-size:12px;color:#ead991}
.course-platform .lesson-caption{background:#f8f7f2;border:1px solid #cbd1d3;padding:15px 18px;font-size:16px;line-height:1.3}
.course-platform .workbook-card{height:465px;background:#f8f7f2;border-top:7px solid #D4AF37;padding:20px 22px;box-shadow:0 9px 18px #121e3112}
.course-platform .workbook-card small{font-size:12px;letter-spacing:.13em;color:#806115;font-weight:800;text-transform:uppercase}
.course-platform .workbook-card h2{font-family:Georgia,serif;font-size:35px;line-height:1.05;margin:14px 0 16px}
.course-platform .workbook-card p{font-size:17px;line-height:1.32;margin:0 0 17px}
.course-platform .workbook-card .line{height:1px;background:#adb4b4;margin:18px 0}
.course-platform .workbook-card .output{background:#121E31;color:white;padding:13px 15px;font-size:15px;line-height:1.3}
.course-platform .footnote{position:absolute;left:33px;right:33px;bottom:18px;border-top:1px solid #aebbc3;padding-top:9px;font-size:12px;color:#526373}
`


const assets = [
  {id:'d1d32ad7-5cb6-4d6c-8f15-d9ccf24f9e78',slug:'monthly-advisory',role2:'product-in-use',alt1:'AmaduTown Monthly Advisory cover with a focused decision brief',alt2:'AmaduTown Monthly Decision Brief with an illustrative ownership question',hero:`<main class="frame advisory-cover"><div class="brandline">${logoTag()}<span>AmaduTown<br>Advisory Solutions</span></div><div class="content"><div class="eyebrow kicker">Monthly advisory</div><h1 class="serif">Keep the decisions<br>moving.</h1><p>Build a monthly rhythm around one decision, its owner, and the next review.</p><div class="goldrail"></div></div><aside class="paper"><small>THE MONTHLY DECISION BRIEF</small><h2>One question.<br>A useful answer.</h2><p>Give the next meeting a decision someone can carry forward.</p><div class="paper-rule"></div><b>ON THE TABLE</b><div class="fill">What needs an owner this month?</div><b>IN THE ROOM</b><div class="fill">The people who can make the call.</div></aside><div class="footer"><span>Management consulting / monthly advisory</span><span>Illustrative offer view</span></div></main>`,artifact:`<main class="frame advisory-brief"><div class="top"><div class="brandline">${logoTag()}<span>AmaduTown<br>Advisory Solutions</span></div><div class="eyebrow">Monthly advisory / decision brief</div></div><h1 class="serif">Monthly Decision Brief</h1><p class="dek">A short working page for the decisions that keep getting pushed to the next meeting.</p><div class="brief-grid"><div><small>The question</small><p class="decision">Who owns the first response to a new inquiry?</p></div><div><small>What the team needs to settle</small><p>Choose one owner for the first reply, define when to hand off, and agree where an unanswered request is recorded.</p></div><div><small>Why now</small><p>Work moves between inboxes when ownership is unclear.</p></div><div><small>What leaves the meeting</small><p>An owner, a handoff rule, and a date to check what happened.</p></div></div><div class="next"><b>Next monthly review</b><span>Bring three real inquiries and test whether the handoff held.</span></div><div class="footer dark"><span>Illustrative scenario / no client data</span><span>AmaduTown Advisory Solutions</span></div></main>`},
  {
    id:'a479ce70-4856-4d3f-917b-c37bfff1f0a2',
    slug:'inbound-lead-chatbot',
    role2:'workflow',
    alt1:'Friendly humanoid chatbot receptionist at a desktop with headset, introducing configured website lead intake',
    alt2:'Illustrative inbound lead workspace showing website inquiry, qualification, summary, human handoff, and consent-bound follow-up',
    hero:`<main class="frame lead-cover"><img class="scene-photo" src="data:image/png;base64,${receptionist}" alt=""><div class="scene-shade"></div><div class="panel"><div class="brandline">${logoTag()}<span>AmaduTown<br>Advisory Solutions</span></div><div class="eyebrow">AI inbound lead chatbot</div><h1 class="serif">Your website asks. Your team gets the brief.</h1><p>We configure the chat widget, qualification questions, lead summary, and human handoff for incoming inquiries.</p><div class="deliver">You receive a defined intake flow, routing rules, and a reviewable handoff.</div></div><div class="footer"><span>Illustrative offer view</span></div></main>`,
    artifact:`<main class="frame lead-workspace"><aside class="nav"><div class="brandline">${logoTag()}<span>AmaduTown<br>Advisory Solutions</span></div><h2>Inbound lead<br>workspace</h2><div class="nav-item active">Inquiry &amp; chat</div><div class="nav-item">Qualification</div><div class="nav-item">Human handoff</div><div class="nav-item">Follow-up rules</div><div class="nav-note">Configured for your website, questions, owner roles, and approved contact channels.</div></aside><section class="area"><div class="top"><h1>From inquiry to owner</h1><small>Illustrative product flow</small></div><div class="steps"><span>1 Website inquiry</span><i></i><span>2 Qualify</span><i></i><span class="active">3 Lead summary</span><i></i><span>4 Human handoff</span><i></i><span>5 Bounded follow-up</span></div><div class="panes"><div class="pane"><div class="pane-head"><span>Website conversation</span><em>Sample, no personal data</em></div><div class="chat"><div class="bubble visitor">“Can your team help us organize new client inquiries?”</div><div class="bubble bot">“What kind of inquiries are you handling, and who should review the summary?”</div><div class="field-label">QUALIFICATION FIELD / NEED</div><div class="field">Track and route new-client questions</div><div class="field-label">QUALIFICATION FIELD / TIMELINE</div><div class="field">Discuss at the next planning call</div></div></div><div class="pane"><div class="pane-head"><span>Lead summary</span><em>Human review required</em></div><div class="summary"><div class="summary-grid"><div><b>Request</b><span>New-client intake support</span></div><div><b>Fit question</b><span>Which inbox owns the first reply?</span></div><div><b>Permission</b><span>Confirm contact consent</span></div><div><b>Owner</b><span>Client success lead</span></div></div><div class="handoff-rule">Handoff: send a concise brief to the named owner for review.</div><div class="followup"><b>Bounded follow-up</b> Only through an approved channel, after permission and human review. No autonomous outreach implied.</div></div></div></div><div class="footnote">Buyer receives: configured widget + qualification flow + summary fields + routing and follow-up rules. Concept screen; no live deployment claim.</div></section></main>`
  },
  {
    id:'e5c198bd-1276-45ee-abe3-9d9f85e1e3d2',
    slug:'self-paced-ai-course',
    role2:'course-preview poster',
    alt1:'Vambah-led roundtable training scene introducing the AmaduTown self-paced AI course concept',
    alt2:'Illustrative self-paced course platform with modules, lesson-video poster, workbook exercise, progress, and implementation-plan output',
    hero:`<main class="frame course-cover"><img class="scene-photo" src="data:image/png;base64,${roundtable}" alt=""><div class="scene-shade"></div><div class="panel"><div class="brandline">${logoTag()}<span>AmaduTown<br>Advisory Solutions</span></div><div class="eyebrow gold">AI Training Course / Self-Paced</div><h1 class="serif">Learn with Vambah. Build a plan your team can use.</h1><p>Work through a real workflow, test the evidence, and decide where human judgment belongs.</p><div class="deliver">Video lessons, guided exercises, and a bounded implementation plan.</div></div><div class="footer"><span>Illustrative course view / preview video pending</span></div></main>`,
    artifact:`<main class="frame course-platform"><aside class="side"><div class="brandline">${logoTag()}<span>AmaduTown<br>Advisory Solutions</span></div><h2>AI Training<br>Course</h2><div class="sub">Self-paced / proposed module view</div><div class="module"><b>MODULE 01</b>Choose a real workflow</div><div class="module active"><b>MODULE 02</b>Evaluate the evidence</div><div class="module"><b>MODULE 03</b>Keep human judgment</div><div class="module"><b>MODULE 04</b>Bound the implementation</div><div class="side-note">Illustrative curriculum and progress state; syllabus approval pending.</div></aside><section class="area"><div class="top"><h1>Learn. Practice. Apply.</h1><small>Sample learner view</small></div><div class="progress"><span>Illustrative progress / 2 of 4 modules</span><div class="bar"><i></i></div></div><div class="course-grid"><div><div class="video"><img src="data:image/png;base64,${roundtable}" alt=""><div class="video-shade"></div><div class="video-label">Lesson 02 / video poster</div><div class="video-title">What evidence would make this answer useful?</div><div class="video-note">Poster only / no playable video bound</div></div><div class="lesson-caption">Use one team workflow. Compare the AI answer with the source material before anyone acts.</div></div><div class="workbook-card"><small>Guided workbook / exercise 02</small><h2>Map the decision.</h2><p><b>Workflow:</b> Choose one repeated task with a real owner.</p><div class="line"></div><p><b>Evidence:</b> Record what would prove the answer is correct.</p><div class="line"></div><p><b>Human check:</b> Name who reviews it and when.</p><div class="output">Course output: a bounded plan your team can test, review, and revise.</div></div></div><div class="footnote">Course concept only. Proposed modules, illustrative learner progress, and lesson-video poster; syllabus and playable video remain pending.</div></section></main>`
  },
]

async function main(){
  const browser=await chromium.launch({headless:true})
  const page=await browser.newPage({viewport:{width:1200,height:720},deviceScaleFactor:1})
  const manifest={}
  const tiles=[]
  for(const [index,asset] of assets.entries()){
    const row=catalog.find(item=>item.id===asset.id)
    if(!row||row.image_url) throw new Error(`Calibration source mismatch: ${asset.id}`)
    const frames=[]
    for(const [frameIndex,kind] of ['hero','artifact'].entries()){
      await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body>${asset[kind]}</body></html>`)
      await page.evaluate(()=>document.fonts.ready)
      const bytes=await page.screenshot()
      const version=asset.slug==='monthly-advisory'?'':'-product-calibration-r2'
      const name=`${asset.slug}-${kind}${version}.webp`
      await sharp(bytes).webp({quality:91,effort:6}).toFile(path.join(imageDir,name))
      tiles.push({input:await sharp(bytes).resize(600,360).png().toBuffer(),left:index*600,top:frameIndex*360})
      frames.push({imageUrl:`/showcases/service-calibration/${name}`,alt:kind==='hero'?asset.alt1:asset.alt2,role:kind==='hero'?'hero':asset.role2,status:'illustrative concept'})
    }
    manifest[asset.id]={expectedCurrentUrl:row.image_url,calibration:'2026-10-23-brand-reset',frames}
  }
  await sharp({create:{width:1800,height:720,channels:3,background:'#121E31'}}).composite(tiles).png().toFile(path.join(qaDir,'service-calibration-contact-sheet.png'))
  fs.writeFileSync(path.join(root,'lib/service-concept-gallery.json'),JSON.stringify(manifest,null,2)+'\n')
  await browser.close()
  process.stdout.write('Rendered three AmaduTown calibration pairs and contact sheet.\n')
}
main().catch(error=>{console.error(error);process.exitCode=1})
