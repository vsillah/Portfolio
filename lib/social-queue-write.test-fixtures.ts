export const queueWriteScenario = { mode: 'normal' as 'normal' | 'locked' | 'race' }
/** Upgrade existing route fixtures to conditional UPDATE semantics without mocking the guard. */
export async function withVersionedQueueMock<T>(from: any, work: () => Promise<T>): Promise<T> {
  const original = from.getMockImplementation()
  let current: Record<string, any> | null = null
  from.mockImplementation((table: string) => {
    if (table === 'social_content_publishes') return {
      select: (fields: string) => {
        if (fields === 'status,platform_post_id,platform_post_url,published_at') return {
          eq: () => ({ limit: async () => ({ data: [], error: null }) }),
        }
        return original(table).select(fields)
      },
      upsert: (...args: any[]) => original(table).upsert(...args),
    }
    const base = original(table)
    if (table !== 'social_content_queue') return base
    return {
      ...base,
      select: (...args: any[]) => {
        const selected = base.select(...args)
        return { ...selected, eq: (...filters: any[]) => {
          const filtered = selected.eq(...filters)
          const wrap = async () => {
            const result = await filtered.single()
            current = result.data ? { id: 'social-1', status: 'approved', updated_at: '2026-09-08T00:00:00Z', ...result.data } : null
            if (current && queueWriteScenario.mode === 'locked') current.rag_context = { ...current.rag_context, platform_submission_gate: { status: 'submitting' } }
            return { ...result, data: current }
          }
          return { ...filtered, single: wrap }
        } }
      },
      update: (patch: Record<string, unknown>) => {
        let underlying = base.update(patch)
        let first = true
        const filters: Array<[string, unknown]> = []
        const q: any = {
          eq: (key: string, value: unknown) => {
            filters.push([key, value])
            if (first) { underlying = underlying.eq(key, value); first = false }
            return q
          },
          select: () => q,
          maybeSingle: async () => {
            let response = underlying
            if (response?.select) response = response.select('*')
            if (response?.single) response = response.single()
            const result = await response
            if (result?.error) return result
            if (current && queueWriteScenario.mode === 'race') current.updated_at = 'concurrently claimed version'
            if (!current || !filters.every(([key, value]) => current![key] === value)) return { data: null, error: null }
            current = { ...current, ...patch, updated_at: '2026-09-08T00:00:01Z' }
            return { data: current, error: null }
          },
        }
        return q
      },
    }
  })
  try { return await work() } finally { from.mockImplementation(original); queueWriteScenario.mode = 'normal' }
}
