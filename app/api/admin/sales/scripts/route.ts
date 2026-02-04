// API Route: Sales Scripts Management
// Handles CRUD operations for sales scripts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import { SalesScript, OfferType } from '@/lib/sales-scripts';

// GET - Fetch all sales scripts
export async function GET(request: NextRequest) {
  try {
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    // Get filter parameters
    const { searchParams } = new URL(request.url);
    const offerType = searchParams.get('offer_type') as OfferType | null;
    const activeOnly = searchParams.get('active') !== 'false';

    // Fetch scripts
    let query = supabaseAdmin
      .from('sales_scripts')
      .select('*')
      .order('created_at', { ascending: false });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (offerType) {
      query = query.eq('offer_type', offerType);
    }

    const { data: scripts, error } = await query;

    if (error) {
      console.error('Error fetching scripts:', error);
      return NextResponse.json({ error: 'Failed to fetch scripts' }, { status: 500 });
    }

    return NextResponse.json({ scripts: scripts || [] });
  } catch (error) {
    console.error('Scripts API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new sales script
export async function POST(request: NextRequest) {
  try {
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const body = await request.json();
    const {
      name,
      description,
      offer_type,
      script_content,
      target_funnel_stage = [],
      qualifying_criteria,
      associated_products = [],
      is_active = true,
    } = body;

    if (!name || !offer_type || !script_content) {
      return NextResponse.json(
        { error: 'name, offer_type, and script_content are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('sales_scripts')
      .insert({
        name,
        description,
        offer_type,
        script_content,
        target_funnel_stage,
        qualifying_criteria,
        associated_products,
        is_active,
        created_by: adminResult.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating script:', error);
      return NextResponse.json({ error: 'Failed to create script' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Scripts API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update a sales script
export async function PUT(request: NextRequest) {
  try {
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Script ID is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('sales_scripts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating script:', error);
      return NextResponse.json({ error: 'Failed to update script' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Scripts API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a sales script
export async function DELETE(request: NextRequest) {
  try {
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Script ID is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('sales_scripts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting script:', error);
      return NextResponse.json({ error: 'Failed to delete script' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Scripts API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
