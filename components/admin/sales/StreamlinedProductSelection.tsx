'use client';

import { useState } from 'react';
import type { ProductWithRole } from '@/lib/sales-scripts';
import {
  OFFER_ROLE_LABELS,
  CONTENT_TYPE_ICONS,
  CONTENT_TYPE_LABELS,
  type OfferRole,
  type ContentWithRole,
  type ContentType,
} from '@/lib/sales-scripts';
import { formatCurrency } from '@/lib/pricing-model';
import { DollarSign, CreditCard, ExternalLink, Copy, Trash2, Plus, Check, Sparkles } from 'lucide-react';

export interface SuggestedProductItem {
  id: number;
  name: string;
  reason?: string;
  content?: ContentWithRole;
}

export interface StreamlinedProductSelectionProps {
  products: ProductWithRole[];
  totalPrice: number;
  totalValue: number;
  suggestedProducts: SuggestedProductItem[];
  allContent: ContentWithRole[];
  selectedContent: string[];
  onRemove: (contentType: string, contentId: string) => void;
  onToggleContent: (contentType: string, contentId: string) => void;
  onConvertToProposal: () => void;
  onOpenProductsTab: () => void;
  currentProposal?: {
    status: string;
    proposalLink: string;
  } | null;
}

export function StreamlinedProductSelection({
  products,
  totalPrice,
  totalValue,
  suggestedProducts,
  allContent,
  selectedContent,
  onRemove,
  onToggleContent,
  onConvertToProposal,
  onOpenProductsTab,
  currentProposal,
}: StreamlinedProductSelectionProps) {
  const [viewMode, setViewMode] = useState<'suggested' | 'all'>('suggested');
  const savings = totalValue - totalPrice;
  const savingsPercent = totalValue > 0 ? Math.round((savings / totalValue) * 100) : 0;

  const isSelected = (contentType: string, contentId: string) =>
    selectedContent.includes(`${contentType}:${contentId}`);

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 flex flex-col min-h-0 h-full max-h-[60vh] flex-1">
      <div className="p-3 border-b border-gray-800 shrink-0 space-y-3">
        <div className="flex rounded-lg bg-gray-800 border border-gray-700 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('suggested')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'suggested'
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Suggested
          </button>
          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'all'
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            All
          </button>
        </div>
        <p className="text-xs text-gray-500">
          {products.length} selected — {viewMode === 'suggested' ? 'add from AI suggestions below' : 'add or remove from full list'}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {viewMode === 'suggested' ? (
          suggestedProducts.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">
              No AI suggestions yet. Record a response in the Script Guide to get product recommendations.
            </p>
          ) : (
            suggestedProducts.map((item) => {
              const contentType = item.content?.content_type ?? 'product';
              const contentId = item.content ? item.content.content_id : String(item.id);
              const key = `${contentType}:${contentId}`;
              const inSelection = isSelected(contentType, contentId);
              const canAdd = !!item.content;
              return (
                <div
                  key={key}
                  className="flex items-center gap-2 py-2 px-2 rounded-lg bg-gray-800/50 border border-gray-700"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">{item.name}</p>
                    {item.reason && (
                      <p className="text-xs text-gray-500 truncate mt-0.5" title={item.reason}>
                        {item.reason}
                      </p>
                    )}
                    {item.content && (
                      <span className="text-xs text-gray-500 mt-0.5 inline-block">
                        {item.content.role_retail_price != null || item.content.price
                          ? formatCurrency(item.content.role_retail_price ?? item.content.price ?? 0)
                          : null}
                      </span>
                    )}
                  </div>
                  {canAdd ? (
                    <button
                      type="button"
                      onClick={() => onToggleContent(contentType, contentId)}
                      className={`shrink-0 flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                        inSelection
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {inSelection ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      {inSelection ? 'Added' : 'Add'}
                    </button>
                  ) : (
                    <span className="text-xs text-gray-500 shrink-0">Not in catalog</span>
                  )}
                </div>
              );
            })
          )
        ) : (
          allContent.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">No products in catalog.</p>
          ) : (
            allContent.map((c) => {
              const key = `${c.content_type}:${c.content_id}`;
              const inSelection = isSelected(c.content_type, c.content_id);
              const roleLabel = c.offer_role ? OFFER_ROLE_LABELS[c.offer_role as OfferRole] : null;
              const price = c.role_retail_price ?? c.price ?? 0;
              return (
                <div
                  key={key}
                  className="flex items-center gap-2 py-2 px-2 rounded-lg bg-gray-800/50 border border-gray-700 group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">{c.title}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="text-lg">{CONTENT_TYPE_ICONS[c.content_type as ContentType]}</span>
                      {roleLabel && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">
                          {roleLabel}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {price === 0 ? 'Free' : formatCurrency(price)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleContent(c.content_type, c.content_id)}
                    className={`shrink-0 p-1.5 rounded transition-colors ${
                      inSelection
                        ? 'bg-emerald-600 text-white'
                        : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
                    }`}
                    title={inSelection ? 'Remove from offer' : 'Add to offer'}
                  >
                    {inSelection ? <Trash2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </button>
                </div>
              );
            })
          )
        )}
      </div>

      <div className="p-3 border-t border-gray-800 shrink-0 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Offer total</span>
          <span className="font-medium text-white">{formatCurrency(totalPrice)}</span>
        </div>
        {totalValue > totalPrice && (
          <div className="text-xs text-gray-500">
            Value {formatCurrency(totalValue)}
            {savingsPercent > 0 && ` (${savingsPercent}% off)`}
          </div>
        )}

        {currentProposal ? (
          <div className="bg-gray-800/50 rounded-lg p-2 border border-gray-700">
            <span
              className={`inline-block px-2 py-0.5 text-xs rounded mb-2 ${
                currentProposal.status === 'paid'
                  ? 'bg-green-900/50 text-green-300'
                  : currentProposal.status === 'accepted'
                    ? 'bg-blue-900/50 text-blue-300'
                    : 'bg-gray-700 text-gray-300'
              }`}
            >
              {currentProposal.status}
            </span>
            <div className="flex items-center gap-1 mt-1">
              <input
                type="text"
                value={currentProposal.proposalLink}
                readOnly
                className="flex-1 min-w-0 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-gray-300"
              />
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(currentProposal.proposalLink)}
                className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded"
                title="Copy link"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <a
                href={currentProposal.proposalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 bg-blue-600 hover:bg-blue-700 rounded"
                title="Open proposal"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <button
              type="button"
              onClick={onOpenProductsTab}
              className="mt-2 w-full text-xs text-blue-400 hover:text-blue-300"
            >
              View documents &amp; email in Products tab
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onConvertToProposal}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium text-white"
          >
            <CreditCard className="w-4 h-4" />
            Convert to Proposal
          </button>
        )}

        <button
          type="button"
          onClick={onOpenProductsTab}
          className="w-full text-xs text-gray-400 hover:text-gray-300"
        >
          Edit in Products tab
        </button>
      </div>
    </div>
  );
}
