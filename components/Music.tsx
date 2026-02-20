'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Music2, ExternalLink, Play, ShoppingCart, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import ExpandableText from '@/components/ui/ExpandableText'
import { formatPriceOrFree } from '@/lib/pricing-model'

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
  linked_product: {
    id: number
    price: number | null
  } | null
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

  const getFileUrl = (filePath: string | null) => {
    if (!filePath) return null
    const { data } = supabase.storage.from('music').getPublicUrl(filePath)
    return data.publicUrl
  }

  const isImage = (fileType: string | null) => {
    return fileType?.startsWith('image/')
  }

  if (loading) {
    return (
      <section id="music" className="py-32 bg-silicon-slate/5">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="h-10 w-48 bg-silicon-slate/20 mx-auto rounded-full animate-pulse" />
        </div>
      </section>
    )
  }

  return (
    <section id="music" className="py-32 px-6 sm:px-10 lg:px-12 bg-silicon-slate/5 relative overflow-hidden">
      {/* Aurora */}
      <div className="absolute top-1/2 right-0 w-[600px] h-[600px] bg-radiant-gold/5 blur-[120px] rounded-full" />

      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <div className="pill-badge bg-silicon-slate/30 border-radiant-gold/20 mb-6 mx-auto">
            <Music2 className="w-3 h-3 text-radiant-gold" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-heading text-radiant-gold">
              Discography
            </span>
          </div>
          <h2 className="font-premium text-4xl md:text-6xl text-platinum-white mb-6">
            <span className="italic text-radiant-gold">Music</span>
          </h2>
          <p className="font-body text-platinum-white/50 text-lg max-w-3xl mx-auto leading-relaxed">
            Storytelling through rhythm and rhyme. Explore the musical journey of <strong className="text-radiant-gold">Mad Hadda</strong>.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {musicEntries.map((entry, index) => {
            const imageUrl = isImage(entry.file_type) ? getFileUrl(entry.file_path) : null
            const releaseYear = entry.release_date ? new Date(entry.release_date).getFullYear() : null
            
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="group relative bg-imperial-navy/40 backdrop-blur-md rounded-2xl overflow-hidden border border-radiant-gold/5 hover:border-radiant-gold/20 transition-all duration-500 flex flex-col"
              >
                {/* Album Image */}
                <div className="relative aspect-square overflow-hidden flex-shrink-0">
                  <Image
                    src={imageUrl || '/V 9T Sitting.jpg'}
                    alt={entry.title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                    sizes="(max-width: 768px) 100vw, 320px"
                    unoptimized
                    onError={(e) => { e.currentTarget.src = '/V 9T Sitting.jpg' }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-imperial-navy via-transparent to-transparent opacity-60" />
                  
                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-all duration-500">
                    <motion.div
                      className="w-20 h-20 bg-radiant-gold/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0"
                    >
                      <Play className="text-imperial-navy ml-1" size={32} fill="currentColor" />
                    </motion.div>
                  </div>

                  {/* Purchase Badge */}
                  {entry.linked_product && (
                    <Link
                      href={`/store/${entry.linked_product.id}`}
                      className="absolute top-6 left-6 px-4 py-2 bg-imperial-navy/90 backdrop-blur-md border border-radiant-gold/20 rounded-full text-radiant-gold text-xs font-heading tracking-widest uppercase font-bold"
                    >
                      {formatPriceOrFree(entry.linked_product.price ?? 0)}
                    </Link>
                  )}
                </div>

                {/* Album Content */}
                <div className="p-8 flex flex-col flex-grow relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-premium text-2xl text-platinum-white group-hover:text-radiant-gold transition-colors">
                        {entry.title}
                      </h3>
                      <p className="text-[10px] font-heading tracking-widest text-platinum-white/40 mt-2 uppercase">
                        {entry.artist} {entry.album && ` • ${entry.album}`} {releaseYear && ` • ${releaseYear}`}
                      </p>
                    </div>
                  </div>

                  {/* Expandable Description */}
                  {entry.description && (
                    <ExpandableText
                      text={entry.description}
                      maxHeight={80}
                      className="font-body text-platinum-white/50 text-sm leading-relaxed mb-8"
                      expandButtonColor="text-radiant-gold hover:text-gold-light"
                    />
                  )}

                  <div className="flex-grow" />

                  {/* Streaming Links */}
                  <div className="flex flex-wrap gap-4 pt-6 border-t border-radiant-gold/5">
                    {entry.spotify_url && (
                      <a href={entry.spotify_url} target="_blank" rel="noopener noreferrer" className="text-platinum-white/40 hover:text-radiant-gold transition-colors">
                        <ExternalLink size={18} />
                      </a>
                    )}
                    {entry.apple_music_url && (
                      <a href={entry.apple_music_url} target="_blank" rel="noopener noreferrer" className="text-platinum-white/40 hover:text-radiant-gold transition-colors">
                        <Music2 size={18} />
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
