import { Client } from 'pg'
async function main() {
  const url = process.env.CAMPAIGN_ATOMIC_TEST_URL
  if (!url || new URL(url).hostname !== '127.0.0.1' || new URL(url).pathname !== '/campaign_phase6_test') throw new Error('Disposable local database required')
  const client = new Client({ connectionString: url }); await client.connect()
  try {
    const { rows } = await client.query('select state from public.campaign_execution_journal')
    const state = rows[0].state
    const attempts = Object.values(state.attempts) as Array<{ reservedCents: number; dispatchIntent: { status: string } }>
    if (state.version !== 1 || attempts.length !== 1 || attempts[0].reservedCents !== 50 || attempts[0].dispatchIntent.status !== 'prepared' || state.ledger.length !== 1) throw new Error('Restart persistence mismatch')
    console.log('PASS: physical PostgreSQL restart retains atomic intent, ownership and reservation')
  } finally { await client.end() }
}
void main().catch(error => { console.error(error); process.exitCode = 1 })
