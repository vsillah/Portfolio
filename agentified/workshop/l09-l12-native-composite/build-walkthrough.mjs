#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const lessons = ['09', '10', '11', '12']
const inputs = []
const segments = []

for (const lesson of lessons) {
  const video = path.join(here, `agentified-l${lesson}-native-composite.mp4`)
  const timeline = JSON.parse(readFileSync(path.join(here, `l${lesson}-composite-timeline.json`), 'utf8'))
  const countdown = timeline.guided_work_countdown
  const closing = timeline.presenter_windows[1]
  const samples = [
    { start: 0, duration: 4 },
    { start: Math.max(15, countdown.sequence_start / 2), duration: 3 },
    { start: countdown.sequence_start + 8, duration: 3 },
    { start: closing.sequence_start, duration: Math.min(6, timeline.output_duration_seconds - closing.sequence_start) },
  ]
  for (const sample of samples) {
    inputs.push('-ss', String(sample.start), '-t', String(sample.duration), '-i', video)
    segments.push(sample.duration)
  }
}

const filters = []
segments.forEach((segmentDuration, index) => {
  filters.push(`[${index}:v]trim=duration=${segmentDuration},setpts=PTS-STARTPTS,scale=1280:720,fps=25,format=yuv420p[v${index}]`)
  filters.push(`[${index}:a]atrim=duration=${segmentDuration},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo[a${index}]`)
})
filters.push(`${segments.map((_, index) => `[v${index}][a${index}]`).join('')}concat=n=${segments.length}:v=1:a=1[vout][aout]`)

execFileSync('ffmpeg', [
  '-y', ...inputs,
  '-filter_complex', filters.join(';'),
  '-map', '[vout]', '-map', '[aout]',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart',
  path.join(here, 'agentified-l09-l12-human-qa-walkthrough.mp4'),
], { stdio: 'inherit' })
