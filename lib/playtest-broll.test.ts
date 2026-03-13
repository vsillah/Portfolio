import { describe, expect, it } from 'vitest'
import { DEFAULT_ROUTES, selectRoutesFromScript } from './playtest-broll'

describe('selectRoutesFromScript', () => {
  it('returns all routes when no keywords are present', () => {
    const routes = selectRoutesFromScript(
      'This script covers quarterly revenue forecasting only.',
      DEFAULT_ROUTES
    )
    expect(routes).toEqual(DEFAULT_ROUTES)
  })

  it('matches keywords case-insensitively', () => {
    const routes = selectRoutesFromScript('Show the HOME hero first.', DEFAULT_ROUTES)
    expect(routes.map((r) => r.filename)).toEqual(['screenshot-home'])
  })

  it('returns unique route matches even when overlapping keywords appear', () => {
    const routes = selectRoutesFromScript(
      'Cover admin dashboard, then chat eval and eval recap.',
      DEFAULT_ROUTES
    )
    expect(routes.map((r) => r.filename)).toEqual([
      'screenshot-admin',
      'screenshot-admin-chat-eval',
    ])
  })

  it('preserves route order from the original list', () => {
    const routes = selectRoutesFromScript('Cover store, services, and module sync.', DEFAULT_ROUTES)
    expect(routes.map((r) => r.filename)).toEqual([
      'screenshot-store',
      'screenshot-services',
      'screenshot-admin-module-sync',
    ])
  })
})
