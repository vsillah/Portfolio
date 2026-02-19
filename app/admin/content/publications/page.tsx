'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Edit, Eye, EyeOff, ArrowUp, ArrowDown, Upload, File, X, BookOpen } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getCurrentSession } from '@/lib/auth'
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
}

export default function PublicationsManagementPage() {
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
  })
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
        setFormData({
          title: '',
          description: '',
          publication_url: '',
          author: '',
          publication_date: '',
          publisher: '',
          display_order: 0,
          is_published: true,
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

  const handleEdit = (publication: Publication) => {
    setEditingPublication(publication)
    setFormData({
      title: publication.title,
      description: publication.description || '',
      publication_url: publication.publication_url || '',
      author: publication.author || '',
      publication_date: publication.publication_date ? publication.publication_date.split('T')[0] : '',
      publisher: publication.publisher || '',
      display_order: publication.display_order,
      is_published: publication.is_published,
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
    setFormData({
      title: '',
      description: '',
      publication_url: '',
      author: '',
      publication_date: '',
      publisher: '',
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
