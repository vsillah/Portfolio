#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const files = [
  path.join(here, 'l01-native-composite/agentified-l01-native-composite.mp4'),
  path.join(here, 'l02-l04-native-composite/agentified-l02-native-composite.mp4'),
  path.join(here, 'l02-l04-native-composite/agentified-l03-native-composite.mp4'),
  path.join(here, 'l02-l04-native-composite/agentified-l04-native-composite.mp4'),
]
const segments = [
  [0, 10.5, 20.5], [0, 517, 530],
  [1, 13, 22], [1, 499, 509],
  [2, 11, 19], [2, 586, 599],
  [3, 14.5, 22.5], [3, 592, 600],
]
const filters = []
for (const [input, start, end] of segments) {
  const index = filters.length / 2
  filters.push(`[${input}:v]trim=${start}:${end},setpts=PTS-STARTPTS[v${index}]`)
  filters.push(`[${input}:a]atrim=${start}:${end},asetpts=PTS-STARTPTS[a${index}]`)
}
const streams = segments.map((_, index) => `[v${index}][a${index}]`).join('')
filters.push(`${streams}concat=n=${segments.length}:v=1:a=1[vout][aout]`)

execFileSync('ffmpeg', [
  '-y',
  ...files.flatMap(file => ['-i', file]),
  '-filter_complex', filters.join(';'),
  '-map', '[vout]',
  '-map', '[aout]',
  '-c:v', 'libx264',
  '-preset', 'veryfast',
  '-crf', '20',
  '-pix_fmt', 'yuv420p',
  '-r', '25',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-movflags', '+faststart',
  path.join(here, 'agentified-l01-l04-handoff-correction-walkthrough.mp4'),
], { stdio: 'inherit' })
