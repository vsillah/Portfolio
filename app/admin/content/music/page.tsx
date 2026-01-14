'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Edit, Eye, EyeOff, ArrowUp, ArrowDown, Upload, File, X, Music as MusicIcon } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getCurrentSession } from '@/lib/auth'
import Breadcrumbs from '@/components/admin/Breadcrumbs'

interface Music {
  id: number
  title: string
  artist: string
  album: string | null
  description: string | null
  spotify_url: string | null
  apple_music_url: string | null
  youtube_url: string | null
  release_date: string | null
  genre: string | null
  display_order: number
  is_published: boolean
  file_path: string | null
  file_type: string | null
  file_size: number | null
  created_at: string
  updated_at: string
}

export default function MusicManagementPage() {
  const [music, setMusic] = useState<Music[]>([])
  const [loading, setLoading] = useState(true)
  const [editingMusic, setEditingMusic] = useState<Music | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    album: '',
    description: '',
    spotify_url: '',
    apple_music_url: '',
    youtube_url: '',
    release_date: '',
    genre: '',
    display_order: 0,
    is_published: true,
  })
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<{
    file_path: string
    file_type: string
    file_size: number
    file_name: string
  } | null>(null)

  useEffect(() => {
    fetchMusic()
  }, [])

  const fetchMusic = async () => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch('/api/music?published=false', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setMusic(data || [])
      }
    } catch (error) {
      console.error('Failed to fetch music:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this music entry? This action cannot be undone.')) return

    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch(`/api/music/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        fetchMusic()
      } else {
        alert('Failed to delete music entry')
      }
    } catch (error) {
      console.error('Error deleting music:', error)
      alert('Failed to delete music entry')
    }
  }

  const handleTogglePublish = async (musicItem: Music) => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch(`/api/music/${musicItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          is_published: !musicItem.is_published,
        }),
      })

      if (response.ok) {
        fetchMusic()
      } else {
        alert('Failed to update music entry')
      }
    } catch (error) {
      console.error('Error updating music:', error)
      alert('Failed to update music entry')
    }
  }

  const handleMoveOrder = async (musicItem: Music, direction: 'up' | 'down') => {
    const currentIndex = music.findIndex(m => m.id === musicItem.id)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= music.length) return

    const targetMusic = music[newIndex]
    const newOrder = targetMusic.display_order

    try {
      const session = await getCurrentSession()
      if (!session) return

      await Promise.all([
        fetch(`/api/music/${musicItem.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ display_order: newOrder }),
        }),
        fetch(`/api/music/${targetMusic.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ display_order: musicItem.display_order }),
        }),
      ])

      fetchMusic()
    } catch (error) {
      console.error('Error moving music:', error)
      alert('Failed to reorder music entry')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const session = await getCurrentSession()
      if (!session) return

      const payload = {
        title: formData.title,
        artist: formData.artist,
        album: formData.album || null,
        description: formData.description || null,
        spotify_url: formData.spotify_url || null,
        apple_music_url: formData.apple_music_url || null,
        youtube_url: formData.youtube_url || null,
        release_date: formData.release_date || null,
        genre: formData.genre || null,
        display_order: formData.display_order,
        is_published: formData.is_published,
        file_path: uploadedFile?.file_path || null,
        file_type: uploadedFile?.file_type || null,
        file_size: uploadedFile?.file_size || null,
      }

      const url = editingMusic ? `/api/music/${editingMusic.id}` : '/api/music'
      const method = editingMusic ? 'PUT' : 'POST'

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
        setEditingMusic(null)
        setFormData({
          title: '',
          artist: '',
          album: '',
          description: '',
          spotify_url: '',
          apple_music_url: '',
          youtube_url: '',
          release_date: '',
          genre: '',
          display_order: 0,
          is_published: true,
        })
        setUploadedFile(null)
        fetchMusic()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to save music entry')
      }
    } catch (error) {
      console.error('Error saving music:', error)
      alert('Failed to save music entry')
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
      if (editingMusic) {
        formData.append('musicId', editingMusic.id.toString())
      }

      const response = await fetch('/api/music/upload', {
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

  const handleEdit = (musicItem: Music) => {
    setEditingMusic(musicItem)
    setFormData({
      title: musicItem.title,
      artist: musicItem.artist,
      album: musicItem.album || '',
      description: musicItem.description || '',
      spotify_url: musicItem.spotify_url || '',
      apple_music_url: musicItem.apple_music_url || '',
      youtube_url: musicItem.youtube_url || '',
      release_date: musicItem.release_date ? musicItem.release_date.split('T')[0] : '',
      genre: musicItem.genre || '',
      display_order: musicItem.display_order,
      is_published: musicItem.is_published,
    })
    if (musicItem.file_path) {
      setUploadedFile({
        file_path: musicItem.file_path,
        file_type: musicItem.file_type || '',
        file_size: musicItem.file_size || 0,
        file_name: musicItem.file_path.split('/').pop() || 'file',
      })
    } else {
      setUploadedFile(null)
    }
    setShowAddForm(true)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingMusic(null)
    setUploadedFile(null)
    setFormData({
      title: '',
      artist: '',
      album: '',
      description: '',
      spotify_url: '',
      apple_music_url: '',
      youtube_url: '',
      release_date: '',
      genre: '',
      display_order: 0,
      is_published: true,
    })
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-7xl mx-auto">
          <Breadcrumbs items={[
            { label: 'Admin Dashboard', href: '/admin' },
            { label: 'Content Management', href: '/admin/content' },
            { label: 'Music' }
          ]} />
          
          <div className="mb-8 flex items-center justify-between">
            <div>
          <h1 className="text-4xl font-bold mb-2">Music Management</h1>
              <p className="text-gray-400">Manage music projects and releases</p>
            </div>
            {!showAddForm && (
              <motion.button
                onClick={() => setShowAddForm(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg flex items-center gap-2"
              >
                <Plus size={20} />
                Add Music
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
                {editingMusic ? 'Edit Music Entry' : 'Add New Music Entry'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                    <label className="block text-sm font-medium mb-2">Artist *</label>
                    <input
                      type="text"
                      value={formData.artist}
                      onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Album</label>
                    <input
                      type="text"
                      value={formData.album}
                      onChange={(e) => setFormData({ ...formData, album: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      placeholder="Album name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Genre</label>
                    <input
                      type="text"
                      value={formData.genre}
                      onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      placeholder="Hip Hop, R&B, etc."
                    />
                  </div>
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
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Spotify URL</label>
                    <input
                      type="url"
                      value={formData.spotify_url}
                      onChange={(e) => setFormData({ ...formData, spotify_url: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      placeholder="https://open.spotify.com/..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Apple Music URL</label>
                    <input
                      type="url"
                      value={formData.apple_music_url}
                      onChange={(e) => setFormData({ ...formData, apple_music_url: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      placeholder="https://music.apple.com/..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">YouTube URL</label>
                    <input
                      type="url"
                      value={formData.youtube_url}
                      onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      placeholder="https://youtube.com/watch?v=..."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Release Date</label>
                    <input
                      type="date"
                      value={formData.release_date}
                      onChange={(e) => setFormData({ ...formData, release_date: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    />
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
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Music File or Album Artwork</label>
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
                        <p className="text-xs text-gray-500">MP3, WAV, JPG, PNG, PDF, etc. (MAX. 50MB)</p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={uploadingFile}
                        accept=".mp3,.wav,.jpg,.jpeg,.png,.pdf,.doc,.docx"
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
                    className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg"
                  >
                    {editingMusic ? 'Update Music' : 'Create Music'}
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
              <div className="text-gray-400">Loading music...</div>
            </div>
          ) : music.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="mb-4">No music entries found. Add your first one!</p>
              <motion.button
                onClick={() => setShowAddForm(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white hover:border-purple-500/50 transition-colors flex items-center gap-2 mx-auto"
              >
                <Plus size={20} />
                Add New Music Entry
              </motion.button>
            </div>
          ) : (
            <div className="space-y-4">
              {music.map((musicItem) => (
                <motion.div
                  key={musicItem.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 bg-gray-900 border border-gray-800 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="flex-grow">
                    <div className="flex items-center gap-3 mb-2">
                      <MusicIcon size={20} className="text-purple-400" />
                      <h3 className="text-xl font-bold text-white">{musicItem.title}</h3>
                      {musicItem.is_published ? (
                        <span className="px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded border border-green-600/50">
                          Published
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-gray-600/20 text-gray-400 rounded border border-gray-600/50">
                          Draft
                        </span>
                      )}
                    </div>
                    <div className="text-gray-400 text-sm mb-2">
                      <span className="font-semibold">{musicItem.artist}</span>
                      {musicItem.album && <span> • {musicItem.album}</span>}
                      {musicItem.genre && <span> • {musicItem.genre}</span>}
                    </div>
                    {musicItem.description && (
                      <p className="text-gray-400 text-sm mb-2 line-clamp-2">{musicItem.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                      {musicItem.release_date && (
                        <>
                          <span>Released: {formatDate(musicItem.release_date)}</span>
                          <span>•</span>
                        </>
                      )}
                      <span>Order: {musicItem.display_order}</span>
                      {musicItem.spotify_url && (
                        <>
                          <span>•</span>
                          <a href={musicItem.spotify_url} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300">
                            Spotify
                          </a>
                        </>
                      )}
                      {musicItem.youtube_url && (
                        <>
                          <span>•</span>
                          <a href={musicItem.youtube_url} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300">
                            YouTube
                          </a>
                        </>
                      )}
                      {musicItem.file_path && (
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
                      onClick={() => handleMoveOrder(musicItem, 'up')}
                      className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700"
                      title="Move up"
                    >
                      <ArrowUp size={18} />
                    </button>
                    <button
                      onClick={() => handleMoveOrder(musicItem, 'down')}
                      className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700"
                      title="Move down"
                    >
                      <ArrowDown size={18} />
                    </button>
                    <button
                      onClick={() => handleTogglePublish(musicItem)}
                      className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700"
                      title={musicItem.is_published ? 'Unpublish' : 'Publish'}
                    >
                      {musicItem.is_published ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    <button
                      onClick={() => handleEdit(musicItem)}
                      className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700"
                      title="Edit"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(musicItem.id)}
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
