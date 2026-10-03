import { open, readFile, rename, unlink } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { emptyExecutionState, type CampaignTransactionStore, type ExecutionState } from './campaign-release-execution'

/** Local synthetic qualification only. Never register on serverless/production routes.
 * Exclusive lock + fsync + rename serializes cooperating processes on a local filesystem.
 * A crash-held lock fails closed; an operator must verify the worker has exited before removing it.
 * This does not qualify a distributed database or network filesystem. */
export class LocalCampaignExecutionStore implements CampaignTransactionStore {
  constructor(readonly path: string) {}
  async snapshot(): Promise<ExecutionState> {
    try {
      const state = JSON.parse(await readFile(this.path, 'utf8')) as ExecutionState
      if (state.schemaVersion !== 1 || !Number.isSafeInteger(state.version) || !state.releases || !state.attempts || !Array.isArray(state.ledger)) throw new Error('Execution journal format invalid.')
      return state
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyExecutionState()
      throw error
    }
  }
  async transaction<T>(change: (state: ExecutionState) => T): Promise<T> {
    const lock = await open(`${this.path}.lock`, 'wx', 0o600)
    const tmp = `${this.path}.${randomUUID()}.tmp`
    try {
      await lock.writeFile(JSON.stringify({ pid: process.pid })); await lock.sync()
      const state = await this.snapshot()
      const result = change(state)
      state.version++
      const output = await open(tmp, 'wx', 0o600)
      try { await output.writeFile(JSON.stringify(state)); await output.sync() } finally { await output.close() }
      await rename(tmp, this.path)
      const directory = await open(dirname(this.path), 'r')
      try { await directory.sync() } finally { await directory.close() }
      return structuredClone(result)
    } finally {
      await unlink(tmp).catch(error => { if (error.code !== 'ENOENT') throw error })
      await lock.close(); await unlink(`${this.path}.lock`)
    }
  }
}
