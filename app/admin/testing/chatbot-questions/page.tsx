'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  Trash2,
  Search,
  MessageSquare,
  AlertTriangle,
  ClipboardCheck,
  Tag,
  ChevronDown,
  ChevronUp,
  X,
  Filter,
  BarChart3,
} from 'lucide-react'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import type { QuestionCategory } from '@/lib/testing/chatbot-questions'

interface TestQuestion {
  id: string
  category: QuestionCategory
  question: string
  expectedKeywords?: string[]
  expectsBoundary?: boolean
  triggersDiagnostic?: boolean
  tags: string[]
  _source: 'builtin' | 'custom'
}

interface CategoryMeta {
  id: QuestionCategory
  label: string
  description: string
  icon: string
}

interface CategoryStat {
  category: QuestionCategory
  label: string
  count: number
}

export default function ChatbotQuestionsPage() {
  const [questions, setQuestions] = useState<TestQuestion[]>([])
  const [categories, setCategories] = useState<CategoryMeta[]>([])
  const [stats, setStats] = useState<{ builtinCount: number; customCount: number; totalCount: number; byCategory: CategoryStat[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<QuestionCategory | ''>('')
  const [selectedSource, setSelectedSource] = useState<'builtin' | 'custom' | ''>('')
  const [selectedTag, setSelectedTag] = useState('')
  const [showStatsPanel, setShowStatsPanel] = useState(false)

  // Add form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newQuestion, setNewQuestion] = useState('')
  const [newCategory, setNewCategory] = useState<QuestionCategory>('services_general')
  const [newKeywords, setNewKeywords] = useState('')
  const [newTags, setNewTags] = useState('')
  const [newBoundary, setNewBoundary] = useState(false)
  const [newDiagnostic, setNewDiagnostic] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchQuestions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (selectedCategory) params.set('category', selectedCategory)
      if (selectedTag) params.set('tag', selectedTag)
      if (selectedSource) params.set('source', selectedSource)
      const res = await fetch(`/api/admin/testing/chatbot-questions?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load questions')
      const data = await res.json()
      setQuestions(data.questions || [])
      setCategories(data.categories || [])
      setStats(data.stats || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [selectedCategory, selectedTag, selectedSource])

  useEffect(() => { fetchQuestions() }, [fetchQuestions])

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newQuestion.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/testing/chatbot-questions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: newQuestion,
          category: newCategory,
          expectedKeywords: newKeywords ? newKeywords.split(',').map(k => k.trim()).filter(Boolean) : undefined,
          tags: newTags ? newTags.split(',').map(t => t.trim()).filter(Boolean) : [],
          expectsBoundary: newBoundary,
          triggersDiagnostic: newDiagnostic,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create')
      }
      setNewQuestion('')
      setNewKeywords('')
      setNewTags('')
      setNewBoundary(false)
      setNewDiagnostic(false)
      setShowAddForm(false)
      fetchQuestions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create question')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Delete this custom question?')) return
    try {
      const res = await fetch(`/api/admin/testing/chatbot-questions/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to delete')
      fetchQuestions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const filteredQuestions = questions.filter(q => {
    if (searchQuery && !q.question.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const allTags = Array.from(new Set(questions.flatMap(q => q.tags))).sort()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Admin', href: '/admin' },
          { label: 'E2E Testing', href: '/admin/testing' },
          { label: 'Chatbot Questions' },
        ]} />

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-400 to-amber-400 bg-clip-text text-transparent">
              Chatbot Test Questions
            </h1>
            <p className="text-gray-400 mt-1">
              {stats ? `${stats.builtinCount} built-in + ${stats.customCount} custom = ${stats.totalCount} total` : 'Loading...'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowStatsPanel(!showStatsPanel)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 border border-purple-500/30 rounded-lg text-purple-300 hover:bg-purple-600/30 transition-colors"
            >
              <BarChart3 size={16} />
              Stats
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 border border-emerald-500/30 rounded-lg text-emerald-300 hover:bg-emerald-600/30 transition-colors"
            >
              <Plus size={16} />
              Add Question
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-300">
            <AlertTriangle size={16} />
            <span className="text-sm">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300"><X size={14} /></button>
          </div>
        )}

        {/* Stats Panel */}
        {showStatsPanel && stats && (
          <div className="mb-6 p-4 bg-gray-800/50 border border-gray-700/50 rounded-xl">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Questions by Category</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {stats.byCategory.map(cat => (
                <button
                  key={cat.category}
                  onClick={() => setSelectedCategory(selectedCategory === cat.category ? '' : cat.category)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    selectedCategory === cat.category
                      ? 'bg-amber-600/20 border-amber-500/40 text-amber-300'
                      : 'bg-gray-800/30 border-gray-700/30 text-gray-300 hover:border-gray-600/50'
                  }`}
                >
                  <div className="text-lg font-bold">{cat.count}</div>
                  <div className="text-xs text-gray-400 truncate">{cat.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Add Question Form */}
        {showAddForm && (
          <form onSubmit={handleAddQuestion} className="mb-6 p-5 bg-gray-800/50 border border-emerald-500/20 rounded-xl space-y-4">
            <h3 className="text-sm font-semibold text-emerald-300 uppercase tracking-wider">New Custom Question</h3>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Question *</label>
              <input
                type="text"
                value={newQuestion}
                onChange={e => setNewQuestion(e.target.value)}
                placeholder="e.g. Do you offer workshops for startups?"
                className="w-full px-3 py-2 bg-gray-900/60 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Category *</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value as QuestionCategory)}
                  className="w-full px-3 py-2 bg-gray-900/60 border border-gray-700/50 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Expected Keywords (comma-separated)</label>
                <input
                  type="text"
                  value={newKeywords}
                  onChange={e => setNewKeywords(e.target.value)}
                  placeholder="e.g. workshop, training"
                  className="w-full px-3 py-2 bg-gray-900/60 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={newTags}
                  onChange={e => setNewTags(e.target.value)}
                  placeholder="e.g. services, workshop"
                  className="w-full px-3 py-2 bg-gray-900/60 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300 pt-5 cursor-pointer">
                <input type="checkbox" checked={newBoundary} onChange={e => setNewBoundary(e.target.checked)} className="rounded" />
                Expects boundary (should refuse)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300 pt-5 cursor-pointer">
                <input type="checkbox" checked={newDiagnostic} onChange={e => setNewDiagnostic(e.target.checked)} className="rounded" />
                Triggers diagnostic mode
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting || !newQuestion.trim()}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Creating...' : 'Create Question'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search questions..."
              className="w-full pl-9 pr-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value as QuestionCategory | '')}
            className="px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-sm text-gray-300 focus:outline-none"
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select
            value={selectedSource}
            onChange={e => setSelectedSource(e.target.value as 'builtin' | 'custom' | '')}
            className="px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-sm text-gray-300 focus:outline-none"
          >
            <option value="">All Sources</option>
            <option value="builtin">Built-in</option>
            <option value="custom">Custom</option>
          </select>
          <select
            value={selectedTag}
            onChange={e => setSelectedTag(e.target.value)}
            className="px-3 py-2 bg-gray-800/50 border border-gray-700/50 rounded-lg text-sm text-gray-300 focus:outline-none"
          >
            <option value="">All Tags</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Questions Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500">Loading questions...</div>
        ) : (
          <>
            <div className="text-sm text-gray-500 mb-3">{filteredQuestions.length} question{filteredQuestions.length !== 1 ? 's' : ''}</div>
            <div className="space-y-2">
              {filteredQuestions.map(q => (
                <div
                  key={`${q._source}-${q.id}`}
                  className="flex items-start gap-3 p-3 bg-gray-800/30 border border-gray-700/30 rounded-lg hover:border-gray-600/50 transition-colors group"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {q.triggersDiagnostic ? (
                      <ClipboardCheck size={14} className="text-amber-400" />
                    ) : q.expectsBoundary ? (
                      <AlertTriangle size={14} className="text-red-400" />
                    ) : (
                      <MessageSquare size={14} className="text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200">{q.question}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        q._source === 'custom'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-gray-700/50 text-gray-400'
                      }`}>
                        {q._source}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                        {categories.find(c => c.id === q.category)?.label || q.category}
                      </span>
                      {q.expectedKeywords?.map(kw => (
                        <span key={kw} className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300">{kw}</span>
                      ))}
                      {q.tags.slice(0, 3).map(t => (
                        <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-gray-700/40 text-gray-400">
                          <Tag size={10} className="inline mr-0.5" />{t}
                        </span>
                      ))}
                      {q.tags.length > 3 && (
                        <span className="text-xs text-gray-500">+{q.tags.length - 3} more</span>
                      )}
                    </div>
                  </div>
                  {q._source === 'custom' && (
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="flex-shrink-0 p-1.5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete custom question"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
