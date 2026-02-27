'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Plus, Trash2, Edit, Eye, EyeOff, ArrowUp, ArrowDown, Upload, File, X, BookOpen } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { adminCreateUrl } from '@/lib/admin-create-context'
import { getCurrentSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import Breadcrumbs from '@/components/admin/Breadcrumbs'

interface Publication {
  id: number
  title: string
  description: string | null
  publication_url: string | null
  author: string | null
  publication_date: string | null
  publisher: string | null
  display_order: number
  is_published: boolean
  file_path: string | null
  file_type: string | null
  file_size: number | null
  created_at: string
  updated_at: string
  elevenlabs_project_id?: string | null
  elevenlabs_public_user_id?: string | null
  elevenlabs_player_url?: string | null
  audiobook_lead_magnet_id?: string | null
  audio_preview_url?: string | null
  audio_file_path?: string | null
}

export default function PublicationsManagementPage() {
  const router = useRouter()
  const [publications, setPublications] = useState<Publication[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPublication, setEditingPublication] = useState<Publication | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    publication_url: '',
    author: '',
    publication_date: '',
    publisher: '',
    display_order: 0,
    is_published: true,
    elevenlabs_project_id: '',
    elevenlabs_public_user_id: '',
    elevenlabs_player_url: '',
    audiobook_lead_magnet_id: '',
    audio_preview_url: '',
    audio_file_path: '',
  })
  const [uploadingAudio, setUploadingAudio] = useState(false)
  /** In-page audio: one source only. Derived from publication when editing. */
  const [audioSource, setAudioSource] = useState<'elevenlabs' | 'self_hosted'>('elevenlabs')
  /** When self-hosted: show either URL input or upload. */
  const [selfHostedMethod, setSelfHostedMethod] = useState<'url' | 'upload'>('url')
  const [audiobookLeadMagnets, setAudiobookLeadMagnets] = useState<Array<{ id: string; title: string; slug: string | null }>>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<{
    file_path: string
    file_type: string
    file_size: number
    file_name: string
  } | null>(null)

  useEffect(() => {
    fetchPublications()
  }, [])

  useEffect(() => {
    async function fetchAudiobookLeadMagnets() {
      try {
        const session = await getCurrentSession()
        if (!session) return
        const res = await fetch('/api/lead-magnets?admin=1', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const { leadMagnets } = await res.json()
          const audiobook = (leadMagnets || []).filter((lm: { type?: string }) => lm.type === 'audiobook')
          setAudiobookLeadMagnets(audiobook.map((lm: { id: string; title: string; slug: string | null }) => ({ id: lm.id, title: lm.title, slug: lm.slug ?? null })))
        }
      } catch {
        // ignore
      }
    }
    fetchAudiobookLeadMagnets()
  }, [])

  const fetchPublications = async () => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch('/api/publications?published=false', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setPublications(data || [])
      }
    } catch (error) {
      console.error('Failed to fetch publications:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this publication? This action cannot be undone.')) return

    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch(`/api/publications/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        fetchPublications()
      } else {
        alert('Failed to delete publication')
      }
    } catch (error) {
      console.error('Error deleting publication:', error)
      alert('Failed to delete publication')
    }
  }

  const handleTogglePublish = async (publication: Publication) => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch(`/api/publications/${publication.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          is_published: !publication.is_published,
        }),
      })

      if (response.ok) {
        fetchPublications()
      } else {
        alert('Failed to update publication')
      }
    } catch (error) {
      console.error('Error updating publication:', error)
      alert('Failed to update publication')
    }
  }

  const handleMoveOrder = async (publication: Publication, direction: 'up' | 'down') => {
    const currentIndex = publications.findIndex(p => p.id === publication.id)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= publications.length) return

    const targetPublication = publications[newIndex]
    const newOrder = targetPublication.display_order

    try {
      const session = await getCurrentSession()
      if (!session) return

      await Promise.all([
        fetch(`/api/publications/${publication.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ display_order: newOrder }),
        }),
        fetch(`/api/publications/${targetPublication.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ display_order: publication.display_order }),
        }),
      ])

      fetchPublications()
    } catch (error) {
      console.error('Error moving publication:', error)
      alert('Failed to reorder publication')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const session = await getCurrentSession()
      if (!session) return

      // Persist only the active in-page audio source; clear the other.
      const payload = {
        title: formData.title,
        description: formData.description || null,
        publication_url: formData.publication_url || null,
        author: formData.author || null,
        publication_date: formData.publication_date || null,
        publisher: formData.publisher || null,
        display_order: formData.display_order,
        is_published: formData.is_published,
        file_path: uploadedFile?.file_path || null,
        file_type: uploadedFile?.file_type || null,
        file_size: uploadedFile?.file_size || null,
        elevenlabs_project_id: audioSource === 'elevenlabs' ? (formData.elevenlabs_project_id || null) : null,
        elevenlabs_public_user_id: audioSource === 'elevenlabs' ? (formData.elevenlabs_public_user_id || null) : null,
        elevenlabs_player_url: audioSource === 'elevenlabs' ? (formData.elevenlabs_player_url || null) : null,
        audiobook_lead_magnet_id: formData.audiobook_lead_magnet_id || null,
        audio_preview_url: audioSource === 'self_hosted' ? (formData.audio_preview_url?.trim() || null) : null,
        audio_file_path: audioSource === 'self_hosted' ? (formData.audio_file_path || null) : null,
      }

      const url = editingPublication ? `/api/publications/${editingPublication.id}` : '/api/publications'
      const method = editingPublication ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        setShowAddForm(false)
        setEditingPublication(null)
        setAudioSource('elevenlabs')
        setSelfHostedMethod('url')
        setFormData({
          title: '',
          description: '',
          publication_url: '',
          author: '',
          publication_date: '',
          publisher: '',
          display_order: 0,
          is_published: true,
          elevenlabs_project_id: '',
          elevenlabs_public_user_id: '',
          elevenlabs_player_url: '',
          audiobook_lead_magnet_id: '',
          audio_preview_url: '',
          audio_file_path: '',
        })
        setUploadedFile(null)
        fetchPublications()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to save publication')
      }
    } catch (error) {
      console.error('Error saving publication:', error)
      alert('Failed to save publication')
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingFile(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const formData = new FormData()
      formData.append('file', file)
      if (editingPublication) {
        formData.append('publicationId', editingPublication.id.toString())
      }

      const response = await fetch('/api/publications/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        setUploadedFile({
          file_path: data.file_path,
          file_type: data.file_type,
          file_size: data.file_size,
          file_name: file.name,
        })
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to upload file')
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      alert('Failed to upload file')
    } finally {
      setUploadingFile(false)
    }
  }

  const handleRemoveFile = () => {
    setUploadedFile(null)
  }

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const inputEl = e.target
    // Supabase Free tier limit is 50 MB; check before upload to show a clear message
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      alert(`File is ${(file.size / 1024 / 1024).toFixed(1)} MB. Supabase Storage limit is 50 MB. Use a shorter sample or compress the audio.`)
      inputEl.value = ''
      return
    }
    setUploadingAudio(true)
    try {
      const session = await getCurrentSession()
      if (!session) {
        alert('Please sign in again to upload.')
        return
      }
      // Direct upload to Supabase Storage (bypasses Next.js body size limit)
      const ext = file.name.split('.').pop() || 'mp3'
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
      const path = editingPublication
        ? `publication-${editingPublication.id}/${fileName}`
        : `uploads/${fileName}`
      const { error } = await supabase.storage
        .from('publications')
        .upload(path, file, { cacheControl: '3600', upsert: false })
      if (error) {
        const msg = error.message?.toLowerCase().includes('size') || error.message?.toLowerCase().includes('maximum')
          ? `${error.message} Supabase Free tier allows up to 50 MB per file.`
          : (error.message || 'Failed to upload audio')
        alert(msg)
        return
      }
      setFormData((prev) => ({
        ...prev,
        audio_file_path: path,
        audio_preview_url: '',
      }))
    } catch {
      alert('Failed to upload audio. Check the console for details.')
    } finally {
      setUploadingAudio(false)
      inputEl.value = ''
    }
  }

  const clearAudioPreview = () => {
    setFormData((prev) => ({ ...prev, audio_preview_url: '', audio_file_path: '' }))
  }

  const handleEdit = (publication: Publication) => {
    setEditingPublication(publication)
    const hasElevenLabs = !!(publication.elevenlabs_project_id ?? publication.elevenlabs_public_user_id)
    const hasSelfHosted = !!(publication.audio_preview_url ?? publication.audio_file_path)
    setAudioSource(hasElevenLabs ? 'elevenlabs' : hasSelfHosted ? 'self_hosted' : 'elevenlabs')
    setSelfHostedMethod(publication.audio_file_path ? 'upload' : 'url')
    setFormData({
      title: publication.title,
      description: publication.description || '',
      publication_url: publication.publication_url || '',
      author: publication.author || '',
      publication_date: publication.publication_date ? publication.publication_date.split('T')[0] : '',
      publisher: publication.publisher || '',
      display_order: publication.display_order,
      is_published: publication.is_published,
      elevenlabs_project_id: publication.elevenlabs_project_id ?? '',
      elevenlabs_public_user_id: publication.elevenlabs_public_user_id ?? '',
      elevenlabs_player_url: publication.elevenlabs_player_url ?? '',
      audiobook_lead_magnet_id: publication.audiobook_lead_magnet_id ?? '',
      audio_preview_url: publication.audio_preview_url ?? '',
      audio_file_path: publication.audio_file_path ?? '',
    })
    if (publication.file_path) {
      setUploadedFile({
        file_path: publication.file_path,
        file_type: publication.file_type || '',
        file_size: publication.file_size || 0,
        file_name: publication.file_path.split('/').pop() || 'file',
      })
    } else {
      setUploadedFile(null)
    }
    setShowAddForm(true)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingPublication(null)
    setUploadedFile(null)
    setAudioSource('elevenlabs')
    setSelfHostedMethod('url')
    setFormData({
      title: '',
      description: '',
      publication_url: '',
      author: '',
      publication_date: '',
      publisher: '',
      display_order: 0,
      is_published: true,
      elevenlabs_project_id: '',
      elevenlabs_public_user_id: '',
      elevenlabs_player_url: '',
      audiobook_lead_magnet_id: '',
      audio_preview_url: '',
      audio_file_path: '',
    })
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="max-w-7xl mx-auto">
          <Breadcrumbs items={[
            { label: 'Admin Dashboard', href: '/admin' },
            { label: 'Content Management', href: '/admin/content' },
            { label: 'Publications' }
          ]} />
          
          <div className="mb-8 flex items-center justify-between">
            <div>
          <h1 className="text-4xl font-bold mb-2">Publications Management</h1>
              <p className="text-gray-400">Manage publications and articles</p>
            </div>
            {!showAddForm && (
              <motion.button
                onClick={() => setShowAddForm(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg flex items-center gap-2"
              >
                <Plus size={20} />
                Add Publication
              </motion.button>
            )}
          </div>

          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 p-6 bg-gray-900 border border-gray-800 rounded-xl"
            >
              <h2 className="text-2xl font-bold mb-4">
                {editingPublication ? 'Edit Publication' : 'Add New Publication'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Publication URL</label>
                    <input
                      type="url"
                      value={formData.publication_url}
                      onChange={(e) => setFormData({ ...formData, publication_url: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Author</label>
                    <input
                      type="text"
                      value={formData.author}
                      onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      placeholder="Author name"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Publication Date</label>
                    <input
                      type="date"
                      value={formData.publication_date}
                      onChange={(e) => setFormData({ ...formData, publication_date: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Publisher</label>
                    <input
                      type="text"
                      value={formData.publisher}
                      onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      placeholder="Publisher name"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Display Order</label>
                  <input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="border-t border-gray-700 pt-4 mt-4" role="group" aria-labelledby="in-page-audio-source-label">
                  <h3 id="in-page-audio-source-label" className="text-lg font-semibold mb-2">In-page audio source</h3>
                  <p className="text-xs text-gray-400 mb-3">
                    Choose one. This controls the Listen / in-page player on the publication card.
                  </p>
                  <div
                    className="inline-flex rounded-lg border border-gray-700 bg-gray-800 p-0.5"
                    role="tablist"
                    aria-label="Audio source"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={audioSource === 'elevenlabs'}
                      aria-controls="elevenlabs-panel"
                      id="audio-source-elevenlabs"
                      onClick={() => setAudioSource('elevenlabs')}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${audioSource === 'elevenlabs' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                      ElevenLabs
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={audioSource === 'self_hosted'}
                      aria-controls="self-hosted-panel"
                      id="audio-source-self-hosted"
                      onClick={() => setAudioSource('self_hosted')}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${audioSource === 'self_hosted' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                      Self-hosted
                    </button>
                  </div>

                  {audioSource === 'elevenlabs' && (
                    <div id="elevenlabs-panel" role="tabpanel" aria-labelledby="audio-source-elevenlabs" className="mt-4 space-y-3">
                      <h4 className="text-base font-medium">ElevenLabs player</h4>
                      <p className="text-xs text-gray-400">
                        From ElevenLabs → Audio Native → your project → Embed. Add this domain to the whitelist.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">Project ID</label>
                          <input
                            type="text"
                            value={formData.elevenlabs_project_id}
                            onChange={(e) => setFormData({ ...formData, elevenlabs_project_id: e.target.value })}
                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                            placeholder="Project ID"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Public user ID</label>
                          <input
                            type="text"
                            value={formData.elevenlabs_public_user_id}
                            onChange={(e) => setFormData({ ...formData, elevenlabs_public_user_id: e.target.value })}
                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                            placeholder="Public user ID"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Player URL (optional)</label>
                          <input
                            type="url"
                            value={formData.elevenlabs_player_url}
                            onChange={(e) => setFormData({ ...formData, elevenlabs_player_url: e.target.value })}
                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                            placeholder="https://elevenlabs.io/player/..."
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {audioSource === 'self_hosted' && (
                    <div id="self-hosted-panel" role="tabpanel" aria-labelledby="audio-source-self-hosted" className="mt-4 space-y-3">
                      <h4 className="text-base font-medium">Self-hosted audio</h4>
                      <p className="text-xs text-gray-400 mb-2">
                        Provide audio one way: paste a URL or upload a file.
                      </p>
                      <div
                        className="inline-flex rounded-lg border border-gray-700 bg-gray-800 p-0.5"
                        role="tablist"
                        aria-label="Self-hosted method"
                      >
                        <button
                          type="button"
                          role="tab"
                          aria-selected={selfHostedMethod === 'url'}
                          onClick={() => setSelfHostedMethod('url')}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${selfHostedMethod === 'url' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                          Link to URL
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={selfHostedMethod === 'upload'}
                          onClick={() => setSelfHostedMethod('upload')}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${selfHostedMethod === 'upload' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                          Upload file
                        </button>
                      </div>
                      {selfHostedMethod === 'url' && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Paste a direct link to an MP3/M4A. Used for the Listen player on the card.</p>
                          <input
                            type="url"
                            value={formData.audio_preview_url}
                            onChange={(e) => setFormData({ ...formData, audio_preview_url: e.target.value, audio_file_path: '' })}
                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                            placeholder="https://..."
                          />
                        </div>
                      )}
                      {selfHostedMethod === 'upload' && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Upload an MP3/M4A. Used for the Listen player on the card.</p>
                          {formData.audio_file_path ? (
                            <div className="flex items-center justify-between p-3 bg-gray-800 border border-gray-700 rounded-lg">
                              <span className="text-sm text-gray-300 truncate">{formData.audio_file_path}</span>
                              <button type="button" onClick={clearAudioPreview} className="p-1 text-red-400 hover:text-red-300 shrink-0">
                                <X size={18} />
                              </button>
                            </div>
                          ) : (
                            <label className="flex items-center justify-center gap-2 w-full py-2 px-4 border border-gray-700 border-dashed rounded-lg cursor-pointer bg-gray-800 hover:border-purple-500 transition-colors">
                              <Upload size={18} />
                              <span>{uploadingAudio ? 'Uploading...' : 'Choose MP3/M4A'}</span>
                              <input
                                type="file"
                                accept="audio/mpeg,audio/mp4,audio/x-m4a,.mp3,.m4a"
                                className="hidden"
                                disabled={uploadingAudio}
                                onChange={handleAudioUpload}
                              />
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-700 pt-4 mt-4">
                  <h3 className="text-lg font-semibold mb-2">Audiobook lead magnet</h3>
                  <p className="text-xs text-gray-400 mb-3">
                    Link an audiobook lead magnet to offer a download for offline listening. Same package as the e-book when both are set.
                  </p>
                  <select
                    value={formData.audiobook_lead_magnet_id}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === '__create_lead_magnet__') {
                        router.push(adminCreateUrl('lead-magnets', { type: 'audiobook', returnTo: '/admin/content/publications' }))
                        return
                      }
                      setFormData({ ...formData, audiobook_lead_magnet_id: val })
                    }}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">None</option>
                    <option value="__create_lead_magnet__">Create lead magnet...</option>
                    {audiobookLeadMagnets.map((lm) => (
                      <option key={lm.id} value={lm.id}>{lm.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Publication File (PDF, Document, etc.)</label>
                  {uploadedFile ? (
                    <div className="flex items-center justify-between p-3 bg-gray-800 border border-gray-700 rounded-lg">
                      <div className="flex items-center gap-3">
                        <File size={20} className="text-blue-400" />
                        <div>
                          <p className="text-sm text-white">{uploadedFile.file_name}</p>
                          <p className="text-xs text-gray-400">
                            {(uploadedFile.file_size / 1024).toFixed(2)} KB • {uploadedFile.file_type}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="p-1 text-red-400 hover:text-red-300"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <label 
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-700 border-dashed rounded-lg cursor-pointer bg-gray-800 hover:bg-gray-750 hover:border-purple-500 transition-colors"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-2 text-gray-400" />
                        <p className="mb-2 text-sm text-gray-400">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">PDF, DOC, DOCX, EPUB, etc. (MAX. 10MB)</p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={uploadingFile}
                        accept=".pdf,.doc,.docx,.epub,.txt"
                      />
                    </label>
                  )}
                  {uploadingFile && (
                    <p className="mt-2 text-sm text-gray-400">Uploading file...</p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_published}
                      onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span>Published</span>
                  </label>
                </div>
                <div className="flex gap-4">
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg"
                  >
                    {editingPublication ? 'Update Publication' : 'Create Publication'}
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={handleCancel}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-2 bg-gray-800 border border-gray-700 text-white font-semibold rounded-lg hover:border-gray-600"
                  >
                    Cancel
                  </motion.button>
                </div>
              </form>
            </motion.div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="text-gray-400">Loading publications...</div>
            </div>
          ) : publications.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="mb-4">No publications found. Add your first one!</p>
              <motion.button
                onClick={() => setShowAddForm(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white hover:border-green-500/50 transition-colors flex items-center gap-2 mx-auto"
              >
                <Plus size={20} />
                Add New Publication
              </motion.button>
            </div>
          ) : (
            <div className="space-y-4">
              {publications.map((publication) => (
                <motion.div
                  key={publication.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 bg-gray-900 border border-gray-800 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="flex-grow">
                    <div className="flex items-center gap-3 mb-2">
                      <BookOpen size={20} className="text-green-400" />
                      <h3 className="text-xl font-bold text-white">{publication.title}</h3>
                      {publication.is_published ? (
                        <span className="px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded border border-green-600/50">
                          Published
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-gray-600/20 text-gray-400 rounded border border-gray-600/50">
                          Draft
                        </span>
                      )}
                    </div>
                    {publication.description && (
                      <p className="text-gray-400 text-sm mb-2 line-clamp-2">{publication.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                      {publication.author && (
                        <>
                          <span>By {publication.author}</span>
                          <span>•</span>
                        </>
                      )}
                      {publication.publication_date && (
                        <>
                          <span>{formatDate(publication.publication_date)}</span>
                          <span>•</span>
                        </>
                      )}
                      {publication.publisher && (
                        <>
                          <span>{publication.publisher}</span>
                          <span>•</span>
                        </>
                      )}
                      {publication.publication_url && (
                        <>
                          <a href={publication.publication_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                            View Publication
                          </a>
                          <span>•</span>
                        </>
                      )}
                      <span>Order: {publication.display_order}</span>
                      {publication.file_path && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-blue-400">
                            <File size={14} />
                            File attached
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleMoveOrder(publication, 'up')}
                      className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700"
                      title="Move up"
                    >
                      <ArrowUp size={18} />
                    </button>
                    <button
                      onClick={() => handleMoveOrder(publication, 'down')}
                      className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700"
                      title="Move down"
                    >
                      <ArrowDown size={18} />
                    </button>
                    <button
                      onClick={() => handleTogglePublish(publication)}
                      className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700"
                      title={publication.is_published ? 'Unpublish' : 'Publish'}
                    >
                      {publication.is_published ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    <button
                      onClick={() => handleEdit(publication)}
                      className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700"
                      title="Edit"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(publication.id)}
                      className="p-2 bg-red-600 rounded-lg hover:bg-red-700"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
