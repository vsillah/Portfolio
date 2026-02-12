'use client';

import { useState, useEffect } from 'react';
import { getCurrentSession } from '@/lib/auth';
import {
  BundleItem,
  ResolvedBundleItem,
  ContentWithRole,
  ContentType,
  OfferRole,
  OFFER_ROLE_LABELS,
  OFFER_ROLE_COLORS,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_ICONS,
  resolveBundleItem,
  createBundleItemFromResolved,
} from '@/lib/sales-scripts';
import {
  Plus,
  X,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit2,
  Save,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';

interface BundleEditorProps {
  bundleId?: string;
  items: ResolvedBundleItem[];
  onItemsChange: (items: ResolvedBundleItem[]) => void;
  readOnly?: boolean;
}

export function BundleEditor({ bundleId, items, onItemsChange, readOnly = false }: BundleEditorProps) {
  const [showContentPicker, setShowContentPicker] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  
  const addItem = (content: ContentWithRole) => {
    const newItem: ResolvedBundleItem = {
      ...content,
      display_order: items.length,
      is_optional: false,
      has_overrides: false,
    };
    onItemsChange([...items, newItem]);
    setShowContentPicker(false);
  };
  
  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    // Reorder
    newItems.forEach((item, i) => item.display_order = i);
    onItemsChange(newItems);
  };
  
  const moveItem = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= items.length) return;
    
    const newItems = [...items];
    [newItems[fromIndex], newItems[toIndex]] = [newItems[toIndex], newItems[fromIndex]];
    newItems.forEach((item, i) => item.display_order = i);
    onItemsChange(newItems);
  };
  
  const updateItemRole = (index: number, role: OfferRole) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      offer_role: role,
      has_overrides: role !== newItems[index].original_role,
    };
    onItemsChange(newItems);
  };
  
  const updateItemPrice = (index: number, price: number) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      role_retail_price: price,
      has_overrides: true,
    };
    onItemsChange(newItems);
  };

  return (
    <div className="space-y-4">
      {/* Items list */}
      <div className="space-y-2">
        {items.map((item, index) => (
          <BundleItemRow
            key={`${item.content_type}:${item.content_id}`}
            item={item}
            index={index}
            isFirst={index === 0}
            isLast={index === items.length - 1}
            isEditing={editingItemIndex === index}
            readOnly={readOnly}
            onEdit={() => setEditingItemIndex(editingItemIndex === index ? null : index)}
            onRemove={() => removeItem(index)}
            onMoveUp={() => moveItem(index, 'up')}
            onMoveDown={() => moveItem(index, 'down')}
            onRoleChange={(role) => updateItemRole(index, role)}
            onPriceChange={(price) => updateItemPrice(index, price)}
          />
        ))}
        
        {items.length === 0 && (
          <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-700 rounded-lg">
            <p className="text-sm">No items in bundle</p>
            <p className="text-xs mt-1">Add content items to build your offer</p>
          </div>
        )}
      </div>
      
      {/* Add item button */}
      {!readOnly && (
        <button
          onClick={() => setShowContentPicker(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-700 hover:border-gray-600 rounded-lg text-gray-400 hover:text-gray-300 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Content Item
        </button>
      )}
      
      {/* Content picker modal */}
      {showContentPicker && (
        <ContentPickerModal
          existingItems={items}
          onSelect={addItem}
          onClose={() => setShowContentPicker(false)}
        />
      )}
    </div>
  );
}

// Bundle Item Row
function BundleItemRow({
  item,
  index,
  isFirst,
  isLast,
  isEditing,
  readOnly,
  onEdit,
  onRemove,
  onMoveUp,
  onMoveDown,
  onRoleChange,
  onPriceChange,
}: {
  item: ResolvedBundleItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isEditing: boolean;
  readOnly: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRoleChange: (role: OfferRole) => void;
  onPriceChange: (price: number) => void;
}) {
  const [editPrice, setEditPrice] = useState(item.role_retail_price?.toString() || '');
  
  const handlePriceSave = () => {
    const price = parseFloat(editPrice);
    if (!isNaN(price) && price >= 0) {
      onPriceChange(price);
    }
  };
  
  return (
    <div className={`bg-gray-800 rounded-lg border ${item.has_overrides ? 'border-yellow-700' : 'border-gray-700'}`}>
      {/* Main row */}
      <div className="flex items-center gap-3 p-3">
        {/* Drag handle / Order controls */}
        {!readOnly && (
          <div className="flex flex-col gap-0.5">
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              className="p-1 text-gray-500 hover:text-gray-300 disabled:opacity-30"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={onMoveDown}
              disabled={isLast}
              className="p-1 text-gray-500 hover:text-gray-300 disabled:opacity-30"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        )}
        
        {/* Content info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">{CONTENT_TYPE_ICONS[item.content_type]}</span>
            <span className="font-medium text-white truncate">{item.title}</span>
            {item.has_overrides && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs bg-yellow-900/50 text-yellow-300 rounded">
                <AlertTriangle className="w-3 h-3" />
                modified
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {CONTENT_TYPE_LABELS[item.content_type]}
          </p>
        </div>
        
        {/* Role badge */}
        {item.offer_role && (
          <span className={`px-2 py-1 text-xs font-medium rounded ${OFFER_ROLE_COLORS[item.offer_role]}`}>
            {OFFER_ROLE_LABELS[item.offer_role]}
          </span>
        )}
        
        {/* Price */}
        <div className="text-right min-w-[80px]">
          <p className="text-sm font-medium text-white">
            ${(item.role_retail_price ?? item.price ?? 0).toFixed(2)}
          </p>
        </div>
        
        {/* Actions */}
        {!readOnly && (
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className={`p-2 rounded-lg transition-colors ${
                isEditing ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={onRemove}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      
      {/* Expanded edit panel */}
      {isEditing && !readOnly && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-700 space-y-4">
          {/* Role selector */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">
              Offer Role (bundle override)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['core_offer', 'bonus', 'upsell', 'downsell', 'anchor', 'decoy', 'lead_magnet', 'continuity'] as OfferRole[]).map((role) => (
                <button
                  key={role}
                  onClick={() => onRoleChange(role)}
                  className={`px-2 py-1.5 text-xs rounded-lg border transition-colors ${
                    item.offer_role === role
                      ? `${OFFER_ROLE_COLORS[role]} border-2`
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {OFFER_ROLE_LABELS[role]}
                </button>
              ))}
            </div>
            {item.original_role && item.offer_role !== item.original_role && (
              <p className="text-xs text-yellow-400 mt-2">
                Original role: {OFFER_ROLE_LABELS[item.original_role]}
              </p>
            )}
          </div>
          
          {/* Price override */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">
              Price Override
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  step="0.01"
                  min="0"
                  className="w-full pl-9 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
              <button
                onClick={handlePriceSave}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
              >
                Apply
              </button>
            </div>
            {item.original_price !== undefined && item.role_retail_price !== item.original_price && (
              <p className="text-xs text-yellow-400 mt-2">
                Original price: ${item.original_price.toFixed(2)}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Content Picker Modal
function ContentPickerModal({
  existingItems,
  onSelect,
  onClose,
}: {
  existingItems: ResolvedBundleItem[];
  onSelect: (content: ContentWithRole) => void;
  onClose: () => void;
}) {
  const [content, setContent] = useState<ContentWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentType | 'all'>('all');
  
  useEffect(() => {
    fetchContent();
  }, []);
  
  const fetchContent = async () => {
    const session = await getCurrentSession();
    if (!session?.access_token) return;
    
    try {
      const response = await fetch('/api/admin/sales/products', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch content');
      
      const data = await response.json();
      setContent(data.content || []);
    } catch (err) {
      console.error('Error fetching content:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Filter out already added items
  const existingKeys = new Set(existingItems.map(i => `${i.content_type}:${i.content_id}`));
  const availableContent = content.filter(c => !existingKeys.has(`${c.content_type}:${c.content_id}`));
  
  // Apply filters
  const filteredContent = availableContent.filter(c => {
    if (contentTypeFilter !== 'all' && c.content_type !== contentTypeFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return c.title.toLowerCase().includes(query) || c.description?.toLowerCase().includes(query);
    }
    return true;
  });
  
  // Group by content type
  const groupedContent = filteredContent.reduce((acc, c) => {
    const group = acc.get(c.content_type) || [];
    group.push(c);
    acc.set(c.content_type, group);
    return acc;
  }, new Map<ContentType, ContentWithRole[]>());
  
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold">Add Content to Bundle</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-800">
          <input
            type="text"
            placeholder="Search content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
          />
          <select
            value={contentTypeFilter}
            onChange={(e) => setContentTypeFilter(e.target.value as ContentType | 'all')}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
          >
            <option value="all">All Types</option>
            {(['product', 'project', 'video', 'publication', 'music', 'lead_magnet', 'prototype', 'service'] as ContentType[]).map(type => (
              <option key={type} value={type}>
                {CONTENT_TYPE_ICONS[type]} {CONTENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        
        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-400">Loading content...</div>
          ) : filteredContent.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>No available content found</p>
              <p className="text-xs mt-1">All content may already be in the bundle</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Array.from(groupedContent.entries()).map(([type, items]) => (
                <div key={type}>
                  <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                    <span>{CONTENT_TYPE_ICONS[type]}</span>
                    {CONTENT_TYPE_LABELS[type]} ({items.length})
                  </h4>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <button
                        key={`${item.content_type}:${item.content_id}`}
                        onClick={() => onSelect(item)}
                        className="w-full flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 rounded-lg text-left transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{item.title}</p>
                          {item.description && (
                            <p className="text-xs text-gray-400 truncate mt-0.5">{item.description}</p>
                          )}
                        </div>
                        {item.offer_role && (
                          <span className={`px-2 py-1 text-xs font-medium rounded ${OFFER_ROLE_COLORS[item.offer_role]}`}>
                            {OFFER_ROLE_LABELS[item.offer_role]}
                          </span>
                        )}
                        {item.price && (
                          <span className="text-sm text-gray-300">${item.price.toFixed(2)}</span>
                        )}
                        <Plus className="w-4 h-4 text-gray-400" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// BundleCustomizer - Lighter weight version for sales calls
export function BundleCustomizer({
  items,
  onItemsChange,
  onSaveAsBundle,
  sourceBundleName,
}: {
  items: ResolvedBundleItem[];
  onItemsChange: (items: ResolvedBundleItem[]) => void;
  onSaveAsBundle?: () => void;
  sourceBundleName?: string;
}) {
  return (
    <div className="space-y-4">
      {sourceBundleName && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">
            Based on: <span className="text-white">{sourceBundleName}</span>
          </span>
          {onSaveAsBundle && (
            <button
              onClick={onSaveAsBundle}
              className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-xs transition-colors"
            >
              <Save className="w-3 h-3" />
              Save as New Bundle
            </button>
          )}
        </div>
      )}
      
      <BundleEditor
        items={items}
        onItemsChange={onItemsChange}
      />
    </div>
  );
}
