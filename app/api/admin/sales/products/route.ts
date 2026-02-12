// API Route: Content Offer Roles Management
// Handles CRUD operations for content classification using Hormozi framework
// Supports all content types: products, projects, videos, publications, music, lead_magnets, prototypes

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import { ProductOfferRole, OfferRole, ContentType, ContentWithRole } from '@/lib/sales-scripts';

// Content type to table mapping
const CONTENT_TABLE_MAP: Record<ContentType, { table: string; idField: string; activeField: string | null; imageField: string | null }> = {
  product: { table: 'products', idField: 'id', activeField: 'is_active', imageField: 'image_url' },
  project: { table: 'projects', idField: 'id', activeField: 'is_published', imageField: 'image' },
  video: { table: 'videos', idField: 'id', activeField: 'is_published', imageField: 'thumbnail_url' },
  publication: { table: 'publications', idField: 'id', activeField: 'is_published', imageField: null },
  music: { table: 'music', idField: 'id', activeField: 'is_published', imageField: null },
  lead_magnet: { table: 'lead_magnets', idField: 'id', activeField: 'is_active', imageField: null },
  prototype: { table: 'app_prototypes', idField: 'id', activeField: null, imageField: 'thumbnail_url' },
  service: { table: 'services', idField: 'id', activeField: 'is_active', imageField: 'image_url' },
};

// GET - Fetch all content with their offer roles
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
    const contentTypeFilter = searchParams.get('content_type') as ContentType | null;
    const activeOnly = searchParams.get('active') !== 'false';

    // Fetch all content offer roles first
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('content_offer_roles')
      .select('*');

    if (rolesError) {
      console.error('Error fetching content offer roles:', rolesError);
      // Continue without roles if table doesn't exist yet
    }

    const rolesMap = new Map(
      (roles || []).map((r: { content_type: string; content_id: string; [key: string]: unknown }) => 
        [`${r.content_type}:${r.content_id}`, r]
      )
    );

    // Fetch content from all tables or just the filtered one
    const contentTypes = contentTypeFilter 
      ? [contentTypeFilter] 
      : Object.keys(CONTENT_TABLE_MAP) as ContentType[];

    const allContent: ContentWithRole[] = [];

    for (const contentType of contentTypes) {
      const config = CONTENT_TABLE_MAP[contentType];
      
      try {
        let query = supabaseAdmin.from(config.table).select('*');
        
        // Apply active filter if applicable
        if (activeOnly && config.activeField) {
          query = query.eq(config.activeField, true);
        }
        
        query = query.order('display_order', { ascending: true });
        
        const { data: items, error } = await query;
        
        if (error) {
          console.error(`Error fetching ${contentType}:`, error);
          continue;
        }
        
        // Transform to unified format and attach roles
        for (const item of items || []) {
          const roleKey = `${contentType}:${item.id}`;
          const role = rolesMap.get(roleKey) || {};
          
          const contentItem: ContentWithRole = {
            content_type: contentType,
            content_id: String(item.id),
            title: item.title || item.name || 'Untitled',
            description: item.description || null,
            subtype: getSubtype(contentType, item),
            price: item.price || null,
            image_url: config.imageField ? item[config.imageField] : null,
            is_active: config.activeField ? item[config.activeField] : true,
            display_order: item.display_order || 0,
            created_at: item.created_at,
            // Role fields
            role_id: (role as { id?: string }).id || null,
            offer_role: (role as { offer_role?: OfferRole }).offer_role || null,
            dream_outcome_description: (role as { dream_outcome_description?: string }).dream_outcome_description || null,
            likelihood_multiplier: (role as { likelihood_multiplier?: number }).likelihood_multiplier || null,
            time_reduction: (role as { time_reduction?: number }).time_reduction || null,
            effort_reduction: (role as { effort_reduction?: number }).effort_reduction || null,
            role_retail_price: (role as { retail_price?: number }).retail_price || null,
            offer_price: (role as { offer_price?: number }).offer_price || null,
            perceived_value: (role as { perceived_value?: number }).perceived_value || null,
            bonus_name: (role as { bonus_name?: string }).bonus_name || null,
            bonus_description: (role as { bonus_description?: string }).bonus_description || null,
            qualifying_actions: (role as { qualifying_actions?: Record<string, unknown> }).qualifying_actions || null,
            payout_type: (role as { payout_type?: 'credit' | 'refund' | 'rollover' }).payout_type || null,
          };
          
          allContent.push(contentItem);
        }
      } catch (err) {
        console.error(`Error processing ${contentType}:`, err);
        continue;
      }
    }

    // Filter by role if specified
    let filteredContent = allContent;
    if (roleFilter) {
      filteredContent = allContent.filter(c => c.offer_role === roleFilter);
    }

    // Sort by content type then display order
    filteredContent.sort((a, b) => {
      if (a.content_type !== b.content_type) {
        return a.content_type.localeCompare(b.content_type);
      }
      return (a.display_order || 0) - (b.display_order || 0);
    });

    // Also return legacy format for backward compatibility
    const products = filteredContent.filter(c => c.content_type === 'product').map(c => ({
      id: parseInt(c.content_id),
      title: c.title,
      description: c.description,
      type: c.subtype,
      price: c.price,
      image_url: c.image_url,
      is_active: c.is_active,
      display_order: c.display_order,
      // Role fields
      role_id: c.role_id,
      offer_role: c.offer_role,
      dream_outcome_description: c.dream_outcome_description,
      likelihood_multiplier: c.likelihood_multiplier,
      time_reduction: c.time_reduction,
      effort_reduction: c.effort_reduction,
      role_retail_price: c.role_retail_price,
      offer_price: c.offer_price,
      perceived_value: c.perceived_value,
      bonus_name: c.bonus_name,
      bonus_description: c.bonus_description,
      qualifying_actions: c.qualifying_actions,
      payout_type: c.payout_type,
    }));

    return NextResponse.json({ 
      content: filteredContent,
      products, // Legacy support
    });
  } catch (error) {
    console.error('Content API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper to get subtype based on content type
function getSubtype(contentType: ContentType, item: Record<string, unknown>): string | null {
  switch (contentType) {
    case 'product':
      return (item.type as string) || 'merchandise';
    case 'music':
      return (item.genre as string) || null;
    case 'lead_magnet':
      return (item.file_type as string) || null;
    case 'prototype':
      return (item.product_type as string) || null;
    case 'service':
      return (item.service_type as string) || null;
    default:
      return contentType;
  }
}

// POST - Create or update a content offer role
export async function POST(request: NextRequest) {
  try {
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const body = await request.json();
    const {
      // New content-based fields
      content_type,
      content_id,
      // Legacy product_id support
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

    // Determine content type and id (support both new and legacy formats)
    const finalContentType = content_type || 'product';
    const finalContentId = content_id || (product_id ? String(product_id) : null);

    if (!finalContentId || !offer_role) {
      return NextResponse.json(
        { error: 'content_id (or product_id) and offer_role are required' },
        { status: 400 }
      );
    }

    // Upsert the content offer role
    const { data, error } = await supabaseAdmin
      .from('content_offer_roles')
      .upsert({
        content_type: finalContentType,
        content_id: finalContentId,
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
        onConflict: 'content_type,content_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting content offer role:', error);
      return NextResponse.json({ error: 'Failed to save content role' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Content API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove a content offer role
export async function DELETE(request: NextRequest) {
  try {
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const { searchParams } = new URL(request.url);
    const contentType = searchParams.get('content_type') || 'product';
    const contentId = searchParams.get('content_id') || searchParams.get('product_id');

    if (!contentId) {
      return NextResponse.json({ error: 'content_id (or product_id) is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('content_offer_roles')
      .delete()
      .eq('content_type', contentType)
      .eq('content_id', contentId);

    if (error) {
      console.error('Error deleting content offer role:', error);
      return NextResponse.json({ error: 'Failed to delete content role' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Content API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
