import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import type { CreateCriteriaTemplateInput } from '@/lib/campaigns';
import { isValidTrackingSource, isValidCriteriaType } from '@/lib/campaigns';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { data, error } = await supabaseAdmin
      .from('campaign_criteria_templates')
      .select('*')
      .eq('campaign_id', params.id)
      .order('display_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error: unknown) {
    console.error('Error fetching criteria templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch criteria templates' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body: CreateCriteriaTemplateInput = await request.json();

    if (!body.label_template?.trim()) {
      return NextResponse.json({ error: 'Label template is required' }, { status: 400 });
    }
    if (body.tracking_source && !isValidTrackingSource(body.tracking_source)) {
      return NextResponse.json({ error: 'Invalid tracking source' }, { status: 400 });
    }
    if (body.criteria_type && !isValidCriteriaType(body.criteria_type)) {
      return NextResponse.json({ error: 'Invalid criteria type' }, { status: 400 });
    }

    // Auto-assign next display_order
    const { data: maxRow } = await supabaseAdmin
      .from('campaign_criteria_templates')
      .select('display_order')
      .eq('campaign_id', params.id)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxRow?.display_order ?? -1) + 1;

    const { data, error } = await supabaseAdmin
      .from('campaign_criteria_templates')
      .insert({
        campaign_id: params.id,
        label_template: body.label_template.trim(),
        description_template: body.description_template?.trim() || null,
        criteria_type: body.criteria_type || 'action',
        tracking_source: body.tracking_source || 'manual',
        tracking_config: body.tracking_config || {},
        threshold_source: body.threshold_source || null,
        threshold_default: body.threshold_default || null,
        required: body.required !== false,
        display_order: body.display_order ?? nextOrder,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating criteria template:', error);
    return NextResponse.json(
      { error: 'Failed to create criteria template' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const criterionId = body.criterion_id;

    if (!criterionId) {
      return NextResponse.json({ error: 'criterion_id is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    const allowedFields = [
      'label_template', 'description_template', 'criteria_type',
      'tracking_source', 'tracking_config', 'threshold_source',
      'threshold_default', 'required', 'display_order',
    ];

    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    const { data, error } = await supabaseAdmin
      .from('campaign_criteria_templates')
      .update(updates)
      .eq('id', criterionId)
      .eq('campaign_id', params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: unknown) {
    console.error('Error updating criteria template:', error);
    return NextResponse.json(
      { error: 'Failed to update criteria template' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAdmin(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const criterionId = searchParams.get('criterion_id');

    if (!criterionId) {
      return NextResponse.json({ error: 'criterion_id query param is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('campaign_criteria_templates')
      .delete()
      .eq('id', criterionId)
      .eq('campaign_id', params.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting criteria template:', error);
    return NextResponse.json(
      { error: 'Failed to delete criteria template' },
      { status: 500 }
    );
  }
}
