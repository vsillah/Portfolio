// Printful API Client Library
// Documentation: https://developers.printful.com/

const PRINTFUL_API_BASE = 'https://api.printful.com'

export interface PrintfulProduct {
  id: number
  name: string
  type: string
  type_name: string
  brand: string
  model: string
  image: string
  variant_count: number
  currency: string
  files: any[]
  options: any[]
  dimensions: string
  size: string
  is_discontinued: boolean
  avg_fulfillment_time: number
}

export interface PrintfulVariant {
  id: number
  product_id: number
  name: string
  size: string
  color: string
  color_code: string
  availability_status: string
  availability_regions: string[]
  price: string
  currency: string
  files: any[]
  options: any[]
  is_discontinued: boolean
  is_enabled: boolean
}

export interface PrintfulShippingRate {
  id: string
  name: string
  rate: string
  currency: string
  minDeliveryDays: number
  maxDeliveryDays: number
}

export interface PrintfulOrder {
  id: number
  external_id: string
  shipping: string
  status: string
  created: number
  updated: number
  recipient: {
    name: string
    company?: string
    address1: string
    address2?: string
    city: string
    state_code: string
    country_code: string
    zip: string
    phone?: string
    email?: string
  }
  items: Array<{
    id: number
    external_id?: string
    variant_id: number
    quantity: number
    price: string
    retail_price?: string
    name: string
    product: {
      variant_id: number
      product_id: number
      image: string
      name: string
    }
  }>
  costs: {
    subtotal: string
    discount: string
    shipping: string
    tax: string
    total: string
  }
  retail_costs: {
    subtotal: string
    discount: string
    shipping: string
    tax: string
    total: string
  }
  shipments: Array<{
    id: number
    carrier: string
    service: string
    tracking_number: string
    tracking_url: string
    created: number
    ship_date?: string
    shipped_at?: number
    reshipment: boolean
  }>
}

/** Webhook configuration returned by Printful Webhook API (GET/POST /webhooks) */
export interface WebhookInfo {
  url: string
  types: string[]
  params?: Record<string, string>
}

export interface PrintfulMockupTask {
  task_key: string
  status: string
  mockups?: Array<{
    placement: string
    variant_ids: number[]
    mockup_url: string
    extra?: Array<{
      title: string
      option: string
      url: string
    }>
  }>
}

class PrintfulClient {
  private apiKey: string
  private storeId?: string

  constructor() {
    this.apiKey = process.env.PRINTFUL_API_KEY || ''
    this.storeId = process.env.PRINTFUL_STORE_ID

    if (!this.apiKey) {
      console.warn('PRINTFUL_API_KEY is not set')
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.apiKey) {
      throw new Error('Printful API key is not configured')
    }

    const url = `${PRINTFUL_API_BASE}${endpoint}`
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }
    
    // Add store ID header if configured
    if (this.storeId) {
      headers['X-PF-Store-Id'] = this.storeId
    }
    
    // Merge any additional headers
    Object.assign(headers, options.headers || {})

    console.log('[Printful] Requesting:', url)

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      const responseText = await response.text()
      console.log('[Printful] Response status:', response.status)
      console.log('[Printful] Response body:', responseText.substring(0, 500))

      if (!response.ok) {
        let error: any = { error: 'Unknown error' }
        try {
          error = JSON.parse(responseText)
        } catch {}
        throw new Error(error.result || error.message || error.error || `Printful API error: ${response.statusText}`)
      }

      const data = JSON.parse(responseText)
      return data.result !== undefined ? data.result : data
    } catch (error: any) {
      console.error('Printful API request failed:', error)
      throw error
    }
  }

  /**
   * Get all sync products from the store
   */
  async getProducts(): Promise<PrintfulProduct[]> {
    // /store/products returns the list of sync products in your store
    const response = await this.request<PrintfulProduct[]>('/store/products')
    return Array.isArray(response) ? response : []
  }

  /**
   * Get sync product details including variants
   */
  async getProductDetails(productId: number): Promise<{
    product: PrintfulProduct
    variants: PrintfulVariant[]
  }> {
    // /store/products/{id} returns { sync_product, sync_variants }
    const response = await this.request<{
      sync_product: any
      sync_variants: any[]
    }>(`/store/products/${productId}`)
    
    // Map sync_product to our interface
    const product: PrintfulProduct = {
      id: response.sync_product?.id || productId,
      name: response.sync_product?.name || '',
      type: response.sync_product?.type || '',
      type_name: response.sync_product?.type_name || '',
      brand: response.sync_product?.brand || '',
      model: response.sync_product?.model || '',
      image: response.sync_product?.thumbnail_url || '',
      variant_count: response.sync_variants?.length || 0,
      currency: 'USD',
      files: [],
      options: [],
      dimensions: '',
      size: '',
      is_discontinued: false,
      avg_fulfillment_time: 0,
    }
    
    // Map sync_variants to our interface
    const variants: PrintfulVariant[] = (response.sync_variants || []).map((v: any) => ({
      id: v.id,
      product_id: v.sync_product_id,
      name: v.name || '',
      size: v.size || '',
      color: v.color || '',
      color_code: v.color_code || '',
      availability_status: v.availability_status || 'in_stock',
      availability_regions: [],
      price: v.retail_price || '0',
      currency: v.currency || 'USD',
      files: v.files || [],
      options: v.options || [],
      is_discontinued: false,
      is_enabled: true,
    }))
    
    return { product, variants }
  }

  /**
   * Get variant details
   */
  async getVariantDetails(variantId: number): Promise<PrintfulVariant> {
    return this.request<PrintfulVariant>(`/store/variants/${variantId}`)
  }

  /**
   * Create a mockup generation task
   */
  async createMockupTask(
    variantIds: number[],
    placement: 'front' | 'back' | 'label_outside',
    fileUrl: string,
    width?: number,
    height?: number
  ): Promise<PrintfulMockupTask> {
    const body = {
      variant_ids: variantIds,
      format: 'png',
      width: width || 1000,
      height: height || 1000,
      product_option: {
        placement,
        files: [
          {
            url: fileUrl,
            type: 'default',
          },
        ],
      },
    }

    return this.request<PrintfulMockupTask>('/mockup-generator/create-task', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  /**
   * Get mockup task status and results
   */
  async getMockupTask(taskKey: string): Promise<PrintfulMockupTask> {
    return this.request<PrintfulMockupTask>(`/mockup-generator/task?task_key=${taskKey}`)
  }

  /**
   * Calculate shipping rates
   */
  async calculateShipping(
    recipient: {
      address1: string
      city: string
      state_code: string
      country_code: string
      zip: string
    },
    items: Array<{
      variant_id: number
      quantity: number
    }>
  ): Promise<PrintfulShippingRate[]> {
    const body = {
      recipient,
      items,
    }

    const response = await this.request<{ items: PrintfulShippingRate[] }>(
      '/shipping/rates',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    )

    return response.items || []
  }

  /**
   * Create an order in Printful
   */
  async createOrder(
    externalId: string,
    recipient: {
      name: string
      email: string
      phone?: string
      address1: string
      address2?: string
      city: string
      state_code: string
      country_code: string
      zip: string
    },
    items: Array<{
      variant_id: number
      quantity: number
      name?: string
      retail_price?: string
      files?: Array<{
        type: string
        url: string
      }>
    }>,
    retail_costs?: {
      subtotal?: string
      discount?: string
      shipping?: string
      tax?: string
    }
  ): Promise<PrintfulOrder> {
    const body: any = {
      external_id: externalId,
      recipient,
      items,
    }

    if (retail_costs) {
      body.retail_costs = retail_costs
    }

    return this.request<PrintfulOrder>('/orders', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  /**
   * Get order status
   */
  async getOrder(orderId: number): Promise<PrintfulOrder> {
    return this.request<PrintfulOrder>(`/orders/${orderId}`)
  }

  /**
   * Get order by external ID
   */
  async getOrderByExternalId(externalId: string): Promise<PrintfulOrder> {
    return this.request<PrintfulOrder>(`/orders/@${externalId}`)
  }

  /**
   * Cancel an order (if not yet fulfilled)
   */
  async cancelOrder(orderId: number): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/orders/${orderId}`, {
      method: 'DELETE',
    })
  }

  /**
   * Estimate order costs
   */
  async estimateOrder(
    items: Array<{
      variant_id: number
      quantity: number
    }>
  ): Promise<{
    costs: {
      subtotal: string
      discount: string
      shipping: string
      tax: string
      total: string
    }
  }> {
    const body = { items }

    return this.request('/orders/estimate-costs', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  /**
   * Get current webhook URL and event types (GET /webhooks).
   * Returns null if no webhook is configured or on 404/error.
   */
  async getWebhookConfig(): Promise<WebhookInfo | null> {
    try {
      const result = await this.request<WebhookInfo>('/webhooks', { method: 'GET' })
      if (result && typeof result.url === 'string') return result
      return null
    } catch {
      return null
    }
  }

  /**
   * Set webhook URL and event types (POST /webhooks). Replaces any existing config.
   */
  async setWebhookConfig(options: { url: string; types: string[] }): Promise<WebhookInfo> {
    return this.request<WebhookInfo>('/webhooks', {
      method: 'POST',
      body: JSON.stringify({ url: options.url, types: options.types }),
    })
  }

  /**
   * Remove webhook URL and all event types (DELETE /webhooks).
   */
  async deleteWebhookConfig(): Promise<void> {
    await this.request<unknown>('/webhooks', { method: 'DELETE' })
  }
}

// Export singleton instance
export const printful = new PrintfulClient()

// Helper function to calculate price with markup
export function calculatePriceWithMarkup(
  baseCost: number,
  markupPercentage: number
): number {
  return baseCost * (1 + markupPercentage / 100)
}

// Helper function to format Printful price string to number
export function parsePrintfulPrice(priceString: string): number {
  return parseFloat(priceString) || 0
}

// Helper function to map Printful product type to category
export function mapProductTypeToCategory(typeName: string): string {
  const lowerType = typeName.toLowerCase()
  
  if (lowerType.includes('shirt') || lowerType.includes('hoodie') || lowerType.includes('sweatshirt') || lowerType.includes('hat') || lowerType.includes('cap')) {
    return 'apparel'
  }
  
  if (lowerType.includes('mug') || lowerType.includes('bottle') || lowerType.includes('tumbler') || lowerType.includes('coaster')) {
    return 'houseware'
  }
  
  if (lowerType.includes('backpack') || lowerType.includes('bag') || lowerType.includes('duffel') || lowerType.includes('tote')) {
    return 'travel'
  }
  
  if (lowerType.includes('notebook') || lowerType.includes('journal') || lowerType.includes('sticker') || lowerType.includes('mousepad')) {
    return 'office'
  }
  
  return 'apparel'
}
