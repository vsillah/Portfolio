/**
 * Bundle resolution for public pricing API.
 * Resolves bundle items to TierItem shape, handling missing content gracefully.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { type BundleItem, type ContentType } from '@/lib/sales-scripts';
import type { TierItem, TierItemOutcomeGroup } from '@/lib/pricing-model';

const CONTENT_TABLE_MAP: Record<
  ContentType,
  { table: string; imageField: string | null }
> = {
  product: { table: 'products', imageField: 'image_url' },
  project: { table: 'projects', imageField: 'image' },
  video: { table: 'videos', imageField: 'thumbnail_url' },
  publication: { table: 'publications', imageField: null },
  music: { table: 'music', imageField: null },
  lead_magnet: { table: 'lead_magnets', imageField: null },
  prototype: { table: 'app_prototypes', imageField: 'thumbnail_url' },
  service: { table: 'services', imageField: 'image_url' },
};

/** Humanize slug to title, e.g. ci-workshop-recorded -> CI Workshop Recorded */
function humanizeSlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Map offer role to TierItem offerRole type */
function mapOfferRole(
  role: string | null | undefined
): TierItem['offerRole'] {
  const valid: TierItem['offerRole'][] = [
    'core_offer',
    'bonus',
    'lead_magnet',
    'upsell',
    'continuity',
  ];
  return valid.includes(role as TierItem['offerRole'])
    ? (role as TierItem['offerRole'])
    : 'bonus';
}

/**
 * Resolve a bundle item - fetches content when possible, falls back to overrides.
 */
export async function resolveBundleItemForPricing(
  item: BundleItem
): Promise<TierItem | null> {
  const config = CONTENT_TABLE_MAP[item.content_type as ContentType];
  if (!config) return null;

  // Fetch content: services use UUID, products use numeric id — both need lookup
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(item.content_id)
  );
  const isNumericId = /^\d+$/.test(String(item.content_id));
  const shouldFetch = isUuid || (item.content_type === 'product' && isNumericId);

  let resolvedContent: Record<string, unknown> | null = null;
  if (shouldFetch) {
    const id = item.content_type === 'product' && isNumericId
      ? parseInt(String(item.content_id), 10)
      : item.content_id;
    const hasOutcomeGroup = ['products', 'services', 'lead_magnets'].includes(config.table);
    const selectFields = hasOutcomeGroup
      ? 'id, title, price, description, outcome_groups(id, label, display_order)'
      : 'id, title, price, description';
    const { data } = await supabaseAdmin
      .from(config.table)
      .select(selectFields)
      .eq('id', id)
      .maybeSingle();
    resolvedContent = data as Record<string, unknown> | null;
  }

  const perceivedValue =
    item.override_perceived_value ??
    item.override_price ??
    (resolvedContent?.perceived_value as number | undefined) ??
    (resolvedContent?.price as number | undefined) ??
    0;

  const title =
    item.override_title ??
    (resolvedContent?.title as string) ??
    (resolvedContent?.name as string) ??
    item.override_dream_outcome ??
    humanizeSlug(item.content_id);

  const description =
    item.override_description ??
    (resolvedContent?.description as string) ??
    item.override_dream_outcome ??
    '';

  const offerRole = mapOfferRole(item.override_role);

  let outcomeGroup: TierItemOutcomeGroup | null = null;
  if (resolvedContent?.outcome_groups && typeof resolvedContent.outcome_groups === 'object') {
    const og = resolvedContent.outcome_groups as { id?: string; label?: string; display_order?: number };
    if (og?.id && og?.label) outcomeGroup = { id: og.id, label: og.label, display_order: og.display_order };
  }

  return {
    title,
    perceivedValue: Number(perceivedValue),
    offerRole,
    description,
    isDeployed: false, // Could be derived from service type if needed
    outcomeGroup: outcomeGroup ?? undefined,
  };
}

/**
 * Resolve all bundle items to TierItem array, preserving display_order.
 */
export async function resolveBundleItemsToTierItems(
  bundleItems: BundleItem[]
): Promise<TierItem[]> {
  const withOrder: { item: TierItem; order: number }[] = [];
  for (let i = 0; i < bundleItems.length; i++) {
    const bi = bundleItems[i];
    const tierItem = await resolveBundleItemForPricing(bi);
    if (tierItem) {
      withOrder.push({
        item: tierItem,
        order: bi.display_order ?? i,
      });
    }
  }
  withOrder.sort((a, b) => a.order - b.order);
  return withOrder.map((w) => w.item);
}
