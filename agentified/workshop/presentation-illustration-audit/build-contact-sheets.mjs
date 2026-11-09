#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here=path.dirname(fileURLToPath(import.meta.url))
const dir=path.join(here,'frames/illustrated')
for(let n=1;n<=16;n++){
  const id=`L${String(n).padStart(2,'0')}`
  const tiles=[]
  for(let s=1;s<=8;s++){
    const scene=`${id}-${String(s).padStart(2,'0')}`
    const image=await sharp(path.join(dir,`${scene}.png`)).resize(640,360).png().toBuffer()
    tiles.push({input:image,left:((s-1)%4)*640,top:Math.floor((s-1)/4)*360})
  }
  await sharp({create:{width:2560,height:720,channels:3,background:'#071b2a'}}).composite(tiles).png().toFile(path.join(dir,`${id}-contact.png`))
}
console.log('Built 16 illustrated contact sheets')
