/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, it, vi } from 'vitest'
import schema from './schema'
import { internal } from './_generated/api'

const modules = import.meta.glob('./**/!(*.*.*)*.*s')
const app = 'trumpet-trainer'
const other = 'future-app'
const email = 'adult@example.test'
const subject = 'supabase-adult-1'

async function ready() {
  const t = convexTest(schema, modules)
  await t.mutation(internal.activation.registerApp, { key: app, name: 'Trumpet Trainer', enabled: true })
  await t.mutation(internal.activation.registerApp, { key: other, name: 'Future App', enabled: true })
  await t.mutation(internal.activation.intake, { appKey: app, adultEmail: email, consentVersion: 'v1', sourceType: 'test', sourceReceipt: 'receipt-0001', intakeHash: 'intake-hash' })
  const snap = await t.query(internal.activation.snapshot, { now: Date.now() })
  const recordId = snap.records[0].id as string
  for (const action of ['start_review', 'approve'] as const) await t.mutation(internal.activation.operator, { appKey: app, recordId, action, actor: 'operator-id', reason: 'Reviewed test fixture', issuanceEnabled: false })
  await t.mutation(internal.activation.operator, { appKey: app, recordId, action: 'prepare_invitation', actor: 'operator-id', reason: 'Approved test fixture', issuanceEnabled: true, tokenHash: 'invitation-digest' })
  expect(JSON.stringify(await t.query(internal.activation.snapshot, { now: Date.now() }))).not.toContain('invitation-digest')
  return { t, recordId }
}

describe('Convex activation transactions', () => {
  it('denies wrong app, wrong adult email, and replay; grants remain app scoped', async () => {
    const { t } = await ready()
    expect(await t.mutation(internal.activation.redeem, { appKey: other, tokenHash: 'invitation-digest', externalSubject: subject, verifiedEmail: email })).toBe(false)
    expect(await t.mutation(internal.activation.redeem, { appKey: app, tokenHash: 'invitation-digest', externalSubject: subject, verifiedEmail: 'other@example.test' })).toBe(false)
    expect(await t.mutation(internal.activation.redeem, { appKey: app, tokenHash: 'invitation-digest', externalSubject: subject, verifiedEmail: email })).toBe(true)
    expect(await t.mutation(internal.activation.redeem, { appKey: app, tokenHash: 'invitation-digest', externalSubject: 'another-adult', verifiedEmail: email })).toBe(false)
    expect(await t.query(internal.activation.hasGrant, { appKey: other, externalSubject: subject, now: Date.now() })).toBeNull()
    expect(await t.query(internal.activation.hasGrant, { appKey: app, externalSubject: 'another-adult', now: Date.now() })).toBeNull()
    expect(await t.query(internal.activation.hasGrant, { appKey: app, externalSubject: subject, now: Date.now() })).toBe(email)
  })
  it('denies expired invitation, grant and handle', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-11-07T00:00:00Z'))
      const { t } = await ready()
      vi.advanceTimersByTime(8 * 86400000)
      expect(await t.mutation(internal.activation.redeem, { appKey: app, tokenHash: 'invitation-digest', externalSubject: subject, verifiedEmail: email })).toBe(false)
    } finally { vi.useRealTimers() }
  })
  it('consumes handoff once and denies wrong app and revoked grant', async () => {
    const { t, recordId } = await ready()
    await t.mutation(internal.activation.redeem, { appKey: app, tokenHash: 'invitation-digest', externalSubject: subject, verifiedEmail: email })
    expect(await t.mutation(internal.activation.issueHandoff, { appKey: other, externalSubject: subject, verifiedEmail: email, codeHash: 'wrong-app-code' })).toBe(false)
    expect(await t.mutation(internal.activation.issueHandoff, { appKey: app, externalSubject: subject, verifiedEmail: 'changed@example.test', codeHash: 'wrong-email-code' })).toBe(false)
    expect(await t.mutation(internal.activation.issueHandoff, { appKey: app, externalSubject: subject, verifiedEmail: email, codeHash: 'code-digest' })).toBe(true)
    expect(await t.mutation(internal.activation.exchangeHandoff, { appKey: other, codeHash: 'code-digest', handleHash: 'wrong-app-handle', externalSubject: subject, verifiedEmail: email })).toBe(false)
    expect(await t.mutation(internal.activation.exchangeHandoff, { appKey: app, codeHash: 'code-digest', handleHash: 'handle-digest', externalSubject: subject, verifiedEmail: email })).toBe(true)
    expect(await t.mutation(internal.activation.exchangeHandoff, { appKey: app, codeHash: 'code-digest', handleHash: 'second-handle', externalSubject: subject, verifiedEmail: email })).toBe(false)
    expect(await t.query(internal.activation.resolveHandle, { appKey: other, handleHash: 'handle-digest', now: Date.now() })).toBeNull()
    expect(await t.query(internal.activation.resolveHandle, { appKey: app, handleHash: 'handle-digest', now: Date.now() })).toMatchObject({ externalSubject: subject })
    await t.mutation(internal.activation.operator, { appKey: app, recordId, action: 'revoke_grant', actor: 'operator-id', reason: 'Withdrawn test access', confirmation: 'revoke_grant', issuanceEnabled: false })
    expect(await t.query(internal.activation.resolveHandle, { appKey: app, handleHash: 'handle-digest', now: Date.now() })).toBeNull()
  })
  it('denies an expired grant and allows an audited revoke to clear renewal', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-11-07T00:00:00Z'))
      const { t, recordId } = await ready()
      expect(await t.mutation(internal.activation.redeem, { appKey: app, tokenHash: 'invitation-digest', externalSubject: subject, verifiedEmail: email })).toBe(true)
      vi.advanceTimersByTime(31 * 86400000)
      expect(await t.query(internal.activation.hasGrant, { appKey: app, externalSubject: subject, now: Date.now() })).toBeNull()
      await t.mutation(internal.activation.operator, { appKey: app, recordId, action: 'revoke_grant', actor: 'operator-id', reason: 'Close expired grant for renewal', confirmation: 'revoke_grant', issuanceEnabled: false })
      const state = await t.query(internal.activation.snapshot, { now: Date.now() })
      expect(state.records[0].grant?.revokedAt).not.toBeNull()
    } finally { vi.useRealTimers() }
  })
})
