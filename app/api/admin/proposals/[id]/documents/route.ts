/**
 * Admin API: List, create, and reorder proposal documents.
 * GET — list documents for proposal (ordered by display_order)
 * POST — upload PDF and create document row (multipart: file, title, document_type)
 * PATCH — reorder (body: { documentIds: string[] })
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

const DOCUMENT_TYPES = ['strategy_report', 'opportunity_quantification', 'proposal_package', 'other'] as const;
const BUCKET = 'documents';
const PATH_PREFIX = 'proposal-docs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: proposalId } = await params;
  if (!proposalId) {
    return NextResponse.json({ error: 'Proposal ID required' }, { status: 400 });
  }

  const { data: proposal } = await supabaseAdmin
    .from('proposals')
    .select('id')
    .eq('id', proposalId)
    .single();

  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  const { data: docs, error } = await supabaseAdmin
    .from('proposal_documents')
    .select('id, proposal_id, document_type, title, file_path, display_order, source, created_at')
    .eq('proposal_id', proposalId)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching proposal documents:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }

  return NextResponse.json({ documents: docs ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: proposalId } = await params;
  if (!proposalId) {
    return NextResponse.json({ error: 'Proposal ID required' }, { status: 400 });
  }

  const { data: proposal } = await supabaseAdmin
    .from('proposals')
    .select('id')
    .eq('id', proposalId)
    .single();

  if (!proposal) {
    return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const title = formData.get('title') as string | null;
  const documentType = formData.get('document_type') as string | null;

  if (!file || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json(
      { error: 'Missing required fields: file, title' },
      { status: 400 }
    );
  }

  const docType = documentType?.trim() && DOCUMENT_TYPES.includes(documentType.trim() as typeof DOCUMENT_TYPES[number])
    ? documentType.trim()
    : 'other';

  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
  }

  const { data: maxRow } = await supabaseAdmin
    .from('proposal_documents')
    .select('display_order')
    .eq('proposal_id', proposalId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxRow?.display_order ?? -1) + 1;

  const uuid = crypto.randomUUID();
  const filePath = `${PATH_PREFIX}/${proposalId}/${uuid}.pdf`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(filePath, buffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    console.error('Error uploading proposal document:', uploadError);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('proposal_documents')
    .insert({
      proposal_id: proposalId,
      document_type: docType,
      title: title.trim(),
      file_path: filePath,
      display_order: nextOrder,
      source: 'uploaded',
    })
    .select('id, proposal_id, document_type, title, file_path, display_order, source, created_at')
    .single();

  if (insertError) {
    console.error('Error inserting proposal_document:', insertError);
    await supabaseAdmin.storage.from(BUCKET).remove([filePath]);
    return NextResponse.json({ error: 'Failed to save document record' }, { status: 500 });
  }

  return NextResponse.json({ document: inserted }, { status: 201 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin(request);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: proposalId } = await params;
  if (!proposalId) {
    return NextResponse.json({ error: 'Proposal ID required' }, { status: 400 });
  }

  let body: { documentIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const documentIds = body.documentIds;
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return NextResponse.json({ error: 'documentIds array required' }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from('proposal_documents')
    .select('id')
    .eq('proposal_id', proposalId);

  const existingIds = new Set((existing ?? []).map((r: { id: string }) => r.id));
  const validIds = documentIds.filter((id): id is string => typeof id === 'string' && existingIds.has(id));
  if (validIds.length !== documentIds.length || validIds.length !== existingIds.size) {
    return NextResponse.json(
      { error: 'documentIds must match exactly the current document ids for this proposal' },
      { status: 400 }
    );
  }

  const updates = validIds.map((id, index) =>
    supabaseAdmin
      .from('proposal_documents')
      .update({ display_order: index })
      .eq('id', id)
      .eq('proposal_id', proposalId)
  );

  const results = await Promise.all(updates);
  const failed = results.some((r) => r.error);
  if (failed) {
    console.error('Error reordering proposal documents:', results);
    return NextResponse.json({ error: 'Failed to reorder' }, { status: 500 });
  }

  const { data: docs } = await supabaseAdmin
    .from('proposal_documents')
    .select('id, proposal_id, document_type, title, file_path, display_order, source, created_at')
    .eq('proposal_id', proposalId)
    .order('display_order', { ascending: true });

  return NextResponse.json({ documents: docs ?? [] });
}
