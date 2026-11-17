/** Exact visual activation IDs; the excluded X draft is intentionally absent. */
export const ACCELERATED_VISUAL_IDS = [
  '20d09867-24ce-4849-b03d-f877d7114d6a',
  '9499ecbf-0349-472a-9b12-b6d987d1939d',
  '34471e82-2cb4-4e06-b3ec-d48f9739bb0f',
] as const

export function isAcceleratedVisualId(id: string): boolean {
  return (ACCELERATED_VISUAL_IDS as readonly string[]).includes(id)
}
