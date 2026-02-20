'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Edit, Eye, EyeOff, ArrowUp, ArrowDown, Upload, File, X, Video as VideoIcon } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { ImageUrlInput } from '@/components/admin/ImageUrlInput'
import { getCurrentSession } from '@/lib/auth'
import Breadcrumbs from '@/components/admin/Breadcrumbs'

interface Video {
  id: number
  title: string
  description: string | null
  video_url: string | null
  thumbnail_url: string | null
  duration: number | null
  display_order: number
  is_published: boolean
  file_path: string | null
  file_type: string | null
  file_size: number | null
  created_at: string
  updated_at: string
}

export default function VideosManagementPage() {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [editingVideo, setEditingVideo] = useState<Video | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    video_url: '',
    thumbnail_url: '',
    duration: '',
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
    fetchVideos()
  }, [])

  const fetchVideos = async () => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch('/api/videos?published=false', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setVideos(data || [])
      }
    } catch (error) {
      console.error('Failed to fetch videos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this video? This action cannot be undone.')) return

    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch(`/api/videos/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        fetchVideos()
      } else {
        alert('Failed to delete video')
      }
    } catch (error) {
      console.error('Error deleting video:', error)
      alert('Failed to delete video')
    }
  }

  const handleTogglePublish = async (video: Video) => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch(`/api/videos/${video.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          is_published: !video.is_published,
        }),
      })

      if (response.ok) {
        fetchVideos()
      } else {
        alert('Failed to update video')
      }
    } catch (error) {
      console.error('Error updating video:', error)
      alert('Failed to update video')
    }
  }

  const handleMoveOrder = async (video: Video, direction: 'up' | 'down') => {
    const currentIndex = videos.findIndex(v => v.id === video.id)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= videos.length) return

    const targetVideo = videos[newIndex]
    const newOrder = targetVideo.display_order

    try {
      const session = await getCurrentSession()
      if (!session) return

      await Promise.all([
        fetch(`/api/videos/${video.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ display_order: newOrder }),
        }),
        fetch(`/api/videos/${targetVideo.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ display_order: video.display_order }),
        }),
      ])

      fetchVideos()
    } catch (error) {
      console.error('Error moving video:', error)
      alert('Failed to reorder video')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const session = await getCurrentSession()
      if (!session) return

      const payload = {
        title: formData.title,
        description: formData.description || null,
        video_url: formData.video_url || null,
        thumbnail_url: formData.thumbnail_url || null,
        duration: formData.duration ? parseInt(formData.duration) : null,
        display_order: formData.display_order,
        is_published: formData.is_published,
        file_path: uploadedFile?.file_path || null,
        file_type: uploadedFile?.file_type || null,
        file_size: uploadedFile?.file_size || null,
      }

      const url = editingVideo ? `/api/videos/${editingVideo.id}` : '/api/videos'
      const method = editingVideo ? 'PUT' : 'POST'

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
        setEditingVideo(null)
        setFormData({
          title: '',
          description: '',
          video_url: '',
          thumbnail_url: '',
          duration: '',
          display_order: 0,
          is_published: true,
        })
        setUploadedFile(null)
        fetchVideos()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to save video')
      }
    } catch (error) {
      console.error('Error saving video:', error)
      alert('Failed to save video')
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
      if (editingVideo) {
        formData.append('videoId', editingVideo.id.toString())
      }

      const response = await fetch('/api/videos/upload', {
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

  const handleEdit = (video: Video) => {
    setEditingVideo(video)
    setFormData({
      title: video.title,
      description: video.description || '',
      video_url: video.video_url || '',
      thumbnail_url: video.thumbnail_url || '',
      duration: video.duration?.toString() || '',
      display_order: video.display_order,
      is_published: video.is_published,
    })
    if (video.file_path) {
      setUploadedFile({
        file_path: video.file_path,
        file_type: video.file_type || '',
        file_size: video.file_size || 0,
        file_name: video.file_path.split('/').pop() || 'file',
      })
    } else {
      setUploadedFile(null)
    }
    setShowAddForm(true)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingVideo(null)
    setUploadedFile(null)
    setFormData({
      title: '',
      description: '',
      video_url: '',
      thumbnail_url: '',
      duration: '',
      display_order: 0,
      is_published: true,
    })
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="max-w-7xl mx-auto">
          <Breadcrumbs items={[
            { label: 'Admin Dashboard', href: '/admin' },
            { label: 'Content Management', href: '/admin/content' },
            { label: 'Videos' }
          ]} />
          
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Videos Management</h1>
              <p className="text-gray-400">Manage video content</p>
            </div>
            {!showAddForm && (
              <motion.button
                onClick={() => setShowAddForm(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white font-semibold rounded-lg flex items-center gap-2"
              >
                <Plus size={20} />
                Add Video
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
                {editingVideo ? 'Edit Video' : 'Add New Video'}
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
                    <label className="block text-sm font-medium mb-2">Video URL</label>
                    <input
                      type="url"
                      value={formData.video_url}
                      onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      placeholder="https://youtube.com/watch?v=..."
                    />
                  </div>
                  <ImageUrlInput
                    value={formData.thumbnail_url || ''}
                    onChange={(thumbnail_url) => setFormData({ ...formData, thumbnail_url })}
                    label="Thumbnail URL"
                    placeholderExternal="example.com/thumbnail.jpg"
                    variant="neutral"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Duration (seconds)</label>
                    <input
                      type="number"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      placeholder="120"
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
                  <label className="block text-sm font-medium mb-2">Video File or Document</label>
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
                        <p className="text-xs text-gray-500">MP4, AVI, MOV, PDF, DOC, etc. (MAX. 50MB)</p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={uploadingFile}
                        accept=".mp4,.avi,.mov,.pdf,.doc,.docx,.txt,.zip"
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
                    className="px-6 py-2 bg-gradient-to-r from-red-600 to-pink-600 text-white font-semibold rounded-lg"
                  >
                    {editingVideo ? 'Update Video' : 'Create Video'}
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
              <div className="text-gray-400">Loading videos...</div>
            </div>
          ) : videos.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="mb-4">No videos found. Add your first one!</p>
              <motion.button
                onClick={() => setShowAddForm(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white hover:border-red-500/50 transition-colors flex items-center gap-2 mx-auto"
              >
                <Plus size={20} />
                Add New Video
              </motion.button>
            </div>
          ) : (
            <div className="space-y-4">
              {videos.map((video) => (
                <motion.div
                  key={video.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 bg-gray-900 border border-gray-800 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="flex-grow">
                    <div className="flex items-center gap-3 mb-2">
                      <VideoIcon size={20} className="text-red-400" />
                      <h3 className="text-xl font-bold text-white">{video.title}</h3>
                      {video.is_published ? (
                        <span className="px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded border border-green-600/50">
                          Published
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-gray-600/20 text-gray-400 rounded border border-gray-600/50">
                          Draft
                        </span>
                      )}
                    </div>
                    {video.description && (
                      <p className="text-gray-400 text-sm mb-2 line-clamp-2">{video.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                      {video.duration && (
                        <>
                          <span>Duration: {formatDuration(video.duration)}</span>
                          <span>•</span>
                        </>
                      )}
                      {video.video_url && (
                        <>
                          <a href={video.video_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                            Watch Video
                          </a>
                          <span>•</span>
                        </>
                      )}
                      <span>Order: {video.display_order}</span>
                      {video.file_path && (
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
                      onClick={() => handleMoveOrder(video, 'up')}
                      className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700"
                      title="Move up"
                    >
                      <ArrowUp size={18} />
                    </button>
                    <button
                      onClick={() => handleMoveOrder(video, 'down')}
                      className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700"
                      title="Move down"
                    >
                      <ArrowDown size={18} />
                    </button>
                    <button
                      onClick={() => handleTogglePublish(video)}
                      className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700"
                      title={video.is_published ? 'Unpublish' : 'Publish'}
                    >
                      {video.is_published ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    <button
                      onClick={() => handleEdit(video)}
                      className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700"
                      title="Edit"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(video.id)}
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
