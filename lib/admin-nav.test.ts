import { describe, expect, it } from 'vitest'
import { isChatEvalExpanded, isContentExpanded, isNavItemActive } from './admin-nav'

describe('isNavItemActive', () => {
  it('matches exact routes and nested child routes on path segment boundaries', () => {
    expect(isNavItemActive('/admin/sales', '/admin/sales')).toBe(true)
    expect(isNavItemActive('/admin/sales', '/admin/sales/products')).toBe(true)
    expect(isNavItemActive('/admin/sales', '/admin/salesforce')).toBe(false)
    expect(isNavItemActive('/admin/sales', '/admin/sales-products')).toBe(false)
  })

  it('keeps the admin dashboard exact-only', () => {
    expect(isNavItemActive('/admin', '/admin')).toBe(true)
    expect(isNavItemActive('/admin', '/admin/outreach')).toBe(false)
  })

  it('keeps Mission Control exact-only so Agent Ops details highlight their own links', () => {
    expect(isNavItemActive('/admin/agents', '/admin/agents')).toBe(true)
    expect(isNavItemActive('/admin/agents', '/admin/agents/runs/run-1')).toBe(false)
    expect(isNavItemActive('/admin/agents/runs', '/admin/agents/runs/run-1')).toBe(true)
  })

  it('treats legacy product catalog routes as active under product management', () => {
    expect(isNavItemActive('/admin/products', '/admin/products')).toBe(true)
    expect(isNavItemActive('/admin/products', '/admin/content/products')).toBe(true)
    expect(isNavItemActive('/admin/products', '/admin/content/products/new')).toBe(true)
    expect(isNavItemActive('/admin/products', '/admin/content/productivity')).toBe(false)
  })
})

describe('admin sidebar expandable route helpers', () => {
  it('expands Content Hub for content and product catalog routes only', () => {
    expect(isContentExpanded('/admin/content')).toBe(true)
    expect(isContentExpanded('/admin/content/publications')).toBe(true)
    expect(isContentExpanded('/admin/products')).toBe(true)
    expect(isContentExpanded('/admin/products/sku-1')).toBe(true)
    expect(isContentExpanded('/admin/productivity')).toBe(false)
  })

  it('expands Chat Eval for nested evaluation routes only', () => {
    expect(isChatEvalExpanded('/admin/chat-eval')).toBe(true)
    expect(isChatEvalExpanded('/admin/chat-eval/queues')).toBe(true)
    expect(isChatEvalExpanded('/admin/chat-evaluation')).toBe(false)
  })
})
