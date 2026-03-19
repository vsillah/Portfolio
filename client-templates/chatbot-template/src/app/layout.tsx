import type { Metadata } from 'next'
import { branding } from '@/lib/config'
import './globals.css'

export const metadata: Metadata = {
  title: branding.pageTitle,
  description: branding.pageDescription,
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
