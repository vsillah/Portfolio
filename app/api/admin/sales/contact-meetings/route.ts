import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/sales/contact-meetings?contact_submission_id=123
 *
 * Returns meeting records and action tasks for a contact (lead or client).
 * Used by the sales conversation page to show "Previous meetings & tasks".
 *
 * Meetings are included when:
 * 1. meeting_records.contact_submission_id = this contact (explicit link), or
 * 2. meeting_records.client_project_id is one of this contact's client_projects (after conversion).
 * If past meetings were created without either link (e.g. before assign-lead or with no project),
 * they won't appear until linked via Admin → Meeting Tasks → "Assign lead" on the meeting's task.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const contactSubmissionId = searchParams.get('contact_submission_id');
  if (!contactSubmissionId) {
    return NextResponse.json(
      { error: 'contact_submission_id is required' },
      { status: 400 }
    );
  }
  const contactId = parseInt(contactSubmissionId, 10);
  if (Number.isNaN(contactId)) {
    return NextResponse.json(
      { error: 'contact_submission_id must be a number' },
      { status: 400 }
    );
  }

  try {
    // Client project IDs for this contact (if they converted)
    const { data: projects } = await supabaseAdmin
      .from('client_projects')
      .select('id')
      .eq('contact_submission_id', contactId);
    const clientProjectIds = (projects || []).map((p: { id: string }) => p.id);

    // Meetings: linked to this contact directly or via their client project
    const selectCols =
      'id, meeting_type, meeting_date, duration_minutes, transcript, structured_notes, key_decisions, action_items, open_questions, recording_url, contact_submission_id, client_project_id, created_at';

    const [byContactRes, byProjectRes] = await Promise.all([
      supabaseAdmin
        .from('meeting_records')
        .select(selectCols)
        .eq('contact_submission_id', contactId)
        .order('meeting_date', { ascending: false })
        .limit(50),
      clientProjectIds.length > 0
        ? supabaseAdmin
            .from('meeting_records')
            .select(selectCols)
            .in('client_project_id', clientProjectIds)
            .order('meeting_date', { ascending: false })
            .limit(50)
        : { data: [] as unknown[], error: null },
    ]);

    const byContact = byContactRes.data || [];
    const byProject = (byProjectRes.data || []) as typeof byContact;
    const seen = new Set<string>(byContact.map((m: { id: string }) => m.id));
    const merged = [...byContact];
    for (const m of byProject) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        merged.push(m);
      }
    }
    merged.sort((a, b) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime());
    const meetings = merged.slice(0, 50);

    if (byContactRes.error || byProjectRes.error) {
      console.error('contact-meetings: meetings error', byContactRes.error || byProjectRes.error);
      return NextResponse.json(
        { error: 'Failed to fetch meetings' },
        { status: 500 }
      );
    }

    const meetingIds = meetings.map((m: { id: string }) => m.id);
    if (meetingIds.length === 0) {
      return NextResponse.json({ meetings, tasks: [] });
    }

    const { data: tasks, error: tasksError } = await supabaseAdmin
      .from('meeting_action_tasks')
      .select('id, meeting_record_id, title, description, owner, due_date, status, completed_at, display_order, created_at')
      .in('meeting_record_id', meetingIds)
      .order('display_order', { ascending: true });

    if (tasksError) {
      console.error('contact-meetings: tasks error', tasksError);
      return NextResponse.json(
        { error: 'Failed to fetch tasks' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      meetings: meetings || [],
      tasks: (tasks || []).map((t: { meeting_record_id: string; [k: string]: unknown }) => ({
        ...t,
        meeting_record_id: t.meeting_record_id,
      })),
    });
  } catch (err) {
    console.error('contact-meetings error', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
