'use client';

import { TIER_OPTIONS, PRICING_SEGMENT_OPTIONS } from '@/lib/constants/bundle-tiers';
import type { OfferBundleWithStats } from '@/lib/sales-scripts';
import { CONTENT_TYPE_ICONS } from '@/lib/sales-scripts';
import {
  Package,
  GitFork,
  Layers,
  Heart,
  Shield,
  DollarSign,
  ChevronRight,
  Eye,
  Copy,
  Trash2,
} from 'lucide-react';

export interface BundleCardProps {
  bundle: OfferBundleWithStats;
  onView: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function formatPrice(n: number): string {
  return Math.round(n).toLocaleString();
}

export function BundleCard({ bundle, onView, onEdit, onDuplicate, onDelete }: BundleCardProps) {
  const previewItems = bundle.preview_items || [];
  const hasMoreItems = bundle.item_count > previewItems.length;
  const cardClassName =
    'bg-gray-900 rounded-lg border ' +
    (bundle.is_active ? 'border-gray-800' : 'border-gray-700 opacity-60') +
    ' p-4 hover:border-gray-700 transition-colors';

  return (
    <div className={cardClassName}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-white">{bundle.name}</h3>
          {bundle.parent_name && (
            <p className="text-xs text-purple-400 flex items-center gap-1 mt-1">
              <GitFork className="w-3 h-3" />
              Forked from {bundle.parent_name}
            </p>
          )}
          {bundle.base_bundle_name && (
            <p className="text-xs text-blue-400 flex items-center gap-1 mt-1">
              <Layers className="w-3 h-3" />
              Builds on: {bundle.base_bundle_name}
            </p>
          )}
          {bundle.bundle_type !== 'custom' && (
            <>
              <p className="text-xs text-gray-500 mt-1">
                Tier: {bundle.pricing_tier_slug
                  ? (TIER_OPTIONS.find((t) => t.value === bundle.pricing_tier_slug)?.label ?? bundle.pricing_tier_slug)
                  : '—'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Pricing segments: {(() => {
                  const segs = bundle.pricing_page_segments;
                  if (!Array.isArray(segs) || segs.length === 0) return 'Not on pricing page';
                  return segs
                    .map((seg) => PRICING_SEGMENT_OPTIONS.find((o) => o.value === seg)?.label ?? seg)
                    .join(', ');
                })()}
              </p>
            </>
          )}
          {bundle.is_decoy && (
            <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
              <Heart className="w-3 h-3" />
              Community Impact{bundle.mirrors_tier_id ? ` · mirrors ${bundle.mirrors_tier_id}` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {bundle.has_guarantee && (
            <div className="px-2 py-1 text-xs font-medium rounded bg-gray-700/50 text-gray-300" title={bundle.guarantee_name ?? 'Has guarantee'}>
              <Shield className="w-3 h-3" />
            </div>
          )}
          <div className={`px-2 py-1 text-xs font-medium rounded ${
            bundle.bundle_type === 'standard'
              ? 'bg-green-900/50 text-green-300'
              : bundle.bundle_type === 'decoy'
              ? 'bg-emerald-900/50 text-emerald-300'
              : 'bg-purple-900/50 text-purple-300'
          }`}>
            {bundle.bundle_type}
          </div>
        </div>
      </div>

      {bundle.description && (
        <p className="text-sm text-gray-400 mb-3 line-clamp-2">{bundle.description}</p>
      )}

      <div className="mb-3">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
          <Package className="w-3 h-3" />
          <span>Contents ({bundle.item_count} items)</span>
        </div>
        {previewItems.length > 0 ? (
          <div className="space-y-1">
            {previewItems.map((item) => (
              <div
                key={`${item.content_type}:${item.content_id}`}
                className="flex items-center gap-2 text-sm text-gray-300"
              >
                <span className="text-base">{CONTENT_TYPE_ICONS[item.content_type]}</span>
                <span className="truncate">{item.title}</span>
              </div>
            ))}
            {hasMoreItems && (
              <button
                onClick={onView}
                className="text-xs text-blue-400 hover:text-blue-300 mt-1 flex items-center gap-1"
              >
                <ChevronRight className="w-3 h-3" />
                +{bundle.item_count - previewItems.length} more...
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic">No items added yet</p>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm mb-4">
        <span className="flex items-center gap-1 text-green-400">
          <DollarSign className="w-4 h-4" />
          {formatPrice(bundle.bundle_price ?? bundle.total_retail_value ?? 0)}
        </span>
        {bundle.total_perceived_value != null && bundle.total_perceived_value > (bundle.bundle_price ?? bundle.total_retail_value ?? 0) && (
          <span className="text-gray-500 line-through text-xs">
            ${formatPrice(bundle.total_perceived_value)} value
          </span>
        )}
        {bundle.fork_count > 0 && (
          <span className="flex items-center gap-1 text-gray-400 ml-auto">
            <GitFork className="w-4 h-4" />
            {bundle.fork_count} forks
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-gray-800 pt-3">
        <button
          onClick={onView}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
        >
          <Eye className="w-4 h-4" />
          View
        </button>
        <button
          onClick={onDuplicate}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          title="Duplicate"
        >
          <Copy className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
