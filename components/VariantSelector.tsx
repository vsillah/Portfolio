'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
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

// Standard clothing size order from smallest to largest
const SIZE_ORDER: Record<string, number> = {
  'XS': 1,
  'S': 2,
  'M': 3,
  'L': 4,
  'XL': 5,
  '2XL': 6,
  'XXL': 6,
  '3XL': 7,
  'XXXL': 7,
  '4XL': 8,
  '5XL': 9,
}

// Sort sizes from small to large
const sortSizes = (sizes: string[]): string[] => {
  return sizes.sort((a, b) => {
    const orderA = SIZE_ORDER[a.toUpperCase()] ?? 100
    const orderB = SIZE_ORDER[b.toUpperCase()] ?? 100
    // If both have defined order, sort by order
    if (orderA !== 100 && orderB !== 100) {
      return orderA - orderB
    }
    // If only one has defined order, prioritize it
    if (orderA !== 100) return -1
    if (orderB !== 100) return 1
    // Otherwise sort alphabetically
    return a.localeCompare(b)
  })
}

interface VariantSelectorProps {
  variants: ProductVariant[]
  selectedVariant: ProductVariant | null
  onVariantChange: (variant: ProductVariant) => void
  showPrice?: boolean
}

export default function VariantSelector({
  variants,
  selectedVariant,
  onVariantChange,
  showPrice = true,
}: VariantSelectorProps) {
  const [availableSizes, setAvailableSizes] = useState<string[]>([])
  const [availableColors, setAvailableColors] = useState<string[]>([])
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(null)

  // Extract unique sizes and colors from variants
  useEffect(() => {
    const sizes = new Set<string>()
    const colors = new Set<string>()

    variants.forEach((variant) => {
      if (variant.size) {
        sizes.add(variant.size)
      }
      colors.add(variant.color)
    })

    setAvailableSizes(sortSizes(Array.from(sizes)))
    setAvailableColors(Array.from(colors))

    // Auto-select first available variant if none selected
    if (!selectedVariant && variants.length > 0) {
      const firstAvailable = variants.find((v) => v.is_available) || variants[0]
      if (firstAvailable) {
        onVariantChange(firstAvailable)
        setSelectedSize(firstAvailable.size)
        setSelectedColor(firstAvailable.color)
      }
    } else if (selectedVariant) {
      setSelectedSize(selectedVariant.size)
      setSelectedColor(selectedVariant.color)
    }
  }, [variants, selectedVariant, onVariantChange])

  // Find variant based on selected size and color
  const findVariant = (size: string | null, color: string) => {
    return variants.find(
      (v) => v.size === size && v.color === color && v.is_available
    )
  }

  const handleSizeChange = (size: string | null) => {
    setSelectedSize(size)
    const variant = findVariant(size, selectedColor || availableColors[0])
    if (variant) {
      onVariantChange(variant)
      setSelectedColor(variant.color)
    }
  }

  const handleColorChange = (color: string) => {
    setSelectedColor(color)
    const variant = findVariant(selectedSize, color)
    if (variant) {
      onVariantChange(variant)
    }
  }

  // Get available colors for selected size
  const getAvailableColorsForSize = (size: string | null) => {
    if (!size) return availableColors
    return variants
      .filter((v) => v.size === size && v.is_available)
      .map((v) => v.color)
      .filter((color, index, self) => self.indexOf(color) === index)
  }

  // Get available sizes for selected color
  const getAvailableSizesForColor = (color: string) => {
    const sizes = variants
      .filter((v) => v.color === color && v.is_available)
      .map((v) => v.size)
      .filter((size): size is string => size !== null)
      .filter((size, index, self) => self.indexOf(size) === index)
    return sortSizes(sizes)
  }

  const currentColors = selectedSize
    ? getAvailableColorsForSize(selectedSize)
    : availableColors
  const currentSizes = selectedColor
    ? getAvailableSizesForColor(selectedColor)
    : availableSizes

  return (
    <div className="space-y-6">
      {/* Size Selector */}
      {availableSizes.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Size
            {selectedVariant && selectedVariant.size && (
              <span className="ml-2 text-gray-500">({selectedVariant.size})</span>
            )}
          </label>
          <div className="flex flex-wrap gap-2">
            {currentSizes.map((size) => {
              const isSelected = selectedSize === size
              const isAvailable = variants.some(
                (v) => v.size === size && v.is_available
              )

              return (
                <motion.button
                  key={size}
                  onClick={() => handleSizeChange(size)}
                  disabled={!isAvailable}
                  whileHover={{ scale: isAvailable ? 1.05 : 1 }}
                  whileTap={{ scale: isAvailable ? 0.95 : 1 }}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    isSelected
                      ? 'bg-purple-600 text-white border-2 border-purple-400'
                      : isAvailable
                      ? 'bg-gray-800 text-gray-300 border-2 border-gray-700 hover:border-gray-600'
                      : 'bg-gray-900 text-gray-600 border-2 border-gray-800 cursor-not-allowed opacity-50'
                  }`}
                >
                  {size}
                  {isSelected && <Check className="inline-block ml-1" size={16} />}
                </motion.button>
              )
            })}
          </div>
        </div>
      )}

      {/* Color Selector */}
      {availableColors.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Color
            {selectedVariant && (
              <span className="ml-2 text-gray-500">({selectedVariant.color})</span>
            )}
          </label>
          <div className="flex flex-wrap gap-3">
            {currentColors.map((color) => {
              const isSelected = selectedColor === color
              const variant = findVariant(selectedSize, color)
              const isAvailable = variant?.is_available ?? false

              return (
                <motion.button
                  key={color}
                  onClick={() => handleColorChange(color)}
                  disabled={!isAvailable}
                  whileHover={{ scale: isAvailable ? 1.05 : 1 }}
                  whileTap={{ scale: isAvailable ? 0.95 : 1 }}
                  className={`relative px-4 py-2 rounded-lg font-medium transition-all border-2 ${
                    isSelected
                      ? 'bg-purple-600 text-white border-purple-400'
                      : isAvailable
                      ? 'bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-600'
                      : 'bg-gray-900 text-gray-600 border-gray-800 cursor-not-allowed opacity-50'
                  }`}
                  title={color}
                >
                  {color}
                  {isSelected && <Check className="inline-block ml-1" size={16} />}
                </motion.button>
              )
            })}
          </div>
        </div>
      )}

      {/* Price Display */}
      {showPrice && selectedVariant && (
        <div className="pt-4 border-t border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Price:</span>
            <span className="text-2xl font-bold text-green-400">
              {formatCurrency(selectedVariant.price)}
            </span>
          </div>
          {!selectedVariant.is_available && (
            <p className="text-sm text-red-400 mt-2">This variant is currently unavailable</p>
          )}
        </div>
      )}
    </div>
  )
}
