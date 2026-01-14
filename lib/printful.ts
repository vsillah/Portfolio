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
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(error.message || `Printful API error: ${response.statusText}`)
      }

      const data = await response.json()
      return data.result || data
    } catch (error: any) {
      console.error('Printful API request failed:', error)
      throw error
    }
  }

  /**
   * Get all available products from Printful catalog
   */
  async getProducts(categoryId?: number): Promise<PrintfulProduct[]> {
    const endpoint = categoryId 
      ? `/store/products?category_id=${categoryId}`
      : '/store/products'
    
    const response = await this.request<{ items: PrintfulProduct[] }>(endpoint)
    return response.items || []
  }

  /**
   * Get product details including variants
   */
  async getProductDetails(productId: number): Promise<{
    product: PrintfulProduct
    variants: PrintfulVariant[]
  }> {
    const product = await this.request<PrintfulProduct>(`/store/products/${productId}`)
    const variants = await this.request<PrintfulVariant[]>(`/store/products/${productId}/variants`)
    
    return {
      product,
      variants: variants || [],
    }
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
