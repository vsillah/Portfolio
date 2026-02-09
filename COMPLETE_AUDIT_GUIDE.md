# Complete Database Audit Guide

## Goal
Compare ALL tables between your Feb 7th backup and current database to find any missing data.

---

## ⚡ RECOMMENDED METHOD (Supabase Compatible)

### Step 1: Run in Feb 7th Restored Database
1. Open `count_all_tables_supabase.sql` in Supabase SQL Editor
2. Click **Run**
3. Click the **"Messages"** tab (not Results tab)
4. You'll see a formatted table like:
   ```
   TABLE NAME                    | ROW COUNT
   ================================================
   app_prototypes                | 3
   music                         | 3
   orders                        | 15
   products                      | 10
   projects                      | 3
   ```
5. Copy ALL the messages output
6. Paste into a text file called `feb7_counts.txt`

### Step 2: Run in Current Database
1. Run the same `count_all_tables_supabase.sql`
2. Check the Messages tab
3. Copy the output
4. Save as `current_counts.txt`

### Step 3: Compare
- Open both text files side-by-side
- Compare row counts for each table
- Look for tables where Feb 7th has **higher counts** than current

**Example:**
```
Feb 7th:   orders: 15 rows
Current:   orders: 0 rows   ← DATA LOSS DETECTED!
```

---

## 🎯 EXACT COUNTS (If estimates aren't enough)

### Option A: Generate Queries Automatically

1. **Run `generate_count_queries.sql`** in Supabase SQL Editor
2. Copy the entire output
3. Paste into a new query window
4. **Remove the last `UNION ALL`** from the final line
5. Add a semicolon `;` at the end
6. Run the generated query

This will give you a single table with exact counts for ALL tables.

### Option B: Detailed Audit with Notifications

1. **Run `complete_table_audit.sql`** 
2. Look at the **Messages** tab (not Results)
3. You'll see output like:
   ```
   TABLE NAME                     | ROW COUNT
   ============================================
   app_prototypes                 | 3
   client_projects                | 0
   music                          | 3
   orders                         | 15
   products                       | 10
   projects                       | 3
   user_profiles                  | 1
   ```
4. Copy this output for both databases and compare

---

## 📊 What The Files Do

| File | Purpose | Speed | Accuracy |
|------|---------|-------|----------|
| `count_all_tables_supabase.sql` | **RECOMMENDED** - Exact counts in Messages tab | Fast | 100% |
| `all_tables_with_counts.sql` | Lists all table names only | Instant | N/A |
| `complete_table_audit.sql` | Alternative exact count method | Fast | 100% |
| `generate_count_queries.sql` | Generates SQL for exact counts | N/A | 100% |

---

## 🔍 What to Look For

### Critical Tables to Check:
- ✅ **orders** - Customer purchases (revenue data!)
- ✅ **order_items** - Line items from orders
- ✅ **client_projects** - Client work history
- ✅ **user_profiles** - User accounts
- ✅ **products** - Store inventory
- ✅ **discount_codes** - Promotional codes
- ✅ **downloads** - Digital product downloads
- ✅ **referrals** - Referral tracking

### Portfolio Content Tables:
- ✅ **projects** - Portfolio projects
- ✅ **music** - Music releases
- ✅ **videos** - Video content
- ✅ **publications** - Written work
- ✅ **app_prototypes** - App demos

### System Tables:
- analytics_events
- diagnostic_audits
- Any other tables that appear

---

## 🚨 If You Find Missing Data

### Scenario 1: Entire Table Missing
- The table exists in Feb 7th but not in current
- **Action**: Use the appropriate schema file to recreate it:
  - `database_schema_store.sql` for store tables
  - `database_schema_client_projects.sql` for client work
  - etc.

### Scenario 2: Table Exists But Fewer Rows
- Table exists in both but current has fewer rows
- **Action**: I'll create a targeted export/import script

### Scenario 3: Counts Match ✅
- Great! No data loss in that table

---

## 📝 Recording Your Findings

Create a simple comparison table:

| Table Name | Feb 7th Count | Current Count | Status |
|------------|---------------|---------------|--------|
| projects | 3 | 3 | ✅ OK |
| music | 3 | 3 | ✅ OK |
| orders | 15 | 0 | ❌ MISSING |
| products | 10 | 10 | ✅ OK |

---

## 💡 Pro Tips

1. **Use CSV export** - Much easier to compare than screenshots
2. **Sort alphabetically** - Makes side-by-side comparison easier
3. **Check table sizes too** - The "Total Size" column can reveal issues
4. **Don't panic on zero counts** - Some tables might legitimately be empty

---

## Next Steps

After you've identified any missing data:
1. Share which tables have differences
2. Share the row count differences
3. I'll create targeted recovery scripts for those specific tables

**Ready to start?** Run `all_tables_with_counts.sql` in both databases! 🚀
