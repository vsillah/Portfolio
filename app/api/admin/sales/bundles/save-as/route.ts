// API Route: Save As New Bundle
// Allows sales reps to save customized bundles as new templates

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import { ResolvedBundleItem, createBundleItemFromResolved } from '@/lib/sales-scripts';

// POST - Save session customizations as a new bundle template
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const body = await request.json();
    const { 
      name, 
      description, 
      items,                    // ResolvedBundleItem[] from the session
      parent_bundle_id,         // Original bundle this was forked from
      bundle_price,
      default_discount_percent,
      notes,
      preserve_overrides = true, // Whether to keep the overrides in the new bundle
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Bundle name is required' }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    // Convert ResolvedBundleItems back to BundleItems
    const bundleItems = (items as ResolvedBundleItem[]).map((resolved, index) => 
      createBundleItemFromResolved(
        { ...resolved, display_order: resolved.display_order ?? index },
        preserve_overrides
      )
    );

    // Calculate totals
    let totalRetailValue = 0;
    let totalPerceivedValue = 0;

    for (const resolved of items as ResolvedBundleItem[]) {
      totalRetailValue += resolved.role_retail_price ?? resolved.price ?? 0;
      totalPerceivedValue += resolved.perceived_value ?? resolved.role_retail_price ?? resolved.price ?? 0;
    }

    // If parent_bundle_id is provided, verify it exists
    if (parent_bundle_id) {
      const { data: parent, error: parentError } = await supabaseAdmin
        .from('offer_bundles')
        .select('id, name')
        .eq('id', parent_bundle_id)
        .single();

      if (parentError || !parent) {
        return NextResponse.json({ error: 'Parent bundle not found' }, { status: 400 });
      }
    }

    // Create the new bundle. Custom bundles must never appear on the pricing page:
    // we do NOT set pricing_page_segments (stays empty/default), and the pricing
    // API filters by bundle_type != 'custom' and .contains(pricing_page_segments, [segment]).
    const { data: bundle, error } = await supabaseAdmin
      .from('offer_bundles')
      .insert({
        name,
        description,
        bundle_items: bundleItems,
        total_retail_value: totalRetailValue,
        total_perceived_value: totalPerceivedValue,
        bundle_price: bundle_price ?? totalRetailValue,
        default_discount_percent,
        notes,
        parent_bundle_id,
        bundle_type: 'custom', // Saved-as bundles are always custom
        created_by: adminResult.user.id,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating bundle:', error);
      return NextResponse.json({ error: 'Failed to save bundle' }, { status: 500 });
    }

    return NextResponse.json({ 
      bundle,
      message: parent_bundle_id 
        ? `Bundle saved as "${name}" (derived from parent bundle)`
        : `Bundle saved as "${name}"`
    }, { status: 201 });

  } catch (error) {
    console.error('Error in bundles save-as POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
