import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { JSDOM } from 'jsdom'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const qa = path.join(root, 'docs/qa/services-theme-speaking-visuals')
const packet = path.join(root, 'docs/qa/workshop-editorial-color-2026-11-02')
type Surface = { name: string; kind: string; quad: number[][]; occlusion: number[][] | null; sourceCrop: number[] | null; excerptParagraphRange: number[] | null; artifactPath: string; artifactSha256: string; faceClearanceReviewed: boolean }
type Frame = { slug: string; role: string; framework: string; chapter: string; source: string; sourceSha256: string; member: string | null; visibleLabels: string[]; sourceExcerpt: string[]; sourceExcerptSha256: string; physicalSurfaces: Surface[]; basePhotoPath: string; basePhotoSha256: string; compositeMethod: string; placement: string; outputPath: string; outputSha256: string }
const map = JSON.parse(readFileSync(path.join(packet, 'source-to-service-visual-map.json'), 'utf8')) as { frames: Frame[] }
const matrix = JSON.parse(readFileSync(path.join(qa, 'workshop-casting-matrix.json'), 'utf8')) as { assets: Array<{ slug: string; role: string; analysisSourcePath: string; analysisSourceSha256: string; analysisFramework: string; analysisPhysicalSurfaces: Surface[]; analysisSourceExcerptSha256: string; analysisCompositeMethod: string; analysisOutputSha256: string }> }
const inventory = JSON.parse(readFileSync(path.join(qa, 'asset-inventory.json'), 'utf8')) as Array<{ slug: string; role: string; sha256: string }>
const sha = (value: Buffer | string) => createHash('sha256').update(value).digest('hex')
const hash = (file: string) => sha(readFileSync(path.join(root, file)))
const sourceAllowlist = new Set(['accelerated_ebook_leadmagnet.epub', 'agentified/source-assets/accelerated/accelerated-sam-infographic.png'])
const faceBoxes: Record<string, number[][]> = {
  'ai-strategy-half-day:hero': [[0,250,400,650],[380,0,760,360]],
  'ai-strategy-half-day:secondary': [[0,180,480,620],[610,0,1020,350]],
  'ai-strategy-full-day:hero': [[0,250,370,620],[470,260,830,570],[850,40,1180,310],[1300,350,1535,670]],
  'ai-strategy-full-day:secondary': [[0,0,530,500],[520,0,1000,470]],
  'ai-strategy-recorded:hero': [[300,20,830,530]],
  'ai-strategy-recorded:secondary': [[0,0,650,470]],
  'accelerated-cohort-workshop:hero': [[430,100,850,530],[820,150,1280,570]],
  'accelerated-cohort-workshop:secondary': [[150,0,840,520],[850,0,1420,520]],
  'product-innovation-workshop:hero': [[0,100,500,600],[500,0,960,400],[1110,40,1535,430]],
  'product-innovation-workshop:secondary': [[0,150,360,620],[280,250,650,640],[570,0,980,340],[900,260,1280,680]],
}
const overlaps = (quad: number[][], box: number[]) => {
  const [x0,y0,x1,y1] = box
  const minX=Math.min(...quad.map(p=>p[0])),maxX=Math.max(...quad.map(p=>p[0]))
  const minY=Math.min(...quad.map(p=>p[1])),maxY=Math.max(...quad.map(p=>p[1]))
  return Math.max(minX,x0)<Math.min(maxX,x1) && Math.max(minY,y0)<Math.min(maxY,y1)
}
const physical = (frame: Frame) => sourceAllowlist.has(frame.source) && frame.physicalSurfaces.length>0 && frame.physicalSurfaces.every(s=>['paper','sticky','screen','phone'].includes(s.kind) && s.quad.length===4 && s.quad.every(p=>p.length===2 && p[0]>=0 && p[0]<=1536 && p[1]>=0 && p[1]<=1024)) && /physical paper, display, or workshop notes/.test(frame.placement) && !/floating|callout|full.bleed panel/i.test(frame.compositeMethod)

describe('source-bound in-world workshop gallery', () => {
  it('binds ten frames to exact owned source excerpts and physical surfaces', () => {
    expect(map.frames).toHaveLength(10)
    expect(new Set(map.frames.map(f=>`${f.slug}:${f.role}`)).size).toBe(10)
    for (const frame of map.frames) {
      const key=`${frame.slug}:${frame.role}`
      expect(physical(frame),key).toBe(true)
      expect(frame.chapter.length,key).toBeGreaterThan(18)
      expect(frame.sourceSha256,key).toBe(hash(frame.source))
      expect(frame.basePhotoSha256,key).toBe(hash(frame.basePhotoPath))
      expect(frame.outputSha256,key).toBe(hash(frame.outputPath))
      expect(frame.sourceExcerptSha256,key).toBe(sha(JSON.stringify(frame.sourceExcerpt)))
      for(const surface of frame.physicalSurfaces){
        expect(surface.artifactSha256,`${key}: ${surface.name}`).toBe(hash(surface.artifactPath))
        expect(surface.faceClearanceReviewed,`${key}: ${surface.name}`).toBe(true)
        for(const face of faceBoxes[key])expect(overlaps(surface.quad,face),`${key}: ${surface.name} blocks a face`).toBe(false)
      }
      if(frame.member){
        const html=execFileSync('unzip',['-p',path.join(root,frame.source),frame.member],{encoding:'utf8'})
        const chapter=[...new JSDOM(html).window.document.querySelectorAll('p')].map(p=>p.textContent?.replace(/\s+/g,' ').trim()).filter(Boolean)
        expect(frame.sourceExcerpt.length,key).toBeGreaterThanOrEqual(5)
        expect(frame.sourceExcerpt.join(' ').length,key).toBeGreaterThan(120)
        for(const paragraph of frame.sourceExcerpt)expect(chapter,`${key}: unsupported text`).toContain(paragraph)
        const covered=new Set(frame.physicalSurfaces.flatMap(s=>{const [start,end]=s.excerptParagraphRange??[0,0];return Array.from({length:end-start},(_,i)=>start+i)}))
        expect(covered.size,`${key}: simplified passage`).toBe(frame.sourceExcerpt.length)
      }else{
        expect(frame.source).toMatch(/accelerated-sam-infographic\.png$/)
        expect(frame.visibleLabels).toEqual(['SIGNALS','ALIGNMENT','MOMENTUM'])
        expect(frame.physicalSurfaces.some(s=>s.sourceCrop?.join(',')==='0,0,1136,944'),`${key}: original SAM presentation`).toBe(true)
        if(key==='accelerated-cohort-workshop:hero'){
          const phone=frame.physicalSurfaces.find(s=>s.kind==='phone')
          expect(phone?.sourceCrop,`${key}: distinct phone detail`).toEqual([405,120,345,650])
        }
      }
      const asset=matrix.assets.find(a=>`${a.slug}:${a.role}`===key)
      const item=inventory.find(a=>`${a.slug}:${a.role}`===key)
      expect(asset?.analysisSourcePath,key).toBe(frame.source)
      expect(asset?.analysisSourceSha256,key).toBe(frame.sourceSha256)
      expect(asset?.analysisFramework,key).toBe(frame.framework)
      expect(asset?.analysisPhysicalSurfaces,key).toEqual(frame.physicalSurfaces)
      expect(asset?.analysisSourceExcerptSha256,key).toBe(frame.sourceExcerptSha256)
      expect(asset?.analysisCompositeMethod,key).toBe(frame.compositeMethod)
      expect(asset?.analysisOutputSha256,key).toBe(frame.outputSha256)
      expect(item?.sha256,key).toBe(frame.outputSha256)
    }
  })

  it('keeps rendered changes within the photographed surface bounds', async () => {
    for(const frame of map.frames){
      const key=`${frame.slug}:${frame.role}`
      const base=await sharp(path.join(root,frame.basePhotoPath)).raw().toBuffer()
      const output=await sharp(path.join(root,frame.outputPath)).raw().toBuffer()
      let changed=0,outside=0
      for(let y=0;y<1024;y+=2)for(let x=0;x<1536;x+=2){
        const i=(y*1536+x)*3
        if(Math.max(...[0,1,2].map(c=>Math.abs(base[i+c]-output[i+c])))<45)continue
        changed++
        const near=frame.physicalSurfaces.some(s=>{const xs=s.quad.map(p=>p[0]),ys=s.quad.map(p=>p[1]);return x>=Math.min(...xs)-5&&x<=Math.max(...xs)+5&&y>=Math.min(...ys)-5&&y<=Math.max(...ys)+5})
        if(!near)outside++
      }
      expect(changed,key).toBeGreaterThan(100)
      expect(outside/changed,`${key}: artwork escapes physical surfaces`).toBeLessThan(.03)
    }
  })

  it('fails generic sources, face obstruction, missing surfaces, and simplified passages', () => {
    const valid=map.frames[0]
    expect(physical({...valid,source:'/tmp/generated-chart.png'})).toBe(false)
    expect(physical({...valid,physicalSurfaces:[]})).toBe(false)
    expect(physical({...valid,placement:'floating callout'})).toBe(false)
    expect(overlaps([[100,100],[400,100],[400,400],[100,400]],[200,200,300,300])).toBe(true)
    expect(valid.sourceExcerpt.length).toBeGreaterThan(valid.visibleLabels.length)
  })
})
