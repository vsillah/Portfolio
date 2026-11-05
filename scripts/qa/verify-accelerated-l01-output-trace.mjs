import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const root = resolve('.')
const tracePath = join(root, '.next/server/app/api/admin/social-content/[id]/bind-approved-master/route.js.nft.json')
const trace = JSON.parse(readFileSync(tracePath, 'utf8'))
const traced = trace.files.map((file) => resolve(dirname(tracePath), file))
const l01Dir = join(root, 'public/accelerated/lessons/l01/approved-ee09bf72')
const trumpetDir = join(root, 'public/showcases/trumpet-trainer/c19989a3')
const l01Video = join(l01Dir, 'accelerated-l01-native-composite.mp4')
const darkCastleDir = join(root, 'public/review-assets/social-content/dark-castle-youtube-master-2026-10-29')

assert.equal(createHash('sha256').update(readFileSync(l01Video)).digest('hex'), 'ee09bf72887ca7507229b86f89c4b81b21ba4f97f3290b3451ca704506e7991a')
assert.equal(traced.some((file) => file.startsWith(`${l01Dir}/`)), false, 'Static L01 media must stay out of the unrelated admin function')
assert.equal(traced.some((file) => file.startsWith(`${trumpetDir}/`)), false, 'Static Trumpet Trainer media must stay out of the unrelated admin function')
assert(traced.includes(join(darkCastleDir, 'dark-castle-youtube-master.mp4')), 'The admin function still needs its approved master')
assert(traced.includes(join(darkCastleDir, '03-accidental-success-v2.png')), 'The admin function still needs its approved thumbnail')

const bytes = traced.reduce((sum, file) => sum + statSync(file).size, 0)
assert(bytes < 250 * 1024 * 1024, `Admin function trace is ${(bytes / 1024 / 1024).toFixed(1)} MiB`)
console.log(`L01 and Trumpet Trainer static media preserved; unrelated function trace ${(bytes / 1024 / 1024).toFixed(1)} MiB, below 250 MiB`)
