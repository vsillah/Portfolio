// Cart utilities for managing shopping cart state

export interface CartItem {
  productId?: number          // For products (optional now)
  serviceId?: string          // For services (UUID)
  quantity: number
  variantId?: number          // For merchandise variants
  printfulVariantId?: number  // Printful variant ID for fulfillment
  itemType: 'product' | 'service' // Discriminator field
}

const CART_STORAGE_KEY = 'cart'

// Helper to check if item is a product
export function isProductItem(item: CartItem): item is CartItem & { productId: number } {
  return item.itemType === 'product' && item.productId !== undefined
}

// Helper to check if item is a service
export function isServiceItem(item: CartItem): item is CartItem & { serviceId: string } {
  return item.itemType === 'service' && item.serviceId !== undefined
}

// Get cart from localStorage (normalizes legacy formats)
export function getCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  
  try {
    const cart = localStorage.getItem(CART_STORAGE_KEY)
    if (!cart) return []
    const parsed: unknown[] = JSON.parse(cart)
    if (!Array.isArray(parsed)) return []

    let needsSave = false
    const normalized: CartItem[] = parsed.map((entry): CartItem | null => {
      // Handle raw number entries (legacy store page format)
      if (typeof entry === 'number') {
        needsSave = true
        return { productId: entry, quantity: 1, itemType: 'product' }
      }
      if (typeof entry !== 'object' || entry === null) return null

      const item = entry as Record<string, unknown>

      // Backfill missing itemType based on which ID field is present
      if (!item.itemType) {
        needsSave = true
        if (item.productId !== undefined) {
          item.itemType = 'product'
        } else if (item.serviceId !== undefined) {
          item.itemType = 'service'
        } else {
          return null // unrecognizable entry — drop it
        }
      }
      return item as unknown as CartItem
    }).filter((item): item is CartItem => item !== null)

    // Persist the normalized cart so the fix is permanent
    if (needsSave) {
      saveCart(normalized)
    }

    return normalized
  } catch (e) {
    console.error('Error reading cart from localStorage:', e)
    return []
  }
}

// Save cart to localStorage
export function saveCart(cart: CartItem[]): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
  } catch (e) {
    console.error('Error saving cart to localStorage:', e)
  }
}

// Add product to cart
export function addToCart(
  productId: number,
  quantity: number = 1,
  variantId?: number,
  printfulVariantId?: number
): CartItem[] {
  const cart = getCart()
  // For merchandise with variants, check both productId and variantId
  const existingItem = cart.find(
    item =>
      item.itemType === 'product' &&
      item.productId === productId &&
      (variantId ? item.variantId === variantId : !item.variantId)
  )

  if (existingItem) {
    existingItem.quantity += quantity
  } else {
    cart.push({
      productId,
      quantity,
      itemType: 'product',
      ...(variantId && { variantId }),
      ...(printfulVariantId && { printfulVariantId }),
    })
  }

  saveCart(cart)
  return cart
}

// Add service to cart
export function addServiceToCart(
  serviceId: string,
  quantity: number = 1
): CartItem[] {
  const cart = getCart()
  const existingItem = cart.find(
    item => item.itemType === 'service' && item.serviceId === serviceId
  )

  if (existingItem) {
    existingItem.quantity += quantity
  } else {
    cart.push({
      serviceId,
      quantity,
      itemType: 'service',
    })
  }

  saveCart(cart)
  return cart
}

// Remove product from cart
export function removeFromCart(productId: number, variantId?: number): CartItem[] {
  const cart = getCart()
  const filtered = cart.filter(
    item =>
      !(item.itemType === 'product' && item.productId === productId && (variantId ? item.variantId === variantId : !item.variantId))
  )
  saveCart(filtered)
  return filtered
}

// Remove service from cart
export function removeServiceFromCart(serviceId: string): CartItem[] {
  const cart = getCart()
  const filtered = cart.filter(
    item => !(item.itemType === 'service' && item.serviceId === serviceId)
  )
  saveCart(filtered)
  return filtered
}

// Update product quantity
export function updateCartItemQuantity(
  productId: number,
  quantity: number,
  variantId?: number
): CartItem[] {
  if (quantity <= 0) {
    return removeFromCart(productId, variantId)
  }

  const cart = getCart()
  const item = cart.find(
    item =>
      item.itemType === 'product' &&
      item.productId === productId &&
      (variantId ? item.variantId === variantId : !item.variantId)
  )

  if (item) {
    item.quantity = quantity
  }

  saveCart(cart)
  return cart
}

// Update service quantity
export function updateServiceQuantity(
  serviceId: string,
  quantity: number
): CartItem[] {
  if (quantity <= 0) {
    return removeServiceFromCart(serviceId)
  }

  const cart = getCart()
  const item = cart.find(
    item => item.itemType === 'service' && item.serviceId === serviceId
  )

  if (item) {
    item.quantity = quantity
  }

  saveCart(cart)
  return cart
}

// Clear cart
export function clearCart(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(CART_STORAGE_KEY)
}

// Get cart count
export function getCartCount(): number {
  const cart = getCart()
  return cart.reduce((total, item) => total + item.quantity, 0)
}

// Get cart item count (unique products)
export function getCartItemCount(): number {
  return getCart().length
}
