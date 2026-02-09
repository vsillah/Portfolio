# 🔍 Database Monitoring System

## Overview

This monitoring system prevents data loss by tracking database table row counts and alerting when data unexpectedly disappears.

**What it does:**
- ✅ Tracks row counts for all critical tables
- ✅ Compares current state against a baseline
- ✅ Blocks git pushes if data loss is detected
- ✅ Runs automated daily checks
- ✅ Sends alerts on critical issues

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

This will install:
- `tsx` - TypeScript execution
- `husky` - Git hooks

### 2. Initialize Husky

```bash
npm run prepare
```

This enables the pre-push git hook.

### 3. Create Initial Baseline

```bash
npm run db:health-check
```

This creates `.database-baseline.json` with current row counts.

**You're all set!** The system will now automatically check before every push.

---

## 📋 How It Works

### Automatic Checks

**1. Pre-Push Git Hook**
- Runs automatically before `git push`
- Compares current database state with baseline
- **Blocks push** if critical data loss detected
- Can be bypassed with `git push --no-verify` (not recommended!)

**2. GitHub Actions (Daily)**
- Runs every day at 9 AM UTC
- Checks database health
- Sends alerts if issues found
- Stores baseline in GitHub artifacts

**3. GitHub Actions (On Push)**
- Runs on every push to `main` or `production`
- Double-checks database state
- Blocks deployment if critical issues found

### Manual Checks

```bash
# Check database health
npm run db:health-check

# Update baseline (after intentional changes)
npm run db:health-check:update
```

---

## 🎯 What Gets Monitored

### Critical Tables
- `projects` - Portfolio projects
- `music` - Music releases
- `videos` - Video content
- `publications` - Publications
- `products` - Store products
- `app_prototypes` - App prototypes
- `orders` - **Customer orders (REVENUE!)**
- `order_items` - **Order details (REVENUE!)**
- `discount_codes` - Promo codes
- `user_profiles` - User accounts
- `client_projects` - Client work

### Alert Levels

**🚨 CRITICAL (Blocks Deployment)**
- Table completely disappeared
- Any data loss in `orders` or `order_items` (revenue tables!)
- >10% data loss in any table

**⚠️ WARNING (Blocks Deployment)**
- Any data loss detected in non-revenue tables

**ℹ️ INFO (Logged, No Block)**
- Minor expected changes (<10%)

---

## 🔧 Common Scenarios

### Scenario 1: You Deleted Test Data (Intentional)

```bash
# Check what changed
npm run db:health-check

# If changes are intentional, update baseline
npm run db:health-check:update

# Now you can push
git push
```

### Scenario 2: Data Loss Detected During Push

```bash
$ git push
🔍 Running database health check before push...

🚨 CRITICAL: Table 'orders' lost 8 rows (100%) - REVENUE DATA!

❌ Database health check failed!

Options:
  1. Fix the database issues
  2. Update baseline if changes are intentional: npm run db:health-check:update
  3. Skip this check (NOT RECOMMENDED): git push --no-verify
```

**What to do:**
1. **Don't bypass the check!** This is protecting your revenue data.
2. Check your database - restore from backup if needed
3. Only update baseline if the change was intentional

### Scenario 3: Setting Up on New Environment

```bash
# First time on new machine/environment
npm install
npm run prepare

# Create baseline from current database state
npm run db:health-check

# Commit the baseline file
git add .database-baseline.json
git commit -m "Add database baseline"
```

### Scenario 4: False Positive (New Table Added)

Adding new tables won't trigger alerts - only missing tables or row count decreases will.

---

## 📊 Baseline File (`.database-baseline.json`)

This file tracks your expected database state:

```json
{
  "created_at": "2026-02-09T12:00:00.000Z",
  "tables": [
    {
      "table_name": "orders",
      "row_count": 8,
      "checked_at": "2026-02-09T12:00:00.000Z"
    },
    {
      "table_name": "products",
      "row_count": 10,
      "checked_at": "2026-02-09T12:00:00.000Z"
    }
  ]
}
```

**Should you commit it?**
- ✅ **YES** - Commit this file to git
- ✅ Tracks expected database state across team
- ✅ Enables CI/CD health checks

---

## 🔔 Setting Up Alerts

### Slack Notifications

1. Create a Slack Incoming Webhook
2. Add to GitHub Secrets:
   ```
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
   ```

### Email Notifications

1. Set up Gmail App Password (or other SMTP)
2. Add to GitHub Secrets:
   ```
   EMAIL_USERNAME=your-email@gmail.com
   EMAIL_PASSWORD=your-app-password
   ALERT_EMAIL=team@yourcompany.com
   ```

### GitHub Secrets Setup

Go to: `Settings` → `Secrets and variables` → `Actions` → `New repository secret`

Add:
- `NEXT_PUBLIC_SUPABASE_URL` (if not already there)
- `SUPABASE_SERVICE_ROLE_KEY` (if not already there)
- `SLACK_WEBHOOK_URL` (optional, for Slack alerts)
- `EMAIL_USERNAME` (optional, for email alerts)
- `EMAIL_PASSWORD` (optional, for email alerts)
- `ALERT_EMAIL` (optional, for email alerts)

---

## 🧪 Testing the System

### Test 1: Normal Operation

```bash
# Make a code change (not database)
echo "// test" >> README.md
git add .
git commit -m "Test commit"
git push

# Should see:
# ✅ Health check passed!
# Push proceeds normally
```

### Test 2: Intentional Database Change

```bash
# Delete a test record from database manually
# Then try to push
git push

# Should see warning about row count decrease
# Update baseline if intentional:
npm run db:health-check:update
git add .database-baseline.json
git commit -m "Update database baseline"
git push
```

### Test 3: Critical Data Loss (Simulated)

```bash
# Don't actually do this! Just to understand the flow:
# If you dropped the orders table, you'd see:
# 🚨 CRITICAL: Table 'orders' no longer exists! (had 8 rows)
# Push would be blocked
```

---

## 🛠️ Troubleshooting

### "Health check failed" but database is fine

Check if:
1. Baseline file is outdated - run `npm run db:health-check:update`
2. Different environment (staging vs production) - create separate baselines
3. Supabase credentials are correct

### Git hook not running

```bash
# Reinstall hooks
npm run prepare

# Check hook file exists and is executable
ls -la .husky/pre-push
chmod +x .husky/pre-push
```

### GitHub Action failing

Check:
1. Secrets are configured correctly
2. Supabase credentials have necessary permissions
3. Baseline artifact exists (first run creates it)

---

## 📝 Best Practices

### DO ✅
- ✅ Commit `.database-baseline.json` to git
- ✅ Update baseline after intentional data changes
- ✅ Review health check output before bypassing
- ✅ Set up Slack/email alerts for team visibility
- ✅ Run health check manually before big deployments

### DON'T ❌
- ❌ Skip health checks with `--no-verify` without review
- ❌ Ignore warnings about revenue tables (orders, order_items)
- ❌ Delete baseline file
- ❌ Commit `.env.local` with Supabase keys

---

## 🎯 What This Prevents

**Scenario from Feb 9, 2026:**
- Lost 8 customer orders ($1,340.54 revenue)
- Lost 8 order items
- Lost 3 discount codes
- Lost 2,648 analytics events
- Lost 24 diagnostic audits

**With monitoring:**
- ✅ Would detect before push: "🚨 CRITICAL: orders lost 8 rows - REVENUE DATA!"
- ✅ Would block deployment
- ✅ Would send alerts to team
- ✅ Would prevent data loss

---

## 🚀 Next Steps

1. **Install**: `npm install && npm run prepare`
2. **Baseline**: `npm run db:health-check`
3. **Commit**: `git add .database-baseline.json && git commit -m "Add DB monitoring"`
4. **Test**: Make a change and try pushing
5. **Alerts**: Set up Slack/email notifications in GitHub Secrets

**You're now protected against database data loss!** 🛡️
