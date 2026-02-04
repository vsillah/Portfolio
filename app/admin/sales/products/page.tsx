'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getCurrentSession } from '@/lib/auth';
import { 
  ProductWithRole,
  OfferRole,
  OFFER_ROLE_LABELS,
  OFFER_ROLE_COLORS,
  buildGrandSlamOffer,
} from '@/lib/sales-scripts';
import { ProductClassifier, ProductOfferRoleInput } from '@/components/admin/sales/ProductClassifier';
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

export default function ProductClassificationPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<OfferRole | 'all' | 'unclassified'>('all');
  const [showPreview, setShowPreview] = useState(false);

  const fetchProducts = useCallback(async () => {
    const session = await getCurrentSession();
    if (!session?.access_token) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (roleFilter !== 'all' && roleFilter !== 'unclassified') {
        params.append('role', roleFilter);
      }
      
      const response = await fetch(`/api/admin/sales/products?${params}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch products');
      
      const data = await response.json();
      setProducts(data.products || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [roleFilter, user]);

  // Fetch when user becomes available or filters change
  useEffect(() => {
    if (user) {
      fetchProducts();
    }
  }, [user, fetchProducts]);

  const handleSaveRole = async (data: ProductOfferRoleInput) => {
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
    await fetchProducts();
    setExpandedProduct(null);
  };

  const handleRemoveRole = async (productId: number) => {
    const session = await getCurrentSession();
    const response = await fetch(`/api/admin/sales/products?product_id=${productId}`, {
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
    await fetchProducts();
  };

  // Filter products
  const filteredProducts = products.filter(product => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!product.title.toLowerCase().includes(query) && 
          !product.description?.toLowerCase().includes(query)) {
        return false;
      }
    }
    
    // Role filter
    if (roleFilter === 'unclassified' && product.offer_role) {
      return false;
    }
    
    return true;
  });

  // Get products for Grand Slam Offer preview
  const classifiedProducts = products.filter(p => p.offer_role);
  const grandSlamOffer = buildGrandSlamOffer(classifiedProducts);

  // Stats
  const stats = {
    total: products.length,
    classified: products.filter(p => p.offer_role).length,
    unclassified: products.filter(p => !p.offer_role).length,
    byRole: OFFER_ROLES.reduce((acc, role) => {
      acc[role] = products.filter(p => p.offer_role === role).length;
      return acc;
    }, {} as Record<OfferRole, number>),
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Breadcrumbs 
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Sales', href: '/admin/sales' },
            { label: 'Product Classification' },
          ]} 
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Package className="w-7 h-7 text-emerald-500" />
              Product Classification
            </h1>
            <p className="text-gray-400 mt-1">
              Classify your products using Alex Hormozi's offer framework
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                showPreview 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-gray-900 border border-gray-700 text-white hover:border-purple-500/50'
              }`}
            >
              <Eye className="w-4 h-4" />
              Offer Preview
            </button>

            <button
              onClick={fetchProducts}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white hover:border-purple-500/50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
            <div className="text-sm text-gray-400">Total Products</div>
            <div className="text-2xl font-bold text-white">{stats.total}</div>
          </div>
          <div className="bg-green-500/20 rounded-lg border border-green-500/50 p-4">
            <div className="text-sm text-gray-400 flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Classified
            </div>
            <div className="text-2xl font-bold text-green-400">{stats.classified}</div>
          </div>
          <div className="bg-orange-500/20 rounded-lg border border-orange-500/50 p-4">
            <div className="text-sm text-gray-400 flex items-center gap-1">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              Unclassified
            </div>
            <div className="text-2xl font-bold text-orange-400">{stats.unclassified}</div>
          </div>
          <div className="bg-blue-500/20 rounded-lg border border-blue-500/50 p-4">
            <div className="text-sm text-gray-400 flex items-center gap-1">
              <Tag className="w-4 h-4 text-blue-500" />
              Core Offers
            </div>
            <div className="text-2xl font-bold text-blue-400">{stats.byRole.core_offer}</div>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Main content */}
          <div className={`flex-1 ${showPreview ? 'max-w-3xl' : ''}`}>
            {/* Filters */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 mb-6">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                  />
                </div>

                {/* Role filter */}
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-gray-500" />
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as OfferRole | 'all' | 'unclassified')}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
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
              <div className="bg-red-500/20 text-red-400 p-4 rounded-lg border border-red-500/50 mb-6">
                {error}
              </div>
            )}

            {/* Products list */}
            {isLoading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 text-gray-500 animate-spin mx-auto mb-3" />
                <p className="text-gray-400">Loading products...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12 bg-gray-900 rounded-lg border border-gray-800">
                <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-white mb-1">No products found</h3>
                <p className="text-gray-400">
                  {searchQuery || roleFilter !== 'all' 
                    ? 'Try adjusting your filters' 
                    : 'Add products to your store first'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredProducts.map((product) => (
                  <ProductClassifier
                    key={product.id}
                    product={product}
                    isExpanded={expandedProduct === product.id}
                    onToggleExpand={() => setExpandedProduct(
                      expandedProduct === product.id ? null : product.id
                    )}
                    onSave={handleSaveRole}
                    onRemoveRole={() => handleRemoveRole(product.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Offer Preview Panel */}
          {showPreview && (
            <div className="w-96 flex-shrink-0">
              <div className="sticky top-4">
                <h3 className="font-semibold text-white mb-4">Grand Slam Offer Preview</h3>
                
                {classifiedProducts.length === 0 ? (
                  <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 text-center">
                    <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">
                      Classify products to see your offer preview
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
                <div className="mt-6 bg-gray-900 rounded-lg border border-gray-800 p-4">
                  <h4 className="font-medium text-white mb-3">Offer Composition</h4>
                  <div className="space-y-2">
                    {OFFER_ROLES.map((role) => {
                      const count = stats.byRole[role];
                      if (count === 0) return null;
                      return (
                        <div key={role} className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${OFFER_ROLE_COLORS[role]}`}>
                            {OFFER_ROLE_LABELS[role]}
                          </span>
                          <span className="text-gray-400">{count} product{count !== 1 ? 's' : ''}</span>
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
