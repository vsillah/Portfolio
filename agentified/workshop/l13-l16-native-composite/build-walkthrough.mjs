#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const lessons = ['13', '14', '15', '16']
const inputs = []
const durations = []

for (const lesson of lessons) {
  const video = path.join(here, `agentified-l${lesson}-native-composite.mp4`)
  const timeline = JSON.parse(readFileSync(path.join(here, `l${lesson}-composite-timeline.json`)))
  const countdown = timeline.guided_work_countdown
  const closing = timeline.presenter_windows[1]
  for (const sample of [
    { start: 0, duration: 4 },
    { start: Math.max(12, countdown.sequence_start - 5), duration: 3 },
    { start: countdown.sequence_start + 8, duration: 3 },
    { start: closing.sequence_start, duration: Math.min(6, timeline.output_duration_seconds - closing.sequence_start) }
  ]) {
    inputs.push('-ss', String(sample.start), '-t', String(sample.duration), '-i', video)
    durations.push(sample.duration)
  }
}

const filters = []
durations.forEach((value, index) => {
  filters.push(`[${index}:v]trim=duration=${value},setpts=PTS-STARTPTS,scale=1280:720,fps=25,format=yuv420p[v${index}]`)
  filters.push(`[${index}:a]atrim=duration=${value},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo[a${index}]`)
})
filters.push(`${durations.map((_, index) => `[v${index}][a${index}]`).join('')}concat=n=${durations.length}:v=1:a=1[vout][aout]`)
execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'warning', ...inputs, '-filter_complex', filters.join(';'), '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', path.join(here, 'agentified-l13-l16-human-qa-walkthrough.mp4')], { stdio: 'inherit' })
