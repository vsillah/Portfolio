import { mkdir, open, readFile, rename, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { emptySimulationState, type CampaignSimulationStore, type SimulationState } from './campaign-release-simulation'

/** Local qualification only. One directory is one global claim namespace. No serverless use.
 * A crashed lock is intentionally never stolen: the operator must inspect it before recovery. */
export class CampaignReleaseFileStore implements CampaignSimulationStore {
  private directory: string
  constructor(directory: string) { this.directory = resolve(directory) }
  async transact<T>(fn: (state: SimulationState) => T): Promise<T> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 })
    const lock = join(this.directory, 'transaction.lock')
    try { await mkdir(lock) } catch { throw new Error('Simulation store locked. Reconcile the prior process before retrying.') }
    const file = join(this.directory, 'state.json'), temporary = join(this.directory, `${randomUUID()}.tmp`)
    try {
      let state: SimulationState
      try { state = JSON.parse(await readFile(file, 'utf8')) } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        state = emptySimulationState()
      }
      if (state.schema !== 1 || !state.releases || !state.attempts) throw new Error('Invalid simulation store schema.')
      const result = fn(state)
      const handle = await open(temporary, 'wx', 0o600)
      try { await handle.writeFile(JSON.stringify(state)); await handle.sync() } finally { await handle.close() }
      await rename(temporary, file)
      const directoryHandle = await open(this.directory, 'r')
      try { await directoryHandle.sync() } finally { await directoryHandle.close() }
      return result
    } finally { await rm(temporary, { force: true }); await rm(lock, { recursive: true }) }
  }
}
