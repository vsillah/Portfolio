import { DECISION_FILE_VERSION } from '@/lib/accelerated-decision-file'
import { AGENTIFIED_VERSION } from '@/lib/agentified-workshop'

export type WorkshopOrder = { workshop_intake_id?: string | null; [key: string]: unknown }

// An order's persisted intake is the only source of workshop attribution.
// Legacy and generic orders stay unattributed.
export function attributeWorkshopOrders<T extends WorkshopOrder>(orders: T[], intakes: Array<{ id: string; content_version: string }>): Array<T & { workshop: 'accelerated' | 'agentified' | null }> {
  const versions = new Map(intakes.map((intake) => [intake.id, intake.content_version]))
  return orders.map((order) => {
    if (!order.workshop_intake_id) return { ...order, workshop: null }
    const version = versions.get(order.workshop_intake_id)
    if (version === DECISION_FILE_VERSION) return { ...order, workshop: 'accelerated' }
    if (version === AGENTIFIED_VERSION) return { ...order, workshop: 'agentified' }
    throw new Error('Workshop order intake identity unavailable')
  })
}
