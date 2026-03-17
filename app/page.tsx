'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import Hero from '@/components/Hero'
import Navigation from '@/components/Navigation'
import { analytics } from '@/lib/analytics'

const ActiveCampaigns = dynamic(() => import('@/components/ActiveCampaigns'), { ssr: false })
const Store = dynamic(() => import('@/components/Store'), { ssr: false })
const Services = dynamic(() => import('@/components/Services'), { ssr: false })
const Publications = dynamic(() => import('@/components/Publications'), { ssr: false })
const About = dynamic(() => import('@/components/About'), { ssr: false })
const Contact = dynamic(() => import('@/components/Contact'), { ssr: false })

export default function Home() {
  useEffect(() => {
    analytics.pageView()
  }, [])


  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.5,
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

    const sections = ['home', 'campaigns', 'products', 'services', 'merchandise', 'publications', 'about', 'contact']
    sections.forEach((id) => {
      const element = document.getElementById(id)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [])

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
