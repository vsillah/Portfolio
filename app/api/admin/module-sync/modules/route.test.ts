import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  getModulesWithConfig: vi.fn(),
  setModuleSpunOffRepoUrl: vi.fn(),
  updateCustomModule: vi.fn(),
  deleteCustomModule: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/module-sync-db', async () => {
  const actual = await vi.importActual<typeof import('@/lib/module-sync-db')>('@/lib/module-sync-db')
  return {
    ...actual,
    getModulesWithConfig: mocks.getModulesWithConfig,
    setModuleSpunOffRepoUrl: mocks.setModuleSpunOffRepoUrl,
    updateCustomModule: mocks.updateCustomModule,
    deleteCustomModule: mocks.deleteCustomModule,
  }
})

import { GET } from './route'
import { PATCH, DELETE } from './[moduleId]/route'

const CUSTOM_ID = '11111111-1111-4111-8111-111111111111'

function makeGet() {
  return new NextRequest('http://localhost/api/admin/module-sync/modules')
}

function makePatch(moduleId: string, body?: string) {
  return new NextRequest(`http://localhost/api/admin/module-sync/modules/${moduleId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body,
  })
}

function makeDelete(moduleId: string) {
  return new NextRequest(`http://localhost/api/admin/module-sync/modules/${moduleId}`, {
    method: 'DELETE',
  })
}

describe('module-sync modules routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.setModuleSpunOffRepoUrl.mockResolvedValue({})
    mocks.updateCustomModule.mockResolvedValue({})
    mocks.deleteCustomModule.mockResolvedValue({})
  })

  it('requires admin auth before listing modules', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeGet())

    expect(response.status).toBe(401)
    expect(mocks.getModulesWithConfig).not.toHaveBeenCalled()
  })

  it('returns the configured module list', async () => {
    mocks.getModulesWithConfig.mockResolvedValue([{ id: 'social', portfolioPath: 'lib/social' }])

    const response = await GET(makeGet())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      modules: [{ id: 'social', portfolioPath: 'lib/social' }],
    })
  })

  it('requires admin auth before updating a module', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await PATCH(makePatch(CUSTOM_ID, JSON.stringify({ name: 'Next' })), {
      params: Promise.resolve({ moduleId: CUSTOM_ID }),
    })

    expect(response.status).toBe(403)
    expect(mocks.updateCustomModule).not.toHaveBeenCalled()
  })

  it('rejects a blank module id and invalid JSON', async () => {
    const blank = await PATCH(makePatch('blank', JSON.stringify({})), {
      params: Promise.resolve({ moduleId: '   ' }),
    })
    const invalid = await PATCH(makePatch(CUSTOM_ID, 'not-json'), {
      params: Promise.resolve({ moduleId: CUSTOM_ID }),
    })

    expect(blank.status).toBe(400)
    expect(await blank.json()).toEqual({ error: 'Missing moduleId' })
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toEqual({ error: 'Invalid JSON body' })
    expect(mocks.updateCustomModule).not.toHaveBeenCalled()
  })

  it('updates a custom module and clears a blank repo URL', async () => {
    const response = await PATCH(
      makePatch(CUSTOM_ID, JSON.stringify({ name: ' Custom ', spunOffRepoUrl: '  ' })),
      { params: Promise.resolve({ moduleId: ` ${CUSTOM_ID} ` }) }
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(mocks.updateCustomModule).toHaveBeenCalledWith(CUSTOM_ID, {
      name: ' Custom ',
      spunOffRepoUrl: null,
    })
    expect(mocks.setModuleSpunOffRepoUrl).not.toHaveBeenCalled()
  })

  it('clears a code-defined repo URL when the field is omitted', async () => {
    const response = await PATCH(makePatch('social', JSON.stringify({})), {
      params: Promise.resolve({ moduleId: 'social' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.setModuleSpunOffRepoUrl).toHaveBeenCalledWith('social', null)
    expect(mocks.updateCustomModule).not.toHaveBeenCalled()
  })

  it('maps custom-module update errors by prefix', async () => {
    mocks.updateCustomModule.mockResolvedValueOnce({ error: 'Unknown module: missing' })
    const unknown = await PATCH(makePatch(CUSTOM_ID, JSON.stringify({ name: 'X' })), {
      params: Promise.resolve({ moduleId: CUSTOM_ID }),
    })
    expect(unknown.status).toBe(404)

    mocks.updateCustomModule.mockResolvedValueOnce({ error: 'Not a custom module' })
    const notCustom = await PATCH(makePatch(CUSTOM_ID, JSON.stringify({ name: 'X' })), {
      params: Promise.resolve({ moduleId: CUSTOM_ID }),
    })
    expect(notCustom.status).toBe(404)

    mocks.updateCustomModule.mockResolvedValueOnce({ error: 'write failed' })
    const failed = await PATCH(makePatch(CUSTOM_ID, JSON.stringify({ name: 'X' })), {
      params: Promise.resolve({ moduleId: CUSTOM_ID }),
    })
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({ error: 'write failed' })
  })

  it('refuses to delete a code-defined module', async () => {
    const response = await DELETE(makeDelete('social'), {
      params: Promise.resolve({ moduleId: 'social' }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Only custom modules can be removed. Code-defined modules cannot be deleted.',
    })
    expect(mocks.deleteCustomModule).not.toHaveBeenCalled()
  })

  it('deletes a custom module and maps lookup failures to 404', async () => {
    const response = await DELETE(makeDelete(CUSTOM_ID), {
      params: Promise.resolve({ moduleId: CUSTOM_ID }),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(mocks.deleteCustomModule).toHaveBeenCalledWith(CUSTOM_ID)

    mocks.deleteCustomModule.mockResolvedValueOnce({ error: 'Unknown module: gone' })
    const missing = await DELETE(makeDelete(CUSTOM_ID), {
      params: Promise.resolve({ moduleId: CUSTOM_ID }),
    })
    expect(missing.status).toBe(404)

    mocks.deleteCustomModule.mockResolvedValueOnce({ error: 'delete failed' })
    const failed = await DELETE(makeDelete(CUSTOM_ID), {
      params: Promise.resolve({ moduleId: CUSTOM_ID }),
    })
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({ error: 'delete failed' })
  })
})
