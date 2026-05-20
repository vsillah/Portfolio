'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getCurrentSession } from '@/lib/auth';
import {
  ContentWithRole,
  ContentType,
  OfferRole,
  OFFER_ROLE_LABELS,
  OFFER_ROLE_COLORS,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_ICONS,
  buildGrandSlamOffer,
  ProductWithRole,
} from '@/lib/sales-scripts';
import { ContentClassifier, ContentOfferRoleInput } from '@/components/admin/sales/ProductClassifier';
import { OfferStack } from '@/components/admin/sales/OfferCard';
import Breadcrumbs from '@/components/admin/Breadcrumbs';
import {
  Package,
  Filter,
  Search,
  RefreshCw,
  Eye,
  AlertCircle,
  CheckCircle,
  Tag,
  Layers,
} from 'lucide-react';

const OFFER_ROLES: OfferRole[] = [
  'core_offer',
  'bonus',
  'upsell',
  'downsell',
  'continuity',
  'lead_magnet',
  'decoy',
  'anchor',
];

const CONTENT_TYPES: ContentType[] = [
  'product',
  'project',
  'video',
  'publication',
  'music',
  'lead_magnet',
  'prototype',
  'service',
];

export default function ProductClassificationPage() {
  const { user } = useAuth();
  const [content, setContent] = useState<ContentWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedContent, setExpandedContent] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<OfferRole | 'all' | 'unclassified'>('all');
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentType | 'all'>('all');
  const [showPreview, setShowPreview] = useState(false);

  const fetchContent = useCallback(async () => {
    const session = await getCurrentSession();
    if (!session?.access_token) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (roleFilter !== 'all' && roleFilter !== 'unclassified') {
        params.append('role', roleFilter);
      }
      if (contentTypeFilter !== 'all') {
        params.append('content_type', contentTypeFilter);
      }

      const response = await fetch(`/api/admin/sales/products?${params}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch content');

      const data = await response.json();
      setContent(data.content || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [roleFilter, contentTypeFilter]);

  // Fetch when user becomes available or filters change
  useEffect(() => {
    if (user) {
      fetchContent();
    }
  }, [user, fetchContent]);

  const handleSaveRole = async (data: ContentOfferRoleInput) => {
    const session = await getCurrentSession();
    const response = await fetch('/api/admin/sales/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save');
    }

    // Refresh the list
    await fetchContent();
    setExpandedContent(null);
  };

  const handleRemoveRole = async (contentType: ContentType, contentId: string) => {
    const session = await getCurrentSession();
    const response = await fetch(`/api/admin/sales/products?content_type=${contentType}&content_id=${contentId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove');
    }

    // Refresh the list
    await fetchContent();
  };

  // Filter content
  const filteredContent = content.filter(item => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!item.title.toLowerCase().includes(query) &&
          !item.description?.toLowerCase().includes(query)) {
        return false;
      }
    }

    // Role filter
    if (roleFilter === 'unclassified' && item.offer_role) {
      return false;
    }

    return true;
  });

  // Convert to ProductWithRole for Grand Slam Offer preview (only classified items)
  const classifiedAsProducts: ProductWithRole[] = content
    .filter(c => c.offer_role)
    .map(c => ({
      id: parseInt(c.content_id) || 0,
      title: c.title,
      description: c.description,
      type: c.content_type,
      price: c.price,
      file_path: null,
      image_url: c.image_url,
      is_active: c.is_active,
      is_featured: false,
      display_order: c.display_order,
      role_id: c.role_id,
      offer_role: c.offer_role,
      dream_outcome_description: c.dream_outcome_description,
      likelihood_multiplier: c.likelihood_multiplier,
      time_reduction: c.time_reduction,
      effort_reduction: c.effort_reduction,
      role_retail_price: c.role_retail_price,
      offer_price: c.offer_price,
      perceived_value: c.perceived_value,
      bonus_name: c.bonus_name,
      bonus_description: c.bonus_description,
      qualifying_actions: c.qualifying_actions,
      payout_type: c.payout_type,
    }));
  const grandSlamOffer = buildGrandSlamOffer(classifiedAsProducts);

  // Stats
  const stats = {
    total: content.length,
    classified: content.filter(c => c.offer_role).length,
    unclassified: content.filter(c => !c.offer_role).length,
    byRole: OFFER_ROLES.reduce((acc, role) => {
      acc[role] = content.filter(c => c.offer_role === role).length;
      return acc;
    }, {} as Record<OfferRole, number>),
    byContentType: CONTENT_TYPES.reduce((acc, type) => {
      acc[type] = content.filter(c => c.content_type === type).length;
      return acc;
    }, {} as Record<ContentType, number>),
  };

  return (
    <div className="admin-console-page min-h-screen p-6 text-foreground lg:p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Sales', href: '/admin/sales' },
            { label: 'Content Classification' },
          ]}
        />

        {/* Header */}
        <header className="admin-console-surface-header mb-6 mt-5 flex flex-wrap items-start justify-between gap-4 rounded-xl border p-5">
          <div>
            <div className="admin-console-eyebrow mb-2">
              <Layers className="h-4 w-4" />
              Sales Operations
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              Content Classification
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Assign offer roles, classify content types, and inspect the offer stack before sales calls.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`admin-console-button-secondary ${
                showPreview
                  ? 'bg-radiant-gold text-background hover:bg-radiant-gold/90'
                  : ''
              }`}
            >
              <Eye className="w-4 h-4" />
              Offer Preview
            </button>

            <button
              onClick={fetchContent}
              disabled={isLoading}
              className="admin-console-button-muted disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="admin-console-metric rounded-lg border p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Products</div>
            <div className="mt-2 text-2xl font-bold text-foreground">{stats.total}</div>
          </div>
          <div className="admin-console-metric rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-emerald-300" />
              Classified
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-200">{stats.classified}</div>
          </div>
          <div className="admin-console-metric rounded-lg border border-amber-500/35 bg-amber-500/10 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <AlertCircle className="w-4 h-4 text-radiant-gold" />
              Unclassified
            </div>
            <div className="mt-2 text-2xl font-bold text-radiant-gold">{stats.unclassified}</div>
          </div>
          <div className="admin-console-metric rounded-lg border border-sky-500/30 bg-sky-500/10 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Tag className="w-4 h-4 text-sky-300" />
              Core Offers
            </div>
            <div className="mt-2 text-2xl font-bold text-sky-100">{stats.byRole.core_offer}</div>
          </div>
        </div>

        <div className="flex flex-col gap-6 xl:flex-row">
          {/* Main content */}
          <div className={`min-w-0 flex-1 ${showPreview ? 'xl:max-w-3xl' : ''}`}>
            {/* Filters */}
            <div className="admin-console-card rounded-lg border p-4 mb-6">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-2.5 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-radiant-gold/70 focus:outline-none"
                  />
                </div>

                {/* Content type filter */}
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-muted-foreground" />
                  <select
                    value={contentTypeFilter}
                    onChange={(e) => setContentTypeFilter(e.target.value as ContentType | 'all')}
                    className="rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 px-3 py-2 text-sm text-foreground focus:border-radiant-gold/70 focus:outline-none"
                  >
                    <option value="all">All Content Types</option>
                    {CONTENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {CONTENT_TYPE_ICONS[type]} {CONTENT_TYPE_LABELS[type]} ({stats.byContentType[type] || 0})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Role filter */}
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-muted-foreground" />
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as OfferRole | 'all' | 'unclassified')}
                    className="rounded-lg border border-silicon-slate/70 bg-imperial-navy/70 px-3 py-2 text-sm text-foreground focus:border-radiant-gold/70 focus:outline-none"
                  >
                    <option value="all">All Products</option>
                    <option value="unclassified">Unclassified Only</option>
                    <optgroup label="By Role">
                      {OFFER_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {OFFER_ROLE_LABELS[role]} ({stats.byRole[role]})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-300 mb-6">
                {error}
              </div>
            )}

            {/* Content list */}
            {isLoading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin mx-auto mb-3" />
                <p className="text-muted-foreground">Loading content...</p>
              </div>
            ) : filteredContent.length === 0 ? (
              <div className="admin-console-card rounded-lg border py-12 text-center">
                <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-medium text-foreground mb-1">No content found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || roleFilter !== 'all' || contentTypeFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Add content to classify'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredContent.map((item) => {
                  const itemKey = `${item.content_type}:${item.content_id}`;
                  return (
                    <ContentClassifier
                      key={itemKey}
                      content={item}
                      isExpanded={expandedContent === itemKey}
                      onToggleExpand={() => setExpandedContent(
                        expandedContent === itemKey ? null : itemKey
                      )}
                      onSave={handleSaveRole}
                      onRemoveRole={() => handleRemoveRole(item.content_type, item.content_id)}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Offer Preview Panel */}
          {showPreview && (
            <div className="w-full flex-shrink-0 xl:w-96">
              <div className="sticky top-4">
                <h3 className="font-semibold text-foreground mb-4">Grand Slam Offer Preview</h3>

                {stats.classified === 0 ? (
                  <div className="admin-console-card rounded-lg border p-6 text-center">
                    <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      Classify content to see your offer preview
                    </p>
                  </div>
                ) : (
                  <OfferStack
                    products={[
                      ...(grandSlamOffer.coreOffer ? [grandSlamOffer.coreOffer] : []),
                      ...grandSlamOffer.bonuses,
                    ]}
                    totalPrice={grandSlamOffer.offerPrice}
                    totalValue={grandSlamOffer.totalPerceivedValue}
                  />
                )}

                {/* Role breakdown */}
                <div className="admin-console-card mt-6 rounded-lg border p-4">
                  <h4 className="font-medium text-foreground mb-3">Offer Composition</h4>
                  <div className="space-y-2">
                    {OFFER_ROLES.map((role) => {
                      const count = stats.byRole[role];
                      if (count === 0) return null;
                      return (
                        <div key={role} className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${OFFER_ROLE_COLORS[role]}`}>
                            {OFFER_ROLE_LABELS[role]}
                          </span>
                          <span className="text-muted-foreground">{count} product{count !== 1 ? 's' : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
