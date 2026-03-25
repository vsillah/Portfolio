import dynamic from 'next/dynamic'
import Navigation from '@/components/Navigation'
import HomeAnalytics from '@/components/HomeAnalytics'

const Hero = dynamic(() => import('@/components/Hero'), { ssr: true })
const ActiveCampaigns = dynamic(() => import('@/components/ActiveCampaigns'), { ssr: false })
const Store = dynamic(() => import('@/components/Store'), { ssr: false })
const Services = dynamic(() => import('@/components/Services'), { ssr: false })
const Publications = dynamic(() => import('@/components/Publications'), { ssr: false })
const About = dynamic(() => import('@/components/About'), { ssr: false })
const Contact = dynamic(() => import('@/components/Contact'), { ssr: false })

export default function Home() {
  return (
    <main className="min-h-screen relative">
      <HomeAnalytics />
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
