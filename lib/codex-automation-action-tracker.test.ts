import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  listAutomationActionTracker,
  updateAutomationActionState,
} from './codex-automation-action-tracker'

let tempRoot: string | null = null

async function root() {
  if (!tempRoot) tempRoot = await mkdtemp(path.join(tmpdir(), 'automation-actions-'))
  return tempRoot
}

async function writeNotification(relativePath: string, payload: unknown) {
  const file = path.join(await root(), relativePath)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return file
}

afterEach(async () => {
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true })
    tempRoot = null
  }
})

describe('listAutomationActionTracker', () => {
  it('turns notification next steps into stable action records', async () => {
    await writeNotification('sent/2026-05-11/2026-05-11T13-05-56Z--portfolio-operations-manager.json', {
      automation_id: 'portfolio-operations-manager',
      automation_name: 'Portfolio Operations Manager',
      ran_at_utc: '2026-05-11T13:05:56Z',
      status: 'red',
      headline: 'Portfolio health green; chat-eval approval gate still red',
      summary: 'Prompt mutation gate remains unresolved.',
      blockers_or_approvals: ['Approval/design needed for chat-eval prompt mutation gate architecture.'],
      next_run_focus: ['Verify chat-eval approval-gate fix lands.'],
      codex_thread_hint: 'Portfolio Operations Manager daily pass',
    })
    await writeNotification('sent/2026-05-12/2026-05-12T13-05-56Z--portfolio-operations-manager.json', {
      automation_id: 'portfolio-operations-manager',
      automation_name: 'Portfolio Operations Manager',
      ran_at_utc: '2026-05-12T13:05:56Z',
      status: 'yellow',
      headline: 'Chat-eval approval gate still needs follow-through',
      summary: 'Same approval packet is still unresolved.',
      blockers_or_approvals: ['Approval/design needed for chat-eval prompt mutation gate architecture.'],
      next_run_focus: ['Increase chat evaluation coverage.'],
    })

    const tracker = await listAutomationActionTracker(await root())

    expect(tracker.available).toBe(true)
    expect(tracker.actions).toHaveLength(3)
    const repeated = tracker.actions.find((action) => action.text.includes('Approval/design needed'))
    expect(repeated).toEqual(expect.objectContaining({
      automationId: 'portfolio-operations-manager',
      actionStatus: 'open',
      occurrenceCount: 2,
      priority: 'urgent',
      firstSeenAt: '2026-05-11T13:05:56Z',
      lastSeenAt: '2026-05-12T13:05:56Z',
    }))
    expect(tracker.summary.open).toBe(3)
    expect(tracker.automationFeedback[0]).toEqual(expect.objectContaining({
      automationId: 'portfolio-operations-manager',
      openActions: 3,
    }))
  })

  it('persists action status and writes feedback for the next automation pass', async () => {
    await writeNotification('pending/2026-05-11T13-32-16Z--daily-screen-recording-workflow-review.json', {
      automation_id: 'daily-screen-recording-workflow-review',
      automation_name: 'Daily Screen Recording Workflow Review',
      ran_at_utc: '2026-05-11T13:32:16Z',
      status: 'green',
      headline: 'Workflow review found five automation candidates',
      next_run_focus: ['Check whether worktree/env drift repeats.'],
    })
    const initial = await listAutomationActionTracker(await root())
    const action = initial.actions[0]

    await updateAutomationActionState(action.id, {
      status: 'in_progress',
      note: 'Worktree preflight task is being drafted.',
    }, await root())
    const updated = await listAutomationActionTracker(await root())
    const feedback = JSON.parse(await readFile(path.join(await root(), 'automation-action-feedback.json'), 'utf8'))

    expect(updated.actions[0]).toEqual(expect.objectContaining({
      actionStatus: 'in_progress',
      note: 'Worktree preflight task is being drafted.',
    }))
    expect(updated.summary.inProgress).toBe(1)
    expect(feedback.feedback[0].progressNotes[0]).toContain('Worktree preflight task is being drafted.')
  })
})
