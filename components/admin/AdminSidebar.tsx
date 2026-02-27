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
} from 'lucide-react'
import { ADMIN_NAV, isNavItemActive, isContentExpanded, isChatEvalExpanded } from '@/lib/admin-nav'
import { useState, useEffect } from 'react'

const CONTENT_HUB_CHILDREN_ID = 'admin-nav-content-children'
const CHAT_EVAL_CHILDREN_ID = 'admin-nav-chat-eval-children'
const ITEM_ICON_SIZE = 16

/** Small icon per nav item so category items have clear hierarchy. */
const NAV_ITEM_ICONS: Record<string, LucideIcon> = {
  '/admin/outreach': Send,
  '/admin/value-evidence': FileCheck,
  '/admin/sales': BarChart3,
  '/admin/lead-dashboards': LayoutList,
  '/admin/campaigns': Megaphone,
  '/admin/sales/products': Package,
  '/admin/sales/bundles': Layers,
  '/admin/sales/scripts': FileText,
  '/admin/sales/upsell-paths': Route,
  '/admin/client-projects': FolderKanban,
  '/admin/meeting-tasks': CalendarCheck,
  '/admin/continuity-plans': RefreshCw,
  '/admin/onboarding-templates': ClipboardList,
  '/admin/guarantees': ShieldCheck,
  '/admin/chat-eval': MessageSquare,
  '/admin/chat-eval/queues': LayoutList,
  '/admin/chat-eval/alignment': BarChart3,
  '/admin/chat-eval/axial-codes': Sparkles,
  '/admin/chat-eval/diagnoses': Bug,
  '/admin/chat-eval/queue': MessageSquare,
  '/admin/analytics': BarChart3,
  '/admin/testing': FlaskConical,
  '/admin/content': FolderOpen,
  '/admin/users': Users,
  '/admin/prompts': FileCode,
  '/admin/content/outcome-groups': Target,
  '/admin/content/projects': FolderKanban,
  '/admin/content/videos': Video,
  '/admin/content/publications': BookOpen,
  '/admin/content/music': Music,
  '/admin/content/services': Wrench,
  '/admin/products': Package,
  '/admin/content/prototypes': Box,
  '/admin/content/merchandise': Shirt,
  '/admin/content/discount-codes': Ticket,
}

function NavItemIcon({ href }: { href: string }) {
  const Icon = NAV_ITEM_ICONS[href]
  if (!Icon) return null
  return <Icon size={ITEM_ICON_SIZE} className="shrink-0 text-platinum-white/70" />
}

export default function AdminSidebar() {
  const pathname = usePathname()
  const [contentOpen, setContentOpen] = useState(false)
  const [chatEvalOpen, setChatEvalOpen] = useState(false)
  const contentExpanded = contentOpen || isContentExpanded(pathname ?? '')
  const chatEvalExpanded = chatEvalOpen || isChatEvalExpanded(pathname ?? '')

  useEffect(() => {
    if (isContentExpanded(pathname ?? '')) setContentOpen(true)
  }, [pathname])
  useEffect(() => {
    if (isChatEvalExpanded(pathname ?? '')) setChatEvalOpen(true)
  }, [pathname])

  return (
    <nav
      className="flex flex-col h-full bg-silicon-slate/50 border-r border-silicon-slate text-foreground"
      aria-label="Admin navigation"
    >
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:px-3 focus:py-2 focus:bg-background focus:rounded focus:outline focus:ring-2 focus:ring-radiant-gold"
      >
        Skip to main content
      </a>
      <div className="flex flex-col gap-1 py-4 pl-3 pr-4 min-w-[220px] overflow-y-auto">
        {/* Dashboard */}
        <Link
          href={ADMIN_NAV.dashboard.href}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            pathname === ADMIN_NAV.dashboard.href
              ? 'bg-radiant-gold/20 text-radiant-gold border-l-2 border-radiant-gold -ml-0.5 pl-3.5'
              : 'text-platinum-white/90 hover:bg-silicon-slate hover:text-foreground'
          }`}
          aria-current={pathname === ADMIN_NAV.dashboard.href ? 'page' : undefined}
        >
          <LayoutDashboard size={18} className="shrink-0" />
          {ADMIN_NAV.dashboard.label}
        </Link>

        {ADMIN_NAV.categories.map((cat) => (
          <div key={cat.label} className="flex flex-col gap-0.5">
            <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-platinum-white/60">
              {cat.label}
            </div>
            {cat.children && cat.expandableItemHref ? (
              <>
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
                              className="flex w-full items-center gap-2 rounded-lg pl-5 pr-3 py-2 text-sm font-medium transition-colors text-left text-platinum-white/90 hover:bg-silicon-slate hover:text-foreground"
                              aria-expanded={expanded}
                              aria-controls={childrenId}
                            >
                              {expanded ? (
                                <ChevronDown size={ITEM_ICON_SIZE} className="shrink-0" />
                              ) : (
                                <ChevronRight size={ITEM_ICON_SIZE} className="shrink-0" />
                              )}
                              <NavItemIcon href={item.href} />
                              {item.label}
                            </button>
                            <div
                              id={childrenId}
                              className="flex flex-col gap-0.5 overflow-hidden"
                              hidden={!expanded}
                            >
                              {expanded &&
                                cat.children!.map((child) => {
                                  const childActive = isNavItemActive(child.href, pathname ?? '')
                                  return (
                                    <Link
                                      key={child.href}
                                      href={child.href}
                                      className={`flex items-center gap-2 ml-5 pl-6 rounded-lg pr-3 py-2 text-sm transition-colors ${
                                        childActive
                                          ? 'bg-radiant-gold/20 text-radiant-gold border-l-2 border-radiant-gold -ml-0.5 pl-5'
                                          : 'text-platinum-white/80 hover:bg-silicon-slate hover:text-foreground'
                                      }`}
                                      aria-current={childActive ? 'page' : undefined}
                                    >
                                      <NavItemIcon href={child.href} />
                                      {child.label}
                                    </Link>
                                  )
                                })}
                            </div>
                          </>
                        ) : (
                          <Link
                            href={item.href}
                            className={`flex items-center gap-2 rounded-lg pl-5 pr-3 py-2 text-sm font-medium transition-colors ${
                              active
                                ? 'bg-radiant-gold/20 text-radiant-gold border-l-2 border-radiant-gold -ml-0.5 pl-5'
                                : 'text-platinum-white/90 hover:bg-silicon-slate hover:text-foreground'
                            }`}
                            aria-current={active ? 'page' : undefined}
                          >
                            <NavItemIcon href={item.href} />
                            {item.label}
                          </Link>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              cat.items.map((item) => {
                const active = isNavItemActive(item.href, pathname ?? '')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 rounded-lg pl-5 pr-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-radiant-gold/20 text-radiant-gold border-l-2 border-radiant-gold -ml-0.5 pl-5'
                        : 'text-platinum-white/90 hover:bg-silicon-slate hover:text-foreground'
                    }`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <NavItemIcon href={item.href} />
                    {item.label}
                  </Link>
                )
              })
            )}
          </div>
        ))}
      </div>
    </nav>
  )
}
