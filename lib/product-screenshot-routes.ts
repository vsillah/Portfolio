/**
 * Maps store products to the route whose UI best demonstrates what the product
 * delivers. Used by scripts/capture-product-store-images.ts for playtest
 * screenshot capture. Merchandise is excluded upstream.
 *
 * Mapping rationale — each product should show the *functionality it provides*:
 *
 *   Chatbot Template         → /#contact  (Chat component lives here)
 *   Lead Generation Template → /admin/outreach  (lead pipeline + outreach UI)
 *   Eval Template            → /admin/chat-eval  (chat evaluation dashboard)
 *   Diagnostic Template      → /tools/audit  (interactive diagnostic flow)
 *   n8n Warm Lead Pack       → /admin/lead-dashboards  (shared lead dashboards)
 *   AI Audit Calculator      → /tools/audit  (same audit wizard)
 *   AI Implementation Playbook     → /services  (consulting services it complements)
 *   Business Automation Toolkit    → /services  (automation services catalog)
 *   Automation ROI Templates Pack  → /pricing  (ROI calculator embedded on pricing)
 */

export type ProductRowForScreenshot = {
  title: string
  type: string
}

export interface ResolvedScreenshotRoute {
  route: string
  /** Route is under /admin — Playwright storage state (admin auth) required */
  requiresAdminAuth: boolean
  /** Full-page screenshot (e.g. home + #contact) */
  fullPage?: boolean
}

/**
 * Title-based overrides. Each maps a product to the page that best shows the
 * functionality the product delivers to the buyer.
 */
const TITLE_OVERRIDES: Record<string, ResolvedScreenshotRoute> = {
  // Chat component (text + voice) is rendered in the Contact section on home
  'Chatbot Template': {
    route: '/#contact',
    requiresAdminAuth: false,
    fullPage: true,
  },
  // Lead pipeline + outreach queue — the operational UI for lead generation
  'Lead Generation Template': {
    route: '/admin/outreach',
    requiresAdminAuth: true,
  },
  // Chat evaluation dashboard: session list, filters, stats
  'Eval Template': {
    route: '/admin/chat-eval',
    requiresAdminAuth: true,
  },
  // Interactive diagnostic / audit wizard
  'Diagnostic Template': {
    route: '/tools/audit',
    requiresAdminAuth: false,
  },
  // Shared client lead dashboards — funnel monitoring for warm leads
  'n8n Warm Lead Pack': {
    route: '/admin/lead-dashboards',
    requiresAdminAuth: true,
  },
  // ROI calculator is embedded on the pricing page
  'Automation ROI Templates Pack': {
    route: '/pricing',
    requiresAdminAuth: false,
  },
  // Playbook complements the consulting services catalog
  'AI Implementation Playbook': {
    route: '/services',
    requiresAdminAuth: false,
  },
  // Automation toolkit pairs with the services / automation builds listing
  'Business Automation Toolkit': {
    route: '/services',
    requiresAdminAuth: false,
  },
}

/**
 * Resolve which URL to capture for a non-merchandise product store card.
 * Order: exact title match → type-based fallback.
 */
export function resolveStoreScreenshotRoute(product: ProductRowForScreenshot): ResolvedScreenshotRoute {
  const byTitle = TITLE_OVERRIDES[product.title]
  if (byTitle) {
    return { ...byTitle }
  }

  const t = product.type
  if (t === 'calculator') {
    return { route: '/tools/audit', requiresAdminAuth: false }
  }
  if (t === 'ebook' || t === 'training') {
    return { route: '/services', requiresAdminAuth: false }
  }
  if (t === 'app') {
    return { route: '/prototypes', requiresAdminAuth: false }
  }
  if (t === 'music') {
    return { route: '/store?category=products&type=music', requiresAdminAuth: false }
  }
  if (t === 'template') {
    return { route: '/store', requiresAdminAuth: false }
  }

  return { route: '/store', requiresAdminAuth: false }
}

export function routeNeedsAdminAuth(resolved: ResolvedScreenshotRoute): boolean {
  return resolved.requiresAdminAuth || resolved.route.startsWith('/admin')
}
