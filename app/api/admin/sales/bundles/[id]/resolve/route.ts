// API Route: Resolve Bundle Items
// Returns fully resolved bundle items with overrides merged with canonical values

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import { expandBundleItems } from '@/lib/bundle-expand';
import { 
  BundleItem, 
  ResolvedBundleItem, 
  ContentType,
  ContentWithRole,
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

    const bundleItems: BundleItem[] = await expandBundleItems(id);

    // Batch-fetch all content and roles by content_type to avoid N+1 (was 48 sequential queries for 24 items)
    const { contentByKey, rolesByKey } = await batchFetchContentAndRoles(bundleItems);

    const resolvedItems: ResolvedBundleItem[] = [];
    for (const item of bundleItems) {
      const key = `${item.content_type}:${item.content_id}`;
      const content = contentByKey.get(key);
      const role = rolesByKey.get(key);
      if (!content) {
        console.error(`Content not found: ${key}`);
        continue;
      }
      const config = CONTENT_TABLE_MAP[item.content_type];
      if (!config) continue;
      const subtype = item.content_type === 'service'
        ? (content.service_type ?? null)
        : (content.type || content.category || null);
      const contentWithRole: ContentWithRole = {
        content_type: item.content_type,
        content_id: item.content_id,
        title: String(content.title ?? content.name ?? 'Untitled'),
        description: content.description != null ? String(content.description) : null,
        subtype: subtype != null ? String(subtype) : null,
        price: typeof content.price === 'number' ? content.price : null,
        image_url: config.imageField && content[config.imageField] != null ? String(content[config.imageField]) : null,
        ...(item.content_type === 'service' && {
          video_url: content.video_url != null ? String(content.video_url) : null,
          video_thumbnail_url: content.video_thumbnail_url != null ? String(content.video_thumbnail_url) : null,
        }),
        is_active: Boolean(content.is_active ?? content.is_published ?? true),
        display_order: Number(content.display_order ?? 0),
        created_at: String(content.created_at ?? ''),
        role_id: role?.id != null ? String(role.id) : null,
        offer_role: (role?.offer_role as ContentWithRole['offer_role']) ?? null,
        dream_outcome_description: role?.dream_outcome_description != null ? String(role.dream_outcome_description) : null,
        likelihood_multiplier: typeof role?.likelihood_multiplier === 'number' ? role.likelihood_multiplier : null,
        time_reduction: typeof role?.time_reduction === 'number' ? role.time_reduction : null,
        effort_reduction: typeof role?.effort_reduction === 'number' ? role.effort_reduction : null,
        role_retail_price: typeof role?.retail_price === 'number' ? role.retail_price : null,
        offer_price: typeof role?.offer_price === 'number' ? role.offer_price : null,
        perceived_value: typeof role?.perceived_value === 'number' ? role.perceived_value : null,
        bonus_name: role?.bonus_name != null ? String(role.bonus_name) : null,
        bonus_description: role?.bonus_description != null ? String(role.bonus_description) : null,
        qualifying_actions: role?.qualifying_actions != null && typeof role.qualifying_actions === 'object' ? (role.qualifying_actions as Record<string, unknown>) : null,
        payout_type: (role?.payout_type as ContentWithRole['payout_type']) ?? null,
      };
      resolvedItems.push(resolveBundleItem(item, contentWithRole));
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

// Batch-fetch all content and offer roles for bundle items (by content_type) to avoid N+1 queries.
async function batchFetchContentAndRoles(
  bundleItems: BundleItem[]
): Promise<{
  contentByKey: Map<string, Record<string, unknown>>;
  rolesByKey: Map<string, Record<string, unknown> | null>;
}> {
  const contentByKey = new Map<string, Record<string, unknown>>();
  const rolesByKey = new Map<string, Record<string, unknown> | null>();

  // Group (content_type, content_id) by content_type for batched queries
  const byType = new Map<ContentType, Set<string>>();
  for (const item of bundleItems) {
    const config = CONTENT_TABLE_MAP[item.content_type];
    if (!config) continue;
    if (!byType.has(item.content_type)) byType.set(item.content_type, new Set());
    byType.get(item.content_type)!.add(item.content_id);
  }

  // One query per content_type for content table + one for roles
  const contentTypes = Array.from(byType.keys());
  const contentPromises = contentTypes.map(async (contentType) => {
    const config = CONTENT_TABLE_MAP[contentType];
    if (!config) return { contentType, rows: [] };
    const ids = Array.from(byType.get(contentType)!);
    const { data: rows, error } = await supabaseAdmin
      .from(config.table)
      .select('*')
      .in('id', ids);
    if (error) {
      console.error(`batchFetchContent ${config.table}:`, error);
      return { contentType, rows: [] };
    }
    return { contentType, rows: (rows ?? []) as Record<string, unknown>[] };
  });
  const rolePromises = contentTypes.map(async (contentType) => {
    const ids = Array.from(byType.get(contentType)!);
    const { data: rows, error } = await supabaseAdmin
      .from('content_offer_roles')
      .select('*')
      .eq('content_type', contentType)
      .in('content_id', ids);
    if (error) {
      console.error('batchFetchRoles content_offer_roles:', error);
      return { contentType, rows: [] };
    }
    return { contentType, rows: (rows ?? []) as Record<string, unknown>[] };
  });

  const [contentResults, roleResults] = await Promise.all([
    Promise.all(contentPromises),
    Promise.all(rolePromises),
  ]);

  for (const { contentType, rows } of contentResults) {
    const config = CONTENT_TABLE_MAP[contentType];
    if (!config) continue;
    for (const row of rows) {
      const id = row.id as string;
      contentByKey.set(`${contentType}:${id}`, row);
    }
  }
  for (const { contentType, rows } of roleResults) {
    for (const row of rows) {
      const contentId = row.content_id as string;
      rolesByKey.set(`${contentType}:${contentId}`, row);
    }
  }
  // Ensure every bundle item has a rolesByKey entry (null if no role)
  for (const item of bundleItems) {
    const key = `${item.content_type}:${item.content_id}`;
    if (!rolesByKey.has(key)) rolesByKey.set(key, null);
  }

  return { contentByKey, rolesByKey };
}
