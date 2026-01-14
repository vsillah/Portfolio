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
5. For webhooks, go to Settings → Webhooks and add endpoint:
   - URL: `https://your-domain.com/api/webhooks/printful`
   - Events: `package_shipped`, `package_returned`, `order_failed`
   - Copy webhook secret to `PRINTFUL_WEBHOOK_SECRET`

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

### Admin Dashboard
- Product sync interface
- Markup configuration
- Enable/disable products
- Order management with Printful status

## API Endpoints

### Merchandise
- `POST /api/merchandise/sync` - Sync products from Printful (admin)
- `GET /api/products/[id]` - Get product with variants
- `POST /api/checkout/shipping` - Calculate shipping costs
- `POST /api/orders/fulfill` - Manually submit order to Printful (admin)
- `POST /api/webhooks/printful` - Printful webhook handler

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

### Orders Not Fulfilling
- Verify shipping address is complete
- Check Printful variant IDs are correct
- Review order fulfillment logs
- Manually submit via Admin → Orders

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
