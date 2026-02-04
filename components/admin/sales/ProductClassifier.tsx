'use client';

import { useState } from 'react';
import { 
  OfferRole, 
  PayoutType,
  OFFER_ROLE_LABELS, 
  OFFER_ROLE_DESCRIPTIONS,
  OFFER_ROLE_COLORS,
  ProductWithRole,
} from '@/lib/sales-scripts';
import { 
  Tag, 
  DollarSign, 
  Target, 
  Clock, 
  Zap, 
  Gift,
  ChevronDown,
  ChevronUp,
  Save,
  X,
  Info,
} from 'lucide-react';

interface ProductClassifierProps {
  product: ProductWithRole;
  onSave: (data: ProductOfferRoleInput) => Promise<void>;
  onRemoveRole: () => Promise<void>;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export interface ProductOfferRoleInput {
  product_id: number;
  offer_role: OfferRole;
  dream_outcome_description?: string;
  likelihood_multiplier?: number;
  time_reduction?: number;
  effort_reduction?: number;
  retail_price?: number;
  offer_price?: number;
  perceived_value?: number;
  bonus_name?: string;
  bonus_description?: string;
  qualifying_actions?: Record<string, unknown>;
  payout_type?: PayoutType;
  display_order?: number;
  is_active?: boolean;
}

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

const PAYOUT_TYPES: { value: PayoutType; label: string }[] = [
  { value: 'credit', label: 'Credit (toward future purchase)' },
  { value: 'refund', label: 'Refund (money back)' },
  { value: 'rollover', label: 'Rollover (apply to upgrade)' },
];

export function ProductClassifier({ 
  product, 
  onSave, 
  onRemoveRole,
  isExpanded = false,
  onToggleExpand,
}: ProductClassifierProps) {
  const [formData, setFormData] = useState<ProductOfferRoleInput>({
    product_id: product.id,
    offer_role: product.offer_role || 'core_offer',
    dream_outcome_description: product.dream_outcome_description || '',
    likelihood_multiplier: product.likelihood_multiplier || 5,
    time_reduction: product.time_reduction || 0,
    effort_reduction: product.effort_reduction || 5,
    retail_price: product.role_retail_price || product.price || 0,
    offer_price: product.offer_price || product.price || 0,
    perceived_value: product.perceived_value || 0,
    bonus_name: product.bonus_name || '',
    bonus_description: product.bonus_description || '',
    payout_type: product.payout_type || undefined,
    display_order: product.display_order || 0,
    is_active: true,
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Remove the offer role from this product?')) return;
    setIsSaving(true);
    try {
      await onRemoveRole();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove');
    } finally {
      setIsSaving(false);
    }
  };

  const roleColor = product.offer_role 
    ? OFFER_ROLE_COLORS[product.offer_role] 
    : 'bg-gray-100 text-gray-600 border-gray-300';

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {/* Header - Always visible */}
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-4">
          {product.image_url ? (
            <img 
              src={product.image_url} 
              alt={product.title}
              className="w-12 h-12 rounded object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center">
              <Gift className="w-6 h-6 text-gray-400" />
            </div>
          )}
          
          <div>
            <h3 className="font-medium text-gray-900">{product.title}</h3>
            <p className="text-sm text-gray-500">{product.type} • ${product.price || 0}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {product.offer_role ? (
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${roleColor}`}>
              {OFFER_ROLE_LABELS[product.offer_role]}
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-sm text-gray-500 bg-gray-100 border border-gray-200">
              Not Classified
            </span>
          )}
          
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded Form */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Role Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Offer Role (Hormozi Framework)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {OFFER_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setFormData({ ...formData, offer_role: role })}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    formData.offer_role === role
                      ? `${OFFER_ROLE_COLORS[role]} border-2`
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-sm">{OFFER_ROLE_LABELS[role]}</div>
                  <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {OFFER_ROLE_DESCRIPTIONS[role]}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Value Equation Section */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-blue-600" />
              <h4 className="font-medium text-gray-900">Value Equation</h4>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
                <div className="hidden group-hover:block absolute left-0 top-6 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                  Value = (Dream Outcome × Likelihood) / (Time × Effort)
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Dream Outcome Description
                </label>
                <textarea
                  value={formData.dream_outcome_description || ''}
                  onChange={(e) => setFormData({ ...formData, dream_outcome_description: e.target.value })}
                  placeholder="What specific result does this deliver?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  rows={2}
                />
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Likelihood (1-10)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={formData.likelihood_multiplier || 5}
                    onChange={(e) => setFormData({ ...formData, likelihood_multiplier: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Time Saved (days)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.time_reduction || 0}
                    onChange={(e) => setFormData({ ...formData, time_reduction: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Effort Reduction (1-10)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={formData.effort_reduction || 5}
                    onChange={(e) => setFormData({ ...formData, effort_reduction: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Section */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-green-600" />
              <h4 className="font-medium text-gray-900">Pricing Context</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Retail Price (for anchoring)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.retail_price || 0}
                    onChange={(e) => setFormData({ ...formData, retail_price: parseFloat(e.target.value) })}
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Offer Price (when bundled)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.offer_price || 0}
                    onChange={(e) => setFormData({ ...formData, offer_price: parseFloat(e.target.value) })}
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Perceived Value (to communicate)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.perceived_value || 0}
                    onChange={(e) => setFormData({ ...formData, perceived_value: parseFloat(e.target.value) })}
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Bonus-specific fields */}
          {formData.offer_role === 'bonus' && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Gift className="w-4 h-4 text-purple-600" />
                <h4 className="font-medium text-gray-900">Bonus Details</h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Bonus Name (with benefit)
                  </label>
                  <input
                    type="text"
                    value={formData.bonus_name || ''}
                    onChange={(e) => setFormData({ ...formData, bonus_name: e.target.value })}
                    placeholder="e.g., 'Quick Start Templates That Save 10 Hours'"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    How It Relates to Goals
                  </label>
                  <input
                    type="text"
                    value={formData.bonus_description || ''}
                    onChange={(e) => setFormData({ ...formData, bonus_description: e.target.value })}
                    placeholder="Describe how this bonus helps achieve the dream outcome"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Attraction offer fields */}
          {formData.offer_role === 'lead_magnet' && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-yellow-600" />
                <h4 className="font-medium text-gray-900">Attraction Offer Settings</h4>
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Payout Type (if conditions met)
                </label>
                <select
                  value={formData.payout_type || ''}
                  onChange={(e) => setFormData({ ...formData, payout_type: e.target.value as PayoutType })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">No payout (free lead magnet)</option>
                  {PAYOUT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            {product.offer_role && (
              <button
                onClick={handleRemove}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                Remove Role
              </button>
            )}
            
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 ml-auto"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Classification'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
