import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { printful, parsePrintfulPrice, calculatePriceWithMarkup } from '@/lib/printful'
import { batchGenerateMockups } from '@/lib/mockup-generator'

export const dynamic = 'force-dynamic'

/**
 * Sync products from Printful catalog
 * POST /api/merchandise/sync
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { user } = authResult

    const body = await request.json()
    const {
      productIds, // Optional: specific product IDs to sync
      category, // Optional: filter by category
      logoUrl, // Logo URL for mockup generation
      defaultMarkup = 50, // Default markup percentage
      generateMockups = true, // Whether to generate mockups
    } = body

    // Get products from Printful
    let printfulProducts
    if (productIds && Array.isArray(productIds) && productIds.length > 0) {
      // Sync specific products
      printfulProducts = await Promise.all(
        productIds.map(id => printful.getProductDetails(id))
      )
    } else {
      // Sync all products (or filter by category if provided)
      const allProducts = await printful.getProducts()
      printfulProducts = await Promise.all(
        allProducts.map(p => printful.getProductDetails(p.id))
      )
    }

    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[],
    }

    // Process each product
    for (const { product, variants } of printfulProducts) {
      try {
        // Determine category from product type
        const productCategory = mapProductTypeToCategory(product.type_name)

        // Calculate base cost (use first variant's price as base)
        const baseCost = variants.length > 0
          ? parsePrintfulPrice(variants[0].price)
          : 0

        // Check if product already exists
        const { data: existingProduct } = await supabaseAdmin
          .from('products')
          .select('id')
          .eq('printful_product_id', product.id)
          .single()

        let productId: number

        if (existingProduct) {
          // Update existing product
          const { error: updateError } = await supabaseAdmin
            .from('products')
            .update({
              title: product.name,
              description: `${product.brand} ${product.model}`,
              type: 'merchandise',
              category: productCategory,
              printful_product_id: product.id,
              base_cost: baseCost,
              markup_percentage: defaultMarkup,
              is_print_on_demand: true,
              image_url: product.image,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingProduct.id)

          if (updateError) throw updateError
          productId = existingProduct.id
          results.updated++
        } else {
          // Create new product
          const { data: newProduct, error: insertError } = await supabaseAdmin
            .from('products')
            .insert({
              title: product.name,
              description: `${product.brand} ${product.model}`,
              type: 'merchandise',
              category: productCategory,
              printful_product_id: product.id,
              base_cost: baseCost,
              markup_percentage: defaultMarkup,
              is_print_on_demand: true,
              image_url: product.image,
              is_active: true,
              created_by: user.id,
            })
            .select('id')
            .single()

          if (insertError) throw insertError
          productId = newProduct.id
          results.created++
        }

        // Sync variants
        const variantIds: number[] = []
        for (const variant of variants) {
          if (!variant.is_enabled || variant.is_discontinued) {
            continue
          }

          const variantPrice = calculatePriceWithMarkup(
            parsePrintfulPrice(variant.price),
            defaultMarkup
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
            is_available: variant.availability_status === 'in_stock',
          }

          if (existingVariant) {
            // Update existing variant
            await supabaseAdmin
              .from('product_variants')
              .update(variantData)
              .eq('id', existingVariant.id)
          } else {
            // Create new variant
            await supabaseAdmin
              .from('product_variants')
              .insert({
                ...variantData,
                mockup_urls: [],
              })
          }

          variantIds.push(variant.id)
        }

        // Generate mockups if requested and logo URL provided
        if (generateMockups && logoUrl && variantIds.length > 0) {
          try {
            const mockupResults = await batchGenerateMockups(
              variantIds.slice(0, 5), // Limit to first 5 variants to avoid rate limits
              logoUrl,
              ['front', 'back']
            )

            // Update variants with mockup URLs
            for (const [variantId, mockups] of Object.entries(mockupResults)) {
              const printfulVariantId = parseInt(variantId)
              const mockupUrls = Object.values(mockups)

              await supabaseAdmin
                .from('product_variants')
                .update({
                  mockup_urls: mockupUrls,
                })
                .eq('product_id', productId)
                .eq('printful_variant_id', printfulVariantId)
            }
          } catch (mockupError: any) {
            console.error('Mockup generation failed:', mockupError)
            // Don't fail the entire sync if mockups fail
          }
        }
      } catch (error: any) {
        console.error(`Error syncing product ${product.id}:`, error)
        results.errors.push(`Product ${product.id}: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (error: any) {
    console.error('Error syncing merchandise:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to sync merchandise' },
      { status: 500 }
    )
  }
}

/**
 * Map Printful product type to our category
 */
function mapProductTypeToCategory(typeName: string): string {
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

  // Default to apparel
  return 'apparel'
}
