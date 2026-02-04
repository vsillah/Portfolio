// API Route: Product Offer Roles Management
// Handles CRUD operations for product classification using Hormozi framework

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import { ProductOfferRole, OfferRole } from '@/lib/sales-scripts';

// GET - Fetch all products with their offer roles
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    // Get filter parameters
    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get('role') as OfferRole | null;
    const activeOnly = searchParams.get('active') !== 'false';

    // Try fetching from products table directly (view may not exist yet)
    let query = supabaseAdmin
      .from('products')
      .select('*')
      .order('display_order', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data: products, error } = await query;

    if (error) {
      console.error('Error fetching products:', error);
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }

    // If we have products, try to get their roles
    let productsWithRoles = products || [];
    if (products && products.length > 0) {
      const { data: roles } = await supabaseAdmin
        .from('product_offer_roles')
        .select('*');
      
      const rolesMap = new Map((roles || []).map((r: { product_id: number; [key: string]: unknown }) => [r.product_id, r]));
      productsWithRoles = products.map((p: { id: number; [key: string]: unknown }) => ({
        ...p,
        ...(rolesMap.get(p.id) || {}),
      }));
      
      // Filter by role if specified
      if (roleFilter) {
        productsWithRoles = productsWithRoles.filter((p: { offer_role?: string }) => p.offer_role === roleFilter);
      }
    }

    return NextResponse.json({ products: productsWithRoles });
  } catch (error) {
    console.error('Products API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create or update a product offer role
export async function POST(request: NextRequest) {
  try {
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const body = await request.json();
    const {
      product_id,
      offer_role,
      dream_outcome_description,
      likelihood_multiplier,
      time_reduction,
      effort_reduction,
      retail_price,
      offer_price,
      perceived_value,
      bonus_name,
      bonus_description,
      qualifying_actions,
      payout_type,
      display_order,
      is_active = true,
    } = body;

    if (!product_id || !offer_role) {
      return NextResponse.json(
        { error: 'product_id and offer_role are required' },
        { status: 400 }
      );
    }

    // Upsert the product offer role
    const { data, error } = await supabaseAdmin
      .from('product_offer_roles')
      .upsert({
        product_id,
        offer_role,
        dream_outcome_description,
        likelihood_multiplier,
        time_reduction,
        effort_reduction,
        retail_price,
        offer_price,
        perceived_value,
        bonus_name,
        bonus_description,
        qualifying_actions,
        payout_type,
        display_order,
        is_active,
      }, {
        onConflict: 'product_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting product offer role:', error);
      return NextResponse.json({ error: 'Failed to save product role' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Products API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove a product offer role
export async function DELETE(request: NextRequest) {
  try {
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('product_id');

    if (!productId) {
      return NextResponse.json({ error: 'product_id is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('product_offer_roles')
      .delete()
      .eq('product_id', productId);

    if (error) {
      console.error('Error deleting product offer role:', error);
      return NextResponse.json({ error: 'Failed to delete product role' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Products API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
