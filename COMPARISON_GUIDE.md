# Database Comparison Guide - COMPLETE AUDIT

## Goal
Compare your restored backup (Feb 7th) with your current database to identify any missing tables or data across **ALL** tables.

---

## Option 1: Fast Estimates (RECOMMENDED - Takes 2 seconds)

**Use this for a quick overview of ALL tables**

### Step 1: Run in Restored Project (Feb 7th backup)
1. Open your **restored Supabase project** (the Feb 7th backup)
2. Go to **SQL Editor**
3. Open and run `quick_comparison.sql`
4. Copy the entire output
5. Save it in a text file called `feb7_comparison.txt`

### Step 2: Run in Current Project
1. Switch to your **current Supabase project**
2. Go to **SQL Editor**
3. Open and run the same `quick_comparison.sql`
4. Copy the entire output
5. Save it as `current_comparison.txt`

### Step 3: Compare Side-by-Side
Open both files and look for differences:

**Look for:**
- ✅ Tables that exist in Feb 7th but NOT in current
- ✅ Row counts that are higher in Feb 7th
- ✅ Any "TABLE NOT FOUND" messages in current that aren't in Feb 7th

**Example difference:**
```
Feb 7th:  orders: 15 rows
Current:  orders: 0 rows
          ^^^ DATA LOSS - need to restore orders
```

---

## Full Audit (If Quick Comparison Shows Differences)

If you find discrepancies, run the full audit for detailed analysis:

### Step 1: Run Full Audit in Both Projects
1. Run `database_audit.sql` in **restored project**
2. Save output as `feb7_full_audit.txt`
3. Run `database_audit.sql` in **current project**
4. Save output as `current_full_audit.txt`

### Step 2: Analyze Sections
The full audit includes:
- **TABLE INVENTORY**: All tables and row counts
- **TABLE SCHEMAS**: Column definitions for each table
- **RLS POLICIES**: Security policies
- **FOREIGN KEYS**: Relationships between tables
- **INDEXES**: Database indexes
- **KEY TABLE SAMPLES**: Detailed counts for portfolio/store tables
- **USER PROFILES**: User account summary
- **RECENT ACTIVITY**: Last update timestamps

---

## What to Do If You Find Missing Data

### If Entire Tables Are Missing
Use the schema files in this project:
- `database_schema_projects.sql`
- `database_schema_app_prototypes.sql`
- `database_schema_analytics.sql`
- `database_schema_videos_publications_music.sql`
- `database_schema_store.sql`
- `database_schema_client_projects.sql`

### If Tables Exist But Rows Are Missing
We'll need to create a new export script similar to the one we used for projects/music/products/prototypes.

**Example:** If you're missing orders:
1. Run this in the **restored project**:
   ```sql
   SELECT 'INSERT INTO orders (id, user_id, total, status, created_at) VALUES ' ||
   string_agg(
     '(' || 
     quote_literal(id::text) || ', ' ||
     quote_nullable(user_id::text) || ', ' ||
     quote_literal(total::text) || ', ' ||
     quote_literal(status) || ', ' ||
     quote_literal(created_at::text) ||
     ')',
     ', '
   ) || ' ON CONFLICT (id) DO NOTHING;' as sql
   FROM orders;
   ```
2. Copy the output
3. Run it in your **current project**

---

## Common Scenarios

### Scenario 1: Everything Matches ✅
- Great! Your recovery was complete
- No further action needed
- You can delete the comparison scripts

### Scenario 2: Row Counts Differ Slightly
- Check the "RECENT ACTIVITY" section timestamps
- If current shows newer timestamps, the difference might be legitimate new data
- Review carefully before overwriting

### Scenario 3: Missing Tables
- Use the schema SQL files to recreate them
- Then export/import data from restored project

### Scenario 4: Missing Rows in Existing Tables
- Create targeted export queries (see above)
- Import missing rows with `ON CONFLICT (id) DO NOTHING`

---

## Questions to Answer

After running the comparison, you should be able to answer:

1. ✅ Are there any tables in Feb 7th that don't exist in current?
2. ✅ Are there any tables with significantly fewer rows in current?
3. ✅ Do order counts, user profiles, and client_projects match expectations?
4. ✅ Are there any foreign key relationships missing?
5. ✅ Are RLS policies consistent between databases?

---

## Tips

- **Copy the entire output** from Supabase SQL Editor (not just visible rows)
- **Use a diff tool** like VS Code's compare feature for easier analysis
- **Focus on business-critical tables first**: orders, client_projects, user_profiles
- **Recent Activity timestamps** can help identify if data is truly missing or just newer

---

## Need Help?

If you find significant differences and need help creating recovery scripts, let me know:
- Which tables have missing data
- How many rows are missing
- Whether it's all rows or specific ones

I can create targeted export/import scripts for any missing data.
