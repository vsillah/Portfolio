'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { BookOpen, ExternalLink, ShoppingCart, ArrowRight, Download, Calendar, MailCheck } from 'lucide-react'
import ExpandableText from '@/components/ui/ExpandableText'
import { formatPriceOrFree } from '@/lib/pricing-model'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
  linked_lead_magnet: {
    id: string
    slug: string | null
    title: string
  } | null
}

// Fallback data in case database table doesn't exist yet
const fallbackPublications: Publication[] = [
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
    linked_lead_magnet: null,
  },
]

export default function Publications() {
  const [publications, setPublications] = useState<Publication[]>([])
  const [loading, setLoading] = useState(true)
  const [usedFallback, setUsedFallback] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [postDownloadOfferShown, setPostDownloadOfferShown] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [workshopNotifyStatus, setWorkshopNotifyStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const postDownloadRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    fetchPublications()
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setIsAuthenticated(true)
        setUserEmail(data.session.user?.email ?? null)
      }
    })
  }, [])

  useEffect(() => {
    if (postDownloadOfferShown && postDownloadRef.current) {
      const t = setTimeout(() => {
        postDownloadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
      return () => clearTimeout(t)
    }
  }, [postDownloadOfferShown])

  const handleLeadMagnetDownload = useCallback(async (lm: { id: string; slug: string | null }) => {
    if (!isAuthenticated) {
      const path = lm.slug ? `/ebook/${lm.slug}` : '/'
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('auth_next_path', path)
      }
      router.push('/auth/login')
      return
    }

    setDownloadingId(lm.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      const res = await fetch(`/api/lead-magnets/${lm.id}/download`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (res.ok) {
        const { downloadUrl } = await res.json()
        const a = document.createElement('a')
        a.href = downloadUrl
        a.setAttribute('download', `${(lm.slug || 'ebook').replace(/[^a-z0-9-]/gi, '-')}.epub`)
        a.rel = 'noopener noreferrer'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setUserEmail(session.user?.email ?? null)
        setPostDownloadOfferShown(true)
      }
    } catch {
      // Silent fail for UX
    } finally {
      setDownloadingId(null)
    }
  }, [isAuthenticated, router])

  const handleWorkshopNotify = useCallback(async () => {
    if (workshopNotifyStatus !== 'idle') return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.email) {
      setWorkshopNotifyStatus('error')
      return
    }
    setWorkshopNotifyStatus('loading')
    const name =
      (session.user.user_metadata?.full_name as string)?.trim() ||
      session.user.email?.split('@')[0] ||
      'Ebook reader'
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: session.user.email,
          message: "I'd like to be notified when the Accelerated Workshop launches.",
        }),
      })
      if (res.ok) {
        setWorkshopNotifyStatus('success')
      } else {
        setWorkshopNotifyStatus('error')
      }
    } catch {
      setWorkshopNotifyStatus('error')
    }
  }, [workshopNotifyStatus])

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
                <Image
                  src={getImageUrl(publication)}
                  alt={publication.title}
                  fill
                  className="object-contain p-8 transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 400px"
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-silicon-slate via-transparent to-transparent opacity-40" />
                
                {/* Book Icon Overlay */}
                <div className="absolute top-6 right-6 bg-radiant-gold text-imperial-navy p-3 rounded-full shadow-xl">
                  <BookOpen size={20} />
                </div>
                
                {/* Badge */}
                {publication.linked_lead_magnet ? (
                  <span className="absolute top-6 left-6 px-4 py-2 bg-imperial-navy/90 backdrop-blur-md border border-radiant-gold/20 rounded-full text-radiant-gold text-xs font-heading tracking-widest uppercase font-bold">
                    Free
                  </span>
                ) : publication.linked_product ? (
                  <Link
                    href={`/store/${publication.linked_product.id}`}
                    className="absolute top-6 left-6 px-4 py-2 bg-imperial-navy/90 backdrop-blur-md border border-radiant-gold/20 rounded-full text-radiant-gold text-xs font-heading tracking-widest uppercase font-bold"
                  >
                    {formatPriceOrFree(publication.linked_product.price ?? 0)}
                  </Link>
                ) : null}
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
                  {publication.linked_lead_magnet && (
                    <>
                      <button
                        onClick={() => handleLeadMagnetDownload(publication.linked_lead_magnet!)}
                        disabled={downloadingId === publication.linked_lead_magnet.id}
                        className="w-full flex items-center justify-center gap-3 py-3 bg-radiant-gold text-imperial-navy rounded-full text-[10px] font-heading tracking-widest uppercase font-bold hover:brightness-110 transition-all disabled:opacity-60"
                      >
                        <Download size={14} />
                        <span>
                          {downloadingId === publication.linked_lead_magnet.id
                            ? 'Preparing...'
                            : isAuthenticated
                              ? 'Download Free Ebook'
                              : 'Get Free Ebook'}
                        </span>
                      </button>
                      {publication.linked_lead_magnet.slug && (
                        <Link
                          href={`/ebook/${publication.linked_lead_magnet.slug}`}
                          className="w-full flex items-center justify-center gap-3 py-3 border border-radiant-gold/20 hover:bg-radiant-gold/5 rounded-full text-[10px] font-heading tracking-widest uppercase text-platinum-white/80 transition-all group/link"
                        >
                          <span>Learn More</span>
                          <ArrowRight size={14} className="group-hover/link:translate-x-1 transition-transform" />
                        </Link>
                      )}
                    </>
                  )}

                  {!publication.linked_lead_magnet && publication.linked_product && (
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

        {/* What's next? — shown after successful ebook download from this section */}
        {postDownloadOfferShown && (
          <motion.div
            ref={postDownloadRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mt-16 pt-16 border-t border-radiant-gold/10 text-center max-w-2xl mx-auto"
          >
            <p className="font-body text-platinum-white/60 text-lg mb-2">
              Your download has started.
            </p>
            <h3 className="font-premium text-xl sm:text-2xl text-platinum-white mb-6">
              What&apos;s next?
            </h3>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center flex-wrap">
              <a
                href="https://calendly.com/amadutown/atas-discovery-call"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 py-3 px-6 bg-radiant-gold text-imperial-navy rounded-full text-[10px] font-heading tracking-widest uppercase font-bold hover:brightness-110 transition-all"
              >
                <Calendar size={14} />
                <span>Book a free discovery call</span>
              </a>
              <div className="flex flex-col items-center gap-2">
                {userEmail && (
                  <p className="text-platinum-white/50 text-xs font-body">
                    We&apos;ll notify you at <strong className="text-platinum-white/70">{userEmail}</strong>
                  </p>
                )}
                {workshopNotifyStatus === 'idle' && (
                  <button
                    type="button"
                    onClick={handleWorkshopNotify}
                    className="inline-flex items-center justify-center gap-2 py-2.5 px-5 bg-silicon-slate/40 border border-radiant-gold/30 text-platinum-white rounded-full text-[10px] font-heading tracking-widest uppercase font-bold hover:bg-silicon-slate/60 transition-all"
                  >
                    <MailCheck size={14} />
                    <span>Notify me when the Accelerated Workshop opens</span>
                  </button>
                )}
                {workshopNotifyStatus === 'loading' && (
                  <span className="text-platinum-white/60 text-xs">Saving...</span>
                )}
                {workshopNotifyStatus === 'success' && (
                  <p className="text-radiant-gold text-xs font-body inline-flex items-center gap-2">
                    <MailCheck size={14} />
                    You&apos;re on the list. We&apos;ll email you when the workshop opens.
                  </p>
                )}
                {workshopNotifyStatus === 'error' && (
                  <p className="text-red-400/90 text-xs font-body">
                    Something went wrong. Please try again or use the contact form.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  )
}
