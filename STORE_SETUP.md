# Lead Funnel Product Store - Setup Guide

## Overview

A complete lead generation and product store system has been implemented with:
- Product management (e-books, training, calculators, music, apps, merchandise)
- Shopping cart with persistence
- Checkout flow with guest/authenticated support
- Stripe payment integration
- Discount code system
- Exit intent optimization (mouse leave, scroll-based, time-based)
- Social sharing with rewards
- Referral program
- Secure download system
- Admin interfaces for products and discount codes

## Setup Steps

### 1. Database Setup

Run the SQL schema in Supabase SQL Editor:
```bash
# Execute: database_schema_store.sql
```

This creates all required tables:
- `products` - Product catalog
- `cart_items` - Shopping cart
- `orders` - Purchase records
- `order_items` - Items in orders
- `discount_codes` - Discount management
- `user_discount_codes` - Discount usage tracking
- `downloads` - Download tracking
- `social_shares` - Social sharing tracking
- `referrals` - Referral program tracking

### 2. Storage Bucket Setup

Create a Supabase Storage bucket for products:
1. Go to Supabase Dashboard → Storage
2. Create bucket named `products`
3. Set to **Private**
4. Add storage policies (similar to projects bucket)

### 3. Install Dependencies

```bash
npm install stripe @stripe/stripe-js @stripe/react-stripe-js
```

### 4. Environment Variables

Add to your `.env.local`:
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 5. Stripe Webhook Configuration

1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://your-domain.com/api/payments/webhook`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

### 6. Navigation Updates

Add store link to your navigation component:
```tsx
<Link href="/store">Store</Link>
```

## Features Implemented

### Storefront (`/store`)
- Product grid with filtering
- Search functionality
- Product type filtering
- Featured products
- Add to cart functionality

### Shopping Cart
- Persistent cart (localStorage + database)
- Quantity management
- Real-time updates
- Cart sidebar component

### Checkout Flow (`/checkout`)
- Guest checkout with contact form
- Authenticated user bypass
- Discount code application
- Order summary
- Exit intent popups (mouse leave, scroll, time-based)

### Payment (`/checkout/payment`)
- Stripe Elements integration
- Secure payment processing
- Payment status tracking

### Purchases (`/purchases`)
- Order history
- Download manager
- Social sharing
- Referral program

### Admin Interfaces

#### Products Management (`/admin/content/products`)
- Create/edit products
- File uploads
- Pricing management
- Product types
- Featured products

#### Discount Codes (`/admin/content/discount-codes`)
- Create/edit discount codes
- Percentage or fixed discounts
- Usage limits
- Expiration dates
- Product-specific codes

## API Endpoints

### Products
- `GET /api/products` - List products
- `POST /api/products` - Create product (admin)
- `GET /api/products/[id]` - Get product
- `PUT /api/products/[id]` - Update product (admin)
- `DELETE /api/products/[id]` - Delete product (admin)
- `POST /api/products/upload` - Upload product file (admin)

### Cart
- `GET /api/cart` - Get user cart
- `POST /api/cart` - Sync cart to database

### Checkout
- `POST /api/checkout` - Process checkout
- `POST /api/discount-codes/validate` - Validate discount code

### Payments
- `POST /api/payments/create-intent` - Create Stripe payment intent
- `POST /api/payments/webhook` - Stripe webhook handler

### Downloads
- `GET /api/downloads/[productId]` - Get download URL

### Orders
- `GET /api/orders` - List user orders
- `GET /api/orders/[id]` - Get order details

### Social Sharing
- `POST /api/social-share` - Track social share

### Referrals
- `GET /api/referrals` - Get user referrals
- `POST /api/referrals` - Create/validate referral
- `GET /api/referrals/code` - Get user referral code

### Discount Codes (Admin)
- `GET /api/discount-codes` - List codes
- `POST /api/discount-codes` - Create code
- `PUT /api/discount-codes/[id]` - Update code
- `DELETE /api/discount-codes/[id]` - Delete code

## Usage Notes

### Exit Intent Components
The checkout page includes three exit intent optimizations:
1. **ExitIntentPopup** - Triggers on mouse leave viewport
2. **ScrollOffer** - Shows at 60% scroll
3. **TimeBasedPopup** - Shows after 30 seconds

These can be customized or disabled as needed.

### Discount Codes
- Codes are case-insensitive
- Can be percentage or fixed amount
- Can apply to specific products or all products
- Usage limits and expiration dates supported

### Referral Program
- Each user gets a unique referral code
- Referrers earn discounts when referrals make purchases
- Referral codes can be shared via URL parameter: `?ref=CODE`

### Social Sharing
- Users can share purchases on Twitter, Facebook, LinkedIn
- Each share earns a discount for future purchases
- Shares are tracked in the database

## Testing

1. **Test Guest Checkout:**
   - Add items to cart
   - Proceed to checkout
   - Enter contact info
   - Apply discount code
   - Complete free order or proceed to payment

2. **Test Authenticated Checkout:**
   - Sign in
   - Add items to cart
   - Checkout (skips contact form)
   - Complete purchase

3. **Test Payment:**
   - Use Stripe test cards
   - Verify webhook handling
   - Check order status updates

4. **Test Downloads:**
   - Complete a purchase
   - Go to purchases page
   - Download products
   - Verify download tracking

## Security Considerations

- All file downloads require valid order verification
- Discount codes are validated server-side
- RLS policies protect all database tables
- Payment processing uses Stripe's secure API
- Guest orders require email verification (can be enhanced)

## Next Steps

1. Run database schema
2. Create storage bucket
3. Install dependencies
4. Configure Stripe
5. Test the flow
6. Customize exit intent offers
7. Set up referral rewards
8. Configure social sharing discounts
