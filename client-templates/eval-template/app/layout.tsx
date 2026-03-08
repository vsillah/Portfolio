import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Eval Template',
  description: 'Chat evaluation with LLM-as-a-Judge and human annotation',
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
