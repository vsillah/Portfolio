import type { Metadata } from 'next'
import { Orbitron, Inter, Cormorant_Garamond } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/AuthProvider'
import { SpeedInsights } from '@vercel/speed-insights/next'

// AmaduTown Brand Typography
const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron',
  display: 'swap',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-cormorant',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Vambah Sillah | Director of Product Strategy at a Fortune 500 Company, AI Automations specialist, Author, Hip Hop Artist, and Co-Founder of AmaduTown Advisory Solutions',
  description: 'IT Product Manager with a proven track record of applying agile methodology to continuously evolve products to delight customers',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${orbitron.variable} ${inter.variable} ${cormorant.variable}`}>
      <body className="font-body selection:bg-radiant-gold/30 selection:text-white">
        <AuthProvider>{children}</AuthProvider>
        <SpeedInsights />
      </body>
    </html>
  )
}

