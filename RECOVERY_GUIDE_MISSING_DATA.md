# 🚨 DATA RECOVERY GUIDE - Missing Tables & Data

## Overview

You're missing **5 critical tables/datasets** from your Feb 7th backup:

| Priority | Table | Rows Lost | Impact |
|----------|-------|-----------|--------|
| 🔴 **CRITICAL** | orders | 8 | Customer purchase records |
| 🔴 **CRITICAL** | order_items | 8 | Order line items |
| 🟡 **HIGH** | discount_codes | 3 | Store promo codes |
| 🟡 **HIGH** | analytics_events | 2648 | Analytics tracking data |
| 🟢 **MEDIUM** | diagnostic_audits | 24 | System audit logs |

---

## 📋 Recovery Process (3 Steps)

### **STEP 1: Create Missing Tables in Current Database**

Run this in your **CURRENT** Supabase project:

**File:** `create_missing_store_tables.sql`

This will create:
- ✅ discount_codes table
- ✅ orders table
- ✅ order_items table
- ✅ downloads table (no data to restore, just structure)
- ✅ diagnostic_audits table
- ✅ referrals table (no data to restore, just structure)
- ✅ All indexes and RLS policies

**What to do:**
1. Open `create_missing_store_tables.sql` in Supabase SQL Editor (current project)
2. Click **Run**
3. Verify you see: "All missing store tables created successfully!"

---

### **STEP 2: Export Data from Feb 7th Backup**

Switch to your **FEB 7TH RESTORED** Supabase project.

**File:** `export_missing_data.sql`

This file contains **5 separate queries** - run them **ONE AT A TIME**:

#### Query 1: Export Orders (8 rows)
1. Highlight only Query 1 in `export_missing_data.sql`
2. Run it
3. Copy the entire INSERT statement from Results
4. Save as `orders_data.sql`

#### Query 2: Export Order Items (8 rows)
1. Highlight only Query 2
2. Run it
3. Copy the INSERT statement
4. Save as `order_items_data.sql`

#### Query 3: Export Discount Codes (3 rows)
1. Highlight only Query 3
2. Run it
3. Copy the INSERT statement
4. Save as `discount_codes_data.sql`

#### Query 4: Export Analytics Events (2648 rows) ⚠️ LARGE
1. Highlight only Query 4
2. Run it (may take 10-30 seconds)
3. Copy the INSERT statement
4. Save as `analytics_events_data.sql`

#### Query 5: Export Diagnostic Audits (24 rows)
1. Highlight only Query 5
2. Run it
3. Copy the INSERT statement
4. Save as `diagnostic_audits_data.sql`

---

### **STEP 3: Import Data into Current Database**

Switch back to your **CURRENT** Supabase project.

Import the data files **IN THIS ORDER** (dependencies matter!):

#### 3.1 Import Discount Codes FIRST
**File:** `discount_codes_data.sql`
- Open in SQL Editor
- Run the INSERT statement
- Verify: `SELECT COUNT(*) FROM discount_codes;` → should show 3

#### 3.2 Import Orders SECOND
**File:** `orders_data.sql`
- Open in SQL Editor
- Run the INSERT statement
- Verify: `SELECT COUNT(*) FROM orders;` → should show 8

#### 3.3 Import Order Items THIRD
**File:** `order_items_data.sql`
- Open in SQL Editor  
- Run the INSERT statement
- Verify: `SELECT COUNT(*) FROM order_items;` → should show 8

#### 3.4 Import Analytics Events
**File:** `analytics_events_data.sql`
- Open in SQL Editor
- Run the INSERT statement (may take 10-30 seconds)
- Verify: `SELECT COUNT(*) FROM analytics_events;` → should show 2648

#### 3.5 Import Diagnostic Audits
**File:** `diagnostic_audits_data.sql`
- Open in SQL Editor
- Run the INSERT statement
- Verify: `SELECT COUNT(*) FROM diagnostic_audits;` → should show 24

---

## ✅ Final Verification

Run this query in your **CURRENT** database to verify everything:

```sql
SELECT 'orders' as table_name, COUNT(*) as row_count FROM orders UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items UNION ALL
SELECT 'discount_codes', COUNT(*) FROM discount_codes UNION ALL
SELECT 'analytics_events', COUNT(*) FROM analytics_events UNION ALL
SELECT 'diagnostic_audits', COUNT(*) FROM diagnostic_audits;
```

**Expected results:**
```
orders:            8
order_items:       8
discount_codes:    3
analytics_events:  2648
diagnostic_audits: 24
```

---

## 🎯 What Gets Restored

### Business-Critical Data ✅
- **8 customer orders** with purchase history
- **8 order line items** with product details and pricing
- **3 discount/promo codes** for store operations

### Analytics & Monitoring ✅
- **2,648 analytics events** for tracking user behavior
- **24 diagnostic audit logs** for system monitoring

### Order Dependencies ✅
All foreign key relationships will be maintained:
- order_items → orders (via order_id)
- orders → discount_codes (via discount_code_id)
- orders → user_profiles (via user_id)

---

## 🚨 Important Notes

1. **Order matters!** Import in the sequence shown (Step 3) due to foreign key constraints

2. **ON CONFLICT DO NOTHING** - All INSERT statements use this clause, so:
   - Safe to run multiple times
   - Won't duplicate data
   - Won't error if data already exists

3. **Large analytics_events** - The 2648 row export may take 30 seconds to generate and import

4. **Backup first** - Consider creating a backup point of your current database before importing (optional but recommended)

---

## 📊 Post-Recovery Testing

After recovery, test your store functionality:

1. **Check orders page** - Verify you can see historical orders
2. **Test discount codes** - Try applying codes at checkout
3. **Review analytics** - Check if analytics data is visible
4. **Verify downloads** - Ensure download history is accessible

---

## 💡 Troubleshooting

### "Foreign key violation" error
- Import discount_codes BEFORE orders
- Import orders BEFORE order_items

### "Relation does not exist" error
- Run `create_missing_store_tables.sql` first in current database

### "Duplicate key" error
- This is OK! It means data already exists
- The `ON CONFLICT DO NOTHING` prevents duplicates

### Query too large / timeout
- For analytics_events, try importing in smaller batches
- Or skip if not critical for your immediate needs

---

## ✨ Ready to Start?

1. Open your **CURRENT** database
2. Run `create_missing_store_tables.sql`
3. Then move to **FEB 7TH** database
4. Run the export queries from `export_missing_data.sql`
5. Return to **CURRENT** database and import!

Good luck! 🚀
