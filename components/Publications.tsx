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
          setPublications(fallbackPublications)
          setUsedFallback(true)
        }
      } else {
        setPublications(fallbackPublications)
        setUsedFallback(true)
      }
    } catch (error) {
      console.error('Error fetching publications:', error)
      setPublications(fallbackPublications)
      setUsedFallback(true)
    } finally {
      setLoading(false)
    }
  }

  const getImageUrl = (pub: Publication) => {
    if (pub.file_path) {
      if (pub.file_path.startsWith('/')) {
        return pub.file_path
      }
      return pub.file_path
    }
    return '/The_Equity_Code_Cover.png'
  }

  if (loading) {
    return (
      <section id="publications" className="py-32 bg-imperial-navy">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="h-10 w-48 bg-silicon-slate/20 mx-auto rounded-full animate-pulse" />
        </div>
      </section>
    )
  }

  return (
    <section id="publications" className="py-32 px-6 sm:px-10 lg:px-12 bg-imperial-navy relative overflow-hidden">
      {/* Subtle Aurora */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-bronze/5 blur-[120px] rounded-full" />

      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <div className="pill-badge bg-silicon-slate/30 border-radiant-gold/20 mb-6 mx-auto">
            <BookOpen className="w-3 h-3 text-radiant-gold" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-heading text-radiant-gold">
              Library
            </span>
          </div>
          <h2 className="font-premium text-4xl md:text-6xl text-platinum-white mb-6">
            <span className="italic text-radiant-gold">Publications</span>
          </h2>
          <p className="font-body text-platinum-white/50 text-lg max-w-2xl mx-auto mb-10">
            Thought leadership and strategic guides for the digital frontier.
          </p>
          <Link 
            href="/store?type=ebook"
            className="inline-flex items-center gap-4 text-[10px] font-heading tracking-[0.3em] uppercase text-platinum-white/60 hover:text-radiant-gold transition-colors pb-2 border-b border-platinum-white/10"
          >
            <span>Browse Library Store</span>
            <ArrowRight size={14} />
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {publications.map((publication, index) => (
            <motion.div
              key={publication.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group relative bg-silicon-slate/40 backdrop-blur-md rounded-2xl overflow-hidden border border-radiant-gold/5 hover:border-radiant-gold/20 transition-all duration-500 flex flex-col"
            >
              {/* Publication Image */}
              <div className="relative h-80 overflow-hidden flex-shrink-0">
                <img
                  src={getImageUrl(publication)}
                  alt={publication.title}
                  className="w-full h-full object-contain p-8 transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-silicon-slate via-transparent to-transparent opacity-40" />
                
                {/* Book Icon Overlay */}
                <div className="absolute top-6 right-6 bg-radiant-gold text-imperial-navy p-3 rounded-full shadow-xl">
                  <BookOpen size={20} />
                </div>
                
                {/* Purchase Badge */}
                {publication.linked_product && (
                  <Link
                    href={`/store/${publication.linked_product.id}`}
                    className="absolute top-6 left-6 px-4 py-2 bg-imperial-navy/90 backdrop-blur-md border border-radiant-gold/20 rounded-full text-radiant-gold text-xs font-heading tracking-widest uppercase font-bold"
                  >
                    {publication.linked_product.price !== null 
                      ? `$${publication.linked_product.price.toFixed(2)}` 
                      : 'Free'}
                  </Link>
                )}
              </div>

              {/* Publication Content */}
              <div className="p-8 flex flex-col flex-grow relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-premium text-2xl text-platinum-white group-hover:text-radiant-gold transition-colors">
                      {publication.title}
                    </h3>
                    {(publication.author || publication.publisher) && (
                      <p className="text-[10px] font-heading tracking-widest text-platinum-white/40 mt-2 uppercase">
                        {publication.author}
                        {publication.author && publication.publisher && ' • '}
                        {publication.publisher}
                      </p>
                    )}
                  </div>
                </div>

                {/* Expandable Description */}
                {publication.description && (
                  <ExpandableText
                    text={publication.description}
                    maxHeight={80}
                    className="font-body text-platinum-white/50 text-sm leading-relaxed mb-8"
                    expandButtonColor="text-radiant-gold hover:text-gold-light"
                  />
                )}

                <div className="flex-grow" />

                <div className="space-y-3 pt-6 border-t border-radiant-gold/5">
                  {publication.linked_product && (
                    <Link
                      href={`/store/${publication.linked_product.id}`}
                      className="w-full flex items-center justify-center gap-3 py-3 bg-radiant-gold text-imperial-navy rounded-full text-[10px] font-heading tracking-widest uppercase font-bold hover:brightness-110 transition-all"
                    >
                      <ShoppingCart size={14} />
                      <span>Buy E-Book</span>
                    </Link>
                  )}
                  
                  {publication.publication_url && (
                    <motion.a
                      href={publication.publication_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-3 py-3 border border-radiant-gold/20 hover:bg-radiant-gold/5 rounded-full text-[10px] font-heading tracking-widest uppercase text-platinum-white/80 transition-all group/link"
                    >
                      <span>View on Amazon</span>
                      <ExternalLink size={14} className="group-hover/link:translate-x-1 transition-transform" />
                    </motion.a>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
