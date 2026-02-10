#!/usr/bin/env node

/**
 * Simple migration runner for Supabase SQL files
 * Usage: node scripts/run-migration.js migrations/2026_02_09_make_email_optional.sql
 */

const fs = require('fs');
const path = require('path');

async function runMigration(filename: string) {
  console.log('🔧 Running migration:', filename);
  
  // Read migration file
  const sql = fs.readFileSync(filename, 'utf8');
  
  console.log('📄 SQL to execute:');
  console.log('═'.repeat(80));
  console.log(sql);
  console.log('═'.repeat(80));
  console.log('\n📋 MANUAL STEPS:');
  console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard/project/byoriebhtbysanjhimlu/editor');
  console.log('2. Go to SQL Editor');
  console.log('3. Copy and paste the SQL above');
  console.log('4. Click "Run" or press Cmd+Enter');
  console.log('\n✅ After running, press Enter to continue...\n');
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('❌ Usage: node scripts/run-migration.js <migration-file>');
  process.exit(1);
}

if (!fs.existsSync(migrationFile)) {
  console.error('❌ Migration file not found:', migrationFile);
  process.exit(1);
}

runMigration(migrationFile);
