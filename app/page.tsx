'use client'

import { useEffect, useState } from 'react'
import Hero from '@/components/Hero'
import Projects from '@/components/Projects'
import Publications from '@/components/Publications'
import Music from '@/components/Music'
import Videos from '@/components/Videos'
import About from '@/components/About'
import Contact from '@/components/Contact'
import Navigation from '@/components/Navigation'

export default function Home() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <main className="min-h-screen">
      <Navigation />
      <Hero />
      <Projects />
      <Publications />
      <Music />
      <Videos />
      <About />
      <Contact />
    </main>
  )
}

