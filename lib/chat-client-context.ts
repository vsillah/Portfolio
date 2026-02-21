import { supabaseAdmin } from '@/lib/supabase'

export interface ClientContext {
  name: string | null
  email: string
  role: string
  activeProjects: { name: string; status: string; phase: number | null }[]
  recentOrders: { id: number; amount: number; status: string; date: string; items: string[] }[]
  activeSubscriptions: { planName: string; status: string }[]
}

/**
 * Fetch contextual data about an authenticated client for the AI assistant.
 * Returns null if the user has no meaningful data.
 */
export async function fetchClientContext(userId: string): Promise<ClientContext | null> {
  const [profileRes, ordersRes, subscriptionsRes] = await Promise.all([
    supabaseAdmin
      .from('user_profiles')
      .select('email, full_name, role')
      .eq('id', userId)
      .single(),

    supabaseAdmin
      .from('orders')
      .select('id, final_amount, status, created_at, order_items(quantity, price_at_purchase, products(title))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),

    supabaseAdmin
      .from('client_subscriptions')
      .select('status, continuity_plans(name)')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing'])
      .limit(5),
  ])

  const profile = profileRes.data
  if (!profile) return null

  // For client_projects, match by email since the table uses client_email not user_id
  const projectsByEmail = await supabaseAdmin
    .from('client_projects')
    .select('project_name, project_status, current_phase')
    .eq('client_email', profile.email)
    .in('project_status', ['active', 'paused'])
    .order('created_at', { ascending: false })
    .limit(5)

  const activeProjects = (projectsByEmail.data || []).map((p: Record<string, unknown>) => ({
    name: p.project_name as string,
    status: p.project_status as string,
    phase: (p.current_phase as number) ?? null,
  }))

  const recentOrders = (ordersRes.data || []).map((o: Record<string, unknown>) => ({
    id: o.id as number,
    amount: Number(o.final_amount),
    status: o.status as string,
    date: o.created_at as string,
    items: ((o.order_items as Record<string, unknown>[]) || []).map(
      (item: Record<string, unknown>) => {
        const product = item.products as Record<string, unknown> | null
        return product?.title as string || 'Unknown item'
      }
    ),
  }))

  const activeSubscriptions = (subscriptionsRes.data || []).map((s: Record<string, unknown>) => ({
    planName: (s.continuity_plans as Record<string, unknown>)?.name as string || 'Unknown plan',
    status: s.status as string,
  }))

  return {
    name: profile.full_name ?? null,
    email: profile.email,
    role: profile.role,
    activeProjects,
    recentOrders,
    activeSubscriptions,
  }
}

/**
 * Format client context into a concise summary string for the AI prompt.
 */
export function formatClientContextForAI(ctx: ClientContext): string {
  const lines: string[] = []

  lines.push(`Authenticated client: ${ctx.name || 'Unknown'} (${ctx.email})`)

  if (ctx.activeProjects.length > 0) {
    lines.push('Active projects:')
    for (const p of ctx.activeProjects) {
      const phase = p.phase ? ` — Phase ${p.phase}` : ''
      lines.push(`  - "${p.name}" (${p.status}${phase})`)
    }
  }

  if (ctx.recentOrders.length > 0) {
    lines.push('Recent orders:')
    for (const o of ctx.recentOrders) {
      const items = o.items.join(', ')
      lines.push(`  - Order #${o.id}: $${o.amount.toFixed(2)} (${o.status}) — ${items}`)
    }
  }

  if (ctx.activeSubscriptions.length > 0) {
    lines.push('Active subscriptions:')
    for (const s of ctx.activeSubscriptions) {
      lines.push(`  - ${s.planName} (${s.status})`)
    }
  }

  if (ctx.activeProjects.length === 0 && ctx.recentOrders.length === 0 && ctx.activeSubscriptions.length === 0) {
    lines.push('No purchase history, active projects, or subscriptions on record.')
  }

  return lines.join('\n')
}
