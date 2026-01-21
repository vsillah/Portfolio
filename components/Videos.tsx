'use client'

import { motion } from 'framer-motion'
import { Play, Youtube, X, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { analytics } from '@/lib/analytics'
import ExpandableText from '@/components/ui/ExpandableText'

const videos = [
  {
    id: 1,
    title: 'Never Know Bar 4 Bar Breakdown, 1st Verse',
    description: 'This is the Bar for Bar Breakdown of "Never Know", the first single release from "Into the Rabbit Hole" album by Mad Hadda',
    videoId: 'ps5WbgLk4mI',
    thumbnail: 'https://img.youtube.com/vi/ps5WbgLk4mI/hqdefault.jpg?v=2',
  },
  {
    id: 2,
    title: 'Never Know Bar 4 Bar Breakdown, 2nd Verse',
    description: 'This is the Bar for Bar Breakdown of "Never Know", the first single release from "Into the Rabbit Hole" album by Mad Hadda',
    videoId: 'VltoBXKskOE',
    thumbnail: 'https://img.youtube.com/vi/VltoBXKskOE/hqdefault.jpg?v=2',
  },
  {
    id: 3,
    title: 'Shoulders of Giants short video',
    description: 'This is the short video of "Shoulders of Giants", the second single release from "Into the Rabbit Hole" album by Mad Hadda',
    videoId: 'V4phmDS8Bik',
    thumbnail: 'https://img.youtube.com/vi/V4phmDS8Bik/hqdefault.jpg?v=2',
  },
]

export default function Videos() {
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null)

  const openVideo = (videoId: string, videoTitle: string) => {
    analytics.videoPlay(videoId, videoTitle)
    setSelectedVideo(videoId)
  }

  const closeVideo = () => setSelectedVideo(null)

  return (
    <section id="videos" className="py-32 px-6 sm:px-10 lg:px-12 bg-imperial-navy relative overflow-hidden">
      {/* Aurora */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-radiant-gold/5 blur-[120px] rounded-full" />

      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <div className="pill-badge bg-silicon-slate/30 border-radiant-gold/20 mb-6 mx-auto">
            <Youtube className="w-3 h-3 text-radiant-gold" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-heading text-radiant-gold">
              Visuals
            </span>
          </div>
          <h2 className="font-premium text-4xl md:text-6xl text-platinum-white mb-6">
            <span className="italic text-radiant-gold">Videos</span>
          </h2>
          <p className="font-body text-platinum-white/50 text-lg max-w-2xl mx-auto">
            Behind-the-scenes insights, lyric breakdowns, and strategic visual content.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {videos.map((video, index) => (
            <motion.div
              key={video.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group relative bg-silicon-slate/40 backdrop-blur-md rounded-2xl overflow-hidden border border-radiant-gold/5 hover:border-radiant-gold/20 transition-all duration-500 flex flex-col"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video overflow-hidden flex-shrink-0">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-imperial-navy via-transparent to-transparent opacity-60" />
                
                {/* Play Button */}
                <motion.button
                  onClick={() => openVideo(video.videoId, video.title)}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-all duration-500"
                >
                  <motion.div
                    className="w-20 h-20 bg-radiant-gold/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-2xl scale-90 group-hover:scale-100 transition-transform duration-500"
                  >
                    <Play className="text-imperial-navy ml-1" size={32} fill="currentColor" />
                  </motion.div>
                </motion.button>

                <div className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1 bg-imperial-navy/80 backdrop-blur-md border border-radiant-gold/20 rounded-full text-[10px] font-heading tracking-widest text-radiant-gold uppercase">
                  <Youtube size={12} />
                  <span>Watch</span>
                </div>
              </div>

              {/* Video Info */}
              <div className="p-8 flex flex-col flex-grow">
                <h3 className="font-premium text-2xl text-platinum-white group-hover:text-radiant-gold transition-colors mb-4">
                  {video.title}
                </h3>
                
                <ExpandableText
                  text={video.description}
                  maxHeight={80}
                  className="font-body text-platinum-white/50 text-sm leading-relaxed"
                  expandButtonColor="text-radiant-gold hover:text-gold-light"
                />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Video Modal */}
        {selectedVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-imperial-navy/95 backdrop-blur-xl p-6"
            onClick={closeVideo}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-5xl aspect-video glass-card p-2 border-radiant-gold/20"
              onClick={(e) => e.stopPropagation()}
            >
              <iframe
                src={`https://www.youtube.com/embed/${selectedVideo}?autoplay=1`}
                className="w-full h-full rounded-lg"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
              <button
                onClick={closeVideo}
                className="absolute -top-12 right-0 text-platinum-white/60 hover:text-radiant-gold flex items-center gap-2 text-[10px] font-heading tracking-widest uppercase transition-colors"
              >
                <span>Close</span>
                <X size={16} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </div>
    </section>
  )
}
