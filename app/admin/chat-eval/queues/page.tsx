'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { CategoryBadgeList } from '@/components/admin/chat-eval'
import { useAuth } from '@/components/AuthProvider'
import { getCurrentSession } from '@/lib/auth'
import { 
  MessageCircle, 
  Mic, 
  Mail, 
  Bot, 
  ChevronRight,
  BarChart3,
  Loader2
} from 'lucide-react'
import { getPromptDisplayName } from '@/lib/constants/prompt-keys'

interface QueueStats {
  channels: {
    voice: number
    text: number
    email: number
    chatbot: number
  }
  categories: Array<{
    id: string
    name: string
    color: string
    count: number
  }>
}

export default function QueuesOverviewPage() {
  return (
    <ProtectedRoute requireAdmin>
      <QueuesOverviewContent />
    </ProtectedRoute>
  )
}

function QueuesOverviewContent() {
  const router = useRouter()
  const { user } = useAuth()
  const [stats, setStats] = useState<QueueStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedQueue, setSelectedQueue] = useState('all')

  const fetchStats = useCallback(async () => {
    try {
      const session = await getCurrentSession()
      
      const response = await fetch('/api/admin/chat-eval/stats?days=30', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setStats({
          channels: data.channels,
          categories: data.categories,
        })
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const queues = [
    {
      id: 'voice',
      name: `All ${getPromptDisplayName('voice_agent')}`,
      icon: Mic,
      color: 'purple',
      count: stats?.channels.voice ?? 0,
    },
    {
      id: 'chatbot',
      name: `All ${getPromptDisplayName('chatbot')}`,
      icon: Bot,
      color: 'orange',
      count: stats?.channels.chatbot ?? 0,
    },
    {
      id: 'text',
      name: 'All Text (SMS)',
      icon: MessageCircle,
      color: 'emerald',
      count: stats?.channels.text ?? 0,
    },
    {
      id: 'email',
      name: 'All Emails',
      icon: Mail,
      color: 'blue',
      count: stats?.channels.email ?? 0,
    },
  ]

  const handleQueueClick = (queueId: string) => {
    router.push(`/admin/chat-eval?channel=${queueId}`)
  }

  const handleCategorize = () => {
    // Future: trigger LLM categorization
    console.log('Categorize clicked for queue:', selectedQueue)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-imperial-navy flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-radiant-gold" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-imperial-navy text-platinum-white p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin Dashboard', href: '/admin' },
          { label: 'Chat Eval', href: '/admin/chat-eval' },
          { label: 'Queues' }
        ]} />

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-heading tracking-wider mb-2">Annotation Queues</h1>
          <p className="text-platinum-white/60">View and manage conversations by channel type</p>
        </div>

        {/* Main content */}
        <div className="flex gap-8">
          {/* Queue cards */}
          <div className="flex-1 space-y-4">
            {queues.map((queue) => {
              const Icon = queue.icon
              return (
                <motion.div
                  key={queue.id}
                  whileHover={{ scale: 1.01, x: 4 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleQueueClick(queue.id)}
                  className="p-6 bg-silicon-slate/20 border border-radiant-gold/10 rounded-xl
                    cursor-pointer hover:border-radiant-gold/30 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`
                        w-12 h-12 rounded-xl flex items-center justify-center
                        ${queue.color === 'blue' ? 'bg-blue-500/20' : ''}
                        ${queue.color === 'purple' ? 'bg-purple-500/20' : ''}
                        ${queue.color === 'emerald' ? 'bg-emerald-500/20' : ''}
                        ${queue.color === 'orange' ? 'bg-orange-500/20' : ''}
                      `}>
                        <Icon size={24} className={`
                          ${queue.color === 'blue' ? 'text-blue-400' : ''}
                          ${queue.color === 'purple' ? 'text-purple-400' : ''}
                          ${queue.color === 'emerald' ? 'text-emerald-400' : ''}
                          ${queue.color === 'orange' ? 'text-orange-400' : ''}
                        `} />
                      </div>
                      <div>
                        <h3 className="font-heading text-lg">{queue.name}</h3>
                        <p className="text-sm text-platinum-white/50">
                          {queue.count} sessions
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-platinum-white/40" />
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Sidebar: Analyze Results */}
          <div className="w-80 flex-shrink-0">
            <div className="p-4 bg-silicon-slate/20 border border-radiant-gold/10 rounded-xl">
              <h3 className="font-heading text-lg mb-4">Analyze Results</h3>
              
              {/* Queue selector */}
              <select
                value={selectedQueue}
                onChange={(e) => setSelectedQueue(e.target.value)}
                className="w-full px-3 py-2 mb-4 bg-silicon-slate/30 border border-radiant-gold/10 
                  rounded-lg text-platinum-white focus:outline-none focus:border-radiant-gold/30"
              >
                <option value="all">All</option>
                <option value="text">Text Messages</option>
                <option value="voice">{getPromptDisplayName('voice_agent')}</option>
                <option value="email">Emails</option>
                <option value="chatbot">{getPromptDisplayName('chatbot')}</option>
              </select>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCategorize}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4
                  bg-blue-500 text-white rounded-lg font-heading text-sm uppercase tracking-wider
                  hover:bg-blue-600 transition-colors"
              >
                <BarChart3 size={16} />
                Categorize
              </motion.button>

              {/* Error categorization results */}
              {stats?.categories && stats.categories.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm text-platinum-white/60 mb-3">
                    Results from Error Categorization
                  </h4>
                  <div className="space-y-2">
                    <CategoryBadgeList categories={stats.categories} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
