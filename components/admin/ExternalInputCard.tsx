'use client'

import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import {
  Database,
  Upload,
  X,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Plus,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExternalInputSlot = 'thirdPartyFindings' | 'competitorPlatform' | 'siteCrawlData'

export interface AuditFindingsPreview {
  summary: string | null
  insights: string[]
  actions: string[]
  categories: Record<string, unknown>
  scores: { urgency: number | null; opportunity: number | null }
  painPointExcerpts: { id: string; excerpt: string; categoryId: string }[]
}

export interface MarketIntelItem {
  id: string
  text: string
  platform: string | null
  type: string | null
  industry: string | null
  sentiment: number | null
  relevance: number | null
}

export interface ReportContextPreview {
  auditFindings: AuditFindingsPreview | null
  marketIntel: MarketIntelItem[]
  techStack: Record<string, unknown> | null
  companyDomain: string | null
  contactIndustry: string | null
}

interface UploadedFile {
  filename: string
  mimeType: string
  text: string
  pages?: number
  wordCount?: number
}

interface ExternalInputCardProps {
  title: string
  slot: ExternalInputSlot
  previewData: ReportContextPreview | null
  loading?: boolean
  onChange: (assembledText: string | undefined) => void
  getToken: () => Promise<string>
  /** Increment to expand this card (e.g. parent "Expand all"). */
  expandAllSignal?: number
  /** Increment to collapse this card (e.g. parent "Collapse all"). */
  collapseAllSignal?: number
}

type CheckableKey = string

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCategoryData(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const entries = Object.entries(data as Record<string, unknown>)
  if (entries.length === 0) return ''
  return entries
    .map(([key, value]) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      if (Array.isArray(value)) return `${label}: ${value.join(', ')}`
      if (typeof value === 'object' && value !== null) {
        const sub = Object.entries(value as Record<string, unknown>)
          .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v)}`)
          .join('; ')
        return `${label}: ${sub}`
      }
      return `${label}: ${String(value)}`
    })
    .join('\n')
}

function techName(item: unknown): string {
  if (typeof item === 'string') return item
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>
    return String(obj.name ?? obj.Name ?? '')
  }
  return String(item)
}

function formatTechStack(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const ts = data as Record<string, unknown>
  const parts: string[] = []
  if (ts.domain) parts.push(`Domain: ${ts.domain}`)
  if (ts.technologies && Array.isArray(ts.technologies)) {
    const names = ts.technologies.map(techName).filter(Boolean)
    if (names.length) parts.push(`Technologies (${names.length}): ${names.join(', ')}`)
  }
  if (ts.byTag && typeof ts.byTag === 'object') {
    const tags = Object.entries(ts.byTag as Record<string, unknown>)
    for (const [tag, values] of tags) {
      const label = tag.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      parts.push(`${label}: ${Array.isArray(values) ? values.map(techName).filter(Boolean).join(', ') : String(values)}`)
    }
  }
  return parts.join('\n')
}

// ---------------------------------------------------------------------------
// Slot-specific DB fragment builders
// ---------------------------------------------------------------------------

function getAuditFindingsFragments(preview: ReportContextPreview) {
  const af = preview.auditFindings
  if (!af) return []

  const fragments: { key: CheckableKey; label: string; text: string }[] = []

  if (af.summary) {
    fragments.push({ key: 'summary', label: 'Diagnostic Summary', text: af.summary })
  }
  if (af.insights.length > 0) {
    fragments.push({
      key: 'insights',
      label: `Key Insights (${af.insights.length})`,
      text: af.insights.map((i) => `- ${i}`).join('\n'),
    })
  }
  if (af.actions.length > 0) {
    fragments.push({
      key: 'actions',
      label: `Recommended Actions (${af.actions.length})`,
      text: af.actions.map((a) => `- ${a}`).join('\n'),
    })
  }

  const catNames = [
    'business_challenges', 'tech_stack', 'automation_needs',
    'ai_readiness', 'budget_timeline', 'decision_making',
  ] as const
  for (const cat of catNames) {
    const catData = af.categories[cat]
    if (catData && typeof catData === 'object' && Object.keys(catData as object).length > 0) {
      const label = cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      fragments.push({ key: `cat_${cat}`, label, text: formatCategoryData(catData) })
    }
  }

  if (af.painPointExcerpts.length > 0) {
    fragments.push({
      key: 'pain_excerpts',
      label: `Pain Point Evidence (${af.painPointExcerpts.length})`,
      text: af.painPointExcerpts.map((p) => `- ${p.excerpt}`).join('\n'),
    })
  }

  return fragments
}

function getCompetitorFragments(preview: ReportContextPreview) {
  const fragments: { key: CheckableKey; label: string; text: string }[] = []

  if (preview.marketIntel.length > 0) {
    for (const mi of preview.marketIntel) {
      const platformLabel = mi.platform || 'Unknown'
      const typeLabel = mi.type || 'post'
      fragments.push({
        key: `mi_${mi.id}`,
        label: `${platformLabel} ${typeLabel}${mi.relevance != null ? ` (relevance: ${mi.relevance})` : ''}`,
        text: mi.text,
      })
    }
  }

  if (preview.techStack) {
    const tsText = formatTechStack(preview.techStack)
    if (tsText) {
      fragments.push({ key: 'tech_stack', label: 'Website Tech Stack (BuiltWith)', text: tsText })
    }
  }

  return fragments
}

function getSiteDataFragments(preview: ReportContextPreview) {
  const fragments: { key: CheckableKey; label: string; text: string }[] = []

  if (preview.companyDomain) {
    fragments.push({ key: 'domain', label: 'Company Domain', text: preview.companyDomain })
  }
  if (preview.techStack) {
    const ts = preview.techStack as Record<string, unknown>
    if (ts.technologies && Array.isArray(ts.technologies)) {
      const names = ts.technologies.map(techName).filter(Boolean)
      if (names.length) {
        fragments.push({
          key: 'tech_stack_all',
          label: `All Technologies (${names.length})`,
          text: names.join(', '),
        })
      }
    }
    if (ts.byTag && typeof ts.byTag === 'object') {
      for (const [tag, values] of Object.entries(ts.byTag as Record<string, unknown>)) {
        const label = tag.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        const names = Array.isArray(values) ? values.map(techName).filter(Boolean) : []
        if (names.length) {
          fragments.push({ key: `tag_${tag}`, label: `${label} (${names.length})`, text: names.join(', ') })
        }
      }
    }
    if (fragments.length <= 1) {
      const tsText = formatTechStack(ts)
      if (tsText) {
        fragments.push({ key: 'tech_stack_site', label: 'Website Tech Stack', text: tsText })
      }
    }
  }

  return fragments
}

function getFragmentsForSlot(slot: ExternalInputSlot, preview: ReportContextPreview) {
  switch (slot) {
    case 'thirdPartyFindings':
      return getAuditFindingsFragments(preview)
    case 'competitorPlatform':
      return getCompetitorFragments(preview)
    case 'siteCrawlData':
      return getSiteDataFragments(preview)
  }
}

const SLOT_EMPTY_MESSAGES: Record<ExternalInputSlot, string> = {
  thirdPartyFindings: 'No diagnostic audit data available for this contact. Upload a file instead.',
  competitorPlatform: 'No market intelligence found. Upload competitor research or platform info.',
  siteCrawlData: 'No site/tech data found for this contact. Upload crawl results or analytics.',
}

const ACCEPTED_FILE_TYPES = '.pdf,.docx,.doc,.pptx,.ppt,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExternalInputCard({
  title,
  slot,
  previewData,
  loading,
  onChange,
  getToken,
  expandAllSignal = 0,
  collapseAllSignal = 0,
}: ExternalInputCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [checked, setChecked] = useState<Record<CheckableKey, boolean>>({})
  const [hasInitialized, setHasInitialized] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastExpandSignal = useRef(0)
  const lastCollapseSignal = useRef(0)

  useEffect(() => {
    if (expandAllSignal > lastExpandSignal.current) {
      lastExpandSignal.current = expandAllSignal
      setExpanded(true)
    }
  }, [expandAllSignal])

  useEffect(() => {
    if (collapseAllSignal > lastCollapseSignal.current) {
      lastCollapseSignal.current = collapseAllSignal
      setExpanded(false)
    }
  }, [collapseAllSignal])

  const fragments = useMemo(
    () => (previewData ? getFragmentsForSlot(slot, previewData) : []),
    [previewData, slot]
  )

  // Auto-check all fragments on first load
  if (previewData && fragments.length > 0 && !hasInitialized) {
    const initial: Record<CheckableKey, boolean> = {}
    for (const f of fragments) initial[f.key] = true
    setChecked(initial)
    setHasInitialized(true)
  }

  // Reset when preview data changes (different contact selected)
  const prevPreviewRef = useRef(previewData)
  if (previewData !== prevPreviewRef.current) {
    prevPreviewRef.current = previewData
    setHasInitialized(false)
    setChecked({})
  }

  const assembleText = useCallback(
    (currentChecked: Record<CheckableKey, boolean>, currentFiles: UploadedFile[]) => {
      const parts: string[] = []

      const selectedFragments = fragments.filter((f) => currentChecked[f.key])
      if (selectedFragments.length > 0) {
        parts.push('── From Database ──')
        for (const f of selectedFragments) {
          parts.push(`${f.label}:\n${f.text}`)
        }
      }

      if (currentFiles.length > 0) {
        parts.push('── From Uploaded Files ──')
        for (const uf of currentFiles) {
          parts.push(`[Extracted from: ${uf.filename}]\n${uf.text}`)
        }
      }

      const assembled = parts.length > 0 ? parts.join('\n\n') : undefined
      onChange(assembled)
    },
    [fragments, onChange]
  )

  function handleCheckChange(key: CheckableKey, value: boolean) {
    const next = { ...checked, [key]: value }
    setChecked(next)
    assembleText(next, uploadedFiles)
  }

  function handleCheckAll(selectAll: boolean) {
    const next: Record<CheckableKey, boolean> = {}
    for (const f of fragments) next[f.key] = selectAll
    setChecked(next)
    assembleText(next, uploadedFiles)
  }

  async function handleFileUpload(file: File) {
    setUploading(true)
    setUploadError(null)
    try {
      const token = await getToken()
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/admin/value-evidence/extract-text', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setUploadError(data.error || 'Failed to extract text from file')
        return
      }

      const data = await res.json()
      const newFile: UploadedFile = {
        filename: data.metadata.filename,
        mimeType: data.metadata.mimeType,
        text: data.text,
        pages: data.metadata.pages,
        wordCount: data.metadata.wordCount,
      }
      const nextFiles = [...uploadedFiles, newFile]
      setUploadedFiles(nextFiles)
      assembleText(checked, nextFiles)
    } catch {
      setUploadError('Something went wrong during file upload')
    } finally {
      setUploading(false)
    }
  }

  function handleRemoveFile(index: number) {
    const nextFiles = uploadedFiles.filter((_, i) => i !== index)
    setUploadedFiles(nextFiles)
    assembleText(checked, nextFiles)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }

  const checkedCount = Object.values(checked).filter(Boolean).length
  const hasDbData = fragments.length > 0
  const hasFiles = uploadedFiles.length > 0
  const hasIncludedContent = checkedCount > 0 || hasFiles

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-white">{title}</span>
          {loading && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
          {!loading && !hasIncludedContent && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-800 text-gray-500 border border-gray-700">
              Nothing included
            </span>
          )}
          {!loading && hasDbData && checkedCount > 0 && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              DB {checkedCount}/{fragments.length}
            </span>
          )}
          {!loading && hasDbData && checkedCount === 0 && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-800 text-gray-500 border border-gray-700">
              DB 0/{fragments.length}
            </span>
          )}
          {!loading && hasFiles && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/20">
              {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-5">
          {/* DATABASE DATA */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
                <Database className="w-3.5 h-3.5" />
                Database Data
              </div>
              {hasDbData && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleCheckAll(true)}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCheckAll(false)}
                    className="text-[10px] text-gray-500 hover:text-gray-400"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading data...
              </div>
            ) : hasDbData ? (
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {fragments.map((f) => (
                  <label
                    key={f.key}
                    className="flex items-start gap-2.5 p-2 rounded hover:bg-gray-800/50 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={!!checked[f.key]}
                      onChange={(e) => handleCheckChange(f.key, e.target.checked)}
                      className="mt-0.5 rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500/50 focus:ring-offset-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-gray-300">{f.label}</span>
                      <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 group-hover:line-clamp-4">
                        {f.text}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-600 py-2 italic">{SLOT_EMPTY_MESSAGES[slot]}</p>
            )}
          </div>

          {/* Separator */}
          <div className="border-t border-gray-800" />

          {/* UPLOADED FILES */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
              <Upload className="w-3.5 h-3.5" />
              Uploaded Files
            </div>

            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                {uploadedFiles.map((uf, i) => (
                  <div
                    key={`${uf.filename}-${i}`}
                    className="flex items-start gap-2 p-2.5 rounded bg-gray-800/50 border border-gray-700/50"
                  >
                    <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-300 truncate">
                          {uf.filename}
                        </span>
                        <span className="text-[10px] text-gray-600">
                          {uf.pages ? `${uf.pages} pages` : ''}{' '}
                          {uf.wordCount ? `${uf.wordCount.toLocaleString()} words` : ''}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1 line-clamp-3">{uf.text}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(i)}
                      className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Drop zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border border-dashed border-gray-700 rounded-lg p-4 text-center hover:border-gray-600 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> Extracting text...
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Drop file here or click to browse</span>
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1">
                    PDF, DOCX, PPTX, images, CSV
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileUpload(file)
                  e.target.value = ''
                }}
              />
            </div>

            {uploadError && (
              <div className="flex items-center gap-2 text-xs text-red-400">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {uploadError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
