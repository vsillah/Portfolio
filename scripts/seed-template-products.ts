#!/usr/bin/env npx tsx
/**
 * Seed Script: Template Product Offerings
 *
 * Inserts product rows with type='template' for templatized offerings
 * (chatbot, leadgen, eval, diagnostic, n8n warm lead pack). Idempotent:
 * skips insert if a template product with the same title already exists.
 *
 * Uploads INSTALL.md from each template folder to Supabase Storage and sets
 * instructions_file_path on the product. Backfills asset_url and instructions
 * when missing.
 *
 * Usage:
 *   npx tsx scripts/seed-template-products.ts
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Note: created_by is left null for seeded template products (no admin user lookup).
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const PROJECT_ROOT = path.resolve(process.cwd());

/** Map product title -> path to INSTALL.md relative to project root */
const INSTALL_PATHS: Record<string, string> = {
  'Chatbot Template': 'client-templates/chatbot-template/INSTALL.md',
  'Lead Generation Template': 'client-templates/leadgen-template/INSTALL.md',
  'Eval Template': 'client-templates/eval-template/INSTALL.md',
  'Diagnostic Template': 'client-templates/diagnostic-template/INSTALL.md',
  'n8n Warm Lead Pack': 'n8n-exports/INSTALL.md',
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const REPO_BASE = 'https://github.com/vsillah/Portfolio/tree/main';

const TEMPLATE_PRODUCTS = [
  {
    title: 'Chatbot Template',
    description: 'AI-powered chatbot with n8n integration for RAG, optional voice (VAPI), conversation history, and dynamic system prompts. Use when a client needs an AI assistant on their website.',
    type: 'template' as const,
    price: null,
    asset_url: `${REPO_BASE}/client-templates/chatbot-template`,
    instructions_file_path: null as string | null,
    display_order: 100,
  },
  {
    title: 'Lead Generation Template',
    description: 'Complete lead capture and qualification system: contact form, lead magnet delivery, exit intent, n8n webhook for enrichment, diagnostic assessments, and sales session tracking.',
    type: 'template' as const,
    price: null,
    asset_url: `${REPO_BASE}/client-templates/leadgen-template`,
    instructions_file_path: null,
    display_order: 101,
  },
  {
    title: 'Eval Template',
    description: 'Chat evaluation system for quality assessment: human annotation interface, LLM-as-Judge automated evaluations, multiple model support (Claude, GPT-4), and human-LLM alignment tracking.',
    type: 'template' as const,
    price: null,
    asset_url: `${REPO_BASE}/client-templates/eval-template`,
    instructions_file_path: null,
    display_order: 102,
  },
  {
    title: 'Diagnostic Template',
    description: 'Client-facing diagnostic (audit) flow that captures pain points and routes to sales. Includes audit storage, completion webhook, and optional n8n integration.',
    type: 'template' as const,
    price: null,
    asset_url: `${REPO_BASE}/client-templates/diagnostic-template`,
    instructions_file_path: null,
    display_order: 103,
  },
  {
    title: 'n8n Warm Lead Pack',
    description: 'Three n8n workflows: Facebook warm lead scraper, Google Contacts sync, and LinkedIn warm lead scraper. All normalize and POST to your ingest API. Ready for n8n Cloud import.',
    type: 'template' as const,
    price: null,
    asset_url: `${REPO_BASE}/n8n-exports`,
    instructions_file_path: null,
    display_order: 104,
  },
];

async function main() {
  console.log('Checking for existing template products...');
  const { data: existing } = await supabase
    .from('products')
    .select('id, title, asset_url, instructions_file_path')
    .eq('type', 'template');

  const existingByTitle = new Map((existing || []).map((p) => [p.title, p]));
  const toInsert = TEMPLATE_PRODUCTS.filter((p) => !existingByTitle.has(p.title));

  if (toInsert.length > 0) {
    console.log(`Inserting ${toInsert.length} template product(s)...`);
    const { data: inserted, error } = await supabase
      .from('products')
      .insert(
        toInsert.map((p) => ({
          title: p.title,
          description: p.description,
          type: p.type,
          price: p.price,
          file_path: null,
          image_url: null,
          asset_url: p.asset_url,
          instructions_file_path: p.instructions_file_path,
          is_active: true,
          is_featured: false,
          display_order: p.display_order,
        }))
      )
      .select('id, title');

    if (error) {
      console.error('Insert failed:', error.message);
      process.exit(1);
    }
    console.log('Inserted:', (inserted || []).map((p) => p.title).join(', '));
    // Refresh existing map to include newly inserted products
    const { data: refreshed } = await supabase
      .from('products')
      .select('id, title, asset_url, instructions_file_path')
      .eq('type', 'template');
    if (refreshed) {
      existingByTitle.clear();
      refreshed.forEach((p) => existingByTitle.set(p.title, p));
    }
  } else {
    console.log('All template products already exist.');
  }

  // Backfill asset_url on existing template products that have none
  const toBackfill = TEMPLATE_PRODUCTS.filter((p) => {
    const row = existingByTitle.get(p.title);
    return row && (row.asset_url == null || row.asset_url === '');
  });

  if (toBackfill.length > 0) {
    console.log(`Backfilling asset_url for ${toBackfill.length} template product(s)...`);
    for (const p of toBackfill) {
      const { error: updateError } = await supabase
        .from('products')
        .update({ asset_url: p.asset_url })
        .eq('type', 'template')
        .eq('title', p.title);
      if (updateError) {
        console.error(`Failed to update ${p.title}:`, updateError.message);
      } else {
        console.log('  Updated asset_url:', p.title);
      }
    }
  }

  // Backfill instructions_file_path: upload INSTALL.md from template folders to storage
  const allTemplates = Array.from(existingByTitle.values());
  const toBackfillInstructions = allTemplates.filter((row) => {
    const installPath = INSTALL_PATHS[row.title];
    return installPath && (row.instructions_file_path == null || row.instructions_file_path === '');
  });

  if (toBackfillInstructions.length > 0) {
    console.log(`Uploading install guides for ${toBackfillInstructions.length} template product(s)...`);
    for (const row of toBackfillInstructions) {
      const localPath = path.join(PROJECT_ROOT, INSTALL_PATHS[row.title]);
      if (!fs.existsSync(localPath)) {
        console.warn(`  Skip ${row.title}: ${localPath} not found`);
        continue;
      }
      const buffer = fs.readFileSync(localPath);
      const storagePath = `product-${row.id}/instructions/install.md`;
      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(storagePath, buffer, {
          contentType: 'text/markdown',
          cacheControl: '3600',
          upsert: true,
        });
      if (uploadError) {
        console.error(`  Failed to upload ${row.title}:`, uploadError.message);
        continue;
      }
      const { error: updateError } = await supabase
        .from('products')
        .update({ instructions_file_path: storagePath })
        .eq('id', row.id);
      if (updateError) {
        console.error(`  Failed to update ${row.title}:`, updateError.message);
      } else {
        console.log('  Uploaded install guide:', row.title);
      }
    }
  }

  console.log('\nDone.');
}

main();
