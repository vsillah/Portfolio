#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const lessons = ['05', '06', '07', '08']
const inputs = []
const segments = []

for (const lesson of lessons) {
  const video = path.join(here, `agentified-l${lesson}-native-composite.mp4`)
  const timeline = JSON.parse(readFileSync(path.join(here, `l${lesson}-composite-timeline.json`), 'utf8'))
  const closing = timeline.placements[1]
  inputs.push('-ss', '0', '-t', '6', '-i', video)
  segments.push(6)
  inputs.push('-ss', String(closing.sequence_start), '-t', String(600 - closing.sequence_start), '-i', video)
  segments.push(600 - closing.sequence_start)
}

const filters = []
segments.forEach((duration, index) => {
  filters.push(`[${index}:v]trim=duration=${duration},setpts=PTS-STARTPTS,scale=1280:720,fps=25,format=yuv420p[v${index}]`)
  filters.push(`[${index}:a]atrim=duration=${duration},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo[a${index}]`)
})
filters.push(`${segments.map((_, index) => `[v${index}][a${index}]`).join('')}concat=n=${segments.length}:v=1:a=1[vout][aout]`)

execFileSync('ffmpeg', [
  '-y', ...inputs,
  '-filter_complex', filters.join(';'),
  '-map', '[vout]', '-map', '[aout]',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart',
  path.join(here, 'agentified-l05-l08-human-qa-walkthrough.mp4'),
], { stdio: 'inherit' })
