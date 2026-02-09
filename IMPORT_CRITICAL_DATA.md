# 🚀 Import Critical Data - Simplified Guide

## ✅ What You Already Have

You've successfully exported the **3 most critical tables**:
- ✅ `discount_codes_data.sql` (3 promo codes)
- ✅ `orders_data.sql` (8 customer orders) 💰
- ✅ `order_items_data.sql` (8 purchase line items) 💰

**These contain your revenue data!** Let's import them now.

---

## 📊 What We're Skipping (Non-Critical)

- ⏭️ **analytics_events** (2648 rows) - Historical tracking, not needed for functionality
- ⏭️ **diagnostic_audits** (24 rows) - System logs, not needed for functionality

You can export these later if you really need them, but they're not required for your site to work.

---

## 🎯 Import Process (5 Minutes)

### ✅ STEP 1: Verify Tables Exist (30 seconds)

In your **CURRENT** database, run:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('discount_codes', 'orders', 'order_items')
ORDER BY table_name;
```

**Expected:** Should show 3 tables. If not, run `create_missing_store_tables.sql` first.

---

### ✅ STEP 2: Import Discount Codes (1 minute)

1. Open **`discount_codes_data.sql`** in Supabase SQL Editor
2. Click **Run**
3. Verify:
   ```sql
   SELECT COUNT(*) FROM discount_codes;
   ```
   **Expected:** 3 rows

---

### ✅ STEP 3: Import Orders (2 minutes) 💰

1. Open **`orders_data.sql`** in Supabase SQL Editor
2. Click **Run**
3. Verify:
   ```sql
   SELECT COUNT(*) FROM orders;
   ```
   **Expected:** 8 rows

4. **Check order details:**
   ```sql
   SELECT id, total_amount, final_amount, status, created_at::date 
   FROM orders 
   ORDER BY created_at DESC;
   ```
   You should see your 8 customer orders!

---

### ✅ STEP 4: Import Order Items (2 minutes) 💰

1. Open **`order_items_data.sql`** in Supabase SQL Editor
2. Click **Run**
3. Verify:
   ```sql
   SELECT COUNT(*) FROM order_items;
   ```
   **Expected:** 8 rows

4. **Check purchase details:**
   ```sql
   SELECT 
     oi.id,
     oi.order_id,
     oi.product_id,
     oi.quantity,
     oi.price_at_purchase,
     o.status as order_status
   FROM order_items oi
   JOIN orders o ON o.id = oi.order_id
   ORDER BY oi.id;
   ```
   You should see all 8 line items with their order associations!

---

## ✅ STEP 5: Final Verification

Run this comprehensive check:

```sql
-- Count all critical tables
SELECT 'discount_codes' as table_name, COUNT(*) as rows FROM discount_codes
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items;
```

**Expected Results:**
```
discount_codes: 3
orders:         8
order_items:    8
```

### Revenue Check 💰
```sql
SELECT 
  COUNT(*) as total_orders,
  SUM(final_amount) as total_revenue,
  AVG(final_amount) as avg_order_value
FROM orders
WHERE status = 'completed';
```

This shows your recovered customer purchase data!

---

## 🎉 You're Done!

**What you've restored:**
- ✅ 3 discount/promo codes
- ✅ 8 customer orders (revenue records!)
- ✅ 8 purchase line items (product details!)

**Total critical data recovered:** 19 rows of business-critical data

---

## 🔄 What About Analytics & Diagnostics?

Those tables (analytics_events and diagnostic_audits) have different schemas in your Feb 7th backup than expected. They're **not critical** for your site to function:

- **analytics_events**: Historical tracking data (nice to have, not essential)
- **diagnostic_audits**: System logs (for debugging, not user-facing)

**You can skip them safely!** Your site functionality and customer data are intact.

If you really want them later:
1. Run `check_analytics_schema.sql` in Feb 7th backup to see actual columns
2. Manually create export queries with correct column names
3. Import them

---

## 🚨 Troubleshooting

### "Foreign key violation" error
- Import **discount_codes** first
- Then **orders**
- Then **order_items**

### "Relation does not exist"
- Run `create_missing_store_tables.sql` in current database first

### "Duplicate key" error
- This is OK! `ON CONFLICT DO NOTHING` prevents duplicates
- Data already exists, no harm done

---

## 🎯 Next Steps

After importing, test your store:
- ✅ View order history page (if you have one)
- ✅ Test discount code application
- ✅ Check product purchase flow
- ✅ Verify customer order records are visible

**Your critical business data is now restored!** 💰✨
