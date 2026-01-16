'use client'

import { motion } from 'framer-motion'
import { Play, Youtube } from 'lucide-react'
import { useState } from 'react'
import { analytics } from '@/lib/analytics'
import ExpandableText from '@/components/ui/ExpandableText'

// Sample YouTube videos - replace with your actual video IDs
const videos = [
  {
    id: 1,
    title: 'Never Know Bar 4 Bar Breakdown, 1st Verse',
    description: 'This is the Bar for Bar Breakdown of "Never Know", the first single release from "Into the Rabbit Hole" album by Mad Hadda',
    videoId: 'ps5WbgLk4mI', // Replaced with my YouTube video ID
    thumbnail: 'https://img.youtube.com/vi/ps5WbgLk4mI/hqdefault.jpg',
  },
  {
    id: 2,
    title: 'Never Know Bar 4 Bar Breakdown, 2nd Verse',
    description: 'This is the Bar for Bar Breakdown of "Never Know", the first single release from "Into the Rabbit Hole" album by Mad Hadda',
    videoId: 'VltoBXKskOE', // Replaced with my YouTube video ID
    thumbnail: 'https://img.youtube.com/vi/VltoBXKskOE/hqdefault.jpg',
  },
  {
    id: 3,
    title: 'Shoulders of Giants short video',
    description: 'This is the short video of "Shoulders of Giants", the second single release from "Into the Rabbit Hole" album by Mad Hadda',
    videoId: 'V4phmDS8Bik', // Replace with your YouTube video ID
    thumbnail: 'https://img.youtube.com/vi/V4phmDS8Bik/hqdefault.jpg',
  },
]

export default function Videos() {
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null)

  const openVideo = (videoId: string, videoTitle: string) => {
    analytics.videoPlay(videoId, videoTitle)
    setSelectedVideo(videoId)
  }

  const closeVideo = () => {
    setSelectedVideo(null)
  }

  return (
    <section id="videos" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-black to-gray-900">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Youtube className="text-red-500" size={40} />
            <h2 className="text-4xl md:text-5xl font-bold">
              <span className="gradient-text">YouTube Channel</span>
            </h2>
          </div>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Product management insights, strategic initiatives, and professional development content
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
          {videos.map((video, index) => (
            <motion.div
              key={video.id}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group relative rounded-xl overflow-hidden border border-gray-800 hover:border-red-500/50 transition-all duration-300 bg-gray-900 flex flex-col"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video overflow-hidden flex-shrink-0">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to medium quality if high quality fails
                    const target = e.target as HTMLImageElement
                    if (target.src.includes('hqdefault')) {
                      target.src = `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`
                    } else if (target.src.includes('mqdefault')) {
                      target.src = `https://img.youtube.com/vi/${video.videoId}/default.jpg`
                    }
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                
                {/* Play Button Overlay */}
                <motion.button
                  onClick={() => openVideo(video.videoId, video.title)}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/20 transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center shadow-lg"
                    whileHover={{ scale: 1.1 }}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Play className="text-white ml-1" size={30} fill="white" />
                  </motion.div>
                </motion.button>

                {/* YouTube Badge */}
                <div className="absolute top-4 right-4 bg-red-600 px-3 py-1 rounded-full flex items-center gap-2">
                  <Youtube size={16} className="text-white" />
                  <span className="text-white text-xs font-semibold">YouTube</span>
                </div>
              </div>

              {/* Video Info */}
              <div className="p-6 flex flex-col flex-grow">
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-red-400 transition-colors">
                  {video.title}
                </h3>
                
                {/* Expandable Description */}
                <ExpandableText
                  text={video.description}
                  maxHeight={80}
                  className="text-gray-400 text-sm"
                  expandButtonColor="text-red-400 hover:text-red-300"
                />

                {/* Spacer to push content to bottom if needed */}
                <div className="flex-grow" />
              </div>

              {/* Hover glow effect */}
              <motion.div
                className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                initial={false}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 to-pink-600/20 blur-xl" />
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* Video Modal */}
        {selectedVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={closeVideo}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-4xl aspect-video"
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
                className="absolute -top-12 right-0 text-white hover:text-red-500 transition-colors"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </div>
    </section>
  )
}
