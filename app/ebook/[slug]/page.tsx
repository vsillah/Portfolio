'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { BookOpen, Download, CheckCircle, ArrowLeft, Sparkles, User, Calendar, MailCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Navigation from '@/components/Navigation'

interface LandingPageData {
  headline: string
  subheadline: string
  author: string
  coverImage: string
  ctaText: string
  hook: string
  benefits: string[]
  authorBio: string
}

interface LeadMagnet {
  id: string
  title: string
  slug: string
  description: string | null
  type: string
  download_count: number
  landing_page_data: LandingPageData | null
}

export default function EbookLandingPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [leadMagnet, setLeadMagnet] = useState<LeadMagnet | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPostDownloadOffer, setShowPostDownloadOffer] = useState(false)
  const [workshopNotifyStatus, setWorkshopNotifyStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const postDownloadRef = useRef<HTMLElement>(null)

  useEffect(() => {
    async function load() {
      const [lmRes, authRes] = await Promise.all([
        fetch(`/api/ebook/${encodeURIComponent(slug)}`),
        supabase.auth.getSession(),
      ])

      if (authRes.data.session) {
        setIsAuthenticated(true)
        setUserEmail(authRes.data.session.user?.email ?? null)
      }

      if (lmRes.ok) {
        const data = await lmRes.json()
        setLeadMagnet(data)
      } else {
        setError('not_found')
      }
      setLoading(false)
    }
    load()
  }, [slug])

  useEffect(() => {
    if (showPostDownloadOffer && postDownloadRef.current) {
      const t = setTimeout(() => {
        postDownloadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
      return () => clearTimeout(t)
    }
  }, [showPostDownloadOffer])

  const handleDownload = useCallback(async () => {
    if (!leadMagnet) return

    if (!isAuthenticated) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('auth_next_path', `/ebook/${slug}`)
      }
      router.push('/auth/login')
      return
    }

    setDownloading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        sessionStorage.setItem('auth_next_path', `/ebook/${slug}`)
        router.push('/auth/login')
        return
      }

      const res = await fetch(`/api/lead-magnets/${leadMagnet.id}/download`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!res.ok) {
        throw new Error('Download failed')
      }

      const { downloadUrl } = await res.json()
      // Trigger download in same window so we don't open a blank new tab
      const a = document.createElement('a')
      a.href = downloadUrl
      a.setAttribute('download', 'Accelerated-Building-Smarter-Products-with-AI.epub')
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setShowPostDownloadOffer(true)
    } catch {
      setError('download_failed')
    } finally {
      setDownloading(false)
    }
  }, [leadMagnet, isAuthenticated, slug, router])

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

  if (loading) {
    return (
      <main className="min-h-screen bg-imperial-navy">
        <Navigation />
        <div className="flex items-center justify-center min-h-screen">
          <div className="h-10 w-48 bg-silicon-slate/20 rounded-full animate-pulse" />
        </div>
      </main>
    )
  }

  if (error === 'not_found' || !leadMagnet) {
    return (
      <main className="min-h-screen bg-imperial-navy">
        <Navigation />
        <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-6">
          <h1 className="font-premium text-3xl text-platinum-white">Ebook not found</h1>
          <Link href="/" className="text-radiant-gold hover:underline text-sm font-heading uppercase tracking-widest">
            Back to Home
          </Link>
        </div>
      </main>
    )
  }

  const lp = leadMagnet.landing_page_data
  if (!lp) {
    return (
      <main className="min-h-screen bg-imperial-navy">
        <Navigation />
        <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-6">
          <h1 className="font-premium text-3xl text-platinum-white">{leadMagnet.title}</h1>
          <p className="text-platinum-white/60">Landing page content is being prepared.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-imperial-navy relative overflow-hidden">
      <Navigation />

      {/* Background effects */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-radiant-gold/5 blur-[150px] rounded-full" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-bronze/5 blur-[120px] rounded-full" />

      {/* Hero Section */}
      <section className="relative z-10 pt-32 pb-20 px-6 sm:px-10 lg:px-12">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8"
          >
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-platinum-white/50 hover:text-radiant-gold transition-colors text-sm font-heading uppercase tracking-widest"
            >
              <ArrowLeft size={14} />
              <span>Home</span>
            </Link>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Cover Image */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7 }}
              className="relative flex justify-center"
            >
              <div className="relative w-full max-w-sm">
                <div className="absolute -inset-4 bg-radiant-gold/10 blur-2xl rounded-3xl" />
                <Image
                  src={lp.coverImage}
                  alt={lp.headline}
                  width={400}
                  height={600}
                  className="relative rounded-2xl shadow-2xl w-full h-auto"
                  priority
                />
              </div>
            </motion.div>

            {/* Hero Copy */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="flex flex-col"
            >
              <div className="pill-badge bg-silicon-slate/30 border-radiant-gold/20 mb-6">
                <BookOpen className="w-3 h-3 text-radiant-gold" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-heading text-radiant-gold">
                  Free Ebook
                </span>
              </div>

              <h1 className="font-premium text-4xl sm:text-5xl lg:text-6xl text-platinum-white leading-[1.1] mb-4">
                <span className="italic text-radiant-gold">{lp.headline}</span>
              </h1>
              <p className="font-heading text-lg sm:text-xl text-platinum-white/70 tracking-wide mb-8">
                {lp.subheadline}
              </p>
              <p className="font-body text-platinum-white/50 text-base leading-relaxed mb-10">
                {lp.hook}
              </p>

              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 py-4 px-10 bg-radiant-gold text-imperial-navy rounded-full text-sm font-heading tracking-widest uppercase font-bold hover:brightness-110 transition-all disabled:opacity-60"
              >
                <Download size={18} />
                <span>{downloading ? 'Preparing...' : lp.ctaText}</span>
              </button>

              {!isAuthenticated && (
                <p className="text-platinum-white/40 text-xs font-body mt-4">
                  Free download — create an account to get your copy.
                </p>
              )}

              {leadMagnet.download_count > 0 && (
                <p className="text-platinum-white/30 text-xs font-body mt-3">
                  {leadMagnet.download_count.toLocaleString()} downloads
                </p>
              )}

              {error === 'download_failed' && (
                <p className="text-red-400 text-sm font-body mt-4">
                  Something went wrong. Please try again.
                </p>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* What You'll Learn */}
      <section className="relative z-10 py-24 px-6 sm:px-10 lg:px-12">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <div className="pill-badge bg-silicon-slate/30 border-radiant-gold/20 mb-6 mx-auto">
              <Sparkles className="w-3 h-3 text-radiant-gold" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-heading text-radiant-gold">
                Inside the Book
              </span>
            </div>
            <h2 className="font-premium text-3xl sm:text-4xl text-platinum-white">
              What You&apos;ll <span className="italic text-radiant-gold">Learn</span>
            </h2>
          </motion.div>

          <div className="space-y-6">
            {lp.benefits.map((benefit, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex items-start gap-4 p-6 bg-silicon-slate/20 backdrop-blur-md rounded-xl border border-radiant-gold/5 hover:border-radiant-gold/15 transition-all"
              >
                <CheckCircle className="w-6 h-6 text-radiant-gold flex-shrink-0 mt-0.5" />
                <p className="font-body text-platinum-white/80 text-base leading-relaxed">
                  {benefit}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* About the Author */}
      <section className="relative z-10 py-24 px-6 sm:px-10 lg:px-12">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-silicon-slate/30 backdrop-blur-md rounded-2xl border border-radiant-gold/10 p-10 sm:p-14"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-radiant-gold/20 flex items-center justify-center">
                <User className="w-7 h-7 text-radiant-gold" />
              </div>
              <div>
                <h3 className="font-premium text-2xl text-platinum-white">
                  {lp.author}
                </h3>
                <p className="text-[10px] font-heading tracking-widest text-platinum-white/40 uppercase">
                  Author
                </p>
              </div>
            </div>
            <p className="font-body text-platinum-white/60 text-base leading-relaxed">
              {lp.authorBio}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="relative z-10 py-24 px-6 sm:px-10 lg:px-12">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-premium text-3xl sm:text-4xl text-platinum-white mb-6">
              Ready to <span className="italic text-radiant-gold">Accelerate</span>?
            </h2>
            <p className="font-body text-platinum-white/50 text-lg mb-10 max-w-xl mx-auto">
              Get your free copy and start building smarter products with AI today.
            </p>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center justify-center gap-3 py-4 px-12 bg-radiant-gold text-imperial-navy rounded-full text-sm font-heading tracking-widest uppercase font-bold hover:brightness-110 transition-all disabled:opacity-60"
            >
              <Download size={18} />
              <span>{downloading ? 'Preparing...' : lp.ctaText}</span>
            </button>

            {leadMagnet.download_count > 0 && (
              <p className="text-platinum-white/30 text-xs font-body mt-4">
                Join {leadMagnet.download_count.toLocaleString()}+ readers
              </p>
            )}
          </motion.div>
        </div>
      </section>

      {/* What's next? — shown after successful download */}
      {showPostDownloadOffer && (
        <section
          ref={postDownloadRef}
          className="relative z-10 py-24 px-6 sm:px-10 lg:px-12 border-t border-radiant-gold/10"
        >
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <p className="font-body text-platinum-white/60 text-lg mb-2">
                Your download has started.
              </p>
              <h2 className="font-premium text-2xl sm:text-3xl text-platinum-white mb-8">
                What&apos;s next?
              </h2>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center flex-wrap">
                <a
                  href="https://calendly.com/amadutown/atas-discovery-call"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 py-4 px-8 bg-radiant-gold text-imperial-navy rounded-full text-sm font-heading tracking-widest uppercase font-bold hover:brightness-110 transition-all"
                >
                  <Calendar size={18} />
                  <span>Book a free discovery call</span>
                </a>
                <div className="flex flex-col items-center gap-2">
                  {userEmail && (
                    <p className="text-platinum-white/50 text-sm font-body">
                      We&apos;ll notify you at <strong className="text-platinum-white/70">{userEmail}</strong>
                    </p>
                  )}
                  {workshopNotifyStatus === 'idle' && (
                    <button
                      type="button"
                      onClick={handleWorkshopNotify}
                      className="inline-flex items-center justify-center gap-2 py-3 px-6 bg-silicon-slate/40 border border-radiant-gold/30 text-platinum-white rounded-full text-sm font-heading tracking-widest uppercase font-bold hover:bg-silicon-slate/60 transition-all"
                    >
                      <MailCheck size={16} />
                      <span>Notify me when the Accelerated Workshop opens</span>
                    </button>
                  )}
                  {workshopNotifyStatus === 'loading' && (
                    <span className="text-platinum-white/60 text-sm">Saving...</span>
                  )}
                  {workshopNotifyStatus === 'success' && (
                    <p className="text-radiant-gold text-sm font-body inline-flex items-center gap-2">
                      <MailCheck size={16} />
                      You&apos;re on the list. We&apos;ll email you when the workshop opens.
                    </p>
                  )}
                  {workshopNotifyStatus === 'error' && (
                    <p className="text-red-400/90 text-sm font-body">
                      Something went wrong. Please try again or use the contact form.
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      )}
    </main>
  )
}
