'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useRouter, useParams } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import { 
  Save, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle, 
  History,
  Code,
  Sliders
} from 'lucide-react'

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

interface PromptHistory {
  id: string
  version: number
  prompt: string
  config: Record<string, unknown>
  changed_at: string
  change_reason: string | null
}

export default function EditPromptPage() {
  return (
    <ProtectedRoute requireAdmin>
      <EditPromptContent />
    </ProtectedRoute>
  )
}

function EditPromptContent() {
  const router = useRouter()
  const params = useParams()
  const promptKey = params.key as string

  const [prompt, setPrompt] = useState<SystemPrompt | null>(null)
  const [history, setHistory] = useState<PromptHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [promptText, setPromptText] = useState('')
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const [configJson, setConfigJson] = useState('')
  const [showConfigEditor, setShowConfigEditor] = useState(false)

  const fetchPrompt = useCallback(async () => {
    try {
      const session = await getCurrentSession()
      const response = await fetch(`/api/admin/prompts/${promptKey}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          setError('Prompt not found')
          return
        }
        throw new Error('Failed to fetch prompt')
      }

      const data = await response.json()
      setPrompt(data.prompt)
      setHistory(data.history || [])

      // Initialize form
      setName(data.prompt.name)
      setDescription(data.prompt.description || '')
      setPromptText(data.prompt.prompt)
      setConfig(data.prompt.config || {})
      setConfigJson(JSON.stringify(data.prompt.config || {}, null, 2))
    } catch (err) {
      console.error('Error fetching prompt:', err)
      setError('Failed to load prompt')
    } finally {
      setLoading(false)
    }
  }, [promptKey])

  useEffect(() => {
    fetchPrompt()
  }, [fetchPrompt])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      // Validate config JSON
      let parsedConfig = config
      if (showConfigEditor) {
        try {
          parsedConfig = JSON.parse(configJson)
        } catch {
          setError('Invalid JSON in configuration')
          setSaving(false)
          return
        }
      }

      const session = await getCurrentSession()
      const response = await fetch(`/api/admin/prompts/${promptKey}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description,
          prompt: promptText,
          config: parsedConfig,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save prompt')
      }

      setSuccess('Prompt saved successfully!')
      fetchPrompt() // Refresh to get new version
    } catch (err) {
      console.error('Error saving prompt:', err)
      setError(err instanceof Error ? err.message : 'Failed to save prompt')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (prompt) {
      setName(prompt.name)
      setDescription(prompt.description || '')
      setPromptText(prompt.prompt)
      setConfig(prompt.config || {})
      setConfigJson(JSON.stringify(prompt.config || {}, null, 2))
    }
  }

  const hasChanges = prompt && (
    name !== prompt.name ||
    description !== (prompt.description || '') ||
    promptText !== prompt.prompt ||
    JSON.stringify(config) !== JSON.stringify(prompt.config)
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-imperial-navy text-platinum-white p-8 flex items-center justify-center">
        <p className="text-platinum-white/50">Loading prompt...</p>
      </div>
    )
  }

  if (!prompt) {
    return (
      <div className="min-h-screen bg-imperial-navy text-platinum-white p-8">
        <div className="max-w-4xl mx-auto">
          <Breadcrumbs items={[
            { label: 'Admin Dashboard', href: '/admin' },
            { label: 'System Prompts', href: '/admin/prompts' },
            { label: 'Not Found' }
          ]} />
          <div className="mt-8 p-6 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
            {error || 'Prompt not found'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-imperial-navy text-platinum-white p-8">
      <div className="max-w-4xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'System Prompts', href: '/admin/prompts' },
          { label: prompt.name }
        ]} />

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading tracking-wider mb-2">
              Edit: {prompt.name}
            </h1>
            <p className="text-platinum-white/60">
              Key: <code className="bg-silicon-slate/40 px-2 py-0.5 rounded">{prompt.key}</code>
              <span className="mx-2">•</span>
              Version: {prompt.version}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push(`/admin/prompts/${promptKey}/history`)}
              className="px-4 py-2 bg-silicon-slate/30 border border-radiant-gold/20 rounded-lg
                text-sm hover:border-radiant-gold/40 transition-colors flex items-center gap-2"
            >
              <History size={16} />
              History
            </motion.button>
          </div>
        </div>

        {/* Status messages */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-3"
          >
            <AlertCircle className="text-red-400" />
            <span className="text-red-400">{error}</span>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-lg flex items-center gap-3"
          >
            <CheckCircle className="text-emerald-400" />
            <span className="text-emerald-400">{success}</span>
          </motion.div>
        )}

        {/* Edit form */}
        <div className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-platinum-white/70 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-silicon-slate/20 border border-radiant-gold/20 rounded-lg
                text-platinum-white placeholder-platinum-white/30 focus:outline-none focus:border-radiant-gold/50"
              placeholder="Enter display name..."
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-platinum-white/70 mb-2">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-silicon-slate/20 border border-radiant-gold/20 rounded-lg
                text-platinum-white placeholder-platinum-white/30 focus:outline-none focus:border-radiant-gold/50"
              placeholder="Brief description of this prompt's purpose..."
            />
          </div>

          {/* Prompt */}
          <div>
            <label className="block text-sm font-medium text-platinum-white/70 mb-2">
              System Prompt
            </label>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={20}
              className="w-full px-4 py-3 bg-silicon-slate/20 border border-radiant-gold/20 rounded-lg
                text-platinum-white placeholder-platinum-white/30 focus:outline-none focus:border-radiant-gold/50
                font-mono text-sm resize-y"
              placeholder="Enter the system prompt..."
            />
            <p className="mt-2 text-xs text-platinum-white/40">
              {promptText.length} characters • Supports Markdown formatting
            </p>
          </div>

          {/* Configuration */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-platinum-white/70">
                Configuration
              </label>
              <button
                onClick={() => setShowConfigEditor(!showConfigEditor)}
                className="text-xs text-radiant-gold hover:underline flex items-center gap-1"
              >
                {showConfigEditor ? <Sliders size={12} /> : <Code size={12} />}
                {showConfigEditor ? 'Simple View' : 'JSON Editor'}
              </button>
            </div>

            {showConfigEditor ? (
              <textarea
                value={configJson}
                onChange={(e) => setConfigJson(e.target.value)}
                rows={8}
                className="w-full px-4 py-3 bg-silicon-slate/20 border border-radiant-gold/20 rounded-lg
                  text-platinum-white placeholder-platinum-white/30 focus:outline-none focus:border-radiant-gold/50
                  font-mono text-sm"
                placeholder='{"temperature": 0.7, "maxTokens": 1024}'
              />
            ) : (
              <div className="space-y-3 p-4 bg-silicon-slate/20 border border-radiant-gold/20 rounded-lg">
                {/* Temperature */}
                <div className="flex items-center gap-4">
                  <label className="w-32 text-sm text-platinum-white/70">Temperature</label>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={(config.temperature as number) || 0.7}
                    onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                    className="w-24 px-3 py-2 bg-imperial-navy/50 border border-radiant-gold/20 rounded
                      text-platinum-white focus:outline-none focus:border-radiant-gold/50"
                  />
                  <span className="text-xs text-platinum-white/40">0 = deterministic, 2 = creative</span>
                </div>

                {/* Max Tokens */}
                <div className="flex items-center gap-4">
                  <label className="w-32 text-sm text-platinum-white/70">Max Tokens</label>
                  <input
                    type="number"
                    min="128"
                    max="4096"
                    step="128"
                    value={(config.maxTokens as number) || 1024}
                    onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) })}
                    className="w-24 px-3 py-2 bg-imperial-navy/50 border border-radiant-gold/20 rounded
                      text-platinum-white focus:outline-none focus:border-radiant-gold/50"
                  />
                  <span className="text-xs text-platinum-white/40">Maximum response length</span>
                </div>

                {/* Model (for LLM judge) */}
                {prompt.key === 'llm_judge' && (
                  <div className="flex items-center gap-4">
                    <label className="w-32 text-sm text-platinum-white/70">Model</label>
                    <select
                      value={(config.model as string) || 'claude-sonnet-4-20250514'}
                      onChange={(e) => setConfig({ ...config, model: e.target.value })}
                      className="w-64 px-3 py-2 bg-imperial-navy/50 border border-radiant-gold/20 rounded
                        text-platinum-white focus:outline-none focus:border-radiant-gold/50"
                    >
                      <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                      <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="gpt-4o-mini">GPT-4o Mini</option>
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-radiant-gold/10">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleReset}
              disabled={!hasChanges}
              className="px-4 py-2 bg-silicon-slate/30 border border-radiant-gold/20 rounded-lg
                text-sm hover:bg-silicon-slate/50 transition-colors flex items-center gap-2
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw size={16} />
              Reset Changes
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="px-6 py-2 bg-radiant-gold/20 border border-radiant-gold/50 rounded-lg
                text-radiant-gold hover:bg-radiant-gold/30 transition-colors flex items-center gap-2
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Changes'}
            </motion.button>
          </div>
        </div>

        {/* Recent history */}
        {history.length > 0 && (
          <div className="mt-12">
            <h3 className="text-lg font-heading text-platinum-white mb-4">Recent Changes</h3>
            <div className="space-y-2">
              {history.slice(0, 3).map((h) => (
                <div
                  key={h.id}
                  className="p-3 bg-silicon-slate/10 border border-radiant-gold/10 rounded-lg
                    flex items-center justify-between text-sm"
                >
                  <span className="text-platinum-white/70">Version {h.version}</span>
                  <span className="text-platinum-white/40">
                    {new Date(h.changed_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              onClick={() => router.push(`/admin/prompts/${promptKey}/history`)}
              className="mt-3 text-sm text-radiant-gold hover:underline"
            >
              View full history →
            </motion.button>
          </div>
        )}
      </div>
    </div>
  )
}
