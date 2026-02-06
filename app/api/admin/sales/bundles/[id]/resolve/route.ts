// API Route: Resolve Bundle Items
// Returns fully resolved bundle items with overrides merged with canonical values

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import { 
  BundleItem, 
  ResolvedBundleItem, 
  ContentType,
  resolveBundleItem 
} from '@/lib/sales-scripts';

// Content type to table mapping
const CONTENT_TABLE_MAP: Record<ContentType, { table: string; imageField: string | null }> = {
  product: { table: 'products', imageField: 'image_url' },
  project: { table: 'projects', imageField: 'image' },
  video: { table: 'videos', imageField: 'thumbnail_url' },
  publication: { table: 'publications', imageField: null },
  music: { table: 'music', imageField: null },
  lead_magnet: { table: 'lead_magnets', imageField: null },
  prototype: { table: 'app_prototypes', imageField: 'thumbnail_url' },
  service: { table: 'services', imageField: 'image_url' },
};

// GET - Resolve bundle items with canonical + override values
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

    const bundleItems: BundleItem[] = bundle.bundle_items || [];
    const resolvedItems: ResolvedBundleItem[] = [];

    // Resolve each item
    for (const item of bundleItems) {
      const resolved = await resolveItem(item);
      if (resolved) {
        resolvedItems.push(resolved);
      }
    }

    // Sort by display_order
    resolvedItems.sort((a, b) => a.display_order - b.display_order);

    return NextResponse.json({ 
      bundle: {
        id: bundle.id,
        name: bundle.name,
        description: bundle.description,
        parent_bundle_id: bundle.parent_bundle_id,
        bundle_price: bundle.bundle_price,
        default_discount_percent: bundle.default_discount_percent,
      },
      items: resolvedItems,
      totals: {
        itemCount: resolvedItems.length,
        totalRetailValue: resolvedItems.reduce((sum, i) => sum + (i.role_retail_price ?? i.price ?? 0), 0),
        totalPerceivedValue: resolvedItems.reduce((sum, i) => sum + (i.perceived_value ?? i.role_retail_price ?? i.price ?? 0), 0),
        overriddenCount: resolvedItems.filter(i => i.has_overrides).length,
      }
    });

  } catch (error) {
    console.error('Error in bundle resolve GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper: Resolve a single bundle item
async function resolveItem(item: BundleItem): Promise<ResolvedBundleItem | null> {
  const config = CONTENT_TABLE_MAP[item.content_type];
  if (!config) return null;

  // Fetch the content item
  const { data: content, error: contentError } = await supabaseAdmin
    .from(config.table)
    .select('*')
    .eq('id', item.content_id)
    .single();

  if (contentError || !content) {
    console.error(`Content not found: ${item.content_type}:${item.content_id}`);
    return null;
  }

  // Fetch the canonical offer role
  const { data: role } = await supabaseAdmin
    .from('content_offer_roles')
    .select('*')
    .eq('content_type', item.content_type)
    .eq('content_id', item.content_id)
    .single();

  // Build ContentWithRole object
  const contentWithRole = {
    content_type: item.content_type,
    content_id: item.content_id,
    title: content.title || content.name || 'Untitled',
    description: content.description,
    subtype: content.type || content.category || null,
    price: content.price,
    image_url: config.imageField ? content[config.imageField] : null,
    is_active: content.is_active ?? content.is_published ?? true,
    display_order: content.display_order ?? 0,
    created_at: content.created_at,
    // Role fields (canonical values)
    role_id: role?.id || null,
    offer_role: role?.offer_role || null,
    dream_outcome_description: role?.dream_outcome_description || null,
    likelihood_multiplier: role?.likelihood_multiplier || null,
    time_reduction: role?.time_reduction || null,
    effort_reduction: role?.effort_reduction || null,
    role_retail_price: role?.retail_price || null,
    offer_price: role?.offer_price || null,
    perceived_value: role?.perceived_value || null,
    bonus_name: role?.bonus_name || null,
    bonus_description: role?.bonus_description || null,
    qualifying_actions: role?.qualifying_actions || null,
    payout_type: role?.payout_type || null,
  };

  // Apply resolution with overrides
  return resolveBundleItem(item, contentWithRole);
}
