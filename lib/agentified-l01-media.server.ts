import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { agentifiedL01Media } from './agentified-l01-media'

export function assertAgentifiedL01PublicMedia(root = process.cwd()) {
  for (const [relative, expected] of [
    ['agentified/workshop/l01-native-composite/agentified-l01-native-composite.mp4', agentifiedL01Media.compositeSha256],
    ['agentified/workshop/l01-native-composite/agentified-l01-native-captions.srt', agentifiedL01Media.captionsSrtSha256],
    ['agentified/workshop/l01-native-composite/agentified-l01-native-captions.vtt', agentifiedL01Media.captionsVttSha256],
    ['agentified/workshop/l01-native-source/agentified-l01-heygen-native-source.mp4', agentifiedL01Media.nativeSourceSha256],
    [`public${agentifiedL01Media.video}`, agentifiedL01Media.compositeSha256],
    [`public${agentifiedL01Media.captions}`, agentifiedL01Media.captionsVttSha256],
  ] as const) {
    const file = path.join(root, relative)
    const actual = createHash('sha256').update(readFileSync(file)).digest('hex')
    if (actual !== expected) throw new Error(`Agentified L01 media drift: ${relative}`)
  }
}
