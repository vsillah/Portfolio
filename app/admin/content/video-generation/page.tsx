'use client'

import { useState, useEffect } from 'react'
import { Video, Play, RefreshCw, Loader2, ExternalLink, CheckCircle, FileText, X } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'
import { VIDEO_CHANNEL_CONFIGS, type VideoChannel } from '@/lib/constants/video-channel'

interface AvatarOption {
  id: string
  name: string
  type: 'avatar'
}

interface QueueItem {
  id: string
  drive_file_id: string
  drive_file_name: string
  script_text_prior: string | null
  script_text: string
  effective_at: string
  detected_at: string
  status: string
}

interface VideoJob {
  id: string
  script_source: string
  script_text: string
  drive_file_name: string | null
  target_type: string | null
  target_id: string | null
  avatar_id: string
  voice_id: string
  aspect_ratio: string
  channel: string
  heygen_video_id: string | null
  heygen_status: string | null
  error_message: string | null
  video_url: string | null
  video_record_id: number | null
  created_at: string
}

export default function VideoGenerationPage() {
  const [jobs, setJobs] = useState<VideoJob[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [scriptText, setScriptText] = useState('')
  const [email, setEmail] = useState('')
  const [channel, setChannel] = useState<VideoChannel>('youtube')
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9')
  const [title, setTitle] = useState('')
  const [avatars, setAvatars] = useState<AvatarOption[]>([])
  const [avatarsLoading, setAvatarsLoading] = useState(true)
  const [selectedAvatarId, setSelectedAvatarId] = useState('')
  const [queueItems, setQueueItems] = useState<QueueItem[]>([])
  const [queueLoading, setQueueLoading] = useState(true)
  const [generatingQueueId, setGeneratingQueueId] = useState<string | null>(null)
  const [syncingDrive, setSyncingDrive] = useState(false)

  useEffect(() => {
    fetchJobs()
  }, [])

  useEffect(() => {
    fetchQueue()
  }, [])

  useEffect(() => {
    const fetchAvatars = async () => {
      try {
        const session = await getCurrentSession()
        if (!session) return

        const res = await fetch('/api/admin/video-generation/avatars', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && Array.isArray(data.avatars)) {
          setAvatars(data.avatars)
        }
      } catch (err) {
        console.error('Failed to fetch avatars:', err)
      } finally {
        setAvatarsLoading(false)
      }
    }
    fetchAvatars()
  }, [])

  const fetchQueue = async () => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const res = await fetch('/api/admin/video-generation/queue?status=pending', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setQueueItems(data.items ?? [])
      }
    } catch (err) {
      console.error('Failed to fetch queue:', err)
    } finally {
      setQueueLoading(false)
    }
  }

  const fetchJobs = async () => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const res = await fetch('/api/admin/video-generation/jobs', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setJobs(data.jobs ?? [])
      }
    } catch (err) {
      console.error('Failed to fetch jobs:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleChannelChange = (ch: VideoChannel) => {
    setChannel(ch)
    setAspectRatio(VIDEO_CHANNEL_CONFIGS[ch].defaultAspectRatio)
  }

  const handleGenerate = async () => {
    if (!scriptText.trim()) {
      alert('Please enter a script')
      return
    }

    setGenerating(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const res = await fetch('/api/admin/video-generation/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          scriptSource: 'manual',
          scriptText: scriptText.trim(),
          email: email.trim() || undefined,
          channel,
          aspectRatio,
          title: title.trim() || undefined,
          avatarId: selectedAvatarId || undefined,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = data?.error || `Failed to start generation (${res.status})`
        alert(msg)
        return
      }

      setScriptText('')
      setTitle('')
      fetchJobs()
    } catch (err) {
      console.error('Generate error:', err)
      alert('Failed to start generation')
    } finally {
      setGenerating(false)
    }
  }

  const generateFromQueue = async (queueId: string) => {
    setGeneratingQueueId(queueId)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const res = await fetch(`/api/admin/video-generation/queue/${queueId}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          channel,
          aspectRatio,
          avatarId: selectedAvatarId || undefined,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = data?.error || `Failed to start generation (${res.status})`
        alert(msg)
        return
      }
      fetchQueue()
      fetchJobs()
    } catch (err) {
      console.error('Generate from queue error:', err)
      alert('Failed to start generation')
    } finally {
      setGeneratingQueueId(null)
    }
  }

  const syncDrive = async () => {
    setSyncingDrive(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const res = await fetch('/api/admin/video-generation/sync-drive', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        fetchQueue()
        if (data.queued > 0) {
          alert(`Synced ${data.queued} file(s): ${(data.files ?? []).join(', ')}`)
        } else {
          alert(data.message ?? 'No changes detected')
        }
      } else {
        alert(data?.error || 'Sync failed')
      }
    } catch (err) {
      console.error('Sync error:', err)
      alert('Failed to sync Drive')
    } finally {
      setSyncingDrive(false)
    }
  }

  const dismissQueueItem = async (queueId: string) => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const res = await fetch(`/api/admin/video-generation/queue/${queueId}/dismiss`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        fetchQueue()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data?.error || 'Failed to dismiss')
      }
    } catch (err) {
      console.error('Dismiss error:', err)
      alert('Failed to dismiss')
    }
  }

  const refreshJobStatus = async (jobId: string) => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      await fetch(`/api/admin/video-generation/status?jobId=${jobId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      fetchJobs()
    } catch (err) {
      console.error('Refresh status error:', err)
    }
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-imperial-navy text-platinum-white p-6">
        <Breadcrumbs
          items={[
            { label: 'Admin', href: '/admin' },
            { label: 'Content Hub', href: '/admin/content' },
            { label: 'Video Generation', href: '/admin/content/video-generation' },
          ]}
        />

        <div className="max-w-4xl mx-auto mt-8">
          <h1 className="text-2xl font-bold text-radiant-gold mb-6 flex items-center gap-2">
            <Video className="w-7 h-7" />
            Video Generation (HeyGen)
          </h1>

          <div className="bg-silicon-slate/50 rounded-xl border border-silicon-slate p-6 mb-8">
            <h2 className="text-lg font-medium text-platinum-white mb-4">Generate video</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Script <span className="text-gray-500">(max 5,000 characters)</span>
                </label>
                <textarea
                  value={scriptText}
                  onChange={e => setScriptText(e.target.value)}
                  placeholder="Enter the script for the avatar to speak..."
                  rows={5}
                  maxLength={5000}
                  className="w-full bg-imperial-navy border border-silicon-slate rounded-lg px-3 py-2 text-platinum-white placeholder-gray-500 focus:ring-2 focus:ring-radiant-gold/50"
                />
                <div className="text-xs text-gray-500 mt-1">
                  {scriptText.length.toLocaleString()} / 5,000
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Client email (optional — for context)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full bg-imperial-navy border border-silicon-slate rounded-lg px-3 py-2 text-platinum-white placeholder-gray-500 focus:ring-2 focus:ring-radiant-gold/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Title (optional)</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Video title"
                    className="w-full bg-imperial-navy border border-silicon-slate rounded-lg px-3 py-2 text-platinum-white placeholder-gray-500 focus:ring-2 focus:ring-radiant-gold/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Avatar</label>
                <select
                  value={selectedAvatarId}
                  onChange={e => setSelectedAvatarId(e.target.value)}
                  disabled={avatarsLoading}
                  className="w-full bg-imperial-navy border border-silicon-slate rounded-lg px-3 py-2 text-platinum-white focus:ring-2 focus:ring-radiant-gold/50 disabled:opacity-60"
                >
                  {avatarsLoading ? (
                    <option value="">Loading avatars...</option>
                  ) : (
                    <>
                      <option value="">Default (from env)</option>
                      {avatars.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Channel</label>
                  <select
                    value={channel}
                    onChange={e => handleChannelChange(e.target.value as VideoChannel)}
                    className="w-full bg-imperial-navy border border-silicon-slate rounded-lg px-3 py-2 text-platinum-white focus:ring-2 focus:ring-radiant-gold/50"
                  >
                    {Object.entries(VIDEO_CHANNEL_CONFIGS).map(([id, cfg]) => (
                      <option key={id} value={id}>
                        {cfg.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Aspect ratio</label>
                  <select
                    value={aspectRatio}
                    onChange={e => setAspectRatio(e.target.value as '16:9' | '9:16')}
                    className="w-full bg-imperial-navy border border-silicon-slate rounded-lg px-3 py-2 text-platinum-white focus:ring-2 focus:ring-radiant-gold/50"
                  >
                    <option value="16:9">16:9 (standard)</option>
                    <option value="9:16">9:16 (shorts)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={generating || !scriptText.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-radiant-gold text-imperial-navy font-medium rounded-lg hover:bg-gold-light disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Generate
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-silicon-slate/50 rounded-xl border border-silicon-slate p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-platinum-white flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Drive Queue
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={syncDrive}
                  disabled={syncingDrive}
                  className="flex items-center gap-1 text-sm px-2 py-1 bg-radiant-gold/20 text-radiant-gold rounded hover:bg-radiant-gold/30 disabled:opacity-50"
                >
                  {syncingDrive ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Sync Drive
                </button>
                <button
                  onClick={fetchQueue}
                  className="flex items-center gap-1 text-sm text-radiant-gold hover:text-gold-light"
                >
                  Refresh
                </button>
              </div>
            </div>
            {queueLoading ? (
              <div className="text-gray-400">Loading queue...</div>
            ) : queueItems.length === 0 ? (
              <p className="text-gray-400">No pending Drive queue items. Run the cron to sync.</p>
            ) : (
              <div className="space-y-4">
                {queueItems.map(item => (
                  <div
                    key={item.id}
                    className="p-4 bg-imperial-navy/50 rounded-lg border border-silicon-slate"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-platinum-white truncate">
                        {item.drive_file_name}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => generateFromQueue(item.id)}
                          disabled={!!generatingQueueId}
                          className="flex items-center gap-1 text-xs px-2 py-1 bg-radiant-gold text-imperial-navy rounded hover:bg-gold-light disabled:opacity-50"
                        >
                          {generatingQueueId === item.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )}
                          Generate
                        </button>
                        <button
                          onClick={() => dismissQueueItem(item.id)}
                          disabled={!!generatingQueueId}
                          className="flex items-center gap-1 text-xs px-2 py-1 text-gray-400 hover:text-rose-400 disabled:opacity-50"
                        >
                          <X className="w-3 h-3" />
                          Dismiss
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">
                      Modified: {new Date(item.effective_at).toLocaleString()} · Detected:{' '}
                      {new Date(item.detected_at).toLocaleString()}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Prior</div>
                        <pre className="text-xs text-gray-500 bg-imperial-navy rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">
                          {item.script_text_prior ?? '(New file)'}
                        </pre>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Current</div>
                        <pre className="text-xs text-platinum-white bg-imperial-navy rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">
                          {item.script_text}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-silicon-slate/50 rounded-xl border border-silicon-slate p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-platinum-white">Jobs</h2>
              <button
                onClick={fetchJobs}
                className="flex items-center gap-1 text-sm text-radiant-gold hover:text-gold-light"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="text-gray-400">Loading jobs...</div>
            ) : jobs.length === 0 ? (
              <p className="text-gray-400">No jobs yet. Generate a video above.</p>
            ) : (
              <div className="space-y-3">
                {jobs.map(job => (
                  <div
                    key={job.id}
                    className="flex flex-wrap items-center justify-between gap-2 p-3 bg-imperial-navy/50 rounded-lg border border-silicon-slate"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-platinum-white truncate">
                          {job.script_text.slice(0, 60)}...
                        </span>
                        <span className="text-xs text-gray-400">
                          {job.channel} · {job.aspect_ratio}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(job.created_at).toLocaleString()} · {job.heygen_status ?? '—'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {['pending', 'waiting', 'processing'].includes(job.heygen_status ?? '') && (
                        <button
                          onClick={() => refreshJobStatus(job.id)}
                          className="text-xs text-radiant-gold hover:text-gold-light"
                        >
                          Check status
                        </button>
                      )}
                      {(job.heygen_status === 'completed' || job.video_url) && (
                        <>
                          <span className="flex items-center gap-1 text-xs text-emerald-400">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Complete
                          </span>
                          {job.video_url && (
                            <a
                              href={job.video_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-radiant-gold hover:text-gold-light"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View
                            </a>
                          )}
                        </>
                      )}
                      {job.error_message && (
                        <span className="text-xs text-rose-400" title={job.error_message}>
                          Failed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
