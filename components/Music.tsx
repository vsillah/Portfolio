'use client'

import { motion } from 'framer-motion'
import { Music2, ExternalLink, Play } from 'lucide-react'

const musicProjects = [
  {
    id: 1,
    title: 'Into the Rabbit Hole',
    artist: 'Mad Hadda',
    type: 'Album',
    year: '2025',
    description: 'A highly anticipated album that delves deep into personal and artistic evolution, blending old-school beats with modern sounds.',
    spotifyLink: 'https://open.spotify.com/artist/1B5vy5knIGXOxClIzkkVHR?si=frSOxcxXSPCi6S04691zkg',
    image: '/ITRH_Cover.png', // Changed from '/V 9T Stylish.jpg'
    popularTracks: ['Never Know', 'Shoulders of Giants', 'Odds Against Humanity', 'Politics', 'Trip to Mars'],
  },
]

export default function Music() {
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
          {musicProjects.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group relative bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-800 hover:border-green-500/50 transition-all duration-300"
              style={{
                boxShadow: '0 0 20px rgba(34, 197, 94, 0.1)',
              }}
            >
              {/* Album Image */}
              <div className="relative h-64 overflow-hidden rounded-t-xl">
                <motion.img
                  src={project.image}
                  alt={project.title}
                  className="w-full h-full object-contain"
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.3 }}
                  onError={(e) => {
                    e.currentTarget.src = '/V 9T Sitting.jpg' // Fallback image
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
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-white group-hover:text-green-400 transition-colors">
                      {project.title}
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">{project.artist} • {project.type} • {project.year}</p>
                  </div>
                  <Music2 className="text-green-400" size={20} />
                </div>

                <p className="text-gray-400 text-sm mb-4">
                  {project.description}
                </p>

                {/* Popular Tracks */}
                {project.popularTracks && project.popularTracks.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2">Popular Tracks:</p>
                    <div className="flex flex-wrap gap-2">
                      {project.popularTracks.slice(0, 3).map((track) => (
                        <span
                          key={track}
                          className="px-2 py-1 text-xs bg-gray-800/50 text-gray-300 rounded-md border border-gray-700/50"
                        >
                          {track}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Spotify Link */}
                <motion.a
                  href={project.spotifyLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 rounded-lg text-white font-semibold hover:shadow-lg hover:shadow-green-500/50 transition-all group/link"
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span>Listen on Spotify</span>
                  <ExternalLink size={18} className="group-hover/link:translate-x-1 transition-transform" />
                </motion.a>
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
          ))}
        </div>
      </div>
    </section>
  )
}

