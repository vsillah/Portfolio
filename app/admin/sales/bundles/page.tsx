'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
        </div>
        <div className={`px-2 py-1 text-xs font-medium rounded ${
          bundle.bundle_type === 'standard' 
            ? 'bg-green-900/50 text-green-300' 
            : 'bg-purple-900/50 text-purple-300'
        }`}>
          {bundle.bundle_type}
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
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  
  const totals = calculateBundleTotals(items);
  
  const handleItemsChange = (newItems: ResolvedBundleItem[]) => {
    setItems(newItems);
    setHasChanges(true);
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
      
      const response = await fetch(`/api/admin/sales/bundles/${bundle.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          bundle_items: bundleItems,
        }),
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
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-semibold">{bundle.name}</h2>
            {bundle.description && (
              <p className="text-sm text-gray-400 mt-1">{bundle.description}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

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
