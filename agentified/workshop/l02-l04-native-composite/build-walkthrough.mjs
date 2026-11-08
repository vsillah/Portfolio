#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const files = ['l02', 'l03', 'l04'].map(id => path.join(here, `agentified-${id}-native-composite.mp4`))
const segments = [
  [0, 0, 6], [0, 500.763, 504], [0, 504, 510],
  [1, 0, 6], [1, 587.557, 592], [1, 592, 600],
  [2, 0, 6], [2, 593.551, 597], [2, 597, 600]
]
const filters = []
for (const [index, start, end] of segments) {
  const label = filters.length / 2
  filters.push(`[${index}:v]trim=${start}:${end},setpts=PTS-STARTPTS[v${label}]`)
  filters.push(`[${index}:a]atrim=${start}:${end},asetpts=PTS-STARTPTS[a${label}]`)
}
const streams = segments.map((_, index) => `[v${index}][a${index}]`).join('')
filters.push(`${streams}concat=n=${segments.length}:v=1:a=1[vout][aout]`)
execFileSync('ffmpeg', ['-y', ...files.flatMap(file => ['-i', file]), '-filter_complex', filters.join(';'), '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '25', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', path.join(here, 'agentified-l02-l04-human-qa-walkthrough.mp4')], { stdio: 'inherit' })
