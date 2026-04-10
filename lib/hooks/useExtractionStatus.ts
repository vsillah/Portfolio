'use client'

export type { ExtractionRun, ExtractionState } from './useWorkflowStatus'
export { useWorkflowStatus } from './useWorkflowStatus'

import { useWorkflowStatus } from './useWorkflowStatus'

/**
 * Backward-compatible alias that targets the social content extraction runs API.
 */
export function useExtractionStatus(onQueueRefresh?: () => void) {
  return useWorkflowStatus(
    /** workflowId enables WF-SOC-001 stage model + optimistic run metadata */
    { apiBase: '/api/admin/social-content/runs', workflowId: 'soc001' },
    onQueueRefresh,
  )
}
