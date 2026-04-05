'use client'

/**
 * Admin Module Sync — diff portfolio module code vs. spun-off GitHub repo.
 * Config (spun-off repo URL) is managed in the UI and stored in the DB.
 * Supports custom modules (Discover spin-offs), search, Edit/Remove, and 404 handling.
 */

import { useState, useEffect, useCallback } from 'react'
import { GitCompare, RefreshCw, ExternalLink, ChevronDown, ChevronUp, AlertCircle, Save, Upload, Search, Trash2, Plus, Loader2 } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import type { ModuleSyncEntry } from '@/lib/module-sync-config'
import type { ModuleDiffResult, DiffFileResult } from '@/lib/module-sync-diff'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function isCustomModuleId(id: string): boolean {
  return UUID_REGEX.test(id.trim())
}

export interface ScanCandidate {
  path: string
  reason?: string
}

export default function ModuleSyncPage() {
  const [modules, setModules] = useState<ModuleSyncEntry[]>([])
  const [loadingModules, setLoadingModules] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [diffResult, setDiffResult] = useState<ModuleDiffResult | null>(null)
  const [diffLoadingId, setDiffLoadingId] = useState<string | null>(null)
  const [expandedPatches, setExpandedPatches] = useState<Set<string>>(new Set())
  /** Local draft of spun-off URL per module (input value before Save). */
  const [urlDrafts, setUrlDrafts] = useState<Record<string, string>>({})
  /** Local draft of display name for custom modules. */
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pushConfirm, setPushConfirm] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)
  const [pushSuccess, setPushSuccess] = useState<{ workflowUrl: string } | null>(null)
  const [candidates, setCandidates] = useState<ScanCandidate[]>([])
  const [scanLoading, setScanLoading] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [candidateSearch, setCandidateSearch] = useState('')
  const [createModal, setCreateModal] = useState<{ path: string; repoName: string; name: string } | null>(null)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null)
  const [removeLoading, setRemoveLoading] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const fetchModules = useCallback(async () => {
    setLoadingModules(true)
    try {
      const session = await getCurrentSession()
      const res = await fetch('/api/admin/module-sync/modules', {
        credentials: 'include',
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      })
      if (!res.ok) throw new Error(res.statusText)
      const data = await res.json()
      setModules(data.modules ?? [])
    } catch (e) {
      console.error('Failed to fetch modules:', e)
      setModules([])
    } finally {
      setLoadingModules(false)
    }
  }, [])

  useEffect(() => {
    fetchModules()
  }, [fetchModules])

  const runDiff = useCallback(async (moduleId: string) => {
    setDiffLoadingId(moduleId)
    setDiffResult(null)
    setExpandedPatches(new Set())
    setPushConfirm(false)
    setPushError(null)
    setPushSuccess(null)
    try {
      const session = await getCurrentSession()
      const res = await fetch(
        `/api/admin/module-sync/diff?module=${encodeURIComponent(moduleId)}`,
        {
          credentials: 'include',
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
        }
      )
      const data: ModuleDiffResult = await res.json()
      if (!res.ok) {
        setDiffResult({
          ...data,
          moduleId,
          moduleName: modules.find((m) => m.id === moduleId)?.name ?? moduleId,
          portfolioPath: '',
          repoUrl: '',
          repoBranch: '',
          summary: { added: 0, removed: 0, modified: 0, unchanged: 0 },
          files: [],
          error: data.error ?? `Request failed: ${res.status}`,
        })
        return
      }
      setDiffResult(data)
    } catch (e) {
      setDiffResult({
        moduleId,
        moduleName: modules.find((m) => m.id === moduleId)?.name ?? moduleId,
        portfolioPath: '',
        repoUrl: '',
        repoBranch: '',
        summary: { added: 0, removed: 0, modified: 0, unchanged: 0 },
        files: [],
        error: e instanceof Error ? e.message : 'Failed to run diff',
      })
    } finally {
      setDiffLoadingId(null)
    }
  }, [modules])

  const togglePatch = (path: string) => {
    setExpandedPatches((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const currentUrl = (m: ModuleSyncEntry) =>
    urlDrafts[m.id] ?? m.spunOffRepoUrl ?? m.suggestedSpunOffRepoUrl ?? ''

  const pushToSpinoff = useCallback(async () => {
    if (!diffResult?.moduleId) return
    setPushLoading(true)
    setPushError(null)
    setPushSuccess(null)
    try {
      const session = await getCurrentSession()
      const res = await fetch('/api/admin/module-sync/push', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && {
            Authorization: `Bearer ${session.access_token}`,
          }),
        },
        body: JSON.stringify({ moduleId: diffResult.moduleId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPushError(data.error ?? `Push failed: ${res.status}`)
        return
      }
      setPushSuccess({ workflowUrl: data.workflowUrl ?? '#' })
      setPushConfirm(false)
    } catch (e) {
      setPushError(e instanceof Error ? e.message : 'Failed to trigger push')
    } finally {
      setPushLoading(false)
    }
  }, [diffResult?.moduleId])

  const filteredModules = searchQuery.trim()
    ? modules.filter(
        (m) =>
          m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.portfolioPath.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : modules

  const filteredCandidates = candidateSearch.trim()
    ? candidates.filter(
        (c) =>
          c.path.toLowerCase().includes(candidateSearch.toLowerCase())
      )
    : candidates

  const runScan = useCallback(async () => {
    setScanLoading(true)
    setScanError(null)
    setCandidates([])
    try {
      const session = await getCurrentSession()
      const res = await fetch('/api/admin/module-sync/scan', {
        credentials: 'include',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setScanError(data.error ?? `Scan failed: ${res.status}`)
        return
      }
      setCandidates(data.candidates ?? [])
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Scan failed')
    } finally {
      setScanLoading(false)
    }
  }, [])

  const openCreateModal = (path: string) => {
    const segment = path.replace(/\/+$/, '').split('/').pop() ?? path
    const repoName = segment.replace(/[^a-zA-Z0-9_.-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'repo'
    setCreateModal({ path, repoName, name: segment })
    setCreateError(null)
  }

  const doCreateRepo = useCallback(async () => {
    if (!createModal) return
    setCreateLoading(true)
    setCreateError(null)
    try {
      const session = await getCurrentSession()
      const res = await fetch('/api/admin/module-sync/create-repo', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({
          portfolioPath: createModal.path,
          repoName: createModal.repoName.trim() || undefined,
          name: createModal.name.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCreateError(data.error ?? `Create failed: ${res.status}`)
        return
      }
      setCreateModal(null)
      await fetchModules()
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setCreateLoading(false)
    }
  }, [createModal, fetchModules])

  const removeCustomModule = useCallback(async (moduleId: string) => {
    setRemoveLoading(true)
    setRemoveError(null)
    try {
      const session = await getCurrentSession()
      const res = await fetch(`/api/admin/module-sync/modules/${encodeURIComponent(moduleId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setRemoveError(data.error ?? `Remove failed: ${res.status}`)
        return
      }
      setRemoveConfirmId(null)
      setRemoveError(null)
      if (diffResult?.moduleId === moduleId) {
        setDiffResult(null)
        setPushConfirm(false)
        setPushError(null)
        setPushSuccess(null)
      }
      await fetchModules()
    } catch (e) {
      setRemoveError(e instanceof Error ? e.message : 'Remove failed')
    } finally {
      setRemoveLoading(false)
    }
  }, [diffResult?.moduleId, fetchModules])

  const saveSpunOffUrl = useCallback(async (moduleId: string) => {
    const m = modules.find((x) => x.id === moduleId)
    const urlValue = m ? (urlDrafts[moduleId] ?? m.spunOffRepoUrl ?? '') : ''
    const nameValue = nameDrafts[moduleId] ?? m?.name ?? ''
    setSavingId(moduleId)
    setSaveError(null)
    try {
      const session = await getCurrentSession()
      const body: { spunOffRepoUrl?: string | null; name?: string } = {
        spunOffRepoUrl: urlValue.trim() || null,
      }
      if (isCustomModuleId(moduleId) && nameValue.trim()) body.name = nameValue.trim()
      const res = await fetch(`/api/admin/module-sync/modules/${encodeURIComponent(moduleId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && {
            Authorization: `Bearer ${session.access_token}`,
          }),
        },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSaveError(data.error ?? `Save failed: ${res.status}`)
        return
      }
      setUrlDrafts((prev) => {
        const next = { ...prev }
        delete next[moduleId]
        return next
      })
      setNameDrafts((prev) => {
        const next = { ...prev }
        delete next[moduleId]
        return next
      })
      setSaveError(null)
      await fetchModules()
    } finally {
      setSavingId(null)
    }
  }, [modules, urlDrafts, nameDrafts, fetchModules])

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="max-w-6xl mx-auto">
          <Breadcrumbs
            items={[
              { label: 'Admin Dashboard', href: '/admin' },
              { label: 'Module Sync' },
            ]}
          />

          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Module Sync</h1>
            <p className="text-muted-foreground">
              Set each module’s spun-off GitHub repo below, then run a diff to compare portfolio code
              with the repo and keep them in sync.
            </p>
          </div>

          {saveError && (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm flex items-center gap-2">
              <AlertCircle size={18} />
              {saveError}
            </div>
          )}

          <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Modules</h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/90" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or path…"
                    className="pl-8 pr-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-foreground placeholder:text-muted-foreground/80 focus:border-cyan-500/50 focus:outline-none text-sm w-56"
                  />
                </div>
                <button
                  type="button"
                  onClick={fetchModules}
                  disabled={loadingModules}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm disabled:opacity-50"
                >
                  <RefreshCw size={16} className={loadingModules ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
            </div>

            {loadingModules ? (
              <div className="p-8 text-center text-muted-foreground">Loading modules…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-sm text-muted-foreground">
                      <th className="p-3 font-medium">Name</th>
                      <th className="p-3 font-medium">Portfolio path</th>
                      <th className="p-3 font-medium">Spun-off repo (GitHub URL)</th>
                      <th className="p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredModules.map((m) => {
                      const url = currentUrl(m)
                      const hasUrl = url.trim().length > 0
                      const custom = isCustomModuleId(m.id)
                      const displayName = nameDrafts[m.id] ?? m.name
                      return (
                        <tr key={m.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="p-3 font-medium">
                            {custom ? (
                              <input
                                type="text"
                                value={displayName}
                                onChange={(e) => {
                                  setSaveError(null)
                                  setNameDrafts((prev) => ({ ...prev, [m.id]: e.target.value }))
                                }}
                                className="px-2 py-1 rounded bg-white/10 border border-white/20 text-foreground text-sm w-40 focus:border-cyan-500/50 focus:outline-none"
                              />
                            ) : (
                              m.name
                            )}
                          </td>
                          <td className="p-3 text-sm text-muted-foreground font-mono">
                            {m.portfolioPath}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="url"
                                value={url}
                                onChange={(e) => {
                                  setSaveError(null)
                                  setUrlDrafts((prev) => ({ ...prev, [m.id]: e.target.value }))
                                }}
                                placeholder={m.suggestedSpunOffRepoUrl ?? 'https://github.com/owner/repo'}
                                className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-foreground placeholder:text-muted-foreground/80 focus:border-cyan-500/50 focus:outline-none text-sm font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => saveSpunOffUrl(m.id)}
                                disabled={savingId !== null}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm disabled:opacity-50"
                              >
                                <Save size={14} />
                                {savingId === m.id ? 'Saving…' : 'Save'}
                              </button>
                              {hasUrl && (
                                <a
                                  href={url.trim()}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-cyan-400 hover:underline p-1"
                                  title="Open repo"
                                >
                                  <ExternalLink size={16} />
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => runDiff(m.id)}
                                disabled={!currentUrl(m).trim() || diffLoadingId !== null}
                                title={!currentUrl(m).trim() ? 'Enter or save a spun-off repo URL' : undefined}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <GitCompare size={16} />
                                {diffLoadingId === m.id ? 'Running…' : 'Run diff'}
                              </button>
                              {custom && (
                                removeConfirmId === m.id ? (
                                  <span className="flex items-center gap-2 text-sm">
                                    <button
                                      type="button"
                                      onClick={() => removeCustomModule(m.id)}
                                      disabled={removeLoading}
                                      className="px-2 py-1 rounded bg-red-500/20 text-red-300 text-sm disabled:opacity-50"
                                    >
                                      {removeLoading ? 'Removing…' : 'Confirm remove'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setRemoveConfirmId(null)}
                                      disabled={removeLoading}
                                      className="px-2 py-1 rounded bg-white/10 text-sm"
                                    >
                                      Cancel
                                    </button>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setRemoveConfirmId(m.id)}
                                    title="Removes from list only; does not delete the GitHub repo."
                                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/10 hover:bg-red-500/20 text-muted-foreground hover:text-red-300 text-sm"
                                  >
                                    <Trash2 size={14} />
                                    Remove
                                  </button>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {removeError && (
            <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm flex items-center gap-2">
              <AlertCircle size={18} />
              {removeError}
            </div>
          )}

          <div className="mt-8 rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Discover spin-offs</h2>
              <button
                type="button"
                onClick={runScan}
                disabled={scanLoading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-sm disabled:opacity-50"
              >
                {scanLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                {scanLoading ? 'Scanning…' : 'Scan'}
              </button>
            </div>
            {scanError && (
              <div className="p-3 border-b border-white/10 text-amber-200 text-sm flex items-center gap-2">
                <AlertCircle size={18} />
                {scanError}
              </div>
            )}
            {candidates.length > 0 && (
              <>
                <div className="p-3 border-b border-white/10">
                  <input
                    type="text"
                    value={candidateSearch}
                    onChange={(e) => setCandidateSearch(e.target.value)}
                    placeholder="Filter candidates…"
                    className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-foreground placeholder:text-muted-foreground/80 text-sm w-64 focus:border-cyan-500/50 focus:outline-none"
                  />
                </div>
                <ul className="divide-y divide-white/5 max-h-48 overflow-y-auto">
                  {filteredCandidates.map((c) => (
                    <li key={c.path} className="p-3 flex items-center justify-between gap-2">
                      <span className="font-mono text-sm text-foreground/90">{c.path}</span>
                      {c.reason && (
                        <span className="text-xs text-muted-foreground/90 truncate max-w-[200px]">{c.reason}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => openCreateModal(c.path)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30 text-sm shrink-0"
                      >
                        <Plus size={14} />
                        Create repo & add module
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {!scanLoading && candidates.length === 0 && !scanError && (
              <div className="p-6 text-center text-muted-foreground text-sm">
                Click Scan to discover portfolio paths that look like spin-off candidates.
              </div>
            )}
          </div>

          {createModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => !createLoading && setCreateModal(null)}>
              <div className="rounded-xl border border-white/10 bg-background p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-semibold mb-4">Create repo & add module</h3>
                <p className="text-sm text-muted-foreground mb-2 font-mono">{createModal.path}</p>
                <div className="space-y-3">
                  <label className="block text-sm font-medium">Repo name</label>
                  <input
                    type="text"
                    value={createModal.repoName}
                    onChange={(e) => setCreateModal((prev) => prev ? { ...prev, repoName: e.target.value } : null)}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-foreground text-sm font-mono focus:border-cyan-500/50 focus:outline-none"
                  />
                  <label className="block text-sm font-medium">Display name</label>
                  <input
                    type="text"
                    value={createModal.name}
                    onChange={(e) => setCreateModal((prev) => prev ? { ...prev, name: e.target.value } : null)}
                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-foreground text-sm focus:border-cyan-500/50 focus:outline-none"
                  />
                </div>
                {createError && (
                  <p className="mt-3 text-sm text-amber-200 flex items-center gap-2">
                    <AlertCircle size={16} />
                    {createError}
                  </p>
                )}
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => !createLoading && setCreateModal(null)}
                    disabled={createLoading}
                    className="px-3 py-1.5 rounded-lg bg-white/10 text-sm disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={doCreateRepo}
                    disabled={createLoading}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30 text-sm disabled:opacity-50"
                  >
                    {createLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                    Create & add
                  </button>
                </div>
              </div>
            </div>
          )}

          {diffResult && (
            <div className="mt-8 rounded-xl border border-white/10 bg-white/5 overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-semibold">
                  Diff: {diffResult.moduleName}
                  {diffResult.repoBranch && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      vs. {diffResult.repoUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')} (
                      {diffResult.repoBranch})
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  {!diffResult.error && (
                    !pushConfirm ? (
                      <button
                        type="button"
                        onClick={() => setPushConfirm(true)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30 text-sm"
                      >
                        <Upload size={16} />
                        Push to spin-off
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setPushConfirm(false)}
                          disabled={pushLoading}
                          className="px-3 py-1.5 rounded-lg bg-white/10 text-sm disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={pushToSpinoff}
                          disabled={pushLoading}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30 text-sm disabled:opacity-50"
                        >
                          <Upload size={16} />
                          {pushLoading ? 'Triggering…' : 'Trigger sync'}
                        </button>
                      </>
                    )
                  )}
                  {diffResult.repoUrl && (
                    <a
                      href={diffResult.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      Open repo <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>

              {!diffResult.error && (pushError || pushSuccess) && (
                <div
                  className={`p-4 border-b border-white/10 flex items-start gap-3 text-sm ${
                    pushSuccess
                      ? 'text-green-200 bg-green-500/10'
                      : 'text-amber-200 bg-amber-500/10'
                  }`}
                >
                  {pushSuccess ? (
                    <>
                      <span>Workflow triggered.</span>
                      <a
                        href={pushSuccess.workflowUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:underline flex items-center gap-1"
                      >
                        View runs <ExternalLink size={14} />
                      </a>
                    </>
                  ) : (
                    <p>{pushError}</p>
                  )}
                </div>
              )}

              {diffResult.error ? (
                <div className="p-6 flex items-start gap-3 text-amber-200 bg-amber-500/10 border-b border-white/10">
                  <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p>{diffResult.error}</p>
                    {diffResult.repoNotFound && isCustomModuleId(diffResult.moduleId) && (
                      <button
                        type="button"
                        onClick={() => removeCustomModule(diffResult.moduleId)}
                        disabled={removeLoading}
                        className="mt-3 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-red-500/20 text-sm disabled:opacity-50"
                      >
                        {removeLoading ? 'Removing…' : 'Remove from module list'}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-4 border-b border-white/10 flex flex-wrap gap-4 text-sm">
                    <span>
                      <strong className="text-green-400">{diffResult.summary.added}</strong> added
                    </span>
                    <span>
                      <strong className="text-red-400">{diffResult.summary.removed}</strong> removed
                    </span>
                    <span>
                      <strong className="text-amber-400">{diffResult.summary.modified}</strong>{' '}
                      modified
                    </span>
                    <span>
                      <strong className="text-muted-foreground">
                        {diffResult.summary.unchanged}
                      </strong>{' '}
                      unchanged
                    </span>
                  </div>

                  <div className="divide-y divide-white/5 max-h-[60vh] overflow-y-auto">
                    {diffResult.files
                      .filter((f) => f.status !== 'unchanged')
                      .map((f) => (
                        <DiffFileRow
                          key={f.path}
                          file={f}
                          expanded={expandedPatches.has(f.path)}
                          onToggle={() => togglePatch(f.path)}
                        />
                      ))}
                    {diffResult.files.every((f) => f.status === 'unchanged') && (
                      <div className="p-6 text-center text-muted-foreground">
                        No differences — portfolio and repo are in sync.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}

function DiffFileRow({
  file,
  expanded,
  onToggle,
}: {
  file: DiffFileResult
  expanded: boolean
  onToggle: () => void
}) {
  const statusColor =
    file.status === 'added'
      ? 'text-green-400'
      : file.status === 'removed'
        ? 'text-red-400'
        : 'text-amber-400'

  return (
    <div className="p-3">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 text-left hover:bg-white/5 rounded-lg p-2 -m-2"
      >
        {expanded ? (
          <ChevronUp size={18} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={18} className="text-muted-foreground" />
        )}
        <span className="font-mono text-sm">{file.path}</span>
        <span className={`text-sm font-medium ${statusColor}`}>({file.status})</span>
      </button>
      {expanded && file.patch && (
        <pre className="mt-2 p-4 rounded-lg bg-black/30 text-xs overflow-x-auto whitespace-pre font-mono border border-white/10">
          {file.patch.split('\n').map((line, i) => (
            <div
              key={i}
              className={
                line.startsWith('+') && !line.startsWith('+++')
                  ? 'text-green-400'
                  : line.startsWith('-') && !line.startsWith('---')
                    ? 'text-red-400'
                    : 'text-muted-foreground'
              }
            >
              {line}
            </div>
          ))}
        </pre>
      )}
      {expanded && (file.status === 'added' || file.status === 'removed') && !file.patch && (
        <pre className="mt-2 p-4 rounded-lg bg-black/30 text-xs overflow-x-auto whitespace-pre font-mono border border-white/10 max-h-48 overflow-y-auto">
          {(file.portfolioContent ?? file.repoContent ?? '').slice(0, 8000)}
          {(file.portfolioContent ?? file.repoContent ?? '').length > 8000 ? '\n… (truncated)' : ''}
        </pre>
      )}
    </div>
  )
}
