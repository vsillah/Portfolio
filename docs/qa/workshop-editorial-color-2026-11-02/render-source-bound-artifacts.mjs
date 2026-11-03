import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { JSDOM } from 'jsdom'
import sharp from 'sharp'

const root = process.cwd()
const qa = path.join(root, 'docs/qa/workshop-editorial-color-2026-11-02')
const mapPath = path.join(qa, 'source-to-service-visual-map.json')
const map = JSON.parse(await fs.readFile(mapPath, 'utf8'))
const sourceImage = path.join(root, 'agentified/source-assets/accelerated/accelerated-sam-infographic.png')
const ebook = path.join(root, 'accelerated_ebook_leadmagnet.epub')
const hash = async file => crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex')
const esc = s => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
const sections = {
  'ai-strategy-half-day:hero': { anchor: 'The Full Discovery Loop', count: 9 },
  'ai-strategy-half-day:secondary': { anchor: 'Bet: Reducing time-to-first-value', count: 5 },
  'ai-strategy-full-day:hero': { anchor: 'Decision-Maker — Has formal authority', count: 6 },
  'ai-strategy-full-day:secondary': { anchor: 'Build a Metrics Ladder', count: 18 },
  'ai-strategy-recorded:secondary': { anchor: 'What a Learning Plan Actually Is', count: 14 },
  'accelerated-cohort-workshop:secondary': { anchor: 'Anchor Roadmaps in Customer Outcomes', count: 15 },
  'product-innovation-workshop:hero': { anchor: 'What ClientQ Actually Does', count: 17 },
  'product-innovation-workshop:secondary': { anchor: 'The Tools: VisionScope + MarketCraft', count: 16 },
}
const surfaces = {
  'ai-strategy-half-day:hero': [
    { kind:'paper', name:'upper pinned sheet', quad:[[1205,160],[1395,150],[1390,300],[1190,300]], part:[0,3] },
    { kind:'paper', name:'middle pinned sheet', quad:[[1200,360],[1380,355],[1380,500],[1195,500]], part:[3,6] },
    { kind:'paper', name:'lower pinned sheet', quad:[[1190,550],[1390,560],[1380,710],[1180,690]], part:[6,9] },
  ],
  'ai-strategy-half-day:secondary': [
    { kind:'sticky', name:'whiteboard note 1', quad:[[1345,95],[1460,80],[1460,185],[1335,190]], part:[0,1] },
    { kind:'sticky', name:'whiteboard note 2', quad:[[1340,210],[1460,205],[1460,305],[1340,305]], part:[1,2] },
    { kind:'sticky', name:'whiteboard note 3', quad:[[1345,340],[1460,335],[1460,430],[1340,430]], part:[2,3] },
    { kind:'sticky', name:'whiteboard note 4', quad:[[1345,470],[1460,465],[1460,560],[1340,565]], part:[3,4] },
    { kind:'sticky', name:'whiteboard note 5', quad:[[1330,620],[1470,620],[1460,730],[1325,715]], part:[4,5] },
  ],
  'ai-strategy-full-day:hero': [
    { kind:'sticky', name:'upper wall card 1', quad:[[1245,67],[1360,65],[1355,145],[1240,150]], part:[0,1] },
    { kind:'sticky', name:'upper wall card 2', quad:[[1385,58],[1505,50],[1505,140],[1380,140]], part:[1,2] },
    { kind:'sticky', name:'middle wall card 1', quad:[[1245,190],[1355,185],[1355,267],[1240,270]], part:[2,3] },
    { kind:'sticky', name:'middle wall card 2', quad:[[1380,180],[1505,173],[1505,262],[1380,265]], part:[3,4] },
    { kind:'sticky', name:'table note', quad:[[700,750],[830,745],[830,820],[700,825]], part:[4,5] },
    { kind:'paper', name:'foreground meeting notebook', quad:[[1030,808],[1255,812],[1300,970],[1005,960]], part:[5,6] },
  ],
  'ai-strategy-full-day:secondary': [
    { kind:'paper', name:'held printed worksheet', quad:[[715,635],[1025,665],[875,900],[590,835]], part:[0,18] },
  ],
  'ai-strategy-recorded:hero': [
    { kind:'screen', name:'laptop display', quad:[[1200,355],[1455,385],[1410,575],[1165,550]], sourceCrop:[0,0,1136,944] },
  ],
  'ai-strategy-recorded:secondary': [
    { kind:'screen', name:'laptop display', quad:[[1095,340],[1390,340],[1360,555],[1050,535]], cover:'#e8e9e7', part:[0,14] },
    { kind:'paper', name:'held printed worksheet', quad:[[695,510],[990,565],[925,865],[570,795]], cover:'#f1efed', part:[0,14] },
  ],
  'accelerated-cohort-workshop:hero': [
    { kind:'paper', name:'printed SAM worksheet', quad:[[575,813],[965,835],[915,1000],[505,970]], cover:'#eeeae3', sourceCrop:[0,0,1136,944] },
    { kind:'phone', name:'handheld SAM reference', quad:[[765,620],[855,615],[885,770],[790,785]], sourceCrop:[170,100,720,740] },
  ],
  'accelerated-cohort-workshop:secondary': [
    { kind:'screen', name:'laptop learning-roadmap page', quad:[[1040,280],[1320,290],[1310,500],[1015,485]], cover:'#e9ebe9', part:[0,15] },
    { kind:'paper', name:'printed learning-roadmap worksheet', quad:[[770,650],[1360,715],[1260,1005],[615,930]], cover:'#f1efeb', occlusion:[[625,650],[820,650],[810,850],[615,850]], part:[0,15] },
  ],
  'product-innovation-workshop:hero': [
    { kind:'phone', name:'handheld ClientQ reference', quad:[[735,418],[835,417],[820,690],[710,685]], cover:'#f0eff1', part:[0,17] },
    { kind:'paper', name:'printed ClientQ worksheet', quad:[[400,925],[700,860],[950,925],[650,1024]], cover:'#f4f3f0', part:[0,17] },
  ],
  'product-innovation-workshop:secondary': [
    { kind:'paper', name:'held VisionScope and MarketCraft worksheet', quad:[[890,765],[1210,760],[1260,910],[905,930]], part:[0,16] },
  ],
}
function textOfChapter(member) {
  const html = execFileSync('unzip',['-p',ebook,member],{encoding:'utf8'})
  const doc = new JSDOM(html,{contentType:'text/html'}).window.document
  return [...doc.querySelectorAll('p')].map(p=>p.textContent.replace(/\s+/g,' ').trim()).filter(Boolean)
}
function wrap(s,width) {
  const words=s.split(/\s+/), lines=[]; let line=''
  for (const word of words) { if ((line+' '+word).trim().length>width && line) { lines.push(line); line=word } else line=(line+' '+word).trim() }
  if(line) lines.push(line)
  return lines
}
function pageSvg(title, paragraphs, kind) {
  const short = kind==='sticky'
  const lines=[]
  for (const p of paragraphs) { lines.push(...wrap(p,short?30:52)); if(!short) lines.push('') }
  while(lines.at(-1)==='') lines.pop()
  const font = short ? Math.max(28,Math.min(60,Math.floor(750/Math.max(lines.length,1)))) : Math.max(20,Math.min(32,Math.floor(850/Math.max(lines.length+3,1))))
  const step = font*1.25
  const top = short ? 140 : 135
  const titleSize = short ? 0 : 39
  const titleSvg = short ? '' : `<text x="80" y="80" font-family="Georgia,serif" font-size="${titleSize}" font-weight="700" fill="#24333b">${esc(title)}</text><path d="M80 102 H720" stroke="#a79772" stroke-width="3" opacity=".7"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000">${titleSvg}${lines.map((line,i)=>line?`<text x="80" y="${top+i*step}" font-family="Georgia,serif" font-size="${font}" fill="#22303a">${esc(line)}</text>`:'').join('')}</svg>`
}
function solve(A,b) {
  const n=b.length; for(let i=0;i<n;i++){let p=i;for(let j=i+1;j<n;j++)if(Math.abs(A[j][i])>Math.abs(A[p][i]))p=j;[A[i],A[p]]=[A[p],A[i]];[b[i],b[p]]=[b[p],b[i]];const v=A[i][i];if(Math.abs(v)<1e-10)throw Error('Singular surface transform');for(let j=i;j<n;j++)A[i][j]/=v;b[i]/=v;for(let k=0;k<n;k++)if(k!==i){const m=A[k][i];for(let j=i;j<n;j++)A[k][j]-=m*A[i][j];b[k]-=m*b[i]}}
  return b
}
function homography(q,w,h) {
  const pts=[[0,0],[w,0],[w,h],[0,h]], A=[],b=[]
  for(let i=0;i<4;i++){const [u,v]=pts[i],[x,y]=q[i]; A.push([u,v,1,0,0,0,-u*x,-v*x]);b.push(x);A.push([0,0,0,u,v,1,-u*y,-v*y]);b.push(y)}
  return solve(A,b)
}
function invert(h) {
  const m=[h[0],h[1],h[2],h[3],h[4],h[5],h[6],h[7],1]
  const d=m[0]*(m[4]*m[8]-m[5]*m[7])-m[1]*(m[3]*m[8]-m[5]*m[6])+m[2]*(m[3]*m[7]-m[4]*m[6])
  return [(m[4]*m[8]-m[5]*m[7])/d,(m[2]*m[7]-m[1]*m[8])/d,(m[1]*m[5]-m[2]*m[4])/d,(m[5]*m[6]-m[3]*m[8])/d,(m[0]*m[8]-m[2]*m[6])/d,(m[2]*m[3]-m[0]*m[5])/d,(m[3]*m[7]-m[4]*m[6])/d,(m[1]*m[6]-m[0]*m[7])/d,(m[0]*m[4]-m[1]*m[3])/d]
}
function within(x,y,q){let sign=0;for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4],z=(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);if(Math.abs(z)>1e-4){const s=Math.sign(z);if(sign&&s!==sign)return false;sign=s}}return true}
function color(s){return [1,3,5].map(i=>parseInt(s.slice(i,i+2),16))}
async function applySurface(base,artifact,surface) {
  const raw=await sharp(artifact).ensureAlpha().raw().toBuffer({resolveWithObject:true})
  const src=raw.data,sw=raw.info.width,sh=raw.info.height,q=surface.quad
  const inv=invert(homography(q,sw,sh))
  const x0=Math.max(0,Math.floor(Math.min(...q.map(p=>p[0])))),x1=Math.min(1535,Math.ceil(Math.max(...q.map(p=>p[0]))))
  const y0=Math.max(0,Math.floor(Math.min(...q.map(p=>p[1])))),y1=Math.min(1023,Math.ceil(Math.max(...q.map(p=>p[1]))))
  const paper=surface.cover?color(surface.cover):null
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    if(!within(x+.5,y+.5,q)||surface.occlusion&&within(x+.5,y+.5,surface.occlusion))continue
    const d=inv[6]*x+inv[7]*y+inv[8],u=(inv[0]*x+inv[1]*y+inv[2])/d,v=(inv[3]*x+inv[4]*y+inv[5])/d
    if(u<0||v<0||u>=sw||v>=sh)continue
    const bi=(y*1536+x)*3,si=(Math.floor(v)*sw+Math.floor(u))*4
    if(paper){
      const edge=Math.min(...q.map((p,i)=>{const n=q[(i+1)%4],dx=n[0]-p[0],dy=n[1]-p[1];return Math.abs(dx*(y-p[1])-dy*(x-p[0]))/Math.hypot(dx,dy)}))
      const fill=(surface.kind==='screen'?.98:.96)*Math.min(1,edge/7)
      for(let c=0;c<3;c++)base[bi+c]=Math.round(base[bi+c]*(1-fill)+paper[c]*fill)
    }
    const a=src[si+3]/255*(surface.kind==='screen'?.88:surface.kind==='phone'?.9:.75)
    for(let c=0;c<3;c++)base[bi+c]=Math.round(base[bi+c]*(1-a)+src[si+c]*a)
  }
}
const sourceHashes={ 'accelerated_ebook_leadmagnet.epub':await hash(ebook), 'agentified/source-assets/accelerated/accelerated-sam-infographic.png':await hash(sourceImage) }
for(const row of map.frames){
  const key=`${row.slug}:${row.role}`,s=surfaces[key];if(!s)throw Error(`Missing physical surface ${key}`)
  const file=`${row.slug}-${row.role}`,basePath=path.join(qa,'base-natural-color',`${file}.jpg`),output=path.join(root,'public/showcases/service-photographic',`${file}.jpg`)
  const sourceIsSam=row.source.endsWith('.png')
  let excerpt=[]
  if(!sourceIsSam){const p=textOfChapter(row.member),spec=sections[key],i=p.findIndex(v=>v.includes(spec.anchor));if(i<0)throw Error(`Source anchor missing: ${key}`);excerpt=p.slice(i,i+spec.count);if(excerpt.length<spec.count)throw Error(`Source passage incomplete: ${key}`)}
  const pixels=await sharp(basePath).removeAlpha().raw().toBuffer({resolveWithObject:true});if(pixels.info.width!==1536||pixels.info.height!==1024)throw Error(`Base dimensions ${key}`)
  const entries=[]
  for(let i=0;i<s.length;i++){
    const surface=s[i],artifactPath=path.join(qa,'source-artifacts',`${file}-${i+1}.${sourceIsSam?'png':'svg'}`)
    if(sourceIsSam){const [left,top,width,height]=surface.sourceCrop;await sharp(sourceImage).extract({left,top,width,height}).png().toFile(artifactPath)}
    else await fs.writeFile(artifactPath,pageSvg(row.framework,excerpt.slice(...surface.part),surface.kind)+'\n')
    await applySurface(pixels.data,artifactPath,surface)
    entries.push({name:surface.name,kind:surface.kind,quad:surface.quad,occlusion:surface.occlusion??null,sourceCrop:surface.sourceCrop??null,excerptParagraphRange:surface.part??null,artifactPath:path.relative(root,artifactPath),artifactSha256:await hash(artifactPath),transform:'inverse 3x3 homography to physical quadrilateral; paper ink blends with photographed surface; screen pixels retain source presentation and subdued glare',faceClearanceReviewed:true})
  }
  await sharp(pixels.data,{raw:{width:1536,height:1024,channels:3}}).jpeg({quality:91,mozjpeg:true}).toFile(output+'.tmp');await fs.rename(output+'.tmp',output)
  row.sourceSha256=sourceHashes[row.source];row.sourceExcerpt=excerpt;row.sourceExcerptSha256=crypto.createHash('sha256').update(JSON.stringify(excerpt)).digest('hex');row.physicalSurfaces=entries
  row.basePhotoPath=path.relative(root,basePath);row.basePhotoSha256=await hash(basePath);row.outputPath=path.relative(root,output);row.outputSha256=await hash(output)
  row.placement='perspective-matched source content on physical paper, display, or workshop notes; no floating panel'
  row.compositeMethod='in-world source artwork warped to surveyed physical surface quads; paper ink multiplied through photographed texture or screen pixels blended with native glare'
  delete row.artifactPath;delete row.artifactSha256
}
map.version='2026-11-02-in-world-2'
map.sourcePolicy='Only owned Accelerated ebook passages or original SAM infographic pixels. Full cited paragraphs and original image crops replace abstract label-only callouts; no client data, invented metrics, floating panels, or generated analysis.'
await fs.writeFile(mapPath,JSON.stringify(map,null,2)+'\n')
