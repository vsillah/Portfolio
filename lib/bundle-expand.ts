/**
 * Bundle expansion: merge base bundle items + delta items.
 * When a bundle has base_bundle_id, it "includes" the base bundle; bundle_items are add-ons only.
 */

import { supabaseAdmin } from '@/lib/supabase';
import type { BundleItem } from '@/lib/sales-scripts';

interface DbBundleRow {
  id: string;
  base_bundle_id: string | null;
  bundle_items: BundleItem[] | null;
}

/**
 * Recursively expand a bundle's items: base items first, then this bundle's delta items.
 * Prevents cycles by tracking visited ids.
 */
export async function expandBundleItems(
  bundleId: string,
  visited: Set<string> = new Set()
): Promise<BundleItem[]> {
  if (visited.has(bundleId)) return [];
  visited.add(bundleId);

  const { data: bundle, error } = await supabaseAdmin
    .from('offer_bundles')
    .select('id, base_bundle_id, bundle_items')
    .eq('id', bundleId)
    .single();

  if (error || !bundle) return [];

  const row = bundle as DbBundleRow;
  const deltaItems = (row.bundle_items || []) as BundleItem[];

  if (!row.base_bundle_id) {
    return deltaItems;
  }

  const baseItems = await expandBundleItems(row.base_bundle_id, visited);
  const baseCount = baseItems.length;

  // Assign display_order: base 0..n-1, delta n..m-1
  const normalizedBase = baseItems.map((item, i) => ({
    ...item,
    display_order: item.display_order ?? i,
  }));
  const normalizedDelta = deltaItems.map((item, i) => ({
    ...item,
    display_order: (item.display_order ?? i) + baseCount,
  }));

  const sorted = [...normalizedBase, ...normalizedDelta].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
  );

  // Deduplicate by (content_type, content_id), keeping first occurrence to preserve order and fix React duplicate-key warnings
  const seen = new Set<string>();
  return sorted
    .filter((item) => {
      const key = `${item.content_type}:${item.content_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item, i) => ({ ...item, display_order: i }));
}
