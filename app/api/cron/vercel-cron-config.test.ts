import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('vercel cron config', () => {
  it('schedules internal operating-loop routes without changing provider execution routes', () => {
    const config = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as {
      crons: Array<{ path: string; schedule: string }>
    }

    expect(config.crons).toEqual(expect.arrayContaining([
      { path: '/api/cron/agent-ops-morning-review', schedule: '30 12 * * 1-5' },
      { path: '/api/cron/social-content-calendar-due-gates', schedule: '30 * * * *' },
    ]))
    expect(config.crons.find((cron) => cron.path === '/api/cron/social-content-scheduled-publish')).toEqual({
      path: '/api/cron/social-content-scheduled-publish',
      schedule: '0 * * * *',
    })
  })
})
