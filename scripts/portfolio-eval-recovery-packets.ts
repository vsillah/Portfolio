/** Read-only packet entry point. Takes local, approved inputs; emits JSON to stdout. */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { buildRecoveryPackets, RECOVERY_FAMILIES, type ApprovedBinding, type RecoveryManifest, type RecoveryReport, type RecoverySnapshot } from '../lib/eval-recovery-packets'

function readJson<T>(path: string): T { return JSON.parse(readFileSync(path, 'utf8')) as T }
function main() {
  const [manifestPath, reportPath, snapshotPath, bindingsPath] = process.argv.slice(2)
  if (!manifestPath || !reportPath || !snapshotPath || !bindingsPath) throw new Error('Usage: tsx scripts/portfolio-eval-recovery-packets.ts manifest.json monthly-report.json approved-snapshot.json approved-bindings.json')
  const snapshotRaw = readFileSync(snapshotPath)
  const bindings = readJson<{ bindings: ApprovedBinding[]; previous?: Array<{ key: string; digest: string }> }>(bindingsPath)
  if (!Array.isArray(bindings.bindings) || bindings.bindings.length !== 4) throw new Error('Exactly four reviewed family bindings are required')
  if (new Set(bindings.bindings.map(binding => binding.channel)).size !== 4 || bindings.bindings.some(binding => !(binding.channel in RECOVERY_FAMILIES))) throw new Error('One binding per canonical hosted channel is required')
  const manifestRaw = readFileSync(manifestPath)
  const manifestSha256 = createHash('sha256').update(manifestRaw).digest('hex')
  const manifest = JSON.parse(manifestRaw.toString('utf8')) as RecoveryManifest
  const report = readJson<RecoveryReport>(reportPath)
  const packets = buildRecoveryPackets({
    manifest, report, snapshot: JSON.parse(snapshotRaw.toString('utf8')) as RecoverySnapshot,
    manifestSha256,
    snapshotSha256: createHash('sha256').update(snapshotRaw).digest('hex'), baseCommit: report.commit,
    now: new Date().toISOString(), bindings: bindings.bindings, previous: bindings.previous,
  })
  process.stdout.write(JSON.stringify({ schemaVersion: 1, reportCommit: report.commit, manifestSha256, packets }, null, 2) + '\n')
  if (packets.some(packet => packet.state === 'blocked')) process.exitCode = 1
}
main()
