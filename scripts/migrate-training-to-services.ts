#!/usr/bin/env npx tsx
/**
 * Migration Script: Move AI Training Course and Premium AI Masterclass from Products to Services
 *
 * 1. Inserts the two training items as services (idempotent)
 * 2. Migrates content_offer_roles from product → service (deletes product refs, creates service refs)
 * 3. Deactivates the products (is_active = false) so they no longer appear in store
 *
 * Existing orders and cart items retain product_id references; products remain in DB for history.
 *
 * Usage:
 *   npx tsx scripts/migrate-training-to-services.ts
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Target items to migrate (from products → services)
const TRAINING_ITEMS = [
  {
    title: 'AI Training Course — Self-Paced',
    description: 'Comprehensive self-paced course covering AI fundamentals, prompt engineering, and practical business applications.',
    price: 297.00,
    perceivedValue: 1500,
    retailPrice: 497,
    offerPrice: 297,
    dreamOutcome: 'Master AI tools and apply them to your business immediately',
    display_order: 25,
  },
  {
    title: 'Premium AI Masterclass',
    description: 'Advanced masterclass on building and deploying AI solutions. Includes hands-on projects and certification.',
    price: 497.00,
    perceivedValue: 2500,
    retailPrice: 997,
    offerPrice: 497,
    dreamOutcome: 'Build and deploy production AI solutions with confidence',
    display_order: 26,
  },
];

async function main() {
  console.log('=== Migrate Training Courses: Products → Services ===\n');

  const serviceMap = new Map<string, string>();

  // --- 1. Insert services (idempotent) ---
  console.log('1. Creating services...');
  for (const item of TRAINING_ITEMS) {
    const { data: existing } = await supabase
      .from('services')
      .select('id, title')
      .eq('title', item.title)
      .maybeSingle();

    if (existing) {
      console.log(`   [SKIP] Service already exists: "${item.title}" (id: ${existing.id})`);
      serviceMap.set(item.title, existing.id);
      continue;
    }

    const { data, error } = await supabase
      .from('services')
      .insert({
        title: item.title,
        description: item.description,
        service_type: 'training',
        price: item.price,
        is_quote_based: false,
        delivery_method: 'virtual',
        duration_hours: null,
        duration_description: 'Self-paced',
        display_order: item.display_order,
        is_featured: true,
        is_active: true,
        topics: ['AI Fundamentals', 'Prompt Engineering', 'Business Applications', 'Hands-On Projects'],
        deliverables: ['Course access', 'Video lessons', 'Exercises', 'Certificate of completion'],
      })
      .select('id, title')
      .single();

    if (error) {
      console.error(`   [ERROR] Failed to create service "${item.title}":`, error.message);
      process.exit(1);
    }
    console.log(`   [OK] Created service: "${data!.title}" (id: ${data!.id})`);
    serviceMap.set(data!.title, data!.id);
  }

  // --- 2. Fetch product IDs ---
  const productIds = new Map<string, number>();
  for (const item of TRAINING_ITEMS) {
    const { data } = await supabase
      .from('products')
      .select('id')
      .eq('title', item.title)
      .maybeSingle();
    if (data) productIds.set(item.title, data.id);
  }

  // --- 3. Migrate content_offer_roles: delete product refs, insert service refs ---
  console.log('\n2. Migrating content_offer_roles...');
  for (const item of TRAINING_ITEMS) {
    const productId = productIds.get(item.title);
    const serviceId = serviceMap.get(item.title);
    if (!serviceId) continue;

    // Delete existing product-based offer role
    if (productId) {
      const { error: delErr } = await supabase
        .from('content_offer_roles')
        .delete()
        .eq('content_type', 'product')
        .eq('content_id', String(productId));

      if (delErr) {
        console.error(`   [ERROR] Failed to delete offer role for product "${item.title}":`, delErr.message);
      } else {
        console.log(`   [OK] Removed product offer role for "${item.title}"`);
      }
    }

    // Insert service-based offer role (if not exists)
    const { data: existingRole } = await supabase
      .from('content_offer_roles')
      .select('id')
      .eq('content_type', 'service')
      .eq('content_id', serviceId)
      .maybeSingle();

    if (existingRole) {
      console.log(`   [SKIP] Offer role already exists for service "${item.title}"`);
      continue;
    }

    const { error: insErr } = await supabase.from('content_offer_roles').insert({
      content_type: 'service',
      content_id: serviceId,
      offer_role: 'core_offer',
      perceived_value: item.perceivedValue,
      retail_price: item.retailPrice,
      offer_price: item.offerPrice,
      dream_outcome_description: item.dreamOutcome,
      likelihood_multiplier: 7,
      time_reduction: 5,
      effort_reduction: 6,
      is_active: true,
    });

    if (insErr) {
      console.error(`   [ERROR] Failed to create offer role for service "${item.title}":`, insErr.message);
    } else {
      console.log(`   [OK] Created offer role for service "${item.title}"`);
    }
  }

  // --- 4. Deactivate products ---
  console.log('\n3. Deactivating products...');
  for (const item of TRAINING_ITEMS) {
    const productId = productIds.get(item.title);
    if (!productId) {
      console.log(`   [SKIP] Product not found: "${item.title}"`);
      continue;
    }

    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', productId);

    if (error) {
      console.error(`   [ERROR] Failed to deactivate product "${item.title}":`, error.message);
    } else {
      console.log(`   [OK] Deactivated product: "${item.title}"`);
    }
  }

  // --- 5. Update offer_bundles bundle_items (if any reference these products) ---
  console.log('\n4. Checking bundle_items for product references...');
  const { data: bundles } = await supabase.from('offer_bundles').select('id, name, bundle_items');
  let bundleUpdates = 0;
  for (const bundle of bundles || []) {
    const items = (bundle.bundle_items as Array<{ content_type?: string; content_id?: string }>) || [];
    let changed = false;
    const newItems = items.map((bi) => {
      if (bi.content_type !== 'product') return bi;
      const prodId = bi.content_id ? String(bi.content_id) : '';
      const match = TRAINING_ITEMS.find((t) => productIds.get(t.title)?.toString() === prodId);
      if (!match) return bi;
      const svcId = serviceMap.get(match.title);
      if (!svcId) return bi;
      changed = true;
      return { ...bi, content_type: 'service', content_id: svcId };
    });
    if (changed) {
      const { error } = await supabase
        .from('offer_bundles')
        .update({ bundle_items: newItems })
        .eq('id', bundle.id);
      if (error) {
        console.error(`   [ERROR] Failed to update bundle "${bundle.name}":`, error.message);
      } else {
        console.log(`   [OK] Updated bundle "${bundle.name}"`);
        bundleUpdates++;
      }
    }
  }
  if (bundleUpdates === 0) {
    console.log('   No bundles referenced these products.');
  }

  console.log('\n=== Migration Complete ===');
  console.log('Training courses are now services. View at /admin/content/services');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
