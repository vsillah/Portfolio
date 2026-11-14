import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import bindings from './accelerated-contextual-bindings.json'

const require = createRequire(import.meta.url)
const { verifyAcceleratedContextualBinding } = require('../scripts/verify-accelerated-contextual-binding.cjs')
const approval = require('../docs/accelerated-course-modules/l09-l16-contextual-binding/human-qa-receipt.json')

describe('Accelerated L09-L16 contextual review receipts', () => {
  it('binds all eight desktop, portrait, caption, transcript, duration, and final-cue identities', () => {
    expect(verifyAcceleratedContextualBinding()).toBe(true)
    expect(Object.keys(bindings.lessons)).toEqual(['L09', 'L10', 'L11', 'L12', 'L13', 'L14', 'L15', 'L16'])
    expect(approval).toMatchObject({ status: 'human_qa_pending', external_actions_authorized: false, full_lesson_human_qa_claimed: false })
  })

  it('rejects an altered media hash or premature approval', () => {
    expect(() => verifyAcceleratedContextualBinding({ approval: { ...approval, status: 'approved' } })).toThrow(/review status changed/)
    const altered = structuredClone(bindings)
    altered.lessons.L09.variants.desktop.sha256 = '0'.repeat(64)
    expect(() => verifyAcceleratedContextualBinding({ binding: altered })).toThrow(/L09 desktop media binding changed/)
  })
})
