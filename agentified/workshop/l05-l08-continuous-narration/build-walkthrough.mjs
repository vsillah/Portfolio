#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const clips = ['L05', 'L06', 'L07', 'L08'].map((id) => {
  const receipt = JSON.parse(readFileSync(path.join(here, `${id.toLowerCase()}-validation-receipt.json`), 'utf8'))
  return [id, Math.max(0, receipt.guided_work_window.end - 2), 18]
})
const inputs = clips.flatMap(([id, start, duration]) => ['-ss', String(start), '-t', String(duration), '-i', path.join(here, `agentified-${id.toLowerCase()}-continuous-narration-composite.mp4`)])
const filters = clips.flatMap((_, index) => [
  `[${index}:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=25[v${index}]`,
  `[${index}:a]aresample=48000,asetpts=PTS-STARTPTS[a${index}]`,
])
filters.push(`${clips.map((_, index) => `[v${index}][a${index}]`).join('')}concat=n=${clips.length}:v=1:a=1[vout][aout]`)
execFileSync('ffmpeg', ['-y', ...inputs, '-filter_complex', filters.join(';'), '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', path.join(here, 'agentified-l05-l08-continuity-walkthrough.mp4')], { stdio: 'inherit' })
