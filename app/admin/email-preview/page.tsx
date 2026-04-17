'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Info } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getEmailTemplateRegistry, type EmailTemplateMode } from '@/lib/email/registry'
import { LEGACY_EMAIL_PREVIEW_SAMPLES } from '@/lib/email/legacy-admin-email-samples'

type PreviewRow =
  | {
      id: string
      label: string
      mode: EmailTemplateMode
      kind: 'html'
      html: string
    }
  | {
      id: string
      label: string
      mode: EmailTemplateMode
      kind: 'meta'
      description: string
      systemPromptKey?: string
    }

export default function EmailPreviewPage() {
  const options = useMemo<PreviewRow[]>(() => {
    const rows: PreviewRow[] = []

    for (const e of getEmailTemplateRegistry()) {
      if (e.getPreviewHtml) {
        rows.push({
          id: e.id,
          label: e.label,
          mode: e.mode,
          kind: 'html',
          html: e.getPreviewHtml(),
        })
      } else {
        rows.push({
          id: e.id,
          label: e.label,
          mode: e.mode,
          kind: 'meta',
          description: e.description,
          systemPromptKey: e.systemPromptKey,
        })
      }
    }

    for (const l of LEGACY_EMAIL_PREVIEW_SAMPLES) {
      rows.push({
        id: `legacy_${l.id}`,
        label: `${l.label} (sample)`,
        mode: 'static',
        kind: 'html',
        html: l.html,
      })
    }

    return rows
  }, [])

  const [selected, setSelected] = useState(options[0]?.id ?? '')

  const current = options.find((o) => o.id === selected) ?? options[0]

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-6 py-4 flex flex-wrap items-center gap-4">
          <h1 className="text-lg font-bold whitespace-nowrap">Email Preview</h1>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500 min-w-[240px]"
          >
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                [{o.mode}] {o.label}
              </option>
            ))}
          </select>
          <Link
            href="/admin/email-center"
            className="text-sm text-amber-400 hover:text-amber-300 underline"
          >
            Email Center
          </Link>
          <Link
            href="/admin/prompts"
            className="text-sm text-teal-400 hover:text-teal-300 underline"
          >
            System Prompts
          </Link>
          <span className="text-xs text-gray-500 ml-auto">Admin only — samples + registry layouts</span>
        </div>

        {current?.kind === 'meta' ? (
          <div className="max-w-xl mx-auto py-12 px-6">
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-6 flex gap-3">
              <Info className="shrink-0 text-amber-400 mt-0.5" size={20} />
              <div className="space-y-3 text-sm text-gray-200">
                <p className="font-medium text-white">{current.label}</p>
                <p className="text-gray-400">{current.description}</p>
                {current.mode === 'llm' && current.systemPromptKey && (
                  <p>
                    Edit the active prompt in{' '}
                    <Link href="/admin/prompts" className="text-teal-400 underline">
                      System Prompts
                    </Link>{' '}
                    — key: <code className="text-xs bg-black/40 px-1 rounded">{current.systemPromptKey}</code>
                  </p>
                )}
                {current.mode === 'external' && (
                  <p className="text-gray-500 text-xs">
                    Delivered by n8n; no HTML preview in-app. See workflow exports or Email Center after send.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-8 px-4">
            <div className="w-full max-w-[640px] bg-white rounded-xl shadow-2xl overflow-hidden">
              <div dangerouslySetInnerHTML={{ __html: current.html }} />
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
