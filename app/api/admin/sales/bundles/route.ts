// API Route: Offer Bundles Management
// Handles list and create operations for offer bundles

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import { OfferBundle, BundleItem, OfferBundleWithStats, ContentType } from '@/lib/sales-scripts';

// Content type to table mapping for preview resolution
const CONTENT_TABLE_MAP: Record<ContentType, string> = {
  product: 'products',
  project: 'projects',
  video: 'videos',
  publication: 'publications',
  music: 'music',
  lead_magnet: 'lead_magnets',
  prototype: 'app_prototypes',
  service: 'services',
};

// Preview item type
interface PreviewItem {
  content_type: ContentType;
  content_id: string;
  title: string;
}

// GET - Fetch all bundles with stats
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    // Get filter parameters
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') !== 'false';
    const includeChildren = searchParams.get('include_children') === 'true';

    // Build query
    let query = supabaseAdmin
      .from('offer_bundles')
      .select('*')
      .order('created_at', { ascending: false });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    // Optionally exclude child bundles (forks) from main list
    if (!includeChildren) {
      query = query.is('parent_bundle_id', null);
    }

    const { data: bundles, error } = await query;

    if (error) {
      console.error('Error fetching bundles:', error);
      return NextResponse.json({ error: 'Failed to fetch bundles' }, { status: 500 });
    }

    // Fetch fork counts for each bundle
    const bundleIds = bundles?.map((b: OfferBundle) => b.id) || [];
    const { data: forkCounts } = await supabaseAdmin
      .from('offer_bundles')
      .select('parent_bundle_id')
      .in('parent_bundle_id', bundleIds);

    const forkCountMap = new Map<string, number>();
    forkCounts?.forEach((f: { parent_bundle_id: string }) => {
      const count = forkCountMap.get(f.parent_bundle_id) || 0;
      forkCountMap.set(f.parent_bundle_id, count + 1);
    });

    // Fetch parent names for child bundles
    const parentIds = [...new Set(bundles?.filter((b: OfferBundle) => b.parent_bundle_id).map((b: OfferBundle) => b.parent_bundle_id) || [])];
    const { data: parents } = parentIds.length > 0 
      ? await supabaseAdmin
          .from('offer_bundles')
          .select('id, name')
          .in('id', parentIds)
      : { data: [] };
    
    const parentNameMap = new Map(parents?.map((p: { id: string; name: string }) => [p.id, p.name]) || []);

    // Collect all unique content items for preview resolution (limit to first 3 per bundle)
    const contentToFetch: Map<string, { type: ContentType; id: string }[]> = new Map();
    for (const bundle of bundles || []) {
      const items = (bundle.bundle_items || []).slice(0, 3); // First 3 items for preview
      for (const item of items) {
        const table = CONTENT_TABLE_MAP[item.content_type as ContentType];
        if (table) {
          const existing = contentToFetch.get(table) || [];
          existing.push({ type: item.content_type, id: item.content_id });
          contentToFetch.set(table, existing);
        }
      }
    }

    // Fetch content titles in batch per table
    const contentTitleMap = new Map<string, string>(); // key: "type:id", value: title
    for (const [table, items] of contentToFetch.entries()) {
      const ids = [...new Set(items.map(i => i.id))];
      if (ids.length > 0) {
        const { data: contents } = await supabaseAdmin
          .from(table)
          .select('id, title, name')
          .in('id', ids);
        
        for (const content of contents || []) {
          const matchingItems = items.filter(i => i.id === content.id);
          for (const item of matchingItems) {
            contentTitleMap.set(`${item.type}:${content.id}`, content.title || content.name || 'Untitled');
          }
        }
      }
    }

    // Transform to OfferBundleWithStats with preview items
    const bundlesWithStats = (bundles || []).map((bundle: OfferBundle) => {
      const bundleItems = bundle.bundle_items || [];
      const previewItems: PreviewItem[] = bundleItems.slice(0, 3).map((item: BundleItem) => ({
        content_type: item.content_type,
        content_id: item.content_id,
        title: contentTitleMap.get(`${item.content_type}:${item.content_id}`) || 'Unknown',
      }));

      return {
        id: bundle.id,
        name: bundle.name,
        description: bundle.description,
        parent_bundle_id: bundle.parent_bundle_id,
        bundle_type: bundle.bundle_type || 'standard',
        bundle_items: bundleItems,
        total_retail_value: bundle.total_retail_value,
        total_perceived_value: bundle.total_perceived_value,
        bundle_price: bundle.bundle_price,
        default_discount_percent: bundle.default_discount_percent,
        target_funnel_stages: bundle.target_funnel_stages,
        notes: bundle.notes,
        is_active: bundle.is_active,
        created_by: bundle.created_by,
        created_at: bundle.created_at,
        updated_at: bundle.updated_at,
        // Stats
        item_count: bundleItems.length,
        parent_name: bundle.parent_bundle_id ? parentNameMap.get(bundle.parent_bundle_id) : undefined,
        fork_count: forkCountMap.get(bundle.id) || 0,
        // Preview
        preview_items: previewItems,
      };
    });

    return NextResponse.json({ bundles: bundlesWithStats });

  } catch (error) {
    console.error('Error in bundles GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new bundle
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
      bundle_items = [], 
      bundle_price,
      default_discount_percent,
      notes,
      parent_bundle_id,
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Bundle name is required' }, { status: 400 });
    }

    // Calculate totals from items
    const totals = await calculateBundleTotals(bundle_items);

    // Insert bundle
    const { data: bundle, error } = await supabaseAdmin
      .from('offer_bundles')
      .insert({
        name,
        description,
        bundle_items,
        total_retail_value: totals.totalRetailValue,
        total_perceived_value: totals.totalPerceivedValue,
        bundle_price: bundle_price ?? totals.totalRetailValue,
        default_discount_percent,
        notes,
        parent_bundle_id,
        bundle_type: parent_bundle_id ? 'custom' : 'standard',
        created_by: adminResult.user.id,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating bundle:', error);
      return NextResponse.json({ error: 'Failed to create bundle' }, { status: 500 });
    }

    return NextResponse.json({ bundle }, { status: 201 });

  } catch (error) {
    console.error('Error in bundles POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper: Calculate bundle totals from items by fetching content_offer_roles
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
