import { describe, expect, it } from 'vitest'
import { DECISION_FILE_VERSION } from '@/lib/accelerated-decision-file'
import { AGENTIFIED_VERSION } from '@/lib/agentified-workshop'
import { attributeWorkshopOrders } from './workshop-order-attribution'

describe('workshop order attribution', () => {
  it('keeps same-account cross-workshop orders attached to their exact intakes', () => {
    const orders = [
      { id: 1, title: 'Same service', workshop_intake_id: 'agent-intake' },
      { id: 2, title: 'Same service', workshop_intake_id: 'accelerated-intake' },
      { id: 3, title: 'Same service', workshop_intake_id: null },
    ]
    expect(attributeWorkshopOrders(orders, [
      { id: 'accelerated-intake', content_version: DECISION_FILE_VERSION },
      { id: 'agent-intake', content_version: AGENTIFIED_VERSION },
    ]).map(({ workshop }) => workshop)).toEqual(['agentified', 'accelerated', null])
  })
  it('fails closed when a linked intake is missing or has an unknown edition', () => {
    expect(() => attributeWorkshopOrders([{ id: 1, workshop_intake_id: 'missing' }], [])).toThrow()
    expect(() => attributeWorkshopOrders([{ id: 1, workshop_intake_id: 'other' }], [{ id: 'other', content_version: 'unknown' }])).toThrow()
  })
})
