'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Cpu, Check, AlertTriangle, RefreshCw } from 'lucide-react'
import { getCurrentSession } from '@/lib/auth'

interface Technology {
  name: string
  tag?: string | null
  categories?: string[]
  parent?: string | null
}

interface StackBlob {
  domain?: string | null
  technologies?: Technology[]
  byTag?: Record<string, string[]>
  creditsRemaining?: number | null
  resolved_at?: string
  resolved_by?: string
}

interface Response {
  contactSubmissionId: number
  builtwith: StackBlob | null
  audit: StackBlob | null
  verified: StackBlob | null
}

type SourceChoice = 'builtwith' | 'audit' | 'both'

interface ConflictRow {
  tag: string
  bwNames: string[]
  auditNames: string[]
  choice: SourceChoice
}

function readTechnologies(blob: StackBlob | null): Technology[] {
  if (!blob || !Array.isArray(blob.technologies)) return []
  return blob.technologies
}

function technologiesByTag(techs: Technology[]): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const t of techs) {
    const tag = t.tag ?? 'Other'
    if (!out[tag]) out[tag] = []
    if (!out[tag].includes(t.name)) out[tag].push(t.name)
  }
  return out
}

function computeConflicts(bw: Technology[], audit: Technology[]): ConflictRow[] {
  const bwByTag = technologiesByTag(bw)
  const auditByTag = technologiesByTag(audit)
  const allTags = new Set([...Object.keys(bwByTag), ...Object.keys(auditByTag)])
  const rows: ConflictRow[] = []
  for (const tag of allTags) {
    const bwNames = bwByTag[tag] ?? []
    const auditNames = auditByTag[tag] ?? []
    const bwSet = new Set(bwNames.map((n) => n.toLowerCase()))
    const auditSet = new Set(auditNames.map((n) => n.toLowerCase()))
    const differs =
      bwNames.length !== auditNames.length ||
      bwNames.some((n) => !auditSet.has(n.toLowerCase())) ||
      auditNames.some((n) => !bwSet.has(n.toLowerCase()))
    if (!differs) continue
    rows.push({ tag, bwNames, auditNames, choice: 'both' })
  }
  return rows.sort((a, b) => a.tag.localeCompare(b.tag))
}

interface TechStackVerificationCardProps {
  contactSubmissionId: number
}

export default function TechStackVerificationCard({ contactSubmissionId }: TechStackVerificationCardProps) {
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [conflicts, setConflicts] = useState<ConflictRow[]>([])
  const [manualOverride, setManualOverride] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveOk, setSaveOk] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) return
      const res = await fetch(
        `/api/admin/contact-submissions/${contactSubmissionId}/verified-tech-stack`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      )
      if (!res.ok) return
      const json = (await res.json()) as Response
      setData(json)
      const bwTechs = readTechnologies(json.builtwith)
      const auditTechs = readTechnologies(json.audit)
      setConflicts(computeConflicts(bwTechs, auditTechs))
    } finally {
      setLoading(false)
    }
  }, [contactSubmissionId])

  useEffect(() => {
    load()
  }, [load])

  const credits = data?.builtwith?.creditsRemaining
  const creditBadge = useMemo(() => {
    if (credits === null || credits === undefined) {
      return { label: 'BuiltWith credits: unknown', tone: 'muted' as const }
    }
    if (credits <= 0) return { label: 'BuiltWith credits: 0', tone: 'danger' as const }
    if (credits < 25) return { label: `BuiltWith credits: ${credits}`, tone: 'warn' as const }
    return { label: `BuiltWith credits: ${credits}`, tone: 'ok' as const }
  }, [credits])

  const hasBuiltWith = (data?.builtwith?.technologies?.length ?? 0) > 0
  const hasAudit = (data?.audit?.technologies?.length ?? 0) > 0
  const hasVerified = (data?.verified?.technologies?.length ?? 0) > 0

  function updateChoice(tag: string, choice: SourceChoice) {
    setConflicts((prev) => prev.map((c) => (c.tag === tag ? { ...c, choice } : c)))
  }

  async function saveVerified() {
    if (!data) return
    setSaving(true)
    setSaveError(null)
    setSaveOk(null)
    try {
      const bwTechs = readTechnologies(data.builtwith)
      const auditTechs = readTechnologies(data.audit)
      const selected: Technology[] = []
      const seen = new Set<string>()

      const pushTech = (t: Technology) => {
        const key = `${(t.tag ?? 'Other').toLowerCase()}::${t.name.toLowerCase()}`
        if (seen.has(key)) return
        seen.add(key)
        selected.push({ name: t.name, tag: t.tag ?? null, categories: t.categories, parent: t.parent ?? null })
      }

      // For tags with no conflicts, include whatever both sources say.
      const conflictTags = new Set(conflicts.map((c) => c.tag))
      for (const t of bwTechs) if (!conflictTags.has(t.tag ?? 'Other')) pushTech(t)
      for (const t of auditTechs) if (!conflictTags.has(t.tag ?? 'Other')) pushTech(t)

      // Apply conflict resolutions.
      for (const c of conflicts) {
        if (c.choice === 'builtwith' || c.choice === 'both') {
          for (const t of bwTechs) if ((t.tag ?? 'Other') === c.tag) pushTech(t)
        }
        if (c.choice === 'audit' || c.choice === 'both') {
          for (const t of auditTechs) if ((t.tag ?? 'Other') === c.tag) pushTech(t)
        }
      }

      // Parse manual overrides: one per line, "name" or "name:tag".
      for (const raw of manualOverride.split('\n')) {
        const line = raw.trim()
        if (!line) continue
        const [name, tag] = line.split(':').map((s) => s.trim())
        if (!name) continue
        pushTech({ name, tag: tag || 'Other' })
      }

      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('No session')
      const res = await fetch(
        `/api/admin/contact-submissions/${contactSubmissionId}/verified-tech-stack`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ technologies: selected }),
        }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error ?? 'Save failed')
      }
      setSaveOk(`Saved ${selected.length} technologies as verified.`)
      setManualOverride('')
      await load()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function clearVerified() {
    setSaving(true)
    setSaveError(null)
    setSaveOk(null)
    try {
      const session = await getCurrentSession()
      if (!session?.access_token) throw new Error('No session')
      const res = await fetch(
        `/api/admin/contact-submissions/${contactSubmissionId}/verified-tech-stack`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ clear: true }),
        }
      )
      if (!res.ok) throw new Error('Clear failed')
      setSaveOk('Cleared admin-verified stack.')
      await load()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Clear failed')
    } finally {
      setSaving(false)
    }
  }

  if (!data && !loading) return null

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 text-white font-medium hover:text-blue-300"
        >
          <Cpu className="w-5 h-5 text-blue-400" />
          Client tech stack (admin-verified)
          <span className="text-xs text-gray-400 font-normal">
            {hasVerified ? 'verified' : hasBuiltWith || hasAudit ? 'sources loaded' : 'no data'}
          </span>
        </button>
        <div className="flex items-center gap-2">
          <span
            className={
              creditBadge.tone === 'danger'
                ? 'text-xs px-2 py-0.5 rounded border border-red-500/50 bg-red-500/15 text-red-300'
                : creditBadge.tone === 'warn'
                  ? 'text-xs px-2 py-0.5 rounded border border-amber-500/50 bg-amber-500/15 text-amber-300'
                  : creditBadge.tone === 'ok'
                    ? 'text-xs px-2 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'text-xs px-2 py-0.5 rounded border border-gray-700 bg-gray-800 text-gray-400'
            }
          >
            {creditBadge.label}
          </span>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {!expanded && (
        <div className="text-xs text-gray-400">
          {hasVerified && (
            <div className="flex items-center gap-1.5 text-emerald-400">
              <Check className="w-3.5 h-3.5" />
              Admin verified ({data?.verified?.technologies?.length ?? 0} techs)
            </div>
          )}
          {!hasVerified && conflicts.length > 0 && (
            <div className="flex items-center gap-1.5 text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              {conflicts.length} category conflict{conflicts.length === 1 ? '' : 's'} between BuiltWith and audit
            </div>
          )}
          {!hasVerified && conflicts.length === 0 && (hasBuiltWith || hasAudit) && (
            <div>Sources agree — click to review or override.</div>
          )}
          {!hasBuiltWith && !hasAudit && <div>No BuiltWith or audit tech stack on file.</div>}
        </div>
      )}

      {expanded && data && (
        <div className="space-y-4 mt-2">
          {conflicts.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-gray-400">Resolve conflicts</div>
              {conflicts.map((c) => (
                <div
                  key={c.tag}
                  className="rounded border border-gray-800 bg-gray-950/60 p-3 space-y-2"
                >
                  <div className="text-sm font-medium text-white">{c.tag}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-gray-400 mb-1">BuiltWith</div>
                      <div className="text-gray-200">{c.bwNames.join(', ') || <em className="text-gray-500">none</em>}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 mb-1">Audit self-report</div>
                      <div className="text-gray-200">{c.auditNames.join(', ') || <em className="text-gray-500">none</em>}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    {(['builtwith', 'audit', 'both'] as const).map((opt) => (
                      <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          checked={c.choice === opt}
                          onChange={() => updateChoice(c.tag, opt)}
                          className="accent-blue-500"
                        />
                        <span className="text-gray-300 capitalize">
                          {opt === 'builtwith' ? 'BuiltWith only' : opt === 'audit' ? 'Audit only' : 'Merge both'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="text-xs uppercase tracking-wide text-gray-400 block mb-1">
              Manual override (optional, one per line, format <code className="px-1 bg-gray-800 rounded">name:tag</code>)
            </label>
            <textarea
              value={manualOverride}
              onChange={(e) => setManualOverride(e.target.value)}
              rows={3}
              placeholder={'e.g.\nHubSpot:CRM\nIntercom:Live Chat'}
              className="w-full text-xs rounded border border-gray-800 bg-gray-950 p-2 text-gray-200 placeholder-gray-600"
            />
          </div>

          {saveError && <div className="text-xs text-red-400">{saveError}</div>}
          {saveOk && <div className="text-xs text-emerald-400">{saveOk}</div>}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={saveVerified}
              disabled={saving || (!hasBuiltWith && !hasAudit && !manualOverride.trim())}
              className="px-3 py-1.5 text-xs font-medium rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save as admin-verified'}
            </button>
            {hasVerified && (
              <button
                type="button"
                onClick={clearVerified}
                disabled={saving}
                className="px-3 py-1.5 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-50"
              >
                Clear verified
              </button>
            )}
          </div>

          {hasVerified && (
            <div className="text-[11px] text-gray-500">
              Verified at {data.verified?.resolved_at?.slice(0, 16).replace('T', ' ')} · Precedence: verified
              &gt; audit &gt; BuiltWith
            </div>
          )}
        </div>
      )}
    </div>
  )
}
