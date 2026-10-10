import dynamic from 'next/dynamic'
import Navigation from '@/components/Navigation'
import HomeAnalytics from '@/components/HomeAnalytics'

const Hero = dynamic(() => import('@/components/Hero'), { ssr: true })
const SystemStory = dynamic(() => import('@/components/SystemStory'), { ssr: true })
const RevenuePlumbingDiscoveryCard = dynamic(
  () => import('@/components/RevenuePlumbingDiscoveryCard'),
  { ssr: true },
)
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
      <SystemStory />
      <RevenuePlumbingDiscoveryCard />
      <Store section="products" />
      <Services />
      <Store section="merchandise" />
      <Publications />
      <About />
      <Contact />
    </main>
  )
}
