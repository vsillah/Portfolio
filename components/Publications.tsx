'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, ExternalLink, ShoppingCart, ArrowRight } from 'lucide-react'
import ExpandableText from '@/components/ui/ExpandableText'
import Link from 'next/link'

interface Publication {
  id: number
  title: string
  description: string | null
  publication_url: string | null
  author: string | null
  publication_date: string | null
  publisher: string | null
  file_path: string | null
  file_type: string | null
  linked_product: {
    id: number
    price: number | null
  } | null
}

// Fallback data in case database table doesn't exist yet
const fallbackPublications = [
  {
    id: 1,
    title: 'The Equity Code',
    description: 'Check out my published work on Amazon',
    publication_url: 'https://a.co/d/bVCvCyT',
    author: null,
    publication_date: null,
    publisher: 'Amazon',
    file_path: '/The_Equity_Code_Cover.png',
    file_type: 'image/png',
    linked_product: null,
  },
]

export default function Publications() {
  const [publications, setPublications] = useState<Publication[]>([])
  const [loading, setLoading] = useState(true)
  const [usedFallback, setUsedFallback] = useState(false)

  useEffect(() => {
    fetchPublications()
  }, [])

  const fetchPublications = async () => {
    try {
      const response = await fetch('/api/publications?published=true')
      if (response.ok) {
        const data = await response.json()
        if (data && data.length > 0) {
          setPublications(data)
        } else {
          // Use fallback if no data from API
          setPublications(fallbackPublications)
          setUsedFallback(true)
        }
      } else {
        // Use fallback on error
        setPublications(fallbackPublications)
        setUsedFallback(true)
      }
    } catch (error) {
      console.error('Error fetching publications:', error)
      // Use fallback on error
      setPublications(fallbackPublications)
      setUsedFallback(true)
    } finally {
      setLoading(false)
    }
  }

  // Get image URL - either from file_path or use default
  const getImageUrl = (pub: Publication) => {
    if (pub.file_path) {
      // If it starts with /, it's a local public path
      if (pub.file_path.startsWith('/')) {
        return pub.file_path
      }
      // Otherwise it might be a Supabase storage path
      return pub.file_path
    }
    return '/The_Equity_Code_Cover.png'
  }

  if (loading) {
    return (
      <section id="publications" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-black to-gray-900">
        <div className="max-w-7xl mx-auto text-center">
          <div className="text-gray-400">Loading publications...</div>
        </div>
      </section>
    )
  }

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
          {/* Browse Store Link */}
          <Link 
            href="/store?type=ebook"
            className="inline-flex items-center gap-2 mt-6 text-purple-400 hover:text-purple-300 transition-colors group"
          >
            <ShoppingCart size={18} />
            <span>Browse Publications Store</span>
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {publications.map((publication, index) => (
            <motion.div
              key={publication.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group relative bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-800 hover:border-purple-500/50 transition-all duration-300 flex flex-col"
              style={{
                boxShadow: '0 0 20px rgba(139, 92, 246, 0.1)',
              }}
            >
              {/* Publication Image */}
              <div className="relative h-64 overflow-hidden rounded-t-xl flex-shrink-0">
                <motion.img
                  src={getImageUrl(publication)}
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
                
                {/* Purchase Badge */}
                {publication.linked_product && (
                  <Link
                    href={`/store/${publication.linked_product.id}`}
                    className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-white text-xs font-semibold shadow-lg hover:shadow-purple-500/50 transition-all hover:scale-105"
                  >
                    <ShoppingCart size={12} />
                    {publication.linked_product.price !== null 
                      ? `$${publication.linked_product.price.toFixed(2)}` 
                      : 'Free'}
                  </Link>
                )}
              </div>

              {/* Publication Content */}
              <div className="p-6 flex flex-col flex-grow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-white group-hover:text-purple-400 transition-colors">
                      {publication.title}
                    </h3>
                    {(publication.author || publication.publisher) && (
                      <p className="text-sm text-gray-400 mt-1">
                        {publication.author}
                        {publication.author && publication.publisher && ' • '}
                        {publication.publisher}
                      </p>
                    )}
                  </div>
                  <BookOpen className="text-purple-400 flex-shrink-0" size={20} />
                </div>

                {/* Expandable Description */}
                {publication.description && (
                  <ExpandableText
                    text={publication.description}
                    maxHeight={80}
                    className="text-gray-400 text-sm"
                    expandButtonColor="text-purple-400 hover:text-purple-300"
                  />
                )}

                {/* Spacer to push button to bottom */}
                <div className="flex-grow" />

                {/* Action Buttons */}
                <div className="space-y-2 mt-auto">
                  {/* Buy E-Book Button (if linked product exists) */}
                  {publication.linked_product && (
                    <Link
                      href={`/store/${publication.linked_product.id}`}
                      className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-white font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
                    >
                      <ShoppingCart size={18} />
                      <span>
                        Buy E-Book
                        {publication.linked_product.price !== null && 
                          ` - $${publication.linked_product.price.toFixed(2)}`
                        }
                      </span>
                    </Link>
                  )}
                  
                  {/* External Link (Amazon, etc.) */}
                  {publication.publication_url && (
                    <motion.a
                      href={publication.publication_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg text-white font-semibold hover:shadow-lg hover:shadow-orange-500/50 transition-all group/link"
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <span>View on Amazon</span>
                      <ExternalLink size={18} className="group-hover/link:translate-x-1 transition-transform" />
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
