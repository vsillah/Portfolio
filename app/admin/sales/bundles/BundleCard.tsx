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
    'admin-console-card rounded-lg border ' +
    (bundle.is_active ? '' : 'opacity-60') +
    ' p-4 transition-colors admin-console-interactive';

  return (
    <div className={cardClassName}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-foreground">{bundle.name}</h3>
          {bundle.parent_name && (
            <p className="text-xs text-radiant-gold flex items-center gap-1 mt-1">
              <GitFork className="w-3 h-3" />
              Forked from {bundle.parent_name}
            </p>
          )}
          {bundle.base_bundle_name && (
            <p className="text-xs text-sky-200 flex items-center gap-1 mt-1">
              <Layers className="w-3 h-3" />
              Builds on: {bundle.base_bundle_name}
            </p>
          )}
          {bundle.bundle_type !== 'custom' && (
            <>
              <p className="text-xs text-muted-foreground mt-1">
                Tier: {bundle.pricing_tier_slug
                  ? (TIER_OPTIONS.find((t) => t.value === bundle.pricing_tier_slug)?.label ?? bundle.pricing_tier_slug)
                  : '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
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
            <p className="text-xs text-emerald-200 flex items-center gap-1 mt-1">
              <Heart className="w-3 h-3" />
              Community Impact{bundle.mirrors_tier_id ? ` · mirrors ${bundle.mirrors_tier_id}` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {bundle.has_guarantee && (
            <div className="px-2 py-1 text-xs font-medium rounded border border-white/10 bg-white/5 text-muted-foreground" title={bundle.guarantee_name ?? 'Has guarantee'}>
              <Shield className="w-3 h-3" />
            </div>
          )}
          <div className={`px-2 py-1 text-xs font-medium rounded ${
            bundle.bundle_type === 'standard'
              ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/30'
              : bundle.bundle_type === 'decoy'
              ? 'bg-radiant-gold/10 text-radiant-gold border border-radiant-gold/35'
              : 'bg-sky-500/10 text-sky-200 border border-sky-500/30'
          }`}>
            {bundle.bundle_type}
          </div>
        </div>
      </div>

      {bundle.description && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{bundle.description}</p>
      )}

      <div className="mb-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Package className="w-3 h-3" />
          <span>Contents ({bundle.item_count} items)</span>
        </div>
        {previewItems.length > 0 ? (
          <div className="space-y-1">
            {previewItems.map((item) => (
              <div
                key={`${item.content_type}:${item.content_id}`}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <span className="text-base">{CONTENT_TYPE_ICONS[item.content_type]}</span>
                <span className="truncate">{item.title}</span>
              </div>
            ))}
            {hasMoreItems && (
              <button
                onClick={onView}
                className="text-xs text-radiant-gold hover:text-gold-light mt-1 flex items-center gap-1"
              >
                <ChevronRight className="w-3 h-3" />
                +{bundle.item_count - previewItems.length} more...
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">No items added yet</p>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm mb-4">
        <span className="flex items-center gap-1 text-emerald-200">
          <DollarSign className="w-4 h-4" />
          {formatPrice(bundle.bundle_price ?? bundle.total_retail_value ?? 0)}
        </span>
        {bundle.total_perceived_value != null && bundle.total_perceived_value > (bundle.bundle_price ?? bundle.total_retail_value ?? 0) && (
          <span className="text-muted-foreground line-through text-xs">
            ${formatPrice(bundle.total_perceived_value)} value
          </span>
        )}
        {bundle.fork_count > 0 && (
          <span className="flex items-center gap-1 text-muted-foreground ml-auto">
            <GitFork className="w-4 h-4" />
            {bundle.fork_count} forks
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-white/10 pt-3">
        <button
          onClick={onView}
          className="admin-console-button-muted flex-1"
        >
          <Eye className="w-4 h-4" />
          View
        </button>
        <button
          onClick={onDuplicate}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          title="Duplicate"
          aria-label={`Duplicate ${bundle.name}`}
        >
          <Copy className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-300"
          title="Delete"
          aria-label={`Delete ${bundle.name}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
