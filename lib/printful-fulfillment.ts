export type PrintfulOrderItemRow = {
  product_variant_id: number | null
  printful_variant_id: string | null
  quantity: number
}

export type ProductVariantPrintfulRow = {
  id: number
  printful_sync_variant_id: number | null
}

export type PrintfulSubmissionItem =
  | { sync_variant_id: number; quantity: number }
  | { variant_id: number; quantity: number }

/**
 * Printful submission should be controlled by deployment tier first.
 * When NEXT_PUBLIC_APP_ENV is not set, fall back to Stripe livemode.
 */
export function shouldSkipPrintfulSubmission(
  appEnv: string | undefined,
  livemode: boolean
): boolean {
  return appEnv ? appEnv !== 'production' : !livemode
}

/**
 * Build Printful line items, preferring sync_variant_id when available.
 */
export function buildPrintfulSubmissionItems(
  orderItems: PrintfulOrderItemRow[],
  productVariantRows: ProductVariantPrintfulRow[]
): PrintfulSubmissionItem[] {
  const productVariantById = new Map<number, ProductVariantPrintfulRow>()
  for (const row of productVariantRows) {
    productVariantById.set(row.id, row)
  }

  return orderItems
    .filter((item) => item.printful_variant_id != null)
    .map((item) => {
      const variant = item.product_variant_id != null ? productVariantById.get(item.product_variant_id) : undefined
      if (variant?.printful_sync_variant_id) {
        return { sync_variant_id: Number(variant.printful_sync_variant_id), quantity: item.quantity }
      }
      return { variant_id: Number(item.printful_variant_id), quantity: item.quantity }
    })
}
