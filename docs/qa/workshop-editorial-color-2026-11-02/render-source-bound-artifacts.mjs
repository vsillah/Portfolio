import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'

const root = process.cwd()
const qa = path.join(root, 'docs/qa/workshop-editorial-color-2026-11-02')
const mapPath = path.join(qa, 'source-to-service-visual-map.json')
const map = JSON.parse(await fs.readFile(mapPath, 'utf8'))
const sourceImage = path.join(root, 'agentified/source-assets/accelerated/accelerated-sam-infographic.png')
const sourceBook = path.join(root, 'accelerated_ebook_leadmagnet.epub')
const hash = async (file) => crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex')
const escape = (s) => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
const configs = {
  'ai-strategy-half-day:hero': {x:455,y:805,w:550,h:180,style:'horizontal',affine:[[1,-0.13],[0.04,0.65]]},
  'ai-strategy-half-day:secondary': {x:1260,y:65,w:255,h:630,style:'vertical',displayTitle:'Roadmap bet'},
  'ai-strategy-full-day:hero': {x:440,y:725,w:590,h:230,style:'grid',displayTitle:'Decision Theater',affine:[[1,-0.13],[0.04,0.68]]},
  'ai-strategy-full-day:secondary': {x:650,y:85,w:560,h:470,style:'board',displayTitle:'Metrics Ladder'},
  'ai-strategy-recorded:hero': {x:1170,y:345,w:290,h:220,style:'sam-screen',displayTitle:'SAM lesson'},
  'ai-strategy-recorded:secondary': {x:1080,y:342,w:305,h:190,style:'screen',displayTitle:'Learning Plan',paper:{x:660,y:590,w:310,h:260}},
  'accelerated-cohort-workshop:hero': {x:470,y:825,w:600,h:185,style:'horizontal',displayTitle:'Accelerated · SAM',samSource:{x:895,y:75,w:245,h:195},affine:[[1,-0.15],[0.04,0.7]]},
  'accelerated-cohort-workshop:secondary': {x:702,y:530,w:220,h:260,style:'vertical',displayTitle:'Learning Roadmap'},
  'product-innovation-workshop:hero': {x:485,y:825,w:645,h:185,style:'horizontal',displayTitle:'Jobs from Noise',phone:{x:756,y:415,w:95,h:252},affine:[[1,-0.15],[0.04,0.7]]},
  'product-innovation-workshop:secondary': {x:535,y:8,w:665,h:530,style:'wall-notes'}
}
function svg(row,c) {
  const {w,h,style}=c, title=c.displayTitle || row.framework, labels=row.visibleLabels
  const base=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
  if(style==='wall-notes') {
    const notes=[
      [80,175,195,65,labels[0]], [300,135,220,65,labels[1]],
      [100,300,225,65,labels[2]], [350,345,210,65,labels[3]]
    ]
    return `${base}<rect x="0" y="0" width="625" height="80" rx="8" fill="#fffdf8" fill-opacity=".96" stroke="#a8a59b" stroke-width="2"/><text x="20" y="52" font-family="Arial,sans-serif" font-size="45" font-weight="700" fill="#253341">${escape(title)}</text>${notes.map(([x,y,nw,nh,l],i)=>`<rect x="${x}" y="${y}" width="${nw}" height="${nh}" rx="3" fill="${['#f2d6c5','#e7eddc','#f3e9d2','#dce8df'][i]}" stroke="#a7a49a"/><text x="${x+12}" y="${y+42}" font-family="Arial,sans-serif" font-size="${l.length>18?24:29}" font-weight="700" fill="#253341">${escape(l)}</text>`).join('')}</svg>`
  }
  const titleSize=style==='vertical'?Math.min(31,Math.floor((w-28)/(title.length*.57))):style==='screen'?27:style==='board'?48:style==='sam-screen'?31:Math.min(44,title.length>28?38:44)
  let body=''
  if(style==='vertical'){
    const top=105,step=(h-top-28)/labels.length
    body=labels.map((l,i)=>`<rect x="12" y="${top+i*step}" width="${w-24}" height="${step-11}" rx="7" fill="${i%2?'#ecf0e8':'#f4ece3'}"/><text x="24" y="${top+i*step+step*.60}" font-family="Arial,sans-serif" font-size="${l.length>16?22:28}" font-weight="700" fill="#22313c">${escape(l)}</text>`).join('')
  } else if(style==='grid'){
    body=labels.map((l,i)=>{const col=i%3,rowNum=Math.floor(i/3),cw=(w-42)/3,x=14+col*(cw+7),y=95+rowNum*64;return `<rect x="${x}" y="${y}" width="${cw}" height="56" rx="7" fill="${rowNum?'#e8eee7':'#eee8df'}"/><text x="${x+10}" y="${y+38}" font-family="Arial,sans-serif" font-size="${l.length>12?22:26}" font-weight="700" fill="#22313c">${escape(l)}</text>`}).join('')
  } else if(style==='board'){
    body=labels.map((l,i)=>{const [x,y,bw]=[[320,125,230],[22,200,270],[310,325,235]][i];return `<rect x="${x}" y="${y}" width="${bw}" height="68" rx="4" fill="${['#e9eee9','#f2e9dd','#e8e6ef'][i]}" stroke="#9ea69e"/><text x="${x+12}" y="${y+45}" font-family="Arial,sans-serif" font-size="${l.length>14?28:34}" font-weight="700" fill="#22313c">${escape(l)}</text>`}).join('')
  } else if(style==='screen' || style==='sam-screen'){
    body=labels.map((l,i)=>{const y=70+i*(h-80)/labels.length;return `<rect x="12" y="${y}" width="${w-24}" height="${(h-80)/labels.length-5}" rx="3" fill="${i%2?'#e9eee7':'#eee8de'}"/><text x="20" y="${y+(h-80)/labels.length*.67}" font-family="Arial,sans-serif" font-size="${l.length>14?17:21}" font-weight="700" fill="#22313c">${escape(l)}</text>`}).join('')
  } else {
    const y=93,boxW=(w-32-(labels.length-1)*7)/labels.length
    body=labels.map((l,i)=>`<rect x="${16+i*(boxW+7)}" y="${y}" width="${boxW}" height="${h-y-18}" rx="8" fill="${i%2?'#e8eee7':'#f3e9dd'}"/><text x="${23+i*(boxW+7)}" y="${y+Math.min(75,(h-y)/2+8)}" font-family="Arial,sans-serif" font-size="${Math.min(25,Math.floor((boxW-13)/(l.length*.57)))}" font-weight="700" fill="#22313c">${escape(l)}</text>`).join('')
  }
  return `${base}${style==='board'?'<rect x="20" y="12" width="515" height="80" rx="4" fill="#fffdf8" fill-opacity=".96" stroke="#a4a297"/>':`<rect x="1" y="1" width="${w-2}" height="${h-2}" rx="9" fill="#fffdf8" fill-opacity=".97" stroke="#a4a297" stroke-width="2"/><rect x="1" y="1" width="${w-2}" height="9" rx="4" fill="#ae8c43"/>`}<text x="${style==='board'?38:18}" y="${style==='vertical'?57:style==='screen'?42:style==='sam-screen'?43:62}" font-family="Arial,sans-serif" font-size="${titleSize}" font-weight="700" fill="#22313c">${escape(title)}</text>${body}</svg>`
}
const sourceHashes={
  'accelerated_ebook_leadmagnet.epub':await hash(sourceBook),
  'agentified/source-assets/accelerated/accelerated-sam-infographic.png':await hash(sourceImage)
}
for(const row of map.frames){
  const key=`${row.slug}:${row.role}`,c=configs[key]
  if(!c)throw new Error('No placement '+key)
  const file=`${row.slug}-${row.role}`
  const artifactPath=path.join(qa,'source-artifacts',`${file}.svg`)
  await fs.writeFile(artifactPath,svg(row,c)+'\n')
  const overlay=c.affine?await sharp(await fs.readFile(artifactPath)).affine(c.affine,{background:'#00000000'}).png().toBuffer():await sharp(await fs.readFile(artifactPath)).png().toBuffer()
  const composites=[{input:overlay,left:c.x,top:c.y}]
  if(c.paper){const scaled=await sharp(overlay).resize(c.paper.w,c.paper.h,{fit:'fill'}).png().toBuffer();composites.push({input:scaled,left:c.paper.x,top:c.paper.y})}
  if(c.samSource){const img=await sharp(sourceImage).resize(c.samSource.w,c.samSource.h,{fit:'fill'}).png().toBuffer();composites.push({input:img,left:c.samSource.x,top:c.samSource.y})}
  if(c.phone){const panel=Buffer.from(`<svg width="${c.phone.w}" height="${c.phone.h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f8f7f2"/><text x="7" y="40" font-size="20" font-weight="700" font-family="Arial">JOB</text><text x="7" y="105" font-size="17" font-weight="700" font-family="Arial">STEPS</text><text x="7" y="170" font-size="16" font-weight="700" font-family="Arial">OUTCOME</text></svg>`);composites.push({input:panel,left:c.phone.x,top:c.phone.y})}
  const base=path.join(qa,'base-natural-color',`${file}.jpg`)
  const output=path.join(root,'public/showcases/service-photographic',`${file}.jpg`)
  await sharp(base).composite(composites).jpeg({quality:91,mozjpeg:true}).toFile(output+'.tmp')
  await fs.rename(output+'.tmp',output)
  row.sourceSha256=sourceHashes[row.source]
  row.artifactPath=path.relative(root,artifactPath)
  row.artifactSha256=await hash(artifactPath)
  row.basePhotoPath=path.relative(root,base)
  row.basePhotoSha256=await hash(base)
  row.compositeMethod=`sharp SVG overlay on owned-source-derived worksheet at (${c.x},${c.y},${c.w},${c.h})${c.affine?` affine ${JSON.stringify(c.affine)}`:''}${c.samSource?' plus source infographic pixel placement':''}${c.paper?' plus worksheet placement':''}${c.phone?' plus phone screen labels':''}`
  row.outputPath=path.relative(root,output)
  row.outputSha256=await hash(output)
}
await fs.writeFile(mapPath,JSON.stringify(map,null,2)+'\n')
