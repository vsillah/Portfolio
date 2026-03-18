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

export interface BundleRowForKeys {
  id: string;
  base_bundle_id: string | null;
  bundle_items: BundleItem[] | null;
}

function expandedKeysForBundle(
  bundleId: string,
  bundleById: Map<string, { base_bundle_id: string | null; bundle_items: BundleItem[] }>,
  visited: Set<string>
): Set<string> {
  if (visited.has(bundleId)) return new Set();
  visited.add(bundleId);
  const row = bundleById.get(bundleId);
  if (!row) return new Set();
  const deltaKeys = (row.bundle_items || []).map((i) => `${i.content_type}:${i.content_id}`);
  if (!row.base_bundle_id) return new Set(deltaKeys);
  const baseKeys = expandedKeysForBundle(row.base_bundle_id, bundleById, visited);
  const merged = new Set(baseKeys);
  for (const k of deltaKeys) merged.add(k);
  return merged;
}

/**
 * Returns the set of all content keys (content_type:content_id) that appear in any bundle,
 * with base bundles expanded. Uses only the provided rows; no DB calls.
 */
export function getAllExpandedBundleContentKeys(rows: BundleRowForKeys[]): Set<string> {
  const bundleById = new Map(
    rows.map((r) => [
      r.id,
      {
        base_bundle_id: r.base_bundle_id ?? null,
        bundle_items: (r.bundle_items || []) as BundleItem[],
      },
    ])
  );
  const out = new Set<string>();
  for (const r of rows) {
    expandedKeysForBundle(r.id, bundleById, new Set()).forEach((k) => out.add(k));
  }
  return out;
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
