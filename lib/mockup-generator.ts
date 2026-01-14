// Mockup Generation Service using Printful Mockup Generator API

import { printful, PrintfulMockupTask } from './printful'

export interface MockupGenerationOptions {
  variantIds: number[]
  logoUrl: string
  placements?: ('front' | 'back' | 'label_outside')[]
  width?: number
  height?: number
}

export interface MockupResult {
  placement: string
  variantId: number
  mockupUrl: string
  extra?: Array<{
    title: string
    option: string
    url: string
  }>
}

/**
 * Generate mockups for product variants
 * Returns array of mockup URLs organized by variant and placement
 */
export async function generateMockups(
  options: MockupGenerationOptions
): Promise<Record<number, Record<string, string>>> {
  const {
    variantIds,
    logoUrl,
    placements = ['front', 'back'],
    width = 1000,
    height = 1000,
  } = options

  const results: Record<number, Record<string, string>> = {}

  // Generate mockups for each placement
  for (const placement of placements) {
    try {
      // Create mockup task
      const task = await printful.createMockupTask(
        variantIds,
        placement,
        logoUrl,
        width,
        height
      )

      // Poll for task completion (with timeout)
      const mockups = await pollMockupTask(task.task_key, 30) // 30 second timeout

      if (mockups) {
        // Organize results by variant ID
        for (const mockup of mockups) {
          for (const variantId of mockup.variant_ids) {
            if (!results[variantId]) {
              results[variantId] = {}
            }
            results[variantId][placement] = mockup.mockup_url
          }
        }
      }
    } catch (error) {
      console.error(`Failed to generate mockup for placement ${placement}:`, error)
      // Continue with other placements
    }
  }

  return results
}

/**
 * Poll mockup task until completion or timeout
 */
async function pollMockupTask(
  taskKey: string,
  timeoutSeconds: number = 30
): Promise<PrintfulMockupTask['mockups'] | null> {
  const startTime = Date.now()
  const pollInterval = 2000 // Poll every 2 seconds
  const maxAttempts = Math.floor(timeoutSeconds * 1000 / pollInterval)

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const task = await printful.getMockupTask(taskKey)

      if (task.status === 'completed' && task.mockups) {
        return task.mockups
      }

      if (task.status === 'failed') {
        throw new Error('Mockup generation failed')
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    } catch (error) {
      console.error('Error polling mockup task:', error)
      throw error
    }
  }

  throw new Error('Mockup generation timeout')
}

/**
 * Generate mockups for a single variant (simplified)
 */
export async function generateVariantMockups(
  variantId: number,
  logoUrl: string
): Promise<Record<string, string>> {
  const results = await generateMockups({
    variantIds: [variantId],
    logoUrl,
    placements: ['front', 'back'],
  })

  return results[variantId] || {}
}

/**
 * Batch generate mockups for multiple variants
 * Returns results organized by variant ID and placement
 */
export async function batchGenerateMockups(
  variantIds: number[],
  logoUrl: string,
  placements: ('front' | 'back' | 'label_outside')[] = ['front', 'back']
): Promise<Record<number, Record<string, string>>> {
  // Process in batches to avoid rate limits
  const batchSize = 5
  const allResults: Record<number, Record<string, string>> = {}

  for (let i = 0; i < variantIds.length; i += batchSize) {
    const batch = variantIds.slice(i, i + batchSize)
    
    try {
      const batchResults = await generateMockups({
        variantIds: batch,
        logoUrl,
        placements,
      })

      // Merge results
      for (const [variantId, mockups] of Object.entries(batchResults)) {
        allResults[parseInt(variantId)] = mockups
      }

      // Small delay between batches to respect rate limits
      if (i + batchSize < variantIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    } catch (error) {
      console.error(`Failed to generate mockups for batch:`, error)
      // Continue with next batch
    }
  }

  return allResults
}
