# Print-on-Demand Merchandise Platform - Setup Guide

## Overview

A complete print-on-demand merchandise system integrated into your existing store using Printful API. Merchandise products appear alongside digital products with variant selection (sizes, colors), mockup images, and automated fulfillment.

## Setup Steps

### 1. Database Setup

Run the SQL schema in Supabase SQL Editor:
```sql
-- Execute: database_schema_merchandise.sql
```

This extends your existing tables:
- Adds merchandise fields to `products` table
- Creates `product_variants` table for size/color variants
- Extends `orders` table with fulfillment fields
- Extends `order_items` table with variant support
- Creates `printful_sync_log` table (optional)

### 2. Environment Variables

Add to your `.env.local`:
```env
PRINTFUL_API_KEY=your_printful_api_key
PRINTFUL_STORE_ID=your_store_id (optional)
PRINTFUL_WEBHOOK_SECRET=your_webhook_secret
AMADUTOWN_LOGO_URL=https://your-logo-url.com/logo.png
```

**Getting Printful Credentials:**
1. Sign up at [Printful](https://www.printful.com/)
2. Go to Dashboard → Stores → API
3. Generate API key
4. Copy API key to `PRINTFUL_API_KEY`
5. Find your Store ID in the URL when viewing your store (e.g., `https://www.printful.com/dashboard/stores/12345678` → Store ID is `12345678`)
6. Copy Store ID to `PRINTFUL_STORE_ID`

**Setting Up Webhooks (for real-time product sync):**
1. Go to Printful Dashboard → Settings → Stores → Your Store → Webhooks
2. Add webhook endpoint:
   - URL: `https://your-domain.com/api/webhooks/printful`
   - Select events:
     - `product_synced` - When you add/update a product in Printful
     - `product_updated` - When product details change
     - `product_deleted` - When you remove a product
     - `package_shipped` - When an order ships (optional)
     - `package_returned` - When a package is returned (optional)
3. Copy the webhook secret to `PRINTFUL_WEBHOOK_SECRET`
4. Deploy your site to Vercel (webhooks require a public URL)

**Note:** The webhook secret is used to verify that incoming requests are genuinely from Printful. Without it, anyone could send fake webhook requests to your endpoint.

### 3. Install Dependencies

No additional dependencies needed - uses native `fetch` for Printful API.

### 4. Logo Setup

Upload your AmaduTown logo to a publicly accessible URL (or Supabase Storage) and set `AMADUTOWN_LOGO_URL`. The logo will be used for mockup generation.

**Recommended:**
- PNG format with transparent background
- High resolution (at least 1000x1000px)
- Vector format (SVG) preferred

### 5. Sync Products from Printful

1. Go to Admin → Content → Merchandise
2. Enter your logo URL
3. Set default markup percentage (40-60% recommended)
4. Click "Sync Products from Printful"

This will:
- Fetch products from Printful catalog
- Create/update products in your database
- Generate variants (sizes, colors)
- Generate mockup images (if enabled)
- Calculate prices with markup

### 6. Configure Products

After syncing:
- Review products in Admin → Content → Merchandise
- Adjust markup percentages per product if needed
- Enable/disable products
- Products will appear in `/store` automatically

## Features

### Storefront (`/store`)
- Merchandise products appear alongside digital products
- Click merchandise to view details and select variants
- Category filtering (Apparel, Houseware, Travel, Office)

### Product Detail Page (`/store/[id]`)
- Variant selector (size/color)
- Mockup image gallery
- Real-time price updates
- Add to cart with variant selection
- Size chart (for apparel)

### Checkout Flow
- Shipping address collection for merchandise
- Real-time shipping calculation
- Free shipping threshold ($75)
- Automatic order submission to Printful after payment

### Order Fulfillment
- Orders automatically submitted to Printful after payment
- Webhook updates order status
- Tracking number integration
- Email notifications (to be implemented)

### Real-Time Product Sync
- Products automatically sync when you add/update them in Printful
- No need to manually click "Sync" after initial setup
- Webhooks handle: product creation, updates, and deletion
- Variants (sizes/colors) are synced automatically

### Admin Dashboard
- Product sync interface
- Markup configuration
- Enable/disable products
- Order management with Printful status

## API Endpoints

### Merchandise
- `POST /api/merchandise/sync` - Sync all products from Printful (admin, manual)
- `GET /api/products/[id]` - Get product with variants
- `POST /api/checkout/shipping` - Calculate shipping costs
- `POST /api/orders/fulfill` - Manually submit order to Printful (admin)

### Webhooks
- `POST /api/webhooks/printful` - Printful webhook handler for real-time sync
  - Handles `product_synced`, `product_updated`, `product_deleted` events
  - Automatically syncs individual products when changes occur in Printful
  - Verifies webhook signature using `PRINTFUL_WEBHOOK_SECRET`

## Business Logic

### Pricing
- Base cost from Printful + markup percentage
- Markup: 40-60% (configurable per product)
- Free shipping: Orders over $75
- Flat rate shipping: $7.99 (under $75)

### Order Processing
1. Customer adds merchandise to cart (with variant)
2. Checkout collects shipping address
3. Shipping calculated via Printful API
4. Payment processed via Stripe
5. On payment success → Automatically submitted to Printful
6. Printful webhook updates order status
7. Customer receives tracking info

### Inventory
- Real-time sync with Printful availability
- Variants marked unavailable if out of stock
- No backorders in MVP

## Testing

### Test Product Sync
1. Go to Admin → Content → Merchandise
2. Enter logo URL and click "Sync Products from Printful"
3. Verify products appear in list
4. Check variants are created

### Test Storefront
1. Go to `/store`
2. Filter by "Merchandise"
3. Click a merchandise product
4. Select size/color variant
5. Add to cart

### Test Checkout
1. Add merchandise to cart
2. Proceed to checkout
3. Enter shipping address
4. Verify shipping cost calculation
5. Complete payment (use Stripe test cards)
6. Verify order submitted to Printful

### Test Webhooks
1. Use Printful webhook testing tool
2. Send test `package_shipped` event
3. Verify order status updates in database

## Troubleshooting

### Products Not Syncing
- Check Printful API key is correct
- Verify API key has proper permissions
- Check browser console for errors
- Review sync status in admin panel

### Mockups Not Generating
- Verify logo URL is accessible
- Check logo format (PNG/SVG recommended)
- Review Printful API rate limits
- Check mockup generation logs

### Orders Not Appearing in Printful Dashboard
Orders are sent to Printful automatically when **Stripe** fires `payment_intent.succeeded` and the order has merchandise. If orders never show up:

1. **Environment**
   - Set `PRINTFUL_API_KEY` in Vercel (or your host) and redeploy. Without it, auto-fulfill fails silently and is only logged.
   - Optional: set `PRINTFUL_STORE_ID` if you use multiple Printful stores.

2. **Stripe webhook**
   - In Stripe Dashboard → Developers → Webhooks, ensure the endpoint receives **payment_intent.succeeded**.
   - After the next successful store payment, check your server logs (e.g. Vercel Functions) for `[Printful]` messages. You will see either:
     - `Order N automatically submitted to Printful: <id>` (success), or
     - A skip reason: `no shipping_address`, `no merchandise order items`, `no printful_variant_id`, or an error message if the Printful API call failed.

3. **Order data**
   - **Shipping address**: Checkout must send `shippingAddress` when creating the order so the order row has `shipping_address`. Otherwise auto-fulfill is skipped.
   - **Printful variant IDs**: Merchandise products must be synced from Printful (Admin → Content → Merchandise → Sync). Each order item must have `printful_variant_id` (from `product_variants`). If items were added before sync or variants aren’t linked, those items are skipped.

4. **Manual fulfill**
   - For orders that were skipped or failed, submit to Printful manually: `POST /api/orders/fulfill` with body `{ "orderId": <your-order-id> }` (admin auth required). Or use any admin UI that calls this endpoint.

### Orders Not Fulfilling (general)
- Verify shipping address is complete
- Check Printful variant IDs are correct
- Review order fulfillment logs and `[Printful]` server logs
- Manually submit via `POST /api/orders/fulfill` (admin) if auto-fulfill failed

### Webhooks Not Working
- Verify webhook URL is correct
- Check webhook secret matches
- Ensure webhook endpoint is publicly accessible
- Review webhook logs in Printful dashboard

## Next Steps

1. **Run database schema** (`database_schema_merchandise.sql`)
2. **Set environment variables**
3. **Upload logo** and set `AMADUTOWN_LOGO_URL`
4. **Sync products** from Printful
5. **Test the flow** end-to-end
6. **Configure webhooks** in Printful
7. **Customize markup** percentages
8. **Launch!**

## Support

For Printful API documentation:
- https://developers.printful.com/

For issues or questions:
- Check Printful API status
- Review webhook logs
- Check Supabase logs
- Review browser console errors
