import { execFileSync } from 'node:child_process'

export function expectRenderedFrameHasContent(file: string, timestampSeconds: number) {
  const frame = execFileSync('ffmpeg', [
    '-hide_banner',
    '-loglevel', 'error',
    '-ss', String(timestampSeconds),
    '-i', file,
    '-frames:v', '1',
    '-vf', 'scale=64:36,format=rgb24',
    '-f', 'rawvideo',
    'pipe:1',
  ])

  let min = 255
  let max = 0
  for (const channel of frame) {
    min = Math.min(min, channel)
    max = Math.max(max, channel)
  }

  if (max - min < 40) {
    throw new Error(`Rendered frame is effectively uniform at ${timestampSeconds}s (${min}-${max})`)
  }
}
