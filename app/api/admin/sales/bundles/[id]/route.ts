// API Route: Single Bundle Operations
// Handles GET, PUT, DELETE for individual bundles

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import { BundleItem } from '@/lib/sales-scripts';

// GET - Fetch a single bundle with resolved content
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const { id } = params;

    // Fetch the bundle
    const { data: bundle, error } = await supabaseAdmin
      .from('offer_bundles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !bundle) {
      return NextResponse.json({ error: 'Bundle not found' }, { status: 404 });
    }

    // Fetch parent info if this is a forked bundle
    let parentName: string | undefined;
    if (bundle.parent_bundle_id) {
      const { data: parent } = await supabaseAdmin
        .from('offer_bundles')
        .select('name')
        .eq('id', bundle.parent_bundle_id)
        .single();
      parentName = parent?.name;
    }

    // Fetch fork count
    const { count: forkCount } = await supabaseAdmin
      .from('offer_bundles')
      .select('id', { count: 'exact', head: true })
      .eq('parent_bundle_id', id);

    return NextResponse.json({ 
      bundle: {
        ...bundle,
        item_count: (bundle.bundle_items || []).length,
        parent_name: parentName,
        fork_count: forkCount || 0,
      }
    });

  } catch (error) {
    console.error('Error in bundle GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update a bundle
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const { id } = params;
    const body = await request.json();

    const { 
      name, 
      description, 
      bundle_items, 
      bundle_price,
      default_discount_percent,
      notes,
      is_active,
    } = body;

    // Build update object (only include provided fields)
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (bundle_items !== undefined) {
      updateData.bundle_items = bundle_items;
      // Recalculate totals
      const totals = await calculateBundleTotals(bundle_items);
      updateData.total_retail_value = totals.totalRetailValue;
      updateData.total_perceived_value = totals.totalPerceivedValue;
    }
    if (bundle_price !== undefined) updateData.bundle_price = bundle_price;
    if (default_discount_percent !== undefined) updateData.default_discount_percent = default_discount_percent;
    if (notes !== undefined) updateData.notes = notes;
    if (is_active !== undefined) updateData.is_active = is_active;

    // Update bundle
    const { data: bundle, error } = await supabaseAdmin
      .from('offer_bundles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating bundle:', error);
      return NextResponse.json({ error: 'Failed to update bundle' }, { status: 500 });
    }

    return NextResponse.json({ bundle });

  } catch (error) {
    console.error('Error in bundle PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Soft delete a bundle
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const { id } = params;

    // Check if bundle has forks (children)
    const { count: forkCount } = await supabaseAdmin
      .from('offer_bundles')
      .select('id', { count: 'exact', head: true })
      .eq('parent_bundle_id', id);

    // Soft delete (set is_active to false)
    const { error } = await supabaseAdmin
      .from('offer_bundles')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('Error deleting bundle:', error);
      return NextResponse.json({ error: 'Failed to delete bundle' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: forkCount && forkCount > 0 
        ? `Bundle deactivated. Note: ${forkCount} derived bundles still reference this bundle.`
        : 'Bundle deactivated successfully.'
    });

  } catch (error) {
    console.error('Error in bundle DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper: Calculate bundle totals from items
async function calculateBundleTotals(items: BundleItem[]): Promise<{
  totalRetailValue: number;
  totalPerceivedValue: number;
}> {
  let totalRetailValue = 0;
  let totalPerceivedValue = 0;

  for (const item of items) {
    // Check for overrides first
    if (item.override_price !== undefined) {
      totalRetailValue += item.override_price;
      totalPerceivedValue += item.override_perceived_value ?? item.override_price;
      continue;
    }

    // Fetch canonical values from content_offer_roles
    const { data: role } = await supabaseAdmin
      .from('content_offer_roles')
      .select('retail_price, perceived_value')
      .eq('content_type', item.content_type)
      .eq('content_id', item.content_id)
      .single();

    if (role) {
      totalRetailValue += role.retail_price ?? 0;
      totalPerceivedValue += role.perceived_value ?? role.retail_price ?? 0;
    }
  }

  return { totalRetailValue, totalPerceivedValue };
}
