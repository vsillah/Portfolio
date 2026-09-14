// Real sales pages, synthetic browser API responses; isolated localhost server only.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const base = new URL('http://127.0.0.1:3197');
const out = path.resolve('local-private/case-discovery-qa');
fs.mkdirSync(out,{recursive:true});
const sid='11111111-1111-4111-8111-111111111111';
(async()=>{
 const browser=await chromium.launch();
 const evidence=[];
 for(const width of [1440,768,390,360]) {
 const context=await browser.newContext({viewport:{width,height:1000},recordVideo:{dir:out,size:{width,height:1000}}});
 const external=[],writes=[],publicReads=[],unexpectedWrites=[],errors=[];
 let failSave=true;
await context.addInitScript(()=>{const b=s=>btoa(JSON.stringify(s));localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:`${b({alg:'HS256'})}.${b({sub:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})}.synthetic`,refresh_token:'synthetic',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',email:'operator@example.invalid',role:'authenticated',app_metadata:{role:'admin'},user_metadata:{}}}));});
const contact={id:42,name:'Synthetic Reviewer',email:'reviewer@example.invalid',company:'Synthetic Practice'};
let session={id:sid,contact_submission_id:42,diagnostic_audit_id:42,products_presented:[],funnel_stage:'prospect',client_name:contact.name};
const proposal={id:'22222222-2222-4222-8222-222222222222',status:'draft',client_name:contact.name,client_company:contact.company,bundle_name:'Fictional workflow design',total_amount:997,line_items:[{title:'Fictional workflow prototype',price:997,description:'Editable tracker and review guide using fictional records.'}],terms_text:'Deliverables\n1  Editable fictional tracker.\n2  Review guide and walkthrough.\nPayment terms\nFixed fee $997. Deposit $498.50 after written agreement before kickoff. Balance $498.50 after delivery acceptance.\nSchedule\nAbout 10 business days after agreed kickoff.\nScope\n- Fictional data only.\n- No live messaging.',valid_until:null,access_code:null,pdf_url:null};
await context.route('**/*',async r=>{const u=new URL(r.request().url()),p=u.pathname;const json=d=>r.fulfill({contentType:'application/json',body:JSON.stringify(d)});if(!['localhost','127.0.0.1'].includes(u.hostname)){external.push(u.origin);return r.abort()}
if(u.port==='3999')return json(p.includes('/auth/')?{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',email:'operator@example.invalid'}:[{role:'admin'}]);
if(p==='/api/admin/sales/sessions' && r.request().method()==='PUT') {
 const body=r.request().postDataJSON(); writes.push({path:p,keys:Object.keys(body)});
 if(failSave) { failSave=false; return r.fulfill({status:500,contentType:'application/json',body:'{}'}); }
 session={...session,...body}; return json({data:session});
}
if(p.startsWith('/api/')&&r.request().method()!=='GET'){unexpectedWrites.push(p);return r.abort()}

if(p==='/api/proposals')return json({proposal:u.searchParams.get('sales_session_id')===sid?proposal:null});
if(p==='/api/proposals/22222222-2222-4222-8222-222222222222/milestones')return json({enabled:false});
if(p.startsWith('/api/proposals/')){publicReads.push(p);return json({})}
if(p==='/api/admin/sales/sessions')return json({sessions:[session]});
if(p==='/api/admin/sales')return json({audits:[{id:42,status:'completed',contact_submission_id:42,contact_submissions:contact,business_challenges:[],tech_stack:[],automation_needs:[],ai_readiness:'beginner',budget_timeline:{},decision_making:{},diagnostic_data:{}}]});
if(p==='/api/admin/outreach/leads/42')return json(contact);
if(p==='/api/admin/sales/products')return json({content:[]});if(p==='/api/admin/sales/scripts')return json({scripts:[]});if(p==='/api/admin/sales/bundles')return json({bundles:[]});
if(p.startsWith('/api/'))return json({tasks:[],meetings:[],reports:[],sessions:[],audits:[],data:[]});return r.continue()});

const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const marks=[];const started=Date.now();
const hold=async label=>{marks.push({label,seconds:(Date.now()-started)/1000});await page.waitForTimeout(1200)};
for(const kind of ['conversation','audit']) {
 await page.goto(base.origin+(kind==='conversation'?`/admin/sales/conversation/${sid}`:'/admin/sales/42'));
 const panel=page.getByRole('region',{name:'Case discovery'});
 await panel.waitFor(); await page.waitForTimeout(1500); await panel.scrollIntoViewIfNeeded();await hold(kind+' discovery entry');
 await panel.getByText('1. Frame the question').click();
 await panel.getByLabel('Question to solve',{exact:true}).fill('How can we reduce intake wait time from 3 days to 1 day?');
 await panel.getByLabel('Success measure and baseline').fill('Median intake wait: 3 days. Target: 1 day.');
 await panel.getByLabel('Timeframe',{exact:true}).fill('Six weeks after kickoff');
 await panel.getByText('1. Frame the question').click();
 await panel.getByText('2. Investigate').click();
 await panel.getByLabel('Framework',{exact:true}).selectOption('capabilities');
 await panel.getByLabel('Investigation buckets').fill('People capacity; intake process; tooling; approval handoffs');
 await panel.getByLabel('Evidence and sources').fill('Synthetic interview: two manual handoffs. Validate against timestamp sample.');
 await panel.getByLabel('Missing evidence').fill('Request a redacted sample of intake timestamps.');
 await panel.getByLabel('Client confirmed the approach').check();
 await hold(kind+' framework and evidence');
 await page.screenshot({path:path.join(out,`${kind}-${width}.png`)});
 await panel.getByText('2. Investigate').click();
 await panel.getByText('3. Recap and decide').click();
 await panel.getByLabel('Root causes or hypotheses').fill('Hypothesis: approval handoff adds a day.');
 await panel.getByLabel('Options and implications').fill('Pilot one approval queue; compare turnaround before expanding scope.');
 await panel.getByLabel('Next step, owner and date').fill('Operator requests redacted sample before proposal scope review.');
 await panel.getByText('3. Recap and decide').click();
 if(kind==='conversation') {
  await panel.getByText('Save and review proposal').click();
  await expect(panel.getByRole('alert')).toContainText('Could not save');
  await hold('failed save retains edits');
 }
 await panel.getByText('Save and review proposal').click();
 const dialog=page.getByRole('dialog');await dialog.waitFor();
 await dialog.getByText('Discovery review · Internal only').click();
 await expect(dialog.getByText('How can we reduce intake wait time from 3 days to 1 day?',{exact:true})).toBeVisible();
 await hold(kind+' internal proposal review');
 await page.screenshot({path:path.join(out,`proposal-${kind}-${width}.png`)});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
 if(overflow)throw Error('Page overflow at '+width+' '+kind);
 await page.reload();await panel.waitFor();await page.waitForTimeout(1500);await panel.getByText('1. Frame the question').click();
 await expect(panel.getByLabel('Question to solve',{exact:true})).toHaveValue('How can we reduce intake wait time from 3 days to 1 day?');
 await panel.getByText('1. Frame the question').click();
 await hold(kind+' restored after reload');
}
if(unexpectedWrites.length||publicReads.length||errors.length)throw Error(JSON.stringify({unexpectedWrites,publicReads,errors}));
const video=await page.video().path();await context.close();
const mp4=path.join(out,`case-discovery-${width}.mp4`);
execFileSync('ffmpeg',['-y','-i',video,'-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',mp4],{stdio:'ignore'});
evidence.push({width,marks,writes,unexpectedWrites,publicReads,errors,blockedExternalRequests:external,mp4});
}
await browser.close();fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log('PASS: real sales routes, synthetic APIs, four widths');
})().catch(e=>{console.error(e);process.exit(1)});
