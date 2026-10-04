import { Client } from 'pg'
async function main() {
  const url=process.env.CAMPAIGN_ATOMIC_TEST_URL
  if(!url || new URL(url).hostname!=='127.0.0.1' || new URL(url).pathname!=='/campaign_phase7_test') throw new Error('Disposable local database required')
  const client=new Client({connectionString:url});await client.connect()
  try {
    const result=await client.query(`select e.state=j.state and e.commands=(select jsonb_agg(to_jsonb(c)) from campaign_atomic_recovery_commands c) ok
      from campaign_phase7_expected e cross join campaign_execution_journal j`)
    if(result.rows[0]?.ok!==true) throw new Error('Recovery persistence mismatch')
    const receipt=await client.query('select request,result from campaign_atomic_recovery_commands limit 1')
    await client.query('set role service_role')
    const replay=await client.query('select campaign_recover_atomic_intent($1)=$2::jsonb ok',[receipt.rows[0].request,receipt.rows[0].result])
    if(replay.rows[0]?.ok!==true) throw new Error('Restart replay mismatch')
    console.log('PASS: physical restart preserves complete journal, immutable intent, recovery command history and exact replay')
  } finally {await client.end()}
}
void main().catch(error=>{console.error(error);process.exitCode=1})
