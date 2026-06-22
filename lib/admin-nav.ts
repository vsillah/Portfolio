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
        { label: 'Email Center', href: '/admin/email-center' },
        { label: 'Value Evidence', href: '/admin/value-evidence' },
        { label: 'Social Content', href: '/admin/social-content' },
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
        { label: 'Offer Architecture', href: '/admin/sales/offer-architecture' },
        { label: 'Scripts', href: '/admin/sales/scripts' },
        { label: 'Upsell Paths', href: '/admin/sales/upsell-paths' },
        { label: 'Presentation Generator', href: '/admin/presentations' },
        { label: 'Implementation Roadmap', href: '/admin/sales/implementation-roadmap' },
        { label: 'Gamma Reports', href: '/admin/reports/gamma' },
      ],
    },
    {
      label: 'Post-sale',
      items: [
        { label: 'Client Projects', href: '/admin/client-projects' },
        { label: 'Meetings', href: '/admin/meetings' },
        { label: 'Meeting Tasks', href: '/admin/meeting-tasks' },
        { label: 'Continuity Plans', href: '/admin/continuity-plans' },
        { label: 'Onboarding Templates', href: '/admin/onboarding-templates' },
        { label: 'Guarantees', href: '/admin/guarantees' },
      ],
    },
    {
      label: 'Quality & insights',
      items: [
        { label: 'Model Ops', href: '/admin/model-ops/reply-intent-review' },
        { label: 'Chat Eval', href: '/admin/chat-eval' },
        { label: 'Analytics', href: '/admin/analytics' },
        { label: 'Cost & Revenue', href: '/admin/cost-revenue' },
        { label: 'Subscription Watch', href: '/admin/subscriptions' },
        { label: 'Technology Bakeoffs', href: '/admin/technology-bakeoffs' },
        { label: 'Source Protocol', href: '/admin/source-protocol' },
        { label: 'Client Experience', href: '/admin/client-experience' },
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
      label: 'Agent Ops',
      items: [
        { label: 'Mission Control', href: '/admin/agents' },
        { label: 'Standup Room', href: '/admin/agents/standup' },
        { label: 'Decision Queue', href: '/admin/agents/coordination' },
        { label: 'Content Intelligence', href: '/admin/agents/content-intelligence' },
        { label: 'Agent Kanban', href: '/admin/agents/swarm-board' },
        { label: 'Run Console', href: '/admin/agents/runs' },
        { label: 'Automation Context', href: '/admin/agents/automations' },
        { label: 'Open Brain', href: '/admin/agents/open-brain' },
        { label: 'Governance', href: '/admin/agents/governance' },
      ],
    },
    {
      label: 'Configuration',
      items: [
        { label: 'Content Hub', href: '/admin/content' },
        { label: 'User Management', href: '/admin/users' },
        { label: 'System Prompts', href: '/admin/prompts' },
        { label: 'Module Sync', href: '/admin/module-sync' },
        { label: 'Credential Reporting', href: '/admin/credentials' },
        { label: 'Email Preview', href: '/admin/email-preview' },
      ],
      expandableItemHref: '/admin/content',
      children: [
        { label: 'Outcome Groups', href: '/admin/content/outcome-groups' },
        { label: 'Projects', href: '/admin/content/projects' },
        { label: 'Videos', href: '/admin/content/videos' },
        { label: 'Video Generation', href: '/admin/content/video-generation' },
        { label: 'Publications', href: '/admin/content/publications' },
        { label: 'Music', href: '/admin/content/music' },
        { label: 'Services', href: '/admin/content/services' },
        { label: 'Mobile App Foundry', href: '/admin/mobile-app-foundry' },
        { label: 'Products', href: '/admin/products' },
        { label: 'Prototypes', href: '/admin/content/prototypes' },
        { label: 'Merchandise', href: '/admin/content/merchandise' },
        { label: 'Discount Codes', href: '/admin/content/discount-codes' },
        { label: 'Store Settings', href: '/admin/content/store-settings' },
        { label: 'Bundles', href: '/admin/sales/bundles' }, // cross-link: same route as Sales → Bundles
      ],
    },
  ],
}

function isPathOrChild(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(href + '/')
}

/**
 * Returns whether pathname matches href (exact) or is a child path (e.g. /admin/content/outcome-groups when href is /admin/content).
 */
export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === '/admin/agents') return pathname === href
  if (href === '/admin/products') {
    return pathname === href || pathname === '/admin/content/products' || pathname.startsWith('/admin/content/products/')
  }
  if (href === '/admin') return pathname === href
  return isPathOrChild(href, pathname)
}

/**
 * Returns whether the Content Hub section should be expanded (any content route active).
 */
export function isContentExpanded(pathname: string): boolean {
  return isPathOrChild('/admin/content', pathname) || isPathOrChild('/admin/products', pathname)
}

/**
 * Returns whether the Chat Eval section should be expanded (any chat-eval route active).
 */
export function isChatEvalExpanded(pathname: string): boolean {
  return isPathOrChild('/admin/chat-eval', pathname)
}
