import assert from 'node:assert/strict'

const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
const wrap=(s,max)=>{const lines=[];let line='';for(const word of s.split(/\s+/)){if((line+' '+word).trim().length>max&&line){lines.push(line);line=word}else line=(line+' '+word).trim()}if(line)lines.push(line);return lines}
const text=(s,x,y,size,max=24,color='#fff4df',weight=700)=>wrap(s,max).map((line,i)=>`<text x="${x}" y="${y+i*size*1.15}" fill="${color}" font-family="Arial,sans-serif" font-size="${size}" font-weight="${weight}">${esc(line)}</text>`).join('')
const rect=(x,y,w,h,fill,stroke='none',radius=20)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`
const progress=id=>{const n=Number(id.slice(-2));return `${rect(80,1020,1760,11,'#24424f','none',6)}${rect(80,1020,Math.round(1760*n/8),11,'#d7ad56','none',6)}`}
const baseOverlay=id=>`<rect width="1920" height="1080" fill="none" stroke="#d6ad56" stroke-width="3"/>${progress(id)}`

export function paddingOverlay(brief,auditScene,selectedKinds=null,variant=null){
 assert.equal(brief.scene_id,auditScene.sceneId)
 assert(variant===null||(['l06-01-mobile-controls-clear','l06-01-mobile-panel-only'].includes(variant)&&brief.scene_id==='L06-01'),'mobile variant is L06-01 only')
 const [a,b]=brief.visible_labels,headline=brief.headline
 const used=new Set(),decisions=[]
 const panel=(kind,fill,stroke,radius=20,color='#fff4df',weight=700)=>{
  const item=auditScene.panels.find(p=>p.kind===kind)
  assert(item && !used.has(kind),`${brief.scene_id}: missing or duplicate ${kind}`)
  used.add(kind)
  const old=item.containerPx,g=item.glyphBoundsPx,s=item.textSpec
  if(variant==='l06-01-mobile-panel-only'&&kind==='headline'){
   const box={x:46,y:20,width:490,height:370},lines=['A role','needs a','permission','slip.']
   assert.equal(lines.join(' '),brief.headline)
   decisions.push({kind,action:'mobile_reflow',old,box,paddingPx:28,lines,fontSizePx:s.size})
   return `${rect(box.x,box.y,box.width,box.height,fill,stroke,radius)}${lines.map((line,i)=>`<text x="74" y="${100+i*83}" fill="${color}" font-family="Arial,sans-serif" font-size="${s.size}" font-weight="${weight}">${esc(line)}</text>`).join('')}`
  }
  const fitted=selectedKinds===null||selectedKinds.includes(kind)
  if(!fitted){decisions.push({kind,action:'retained',old});return `${rect(old.x,old.y,old.width,old.height,fill,stroke,radius)}${renderText(item,s.x,s.y,color,weight)}`}
  const padding=28,box={x:old.x,y:variant==='l06-01-mobile-controls-clear'&&kind==='headline'?20:old.y,width:g.width+2*padding,height:g.height+2*padding}
  const x=s.x+(box.x+padding-g.x),y=s.y+(box.y+padding-g.y)
  assert(box.x>=0&&box.y>=0&&box.x+box.width<=1920&&box.y+box.height<=1080,`${brief.scene_id}: ${kind} beyond frame`)
  decisions.push({kind,action:'fitted',old,box,glyph:g,paddingPx:padding})
  return `${rect(box.x,box.y,box.width,box.height,fill,stroke,radius)}${renderText(item,x,y,color,weight)}`
 }
 const renderText=(item,x,y,color,weight)=>{
  const {size,max,lineHeight}=item.textSpec
  if(lineHeight)return item.lines.map((line,i)=>`<text x="${x}" y="${y+i*lineHeight}" fill="${color}" font-family="Arial,sans-serif" font-size="${size}" font-weight="${weight}">${esc(line)}</text>`).join('')
  return text(item.text,x,y,size,max,color,weight)
 }
 const label=(kind)=>panel(kind,'#0b2635ee','#cba854',16,'#f7ebd5')
 const plateLabel=(kind)=>panel(kind,'#0b2635','#cba854',16,'#f7ebd5')
 const headlinePanel=(fill,stroke,radius=22)=>panel('headline',fill,stroke,radius)
 const top=()=>headlinePanel('#071b2ae8','none',18)
 let body=''
 switch(brief.treatment){
  case 'master':body=`${headlinePanel('#071b2aeb','#d6ad56')}${a?label('label-a'):''}`;break
  case 'detail':body=`${headlinePanel('#071b2af2','#d6ad56')}${a?label('label-a'):''}${b?label('label-b'):''}`;break
  case 'boundary':body=`${headlinePanel('#071b2af0','#d6ad56')}<path d="M1550 240V880" stroke="#d2a45f" stroke-width="18" stroke-linecap="round"/>${a?label('label-a'):''}${b?label('label-b'):''}`;break
  case 'hold':body=`${headlinePanel('#101f2cf2','#dfad66',24)}<circle cx="1370" cy="560" r="170" fill="#092636dc" stroke="#d2a45f" stroke-width="17"/>${text('HOLD',1245,590,72,10,'#f3dfba')}${a?label('label-a'):''}`;break
  case 'choice':body=`${top()}${a?label('label-a'):''}${b?label('label-b'):''}`;break
  case 'compare':body=`${top()}<path d="M960 250V960" stroke="#d8b261" stroke-width="10"/>${a?label('label-a'):''}${b?label('label-b'):''}`;break
  case 'sequence':body=`${top()}<circle cx="565" cy="550" r="112" fill="none" stroke="#d6ae59" stroke-width="12"/><circle cx="1030" cy="550" r="112" fill="none" stroke="#d6ae59" stroke-width="12"/><circle cx="1495" cy="550" r="112" fill="none" stroke="#d6ae59" stroke-width="12"/>${a?label('label-a'):''}${b?label('label-b'):''}`;break
  case 'handoff':body=`${top()}${a?label('label-a'):''}${b?label('label-b'):''}<path d="M760 876H1130" stroke="#d6ae59" stroke-width="9" stroke-linecap="round"/>`;break
  case 'worksheet':body=`${rect(525,105,1260,850,'#f3e7cf','#c59f55',18)}${text(headline,615,235,66,33,'#17303b')}<path d="M615 295H1695" stroke="#d4ad61" stroke-width="6"/>${a?text(a,650,430,52,21,'#17303b'):''}${rect(635,465,1060,145,'#e3e8df','#b9c5c0',12)}${b?text(b,650,705,52,21,'#17303b'):''}${rect(635,742,1060,145,'#e3e8df','#b9c5c0',12)}`;break
  case 'file':body=`${rect(70,135,930,820,'#f0e1c4','#d6ad56',18)}${rect(125,197,820,105,'#d9b663','none',8)}${text('OPERATING FILE',165,266,48,23,'#17303b')}${text(headline,140,390,58,20,'#17303b')}${a?label('label-a'):''}${b?label('label-b'):''}`;break
  case 'plate':body=`${headlinePanel('#071b2af2','#d6ad56')}${a?plateLabel('label-a'):''}${b?plateLabel('label-b'):''}`;break
  default:throw new Error(`${brief.scene_id}: unknown treatment ${brief.treatment}`)
 }
 assert.equal(used.size,auditScene.panels.length,`${brief.scene_id}: unhandled audited panel`)
 return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">${baseOverlay(brief.scene_id)}${body}</svg>`,decisions}
}
