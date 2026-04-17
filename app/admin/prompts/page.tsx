'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { buildLinkWithReturn } from '@/lib/admin-return-context'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import { 
  MessageSquare, 
  Mic, 
  ClipboardCheck, 
  Scale, 
  Edit, 
  History, 
  CheckCircle,
  XCircle,
  Plus,
  Settings,
  Mail,
  Share2,
  PenTool,
  ImageIcon,
} from 'lucide-react'
import { getPromptDisplayName } from '@/lib/constants/prompt-keys'
import { getLlmRegistryKeys, getEmailTemplateRegistry } from '@/lib/email/registry'

interface SystemPrompt {
  id: string
  key: string
  name: string
  description: string | null
  prompt: string
  config: Record<string, unknown>
  version: number
  is_active: boolean
  created_at: string
  updated_at: string
}

const PROMPT_ICONS: Record<string, typeof MessageSquare> = {
  chatbot: MessageSquare,
  voice_agent: Mic,
  diagnostic: ClipboardCheck,
  llm_judge: Scale,
  client_email_reply: Mail,
  social_topic_extraction: Share2,
  social_copywriting: PenTool,
  social_image_generation: ImageIcon,
}

const PROMPT_COLORS: Record<string, string> = {
  chatbot: 'from-blue-500 to-cyan-500',
  voice_agent: 'from-purple-500 to-pink-500',
  diagnostic: 'from-amber-500 to-orange-500',
  llm_judge: 'from-emerald-500 to-teal-500',
  client_email_reply: 'from-violet-500 to-indigo-500',
  social_topic_extraction: 'from-amber-500 to-orange-500',
  social_copywriting: 'from-orange-500 to-red-500',
  social_image_generation: 'from-rose-500 to-pink-500',
}

export default function PromptsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <PromptsContent />
    </ProtectedRoute>
  )
}

function PromptsContent() {
  const router = useRouter()
  const [prompts, setPrompts] = useState<SystemPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const staticTemplateCount = useMemo(
    () => getEmailTemplateRegistry().filter((e) => e.mode === 'static' && e.getPreviewHtml).length,
    [],
  )

  const fetchPrompts = useCallback(async () => {
    try {
      const session = await getCurrentSession()

      const response = await fetch('/api/admin/prompts', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch prompts: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      setPrompts(data.prompts)
    } catch (err) {
      console.error('Error fetching prompts:', err)
      setError('Failed to load prompts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPrompts()
  }, [fetchPrompts])

  const handleToggleActive = async (prompt: SystemPrompt) => {
    try {
      const session = await getCurrentSession()
      const response = await fetch(`/api/admin/prompts/${prompt.key}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: !prompt.is_active }),
      })

      if (!response.ok) {
        throw new Error('Failed to update prompt')
      }

      // Refresh prompts
      fetchPrompts()
    } catch (err) {
      console.error('Error updating prompt:', err)
      setError('Failed to update prompt')
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-6xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'System Prompts' }
        ]} />

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-5 rounded-xl border border-violet-500/25 bg-violet-950/20"
        >
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-heading text-foreground mb-1 flex items-center gap-2">
                <Mail className="w-5 h-5 text-violet-400 shrink-0" />
                Email template registry
              </h2>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Prompt cards below include <strong>LLM-backed</strong> email keys (Saraev-style drafts). Typed HTML
                for store and chat notifications lives in <code className="text-xs bg-black/30 px-1 rounded">lib/email/templates</code> and
                is listed in the registry — preview {staticTemplateCount} static layouts in{' '}
                <strong>Email Preview</strong>, and see what actually sent in <strong>Email Center</strong>.
              </p>
              <p className="text-xs text-muted-foreground/80 mt-2 font-mono break-all">
                LLM registry keys: {getLlmRegistryKeys().join(', ')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link
                href="/admin/email-preview"
                className="px-3 py-2 text-sm rounded-lg bg-violet-600/30 border border-violet-500/40 text-violet-100 hover:bg-violet-600/50 transition-colors"
              >
                Email Preview
              </Link>
              <Link
                href="/admin/email-center"
                className="px-3 py-2 text-sm rounded-lg bg-amber-600/20 border border-amber-500/40 text-amber-100 hover:bg-amber-600/35 transition-colors"
              >
                Email Center
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-heading tracking-wider mb-2">System Prompts</h1>
            <p className="text-muted-foreground">
              Configure prompts for chatbot, voice agent, evaluation criteria, and communications (e.g. client email draft replies)
            </p>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/admin/prompts/new')}
            className="px-4 py-2 bg-radiant-gold/20 border border-radiant-gold/50 rounded-lg
              text-radiant-gold hover:bg-radiant-gold/30 transition-colors flex items-center gap-2"
          >
            <Plus size={18} />
            New Prompt
          </motion.button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="text-center py-12 text-muted-foreground/90">
            Loading prompts...
          </div>
        )}

        {/* Prompts grid */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {prompts.map((prompt) => {
              const Icon = PROMPT_ICONS[prompt.key] || Settings
              const gradient = PROMPT_COLORS[prompt.key] || 'from-gray-500 to-gray-600'

              return (
                <motion.div
                  key={prompt.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`relative p-6 bg-silicon-slate/20 border rounded-xl overflow-hidden
                    ${prompt.is_active 
                      ? 'border-radiant-gold/20 hover:border-radiant-gold/40' 
                      : 'border-gray-700/50 opacity-60'
                    } transition-all`}
                >
                  {/* Status indicator */}
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    {prompt.is_active ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle size={14} />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <XCircle size={14} />
                        Inactive
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground/80">v{prompt.version}</span>
                  </div>

                  {/* Icon and title */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${gradient} flex items-center justify-center`}>
                      <Icon size={24} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading text-xl text-foreground mb-1">
                        {getPromptDisplayName(prompt.key)}
                      </h3>
                      <p className="text-sm text-muted-foreground/90 truncate">
                        {prompt.description || `Key: ${prompt.key}`}
                      </p>
                    </div>
                  </div>

                  {/* Prompt preview */}
                  <div className="mb-4 p-3 bg-background/50 rounded-lg">
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {prompt.prompt}
                    </p>
                  </div>

                  {/* Config preview */}
                  {prompt.config && Object.keys(prompt.config).length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {Object.entries(prompt.config).map(([key, value]) => (
                        <span
                          key={key}
                          className="px-2 py-1 text-xs bg-silicon-slate/40 rounded border border-radiant-gold/10"
                        >
                          {key}: {String(value)}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-4 border-t border-radiant-gold/10">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => router.push(`/admin/prompts/${prompt.key}`)}
                      className="flex-1 px-3 py-2 bg-silicon-slate/30 border border-radiant-gold/20 rounded-lg
                        text-sm hover:bg-silicon-slate/50 hover:border-radiant-gold/40 transition-all
                        flex items-center justify-center gap-2"
                    >
                      <Edit size={14} />
                      Edit
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => router.push(buildLinkWithReturn(`/admin/prompts/${prompt.key}/history`, '/admin/prompts'))}
                      className="px-3 py-2 bg-silicon-slate/30 border border-radiant-gold/20 rounded-lg
                        text-sm hover:bg-silicon-slate/50 hover:border-radiant-gold/40 transition-all
                        flex items-center gap-2"
                    >
                      <History size={14} />
                      History
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleToggleActive(prompt)}
                      className={`px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2
                        ${prompt.is_active 
                          ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30' 
                          : 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30'
                        }`}
                    >
                      {prompt.is_active ? 'Disable' : 'Enable'}
                    </motion.button>
                  </div>

                  {/* Updated timestamp */}
                  <div className="mt-3 text-xs text-muted-foreground/80">
                    Last updated: {new Date(prompt.updated_at).toLocaleDateString()}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Info section */}
        <div className="mt-12 p-6 bg-silicon-slate/10 border border-radiant-gold/10 rounded-xl">
          <h3 className="font-heading text-lg text-radiant-gold mb-3">
            How System Prompts Work
          </h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div>
              <p className="font-semibold text-foreground mb-1">Chatbot Prompt</p>
              <p>Controls how the AI responds to visitors on the portfolio website.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">Voice Agent Prompt</p>
              <p>Configures the VAPI voice assistant behavior and tone.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">Evaluation Criteria</p>
              <p>Used by the LLM judge to evaluate chat quality in Chat Eval.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">Diagnostic Prompt</p>
              <p>Guides the diagnostic/audit conversation flow.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">Client Email Draft Reply</p>
              <p>Used when generating draft email replies to inbound client emails (Gmail workflow and in-app drafts).</p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">Social — Topic Extraction</p>
              <p>Extracts social-media-worthy topics from meeting transcripts using Hormozi frameworks.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">Social — Copywriting</p>
              <p>Generates LinkedIn post text with hook, story, framework lesson, and CTA.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">Social — Image Generation</p>
              <p>Template for branded framework diagram images (navy/gold palette, 1:1 ratio).</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
