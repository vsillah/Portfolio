import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Chatbot Template',
  description: 'AI Chatbot with n8n RAG integration and optional voice chat',
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
