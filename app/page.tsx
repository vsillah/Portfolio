'use client'

import { useEffect, useState } from 'react'
import Hero from '@/components/Hero'
import ActiveCampaigns from '@/components/ActiveCampaigns'
import Publications from '@/components/Publications'
import Store from '@/components/Store'
import Services from '@/components/Services'
import About from '@/components/About'
import Contact from '@/components/Contact'
import Navigation from '@/components/Navigation'
import { analytics } from '@/lib/analytics'

export default function Home() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Track page view
    analytics.pageView()
  }, [])

  // Track section views on scroll
  useEffect(() => {
    if (!mounted) return

    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.5, // Trigger when 50% of section is visible
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const section = entry.target.id
          if (section) {
            analytics.sectionView(section as any)
          }
        }
      })
    }, observerOptions)

    // Observe all sections (offerings-first home: no projects, prototypes, music, videos)
    const sections = ['home', 'campaigns', 'products', 'services', 'merchandise', 'publications', 'about', 'contact']
    sections.forEach((id) => {
      const element = document.getElementById(id)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [mounted])

  if (!mounted) {
    return null
  }

  return (
    <main className="min-h-screen relative">
      <Navigation />
      <Hero />
      <ActiveCampaigns />
      <Store section="products" />
      <Services />
      <Store section="merchandise" />
      <Publications />
      <About />
      <Contact />
    </main>
  )
}
