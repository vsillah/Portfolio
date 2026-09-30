import { runBenchmark } from '../lib/engagement-shadow/benchmark'

// No file/URL input and no live switch: this entry point accepts only bundled synthetic cases.
async function main() {
  if (process.argv.length > 2) throw new Error('Offline-only benchmark accepts no arguments')
  console.log(JSON.stringify(await runBenchmark(), null, 2))
}
main().catch(() => { console.error('Benchmark failed; no provider action performed.'); process.exitCode = 1 })
