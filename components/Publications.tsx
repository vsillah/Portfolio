'use client'

import { motion } from 'framer-motion'
import { BookOpen, ExternalLink } from 'lucide-react'

const publications = [
  {
    id: 1,
    title: 'My Book',
    description: 'Check out my published work on Amazon',
    amazonLink: 'https://a.co/d/bVCvCyT',
    image: '/The_Equity_Code_Cover.png',
  },
]

export default function Publications() {
  return (
    <section id="publications" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-black to-gray-900 relative overflow-hidden">
      {/* Subtle background effect */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-pink-500/30 rounded-full blur-3xl" />
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
            <span className="gradient-text">Publications</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Published works and written content
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {publications.map((publication, index) => (
            <motion.div
              key={publication.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group relative bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-800 hover:border-purple-500/50 transition-all duration-300"
              style={{
                boxShadow: '0 0 20px rgba(139, 92, 246, 0.1)',
              }}
            >
              {/* Publication Image */}
              <div className="relative h-64 overflow-hidden rounded-t-xl">
                <motion.img
                  src={publication.image}
                  alt={publication.title}
                  className="w-full h-full object-contain"
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.3 }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                
                {/* Book Icon Overlay */}
                <div className="absolute top-4 right-4 bg-purple-600/90 backdrop-blur-sm p-3 rounded-full">
                  <BookOpen className="text-white" size={24} />
                </div>
              </div>

              {/* Publication Content */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-xl font-bold text-white group-hover:text-purple-400 transition-colors">
                    {publication.title}
                  </h3>
                  <BookOpen className="text-purple-400" size={20} />
                </div>

                <p className="text-gray-400 text-sm mb-6">
                  {publication.description}
                </p>

                {/* Amazon Link */}
                <motion.a
                  href={publication.amazonLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-white font-semibold hover:shadow-lg hover:shadow-orange-500/50 transition-all group/link"
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span>View on Amazon</span>
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
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.4), rgba(236, 72, 153, 0.4))',
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

