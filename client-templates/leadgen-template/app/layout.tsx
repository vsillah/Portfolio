import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lead Generation Template',
  description: 'Lead generation with contact forms, lead magnets, and n8n qualification',
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
