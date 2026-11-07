import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Navigation from '@/components/Navigation'
import ActivationExperiencePage from '@/components/activation/ActivationExperiencePage'
import { activationPageConfig } from '@/lib/app-activation-experience.server'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Adult tester activation | AmaduTown', robots: { index: false, follow: false }, referrer: 'no-referrer' }

export default function ActivatePage({ params }: { params: { appKey: string } }) {
  const config = activationPageConfig(params.appKey)
  if (!config) notFound()
  return <main className="min-h-screen overflow-x-clip bg-background text-foreground"><Navigation /><ActivationExperiencePage {...config} /></main>
}
