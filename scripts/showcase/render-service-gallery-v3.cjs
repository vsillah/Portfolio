// Provider-free, editable compositions for the 41 public service records.
// Render: node scripts/showcase/render-service-gallery-v3.cjs
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('@playwright/test')
const sharp = require('sharp')

const root = path.resolve(__dirname, '../..')
const rows = JSON.parse(fs.readFileSync(path.join(root, 'docs/showcase-audit/services-catalog-2026-10-23.json'))).rows
const specs = JSON.parse(fs.readFileSync(path.join(__dirname, 'service-concept-specs.json')))
const font = fs.readFileSync(path.join(root, 'public/fonts/inter-latin-variable.ttf')).toString('base64')
const outDir = path.join(root, 'public/showcases/service-gallery-v3')
fs.mkdirSync(outDir, { recursive: true })

const modes = [
  'comparison', 'cohort', 'source', 'source', 'stage', 'conversation', 'report', 'source',
  'pipeline', 'editorial', 'onboarding', 'crm', 'source', 'website', 'email', 'knowledge',
  'agenda', 'facilitation', 'advisory', 'coaching', 'circle', 'curriculum', 'warranty',
  'sla', 'triage', 'mapping', 'integration', 'analytics', 'course', 'studio', 'recorded',
  'setup', 'milestones', 'library', 'forum', 'support30', 'support60', 'spreadsheet',
  'kanban', 'sharedanalytics', 'templates',
]
const alternateModes = [
  'report','facilitation','studio','conversation','agenda','crm','advisory','conversation',
  'crm','kanban','setup','analytics','website','comparison','templates','mapping',
  'facilitation','report','report','advisory','coaching','facilitation','triage',
  'support30','sla','integration','mapping','sharedanalytics','curriculum','report',
  'agenda','conversation','studio','course','curriculum','triage','advisory','crm',
  'editorial','analytics','email',
]
if (modes.length !== 41 || alternateModes.length !== 41) throw new Error('Service art direction must cover all 41 records')
if (modes.some((mode,index)=>mode===alternateModes[index])) throw new Error('A service cannot repeat the same composition mode in both frames')

const themes = [
  ['#f7ede1','#263f4a','#f47857','#e3bf9a'], ['#182a2e','#f9eee0','#f2b064','#6e9a9a'],
  ['#eee4dc','#273947','#d09e68','#dce9e6'], ['#183944','#eff5ee','#95d2c0','#f7c993'],
  ['#f7e9de','#402c3e','#d46671','#f6bd8a'], ['#102e2c','#f3f7eb','#b2df9f','#eabd84'],
  ['#e9eef2','#26364f','#7599d8','#c5b8e7'], ['#24373a','#f4eee2','#e6be88','#a7ccc5'],
  ['#f4e3d2','#423a38','#e78c5c','#d4bcb1'], ['#e7f1ed','#21443f','#6eac98','#e8ba83'],
  ['#f1ebf7','#373049','#af8ed5','#e3bdcf'], ['#192e43','#f6eee2','#7ec4d6','#edab8a'],
]
const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[character])

function scene(mode, spec, index) {
  const [a,b,c] = spec.steps.map(escape)
  const artifact = escape(spec.artifact)
  const sceneTag = `<span class="scene-tag">${escape(mode.replace(/[0-9]/g,' ').toUpperCase())} / EXAMPLE</span>`
  switch (mode) {
    case 'comparison': return `${sceneTag}<div class="browser before"><small>BEFORE</small><div class="bars"><i></i><i></i><i></i></div><div class="blank-call"></div></div><div class="browser after"><small>AFTER / CONCEPT</small><h3>One clear next step</h3><p>${b}</p><span class="cta">Review the path →</span></div>`
    case 'cohort': return `${sceneTag}<div class="cohort-route"><div><b>01</b>${a}</div><div><b>02</b>${b}</div><div><b>03</b>${c}</div></div><div class="cohort-center">COHORT<br/>BUILD LAB</div>`
    case 'stage': return `${sceneTag}<div class="spotlight left"></div><div class="spotlight right"></div><div class="stage-deck"><div class="mic"></div><span>QUESTION → MODEL → ACTION</span></div>`
    case 'conversation': return `${sceneTag}<div class="conversation-app"><div class="app-top">INBOUND INQUIRY <span>review queue</span></div><p class="talk visitor">${a}</p><p class="talk assistant">${b}</p><p class="talk reviewer">${c}</p></div>`
    case 'report': return `${sceneTag}<div class="report-page"><span>DECISION BRIEF / EXAMPLE</span><h3>${artifact}</h3><div class="report-columns"><p><b>OBSERVE</b>${a}</p><p><b>CHOOSE</b>${b}</p><p><b>ASSIGN</b>${c}</p></div></div>`
    case 'pipeline': return `${sceneTag}<div class="pipeline-grid"><div class="node start"><b>01</b>${a}</div><div class="line"></div><div class="node mid"><b>02</b>${b}</div><div class="line"></div><div class="node end"><b>03</b>${c}</div></div><div class="pipeline-bot">HUMAN REVIEW AT THE HANDOFF</div>`
    case 'editorial': return `${sceneTag}<div class="editorial-board"><div class="editorial-head">CONTENT REVIEW · EXAMPLE</div><div class="editorial-col"><small>SOURCE</small>${a}</div><div class="editorial-col"><small>DRAFT</small>${b}</div><div class="editorial-col"><small>APPROVAL</small>${c}</div></div>`
    case 'onboarding': return `${sceneTag}<div class="onboard-window"><header>WELCOME PATH <span>EXAMPLE</span></header><div class="onboard-left"><b>01</b><b>02</b><b>03</b></div><div class="onboard-content"><h3>Start here.</h3><p>${a}</p><p>${b}</p><p>${c}</p></div></div>`
    case 'crm': return `${sceneTag}<div class="crm-window"><header>LEAD REVIEW / SAMPLE DATA</header><div class="crm-table"><div>INQUIRY <span>NEED</span><span>NEXT ACTION</span></div><div>Example A <span>${a}</span><span>${c}</span></div><div>Example B <span>${b}</span><span>Review</span></div></div></div>`
    case 'website': return `${sceneTag}<div class="web-window"><header><i></i><i></i><i></i><span>WEBSITE STUDY</span></header><div class="web-nav">HOME &nbsp; ABOUT &nbsp; SERVICES</div><div class="web-hero"><h3>A useful path<br/>through the page.</h3><p>${b}</p><div class="web-button">Explore service →</div></div></div>`
    case 'email': return `${sceneTag}<div class="mail-editor"><div class="mail-side">AUDIENCE<br/>DRAFT<br/>REVIEW</div><div class="mail-body"><small>SEQUENCE 01 / EXAMPLE</small><h3>${a}</h3><div class="subject">SUBJECT: A practical next step</div><p>${b}</p><div class="approval">${c}</div></div></div>`
    case 'knowledge': return `${sceneTag}<div class="knowledge-window"><header>ANSWER WITH A SOURCE</header><div class="question">How does this process work?</div><div class="answer">Draft response for review.<br/><small>Source excerpt 01 · Source excerpt 02</small></div><div class="citation">${b} · ${c}</div></div>`
    case 'agenda': return `${sceneTag}<div class="agenda-sheet"><small>WORKING AGENDA / EXAMPLE</small><h3>${index===16?'Half-day':'Full-day'} lab</h3><div><b>01</b>${a}</div><div><b>02</b>${b}</div><div><b>03</b>${c}</div></div>`
    case 'facilitation': return `${sceneTag}<div class="facilitation-board"><div class="fac-title">THREE SESSIONS / PRACTICE</div><div class="sticky first">${a}</div><div class="sticky second">${b}</div><div class="sticky third">${c}</div><div class="fac-note">Team working board · illustrative</div></div>`
    case 'advisory': return `${sceneTag}<div class="advisory-page"><small>MONTHLY REVIEW / EXAMPLE</small><h3>Decisions in motion</h3><div class="advisory-ring">01</div><div class="advisory-items"><p>${a}</p><p>${b}</p><p>${c}</p></div></div>`
    case 'coaching': return `${sceneTag}<div class="coaching-desk"><div class="coaching-note"><small>1:1 PRACTICE / EXAMPLE</small><h3>One task.<br/>One next step.</h3><p>${a}</p><p>${b}</p><p>${c}</p></div><div class="pen"></div></div>`
    case 'circle': return `${sceneTag}<div class="circle-board"><div class="circle-orbit one"></div><div class="circle-orbit two"></div><div class="circle-core">PEER<br/>PRACTICE</div><div class="circle-label a">${a}</div><div class="circle-label b">${b}</div><div class="circle-label c">${c}</div></div>`
    case 'curriculum': return `${sceneTag}<div class="curriculum"><div class="curriculum-header">TEAM TRAINING / THREE SESSIONS</div><div class="curriculum-chapter"><b>01</b>${a}</div><div class="curriculum-chapter"><b>02</b>${b}</div><div class="curriculum-chapter"><b>03</b>${c}</div></div>`
    case 'warranty': return `${sceneTag}<div class="warranty-flow"><div class="warranty-badge">COVERAGE<br/>REVIEW</div><div><b>01 / SCOPE</b>${a}</div><div><b>02 / ISSUE</b>${b}</div><div><b>03 / REMEDY</b>${c}</div></div>`
    case 'sla': return `${sceneTag}<div class="sla-table"><header>SERVICE LEVEL OUTLINE · EXAMPLE</header><div><b>WINDOW</b><span>${a}</span></div><div><b>TRIAGE</b><span>${b}</span></div><div><b>ESCALATION</b><span>${c}</span></div><small>Terms require agreement.</small></div>`
    case 'triage': return `${sceneTag}<div class="triage-console"><header>SUPPORT INTAKE / EXAMPLE</header><div class="triage-row"><b>NEW</b>${a}</div><div class="triage-row"><b>REVIEW</b>${b}</div><div class="triage-row"><b>NEXT</b>${c}</div></div>`
    case 'mapping': return `${sceneTag}<div class="mapping-table"><header>FIELD MAPPING / SAMPLE</header><div><b>SOURCE</b><b>DESTINATION</b><b>CHECK</b></div><div><span>Input field</span><span>Mapped field</span><span>Review</span></div><div class="mapping-note">${a} · ${b} · ${c}</div></div>`
    case 'integration': return `${sceneTag}<div class="integration-contract"><div class="integration-system a">SOURCE EVENT</div><div class="integration-system b">TARGET ACTION</div><div class="integration-line"></div><div class="integration-contract-body"><b>CONTRACT CHECK</b><p>${a}</p><p>${b}</p><p>${c}</p></div></div>`
    case 'analytics': return `${sceneTag}<div class="analytics-window"><header>REPORTING STUDY / SAMPLE</header><div class="analytics-number">01<span>metric to verify</span></div><div class="analytics-bars"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="analytics-footer">${b} · ${c}</div></div>`
    case 'course': return `${sceneTag}<div class="course-player"><div class="course-screen"><span>LESSON 01</span><div class="play-symbol">PRACTICE<br/>MODULE</div><small>POSTER ONLY · NO VIDEO BOUND</small></div><div class="course-list"><p>${a}</p><p>${b}</p><p>${c}</p></div></div>`
    case 'studio': return `${sceneTag}<div class="studio-board"><header>BUILD LAB / EXAMPLE</header><div class="studio-work"><span>IDEA</span>${a}</div><div class="studio-work second"><span>BUILD</span>${b}</div><div class="studio-work third"><span>REVIEW</span>${c}</div></div>`
    case 'recorded': return `${sceneTag}<div class="recorded-player"><div class="recorded-screen"><span>RECORDED WORKSHOP</span><b>CHAPTER<br/>OUTLINE</b></div><div class="recorded-chapters">01 ${a}<br/>02 ${b}<br/>03 ${c}</div></div>`
    case 'setup': return `${sceneTag}<div class="setup-kit"><div class="setup-cover">SELF-INSTALL<br/>CHATBOT KIT</div><div class="setup-steps"><p>01 ${a}</p><p>02 ${b}</p><p>03 ${c}</p></div></div>`
    case 'milestones': return `${sceneTag}<div class="milestone-map"><header>SIX WEEKS / EXAMPLE PLAN</header><div class="milestone-points"><i>01</i><i>02</i><i>03</i><i>04</i><i>05</i><i>06</i></div><div class="milestone-labels">${a}<br/>${b}<br/>${c}</div></div>`
    case 'library': return `${sceneTag}<div class="library-shelf"><header>LEARNING LIBRARY</header><div class="book b1">PRACTICE<br/>01</div><div class="book b2">TOOLS<br/>02</div><div class="book b3">REVIEW<br/>03</div><div class="library-note">${a} · ${b}</div></div>`
    case 'forum': return `${sceneTag}<div class="forum-window"><header>MEMBER DISCUSSION / EXAMPLE</header><div class="forum-question">${a}</div><div class="forum-reply">${b}</div><div class="forum-reply last">${c}</div></div>`
    case 'support30': case 'support60': return `${sceneTag}<div class="support-calendar"><header>${mode==='support30'?'30':'60'}-DAY SUPPORT / EXAMPLE</header><div class="calendar-grid">${Array.from({length:14},(_,i)=>`<i class="${i===1||i===7||i===12?'active':''}">${i+1}</i>`).join('')}</div><div class="calendar-note">${a} · ${b} · ${c}</div></div>`
    case 'spreadsheet': return `${sceneTag}<div class="sheet"><header>LEAD TRACKER / TEMPLATE</header><div><b>SOURCE</b><b>NEED</b><b>FOLLOW-UP</b></div><div><span>Example A</span><span>${b}</span><span>${c}</span></div><div><span>Example B</span><span>Review</span><span>Next step</span></div></div>`
    case 'kanban': return `${sceneTag}<div class="kanban"><header>CONTENT WORKFLOW / TEMPLATE</header><div class="kanban-cols"><p><b>IDEA</b>${a}</p><p><b>DRAFT</b>${b}</p><p><b>REVIEW</b>${c}</p></div></div>`
    case 'sharedanalytics': return `${sceneTag}<div class="shared-dashboard"><header>SHARED VIEW / SAMPLE</header><div class="chart-line"></div><div class="shared-stat">01<span>source to verify</span></div><div class="shared-points">${a}<br/>${b}<br/>${c}</div></div>`
    case 'templates': return `${sceneTag}<div class="template-stack"><div class="mail-card back">EMAIL 02 / FOLLOW-UP</div><div class="mail-card front"><small>EMAIL 01 / TEMPLATE</small><h3>A useful first message.</h3><p>${a}</p><p>${b}</p><p>${c}</p></div></div>`
    default: throw new Error(`Unknown visual mode ${mode}`)
  }
}

const css = `@font-face{font-family:Inter;src:url(data:font/ttf;base64,${font}) format('truetype');font-weight:100 900}
*{box-sizing:border-box}html,body{margin:0;width:1200px;height:720px;overflow:hidden;font-family:Inter,Arial,sans-serif}.canvas{position:relative;width:1200px;height:720px;background:var(--bg);color:var(--ink);overflow:hidden}
.canvas:before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 88% 15%,var(--wash),transparent 38%),linear-gradient(145deg,transparent 55%,var(--wash));opacity:.55}
.eyebrow{position:absolute;top:40px;left:53px;font-size:14px;letter-spacing:2.2px;font-weight:800;z-index:5}.eyebrow:before{content:'';display:inline-block;width:24px;height:3px;background:var(--accent);vertical-align:middle;margin-right:15px}
.title{position:absolute;z-index:5;max-width:650px;margin:0;font-size:var(--title-size);font-weight:780;line-height:1.04;letter-spacing:-2.8px;text-wrap:balance}.subtitle{position:absolute;z-index:5;max-width:500px;font-size:22px;line-height:1.3;font-weight:520}.footer{position:absolute;bottom:28px;left:53px;right:53px;border-top:1px solid var(--ink);padding-top:13px;font-size:12px;font-weight:770;letter-spacing:1.25px;display:flex;justify-content:space-between;z-index:7}.footer span:last-child{opacity:.65}
.layout-left .title{left:53px;top:132px;width:515px}.layout-left .subtitle{left:56px;top:420px;width:440px}.layout-right .eyebrow{left:650px}.layout-right .title{left:650px;top:132px;width:500px}.layout-right .subtitle{left:653px;top:425px;width:470px}.layout-bottom .title{left:53px;top:455px;width:1060px}.layout-bottom .subtitle{left:55px;top:573px;width:800px}.layout-top .title{left:53px;top:112px;width:1070px}.layout-top .subtitle{left:56px;top:228px;width:890px}
.scene{position:absolute;z-index:2;color:var(--ink)}.layout-left .scene{left:555px;top:90px;width:600px;height:525px}.layout-right .scene{left:48px;top:90px;width:565px;height:525px}.layout-top .scene{left:280px;top:306px;width:860px;height:330px}.layout-bottom .scene{left:90px;top:54px;width:1010px;height:385px}.scene-tag{position:absolute;right:0;top:0;font-size:12px;letter-spacing:1.6px;font-weight:800;opacity:.7}
.browser{position:absolute;background:#fff;color:#18323a;border:1px solid #aabcb7;border-radius:15px;padding:19px;box-shadow:8px 14px 0 #172b3822}.browser.before{top:95px;left:10px;width:265px;height:260px;transform:rotate(-5deg)}.browser.after{top:135px;left:267px;width:310px;height:310px;transform:rotate(4deg)}.browser small{font-size:11px;font-weight:800;letter-spacing:1px}.bars i{display:block;height:8px;background:#bbc8c9;margin-top:20px;width:80%}.bars i:nth-child(2){width:54%}.blank-call{height:60px;background:#d8e3e2;margin-top:23px}.browser h3{font-size:32px;line-height:1.1;margin:25px 0 12px}.browser p{font-size:16px}.cta{display:inline-block;background:var(--accent);padding:10px 14px;border-radius:5px;font-size:14px;font-weight:700}
.cohort-route{position:absolute;inset:62px 0 0;display:flex;gap:16px;align-items:center}.cohort-route div{width:31%;height:220px;border-radius:100px;background:var(--wash);border:2px solid var(--accent);padding:74px 17px;text-align:center;font-size:16px;font-weight:700}.cohort-route b{display:block;font-size:31px;margin-bottom:15px}.cohort-center{position:absolute;left:35%;top:314px;font-size:28px;text-align:center;font-weight:800;letter-spacing:1px}
.spotlight{position:absolute;top:-80px;width:300px;height:400px;background:linear-gradient(#fff7,transparent);filter:blur(12px);clip-path:polygon(42% 0,58% 0,100% 100%,0 100%)}.spotlight.left{left:40px;transform:rotate(14deg)}.spotlight.right{right:20px;transform:rotate(-20deg)}.stage-deck{position:absolute;left:10%;bottom:40px;width:80%;height:75px;background:var(--ink);color:var(--bg);border-radius:50% 50% 8px 8px;text-align:center;padding-top:42px;font-size:15px;font-weight:750;letter-spacing:1.5px}.mic{position:absolute;left:50%;top:-145px;width:8px;height:160px;background:var(--ink)}.mic:before{content:'';position:absolute;left:-10px;top:-15px;width:28px;height:36px;border-radius:14px;background:var(--ink)}
.conversation-app,.onboard-window,.crm-window,.web-window,.mail-editor,.knowledge-window,.analytics-window,.forum-window{position:absolute;inset:50px 0 10px;background:#f7f8f5;color:#21343c;border-radius:17px;box-shadow:0 25px 40px #0003;overflow:hidden}.app-top,.onboard-window header,.crm-window header,.knowledge-window header,.analytics-window header,.forum-window header{height:55px;background:#e4ece9;padding:19px 23px;font-size:12px;letter-spacing:1.6px;font-weight:800}.app-top span{float:right;color:#668477}.talk{position:absolute;padding:16px 20px;border-radius:17px;font-size:17px;font-weight:650;max-width:75%}.talk.visitor{top:80px;left:24px;background:#e2e8e7}.talk.assistant{top:168px;right:24px;background:var(--accent)}.talk.reviewer{top:277px;left:24px;background:#f0e9dc}
.report-page{position:absolute;inset:42px 12px 15px;background:#fff;color:#273544;padding:33px;box-shadow:18px 20px 0 var(--wash)}.report-page>span{font-size:12px;letter-spacing:2px;font-weight:800}.report-page h3{font-size:40px;letter-spacing:-1.5px;line-height:1.05;margin:35px 0}.report-columns{display:flex;gap:10px}.report-columns p{flex:1;border-top:5px solid var(--accent);padding-top:15px;font-size:17px;font-weight:650}.report-columns b{display:block;font-size:12px;letter-spacing:1px;margin-bottom:20px}
.pipeline-grid{position:absolute;left:0;right:0;top:110px;display:flex;align-items:center}.pipeline-grid .node{width:32%;min-height:210px;border-radius:17px;background:var(--wash);padding:24px;font-size:18px;font-weight:700}.pipeline-grid .node b{display:block;font-size:40px;margin-bottom:23px}.pipeline-grid .line{width:3%;height:4px;background:var(--accent)}.pipeline-bot{position:absolute;top:385px;left:20px;font-size:14px;font-weight:800;letter-spacing:1.5px}
.editorial-board,.facilitation-board,.kanban,.studio-board{position:absolute;inset:45px 0 10px;background:var(--wash);padding:30px;border-radius:12px}.editorial-head,.fac-title,.kanban header,.studio-board header{font-size:13px;font-weight:800;letter-spacing:2px}.editorial-col{display:inline-block;vertical-align:top;background:#fff;color:#293c3c;width:30%;height:240px;margin:35px 1.5%;padding:18px;font-size:18px;font-weight:700;border-top:7px solid var(--accent)}.editorial-col small{display:block;font-size:12px;letter-spacing:1px;margin-bottom:45px}
.onboard-left{position:absolute;left:0;top:55px;width:95px;bottom:0;background:#d8e6e2;padding:43px;display:flex;flex-direction:column;gap:60px;color:#62807a}.onboard-content{margin-left:125px;padding:20px 30px}.onboard-content h3{font-size:33px;margin:0 0 10px}.onboard-content p{padding:10px;border-bottom:1px solid #d8e6e2;font-size:18px}
.crm-table,.sheet{font-size:17px}.crm-table>div,.sheet>div{display:grid;grid-template-columns:1fr 1fr 1fr;gap:15px;border-bottom:1px solid #d7e2e2;padding:19px}.crm-table>div:first-child{font-size:12px;letter-spacing:1.4px;font-weight:800;color:#647b78}.crm-table>div:nth-child(2){background:#ecf6f3}
.web-window header{height:45px;background:#d8e4e8;padding:17px}.web-window header i{display:inline-block;width:9px;height:9px;border-radius:50%;background:#93aab1;margin-right:5px}.web-window header span{margin-left:23px;font-size:12px;letter-spacing:1.5px}.web-nav{font-size:12px;letter-spacing:1.6px;text-align:right;padding:20px}.web-hero{padding:10px 50px}.web-hero h3{font-size:42px;letter-spacing:-1.5px;margin:0}.web-hero p{font-size:17px}.web-button{display:inline-block;background:var(--accent);padding:13px 18px;border-radius:5px;margin-top:8px;font-weight:700}
.mail-editor{display:flex}.mail-side{width:115px;background:#dce7e4;padding:35px 20px;font-size:13px;line-height:3;letter-spacing:1px;font-weight:800}.mail-body{padding:28px 35px}.mail-body small{font-size:12px;letter-spacing:1.5px}.mail-body h3{font-size:34px;margin:18px 0}.subject{padding:14px;background:#edf2ef;font-size:16px}.mail-body p{font-size:18px}.approval{border-left:5px solid var(--accent);padding-left:16px;font-size:16px;font-weight:700}
.question,.answer,.citation{position:absolute;left:30px;right:30px;padding:20px;border-radius:14px}.question{top:83px;background:#e9f1ef;font-size:20px}.answer{top:181px;background:#fff;border:1px solid #cbdeda;font-size:22px;font-weight:700}.answer small{font-size:13px;color:#548579}.citation{top:300px;background:var(--wash);font-size:16px;font-weight:700}
.agenda-sheet,.curriculum,.advisory-page,.coaching-note,.warranty-flow,.sla-table,.triage-console,.mapping-table,.integration-contract,.course-player,.recorded-player,.setup-kit,.milestone-map,.library-shelf,.support-calendar,.sheet,.shared-dashboard,.template-stack{position:absolute;inset:50px 0 10px;background:var(--wash);color:#26383d;border-radius:13px;padding:28px;box-shadow:0 22px 45px #0002}
.agenda-sheet small{font-size:12px;letter-spacing:2px;font-weight:800}.agenda-sheet h3{font-size:38px;margin:20px 0}.agenda-sheet>div{padding:14px 0;border-top:1px solid #b9c7c4;font-size:18px;font-weight:700}.agenda-sheet b{margin-right:28px;color:#916f6f}
.sticky{color:#26383d;position:absolute;top:115px;width:28%;height:240px;background:#fff0b2;padding:30px 20px;font-size:20px;font-weight:700;box-shadow:7px 10px 0 #0002}.sticky.first{left:5%;transform:rotate(-7deg)}.sticky.second{left:36%;background:#d5eace;transform:rotate(4deg)}.sticky.third{left:67%;background:#f2cfca;transform:rotate(-4deg)}.fac-note{position:absolute;bottom:28px;font-size:13px}
.advisory-page h3{font-size:40px}.advisory-ring{float:left;border:35px solid var(--accent);border-radius:50%;width:205px;height:205px;text-align:center;padding-top:40px;font-size:35px;font-weight:800}.advisory-items{margin-left:245px}.advisory-items p{border-bottom:1px solid #abbab5;padding:10px 0;font-size:18px;font-weight:700}
.coaching-desk{position:absolute;inset:25px 0;background:linear-gradient(120deg,var(--wash),#e9d3c5);border-radius:20px;padding:15px}.coaching-note{color:#26383d;inset:30px 50px 30px 35px;background:#fff9ef;padding:30px;transform:rotate(-3deg)}.coaching-note h3{font-size:35px;margin:15px 0}.coaching-note p{font-size:18px;border-top:1px solid #d8cec4;padding-top:9px}.pen{position:absolute;right:43px;top:120px;width:8px;height:240px;background:#54443b;transform:rotate(20deg)}
.circle-orbit{position:absolute;border:2px solid var(--accent);border-radius:50%;left:135px;top:85px;width:330px;height:330px}.circle-orbit.two{left:177px;top:127px;width:246px;height:246px}.circle-core{position:absolute;left:245px;top:213px;font-size:28px;font-weight:800;text-align:center}.circle-label{position:absolute;font-size:17px;font-weight:700;max-width:180px}.circle-label.a{left:10px;top:95px}.circle-label.b{right:0;top:140px}.circle-label.c{left:0;bottom:40px}
.curriculum-header{font-size:13px;letter-spacing:2px;font-weight:800;margin-bottom:32px}.curriculum-chapter{display:flex;align-items:center;height:93px;border-top:1px solid #bbc9c5;font-size:18px;font-weight:700}.curriculum-chapter b{font-size:38px;margin-right:30px;color:#618f86}
.warranty-badge{width:160px;height:160px;border:18px solid var(--accent);border-radius:50%;display:grid;place-content:center;text-align:center;font-weight:800;margin:30px auto}.warranty-flow>div:not(.warranty-badge){font-size:16px;border-top:1px solid #bbc9c5;padding:9px}.warranty-flow b{margin-right:15px}
.sla-table header,.triage-console header,.mapping-table header,.integration-contract b,.analytics-window header,.course-player header,.recorded-player header,.milestone-map header,.library-shelf header,.support-calendar header,.sheet header,.shared-dashboard header{font-size:13px;letter-spacing:1.5px;font-weight:800}.sla-table>div,.triage-row{display:flex;gap:30px;border-top:1px solid #bac9c4;padding:20px 0;font-size:18px}.sla-table>div:first-of-type,.triage-row:first-of-type{margin-top:36px}.sla-table b,.triage-row b{width:140px;font-size:13px}.sla-table small{font-size:12px}.triage-row:nth-of-type(2){background:#fff6e6}
.mapping-table>div,.sheet>div{display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid #becdc7;padding:16px;font-size:17px}.mapping-table>div:first-of-type,.sheet>div:first-of-type{margin-top:32px;background:#dce8e3}.mapping-note{font-weight:700}.integration-system{position:absolute;top:95px;width:40%;padding:30px;background:#fff;border:2px solid var(--accent);font-size:18px;font-weight:800}.integration-system.a{left:5%}.integration-system.b{right:5%}.integration-line{position:absolute;left:45%;top:144px;width:10%;height:3px;background:var(--accent)}.integration-contract-body{position:absolute;top:240px;left:5%;right:5%;font-size:17px}.integration-contract-body p{display:inline-block;width:31%;vertical-align:top}
.analytics-number{position:absolute;left:40px;top:105px;font-size:86px;font-weight:800}.analytics-number span,.shared-stat span{display:block;font-size:15px;letter-spacing:1px}.analytics-bars{position:absolute;right:40px;top:110px;display:flex;align-items:end;gap:20px;width:260px;height:190px}.analytics-bars i{width:30px;background:var(--accent);height:38%;border-radius:5px 5px 0 0}.analytics-bars i:nth-child(2){height:68%}.analytics-bars i:nth-child(3){height:52%}.analytics-bars i:nth-child(4){height:92%}.analytics-bars i:nth-child(5){height:72%}.analytics-bars i:nth-child(6){height:84%}.analytics-footer{position:absolute;bottom:30px;left:40px;font-size:15px}
.course-player{display:flex;gap:20px;padding:24px}.course-screen{width:62%;height:100%;background:#243742;color:white;padding:24px;display:flex;flex-direction:column;justify-content:space-between}.course-screen span,.course-screen small{font-size:12px;letter-spacing:1.4px}.play-symbol{font-size:30px;line-height:1.1;font-weight:800;text-align:center}.course-list{width:38%}.course-list p{font-size:17px;border-bottom:1px solid #b8cbc8;padding-bottom:15px}.studio-work{color:#26383d;display:inline-flex;flex-direction:column;background:#fff;padding:20px;width:30%;height:235px;margin:50px 1.5%;font-size:18px;font-weight:700}.studio-work span{font-size:12px;letter-spacing:1.5px;margin-bottom:35px}.studio-work.second{background:#e7eed0}.studio-work.third{background:#e9d9d0}
.recorded-player{display:flex;padding:25px}.recorded-screen{width:60%;background:#26363d;color:#fff;padding:20px}.recorded-screen span{font-size:13px}.recorded-screen b{display:block;font-size:30px;line-height:1.1;text-align:center;margin-top:65px}.recorded-chapters{padding:25px;font-size:18px;line-height:3}.setup-cover{position:absolute;left:35px;top:35px;width:220px;height:290px;background:#263d3c;color:#fff;padding:30px;font-size:30px;font-weight:800}.setup-steps{margin-left:270px;padding-top:20px;font-size:18px}.setup-steps p{border-bottom:1px solid #bccac4;padding:14px}
.milestone-points{display:flex;justify-content:space-between;margin-top:95px;border-top:4px solid var(--accent)}.milestone-points i{font-style:normal;background:var(--accent);width:42px;height:42px;border-radius:50%;display:grid;place-items:center;margin-top:-23px;font-weight:800}.milestone-labels{font-size:18px;line-height:3;margin-top:22px}.book{display:inline-flex;align-items:end;width:29%;height:215px;margin:40px 2%;padding:20px;background:#344a5c;color:white;font-weight:800;font-size:23px;box-shadow:9px 6px 0 #0003}.book.b2{background:#b38762}.book.b3{background:#5a7790}.library-note{font-size:15px}.forum-question,.forum-reply{position:absolute;border-radius:17px;padding:18px;font-size:17px;font-weight:700}.forum-question{top:85px;left:25px;background:#fff;width:70%}.forum-reply{top:175px;right:25px;background:#dfeddd;width:68%}.forum-reply.last{top:265px;left:25px;background:#fff}
.calendar-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:7px;margin-top:55px}.calendar-grid i{font-style:normal;background:#fff;border-radius:5px;text-align:center;padding:16px;font-size:14px}.calendar-grid i.active{background:var(--accent);font-weight:800}.calendar-note{margin-top:35px;font-size:17px;font-weight:700}
.kanban-cols{display:flex;gap:16px;margin-top:60px}.kanban-cols p{color:#26383d;width:31%;height:205px;background:#fff;padding:20px;font-size:18px;font-weight:700}.kanban-cols b{display:block;font-size:13px;letter-spacing:2px;margin-bottom:40px}.chart-line{position:absolute;left:30px;right:30px;top:130px;height:170px;border-bottom:3px solid var(--accent);clip-path:polygon(0 70%,22% 40%,45% 60%,70% 10%,100% 38%,100% 100%,0 100%);background:#7cbab550}.shared-stat{position:absolute;left:35px;top:100px;font-size:58px;font-weight:800}.shared-points{position:absolute;bottom:20px;left:35px;font-size:16px;line-height:1.6}.template-stack .mail-card{position:absolute;background:#fff;padding:25px;box-shadow:9px 13px 0 #0002}.mail-card.back{left:170px;top:35px;width:300px;height:250px;transform:rotate(7deg);font-size:15px}.mail-card.front{left:30px;top:28px;width:390px;height:290px;transform:rotate(-5deg)}.mail-card small{font-size:12px;letter-spacing:1px}.mail-card h3{font-size:28px}.mail-card p{font-size:16px;border-top:1px solid #ddd}
`

function frameHtml(row, spec, index, kind) {
  const mode = kind === 'hero' ? modes[index] : alternateModes[index]
  if (mode === 'source') return null
  const [background, ink, accent, wash] = themes[(index + (kind === 'artifact' ? 5 : 0)) % themes.length]
  const layout = ({ stage:'bottom', cohort:'bottom', circle:'right', report:'right', advisory:'right', coaching:'right', agenda:'right', facilitation:'bottom', curriculum:'right', course:'right', studio:'bottom', recorded:'right', library:'right', forum:'right', support30:'right', support60:'right', spreadsheet:'right', templates:'right' })[mode] || (index % 2 ? 'right' : 'left')
  const headline = kind === 'hero' ? row.title : spec.artifact
  const subtitle = kind === 'hero' ? spec.promise : `${row.title} · example deliverable`
  const titleSize = headline.length > 38 ? 42 : headline.length > 27 || (layout === 'bottom' && headline.length > 20) ? 48 : 59
  const vars = `--bg:${background};--ink:${ink};--accent:${accent};--wash:${wash};--title-size:${titleSize}px`
  return `<!doctype html><html><head><style>${css}</style></head><body><main class="canvas layout-${layout} mode-${mode}" style="${vars}">
    <div class="eyebrow">AMADUTOWN / ${kind === 'hero' ? 'SERVICE CONCEPT' : 'EXAMPLE ARTIFACT'}</div><h1 class="title">${escape(headline)}</h1><p class="subtitle">${escape(subtitle)}</p>
    <div class="scene">${scene(mode,spec,index)}</div><div class="footer"><span>ILLUSTRATIVE ${kind === 'hero' ? 'CONCEPT · NO CLIENT RESULT' : 'EXAMPLE · SCOPE REQUIRES REVIEW'}</span><span>${String(index+1).padStart(2,'0')} / 41</span></div>
    </main></body></html>`
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width:1200, height:720 }, deviceScaleFactor:1 })
  const manifest = {}
  for (let index=0; index<rows.length; index++) {
    const row=rows[index],spec=specs[String(index)]
    const frames = row.image_url ? [{ imageUrl: row.image_url, alt: `Current source image for ${row.title}`, role: 'hero', status: 'source capture' }] : []
    for (const kind of ['hero','artifact']) {
      const html=frameHtml(row,spec,index,kind)
      if (!html) continue
      await page.setContent(html)
      await page.evaluate(()=>document.fonts.ready)
      const clear = await page.evaluate(() => {
        const title = document.querySelector('.title').getBoundingClientRect()
        const subtitle = document.querySelector('.subtitle').getBoundingClientRect()
        const footer = document.querySelector('.footer').getBoundingClientRect()
        return title.bottom + 8 < subtitle.top && subtitle.bottom + 8 < footer.top
      })
      if (!clear) throw new Error(`Typography collision in ${row.title} ${kind}`)
      const name=`${row.id}-${kind}-v3.webp`
      await sharp(await page.screenshot()).webp({quality:89,effort:5}).toFile(path.join(outDir,name))
      frames.push({ imageUrl: `/showcases/service-gallery-v3/${name}`, alt: `Illustrative ${kind === 'hero' ? 'service concept' : spec.artifact.toLowerCase()} for ${row.title}`, role: kind === 'hero' ? 'hero' : row.id === 'e5c198bd-1276-45ee-abe3-9d9f85e1e3d2' ? 'course-preview poster' : ['workshop','resource','coaching'].includes(spec.family) ? 'product-in-use' : 'workflow', status: 'illustrative concept' })
    }
    if (frames.length !== 2) throw new Error(`Two distinct frames required for ${row.title}`)
    manifest[row.id] = { expectedCurrentUrl: row.image_url, mode: modes[index], alternateMode: alternateModes[index], source: 'provider-free HTML/CSS rendered illustrative concept; existing listing image retained where present', frames }
    process.stdout.write(`${index+1}/41 ${row.title}\n`)
  }
  fs.writeFileSync(path.join(root,'lib/service-concept-gallery.json'),JSON.stringify(manifest,null,2)+'\n')
  const contactDir = path.join(root,'docs/showcase-audit/qa/services')
  fs.mkdirSync(contactDir,{recursive:true})
  for (const kind of ['hero','artifact']) {
    const tiles = []
    for (let index=0; index<rows.length; index++) {
      const row=rows[index]
      const source = kind === 'hero' && row.image_url
        ? path.join(root,'public',row.image_url)
        : path.join(outDir,`${row.id}-${kind}-v3.webp`)
      const input = await sharp(source).resize(240,144,{fit:'cover'}).png().toBuffer()
      tiles.push({input,left:(index%6)*240,top:Math.floor(index/6)*144})
    }
    await sharp({create:{width:1440,height:1008,channels:3,background:'#101820'}})
      .composite(tiles).png().toFile(path.join(contactDir,`raster-v3-${kind}-contact-sheet.png`))
  }
  await browser.close()
}
main().catch((error)=>{console.error(error);process.exitCode=1})
