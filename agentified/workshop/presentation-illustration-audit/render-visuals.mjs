#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')
const frameDir = path.join(here, 'frames/illustrated')
mkdirSync(frameDir, { recursive: true })
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const clean = value => String(value).replace(/`/g, '').replaceAll('_', ' ').replace(/→|->/g, ' then ').replace(/≠/g, 'is not').replace(/\s+\+\s+/g, ' and ').replace(/\b(?:SYN|QA|fixture|synthetic|source handling|operator note)\b/gi, '').replace(/\s+/g, ' ').trim()
const wrap = (text, limit = 27) => {
  const words = clean(text).split(/\s+/)
  const lines = []; let current = ''
  for (const word of words) {
    if (`${current} ${word}`.trim().length <= limit) current = `${current} ${word}`.trim()
    else { if (current) lines.push(current); current = word }
  }
  if (current) lines.push(current)
  return lines.slice(0, 4)
}
const txt = (value, x, y, size, color, max = 27, weight = 600, lineHeight = 1.18, anchor = 'start') => wrap(value, max).map((line, i) => `<text x="${x}" y="${y + i * size * lineHeight}" fill="${color}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${esc(line)}</text>`).join('')
const palettes = [
  ['#d7ad56','#cfe0e4','#efdfbf'], ['#daa761','#bdd9d0','#f2e3c8'], ['#c4b476','#c8d9e8','#eee0c3'], ['#d5a970','#c5d5cf','#f4e5c8'],
  ['#d5ac58','#c5d8db','#ece0c7'], ['#b7bd7b','#c5d9dc','#f2e4c8'], ['#d5a77b','#bfd2db','#e9dec6'], ['#d4b569','#c6d9d6','#f1e1c5'],
  ['#d1a35f','#c6d9dc','#f0dfc2'], ['#d9af76','#bdd7d6','#f2e2c3'], ['#d2a84e','#bed4df','#f1e5c9'], ['#c9b37c','#c3d8d9','#efe1c6'],
  ['#d7ac65','#c8d7d1','#f0e0c2'], ['#c6a97c','#c9d6da','#f0e1c6'], ['#d6aa5f','#c7d9d2','#f1e3c8'], ['#d2b26e','#c0d6d8','#f0e0c6'],
]

function labels(scene) {
  const copy = scene.audience_copy.join(' • ')
  let parts = copy.split(/\s*(?:→|->|•|\/)\s*/).map(clean).filter(Boolean)
  if (parts.length < 2) {
    const words = clean(scene.narration_exact.replace(/[“”]/g, '')).split(/[.!?]/).map(v => v.trim()).filter(Boolean)
    parts = [clean(scene.audience_copy[0] || ''), ...words.slice(0, 3).map(v => v.split(' ').slice(0, 5).join(' '))]
  }
  return [...new Set(parts.map(v => v.replace(/[.:;,]$/, '').trim()).filter(Boolean))].slice(0, 5)
}

function base(id, accent) {
  return `<rect width="1920" height="1080" fill="#071b2a"/><rect x="48" y="42" width="1824" height="996" rx="24" fill="#0d2a3a" stroke="#59717a" stroke-width="2"/><line x1="90" y1="104" x2="1830" y2="104" stroke="${accent}" stroke-width="3"/><text x="92" y="80" fill="#f5eddb" font-family="Arial" font-size="24" font-weight="700">AMADUTOWN / AGENTIFIED</text><text x="1670" y="80" fill="${accent}" font-family="Arial" font-size="23" font-weight="700">${id.slice(0,3)}</text><rect x="100" y="1000" width="1720" height="16" rx="8" fill="#29424e"/><rect x="100" y="1000" width="${Math.round(Number(id.slice(-2)) * 1720 / 8)}" height="16" rx="8" fill="${accent}"/>`
}
function paper(x,y,w,h,angle,fill,accent) {
  return `<g transform="rotate(${angle} ${x+w/2} ${y+h/2})"><rect x="${x+11}" y="${y+12}" width="${w}" height="${h}" rx="6" fill="#071722" opacity="0.45"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="${accent}" stroke-width="3"/><path d="M${x+25} ${y+28}H${x+w-25}" stroke="${accent}" stroke-width="3" opacity="0.55"/><path d="M${x+25} ${y+h-30}H${x+w-25}" stroke="${accent}" stroke-width="2" opacity="0.4"/></g>`
}
function node(x,y,w,h,label,accent,pale,shape='round') {
  const rx = shape === 'paper' ? 4 : 25
  const size = h <= 100 ? 30 : 35
  const short = clean(label).split(' ').slice(0, h <= 100 ? 3 : 4).join(' ')
  const lines = wrap(short, Math.floor(w / (size * .55))).slice(0, h <= 100 ? 2 : 3)
  const firstY = y + h / 2 - (lines.length - 1) * size * .56 + size * .34
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${pale}" stroke="${accent}" stroke-width="3"/>${lines.map((line,i)=>`<text x="${x+w/2}" y="${firstY+i*size*1.12}" fill="#152d39" font-family="Arial, sans-serif" font-size="${size}" font-weight="700" text-anchor="middle">${esc(line)}</text>`).join('')}`
}
function openingMotif(lessonIndex, accent, pale) {
  const id = lessonIndex + 1
  const field = `<rect x="735" y="190" width="1080" height="700" rx="18" fill="#102d3c" stroke="${accent}" stroke-width="4"/>`
  if (id === 2) return `${field}${node(1135,245,335,140,'A decision',accent,pale)}<path d="M1302 385V485M940 485H1670M940 485V560M1670 485V560" fill="none" stroke="${accent}" stroke-width="9"/>${node(790,565,310,150,'Propose',accent,'#d7e5df')}${node(1145,565,310,150,'Revise',accent,pale)}${node(1500,565,255,150,'Hold',accent,'#d7e5df')}`
  if (id === 3) return `${field}${paper(790,255,275,445,-5,pale,accent)}${paper(1120,265,275,445,3,'#d7e5df',accent)}<circle cx="1590" cy="495" r="175" fill="none" stroke="${accent}" stroke-width="28"/><path d="M1710 620l105 110" stroke="${accent}" stroke-width="29" stroke-linecap="round"/>${txt('Claim',820,365,51,'#17313c',9,700)}${txt('Source',1150,365,51,'#17313c',9,700)}<path d="M1460 490h120" stroke="${accent}" stroke-width="8" stroke-dasharray="9 12"/>`
  if (id === 4) return `${field}${paper(825,240,410,510,-4,pale,accent)}${paper(1310,260,410,510,4,'#d7e5df',accent)}<path d="M1240 320c125-100 230-60 270 5M1310 720c-125 95-230 65-270 0" fill="none" stroke="${accent}" stroke-width="9" stroke-linecap="round"/><circle cx="1280" cy="500" r="76" fill="#103543" stroke="${accent}" stroke-width="8"/>${txt('Correction',855,350,42,'#17313c',15,700)}${txt('Memory',1360,370,42,'#17313c',15,700)}`
  if (id === 5) return `${field}<path d="M835 670C980 620 945 330 1110 320S1325 670 1480 630 1605 340 1715 390" fill="none" stroke="${accent}" stroke-width="17" stroke-linecap="round"/>${[[835,670],[1110,320],[1480,630],[1715,390]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="45" fill="${pale}" stroke="${accent}" stroke-width="8"/>`).join('')}${txt('Request',790,785,39,'#f2e6cd',12,700)}${txt('Source',1060,245,39,'#f2e6cd',12,700)}${txt('Review',1430,745,39,'#f2e6cd',12,700)}`
  if (id === 6) return `${field}${paper(790,290,395,460,-3,pale,accent)}<path d="M1295 220v610M1525 220v610" stroke="${accent}" stroke-width="20"/><path d="M1295 255h230M1295 795h230" stroke="${accent}" stroke-width="14"/>${node(1340,435,435,160,'Human owner',accent,'#d7e5df')}${txt('Permission',845,405,44,'#17313c',13,700)}`
  if (id === 7) return `${field}<path d="M930 480H1600M1255 400V620" stroke="${accent}" stroke-width="10"/>${[[900,480],[1255,340],[1600,480],[1255,680]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="120" fill="${pale}" stroke="${accent}" stroke-width="7"/>`).join('')}${txt('Source',900,490,38,'#17313c',10,700,1.1,'middle')}${txt('Draft',1255,350,38,'#17313c',10,700,1.1,'middle')}${txt('Review',1600,490,38,'#17313c',10,700,1.1,'middle')}${txt('Owner',1255,690,38,'#17313c',10,700,1.1,'middle')}`
  if (id === 8) return `${field}${paper(790,255,300,500,-3,pale,accent)}${paper(1120,255,300,500,0,'#d7e5df',accent)}${paper(1450,255,300,500,3,pale,accent)}${txt('Review',825,375,42,'#17313c',9,700)}${txt('Hold',1165,375,42,'#17313c',9,700)}${txt('Reject',1490,375,42,'#17313c',9,700)}<circle cx="940" cy="580" r="65" fill="#123d48"/><circle cx="1270" cy="580" r="65" fill="#a77c37"/><circle cx="1600" cy="580" r="65" fill="#7e594e"/>`
  if (id === 9) return `${field}${[0,1,2,3,4].map((i)=>`<rect x="${825+i*185}" y="${710-i*85}" width="140" height="${140+i*85}" fill="${i%2?pale:'#d7e5df'}" stroke="${accent}" stroke-width="4"/>`).join('')}<path d="M820 785H1750" stroke="${accent}" stroke-width="9"/>${txt('Evidence',805,275,42,'#f2e6cd',14,700)}${txt('Decision',1515,275,42,'#f2e6cd',14,700)}`
  if (id === 10) return `${field}${paper(860,280,730,500,0,pale,accent)}<path d="M860 310l365 270 365-270" fill="none" stroke="${accent}" stroke-width="9"/><circle cx="1225" cy="590" r="90" fill="#113543" stroke="${accent}" stroke-width="8"/><path d="M1190 590h70M1225 555v70" stroke="${accent}" stroke-width="12"/>${txt('Spend envelope',920,390,46,'#17313c',24,700)}`
  if (id === 11) return `${field}<circle cx="1275" cy="535" r="260" fill="#123b48" stroke="${accent}" stroke-width="9"/>${[0,1,2,3].map(i=>{let x=1275+Math.cos(i*Math.PI/2)*340,y=535+Math.sin(i*Math.PI/2)*280;return `<circle cx="${x}" cy="${y}" r="92" fill="${pale}" stroke="${accent}" stroke-width="7"/>`}).join('')}${txt('Status',1275,530,47,'#f2e6cd',12,700,1.1,'middle')}${txt('Next step',1275,590,40,'#f2e6cd',15,700,1.1,'middle')}`
  if (id === 12) return `${field}${paper(860,220,700,600,-3,pale,accent)}${paper(1000,260,700,600,3,'#d7e5df',accent)}<rect x="1100" y="360" width="500" height="140" rx="9" fill="#173c48"/>${txt('Scoped proof',1130,450,51,'#f1e4cc',16,700)}<path d="M1100 570H1600M1100 630H1540M1100 690H1460" stroke="${accent}" stroke-width="8"/>`
  if (id === 13) return `${field}${paper(825,220,790,620,-2,pale,accent)}${txt('Proposal',895,355,52,'#17313c',16,700)}<path d="M900 440H1510M900 540H1510M900 640H1510" stroke="${accent}" stroke-width="6"/><circle cx="1580" cy="745" r="82" fill="#133846" stroke="${accent}" stroke-width="8"/>${txt('NOT RUN',1580,757,31,'#f1e4cc',12,700,1.1,'middle')}`
  if (id === 14) return `${field}${[['Queue',780],['Trace',1125],['Memory',1470]].map(([name,x],i)=>`${paper(x,280,285,470,i*3-3,i%2?pale:'#d7e5df',accent)}${txt(name,x+25,385,45,'#17313c',9,700)}<circle cx="${x+145}" cy="620" r="58" fill="#153b48" stroke="${accent}" stroke-width="6"/>`).join('')}`
  if (id === 15) return `${field}<circle cx="1275" cy="535" r="300" fill="none" stroke="${accent}" stroke-width="12"/>${[0,1,2,3,4,5].map(i=>{let x=1275+Math.cos(i*Math.PI/3-Math.PI/2)*300,y=535+Math.sin(i*Math.PI/3-Math.PI/2)*300;return `<circle cx="${x}" cy="${y}" r="72" fill="${i%2?pale:'#d7e5df'}" stroke="${accent}" stroke-width="6"/><text x="${x}" y="${y+15}" fill="#17313c" font-family="Arial" font-size="46" font-weight="700" text-anchor="middle">${i+1}</text>`}).join('')}<circle cx="1275" cy="535" r="125" fill="#173b48"/>${txt('Human judgment',1275,525,37,'#f1e4cc',17,700,1.2,'middle')}`
  return `${field}${paper(845,220,850,620,-2,pale,accent)}${['Source','Event','Proposal','Memory','Owner'].map((label,i)=>`<circle cx="945" cy="${333+i*105}" r="29" fill="${i===4?'#9b665a':'#173b48'}" stroke="${accent}" stroke-width="4"/>${txt(label,1010,348+i*105,43,'#17313c',20,700)}<path d="M1260 ${345+i*105}H1600" stroke="${accent}" stroke-width="4" opacity=".6"/>`).join('')}`
}
function artwork(scene, lessonIndex, labelList, accent, muted, pale) {
  const n = Number(scene.id.slice(-2))
  const seed = lessonIndex % 4
  const a = labelList[0] || 'Source'
  const b = labelList[1] || 'Review'
  const c = labelList[2] || 'Decision'
  const d = labelList[3] || 'Record'
  const e = labelList[4] || 'Next step'
  if (scene.id === 'L15-05') return `${paper(780,230,430,590,-3,pale,accent)}${paper(1270,230,430,590,3,'#d7e5df',accent)}${txt('Recover',830,340,48,'#17313c',14,700)}${txt('Preserve',830,470,38,'#17313c',14,600)}${txt('Correct',830,565,38,'#17313c',14,600)}${txt('Trace',830,660,38,'#17313c',14,600)}${txt('Learn',1320,340,48,'#17313c',14,700)}${txt('Proposal',1320,490,38,'#17313c',14,600)}${txt('Review',1320,610,38,'#17313c',14,600)}`
  if (scene.id === 'L16-06') return `${paper(760,270,295,450,-3,pale,accent)}${paper(1100,270,295,450,0,'#d7e5df',accent)}${paper(1440,270,295,450,3,pale,accent)}${txt('Keep',810,400,46,'#17313c',10,700)}${txt('Shrink',1150,400,46,'#17313c',10,700)}${txt('Retire',1490,400,46,'#17313c',10,700)}<path d="M840 535H970M1180 535H1310M1520 535H1650" stroke="${accent}" stroke-width="9"/>`
  if (n === 7) return `${paper(760,235,940,600,-1,pale,accent)}<rect x="825" y="310" width="810" height="102" rx="8" fill="#d7e0dc"/>${txt(a,870,374,40,'#17313c',30,700)}<circle cx="885" cy="485" r="29" fill="${accent}"/>${txt(b,945,497,32,'#17313c',29,600)}<path d="M950 515H1575" stroke="#9eaaac" stroke-width="3"/><circle cx="885" cy="605" r="29" fill="${accent}"/>${txt(c,945,617,32,'#17313c',29,600)}<path d="M950 635H1575" stroke="#9eaaac" stroke-width="3"/><circle cx="885" cy="725" r="29" fill="${accent}"/>${txt(d,945,737,32,'#17313c',29,600)}<path d="M950 755H1575" stroke="#9eaaac" stroke-width="3"/>`
  if (n === 8) return `${paper(830,190,790,670,seed-2,pale,accent)}<rect x="885" y="255" width="680" height="82" rx="6" fill="${accent}"/>${txt('OPERATING FILE',920,310,34,'#102634',25,700)}${node(905,405,610,95,a,accent,'#d7e5e3')}${node(905,535,610,95,b,accent,'#e8dfc9')}${node(905,665,610,95,c,accent,'#d7e5e3')}<circle cx="1575" cy="790" r="74" fill="#123748" stroke="${accent}" stroke-width="6"/><path d="M1540 787l23 22 45-54" fill="none" stroke="${accent}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`
  if (n === 1) return openingMotif(lessonIndex,accent,pale)
  if (n === 2 || /→|->/.test(scene.audience_copy.join(' '))) {
    const positions = seed % 2 ? [[760,240],[1190,240],[760,565],[1190,565]] : [[810,230],[1220,230],[810,570],[1220,570]]
    const connector = `<path d="M${positions[0][0]+310} ${positions[0][1]+86}H${positions[1][0]-15}M${positions[1][0]+160} ${positions[1][1]+175}V${positions[3][1]-12}M${positions[0][0]+150} ${positions[0][1]+175}V${positions[2][1]-12}M${positions[2][0]+310} ${positions[2][1]+86}H${positions[3][0]-15}" fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>`
    return `${connector}${node(...positions[0],310,175,a,accent,pale)}${node(...positions[1],310,175,b,accent,'#d7e4e0')}${node(...positions[2],310,175,c,accent,'#d7e4e0')}${node(...positions[3],310,175,d,accent,pale)}<circle cx="1790" cy="800" r="23" fill="${accent}"/>`
  }
  if (n === 3 || n === 4) return `${paper(785,205,800,650,seed-1,pale,accent)}<circle cx="940" cy="382" r="65" fill="#123e4b" stroke="${accent}" stroke-width="5"/><text x="940" y="397" fill="${accent}" font-family="Arial" font-size="43" font-weight="700" text-anchor="middle">01</text>${txt(a,1040,385,35,'#17313c',22,700)}<path d="M845 485H1520" stroke="${accent}" stroke-width="3"/><circle cx="940" cy="585" r="65" fill="#123e4b" stroke="${accent}" stroke-width="5"/><text x="940" y="600" fill="${accent}" font-family="Arial" font-size="43" font-weight="700" text-anchor="middle">02</text>${txt(b,1040,588,35,'#17313c',22,700)}<path d="M845 690H1520" stroke="${accent}" stroke-width="3"/><circle cx="940" cy="785" r="56" fill="#123e4b" stroke="${accent}" stroke-width="5"/><text x="940" y="800" fill="${accent}" font-family="Arial" font-size="40" font-weight="700" text-anchor="middle">03</text>${txt(c,1040,785,32,'#17313c',22,700)}`
  return `${paper(775,225,510,580,-3,pale,accent)}${paper(1210,255,510,580,3,'#d6e4e1',accent)}<circle cx="1275" cy="530" r="48" fill="${accent}"/><path d="M1254 530l16 17 30-36" fill="none" stroke="#16303b" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>${txt(a,840,372,37,'#17313c',15,700)}${txt(b,1270,405,37,'#17313c',15,700)}${txt(c,840,645,30,'#17313c',19,600)}${txt(d,1270,685,30,'#17313c',19,600)}`
}

const receipts = []
for (let n = 1; n <= 16; n += 1) {
  const id = `L${String(n).padStart(2, '0')}`
  const packet = JSON.parse(readFileSync(path.join(root, `agentified/workshop/scene-production/packets/${id}.json`), 'utf8'))
  const [accent, muted, pale] = palettes[n-1]
  for (const scene of packet.scenes) {
    const output = path.join(frameDir, `${scene.id}.png`)
    if (scene.id === 'L01-01') {
      copyFileSync(path.join(here, 'frames/l01-01-corrected-proposal.png'), output)
      receipts.push({ scene_id: scene.id, frame_path: path.relative(root, output), frame_sha256: sha(output), visual_family: 'paper-source editorial illustration', source_path: path.relative(root, path.join(here, 'assets/l01-paper-source-table-v1.png')), source_sha256: sha(path.join(here, 'assets/l01-paper-source-table-v1.png')), source_rights: 'user-authorized original Agentified L01 remediation', display_copy: ['A suggestion needs a source.', 'Harbor Learning Circle'], accessibility_text: 'Three paper source notes for attendance, facilitator availability, and room capacity connect to a proposed brief through a visible gold evidence trail.' })
      continue
    }
    const parts = scene.id === 'L16-06' ? ['Keep','Shrink','Retire','Name the reason'] : labels(scene)
    const rawHeadline = scene.audience_copy[0] || packet.title
    const headline = scene.id === 'L16-06' ? 'Keep, shrink, or retire?' : scene.id === 'L15-05' ? 'Recover. Learn.' : /→|->|[•/]|\b[a-z]+_[a-z_]+\b/.test(rawHeadline) ? parts[0] : clean(rawHeadline)
    const subtitle = scene.id === 'L16-06' || scene.id === 'L15-05' ? '' : scene.audience_copy.slice(1).map(clean).filter(v => !/fixture|synthetic|internal|source handling|qa|prompt/i.test(v)).join(' ')
    let body = artwork(scene, n-1, parts, accent, muted, pale)
    const visual = scene.approved_visuals[0]?.path
    let compositing = []
    if (visual) {
      body = `<rect x="735" y="170" width="1085" height="760" rx="18" fill="#102a39" stroke="${accent}" stroke-width="4"/>`
      const source = path.join(root, visual)
      const metadata = await sharp(source).metadata()
      const plate = await sharp(source).resize({ width: 1050, height: 725, fit: 'contain', background: '#102a39' }).png().toBuffer()
      compositing = [{ input: plate, left: 752, top: 187 }]
      receipts.push({ scene_id: scene.id, frame_path: path.relative(root, output), visual_family: 'integrated approved publication plate', source_path: visual, source_sha256: sha(source), source_rights: 'approved for this bound Agentified lesson use', source_dimensions: `${metadata.width}x${metadata.height}`, accessibility_text: `Approved ${packet.title} diagram illustrating ${parts.slice(0,3).join(', ')}.` })
    } else {
      receipts.push({ scene_id: scene.id, frame_path: path.relative(root, output), visual_family: `editorial paper diagram ${Number(scene.id.slice(-2))}`, source_path: null, source_sha256: null, source_rights: 'original project-local vector illustration for Agentified remediation', accessibility_text: `Illustrated ${packet.title} teaching artifact: ${parts.slice(0,3).join('; ')}.` })
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">${base(scene.id,accent)}<text x="104" y="170" fill="${accent}" font-family="Arial" font-size="22" font-weight="700" letter-spacing="3">${esc(packet.title.toUpperCase())}</text>${txt(headline,104,265,58,'#f5eddb',20,700)}${subtitle ? txt(subtitle,108,530,31,muted,31,500) : ''}<path d="M105 704H570" stroke="${accent}" stroke-width="4"/>${body}</svg>`
    await sharp(Buffer.from(svg)).composite(compositing).png().toFile(output)
    receipts.at(-1).frame_sha256 = sha(output)
    receipts.at(-1).display_copy = [packet.title, headline, subtitle, ...parts].filter(Boolean)
  }
}
writeFileSync(path.join(here, 'visual-receipts.json'), JSON.stringify({ schema_version: 1, source_commit: 'f0931f3860e042507ee5aba83f220eb57cfd3eb5', frames: receipts }, null, 2) + '\n')
console.log(`Rendered ${receipts.length} scene visuals`)
