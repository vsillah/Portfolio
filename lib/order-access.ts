import { NextRequest } from 'next/server'
import { verifyAuth, isAuthError, type AuthError } from '@/lib/auth-server'

type OrderCaller = {
  user: { id: string } | null
  guestEmail: string | null
}

/** Resolve request credentials before querying privileged order data. */
export async function verifyOrderCaller(request: NextRequest): Promise<OrderCaller | AuthError> {
  if (request.headers.has('authorization')) {
    const auth = await verifyAuth(request)
    // Invalid credentials must never fall back to guest access.
    if (isAuthError(auth)) return auth
    return { user: auth.user, guestEmail: null }
  }

  const guestEmail = request.headers.get('x-guest-email')?.trim().toLowerCase()
  if (!guestEmail) return { error: 'Authentication or guest email required', status: 401 }
  return { user: null, guestEmail }
}

/** Guest email is accepted only for an existing order without an account owner. */
export function canAccessOrder(
  caller: OrderCaller,
  order: { user_id?: string | null; guest_email?: string | null },
): boolean {
  if (caller.user) return order.user_id === caller.user.id
  return order.user_id === null && !!caller.guestEmail &&
    caller.guestEmail === order.guest_email?.trim().toLowerCase()
}
