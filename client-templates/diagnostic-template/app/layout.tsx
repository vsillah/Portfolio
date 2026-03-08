import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Diagnostic Template',
  description: 'Diagnostic assessment with Supabase and n8n completion webhook',
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
