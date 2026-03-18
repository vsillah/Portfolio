import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/meetings/bulk-delete
 *
 * Delete multiple meeting records by id. Admin only.
 * meeting_action_tasks rows referencing these meetings are cascade-deleted.
 * Body: { ids: string[] }
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids array is required and must contain at least one UUID' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('meeting_records').delete().in('id', ids);

  if (error) {
    console.error('[admin/meetings/bulk-delete]', error);
    return NextResponse.json(
      { error: 'Failed to delete meetings' },
      { status: 500 }
    );
  }

  return NextResponse.json({ deleted: ids.length });
}
