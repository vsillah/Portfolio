# Lead Funnel Product Store - Setup Checklist

## ✅ Completed Setup Items

### 1. Code Implementation
- ✅ All API endpoints created
- ✅ All React components created
- ✅ Database schema SQL file created
- ✅ Storage setup documentation created
- ✅ Dependencies installed (Stripe packages)

### 2. File Structure
- ✅ `/app/store/page.tsx` - Storefront
- ✅ `/app/checkout/page.tsx` - Checkout flow
- ✅ `/app/checkout/payment/page.tsx` - Payment page
- ✅ `/app/purchases/page.tsx` - Purchase history
- ✅ `/app/admin/content/products/page.tsx` - Product management
- ✅ `/app/admin/content/discount-codes/page.tsx` - Discount code management
- ✅ All API routes in `/app/api/`
- ✅ All components in `/components/`
- ✅ Utility functions in `/lib/`

## 🔲 Required Setup Steps (To Complete)

### Database Setup
- [ ] Run `database_schema_store.sql` in Supabase SQL Editor
  - Creates 9 tables: products, cart_items, orders, order_items, discount_codes, user_discount_codes, downloads, social_shares, referrals
  - Sets up RLS policies
  - Creates triggers and functions

### Storage Setup
- [ ] Create `products` bucket in Supabase Storage
  - Set to **Private**
  - Run storage policies SQL from `PRODUCTS_STORAGE_SETUP.md`

### Environment Variables
- [ ] Add to `.env.local`:
  ```
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
  STRIPE_SECRET_KEY=sk_test_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  ```

### Stripe Configuration
- [ ] Get Stripe API keys from Stripe Dashboard
- [ ] Set up webhook endpoint:
  - URL: `https://your-domain.com/api/payments/webhook`
  - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`
  - Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

### Navigation (Optional)
- [ ] Add store link to navigation component:
  ```tsx
  <Link href="/store">Store</Link>
  ```

## 🧪 Testing Checklist

### Basic Functionality
- [ ] Create a product in admin panel
- [ ] View products on storefront
- [ ] Add product to cart
- [ ] View cart contents
- [ ] Proceed to checkout (guest)
- [ ] Proceed to checkout (authenticated)
- [ ] Apply discount code
- [ ] Complete free order
- [ ] Complete paid order (test mode)
- [ ] Download purchased product

### Admin Features
- [ ] Create/edit/delete products
- [ ] Upload product files
- [ ] Create/edit/delete discount codes
- [ ] View order history

### Advanced Features
- [ ] Exit intent popup triggers
- [ ] Scroll-based offer appears
- [ ] Time-based popup appears
- [ ] Social sharing works
- [ ] Referral code generation
- [ ] Referral code application

## 📋 Quick Verification Commands

```bash
# Check if dependencies are installed
npm list stripe @stripe/stripe-js @stripe/react-stripe-js

# Check if files exist
ls -la app/store/page.tsx
ls -la app/checkout/page.tsx
ls -la app/admin/content/products/page.tsx
ls -la database_schema_store.sql
```

## 🚨 Common Issues & Solutions

### Issue: "Stripe is not configured"
- **Solution**: Add `STRIPE_SECRET_KEY` to `.env.local`

### Issue: "Payment processing not available"
- **Solution**: Ensure Stripe keys are set and webhook is configured

### Issue: "Order not found" during checkout
- **Solution**: Verify database schema was run and `orders` table exists

### Issue: "Failed to generate download"
- **Solution**: 
  1. Verify `products` storage bucket exists
  2. Check storage policies are applied
  3. Verify order status is 'completed'

### Issue: Discount code not working
- **Solution**: 
  1. Check discount code is active in admin panel
  2. Verify code hasn't expired
  3. Check usage limits haven't been reached

## 📝 Next Steps After Setup

1. **Create Test Products**: Add a few products through admin panel
2. **Create Test Discount Code**: Create a test discount code
3. **Test Guest Checkout**: Complete a purchase as guest
4. **Test Authenticated Checkout**: Complete a purchase while logged in
5. **Test Payment**: Use Stripe test cards to verify payment flow
6. **Test Downloads**: Verify file downloads work after purchase

## 🎯 Production Checklist

Before going live:
- [ ] Switch to Stripe live keys
- [ ] Update webhook URL to production domain
- [ ] Test all payment flows with real cards (small amounts)
- [ ] Verify RLS policies are secure
- [ ] Set up monitoring/analytics
- [ ] Configure email notifications (optional)
- [ ] Set up backup strategy for database
