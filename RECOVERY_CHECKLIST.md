# 📋 Data Recovery Checklist

Use this checklist to track your progress through the recovery process.

---

## ✅ STEP 1: Create Tables in Current Database

- [ ] Open **CURRENT** Supabase project
- [ ] Run `create_missing_store_tables.sql`
- [ ] Verify success message appears
- [ ] Verify tables created:
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name IN ('orders', 'order_items', 'discount_codes', 'diagnostic_audits', 'downloads', 'referrals')
  ORDER BY table_name;
  ```
  Should show 6 tables.

---

## ✅ STEP 2: Export Data from Feb 7th Backup

Switch to **FEB 7TH RESTORED** database:

- [ ] **Query 1: Orders**
  - Highlight Query 1 in `export_missing_data.sql`
  - Run query
  - Copy INSERT statement
  - Save as `orders_data.sql` ✓

- [ ] **Query 2: Order Items**
  - Highlight Query 2
  - Run query
  - Copy INSERT statement
  - Save as `order_items_data.sql` ✓

- [ ] **Query 3: Discount Codes**
  - Highlight Query 3
  - Run query
  - Copy INSERT statement
  - Save as `discount_codes_data.sql` ✓

- [ ] **Query 4: Analytics Events** (⚠️ Large - 2648 rows)
  - Highlight Query 4
  - Run query (wait 10-30 seconds)
  - Copy INSERT statement
  - Save as `analytics_events_data.sql` ✓

- [ ] **Query 5: Diagnostic Audits**
  - Highlight Query 5
  - Run query
  - Copy INSERT statement
  - Save as `diagnostic_audits_data.sql` ✓

---

## ✅ STEP 3: Import Data into Current Database

Switch back to **CURRENT** database:

### Import in this EXACT order:

- [ ] **3.1: Import Discount Codes**
  - Open `discount_codes_data.sql`
  - Run in SQL Editor
  - Verify: `SELECT COUNT(*) FROM discount_codes;` → **3 rows** ✓

- [ ] **3.2: Import Orders**
  - Open `orders_data.sql`
  - Run in SQL Editor
  - Verify: `SELECT COUNT(*) FROM orders;` → **8 rows** ✓

- [ ] **3.3: Import Order Items**
  - Open `order_items_data.sql`
  - Run in SQL Editor
  - Verify: `SELECT COUNT(*) FROM order_items;` → **8 rows** ✓

- [ ] **3.4: Import Analytics Events**
  - Open `analytics_events_data.sql`
  - Run in SQL Editor (wait 10-30 seconds)
  - Verify: `SELECT COUNT(*) FROM analytics_events;` → **2648 rows** ✓

- [ ] **3.5: Import Diagnostic Audits**
  - Open `diagnostic_audits_data.sql`
  - Run in SQL Editor
  - Verify: `SELECT COUNT(*) FROM diagnostic_audits;` → **24 rows** ✓

---

## ✅ STEP 4: Final Verification

Run this comprehensive check:

```sql
SELECT 'orders' as table_name, COUNT(*) as row_count FROM orders UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items UNION ALL
SELECT 'discount_codes', COUNT(*) FROM discount_codes UNION ALL
SELECT 'analytics_events', COUNT(*) FROM analytics_events UNION ALL
SELECT 'diagnostic_audits', COUNT(*) FROM diagnostic_audits;
```

- [ ] **Expected Results:**
  - orders: 8 ✓
  - order_items: 8 ✓
  - discount_codes: 3 ✓
  - analytics_events: 2648 ✓
  - diagnostic_audits: 24 ✓

---

## ✅ STEP 5: Application Testing

- [ ] Test store functionality
  - [ ] View products page
  - [ ] Test discount code application
  - [ ] Check order history (if applicable)

- [ ] Test analytics
  - [ ] Verify analytics dashboard (if you have one)
  - [ ] Check event tracking

- [ ] Check admin features
  - [ ] Order management
  - [ ] Discount code management
  - [ ] Analytics reports

---

## 🎉 Recovery Complete!

Once all checkboxes are ticked, your data recovery is complete!

**What was restored:**
- ✅ 8 customer orders
- ✅ 8 order line items
- ✅ 3 discount codes
- ✅ 2,648 analytics events
- ✅ 24 diagnostic audit logs

**Total records recovered:** 2,691 rows

---

## 📝 Notes / Issues

Use this space to track any errors or issues encountered:

```
[Add your notes here]




```

---

**Started:** _______________
**Completed:** _______________
**Time taken:** _______________
