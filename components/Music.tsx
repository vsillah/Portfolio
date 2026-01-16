'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Music2, ExternalLink, Play } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ExpandableText from '@/components/ui/ExpandableText'

interface MusicEntry {
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
  created_at: string
}

export default function Music() {
  const [musicEntries, setMusicEntries] = useState<MusicEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMusic()
  }, [])

  const fetchMusic = async () => {
    try {
      const response = await fetch('/api/music?published=true')
      if (response.ok) {
        const data = await response.json()
        setMusicEntries(data || [])
      }
    } catch (error) {
      console.error('Error fetching music:', error)
    } finally {
      setLoading(false)
    }
  }

  // Get public URL for file from Supabase storage
  const getFileUrl = (filePath: string | null) => {
    if (!filePath) return null
    const { data } = supabase.storage.from('music').getPublicUrl(filePath)
    return data.publicUrl
  }

  // Check if file is an image
  const isImage = (fileType: string | null) => {
    return fileType?.startsWith('image/')
  }

  if (loading) {
    return (
      <section id="music" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-900 to-black">
        <div className="max-w-7xl mx-auto text-center">
          <div className="text-gray-400">Loading music...</div>
        </div>
      </section>
    )
  }

  if (musicEntries.length === 0) {
    return (
      <section id="music" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-900 to-black relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-500/30 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/30 rounded-full blur-3xl" />
        </div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="gradient-text">Music</span>
            </h2>
            <p className="text-gray-400 mt-8">No music entries yet. Check back soon!</p>
          </motion.div>
        </div>
      </section>
    )
  }

  return (
    <section id="music" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-900 to-black relative overflow-hidden">
      {/* Subtle background effect */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-500/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/30 rounded-full blur-3xl" />
      </div>
      
      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">Music</span>
          </h2>
          <div className="mt-8 max-w-3xl mx-auto">
            <p className="text-gray-300 leading-relaxed">
              Hailing from the vibrant neighborhood of Roxbury, MA, <strong className="text-white">Mad Hadda</strong> is not just a hip hop artist; 
              he's a storyteller whose roots run deep in the rich cultural tapestry of Boston. His music blends thoughtful narratives with innovative 
              beats, exploring themes of social justice, personal growth, and the complexities of identity - blending old-school beats with modern sounds.
            </p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {musicEntries.map((entry, index) => {
            const imageUrl = isImage(entry.file_type) ? getFileUrl(entry.file_path) : null
            const releaseYear = entry.release_date ? new Date(entry.release_date).getFullYear() : null
            
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group relative bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-800 hover:border-green-500/50 transition-all duration-300 flex flex-col"
                style={{
                  boxShadow: '0 0 20px rgba(34, 197, 94, 0.1)',
                }}
              >
                {/* Album Image */}
                <div className="relative h-64 overflow-hidden rounded-t-xl flex-shrink-0">
                  <motion.img
                    src={imageUrl || '/V 9T Sitting.jpg'}
                    alt={entry.title}
                    className="w-full h-full object-contain"
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.3 }}
                    onError={(e) => {
                      e.currentTarget.src = '/V 9T Sitting.jpg'
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                  
                  {/* Music Icon Overlay */}
                  <div className="absolute top-4 right-4 bg-green-600/90 backdrop-blur-sm p-3 rounded-full">
                    <Music2 className="text-white" size={24} />
                  </div>

                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-colors">
                    <motion.div
                      className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      whileHover={{ scale: 1.1 }}
                    >
                      <Play className="text-white ml-1" size={24} fill="white" />
                    </motion.div>
                  </div>
                </div>

                {/* Album Content */}
                <div className="p-6 flex flex-col flex-grow">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-xl font-bold text-white group-hover:text-green-400 transition-colors">
                        {entry.title}
                      </h3>
                      <p className="text-sm text-gray-400 mt-1">
                        {entry.artist}
                        {entry.album && ` • ${entry.album}`}
                        {releaseYear && ` • ${releaseYear}`}
                      </p>
                    </div>
                    <Music2 className="text-green-400 flex-shrink-0" size={20} />
                  </div>

                  {/* Expandable Description */}
                  {entry.description && (
                    <ExpandableText
                      text={entry.description}
                      maxHeight={80}
                      className="text-gray-400 text-sm"
                      expandButtonColor="text-green-400 hover:text-green-300"
                    />
                  )}

                  {/* Genre Tag */}
                  {entry.genre && (
                    <div className="mb-4">
                      <span className="px-2 py-1 text-xs bg-gray-800/50 text-gray-300 rounded-md border border-gray-700/50">
                        {entry.genre}
                      </span>
                    </div>
                  )}

                  {/* Spacer to push buttons to bottom */}
                  <div className="flex-grow" />

                  {/* Streaming Links */}
                  <div className="space-y-2 mt-auto">
                    {entry.spotify_url && (
                      <motion.a
                        href={entry.spotify_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 rounded-lg text-white font-semibold hover:shadow-lg hover:shadow-green-500/50 transition-all group/link"
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <span>Listen on Spotify</span>
                        <ExternalLink size={18} className="group-hover/link:translate-x-1 transition-transform" />
                      </motion.a>
                    )}
                    
                    {entry.apple_music_url && (
                      <motion.a
                        href={entry.apple_music_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full px-6 py-2 bg-gradient-to-r from-pink-500 to-red-500 rounded-lg text-white font-semibold hover:shadow-lg transition-all"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <span>Apple Music</span>
                        <ExternalLink size={16} />
                      </motion.a>
                    )}
                    
                    {entry.youtube_url && (
                      <motion.a
                        href={entry.youtube_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full px-6 py-2 bg-gradient-to-r from-red-600 to-red-700 rounded-lg text-white font-semibold hover:shadow-lg transition-all"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <span>YouTube</span>
                        <ExternalLink size={16} />
                      </motion.a>
                    )}
                  </div>
                </div>

                {/* Glow effect on hover */}
                <motion.div
                  className="absolute -inset-1 rounded-xl pointer-events-none opacity-0 group-hover:opacity-75 transition-opacity"
                  initial={false}
                >
                  <div 
                    className="absolute inset-0 rounded-xl blur-xl"
                    style={{
                      background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.4), rgba(16, 185, 129, 0.4))',
                    }}
                  />
                </motion.div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
