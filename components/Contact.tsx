'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Github, Linkedin, Send, Music, BookOpen, ArrowRight, MessageCircle, FileText } from 'lucide-react'
import { useState, useEffect } from 'react'
import { analytics } from '@/lib/analytics'
import { MagneticButton } from './ui/MagneticButton'
import { Chat } from './chat'

const socialLinks = [
  { icon: Linkedin, href: 'https://www.linkedin.com/in/vambah-sillah-08989b8/', label: 'LinkedIn' },
  { icon: Mail, href: 'mailto:vsillah@gmail.com', label: 'Email' },
  { icon: Music, href: 'https://open.spotify.com/artist/1B5vy5knIGXOxClIzkkVHR?si=frSOxcxXSPCi6S04691zkg', label: 'Spotify' },
  { icon: Github, href: 'https://github.com/vsillah', label: 'GitHub' },
  { icon: BookOpen, href: 'https://medium.com/@vsillah', label: 'Medium' },
]

type ContactTab = 'form' | 'chat'

const revenueRanges = [
  { value: '', label: 'Select revenue range (optional)' },
  { value: 'under_100k', label: 'Under $100K' },
  { value: '100k_500k', label: '$100K - $500K' },
  { value: '500k_1m', label: '$500K - $1M' },
  { value: '1m_5m', label: '$1M - $5M' },
  { value: '5m_10m', label: '$5M - $10M' },
  { value: '10m_50m', label: '$10M - $50M' },
  { value: 'over_50m', label: 'Over $50M' },
]

const interestOptions = [
  { value: 'consulting', label: 'Consulting Services' },
  { value: 'technology', label: 'Technology Solutions' },
  { value: 'speaking', label: 'Speaking Engagement' },
  { value: 'partnership', label: 'Partnership Opportunity' },
  { value: 'investment', label: 'Investment Discussion' },
  { value: 'other', label: 'Other' },
]

// Helper function to normalize URLs - adds https:// if missing
const normalizeUrl = (url: string): string => {
  if (!url || !url.trim()) return url
  const trimmed = url.trim()
  // If it already starts with http:// or https://, return as-is
  if (trimmed.match(/^https?:\/\//i)) return trimmed
  // Otherwise, add https://
  return `https://${trimmed}`
}

export default function Contact() {
  const [activeTab, setActiveTab] = useState<ContactTab>('chat')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    companyDomain: '',
    linkedinUrl: '',
    annualRevenue: '',
    interestAreas: [] as string[],
    isDecisionMaker: false,
    message: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    analytics.contactFormView()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus('idle')
    setStatusMessage('')

    // Normalize URLs before submission
    const normalizedData = {
      ...formData,
      companyDomain: formData.companyDomain ? normalizeUrl(formData.companyDomain) : '',
      linkedinUrl: formData.linkedinUrl ? normalizeUrl(formData.linkedinUrl) : '',
    }

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(normalizedData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send message')
      }

      setSubmitStatus('success')
      setStatusMessage('Message sent successfully! I\'ll get back to you soon.')
      analytics.contactFormSubmit()
      setFormData({ name: '', email: '', company: '', companyDomain: '', linkedinUrl: '', annualRevenue: '', interestAreas: [], isDecisionMaker: false, message: '' })
      
      setTimeout(() => {
        setSubmitStatus('idle')
        setStatusMessage('')
      }, 5000)
    } catch (error) {
      console.error('Error submitting form:', error)
      setSubmitStatus('error')
      setStatusMessage(
        error instanceof Error 
          ? error.message 
          : 'Failed to send message. Please try again or email me directly at vsillah@gmail.com'
      )
      
      setTimeout(() => {
        setSubmitStatus('idle')
        setStatusMessage('')
      }, 5000)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section id="contact" className="py-32 px-6 sm:px-10 lg:px-12 bg-imperial-navy relative overflow-hidden">
      {/* Aurora */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-radiant-gold/5 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-20"
        >
          <div className="pill-badge bg-silicon-slate/30 border-radiant-gold/20 mb-6">
            <span className="text-[10px] uppercase tracking-[0.2em] font-heading text-radiant-gold">
              Inquiry
            </span>
          </div>
          <h2 className="font-premium text-4xl md:text-6xl text-platinum-white mb-6">
            <span className="italic text-radiant-gold">Contact</span>
          </h2>
          <p className="font-body text-platinum-white/50 text-lg max-w-2xl mx-auto leading-relaxed">
            Whether you have a specific inquiry or just want to explore possibilities, 
            I'm here to bridge the gap between your vision and reality.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-16 text-left items-start">
          {/* Contact Details */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-2 space-y-12"
          >
            {/* Profile Photo */}
            <div className="relative">
              <div className="relative w-28 h-36 mx-auto lg:mx-0 rounded-2xl overflow-hidden border border-radiant-gold/20 shadow-xl">
                <img
                  src="/Profile_Photo_1.jpg"
                  alt="Vambah Sillah"
                  className="w-full h-full object-cover object-top grayscale-[20%] hover:grayscale-0 transition-all duration-500"
                  onError={(e) => { e.currentTarget.src = '/Profile Photo.png' }}
                />
              </div>
              {/* Subtle glow behind photo */}
              <div 
                className="absolute inset-0 -z-10 blur-2xl opacity-30"
                style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.4) 0%, transparent 70%)' }}
              />
            </div>

            <div>
              <h3 className="text-[10px] font-heading tracking-[0.2em] text-radiant-gold uppercase mb-6">Contact Info</h3>
              <div className="space-y-4">
                <a href="mailto:vsillah@gmail.com" className="block font-premium text-2xl text-platinum-white hover:text-radiant-gold transition-colors">
                  vsillah@gmail.com
                </a>
                <p className="font-body text-platinum-white/50 text-lg">
                  617-967-7448 <br />
                  Medford, MA
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-[10px] font-heading tracking-[0.2em] text-radiant-gold uppercase mb-6">Socials</h3>
              <div className="flex flex-wrap gap-4">
                {socialLinks.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 bg-silicon-slate/30 border border-radiant-gold/10 rounded-full text-platinum-white/60 hover:text-radiant-gold hover:border-radiant-gold/40 transition-all"
                  >
                    <social.icon size={18} />
                  </a>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Contact Form / Chat */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-3"
          >
            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex items-center gap-2 px-5 py-3 rounded-full text-[10px] font-heading tracking-[0.15em] uppercase transition-all duration-300 ${
                  activeTab === 'chat'
                    ? 'bg-gradient-to-r from-radiant-gold to-bronze text-imperial-navy'
                    : 'bg-silicon-slate/30 border border-radiant-gold/20 text-platinum-white/70 hover:border-radiant-gold/40 hover:text-platinum-white'
                }`}
              >
                <MessageCircle size={14} />
                Chat Now
              </button>
              <button
                onClick={() => setActiveTab('form')}
                className={`flex items-center gap-2 px-5 py-3 rounded-full text-[10px] font-heading tracking-[0.15em] uppercase transition-all duration-300 ${
                  activeTab === 'form'
                    ? 'bg-gradient-to-r from-radiant-gold to-bronze text-imperial-navy'
                    : 'bg-silicon-slate/30 border border-radiant-gold/20 text-platinum-white/70 hover:border-radiant-gold/40 hover:text-platinum-white'
                }`}
              >
                <FileText size={14} />
                Send Message
              </button>
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              {activeTab === 'chat' ? (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <Chat 
                    visitorEmail={formData.email || undefined}
                    visitorName={formData.name || undefined}
                  />
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleSubmit}
                  className="glass-card p-10 border-radiant-gold/10 space-y-8"
                >
                  {/* Status Message */}
                  {statusMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 rounded-lg text-sm font-body ${
                        submitStatus === 'success' 
                          ? 'bg-radiant-gold/10 border border-radiant-gold/20 text-radiant-gold' 
                          : 'bg-red-500/10 border border-red-500/20 text-red-400'
                      }`}
                    >
                      {statusMessage}
                    </motion.div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-heading tracking-widest text-platinum-white/40 uppercase">Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        className="w-full bg-transparent border-b border-platinum-white/10 py-2 font-body text-platinum-white focus:outline-none focus:border-radiant-gold transition-colors placeholder:text-platinum-white/5"
                        placeholder="Your full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-heading tracking-widest text-platinum-white/40 uppercase">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                        className="w-full bg-transparent border-b border-platinum-white/10 py-2 font-body text-platinum-white focus:outline-none focus:border-radiant-gold transition-colors placeholder:text-platinum-white/5"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-heading tracking-widest text-platinum-white/40 uppercase">Company / Organization</label>
                      <input
                        type="text"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="w-full bg-transparent border-b border-platinum-white/10 py-2 font-body text-platinum-white focus:outline-none focus:border-radiant-gold transition-colors placeholder:text-platinum-white/5"
                        placeholder="Your company (optional)"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-heading tracking-widest text-platinum-white/40 uppercase">Company Domain</label>
                      <input
                        type="text"
                        value={formData.companyDomain}
                        onChange={(e) => setFormData({ ...formData, companyDomain: e.target.value })}
                        onBlur={(e) => {
                          if (e.target.value.trim()) {
                            setFormData({ ...formData, companyDomain: normalizeUrl(e.target.value) })
                          }
                        }}
                        className="w-full bg-transparent border-b border-platinum-white/10 py-2 font-body text-platinum-white focus:outline-none focus:border-radiant-gold transition-colors placeholder:text-platinum-white/5"
                        placeholder="company.com (optional)"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-heading tracking-widest text-platinum-white/40 uppercase">LinkedIn Profile URL</label>
                      <input
                        type="url"
                        value={formData.linkedinUrl}
                        onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                        onBlur={(e) => {
                          if (e.target.value.trim()) {
                            setFormData({ ...formData, linkedinUrl: normalizeUrl(e.target.value) })
                          }
                        }}
                        className="w-full bg-transparent border-b border-platinum-white/10 py-2 font-body text-platinum-white focus:outline-none focus:border-radiant-gold transition-colors placeholder:text-platinum-white/5"
                        placeholder="https://linkedin.com/in/your-profile (optional)"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-heading tracking-widest text-platinum-white/40 uppercase">Annual Revenue</label>
                      <select
                        value={formData.annualRevenue}
                        onChange={(e) => setFormData({ ...formData, annualRevenue: e.target.value })}
                        className="w-full bg-transparent border-b border-platinum-white/10 py-2 font-body text-platinum-white focus:outline-none focus:border-radiant-gold transition-colors [&>option]:bg-imperial-navy [&>option]:text-platinum-white"
                      >
                        {revenueRanges.map((range) => (
                          <option key={range.value} value={range.value}>
                            {range.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-heading tracking-widest text-platinum-white/40 uppercase">Areas of Interest</label>
                    <div className="flex flex-wrap gap-2">
                      {interestOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            const newInterests = formData.interestAreas.includes(option.value)
                              ? formData.interestAreas.filter(i => i !== option.value)
                              : [...formData.interestAreas, option.value]
                            setFormData({ ...formData, interestAreas: newInterests })
                          }}
                          className={`px-3 py-1.5 rounded-full text-[10px] font-heading tracking-wider uppercase transition-all duration-200 ${
                            formData.interestAreas.includes(option.value)
                              ? 'bg-radiant-gold/20 border border-radiant-gold/50 text-radiant-gold'
                              : 'bg-silicon-slate/20 border border-platinum-white/10 text-platinum-white/50 hover:border-platinum-white/30'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isDecisionMaker: !formData.isDecisionMaker })}
                      className={`w-5 h-5 rounded border transition-all duration-200 flex items-center justify-center ${
                        formData.isDecisionMaker
                          ? 'bg-radiant-gold border-radiant-gold'
                          : 'bg-transparent border-platinum-white/20 hover:border-platinum-white/40'
                      }`}
                    >
                      {formData.isDecisionMaker && (
                        <svg className="w-3 h-3 text-imperial-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <label 
                      onClick={() => setFormData({ ...formData, isDecisionMaker: !formData.isDecisionMaker })}
                      className="text-[10px] font-heading tracking-widest text-platinum-white/60 uppercase cursor-pointer"
                    >
                      I am a decision maker / budget holder
                    </label>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-heading tracking-widest text-platinum-white/40 uppercase">Message</label>
                    <textarea
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      required
                      rows={4}
                      className="w-full bg-transparent border-b border-platinum-white/10 py-2 font-body text-platinum-white focus:outline-none focus:border-radiant-gold transition-colors placeholder:text-platinum-white/5 resize-none"
                      placeholder="What are you envisioning?"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-gold w-full flex items-center justify-center gap-3 rounded-full text-[10px] font-heading tracking-[0.2em] uppercase disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-transform"
                  >
                    {isSubmitting ? 'Sending...' : 'Send Message'}
                    {!isSubmitting && <ArrowRight size={14} />}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Footer */}
        <div className="mt-32 pt-12 border-t border-radiant-gold/5 flex flex-col md:flex-row items-center justify-between gap-6 opacity-40">
          <p className="text-[10px] font-heading tracking-[0.2em] uppercase text-platinum-white">
            © {new Date().getFullYear()} Vambah Sillah
          </p>
          <div className="flex gap-8">
            <p className="text-[10px] font-heading tracking-[0.2em] uppercase text-platinum-white">
              Based in Medford, MA
            </p>
            <p className="text-[10px] font-heading tracking-[0.2em] uppercase text-platinum-white">
              Built with Passion
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}