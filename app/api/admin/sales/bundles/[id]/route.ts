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

    // Fetch base bundle name if this bundle builds on another
    let baseBundleName: string | undefined;
    if (bundle.base_bundle_id) {
      const { data: baseBundle } = await supabaseAdmin
        .from('offer_bundles')
        .select('name')
        .eq('id', bundle.base_bundle_id)
        .single();
      baseBundleName = baseBundle?.name;
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
        base_bundle_name: baseBundleName,
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

    // Fetch existing bundle to enforce custom-bundle pricing exclusion
    const { data: existing } = await supabaseAdmin
      .from('offer_bundles')
      .select('bundle_type')
      .eq('id', id)
      .single();

    const isCustomBundle = existing?.bundle_type === 'custom';

    const {
      name,
      description,
      bundle_items,
      bundle_price,
      default_discount_percent,
      notes,
      is_active,
      // Base bundle
      base_bundle_id,
      // Pricing page fields
      pricing_page_segments,
      pricing_tier_slug,
      tagline,
      target_audience_display,
      pricing_display_order,
      is_featured,
      guarantee_name,
      guarantee_description,
      cta_text,
      cta_href,
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
    if (base_bundle_id !== undefined) updateData.base_bundle_id = base_bundle_id;
    // Pricing page fields (custom bundles must never appear on pricing page)
    if (pricing_page_segments !== undefined && !isCustomBundle) {
      updateData.pricing_page_segments = pricing_page_segments;
    }
    if (pricing_tier_slug !== undefined) updateData.pricing_tier_slug = pricing_tier_slug;
    if (tagline !== undefined) updateData.tagline = tagline;
    if (target_audience_display !== undefined) updateData.target_audience_display = target_audience_display;
    if (pricing_display_order !== undefined) updateData.pricing_display_order = pricing_display_order;
    if (is_featured !== undefined) updateData.is_featured = is_featured;
    if (guarantee_name !== undefined) updateData.guarantee_name = guarantee_name;
    if (guarantee_description !== undefined) updateData.guarantee_description = guarantee_description;
    if (cta_text !== undefined) updateData.cta_text = cta_text;
    if (cta_href !== undefined) updateData.cta_href = cta_href;

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
