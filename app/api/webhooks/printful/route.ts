import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { printful, parsePrintfulPrice, calculatePriceWithMarkup, mapProductTypeToCategory } from '@/lib/printful'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// Default markup percentage for synced products
const DEFAULT_MARKUP = 50

/**
 * Verify Printful webhook signature
 */
function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  const webhookSecret = process.env.PRINTFUL_WEBHOOK_SECRET
  
  // If no secret configured, skip verification (not recommended for production)
  if (!webhookSecret) {
    console.warn('[Printful Webhook] No PRINTFUL_WEBHOOK_SECRET configured, skipping signature verification')
    return true
  }
  
  if (!signature) {
    console.error('[Printful Webhook] No signature provided')
    return false
  }
  
  // Printful uses HMAC-SHA256
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('base64')
  
  return signature === expectedSignature
}

/**
 * Sync a single product from Printful
 */
async function syncProduct(printfulProductId: number): Promise<{ success: boolean; action: string }> {
  try {
    const { product, variants } = await printful.getProductDetails(printfulProductId)
    
    // Determine category from product type
    const productCategory = mapProductTypeToCategory(product.type_name || '')
    
    // Calculate base cost (use first variant's price as base)
    const baseCost = variants.length > 0
      ? parsePrintfulPrice(variants[0].price)
      : 0
    
    // Calculate retail price with markup
    const retailPrice = calculatePriceWithMarkup(baseCost, DEFAULT_MARKUP)
    
    // Check if product already exists
    const { data: existingProduct } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('printful_product_id', printfulProductId)
      .single()
    
    let productId: number
    let action: string
    
    if (existingProduct) {
      // Update existing product
      const { error: updateError } = await supabaseAdmin
        .from('products')
        .update({
          title: product.name,
          description: `${product.brand || ''} ${product.model || ''}`.trim() || product.name,
          type: 'merchandise',
          category: productCategory,
          base_cost: baseCost,
          markup_percentage: DEFAULT_MARKUP,
          price: retailPrice,
          is_print_on_demand: true,
          image_url: product.image,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingProduct.id)
      
      if (updateError) throw updateError
      productId = existingProduct.id
      action = 'updated'
    } else {
      // Create new product
      const { data: newProduct, error: insertError } = await supabaseAdmin
        .from('products')
        .insert({
          title: product.name,
          description: `${product.brand || ''} ${product.model || ''}`.trim() || product.name,
          type: 'merchandise',
          category: productCategory,
          printful_product_id: printfulProductId,
          base_cost: baseCost,
          markup_percentage: DEFAULT_MARKUP,
          price: retailPrice,
          is_print_on_demand: true,
          image_url: product.image,
          is_active: true,
        })
        .select('id')
        .single()
      
      if (insertError) throw insertError
      productId = newProduct.id
      action = 'created'
    }
    
    // Sync variants
    for (const variant of variants) {
      if (!variant.is_enabled || variant.is_discontinued) {
        continue
      }
      
      const variantPrice = calculatePriceWithMarkup(
        parsePrintfulPrice(variant.price),
        DEFAULT_MARKUP
      )
      
      // Check if variant exists
      const { data: existingVariant } = await supabaseAdmin
        .from('product_variants')
        .select('id')
        .eq('product_id', productId)
        .eq('printful_variant_id', variant.id)
        .single()
      
      const variantData = {
        product_id: productId,
        printful_variant_id: variant.id,
        size: variant.size || null,
        color: variant.color,
        color_code: variant.color_code || null,
        sku: variant.name || null,
        price: variantPrice,
        is_available: variant.is_enabled && !variant.is_discontinued,
      }
      
      if (existingVariant) {
        await supabaseAdmin
          .from('product_variants')
          .update(variantData)
          .eq('id', existingVariant.id)
      } else {
        await supabaseAdmin
          .from('product_variants')
          .insert({
            ...variantData,
            mockup_urls: [],
          })
      }
    }
    
    return { success: true, action }
  } catch (error: any) {
    console.error(`[Printful Webhook] Error syncing product ${printfulProductId}:`, error)
    throw error
  }
}

/**
 * Delete a product from the database
 */
async function deleteProduct(printfulProductId: number): Promise<{ success: boolean }> {
  try {
    // Find the product
    const { data: existingProduct } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('printful_product_id', printfulProductId)
      .single()
    
    if (!existingProduct) {
      console.log(`[Printful Webhook] Product ${printfulProductId} not found in database, nothing to delete`)
      return { success: true }
    }
    
    // Delete variants first (cascade should handle this, but being explicit)
    await supabaseAdmin
      .from('product_variants')
      .delete()
      .eq('product_id', existingProduct.id)
    
    // Delete the product (or mark as inactive)
    await supabaseAdmin
      .from('products')
      .update({ is_active: false })
      .eq('id', existingProduct.id)
    
    console.log(`[Printful Webhook] Deactivated product ${printfulProductId}`)
    return { success: true }
  } catch (error: any) {
    console.error(`[Printful Webhook] Error deleting product ${printfulProductId}:`, error)
    throw error
  }
}

/**
 * Handle Printful webhooks
 * POST /api/webhooks/printful
 * 
 * Printful sends webhooks for:
 * - product_synced: A product was synced (created or updated)
 * - product_updated: Product details were updated
 * - product_deleted: A product was deleted
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.text()
    const signature = request.headers.get('X-Printful-Signature')
    
    // Verify webhook signature
    if (!verifyWebhookSignature(payload, signature)) {
      console.error('[Printful Webhook] Invalid signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }
    
    // Parse the webhook payload
    let webhookData: any
    try {
      webhookData = JSON.parse(payload)
    } catch (e) {
      console.error('[Printful Webhook] Invalid JSON payload')
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      )
    }
    
    const { type, data } = webhookData
    
    console.log(`[Printful Webhook] Received event: ${type}`)
    
    // Handle different webhook event types
    switch (type) {
      case 'product_synced':
      case 'product_updated': {
        // data.sync_product contains the product info
        const printfulProductId = data?.sync_product?.id
        if (!printfulProductId) {
          console.error('[Printful Webhook] No product ID in webhook data')
          return NextResponse.json(
            { error: 'No product ID in webhook data' },
            { status: 400 }
          )
        }
        
        const result = await syncProduct(printfulProductId)
        console.log(`[Printful Webhook] Product ${printfulProductId} ${result.action}`)
        
        return NextResponse.json({
          success: true,
          action: result.action,
          productId: printfulProductId,
        })
      }
      
      case 'product_deleted': {
        const printfulProductId = data?.sync_product?.id
        if (!printfulProductId) {
          console.error('[Printful Webhook] No product ID in webhook data')
          return NextResponse.json(
            { error: 'No product ID in webhook data' },
            { status: 400 }
          )
        }
        
        await deleteProduct(printfulProductId)
        console.log(`[Printful Webhook] Product ${printfulProductId} deleted`)
        
        return NextResponse.json({
          success: true,
          action: 'deleted',
          productId: printfulProductId,
        })
      }
      
      // Handle other event types we might want to track
      case 'package_shipped':
      case 'package_returned': {
        // These are order-related events, log them but don't process
        console.log(`[Printful Webhook] Order event: ${type}`, data)
        return NextResponse.json({ success: true, message: 'Event logged' })
      }
      
      default: {
        // Unknown event type, acknowledge but don't process
        console.log(`[Printful Webhook] Unknown event type: ${type}`)
        return NextResponse.json({
          success: true,
          message: `Unknown event type: ${type}`,
        })
      }
    }
  } catch (error: any) {
    console.error('[Printful Webhook] Error processing webhook:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process webhook' },
      { status: 500 }
    )
  }
}

/**
 * Handle GET requests (for webhook verification)
 */
export async function GET(request: NextRequest) {
  // Printful may send a GET request to verify the endpoint exists
  return NextResponse.json({
    status: 'ok',
    message: 'Printful webhook endpoint is active',
  })
}
