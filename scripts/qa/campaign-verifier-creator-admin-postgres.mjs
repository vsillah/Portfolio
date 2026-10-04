// Disposable PostgreSQL only; no env files, hosted connections or credential resolver.
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'
const modulePath = process.env.CAMPAIGN_TEST_POSTGRES_MODULE
if (!modulePath?.startsWith('/')) throw Error('Absolute disposable embedded-postgres module path required')
const { default: Postgres } = await import(pathToFileURL(modulePath).href)
const directory = await mkdtemp(join(tmpdir(), 'campaign-creator-admin-pg-'))
// An arbitrary bootstrap name proves validation depends on catalog identity.
const pg = new Postgres({ databaseDir: join(directory,'data'),user:'synthetic_bootstrap',password:'local-synthetic-only',
  port:15493,persistent:false,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{} })
let code=1
try {
  await pg.initialise();await pg.start();await pg.createDatabase('campaign_creator_admin_test')
  const child=spawn(process.execPath,[resolve('node_modules/vitest/vitest.mjs'),'run','--reporter=verbose','lib/campaign-verifier-creator-admin.test.ts'],{
    stdio:'inherit',env:{PATH:process.env.PATH,HOME:process.env.HOME,
      CAMPAIGN_CREATOR_ADMIN_TEST_URL:'postgresql://synthetic_bootstrap:local-synthetic-only@127.0.0.1:15493/campaign_creator_admin_test'},
  })
  code=Number(await new Promise(resolve=>child.on('exit',resolve)))
}finally {await pg.stop().catch(()=>{})}
process.exit(code)
