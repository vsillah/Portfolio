import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/components/AuthProvider'
import { SpeedInsights } from '@vercel/speed-insights/next'

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
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
        <SpeedInsights />
      </body>
    </html>
  )
}

