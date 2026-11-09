#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here=path.dirname(fileURLToPath(import.meta.url))
const audit=JSON.parse(readFileSync(path.join(here,'audit-boundaries.json'),'utf8'))
const dir=path.join(here,'walkthroughs'),segments=path.join(dir,'segments')
mkdirSync(segments,{recursive:true})
const samples=[]
for(let n=1;n<=16;n++){
  const id=`L${String(n).padStart(2,'0')}`
  const rows=audit.rows.filter(row=>row.scene_id.startsWith(`${id}-`))
  samples.push({id,time:n===1?37:Math.max(rows[0].start_seconds+2,rows[0].end_seconds-3),duration:n===1?3:1.5,kind:'opening visual'})
  samples.push({id,time:rows[3].midpoint_sample_seconds,duration:1.5,kind:'instructional scene'})
}
const l09=JSON.parse(readFileSync(path.join(here,'../l09-l12-native-composite/l09-composite-timeline.json'),'utf8'))
samples.push({id:'L09',time:l09.guided_work_countdown.sequence_start+10,duration:1.5,kind:'protected countdown'})
for(const mode of ['desktop','mobile']){
  const files=[]
  for(let i=0;i<samples.length;i++){
    const sample=samples[i],source=path.join(here,'composites',`${sample.id}-illustrated-review.mp4`),output=path.join(segments,`${mode}-${String(i).padStart(2,'0')}.mp4`)
    const vf=mode==='desktop'?'scale=1280:720:flags=lanczos,format=yuv420p':'split[a][b];[a]scale=720:405:flags=lanczos[full];[b]crop=720:507:1200:160[detail];color=c=#071b2a:s=720x1280:r=25[bg];[bg][full]overlay=0:150[top];[top][detail]overlay=0:580,format=yuv420p'
    const args=['-hide_banner','-loglevel','error','-y','-ss',String(sample.time),'-i',source,'-t',String(sample.duration),'-an','-vf',vf,'-r','25','-c:v','libx264','-preset','veryfast','-crf','20',output]
    execFileSync('ffmpeg',args,{stdio:'inherit'})
    files.push(output)
  }
  const concat=path.join(dir,`${mode}-concat.txt`)
  writeFileSync(concat,files.map(file=>`file '${file}'`).join('\n')+'\n')
  const output=path.join(dir,`agentified-l01-l16-${mode}-visual-walkthrough.mp4`)
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',concat,'-c','copy','-movflags','+faststart',output],{stdio:'inherit'})
  const duration=execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',output],{encoding:'utf8'}).trim()
  console.log(`${mode}: ${duration}s ${output}`)
}
writeFileSync(path.join(dir,'walkthrough-samples.json'),JSON.stringify({samples,mobile_treatment:'review-only full frame plus magnified right-side artwork; source lesson mobile playback remains 16:9',audio:'silent visual comparison; source lesson composites retain unchanged audio'},null,2)+'\n')
