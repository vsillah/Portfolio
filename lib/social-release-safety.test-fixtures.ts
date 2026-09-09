import { socialReleaseFingerprint } from './social-release-evidence'

type Row = Record<string, any>
export const releaseVersion = '2026-09-08T00:00:00.000Z'
export function releaseFixture(): Row {
  const item: Row = { id: 'social-1', status: 'approved', updated_at: releaseVersion,
    platform: 'linkedin', target_platforms: ['linkedin'], post_text: 'Reviewed content',
    rag_context: { source_packet_path: 'fixture/source.md', approval_boundary: 'human gated',
      section_gate_reviews: { visual_assets: { status: 'approved' }, asset_packet: { status: 'approved' }, privacy: { status: 'approved' } },
      platform_submission_gate: { status: 'approved', platforms: ['linkedin'] } } }
  item.rag_context.platform_submission_gate.approved_fingerprint = socialReleaseFingerprint(item)
  return item
}

/** In-memory conditional UPDATE semantics, including a server-owned updated_at trigger. */
export function releaseStore(item = releaseFixture()) {
  const tables: Record<string, Row[]> = {
    social_content_queue: [structuredClone(item)],
    social_content_publishes: [{ id: 'publish-1', content_id: item.id, platform: 'linkedin', status: 'pending', updated_at: releaseVersion }],
    social_content_config: [{ platform: 'linkedin', is_active: true,
      credentials: { access_token: 'fixture', author_urn: 'urn:li:person:fixture', person_urn: 'urn:li:person:fixture', expires_in: 999999999, token_obtained_at: '2999-01-01T00:00:00Z' },
      settings: { author_urn: 'urn:li:person:fixture', post_visibility: 'PUBLIC' } }],
  }
  const writes: Array<{ table: string; patch: Row }> = []
  let tick = 0
  const controls = { fail: (_table: string, _patch: Row) => false, beforeWrite: (_table: string, _patch: Row) => {} }
  const from = (table: string) => {
    let patch: Row | null = null
    let insert: Row[] | null = null
    const predicates: Array<(row: Row) => boolean> = []
    const field = (row: Row, key: string) => key.split(/->>?/).reduce((v, k) => v?.[k], row)
    const execute = (single: boolean) => {
      if (patch) {
        controls.beforeWrite(table, patch)
        if (controls.fail(table, patch)) return { data: null, error: { message: 'fixture persistence failure' } }
      }
      if (insert) for (const value of insert) if (!tables[table].some(row => row.content_id === value.content_id && row.platform === value.platform)) tables[table].push({ ...value, id: `row-${++tick}`, updated_at: releaseVersion })
      const matches = tables[table].filter(row => predicates.every(predicate => predicate(row)))
      if (patch) for (const row of matches) {
        writes.push({ table, patch: structuredClone(patch) })
        Object.assign(row, structuredClone(patch), { updated_at: new Date(Date.parse(releaseVersion) + 10000 + ++tick).toISOString() })
      }
      return { data: structuredClone(single ? matches[0] ?? null : matches), error: null }
    }
    const query: any = {
      select: () => query,
      limit: () => query,
      eq: (key: string, value: unknown) => { predicates.push(row => field(row, key) === value); return query },
      in: (key: string, values: unknown[]) => { predicates.push(row => values.includes(field(row, key))); return query },
      update: (value: Row) => { patch = value; return query },
      upsert: (value: Row[]) => { insert = value; return query },
      single: async () => execute(true), maybeSingle: async () => execute(true),
      then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(execute(false)).then(resolve, reject),
    }
    return query
  }
  return { admin: { from }, tables, writes, controls, item: () => tables.social_content_queue[0], publish: () => tables.social_content_publishes[0] }
}
