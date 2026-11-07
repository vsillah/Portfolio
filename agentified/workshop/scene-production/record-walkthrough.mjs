import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const here = path.dirname(fileURLToPath(import.meta.url))
const output = path.join(here, 'qa')
const revision = process.argv[2]
if (!/^[0-9a-f]{40}$/.test(revision ?? '')) throw new Error('Pass the exact Git commit SHA')
mkdirSync(output, { recursive: true })
const base = 'http://127.0.0.1:4173/agentified/workshop/scene-production/review.html'
const browser = await chromium.launch({ headless: true })

async function record(name, viewport, lessons) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce', recordVideo: { dir: output, size: viewport } })
  const page = await context.newPage()
  for (const lesson of lessons) {
    await page.goto(`${base}?lesson=${lesson}&rev=${revision}`)
    await page.waitForFunction((id) => document.querySelector('#scene-label')?.textContent?.startsWith(id), lesson)
    const packet = await page.evaluate(async (id) => (await (await fetch(`packets/${id}.json`)).json()), lesson)
    await page.waitForTimeout(350)
    const visualScene = packet.scenes.find((scene) => scene.approved_visuals.length)
    await page.locator('#seek').fill(String(visualScene.start_seconds))
    await page.locator('#visual img').evaluate((img) => img.decode())
    await page.waitForTimeout(name === 'mobile' ? 1600 : 1400)
    await page.locator('#seek').fill(String(packet.scenes[7].start_seconds))
    await page.waitForTimeout(350)
  }
  const video = page.video()
  await context.close()
  return await video.path()
}

const desktop = await record('desktop', { width: 1280, height: 800 }, Array.from({ length: 16 }, (_, i) => `L${String(i + 1).padStart(2, '0')}`))
const mobile = await record('mobile', { width: 390, height: 844 }, ['L04', 'L16'])
await browser.close()
const target = path.join(output, `agentified-scene-walkthrough-${revision.slice(0, 8)}.mp4`)
execFileSync('ffmpeg', ['-y', '-i', desktop, '-i', mobile, '-filter_complex', '[0:v]scale=1280:800,setsar=1[a];[1:v]scale=390:844:flags=lanczos,pad=1280:844:445:0:#101b27,scale=1280:800,setsar=1[b];[a][b]concat=n=2:v=1:a=0[out]', '-map', '[out]', '-an', '-c:v', 'libx264', '-crf', '23', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', target], { stdio: 'pipe' })
const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,width,height', '-of', 'json', target]).toString())
if (Number(probe.format.duration) < 20 || probe.streams[0].codec_name !== 'h264' || probe.streams[0].width !== 1280 || probe.streams[0].height !== 800) throw new Error('Walkthrough encoding validation failed')
rmSync(desktop); rmSync(mobile)
console.log(`${target}: ${Number(probe.format.duration).toFixed(1)}s, H.264 1280×800, silent`)
