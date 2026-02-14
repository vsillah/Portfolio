'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { TIER_OPTIONS } from '@/lib/constants/bundle-tiers';
import { useAuth } from '@/components/AuthProvider';
import { getCurrentSession } from '@/lib/auth';
import { 
  OfferBundleWithStats,
  ResolvedBundleItem,
  BundleItem,
  ContentType,
  OfferRole,
  OFFER_ROLE_LABELS,
  OFFER_ROLE_COLORS,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_ICONS,
  calculateBundleTotals,
  createBundleItemFromResolved,
} from '@/lib/sales-scripts';
import { BundleEditor } from '@/components/admin/sales/BundleEditor';
import Breadcrumbs from '@/components/admin/Breadcrumbs';
import { 
  Package, 
  Plus, 
  Search, 
  RefreshCw,
  Edit,
  Trash2,
  Copy,
  GitFork,
  Eye,
  DollarSign,
  Layers,
  ChevronRight,
  X,
  Save,
  AlertCircle,
  Heart,
  Shield,
} from 'lucide-react';

export default function BundleManagementPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [bundles, setBundles] = useState<OfferBundleWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBundle, setEditingBundle] = useState<OfferBundleWithStats | null>(null);
  const [viewingBundle, setViewingBundle] = useState<{
    bundle: OfferBundleWithStats;
    items: ResolvedBundleItem[];
  } | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const fetchBundles = useCallback(async () => {
    const session = await getCurrentSession();
    if (!session?.access_token) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (!showInactive) params.append('active', 'true');
      
      const response = await fetch(`/api/admin/sales/bundles?${params}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch bundles');
      
      const data = await response.json();
      setBundles(data.bundles || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [showInactive, user]);

  useEffect(() => {
    if (user) {
      fetchBundles();
    }
  }, [user, fetchBundles]);

  const viewBundleDetails = async (bundle: OfferBundleWithStats) => {
    const session = await getCurrentSession();
    if (!session?.access_token) return;
    
    try {
      const response = await fetch(`/api/admin/sales/bundles/${bundle.id}/resolve`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch bundle details');
      
      const data = await response.json();
      setViewingBundle({ bundle, items: data.items });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bundle details');
    }
  };

  const deleteBundle = async (bundleId: string) => {
    if (!confirm('Are you sure you want to deactivate this bundle?')) return;
    
    const session = await getCurrentSession();
    if (!session?.access_token) return;
    
    try {
      const response = await fetch(`/api/admin/sales/bundles/${bundleId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to delete bundle');
      
      fetchBundles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete bundle');
    }
  };

  const duplicateBundle = async (bundle: OfferBundleWithStats) => {
    const session = await getCurrentSession();
    if (!session?.access_token) return;
    
    try {
      const response = await fetch('/api/admin/sales/bundles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: `${bundle.name} (Copy)`,
          description: bundle.description,
          bundle_items: bundle.bundle_items,
          bundle_price: bundle.bundle_price,
          parent_bundle_id: bundle.id,
        }),
      });
      if (!response.ok) throw new Error('Failed to duplicate bundle');
      
      fetchBundles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate bundle');
    }
  };

  // Filter bundles by search
  const filteredBundles = bundles.filter(bundle => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      bundle.name.toLowerCase().includes(query) ||
      bundle.description?.toLowerCase().includes(query)
    );
  });

  // Stats
  const stats = {
    total: bundles.length,
    standard: bundles.filter(b => b.bundle_type === 'standard').length,
    custom: bundles.filter(b => b.bundle_type === 'custom').length,
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumbs */}
        <Breadcrumbs 
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Sales', href: '/admin/sales' },
            { label: 'Bundles' },
          ]} 
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Offer Bundles</h1>
            <p className="text-gray-400 mt-1">
              Pre-configured offer templates for sales calls
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchBundles()}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Bundle
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-900/50 rounded-lg">
                <Package className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-gray-400">Total Bundles</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-900/50 rounded-lg">
                <Layers className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.standard}</p>
                <p className="text-sm text-gray-400">Standard Templates</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-900/50 rounded-lg">
                <GitFork className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.custom}</p>
                <p className="text-sm text-gray-400">Custom (Forked)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search bundles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-600"
            />
            Show inactive
          </label>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-800 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-200">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        )}

        {/* Bundle Grid */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBundles.map((bundle) => (
              <BundleCard
                key={bundle.id}
                bundle={bundle}
                onView={() => viewBundleDetails(bundle)}
                onEdit={() => setEditingBundle(bundle)}
                onDuplicate={() => duplicateBundle(bundle)}
                onDelete={() => deleteBundle(bundle.id)}
              />
            ))}
            
            {filteredBundles.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-400">
                <Package className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No bundles found</p>
                <p className="text-sm mt-1">Create your first bundle to get started</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-white"
                >
                  Create Bundle
                </button>
              </div>
            )}
          </div>
        )}

        {/* Create Bundle Modal */}
        {showCreateModal && (
          <CreateBundleModal
            onClose={() => setShowCreateModal(false)}
            onSave={fetchBundles}
          />
        )}

        {/* Edit Bundle Modal */}
        {editingBundle && (
          <EditBundleModal
            bundle={editingBundle}
            allBundles={bundles}
            onClose={() => setEditingBundle(null)}
            onSave={() => {
              fetchBundles();
              setEditingBundle(null);
            }}
          />
        )}

        {/* View Bundle Modal */}
        {viewingBundle && (
          <ViewBundleModal
            bundle={viewingBundle.bundle}
            items={viewingBundle.items}
            onClose={() => setViewingBundle(null)}
            onSave={() => {
              fetchBundles();
              setViewingBundle(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

// Bundle Card Component
function BundleCard({
  bundle,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  bundle: OfferBundleWithStats;
  onView: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const previewItems = bundle.preview_items || [];
  const hasMoreItems = bundle.item_count > previewItems.length;
  
  return (
    <div className={`bg-gray-900 rounded-lg border ${bundle.is_active ? 'border-gray-800' : 'border-gray-700 opacity-60'} p-4 hover:border-gray-700 transition-colors`}>
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
            <p className="text-xs text-gray-500 mt-1">
              Tier: {bundle.pricing_tier_slug
                ? (TIER_OPTIONS.find((t) => t.value === bundle.pricing_tier_slug)?.label ?? bundle.pricing_tier_slug)
                : '—'}
            </p>
          )}
          {bundle.is_decoy && (
            <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
              <Heart className="w-3 h-3" />
              Community Impact{bundle.mirrors_tier_id ? ` · mirrors ${bundle.mirrors_tier_id}` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {bundle.is_decoy && (
            <div className="px-2 py-1 text-xs font-medium rounded bg-emerald-900/50 text-emerald-300">
              decoy
            </div>
          )}
          {bundle.has_guarantee === false && (
            <div className="px-2 py-1 text-xs font-medium rounded bg-gray-700/50 text-gray-400" title="No guarantee">
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
      
      {/* Bundle Contents Preview */}
      <div className="mb-3">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
          <Package className="w-3 h-3" />
          <span>Contents ({bundle.item_count} items)</span>
        </div>
        {previewItems.length > 0 ? (
          <div className="space-y-1">
            {previewItems.map((item, index) => (
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
      
      {/* Price */}
      <div className="flex items-center gap-2 text-sm mb-4">
        <span className="flex items-center gap-1 text-green-400">
          <DollarSign className="w-4 h-4" />
          {(bundle.bundle_price ?? bundle.total_retail_value ?? 0).toFixed(2)}
        </span>
        {bundle.total_perceived_value != null && bundle.total_perceived_value > (bundle.bundle_price ?? bundle.total_retail_value ?? 0) && (
          <span className="text-gray-500 line-through text-xs">
            ${bundle.total_perceived_value.toFixed(2)} value
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

// Create Bundle Modal
function CreateBundleModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDecoy, setIsDecoy] = useState(false);
  const [targetAudience, setTargetAudience] = useState<string[]>([]);
  const [mirrorsTierId, setMirrorsTierId] = useState('');
  const [showOnPricingPage, setShowOnPricingPage] = useState(false);
  const [pricingSegments, setPricingSegments] = useState<string[]>([]);
  const [pricingTierSlug, setPricingTierSlug] = useState('');
  const [tagline, setTagline] = useState('');
  const [targetAudienceDisplay, setTargetAudienceDisplay] = useState('');
  const [pricingDisplayOrder, setPricingDisplayOrder] = useState(0);
  const [isFeatured, setIsFeatured] = useState(false);
  const [guaranteeName, setGuaranteeName] = useState('');
  const [guaranteeDescription, setGuaranteeDescription] = useState('');
  const [ctaText, setCtaText] = useState('Get Started');
  const [ctaHref, setCtaHref] = useState('#contact');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const SEGMENTS = ['smb', 'midmarket', 'nonprofit'] as const;
  const togglePricingSegment = (seg: string) => {
    setPricingSegments((prev) =>
      prev.includes(seg) ? prev.filter((s) => s !== seg) : [...prev, seg]
    );
  };


  const AUDIENCE_OPTIONS = ['nonprofit', 'education'];

  const toggleAudience = (audience: string) => {
    setTargetAudience(prev => 
      prev.includes(audience) 
        ? prev.filter(a => a !== audience)
        : [...prev, audience]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Bundle name is required');
      return;
    }

    const session = await getCurrentSession();
    if (!session?.access_token) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/sales/bundles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          bundle_items: [],
          bundle_type: isDecoy ? 'decoy' : 'standard',
          is_decoy: isDecoy,
          target_audience: isDecoy ? targetAudience : [],
          mirrors_tier_id: isDecoy && mirrorsTierId ? mirrorsTierId : null,
          has_guarantee: !isDecoy,
          pricing_page_segments: showOnPricingPage ? pricingSegments : [],
          pricing_tier_slug: pricingTierSlug || null,
          tagline: tagline || null,
          target_audience_display: targetAudienceDisplay || null,
          pricing_display_order: pricingDisplayOrder,
          is_featured: isFeatured,
          guarantee_name: guaranteeName || null,
          guarantee_description: guaranteeDescription || null,
          cta_text: ctaText || 'Get Started',
          cta_href: ctaHref || '#contact',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create bundle');
      }

      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create bundle');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Create New Bundle</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-800 rounded-lg text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Bundle Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Enterprise Starter Pack"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this bundle includes and who it's for..."
              rows={3}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Community Impact / Decoy toggle */}
          <div className="border-t border-gray-800 pt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`relative w-10 h-5 rounded-full transition-colors ${isDecoy ? 'bg-emerald-600' : 'bg-gray-700'}`}>
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isDecoy ? 'translate-x-5' : ''}`} />
              </div>
              <div>
                <span className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-emerald-400" />
                  Community Impact (Decoy) Offer
                </span>
                <span className="text-xs text-gray-500 block mt-0.5">
                  Lower price, self-serve delivery, no guarantee
                </span>
              </div>
            </label>

            {isDecoy && (
              <div className="mt-4 space-y-3 pl-1">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Target Audience
                  </label>
                  <div className="flex gap-2">
                    {AUDIENCE_OPTIONS.map(audience => (
                      <button
                        key={audience}
                        type="button"
                        onClick={() => toggleAudience(audience)}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                          targetAudience.includes(audience)
                            ? 'bg-emerald-900/50 text-emerald-300 border-emerald-700'
                            : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        {audience.charAt(0).toUpperCase() + audience.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Mirrors Premium Tier
                  </label>
                  <select
                    value={mirrorsTierId}
                    onChange={(e) => setMirrorsTierId(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">None (standalone)</option>
                    {TIER_OPTIONS.map(tier => (
                      <option key={tier.value} value={tier.value}>{tier.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Pricing page (standard/decoy only; custom comes from save-as) */}
          <div className="border-t border-gray-800 pt-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Pricing Page</h3>
            <label className="flex items-center gap-3 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={showOnPricingPage}
                onChange={(e) => setShowOnPricingPage(e.target.checked)}
                className="rounded border-gray-600"
              />
              <span className="text-sm text-gray-300">Show on pricing page</span>
            </label>
            {showOnPricingPage && (
              <div className="space-y-3 pl-1">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Segments</label>
                  <div className="flex gap-2">
                    {SEGMENTS.map((seg) => (
                      <button
                        key={seg}
                        type="button"
                        onClick={() => togglePricingSegment(seg)}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                          pricingSegments.includes(seg)
                            ? 'bg-blue-900/50 text-blue-300 border-blue-700'
                            : 'bg-gray-800 text-gray-400 border-gray-700'
                        }`}
                      >
                        {seg}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Tier
                  </label>
                  <select
                    value={pricingTierSlug}
                    onChange={(e) => setPricingTierSlug(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="">— No tier</option>
                    {TIER_OPTIONS.map((tier) => (
                      <option key={tier.value} value={tier.value}>{tier.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Tagline</label>
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Target audience (display)
                  </label>
                  <input
                    type="text"
                    value={targetAudienceDisplay}
                    onChange={(e) => setTargetAudienceDisplay(e.target.value)}
                    placeholder="e.g. Nonprofits & educational institutions"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Display order
                  </label>
                  <input
                    type="number"
                    value={pricingDisplayOrder}
                    onChange={(e) =>
                      setPricingDisplayOrder(parseInt(e.target.value, 10) || 0)
                    }
                    min={0}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="rounded border-gray-600"
                  />
                  <span className="text-sm text-gray-300">Featured (Most Popular)</span>
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Create Bundle
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-4 text-center">
          You can add items to this bundle after creating it
        </p>
      </div>
    </div>
  );
}

// Edit Bundle Modal (metadata + pricing page fields)
function EditBundleModal({
  bundle,
  allBundles,
  onClose,
  onSave,
}: {
  bundle: OfferBundleWithStats;
  allBundles: OfferBundleWithStats[];
  onClose: () => void;
  onSave: () => void;
}) {
  const isCustom = bundle.bundle_type === 'custom';
  const [name, setName] = useState(bundle.name);
  const [description, setDescription] = useState(bundle.description ?? '');
  const [baseBundleId, setBaseBundleId] = useState<string>(bundle.base_bundle_id ?? '');
  const [showOnPricingPage, setShowOnPricingPage] = useState(
    Array.isArray(bundle.pricing_page_segments) && bundle.pricing_page_segments.length > 0
  );
  const [pricingSegments, setPricingSegments] = useState<string[]>(
    (bundle.pricing_page_segments as string[]) ?? []
  );
  const [pricingTierSlug, setPricingTierSlug] = useState(bundle.pricing_tier_slug ?? '');
  const [tagline, setTagline] = useState(bundle.tagline ?? '');
  const [targetAudienceDisplay, setTargetAudienceDisplay] = useState(
    bundle.target_audience_display ?? ''
  );
  const [pricingDisplayOrder, setPricingDisplayOrder] = useState(
    bundle.pricing_display_order ?? 0
  );
  const [isFeatured, setIsFeatured] = useState(bundle.is_featured ?? false);
  const [guaranteeName, setGuaranteeName] = useState(bundle.guarantee_name ?? '');
  const [guaranteeDescription, setGuaranteeDescription] = useState(
    bundle.guarantee_description ?? ''
  );
  const [ctaText, setCtaText] = useState(bundle.cta_text ?? 'Get Started');
  const [ctaHref, setCtaHref] = useState(bundle.cta_href ?? '#contact');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const SEGMENTS = ['smb', 'midmarket', 'nonprofit'] as const;

  const toggleSegment = (seg: string) => {
    setPricingSegments((prev) =>
      prev.includes(seg) ? prev.filter((s) => s !== seg) : [...prev, seg]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Bundle name is required');
      return;
    }

    const session = await getCurrentSession();
    if (!session?.access_token) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/sales/bundles/${bundle.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          base_bundle_id: baseBundleId || null,
          pricing_page_segments: isCustom ? undefined : showOnPricingPage ? pricingSegments : [],
          pricing_tier_slug: isCustom ? undefined : pricingTierSlug || null,
          tagline: isCustom ? undefined : tagline || null,
          target_audience_display: isCustom ? undefined : targetAudienceDisplay || null,
          pricing_display_order: isCustom ? undefined : pricingDisplayOrder,
          is_featured: isCustom ? undefined : isFeatured,
          guarantee_name: guaranteeName || null,
          guarantee_description: guaranteeDescription || null,
          cta_text: ctaText || 'Get Started',
          cta_href: ctaHref || '#contact',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save bundle');
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bundle');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Edit Bundle</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-800 rounded-lg text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Bundle Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Base bundle - hidden for custom bundles */}
          {!isCustom && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Base bundle</label>
              <p className="text-xs text-gray-500 mb-2">
                {bundle.base_bundle_name ? `Currently based on: ${bundle.base_bundle_name}` : 'Currently: None'}
              </p>
              <select
                value={baseBundleId}
                onChange={(e) => setBaseBundleId(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="">— None</option>
                {allBundles
                  .filter((b) => b.id !== bundle.id)
                  .map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
              </select>
            </div>
          )}

          {/* Pricing page section - hidden for custom bundles */}
          {!isCustom && (
            <div className="border-t border-gray-800 pt-4 space-y-4">
              <h3 className="text-sm font-medium text-gray-300">Pricing Page</h3>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnPricingPage}
                  onChange={(e) => setShowOnPricingPage(e.target.checked)}
                  className="rounded border-gray-600"
                />
                <span className="text-sm text-gray-300">Show on pricing page</span>
              </label>

              {showOnPricingPage && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      Segments
                    </label>
                    <div className="flex gap-2">
                      {SEGMENTS.map((seg) => (
                        <button
                          key={seg}
                          type="button"
                          onClick={() => toggleSegment(seg)}
                          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                            pricingSegments.includes(seg)
                              ? 'bg-blue-900/50 text-blue-300 border-blue-700'
                              : 'bg-gray-800 text-gray-400 border-gray-700'
                          }`}
                        >
                          {seg}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Tier</label>
                    <select
                      value={pricingTierSlug}
                      onChange={(e) => setPricingTierSlug(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="">— No tier</option>
                      {TIER_OPTIONS.map((tier) => (
                        <option key={tier.value} value={tier.value}>{tier.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Tagline</label>
                    <input
                      type="text"
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      Target audience (display)
                    </label>
                    <input
                      type="text"
                      value={targetAudienceDisplay}
                      onChange={(e) => setTargetAudienceDisplay(e.target.value)}
                      placeholder="e.g. Nonprofits & educational institutions"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      Display order
                    </label>
                    <input
                      type="number"
                      value={pricingDisplayOrder}
                      onChange={(e) => setPricingDisplayOrder(parseInt(e.target.value, 10) || 0)}
                      min={0}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isFeatured}
                      onChange={(e) => setIsFeatured(e.target.checked)}
                      className="rounded border-gray-600"
                    />
                    <span className="text-sm text-gray-300">Featured (Most Popular)</span>
                  </label>
                </>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Guarantee name
                </label>
                <input
                  type="text"
                  value={guaranteeName}
                  onChange={(e) => setGuaranteeName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Guarantee description
                </label>
                <input
                  type="text"
                  value={guaranteeDescription}
                  onChange={(e) => setGuaranteeDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">CTA text</label>
                <input
                  type="text"
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">CTA href</label>
                <input
                  type="text"
                  value={ctaHref}
                  onChange={(e) => setCtaHref(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {isCustom && (
            <p className="text-xs text-gray-500 italic">
              Custom bundles do not appear on the pricing page.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// View/Edit Bundle Modal
function ViewBundleModal({
  bundle,
  items: initialItems,
  onClose,
  onSave,
}: {
  bundle: OfferBundleWithStats;
  items: ResolvedBundleItem[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [items, setItems] = useState<ResolvedBundleItem[]>(initialItems);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [bundleName, setBundleName] = useState(bundle.name);
  const [bundleDescription, setBundleDescription] = useState(bundle.description || '');
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  
  const totals = calculateBundleTotals(items);
  
  const handleItemsChange = (newItems: ResolvedBundleItem[]) => {
    setItems(newItems);
    setHasChanges(true);
  };

  const handleHeaderChange = () => {
    if (bundleName !== bundle.name || bundleDescription !== (bundle.description || '')) {
      setHasChanges(true);
    }
    setIsEditingHeader(false);
  };
  
  const handleSave = async () => {
    const session = await getCurrentSession();
    if (!session?.access_token) return;
    
    setIsSaving(true);
    setError(null);
    
    try {
      // Convert resolved items back to BundleItem format for the API
      const bundleItems: BundleItem[] = items.map(item => 
        createBundleItemFromResolved(item, true)
      );

      // Build payload — include name/description if changed
      const payload: Record<string, unknown> = {
        bundle_items: bundleItems,
      };
      if (bundleName !== bundle.name) payload.name = bundleName;
      if (bundleDescription !== (bundle.description || '')) payload.description = bundleDescription;
      
      const response = await fetch(`/api/admin/sales/bundles/${bundle.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save bundle');
      }
      
      setHasChanges(false);
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bundle');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-800">
          {isEditingHeader ? (
            <div className="flex-1 mr-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Bundle Name</label>
                <input
                  type="text"
                  value={bundleName}
                  onChange={(e) => setBundleName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-lg font-semibold"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                <textarea
                  value={bundleDescription}
                  onChange={(e) => setBundleDescription(e.target.value)}
                  placeholder="Enter bundle description..."
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-sm text-gray-300 resize-y"
                />
              </div>
              <button
                onClick={handleHeaderChange}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="flex-1 min-w-0 group cursor-pointer" onClick={() => setIsEditingHeader(true)}>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">{bundleName}</h2>
                <Edit className="w-4 h-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {bundleDescription ? (
                <p className="text-sm text-gray-400 mt-1">{bundleDescription}</p>
              ) : (
                <p className="text-sm text-gray-600 mt-1 italic opacity-0 group-hover:opacity-100 transition-opacity">Click to add description...</p>
              )}
            </div>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-white ml-2 mt-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Base bundle info */}
        {bundle.base_bundle_name && (
          <div className="px-6 py-2 bg-gray-950/50 border-b border-gray-800">
            <p className="text-sm text-blue-400">
              <Layers className="w-4 h-4 inline-block mr-1.5 align-middle" />
              Based on: {bundle.base_bundle_name}
            </p>
            <p className="text-xs text-gray-500 mt-1">This bundle includes all items from the base bundle plus the items below.</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 p-4 bg-gray-950 border-b border-gray-800">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{items.length}</p>
            <p className="text-xs text-gray-400">Items</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">${totals.totalRetailValue.toFixed(0)}</p>
            <p className="text-xs text-gray-400">Retail Value</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-400">${totals.totalPerceivedValue.toFixed(0)}</p>
            <p className="text-xs text-gray-400">Perceived Value</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-400">{totals.coreOfferCount}</p>
            <p className="text-xs text-gray-400">Core Offers</p>
          </div>
        </div>
        
        {/* Error */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-900/50 border border-red-800 rounded-lg flex items-center gap-2 text-sm text-red-200">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Bundle Editor */}
        <div className="flex-1 overflow-y-auto p-4">
          <BundleEditor
            bundleId={bundle.id}
            items={items}
            onItemsChange={handleItemsChange}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-950 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            {hasChanges ? 'Cancel' : 'Close'}
          </button>
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {isSaving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
