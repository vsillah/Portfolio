/**
 * Admin API: Delete a proposal document (row and optional Storage object).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const auth = await verifyAdmin(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: proposalId, docId } = await params;
  if (!proposalId || !docId) {
    return NextResponse.json({ error: 'Proposal ID and document ID required' }, { status: 400 });
  }

  const { data: doc, error: fetchError } = await supabaseAdmin
    .from('proposal_documents')
    .select('id, file_path')
    .eq('id', docId)
    .eq('proposal_id', proposalId)
    .single();

  if (fetchError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const { error: deleteError } = await supabaseAdmin
    .from('proposal_documents')
    .delete()
    .eq('id', docId)
    .eq('proposal_id', proposalId);

  if (deleteError) {
    console.error('Error deleting proposal_document:', deleteError);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }

  if (doc.file_path) {
    await supabaseAdmin.storage.from('documents').remove([doc.file_path]);
  }

  return NextResponse.json({ success: true });
}
