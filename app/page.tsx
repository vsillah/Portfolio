'use client'

import { useEffect, useState } from 'react'
import Hero from '@/components/Hero'
import Projects from '@/components/Projects'
import AppPrototypes from '@/components/AppPrototypes'
import Publications from '@/components/Publications'
import Music from '@/components/Music'
import Videos from '@/components/Videos'
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

    // Observe all sections
    const sections = ['home', 'projects', 'prototypes', 'publications', 'music', 'videos', 'store', 'services', 'about', 'contact']
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
      <Projects />
      <AppPrototypes />
      <Publications />
      <Music />
      <Videos />
      <Store />
      <Services />
      <About />
      <Contact />
    </main>
  )
}
