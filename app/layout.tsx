import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Vambah Sillah | Director, Product Management',
  description: 'IT Product Manager with a proven track record of applying agile methodology to continuously evolve products to delight customers',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

