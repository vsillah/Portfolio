'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
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
  Settings
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

const PROMPT_ICONS: Record<string, typeof MessageSquare> = {
  chatbot: MessageSquare,
  voice_agent: Mic,
  diagnostic: ClipboardCheck,
  llm_judge: Scale,
}

const PROMPT_COLORS: Record<string, string> = {
  chatbot: 'from-blue-500 to-cyan-500',
  voice_agent: 'from-purple-500 to-pink-500',
  diagnostic: 'from-amber-500 to-orange-500',
  llm_judge: 'from-emerald-500 to-teal-500',
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

  const fetchPrompts = useCallback(async () => {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/prompts/page.tsx:65',message:'fetchPrompts: Starting',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
      // #endregion
      
      const session = await getCurrentSession()
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/prompts/page.tsx:68',message:'fetchPrompts: Session retrieved',data:{hasSession:!!session,hasAccessToken:!!session?.access_token,userId:session?.user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      const response = await fetch('/api/admin/prompts', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      })

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/prompts/page.tsx:75',message:'fetchPrompts: Response received',data:{status:response.status,statusText:response.statusText,ok:response.ok,headers:Object.fromEntries(response.headers.entries())},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C,D'})}).catch(()=>{});
      // #endregion

      if (!response.ok) {
        // #region agent log
        const errorText = await response.text().catch(() => 'Unable to read error text');
        fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/prompts/page.tsx:79',message:'fetchPrompts: Response not OK',data:{status:response.status,statusText:response.statusText,errorText},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C,D'})}).catch(()=>{});
        // #endregion
        throw new Error(`Failed to fetch prompts: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/prompts/page.tsx:87',message:'fetchPrompts: Data parsed',data:{hasPrompts:!!data.prompts,promptsCount:data.prompts?.length,dataKeys:Object.keys(data)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
      setPrompts(data.prompts)
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/prompts/page.tsx:90',message:'fetchPrompts: Success',data:{promptsSet:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
      // #endregion
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2ac6e9c9-06f0-4608-b169-f542fc938805',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/prompts/page.tsx:93',message:'fetchPrompts: Error caught',data:{errorMessage:err instanceof Error ? err.message : String(err),errorName:err instanceof Error ? err.name : 'Unknown',errorStack:err instanceof Error ? err.stack : undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
      // #endregion
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
    <div className="min-h-screen bg-imperial-navy text-platinum-white p-8">
      <div className="max-w-6xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'System Prompts' }
        ]} />

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-heading tracking-wider mb-2">System Prompts</h1>
            <p className="text-platinum-white/60">
              Configure prompts for chatbot, voice agent, and evaluation criteria
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
          <div className="text-center py-12 text-platinum-white/50">
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
                    <span className="text-xs text-platinum-white/40">v{prompt.version}</span>
                  </div>

                  {/* Icon and title */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${gradient} flex items-center justify-center`}>
                      <Icon size={24} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading text-xl text-platinum-white mb-1">
                        {prompt.name}
                      </h3>
                      <p className="text-sm text-platinum-white/50 truncate">
                        {prompt.description || `Key: ${prompt.key}`}
                      </p>
                    </div>
                  </div>

                  {/* Prompt preview */}
                  <div className="mb-4 p-3 bg-imperial-navy/50 rounded-lg">
                    <p className="text-sm text-platinum-white/70 line-clamp-3">
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
                      onClick={() => router.push(`/admin/prompts/${prompt.key}/history`)}
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
                  <div className="mt-3 text-xs text-platinum-white/40">
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
          <div className="grid md:grid-cols-2 gap-4 text-sm text-platinum-white/70">
            <div>
              <p className="font-semibold text-platinum-white mb-1">Chatbot Prompt</p>
              <p>Controls how the AI responds to visitors on the portfolio website.</p>
            </div>
            <div>
              <p className="font-semibold text-platinum-white mb-1">Voice Agent Prompt</p>
              <p>Configures the VAPI voice assistant behavior and tone.</p>
            </div>
            <div>
              <p className="font-semibold text-platinum-white mb-1">Evaluation Criteria</p>
              <p>Used by the LLM judge to evaluate chat quality in Chat Eval.</p>
            </div>
            <div>
              <p className="font-semibold text-platinum-white mb-1">Diagnostic Prompt</p>
              <p>Guides the diagnostic/audit conversation flow.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
