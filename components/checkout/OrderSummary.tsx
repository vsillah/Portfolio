'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { DollarSign, Plus, Minus, Trash2, Edit2, X, Check, Clock, Users } from 'lucide-react'
import { formatCurrency } from '@/lib/pricing-model'

export interface ProductVariant {
  id: number
  product_id: number
  printful_variant_id: number
  size: string | null
  color: string
  color_code: string | null
  price: number
  is_available: boolean
  mockup_urls: string[]
}

interface Product {
  id: number
  title: string
  price: number | null
  image_url: string | null
  is_print_on_demand?: boolean
}

interface Service {
  id: string
  title: string
  description: string | null
  service_type: string
  delivery_method: string
  duration_description: string | null
  price: number | null
  is_quote_based: boolean
  image_url: string | null
}

interface CartItem {
  productId?: number
  serviceId?: string
  quantity: number
  variantId?: number
  printfulVariantId?: number
  itemType: 'product' | 'service'
}

interface OrderSummaryProps {
  cartItems: CartItem[]
  products: Record<number, Product>
  services?: Record<string, Service>
  variants?: Record<number, ProductVariant[]> // productId -> variants
  subtotal: number
  discountAmount: number
  finalTotal: number
  hasQuoteBasedItems?: boolean
  editable?: boolean
  onQuantityChange?: (productId: number, quantity: number, variantId?: number) => void
  onServiceQuantityChange?: (serviceId: string, quantity: number) => void
  onRemoveItem?: (productId: number, variantId?: number) => void
  onRemoveService?: (serviceId: string) => void
  onVariantChange?: (productId: number, oldVariantId: number | undefined, newVariantId: number, printfulVariantId: number) => void
}

// Standard clothing size order from smallest to largest
const SIZE_ORDER: Record<string, number> = {
  'XS': 1, 'S': 2, 'M': 3, 'L': 4, 'XL': 5,
  '2XL': 6, 'XXL': 6, '3XL': 7, 'XXXL': 7, '4XL': 8, '5XL': 9,
}

const sortSizes = (sizes: string[]): string[] => {
  return sizes.sort((a, b) => {
    const orderA = SIZE_ORDER[a.toUpperCase()] ?? 100
    const orderB = SIZE_ORDER[b.toUpperCase()] ?? 100
    if (orderA !== 100 && orderB !== 100) return orderA - orderB
    if (orderA !== 100) return -1
    if (orderB !== 100) return 1
    return a.localeCompare(b)
  })
}

export default function OrderSummary({
  cartItems,
  products,
  services = {},
  variants = {},
  subtotal,
  discountAmount,
  finalTotal,
  hasQuoteBasedItems = false,
  editable = false,
  onQuantityChange,
  onServiceQuantityChange,
  onRemoveItem,
  onRemoveService,
  onVariantChange,
}: OrderSummaryProps) {
  const hasPaidItems = subtotal > 0
  const [editingItem, setEditingItem] = useState<{ productId: number; variantId?: number } | null>(null)

  const getItemPrice = (item: CartItem): number | null => {
    if (item.itemType === 'service' && item.serviceId) {
      const service = services[item.serviceId]
      if (!service || service.is_quote_based) return null
      return service.price
    }

    if (item.itemType === 'product' && item.productId) {
      const product = products[item.productId]
      if (!product) return null

      // For merchandise with variants, get variant price
      if (item.variantId && variants[item.productId]) {
        const variant = variants[item.productId].find(v => v.id === item.variantId)
        if (variant) return variant.price
      }

      return product.price
    }

    return null
  }

  const getItemVariant = (item: CartItem): ProductVariant | null => {
    if (!item.productId || !item.variantId || !variants[item.productId]) return null
    return variants[item.productId].find(v => v.id === item.variantId) || null
  }

  const getUniqueKey = (item: CartItem): string => {
    if (item.itemType === 'service' && item.serviceId) {
      return `service-${item.serviceId}`
    }
    return `product-${item.productId}-${item.variantId || 'no-variant'}`
  }

  return (
    <div className="bg-silicon-slate border border-silicon-slate rounded-xl p-6">
      <h2 className="text-xl font-bold mb-4">Order Summary</h2>

      {/* Items */}
      <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
        {cartItems.map((item) => {
          // Render service item
          if (item.itemType === 'service' && item.serviceId) {
            const service = services[item.serviceId]
            if (!service) return null

            const price = service.is_quote_based ? null : service.price

            return (
              <motion.div
                key={getUniqueKey(item)}
                layout
                className="bg-silicon-slate/50 rounded-lg p-3"
              >
                <div className="flex items-start gap-3">
                  {/* Service Image */}
                  <div className="w-14 h-14 bg-gradient-to-br from-bronze/20 to-radiant-gold/20 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden relative">
                    {service.image_url ? (
                      <Image
                        src={service.image_url}
                        alt={service.title}
                        fill
                        className="object-cover"
                        sizes="56px"
                        unoptimized
                      />
                    ) : (
                      <Users className="text-platinum-white/60" size={20} />
                    )}
                  </div>

                  {/* Service Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium text-sm line-clamp-1">{service.title}</p>
                      <span className="px-1.5 py-0.5 text-[10px] bg-radiant-gold/20 text-radiant-gold rounded">
                        Service
                      </span>
                    </div>
                    
                    {/* Duration info */}
                    {service.duration_description && (
                      <p className="text-xs text-platinum-white/80 mt-0.5 flex items-center gap-1">
                        <Clock size={10} />
                        {service.duration_description}
                      </p>
                    )}

                    {/* Price per item */}
                    <p className="text-xs text-platinum-white/70 mt-1">
                      {service.is_quote_based 
                        ? 'Contact for Pricing' 
                        : price !== null 
                          ? `${formatCurrency(price)} each` 
                          : 'Free'}
                    </p>

                    {/* Quantity and Actions */}
                    {editable ? (
                      <div className="flex items-center gap-2 mt-2">
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-1 bg-silicon-slate rounded">
                          <button
                            onClick={() => onServiceQuantityChange?.(item.serviceId!, Math.max(1, item.quantity - 1))}
                            className="p-1 hover:bg-radiant-gold/30 rounded-l transition-colors"
                            title="Decrease quantity"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-xs text-white w-6 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => onServiceQuantityChange?.(item.serviceId!, item.quantity + 1)}
                            className="p-1 hover:bg-radiant-gold/30 rounded-r transition-colors"
                            title="Increase quantity"
                          >
                            <Plus size={12} />
                          </button>
                        </div>

                        {/* Delete Button */}
                        <button
                          onClick={() => onRemoveService?.(item.serviceId!)}
                          className="p-1.5 bg-silicon-slate hover:bg-red-600/20 text-platinum-white/80 hover:text-red-400 rounded transition-colors ml-auto"
                          title="Remove item"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-platinum-white/80 mt-1">Qty: {item.quantity}</p>
                    )}
                  </div>

                  {/* Item Total */}
                  <div className="text-white font-semibold text-sm">
                    {service.is_quote_based
                      ? 'Quote'
                      : price !== null
                        ? formatCurrency(price * item.quantity)
                        : 'Free'}
                  </div>
                </div>
              </motion.div>
            )
          }

          // Render product item
          if (item.itemType === 'product' && item.productId) {
            const product = products[item.productId]
            if (!product) return null

            const price = getItemPrice(item)
            const variant = getItemVariant(item)
            const productVariants = variants[item.productId] || []
            const isEditing = editingItem?.productId === item.productId && editingItem?.variantId === item.variantId
            const hasVariants = productVariants.length > 0

            return (
              <motion.div
                key={getUniqueKey(item)}
                layout
                className="bg-silicon-slate/50 rounded-lg p-3"
              >
                <div className="flex items-start gap-3">
                  {/* Product Image */}
                  <div className="w-14 h-14 bg-gradient-to-br from-bronze/20 to-radiant-gold/20 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden relative">
                    {product.image_url ? (
                      <Image
                        src={product.image_url}
                        alt={product.title}
                        fill
                        className="object-cover"
                        sizes="56px"
                        unoptimized
                      />
                    ) : (
                      <DollarSign className="text-platinum-white/60" size={20} />
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm line-clamp-1">{product.title}</p>
                    
                    {/* Variant info */}
                    {variant && (
                      <p className="text-xs text-platinum-white/80 mt-0.5">
                        {variant.size && <span>{variant.size}</span>}
                        {variant.size && variant.color && <span> / </span>}
                        {variant.color && <span>{variant.color}</span>}
                      </p>
                    )}

                    {/* Price per item */}
                    <p className="text-xs text-platinum-white/70 mt-1">
                      {price !== null ? `${formatCurrency(price)} each` : 'Free'}
                    </p>

                    {/* Quantity and Actions */}
                    {editable ? (
                      <div className="flex items-center gap-2 mt-2">
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-1 bg-silicon-slate rounded">
                          <button
                            onClick={() => onQuantityChange?.(item.productId!, Math.max(1, item.quantity - 1), item.variantId)}
                            className="p-1 hover:bg-radiant-gold/30 rounded-l transition-colors"
                            title="Decrease quantity"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-xs text-white w-6 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => onQuantityChange?.(item.productId!, item.quantity + 1, item.variantId)}
                            className="p-1 hover:bg-radiant-gold/30 rounded-r transition-colors"
                            title="Increase quantity"
                          >
                            <Plus size={12} />
                          </button>
                        </div>

                        {/* Edit Variant Button */}
                        {hasVariants && (
                          <button
                            onClick={() => setEditingItem(isEditing ? null : { productId: item.productId!, variantId: item.variantId })}
                            className={`p-1.5 rounded transition-colors ${
                              isEditing ? 'bg-radiant-gold text-imperial-navy' : 'bg-silicon-slate hover:bg-radiant-gold/30 text-platinum-white'
                            }`}
                            title="Edit size/color"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}

                        {/* Delete Button */}
                        <button
                          onClick={() => onRemoveItem?.(item.productId!, item.variantId)}
                          className="p-1.5 bg-silicon-slate hover:bg-red-600/20 text-platinum-white/80 hover:text-red-400 rounded transition-colors ml-auto"
                          title="Remove item"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-platinum-white/80 mt-1">Qty: {item.quantity}</p>
                    )}
                  </div>

                  {/* Item Total */}
                  <div className="text-white font-semibold text-sm">
                    {price !== null
                      ? formatCurrency(price * item.quantity)
                      : 'Free'}
                  </div>
                </div>

                {/* Variant Editor */}
                <AnimatePresence>
                  {isEditing && hasVariants && (
                    <VariantEditor
                      variants={productVariants}
                      currentVariantId={item.variantId}
                      onSelect={(newVariant) => {
                        onVariantChange?.(item.productId!, item.variantId, newVariant.id, newVariant.printful_variant_id)
                        setEditingItem(null)
                      }}
                      onClose={() => setEditingItem(null)}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            )
          }

          return null
        })}
      </div>

      {/* Totals */}
      <div className="border-t border-silicon-slate pt-4 space-y-2">
        {hasQuoteBasedItems && (
          <div className="p-2 bg-yellow-600/10 border border-yellow-600/30 rounded text-xs text-yellow-400 mb-2">
            Some items require a custom quote
          </div>
        )}
        <div className="flex justify-between text-platinum-white/80">
          <span>Subtotal</span>
          <span>{hasPaidItems ? formatCurrency(subtotal) : 'Free'}</span>
        </div>
        {discountAmount > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex justify-between text-radiant-gold"
          >
            <span>Discount</span>
            <span>-{formatCurrency(discountAmount)}</span>
          </motion.div>
        )}
        <div className="flex justify-between text-xl font-bold text-foreground pt-2 border-t border-silicon-slate">
          <span>Total</span>
          <span>
            {hasQuoteBasedItems 
              ? `${formatCurrency(finalTotal)}+`
              : hasPaidItems 
                ? formatCurrency(finalTotal) 
                : 'Free'}
          </span>
        </div>
      </div>
    </div>
  )
}

// Inline Variant Editor Component
function VariantEditor({
  variants,
  currentVariantId,
  onSelect,
  onClose,
}: {
  variants: ProductVariant[]
  currentVariantId?: number
  onSelect: (variant: ProductVariant) => void
  onClose: () => void
}) {
  const [selectedSize, setSelectedSize] = useState<string | null>(() => {
    const current = variants.find(v => v.id === currentVariantId)
    return current?.size || null
  })
  const [selectedColor, setSelectedColor] = useState<string | null>(() => {
    const current = variants.find(v => v.id === currentVariantId)
    return current?.color || null
  })

  // Extract unique sizes and colors
  const allSizes = [...new Set(variants.filter(v => v.size).map(v => v.size!))]
  const allColors = [...new Set(variants.map(v => v.color))]
  const sortedSizes = sortSizes(allSizes)

  // Get available options based on selection
  const availableColorsForSize = selectedSize
    ? [...new Set(variants.filter(v => v.size === selectedSize && v.is_available).map(v => v.color))]
    : allColors

  const availableSizesForColor = selectedColor
    ? sortSizes([...new Set(variants.filter(v => v.color === selectedColor && v.is_available).map(v => v.size!).filter(Boolean))])
    : sortedSizes

  // Find matching variant
  const selectedVariant = variants.find(
    v => v.size === selectedSize && v.color === selectedColor && v.is_available
  )

  const handleSizeChange = (size: string) => {
    setSelectedSize(size)
    // Auto-select first available color for this size if current color is not available
    if (!availableColorsForSize.includes(selectedColor || '')) {
      const firstAvailableColor = variants.find(v => v.size === size && v.is_available)?.color
      if (firstAvailableColor) setSelectedColor(firstAvailableColor)
    }
  }

  const handleColorChange = (color: string) => {
    setSelectedColor(color)
    // Auto-select first available size for this color if current size is not available
    if (sortedSizes.length > 0 && !availableSizesForColor.includes(selectedSize || '')) {
      const firstAvailableSize = variants.find(v => v.color === color && v.is_available)?.size
      if (firstAvailableSize) setSelectedSize(firstAvailableSize)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-3 pt-3 border-t border-silicon-slate"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-platinum-white/80">Edit Options</span>
        <button
          onClick={onClose}
          className="p-1 hover:bg-silicon-slate rounded transition-colors"
        >
          <X size={14} className="text-platinum-white/80" />
        </button>
      </div>

      {/* Size Selection */}
      {sortedSizes.length > 0 && (
        <div className="mb-3">
          <label className="text-xs text-platinum-white/70 mb-1.5 block">Size</label>
          <div className="flex flex-wrap gap-1.5">
            {availableSizesForColor.map((size) => {
              const isSelected = selectedSize === size
              const isAvailable = variants.some(v => v.size === size && v.is_available)
              
              return (
                <button
                  key={size}
                  onClick={() => handleSizeChange(size)}
                  disabled={!isAvailable}
                  className={`px-2.5 py-1 text-xs rounded transition-all ${
                    isSelected
                      ? 'bg-radiant-gold text-imperial-navy'
                      : isAvailable
                      ? 'bg-silicon-slate text-platinum-white hover:bg-radiant-gold/30'
                      : 'bg-silicon-slate text-platinum-white/60 cursor-not-allowed'
                  }`}
                >
                  {size}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Color Selection */}
      {allColors.length > 0 && (
        <div className="mb-3">
          <label className="text-xs text-platinum-white/70 mb-1.5 block">Color</label>
          <div className="flex flex-wrap gap-1.5">
            {availableColorsForSize.map((color) => {
              const isSelected = selectedColor === color
              const isAvailable = variants.some(v => v.color === color && v.is_available)
              
              return (
                <button
                  key={color}
                  onClick={() => handleColorChange(color)}
                  disabled={!isAvailable}
                  className={`px-2.5 py-1 text-xs rounded transition-all ${
                    isSelected
                      ? 'bg-radiant-gold text-imperial-navy'
                      : isAvailable
                      ? 'bg-silicon-slate text-platinum-white hover:bg-radiant-gold/30'
                      : 'bg-silicon-slate text-platinum-white/60 cursor-not-allowed'
                  }`}
                >
                  {color}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Apply Button */}
      <button
        onClick={() => selectedVariant && onSelect(selectedVariant)}
        disabled={!selectedVariant || selectedVariant.id === currentVariantId}
        className={`w-full py-2 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5 ${
          selectedVariant && selectedVariant.id !== currentVariantId
            ? 'btn-gold'
            : 'bg-silicon-slate text-platinum-white/70 cursor-not-allowed'
        }`}
      >
        <Check size={14} />
        {selectedVariant && selectedVariant.id !== currentVariantId
          ? `Update to ${selectedVariant.size ? selectedVariant.size + ' / ' : ''}${selectedVariant.color} - ${formatCurrency(selectedVariant.price)}`
          : 'Select different options'}
      </button>
    </motion.div>
  )
}
