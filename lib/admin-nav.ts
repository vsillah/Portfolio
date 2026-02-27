/**
 * Admin sidebar navigation — single source of truth.
 * Used by AdminSidebar and dashboard links; add new admin pages here.
 */

export interface AdminNavItem {
  label: string
  href: string
}

export interface AdminNavCategory {
  label: string
  items: AdminNavItem[]
  /** If set, the item with this href shows an expandable section with children (e.g. Content Hub, Chat Eval). */
  expandableItemHref?: string
  /** Child links shown under the expandable item. */
  children?: AdminNavItem[]
}

/** Dashboard is the first item; then five categories with direct links. */
export const ADMIN_NAV: { dashboard: AdminNavItem; categories: AdminNavCategory[] } = {
  dashboard: {
    label: 'Dashboard',
    href: '/admin',
  },
  categories: [
    {
      label: 'Pipeline',
      items: [
        { label: 'Lead Pipeline', href: '/admin/outreach' },
        { label: 'Value Evidence', href: '/admin/value-evidence' },
      ],
    },
    {
      label: 'Sales',
      items: [
        { label: 'Sales Dashboard', href: '/admin/sales' },
        { label: 'Lead Dashboards', href: '/admin/lead-dashboards' },
        { label: 'Attraction Campaigns', href: '/admin/campaigns' },
        { label: 'Products', href: '/admin/sales/products' },
        { label: 'Bundles', href: '/admin/sales/bundles' },
        { label: 'Scripts', href: '/admin/sales/scripts' },
        { label: 'Upsell Paths', href: '/admin/sales/upsell-paths' },
      ],
    },
    {
      label: 'Post-sale',
      items: [
        { label: 'Client Projects', href: '/admin/client-projects' },
        { label: 'Meeting Tasks', href: '/admin/meeting-tasks' },
        { label: 'Continuity Plans', href: '/admin/continuity-plans' },
        { label: 'Onboarding Templates', href: '/admin/onboarding-templates' },
        { label: 'Guarantees', href: '/admin/guarantees' },
      ],
    },
    {
      label: 'Quality & insights',
      items: [
        { label: 'Chat Eval', href: '/admin/chat-eval' },
        { label: 'Analytics', href: '/admin/analytics' },
        { label: 'E2E Testing', href: '/admin/testing' },
      ],
      expandableItemHref: '/admin/chat-eval',
      children: [
        { label: 'Annotation Queues', href: '/admin/chat-eval/queues' },
        { label: 'LLM Alignment', href: '/admin/chat-eval/alignment' },
        { label: 'Axial Codes', href: '/admin/chat-eval/axial-codes' },
        { label: 'Error Diagnoses', href: '/admin/chat-eval/diagnoses' },
        { label: 'Start Annotating', href: '/admin/chat-eval/queue' },
      ],
    },
    {
      label: 'Configuration',
      items: [
        { label: 'Content Hub', href: '/admin/content' },
        { label: 'User Management', href: '/admin/users' },
        { label: 'System Prompts', href: '/admin/prompts' },
      ],
      expandableItemHref: '/admin/content',
      children: [
        { label: 'Outcome Groups', href: '/admin/content/outcome-groups' },
        { label: 'Projects', href: '/admin/content/projects' },
        { label: 'Videos', href: '/admin/content/videos' },
        { label: 'Publications', href: '/admin/content/publications' },
        { label: 'Music', href: '/admin/content/music' },
        { label: 'Services', href: '/admin/content/services' },
        { label: 'Products', href: '/admin/products' },
        { label: 'Prototypes', href: '/admin/content/prototypes' },
        { label: 'Merchandise', href: '/admin/content/merchandise' },
        { label: 'Discount Codes', href: '/admin/content/discount-codes' },
        { label: 'Bundles', href: '/admin/sales/bundles' }, // cross-link: same route as Sales → Bundles
      ],
    },
  ],
}

/**
 * Returns whether pathname matches href (exact) or is a child path (e.g. /admin/content/outcome-groups when href is /admin/content).
 */
export function isNavItemActive(href: string, pathname: string): boolean {
  if (pathname === href) return true
  if (href !== '/admin' && pathname.startsWith(href + '/')) return true
  return false
}

/**
 * Returns whether the Content Hub section should be expanded (any content route active).
 */
export function isContentExpanded(pathname: string): boolean {
  return pathname.startsWith('/admin/content') || pathname.startsWith('/admin/products')
}

/**
 * Returns whether the Chat Eval section should be expanded (any chat-eval route active).
 */
export function isChatEvalExpanded(pathname: string): boolean {
  return pathname.startsWith('/admin/chat-eval')
}
