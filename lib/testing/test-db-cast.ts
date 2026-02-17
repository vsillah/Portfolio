/**
 * Type cast for Supabase client when accessing test-only tables
 * (test_runs, test_client_sessions, test_errors, test_remediation_requests).
 * App schema types do not include these tables, so we use this cast to satisfy TypeScript.
 */

/** Chain type for update().eq().eq() so TypeScript allows multiple eq() calls before await */
export interface UpdateChain {
  eq(col: string, val: string): UpdateChain & Promise<unknown>
  in(col: string, vals: unknown[]): Promise<unknown>
}

/** Result of .select().eq().single() or .select().in() */
export interface SelectSingleResult {
  single(): Promise<{ data: unknown }>
}

export interface SelectBuilder {
  eq(col: string, val: string): SelectSingleResult
  in(col: string, vals: unknown[]): Promise<{ data: unknown }>
}

/** Cast for test DB operations; app schema may not include test_* tables */
export interface TestDbCast {
  from(table: string): {
    insert(value: object): { select(col: string): { single(): Promise<{ data: { id: string } | null; error: unknown }> } }
    insert(value: object[]): Promise<unknown>
    update(value: object): UpdateChain
    select(col?: string): SelectBuilder
  }
}

export function testDb(supabase: ReturnType<typeof import('@supabase/supabase-js').createClient>): TestDbCast {
  return supabase as unknown as TestDbCast
}
