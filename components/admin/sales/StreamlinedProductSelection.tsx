'use client';

import { useState, type ReactNode } from 'react';
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
import {
  CreditCard,
  ExternalLink,
  Copy,
  Trash2,
  Plus,
  Check,
  Sparkles,
  Search,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

export interface SuggestedProductItem {
  id: number;
  name: string;
  reason?: string;
  content?: ContentWithRole;
}

export interface AllCatalogRenderContext {
  searchLower: string;
}

export interface StreamlinedProductSelectionProps {
  products: ProductWithRole[];
  totalPrice: number;
  totalValue: number;
  suggestedProducts: SuggestedProductItem[];
  allContent: ContentWithRole[];
  selectedContent: string[];
  /** @deprecated Toggle uses onToggleContent; kept for call-site compatibility */
  onRemove?: (contentType: string, contentId: string) => void;
  onToggleContent: (contentType: string, contentId: string) => void;
  onConvertToProposal: () => void;
  /**
   * When set, replaces the flat “All” grid. Use for bundles + catalog-by-role.
   * Receives the current search string (trimmed, lowercased) so you can filter.
   */
  allCatalogContent?: (ctx: AllCatalogRenderContext) => ReactNode;
  /** Offer stack, evidence pricing, save bundle — shown only when the offer panel is expanded */
  offerFooterDetails?: ReactNode;
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
  onToggleContent,
  onConvertToProposal,
  allCatalogContent,
  offerFooterDetails,
  currentProposal,
}: StreamlinedProductSelectionProps) {
  const [viewMode, setViewMode] = useState<'suggested' | 'all'>('suggested');
  const [searchQuery, setSearchQuery] = useState('');
  const [offerPanelOpen, setOfferPanelOpen] = useState(false);
  const savings = totalValue - totalPrice;
  const savingsPercent = totalValue > 0 ? Math.round((savings / totalValue) * 100) : 0;

  const isSelected = (contentType: string, contentId: string) =>
    selectedContent.includes(`${contentType}:${contentId}`);

  const searchLower = searchQuery.trim().toLowerCase();
  const filteredContent = searchLower
    ? allContent.filter(
        (c) =>
          c.title?.toLowerCase().includes(searchLower) ||
          (c.description ?? '').toLowerCase().includes(searchLower)
      )
    : allContent;
  const categoryOrder: ContentType[] = [
    'product',
    'service',
    'lead_magnet',
    'project',
    'video',
    'publication',
    'music',
    'prototype',
  ];
  const contentByCategory = categoryOrder.reduce<Partial<Record<ContentType, ContentWithRole[]>>>(
    (acc, type) => {
      const items = filteredContent.filter((c) => c.content_type === type);
      if (items.length > 0) acc[type] = items;
      return acc;
    },
    {}
  );
  const hasFilteredResults = Object.keys(contentByCategory).length > 0;

  const useCustomAllCatalog = typeof allCatalogContent === 'function';

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 flex flex-col min-h-0 h-full max-h-[min(75vh,720px)] xl:max-h-[calc(100vh-10rem)] min-w-0 w-full sm:min-w-[300px] sm:max-w-[480px] flex-1">
      <div className="p-3 sm:p-4 border-b border-gray-800 shrink-0 space-y-3">
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
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Suggested</span>
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
            <span className="truncate">All</span>
          </button>
        </div>
        {viewMode === 'all' && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 shrink-0" aria-hidden />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products and content…"
              className="w-full pl-8 pr-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              aria-label="Search products and content"
            />
          </div>
        )}
        <p className="text-xs text-gray-500">
          {products.length} selected — {viewMode === 'suggested' ? 'add from AI suggestions below' : 'browse bundles and catalog below'}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-4">
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
                  className="flex items-center gap-2 py-2 px-2 rounded-lg bg-gray-800/50 border border-gray-700 min-w-0"
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
        ) : useCustomAllCatalog ? (
          <div className="space-y-4">{allCatalogContent!({ searchLower })}</div>
        ) : allContent.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">No products in catalog.</p>
        ) : !hasFilteredResults ? (
          <p className="text-sm text-gray-500 py-4">
            {searchQuery.trim() ? 'No items match your search.' : 'No products in catalog.'}
          </p>
        ) : (
          <div className="space-y-5">
            {(Object.entries(contentByCategory) as [ContentType, ContentWithRole[]][]).map(
              ([contentType, items]) => (
                <section key={contentType} className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider sticky top-0 py-1 bg-gray-900/95 backdrop-blur z-10">
                    {CONTENT_TYPE_LABELS[contentType]} ({items.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {items.map((c) => {
                      const key = `${c.content_type}:${c.content_id}`;
                      const inSelection = isSelected(c.content_type, c.content_id);
                      const roleLabel = c.offer_role ? OFFER_ROLE_LABELS[c.offer_role as OfferRole] : null;
                      const price = c.role_retail_price ?? c.price ?? 0;
                      return (
                        <div
                          key={key}
                          className="flex items-center gap-2 py-2 px-2 rounded-lg bg-gray-800/50 border border-gray-700 group min-w-0"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-200 truncate" title={c.title}>
                              {c.title}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                              <span className="text-base shrink-0" title={CONTENT_TYPE_LABELS[contentType]}>
                                {CONTENT_TYPE_ICONS[c.content_type as ContentType]}
                              </span>
                              {roleLabel && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 shrink-0">
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
                            className={`shrink-0 p-1.5 rounded transition-colors touch-manipulation ${
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
                    })}
                  </div>
                </section>
              )
            )}
          </div>
        )}
      </div>

      <div className="border-t border-gray-800 shrink-0 bg-gray-900/95">
        <button
          type="button"
          onClick={() => setOfferPanelOpen((o) => !o)}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-800/60 transition-colors border-b border-gray-800/80"
          aria-expanded={offerPanelOpen}
        >
          <span className="text-gray-500 shrink-0" aria-hidden>
            {offerPanelOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
          <span className="text-xs font-medium text-gray-400 shrink-0">Offer</span>
          <span className="text-sm font-semibold text-white tabular-nums">{formatCurrency(totalPrice)}</span>
          {totalValue > 0 && (
            <span className="text-xs text-gray-500 truncate">
              · Value {formatCurrency(totalValue)}
              {savingsPercent > 0 && totalValue > totalPrice && ` (${savingsPercent}% off)`}
            </span>
          )}
          <span className="text-xs text-gray-500 ml-auto shrink-0">{products.length} items</span>
        </button>

        {offerPanelOpen && offerFooterDetails ? (
          <div className="max-h-[min(45vh,380px)] overflow-y-auto px-3 py-3 border-b border-gray-800 space-y-3">
            {offerFooterDetails}
          </div>
        ) : null}

        <div className="p-3 space-y-2">
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
                onClick={onConvertToProposal}
                className="mt-2 w-full text-xs text-blue-400 hover:text-blue-300"
              >
                Open proposal panel — documents &amp; email
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onConvertToProposal}
              disabled={products.length === 0}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-white transition-colors ${
                products.length === 0
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Proposal &amp; documents…
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
