'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Send,
  FileCheck,
  BarChart3,
  LayoutList,
  Megaphone,
  Package,
  Layers,
  FileText,
  Route,
  Map,
  FolderKanban,
  CalendarCheck,
  RefreshCw,
  ClipboardList,
  ShieldCheck,
  MessageSquare,
  FlaskConical,
  FolderOpen,
  Users,
  FileCode,
  Target,
  Video,
  BookOpen,
  Music,
  Wrench,
  Box,
  Shirt,
  Ticket,
  Sparkles,
  Bug,
  Presentation,
  DollarSign,
  Share2,
  GitCompare,
  Settings,
  Mail,
  Inbox,
  UserCheck,
  Bot,
  Brain,
  ClipboardCheck,
  Columns,
  TerminalSquare,
  MessagesSquare,
  Smartphone,
} from 'lucide-react'
import {
  ADMIN_NAV,
  isNavItemActive,
  isContentExpanded,
  isChatEvalExpanded,
  type AdminNavCategory,
} from '@/lib/admin-nav'
import { useState, useEffect } from 'react'
const CONTENT_HUB_CHILDREN_ID = 'admin-nav-content-children'
const CHAT_EVAL_CHILDREN_ID = 'admin-nav-chat-eval-children'
const ITEM_ICON_SIZE = 16

function navItemClass(active: boolean, depth: 'root' | 'item' | 'child' = 'item') {
  const depthPadding = depth === 'root' ? 'px-3' : depth === 'child' ? 'pl-7 pr-3' : 'pl-4 pr-3'
  return `group flex items-center gap-2 rounded-lg ${depthPadding} py-2 text-sm transition-colors ${
    active
      ? 'border border-radiant-gold/35 bg-radiant-gold/15 text-radiant-gold shadow-[0_0_22px_rgba(212,175,55,0.08)]'
      : 'border border-transparent text-foreground/85 hover:border-radiant-gold/20 hover:bg-radiant-gold/10 hover:text-foreground'
  }`
}

/** Small icon per nav item so category items have clear hierarchy. */
export const NAV_ITEM_ICONS: Record<string, LucideIcon> = {
  '/admin/outreach': Send,
  '/admin/email-center': Inbox,
  '/admin/value-evidence': FileCheck,
  '/admin/social-content': Share2,
  '/admin/mobile-app-foundry': Smartphone,
  '/admin/sales': BarChart3,
  '/admin/lead-dashboards': LayoutList,
  '/admin/campaigns': Megaphone,
  '/admin/sales/products': Package,
  '/admin/sales/bundles': Layers,
  '/admin/sales/offer-architecture': Map,
  '/admin/sales/scripts': FileText,
  '/admin/sales/upsell-paths': Route,
  '/admin/presentations': Sparkles,
  '/admin/sales/implementation-roadmap': ClipboardList,
  '/admin/reports/gamma': Presentation,
  '/admin/client-projects': FolderKanban,
  '/admin/meetings': Video,
  '/admin/meeting-tasks': CalendarCheck,
  '/admin/continuity-plans': RefreshCw,
  '/admin/onboarding-templates': ClipboardList,
  '/admin/guarantees': ShieldCheck,
  '/admin/model-ops/reply-intent-review': Brain,
  '/admin/chat-eval': MessageSquare,
  '/admin/chat-eval/queues': LayoutList,
  '/admin/chat-eval/alignment': BarChart3,
  '/admin/chat-eval/axial-codes': Sparkles,
  '/admin/chat-eval/diagnoses': Bug,
  '/admin/chat-eval/queue': MessageSquare,
  '/admin/analytics': BarChart3,
  '/admin/cost-revenue': DollarSign,
  '/admin/subscriptions': RefreshCw,
  '/admin/technology-bakeoffs': FlaskConical,
  '/admin/source-protocol': BookOpen,
  '/admin/agents': Bot,
  '/admin/agents/standup': MessagesSquare,
  '/admin/agents/coordination': ClipboardCheck,
  '/admin/agents/swarm-board': Columns,
  '/admin/agents/runs': TerminalSquare,
  '/admin/agents/automations': RefreshCw,
  '/admin/agents/open-brain': Brain,
  '/admin/agents/governance': ShieldCheck,
  '/admin/client-experience': UserCheck,
  '/admin/testing': FlaskConical,
  '/admin/content': FolderOpen,
  '/admin/users': Users,
  '/admin/prompts': FileCode,
  '/admin/module-sync': GitCompare,
  '/admin/credentials': ShieldCheck,
  '/admin/email-preview': Mail,
  '/admin/content/outcome-groups': Target,
  '/admin/content/projects': FolderKanban,
  '/admin/content/videos': Video,
  '/admin/content/video-generation': Video,
  '/admin/content/publications': BookOpen,
  '/admin/content/music': Music,
  '/admin/content/services': Wrench,
  '/admin/products': Package,
  '/admin/content/prototypes': Box,
  '/admin/content/merchandise': Shirt,
  '/admin/content/discount-codes': Ticket,
  '/admin/content/store-settings': Settings,
}

function NavItemIcon({ href, active = false }: { href: string; active?: boolean }) {
  const Icon = NAV_ITEM_ICONS[href]
  if (!Icon) return null
  return (
    <Icon
      size={ITEM_ICON_SIZE}
      className={`shrink-0 transition-colors ${
        active ? 'text-radiant-gold' : 'text-muted-foreground group-hover:text-radiant-gold/80'
      }`}
    />
  )
}

function categoryPanelId(label: string) {
  return `admin-nav-section-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function isCategoryActive(category: AdminNavCategory, pathname: string): boolean {
  return [...category.items, ...(category.children ?? [])].some((item) => isNavItemActive(item.href, pathname))
}

export default function AdminSidebar({ showHeader = true }: { showHeader?: boolean }) {
  const pathname = usePathname()
  const [contentOpen, setContentOpen] = useState(false)
  const [chatEvalOpen, setChatEvalOpen] = useState(false)
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({})
  const contentExpanded = contentOpen || isContentExpanded(pathname ?? '')
  const chatEvalExpanded = chatEvalOpen || isChatEvalExpanded(pathname ?? '')

  useEffect(() => {
    if (isContentExpanded(pathname ?? '')) setContentOpen(true)
  }, [pathname])
  useEffect(() => {
    if (isChatEvalExpanded(pathname ?? '')) setChatEvalOpen(true)
  }, [pathname])
  useEffect(() => {
    const activeCategories = ADMIN_NAV.categories.filter((cat) => isCategoryActive(cat, pathname ?? ''))
    if (activeCategories.length === 0) return

    setOpenCategories((current) => {
      const next = { ...current }
      activeCategories.forEach((cat) => {
        next[cat.label] = true
      })
      return next
    })
  }, [pathname])

  return (
    <nav
      className="flex h-full min-w-[264px] flex-col border-r border-radiant-gold/10 bg-[linear-gradient(180deg,rgba(18,30,49,0.97)_0%,rgba(15,26,43,0.98)_100%)] text-foreground shadow-[8px_0_32px_rgba(0,0,0,0.18)]"
      aria-label="Admin navigation"
    >
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:px-3 focus:py-2 focus:bg-background focus:rounded focus:outline focus:ring-2 focus:ring-radiant-gold"
      >
        Skip to main content
      </a>
      {showHeader && (
        <div className="border-b border-radiant-gold/10 px-4 py-4">
          <div className="mb-1 block text-[11px] font-bold uppercase tracking-[0.16em] text-radiant-gold">
            Admin
          </div>
          <div className="text-lg font-semibold text-foreground">Command Center</div>
        </div>
      )}
      <div className="flex min-w-[240px] flex-col gap-4 overflow-y-auto px-3 py-4">
        {/* Dashboard */}
        <Link
          href={ADMIN_NAV.dashboard.href}
          className={navItemClass(pathname === ADMIN_NAV.dashboard.href, 'root')}
          aria-current={pathname === ADMIN_NAV.dashboard.href ? 'page' : undefined}
        >
          <LayoutDashboard
            size={18}
            className={`shrink-0 ${
              pathname === ADMIN_NAV.dashboard.href ? 'text-radiant-gold' : 'text-muted-foreground'
            }`}
          />
          {ADMIN_NAV.dashboard.label}
        </Link>

        {ADMIN_NAV.categories.map((cat) => {
          const categoryActive = isCategoryActive(cat, pathname ?? '')
          const categoryExpanded = categoryActive || Boolean(openCategories[cat.label])
          const categoryId = categoryPanelId(cat.label)

          return (
            <div key={cat.label} className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() =>
                  setOpenCategories((current) => ({
                    ...current,
                    [cat.label]: !categoryExpanded,
                  }))
                }
                className={`group flex min-h-8 items-center justify-between rounded-lg border px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors ${
                  categoryActive
                    ? 'border-radiant-gold/25 bg-radiant-gold/10 text-radiant-gold'
                    : 'border-transparent text-muted-foreground/78 hover:border-radiant-gold/20 hover:bg-radiant-gold/10 hover:text-foreground'
                }`}
                aria-expanded={categoryExpanded}
                aria-controls={categoryId}
              >
                <span>{cat.label}</span>
                <span className="flex items-center gap-1.5">
                  <span className="rounded-full border border-radiant-gold/15 px-1.5 py-0.5 text-[10px] tracking-normal text-muted-foreground/75">
                    {cat.items.length + (cat.children?.length ?? 0)}
                  </span>
                  {categoryExpanded ? (
                    <ChevronDown size={14} className="text-muted-foreground group-hover:text-radiant-gold" />
                  ) : (
                    <ChevronRight size={14} className="text-muted-foreground group-hover:text-radiant-gold" />
                  )}
                </span>
              </button>
              <div id={categoryId} className="flex flex-col gap-1" hidden={!categoryExpanded}>
                {categoryExpanded &&
                  (cat.children && cat.expandableItemHref ? (
                    <div className="flex flex-col gap-0.5">
                      {cat.items.map((item) => {
                        const active = isNavItemActive(item.href, pathname ?? '')
                        const isExpandable = item.href === cat.expandableItemHref
                        const expanded = item.href === '/admin/content' ? contentExpanded : chatEvalExpanded
                        const setExpanded = item.href === '/admin/content' ? setContentOpen : setChatEvalOpen
                        const childrenId = item.href === '/admin/content' ? CONTENT_HUB_CHILDREN_ID : CHAT_EVAL_CHILDREN_ID
                        return (
                          <div key={item.href}>
                            {isExpandable ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setExpanded((o: boolean) => !o)}
                                  className={`${navItemClass(active)} w-full text-left font-medium`}
                                  aria-expanded={expanded}
                                  aria-controls={childrenId}
                                  aria-current={active ? 'page' : undefined}
                                >
                                  {expanded ? (
                                    <ChevronDown
                                      size={ITEM_ICON_SIZE}
                                      className={`shrink-0 ${active ? 'text-radiant-gold' : ''}`}
                                    />
                                  ) : (
                                    <ChevronRight
                                      size={ITEM_ICON_SIZE}
                                      className={`shrink-0 ${active ? 'text-radiant-gold' : ''}`}
                                    />
                                  )}
                                  <NavItemIcon href={item.href} active={active} />
                                  {item.label}
                                </button>
                                <div
                                  id={childrenId}
                                  className="mt-1 flex flex-col gap-0.5 overflow-hidden border-l border-radiant-gold/10 pl-2"
                                  hidden={!expanded}
                                >
                                  {expanded &&
                                    cat.children!.map((child) => {
                                      const childActive = isNavItemActive(child.href, pathname ?? '')
                                      return (
                                        <Link
                                          key={child.href}
                                          href={child.href}
                                          className={navItemClass(childActive, 'child')}
                                          aria-current={childActive ? 'page' : undefined}
                                        >
                                          <NavItemIcon href={child.href} active={childActive} />
                                          {child.label}
                                        </Link>
                                      )
                                    })}
                                </div>
                              </>
                            ) : (
                              <Link
                                href={item.href}
                                className={navItemClass(active)}
                                aria-current={active ? 'page' : undefined}
                              >
                                <NavItemIcon href={item.href} active={active} />
                                {item.label}
                              </Link>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    cat.items.map((item) => {
                      const active = isNavItemActive(item.href, pathname ?? '')
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={navItemClass(active)}
                          aria-current={active ? 'page' : undefined}
                        >
                          <NavItemIcon href={item.href} active={active} />
                          {item.label}
                        </Link>
                      )
                    })
                  ))}
              </div>
            </div>
          )
        })}
      </div>
    </nav>
  )
}
