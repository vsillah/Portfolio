// Cart utilities for managing shopping cart state

export interface CartItem {
  productId: number
  quantity: number
  variantId?: number // For merchandise variants
  printfulVariantId?: number // Printful variant ID for fulfillment
}

const CART_STORAGE_KEY = 'cart'

// Get cart from localStorage
export function getCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  
  try {
    const cart = localStorage.getItem(CART_STORAGE_KEY)
    if (!cart) return []
    return JSON.parse(cart)
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

// Add item to cart
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
      item.productId === productId &&
      (variantId ? item.variantId === variantId : !item.variantId)
  )

  if (existingItem) {
    existingItem.quantity += quantity
  } else {
    cart.push({
      productId,
      quantity,
      ...(variantId && { variantId }),
      ...(printfulVariantId && { printfulVariantId }),
    })
  }

  saveCart(cart)
  return cart
}

// Remove item from cart
export function removeFromCart(productId: number, variantId?: number): CartItem[] {
  const cart = getCart()
  const filtered = cart.filter(
    item =>
      !(item.productId === productId && (variantId ? item.variantId === variantId : !item.variantId))
  )
  saveCart(filtered)
  return filtered
}

// Update item quantity
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
      item.productId === productId &&
      (variantId ? item.variantId === variantId : !item.variantId)
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
