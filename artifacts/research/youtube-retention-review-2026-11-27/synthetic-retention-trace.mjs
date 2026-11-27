import assert from 'node:assert/strict'
import { test } from 'node:test'

// Fictional records only. This is an isolated design trace; it imports no app or DB client.
const seed = () => ({
  external: [
    { id: 'synthetic-ext-a', version: 1, observedAt: '2026-10-28T12:00:00.000Z', state: 'held', rawBytes: true },
    { id: 'synthetic-ext-b', version: 1, observedAt: '2026-11-20T12:00:00.000Z', state: 'held', rawBytes: true },
  ],
  socialContent: [{ id: 'synthetic-content-1', version: 4 }],
  calendar: [{ id: 'synthetic-calendar-1', version: 8 }],
  connectedChannel: [{ id: 'synthetic-connection-1', version: 2 }],
  unrelated: [{ id: 'synthetic-other-source-1', version: 3 }],
  receipts: [],
})

const snapshot = (state) => JSON.stringify(Object.fromEntries(
  ['socialContent', 'calendar', 'connectedChannel', 'unrelated'].map((key) => [key, state[key]]),
))

function sweep(state, now, purgeSucceeds = true) {
  for (const row of state.external) {
    const deadline = Date.parse(row.observedAt) + 30 * 24 * 60 * 60 * 1000
    if (Date.parse(now) < deadline || row.state === 'deleted') continue
    row.state = 'revoked'
    if (!purgeSucceeds) continue
    row.rawBytes = false
    row.state = 'deleted'
    const key = `${row.id}:${row.version}:delete`
    if (!state.receipts.some((receipt) => receipt.key === key)) {
      state.receipts.push({ key, kind: 'synthetic-purge-proof', noPolicyApproval: true })
    }
  }
}

test('deadline is exact; scoped purge and repeat sweep leave canonical records unchanged', () => {
  const state = seed()
  const before = snapshot(state)
  sweep(state, '2026-11-27T11:59:59.999Z')
  assert.equal(state.external[0].state, 'held')
  sweep(state, '2026-11-27T12:00:00.000Z')
  assert.deepEqual(state.external.map(({ state }) => state), ['deleted', 'held'])
  assert.equal(state.external[0].rawBytes, false)
  assert.equal(state.receipts.length, 1)
  sweep(state, '2026-11-27T12:00:00.000Z')
  assert.equal(state.receipts.length, 1)
  assert.equal(snapshot(state), before)
})

test('failed purge revokes access and yields no success receipt', () => {
  const state = seed()
  const before = snapshot(state)
  sweep(state, '2026-11-27T12:00:00.000Z', false)
  assert.equal(state.external[0].state, 'revoked')
  assert.equal(state.external[0].rawBytes, true)
  assert.equal(state.receipts.length, 0)
  assert.equal(snapshot(state), before)
  sweep(state, '2026-11-27T12:00:00.000Z', true)
  assert.equal(state.external[0].state, 'deleted')
  assert.equal(state.receipts.length, 1)
  assert.equal(snapshot(state), before)
})

test('new observation does not inherit the prior clock or receipt', () => {
  const state = seed()
  const old = state.external[0]
  old.state = 'revoked'
  state.external.push({ id: old.id, version: 2, observedAt: '2026-11-27T12:00:00.000Z', state: 'quarantined', rawBytes: true })
  sweep(state, '2026-11-27T12:00:00.000Z')
  assert.equal(old.state, 'deleted')
  assert.equal(state.external[2].state, 'quarantined')
  assert.equal(state.receipts.length, 1)
})
