'use client'

import Image from 'next/image'
import { Code, Users, Target, BarChart3, Lightbulb, Award } from 'lucide-react'
import Link from 'next/link'
import { useRevealOnScroll } from '@/lib/useRevealOnScroll'

export default function About() {
  const imageRef = useRevealOnScroll()
  const textRef = useRevealOnScroll()

  return (
    <section id="about" className="py-32 px-6 sm:px-10 lg:px-12 bg-silicon-slate/20 relative overflow-hidden">
      {/* Aurora */}
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-bronze/5 blur-[120px] rounded-full" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          
          {/* Profile Image with refined frame */}
          <div
            ref={imageRef}
            className="relative order-2 lg:order-1 reveal-on-scroll from-left"
          >
            <div className="relative mx-auto lg:mx-0 max-w-[400px]">
              <div 
                className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-radiant-gold/10"
              >
                <Image
                  src="/V Profile Autumn_Replicate.jpg"
                  alt="Vambah Sillah"
                  fill
                  className="object-cover grayscale-[20%] hover:grayscale-0 transition-all duration-700 hover:scale-105"
                  sizes="400px"
                  onError={(e) => { e.currentTarget.src = '/V Profile_Replicate.jpg' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-40" />
              </div>
              
              <div
                className="absolute -bottom-6 -right-6 glass-card px-6 py-4 border-radiant-gold/20 shadow-2xl hero-float"
              >
                <p className="text-[10px] font-heading tracking-[0.2em] text-radiant-gold uppercase mb-1">Experience</p>
                <p className="text-xl font-premium text-foreground">15+ Years</p>
              </div>
            </div>
          </div>

          {/* Text Content */}
          <div className="order-1 lg:order-2">
            <div
              ref={textRef}
              className="text-center reveal-on-scroll"
            >
              <div className="pill-badge bg-silicon-slate/30 border-radiant-gold/20 mb-6 mx-auto">
                <span className="text-[10px] uppercase tracking-[0.2em] font-heading text-radiant-gold">
                  Story
                </span>
              </div>
              <h2 className="font-premium text-4xl md:text-6xl text-foreground mb-8">
                <span className="italic text-radiant-gold">About</span>
              </h2>
              
              <div className="space-y-6">
                <p className="font-body text-muted-foreground text-lg leading-relaxed">
                  I&apos;m an IT Product Manager with a proven track record of applying agile methodology to continuously evolve products to delight customers. Skilled facilitator with a passion for inspiring teams to deliver innovative solutions.
                </p>
                <p className="font-body text-muted-foreground text-lg leading-relaxed">
                  My entrepreneurial mindset drives a bias for customer-focused innovation, transforming complex data into actionable insights that lead to market leadership.
                </p>
                <p className="font-body text-muted-foreground text-base pt-2">
                  <Link href="/work" className="text-radiant-gold hover:text-gold-light underline underline-offset-2 transition-colors">View my previous work</Link>
                  {' · '}
                  <Link href="/personal" className="text-radiant-gold hover:text-gold-light underline underline-offset-2 transition-colors">Music & videos</Link>
                </p>
              </div>

              <div className="mt-12 grid grid-cols-2 gap-8 border-t border-radiant-gold/10 pt-10">
                <div>
                  <p className="text-[10px] font-heading tracking-widest text-radiant-gold uppercase mb-2">Education</p>
                  <p className="text-sm font-body text-muted-foreground">BS Business Administration, Boston University (2008)</p>
                </div>
                <div>
                  <p className="text-[10px] font-heading tracking-widest text-radiant-gold uppercase mb-2">Creative</p>
                  <p className="text-sm font-body text-muted-foreground">Mad Hadda - &quot;Into the Rabbit Hole&quot; (2025)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

