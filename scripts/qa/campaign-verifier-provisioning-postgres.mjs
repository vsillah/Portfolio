// Disposable synthetic database only; no environment files or credential resolver.
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'
const modulePath = process.env.CAMPAIGN_TEST_POSTGRES_MODULE
if (!modulePath?.startsWith('/')) throw Error('Absolute disposable embedded-postgres module path required')
const { default: Postgres } = await import(pathToFileURL(modulePath).href)
const directory = await mkdtemp(join(tmpdir(), 'campaign-provisioning-pg-'))
const pg = new Postgres({ databaseDir: join(directory,'data'),user:'postgres',password:'local-synthetic-only',
  port:15491,persistent:false,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{} })
let code=1
try {
  await pg.initialise();await pg.start();await pg.createDatabase('campaign_phase11_test')
  const child=spawn(process.execPath,[resolve('node_modules/vitest/vitest.mjs'),'run','--reporter=verbose','lib/campaign-verifier-provisioning.test.ts'],{
    stdio:'inherit',env:{PATH:process.env.PATH,HOME:process.env.HOME,
      CAMPAIGN_PROVISIONING_TEST_URL:'postgresql://postgres:local-synthetic-only@127.0.0.1:15491/campaign_phase11_test'},
  })
  code=Number(await new Promise(resolve=>child.on('exit',resolve)))
}finally {await pg.stop().catch(()=>{})}
process.exit(code)
