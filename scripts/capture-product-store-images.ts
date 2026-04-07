#!/usr/bin/env npx tsx
/**
 * Capture store-card screenshots for active non-merchandise products using the playtest
 * pipeline (lib/playtest-broll → captureBroll), upload PNGs to Supabase Storage, and set
 * products.image_url to the public URL.
 *
 * Merchandise (Printful) is skipped — those rows already have catalog images.
 *
 * Usage:
 *   npx tsx scripts/capture-product-store-images.ts
 *   npx tsx scripts/capture-product-store-images.ts --force
 *   npx tsx scripts/capture-product-store-images.ts --no-start-server
 *
 * Flags:
 *   --force           Overwrite image_url even when already set
 *   --no-start-server Do not auto-start dev server; require BASE_URL reachable
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   BASE_URL (optional, default http://localhost:3000)
 *
 * Admin routes (/admin/*) require one of:
 *   STORYBOARD_AUTH_STATE=path/to/playwright-storage-state.json
 *   ADMIN_E2E_EMAIL + ADMIN_E2E_PASSWORD (auth state auto-generated like storyboard capture)
 *
 * Output: temporary PNGs under design-files/product-screenshots-capture/ (then uploaded).
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { captureBroll, type RouteConfig } from '@/lib/playtest-broll'
import {
  resolveStoreScreenshotRoute,
  routeNeedsAdminAuth,
} from '@/lib/product-screenshot-routes'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function hasAdminAuthEnv(): boolean {
  const explicit = process.env.STORYBOARD_AUTH_STATE
  if (explicit && fs.existsSync(explicit)) return true
  return !!(process.env.ADMIN_E2E_EMAIL && process.env.ADMIN_E2E_PASSWORD)
}

function parseArgs(): { force: boolean; noStartServer: boolean } {
  const argv = process.argv.slice(2)
  return {
    force: argv.includes('--force'),
    noStartServer: argv.includes('--no-start-server'),
  }
}

async function main() {
  const { force, noStartServer } = parseArgs()

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: rows, error } = await supabase
    .from('products')
    .select('id, title, type, image_url')
    .eq('is_active', true)
    .neq('type', 'merchandise')
    .order('id', { ascending: true })

  if (error) {
    console.error('Query failed:', error.message)
    process.exit(1)
  }

  const list = (rows ?? []).filter((p) => {
    if (force) return true
    return p.image_url == null || String(p.image_url).trim() === ''
  })

  if (list.length === 0) {
    console.log('No products to update (all have image_url, or none match). Use --force to overwrite.')
    return
  }

  const needsAdmin = list.some((p) => {
    const r = resolveStoreScreenshotRoute({ title: p.title, type: p.type })
    return routeNeedsAdminAuth(r)
  })
  if (needsAdmin && !hasAdminAuthEnv()) {
    console.error(
      'One or more products need an admin screenshot, but no admin auth is configured.\n' +
        'Set STORYBOARD_AUTH_STATE to a valid Playwright storage state file, or set ADMIN_E2E_EMAIL and ADMIN_E2E_PASSWORD in .env.local.'
    )
    process.exit(1)
  }

  const routes: RouteConfig[] = []
  const idByFilename = new Map<string, number>()

  for (const p of list) {
    const resolved = resolveStoreScreenshotRoute({ title: p.title, type: p.type })
    const filename = `product-${p.id}-store-card`
    idByFilename.set(filename, p.id)
    routes.push({
      route: resolved.route,
      filename,
      description: `${p.title} (${p.type})`,
      fullPage: resolved.fullPage,
    })
  }

  const outDir = path.join(process.cwd(), 'design-files', 'product-screenshots-capture')
  const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
  const authStateOutPath = path.join(outDir, '.product-screenshots-auth-state.json')

  const result = await captureBroll({
    routes,
    outputDir: outDir,
    baseUrl,
    noStartServer,
    authStateOutPath,
  })

  let uploaded = 0
  for (const screenshotPath of result.screenshots) {
    const base = path.basename(screenshotPath, '.png')
    const productId = idByFilename.get(base)
    if (productId == null) {
      console.warn('Unexpected screenshot file:', screenshotPath)
      continue
    }

    const storagePath = `product-${productId}/store-card.png`
    const buf = fs.readFileSync(screenshotPath)

    const { error: upErr } = await supabase.storage
      .from('products')
      .upload(storagePath, buf, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: true,
      })

    if (upErr) {
      console.error(`Upload failed for product ${productId}:`, upErr.message)
      continue
    }

    const { data: pub } = supabase.storage.from('products').getPublicUrl(storagePath)
    const publicUrl = pub.publicUrl

    const { error: updErr } = await supabase
      .from('products')
      .update({ image_url: publicUrl })
      .eq('id', productId)

    if (updErr) {
      console.error(`DB update failed for product ${productId}:`, updErr.message)
      continue
    }

    console.log(`OK product ${productId}: ${publicUrl}`)
    uploaded++
  }

  console.log(`\nDone. Updated ${uploaded} product(s). Screenshots in ${result.outputDir}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
